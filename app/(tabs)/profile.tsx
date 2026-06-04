import React from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { getStoreShareLink } from '../../services/supabase/onlineStore';

export default function ProfileScreen() {
  const router = useRouter();
  const { phone, storeName, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/login');
  };

  const handleItemPress = (label: string) => {
    if (label === 'My Online Store & Share Link' && phone && storeName) {
      const link = getStoreShareLink(phone, storeName);
      Share.share({ message: `Order from my store: ${link}` });
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0A0E1A]">
      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View className="mb-8 mt-4">
          <Text className="text-white text-3xl font-extrabold tracking-tight">Store Profile</Text>
          <Text className="text-gray-400 text-sm mt-1">Manage your shop information and settings</Text>
        </View>

        {/* Profile Details Card */}
        <View className="bg-[#13192B] border border-gray-800 rounded-3xl p-6 mb-6 shadow-sm items-center">
          <View className="w-20 h-20 bg-indigo-600 rounded-full items-center justify-center shadow-lg shadow-indigo-500/20 mb-4">
            <Text className="text-white text-3xl">🏪</Text>
          </View>
          <Text className="text-white text-2xl font-extrabold tracking-tight">{storeName || 'My Kirana Store'}</Text>
          <Text className="text-gray-400 text-base mt-1">+91 {phone || '9876543210'}</Text>
        </View>

        {/* Settings Group */}
        <View className="bg-[#13192B] border border-gray-800 rounded-3xl p-4 mb-6 shadow-sm">
          {[
            { label: 'My Online Store & Share Link', icon: '🌐' },
            { label: 'Edit Store Name', icon: '📝' },
            { label: 'Bill Template Settings', icon: '📄' },
            { label: 'GSTIN & Tax Configuration', icon: '💼' },
            { label: 'Notification Settings', icon: '🔔' },
          ].map((item, idx) => (
            <TouchableOpacity 
              key={idx} 
              onPress={() => handleItemPress(item.label)}
              className="flex-row justify-between items-center py-4 border-b border-gray-800/50 last:border-b-0"
            >
              <View className="flex-row items-center">
                <Text className="text-xl mr-3">{item.icon}</Text>
                <Text className="text-white font-semibold text-base">{item.label}</Text>
              </View>
              <Text className="text-gray-500 text-lg">›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Danger Zone */}
        <TouchableOpacity
          onPress={handleLogout}
          className="w-full bg-red-950/40 border border-red-900/60 py-4 rounded-2xl items-center justify-center shadow-sm"
        >
          <Text className="text-red-400 text-lg font-bold">Logout Store Session</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
