import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Animated, TouchableOpacity, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore, ToastMessage } from '../store/toastStore';

const { width } = Dimensions.get('window');

export const Toast: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { toasts, hideToast } = useToastStore();
  const latestToast = toasts[toasts.length - 1];

  const translateY = useRef(new Animated.Value(-150)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (latestToast) {
      // Slide down
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: insets.top + 12,
          useNativeDriver: true,
          tension: 40,
          friction: 8,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Slide up
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -150,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [latestToast, insets.top]);

  if (!latestToast) return null;

  const getToastStyle = (type: ToastMessage['type']) => {
    switch (type) {
      case 'success':
        return {
          bg: '#10B981',
          accent: '#059669',
          emoji: '✅',
          title: 'Success',
        };
      case 'error':
        return {
          bg: '#EF4444',
          accent: '#DC2626',
          emoji: '❌',
          title: 'Error',
        };
      case 'warning':
        return {
          bg: '#F59E0B',
          accent: '#D97706',
          emoji: '⚠️',
          title: 'Warning',
        };
      case 'info':
      default:
        return {
          bg: '#3B82F6',
          accent: '#2563EB',
          emoji: 'ℹ️',
          title: 'Notification',
        };
    }
  };

  const config = getToastStyle(latestToast.type);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => hideToast(latestToast.id)}
        style={styles.card}
      >
        <View style={[styles.indicator, { backgroundColor: config.bg }]} />
        <View style={styles.content}>
          <Text style={styles.emoji}>{config.emoji}</Text>
          <View style={styles.textContainer}>
            <Text style={styles.title}>{config.title}</Text>
            <Text style={styles.message}>{latestToast.message}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    zIndex: 9999,
    alignItems: 'center',
  },
  card: {
    width: width - 40,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  indicator: {
    width: 6,
  },
  content: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    flex: 1,
  },
  emoji: {
    fontSize: 22,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  message: {
    fontSize: 13,
    color: '#94A3B8',
  },
});
export default Toast;
