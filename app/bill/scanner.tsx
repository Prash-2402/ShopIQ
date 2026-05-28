import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ActivityIndicator, Vibration, Animated, TextInput } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { useBillStore } from '../../store/billStore';
import { isGeminiConfigured, detectProductFromImage } from '../../services/ai/gemini';
import { resolveProductByBarcode } from '../../services/supabase/products';

export default function ScannerScreen() {
  const router = useRouter();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  
  // Scanning state
  const [scanned, setScanned] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('Align barcode to scan');
  const [aiMode, setAiMode] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Camera Ref
  const cameraRef = useRef<any>(null);
  
  // Bottom Sheet States
  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);
  const [bottomSheetName, setBottomSheetName] = useState('');
  const [bottomSheetPrice, setBottomSheetPrice] = useState('');
  const [bottomSheetCategory, setBottomSheetCategory] = useState('');
  const [bottomSheetQuantity, setBottomSheetQuantity] = useState(1);
  const translateY = useRef(new Animated.Value(600)).current;

  const addItem = useBillStore((state) => state.addItem);

  // Success animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const [successItemName, setSuccessItemName] = useState<string | null>(null);

  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };
    getCameraPermissions();
  }, []);

  // 1. Bottom Sheet Slide Up/Down Animations
  const openBottomSheet = () => {
    setBottomSheetVisible(true);
    Animated.spring(translateY, {
      toValue: 0,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const closeBottomSheet = () => {
    Animated.timing(translateY, {
      toValue: 600,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setBottomSheetVisible(false);
    });
  };

  // 2. Barcode lookup query
  const lookupMutation = useMutation({
    mutationFn: async (barcode: string) => {
      setStatusMessage('Resolving product details...');
      return await resolveProductByBarcode(barcode);
    },
    onSuccess: (product, barcode) => {
      Vibration.vibrate(100);

      addItem({
        id: barcode,
        name: product.name,
        price: product.price,
        quantity: 1,
      });

      setSuccessItemName(product.name);
      triggerSuccessAnimation();

      setStatusMessage('Success! Scanning resumed...');
      
      setTimeout(() => {
        setScanned(false);
        setScannedBarcode(null);
        setStatusMessage('Align barcode to scan');
      }, 1500);
    },
    onError: (error) => {
      console.error(error);
      Vibration.vibrate([0, 100, 50, 100]);
      setStatusMessage('Failed to resolve product details.');
      
      setTimeout(() => {
        setScanned(false);
        setScannedBarcode(null);
        setStatusMessage('Align barcode to scan');
      }, 2000);
    },
  });

  const triggerSuccessAnimation = () => {
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.8);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1.2,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }).start(() => setSuccessItemName(null));
      }, 800);
    });
  };

  // 3. Capture image & identify via Gemini Vision API
  const handleAIDetect = async () => {
    if (!cameraRef.current || loading || bottomSheetVisible) return;
    setLoading(true);
    setStatusMessage('Capturing product image...');
    Vibration.vibrate(30);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        skipProcessing: true,
      });

      if (photo && photo.uri) {
        setStatusMessage('Identifying product via Gemini...');
        const result = await detectProductFromImage(photo.uri);
        
        setBottomSheetName(result.productName);
        setBottomSheetPrice(result.price.toString());
        setBottomSheetCategory(result.category);
        setBottomSheetQuantity(1);
        
        setStatusMessage('Adjust details and add');
        openBottomSheet();
      } else {
        throw new Error('Image capture failed.');
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'AI recognition failed. Please try again.');
      setStatusMessage('Align product to snap');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAIPromptItem = () => {
    if (!bottomSheetName || !bottomSheetPrice) return;
    
    Vibration.vibrate(80);
    addItem({
      id: 'ai-' + Math.random().toString(36).substring(2, 10),
      name: bottomSheetName,
      price: parseFloat(bottomSheetPrice) || 0,
      quantity: bottomSheetQuantity,
    });

    setSuccessItemName(bottomSheetName);
    triggerSuccessAnimation();
    
    closeBottomSheet();
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned || lookupMutation.isPending || bottomSheetVisible) return;
    setScanned(true);
    setScannedBarcode(data);
    
    Vibration.vibrate(40);
    lookupMutation.mutate(data);
  };

  if (hasPermission === null) {
    return (
      <View className="flex-1 bg-[#0A0E1A] items-center justify-center">
        <Text className="text-gray-400 font-semibold">Requesting camera permission...</Text>
      </View>
    );
  }
  if (hasPermission === false) {
    return (
      <View className="flex-1 bg-[#0A0E1A] items-center justify-center p-6">
        <Text className="text-red-400 font-bold text-center text-lg mb-4">No camera access granted</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-indigo-600 px-6 py-3 rounded-xl"
        >
          <Text className="text-white font-bold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-1">
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          onBarcodeScanned={scanned || aiMode || bottomSheetVisible ? undefined : handleBarcodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr', 'ean13', 'upc_a'],
          }}
        />

        {/* Success Overlay Flash */}
        {successItemName && (
          <Animated.View 
            style={{ opacity: fadeAnim }}
            pointerEvents="none"
            className="absolute inset-0 items-center justify-center bg-emerald-950/20 z-20"
          >
            <Animated.View 
              style={{ transform: [{ scale: scaleAnim }] }}
              className="w-80 h-80 border-4 border-emerald-400 rounded-full items-center justify-center"
            >
              <View className="w-72 h-72 bg-emerald-500/10 rounded-full items-center justify-center" />
            </Animated.View>
            
            <View className="absolute bottom-32 bg-emerald-500 border border-emerald-400 px-6 py-3.5 rounded-2xl shadow-lg items-center max-w-[85%]">
              <Text className="text-white font-black text-sm uppercase tracking-widest">Added Product</Text>
              <Text className="text-white font-extrabold text-base mt-1 text-center" numberOfLines={1}>
                {successItemName}
              </Text>
              <Text className="text-emerald-100 font-bold text-xs mt-0.5">Cart Updated</Text>
            </View>
          </Animated.View>
        )}

        {/* Top Navigation Controls */}
        <View className="absolute top-12 left-6 right-6 flex-row justify-between items-center z-10">
          <TouchableOpacity
            onPress={() => router.back()}
            disabled={bottomSheetVisible}
            className="bg-black/60 w-10 h-10 rounded-full items-center justify-center"
          >
            <Text className="text-white text-base">✕</Text>
          </TouchableOpacity>
          <Text className="text-white font-extrabold text-xs bg-black/60 px-4 py-2 rounded-full">
            {aiMode ? '📸 AI VISION ACTIVE' : '⚡ RAPID SCANNING'}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setAiMode(!aiMode);
              setStatusMessage(!aiMode ? 'Align product and snap photo' : 'Align barcode to scan');
            }}
            disabled={bottomSheetVisible}
            className="bg-black/60 px-4 py-2 rounded-full"
          >
            <Text className="text-indigo-400 font-bold text-xs">
              {aiMode ? 'Use Barcode' : 'Use AI'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Viewfinder Target & Status Overlay */}
        {!bottomSheetVisible && (
          <View className="flex-1 justify-center items-center">
            <View className={`w-72 h-72 border-2 rounded-3xl items-center justify-center bg-transparent ${
              lookupMutation.isPending || loading ? 'border-amber-500' : successItemName ? 'border-emerald-500' : 'border-indigo-500'
            }`}>
              {(lookupMutation.isPending || loading) && (
                <View className="items-center">
                  <ActivityIndicator size="large" color="#F59E0B" />
                  <Text className="text-amber-500 font-extrabold text-[10px] mt-3 uppercase tracking-wider">
                    {loading ? 'AI RUNNING' : 'CALLING GEMINI'}
                  </Text>
                </View>
              )}
              {!lookupMutation.isPending && !loading && !successItemName && (
                <View className="w-64 h-[1.5px] bg-indigo-500/80 absolute top-1/2 left-4" />
              )}
            </View>

            {/* Status Toast bar */}
            <View className="bg-black/80 border border-gray-900 px-6 py-3 rounded-full mt-8 flex-row items-center max-w-[85%]">
              <View className={`w-2.5 h-2.5 rounded-full mr-2.5 ${lookupMutation.isPending || loading ? 'bg-amber-500' : scanned ? 'bg-red-500' : 'bg-green-500'}`} />
              <Text className="text-white text-xs font-bold text-center" numberOfLines={1}>
                {statusMessage}
              </Text>
            </View>
            
            {scannedBarcode && (
              <Text className="text-gray-500 text-[10px] font-semibold mt-2.5">
                Code: {scannedBarcode}
              </Text>
            )}
          </View>
        )}

        {/* Custom Slide-Up Bottom Sheet Editor */}
        {bottomSheetVisible && (
          <Animated.View 
            style={{ transform: [{ translateY }] }}
            className="absolute bottom-0 left-0 right-0 bg-[#0F1424] border-t border-gray-800 rounded-t-3xl p-6 z-30"
          >
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-white text-lg font-black">AI Detection Details</Text>
              <TouchableOpacity onPress={closeBottomSheet}>
                <Text className="text-red-400 font-semibold text-sm">Cancel</Text>
              </TouchableOpacity>
            </View>

            <View className="mb-4">
              <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Product Name</Text>
              <TextInput
                className="bg-[#13192B] border border-gray-800 text-white rounded-xl px-4 py-3 font-semibold text-sm"
                placeholder="e.g. Fortune Mustard Oil 1L"
                placeholderTextColor="#4B5563"
                value={bottomSheetName}
                onChangeText={setBottomSheetName}
              />
            </View>

            <View className="flex-row justify-between mb-6">
              <View className="w-[48%]">
                <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Price (INR)</Text>
                <TextInput
                  className="bg-[#13192B] border border-gray-800 text-white rounded-xl px-4 py-3 font-semibold text-sm"
                  placeholder="Price"
                  placeholderTextColor="#4B5563"
                  keyboardType="numeric"
                  value={bottomSheetPrice}
                  onChangeText={setBottomSheetPrice}
                />
              </View>

              <View className="w-[48%]">
                <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Quantity</Text>
                <View className="flex-row items-center justify-between bg-[#13192B] border border-gray-800 rounded-xl px-2 py-1">
                  <TouchableOpacity
                    onPress={() => setBottomSheetQuantity(q => Math.max(1, q - 1))}
                    className="w-8 h-8 items-center justify-center bg-gray-800 rounded-lg"
                  >
                    <Text className="text-white font-bold">-</Text>
                  </TouchableOpacity>
                  <Text className="text-white font-bold text-base">{bottomSheetQuantity}</Text>
                  <TouchableOpacity
                    onPress={() => setBottomSheetQuantity(q => q + 1)}
                    className="w-8 h-8 items-center justify-center bg-gray-800 rounded-lg"
                  >
                    <Text className="text-white font-bold">+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleAddAIPromptItem}
              disabled={!bottomSheetName || !bottomSheetPrice}
              className={`w-full py-4 rounded-xl items-center justify-center ${
                bottomSheetName && bottomSheetPrice ? 'bg-emerald-600 shadow-md shadow-emerald-500/20' : 'bg-gray-800 opacity-50'
              }`}
            >
              <Text className="text-white text-base font-extrabold">Confirm & Add to Bill</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Snap trigger for AI vision */}
        {aiMode && !bottomSheetVisible && (
          <View className="absolute bottom-12 left-6 right-6 items-center">
            <TouchableOpacity
              onPress={handleAIDetect}
              disabled={loading}
              className="bg-indigo-600 px-8 py-4 rounded-3xl shadow-lg shadow-indigo-500/40"
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-white font-extrabold text-base">📸 Snap & Detect with AI</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
