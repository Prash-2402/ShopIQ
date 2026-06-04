import React, { useState } from 'react';
import { TouchableOpacity, Text, View, ActivityIndicator, ViewStyle } from 'react-native';
import { parseVoiceIntent, VoiceIntent } from '../services/ai/voiceIntent';
import { useToastStore } from '../store/toastStore';

interface VoiceInputButtonProps {
  onIntentParsed: (intent: VoiceIntent) => void;
  style?: ViewStyle;
}

export default function VoiceInputButton({ onIntentParsed, style }: VoiceInputButtonProps) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const { showToast } = useToastStore();

  const handlePress = async () => {
    if (!recording) {
      setRecording(true);
      setStatusMessage('Listening (Mock Mode)...');
    } else {
      setRecording(false);
      setProcessing(true);
      setStatusMessage('Processing...');
      
      // Simulate audio processing delay without native modules
      setTimeout(() => {
        setProcessing(false);
        setStatusMessage(null);
        // Return a mock intent since we don't have real audio
        const intent = parseVoiceIntent("ek box maggi aaya"); // Mock intent for testing
        onIntentParsed(intent);
        showToast('Mock recording parsed successfully', 'success');
      }, 1500);
    }
  };

  return (
    <View style={style} className="items-center justify-center flex-col">
      <TouchableOpacity
        onPress={handlePress}
        disabled={processing}
        className={`w-16 h-16 rounded-full items-center justify-center shadow-lg ${
          recording 
            ? 'bg-red-600 animate-pulse shadow-red-500/30' 
            : 'bg-indigo-600 shadow-indigo-500/30'
        }`}
      >
        {processing ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text className="text-2xl">{recording ? '⏺' : '🎤'}</Text>
        )}
      </TouchableOpacity>
      {statusMessage && (
        <Text className="text-gray-400 text-xs text-center mt-2 absolute -bottom-6 w-24">{statusMessage}</Text>
      )}
    </View>
  );
}
