import { auth } from './config';
import { 
  signInWithPhoneNumber, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser 
} from 'firebase/auth';
import { supabase } from '../supabase/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const isFirebaseConfigured = (): boolean => {
  const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
  return !!apiKey && apiKey !== 'YOUR_API_KEY';
};

export const normalizePhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  }
  return cleaned;
};

const MOCK_USER_STORAGE_KEY = '@mock_user_session';

export interface AuthUser {
  uid: string;
  phone: string;
  storeName: string | null;
}

export const sendOTP = async (
  phone: string,
  recaptchaVerifier?: any
): Promise<any> => {
  const normalizedPhone = normalizePhoneNumber(phone);

  if (isFirebaseConfigured()) {
    if (!recaptchaVerifier) {
      throw new Error('reCAPTCHA verifier is required for real Firebase Auth.');
    }
    return await signInWithPhoneNumber(auth, normalizedPhone, recaptchaVerifier);
  } else {
    console.log(`[AUTH-SIMULATION] Sending OTP to ${normalizedPhone}`);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    return {
      confirm: async (code: string) => {
        if (code === '123456') {
          const mockUser = {
            uid: `mock-uid-${normalizedPhone.replace('+', '')}`,
            phoneNumber: normalizedPhone,
          };
          await AsyncStorage.setItem(MOCK_USER_STORAGE_KEY, JSON.stringify(mockUser));
          return { user: mockUser };
        } else {
          throw new Error('Invalid OTP verification code. Use 123456 in simulation mode.');
        }
      },
    };
  }
};

export const syncSupabaseUser = async (phone: string): Promise<AuthUser> => {
  try {
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (existingUser) {
      return {
        uid: existingUser.id,
        phone: existingUser.phone,
        storeName: existingUser.store_name,
      };
    }

    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([{ phone }])
      .select('*')
      .single();

    if (insertError) {
      throw insertError;
    }

    return {
      uid: newUser.id,
      phone: newUser.phone,
      storeName: newUser.store_name,
    };
  } catch (error) {
    console.error('Error syncing user with Supabase:', error);
    return {
      uid: `local-${phone.replace('+', '')}`,
      phone,
      storeName: null,
    };
  }
};

export const subscribeAuthState = (
  callback: (user: AuthUser | null) => void
): (() => void) => {
  if (isFirebaseConfigured()) {
    return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser && firebaseUser.phoneNumber) {
        const syncedUser = await syncSupabaseUser(firebaseUser.phoneNumber);
        callback(syncedUser);
      } else {
        callback(null);
      }
    });
  } else {
    let active = true;
    const checkMockSession = async () => {
      try {
        const stored = await AsyncStorage.getItem(MOCK_USER_STORAGE_KEY);
        if (stored && active) {
          const parsed = JSON.parse(stored);
          const syncedUser = await syncSupabaseUser(parsed.phoneNumber);
          callback(syncedUser);
        } else {
          callback(null);
        }
      } catch (err) {
        callback(null);
      }
    };

    checkMockSession();

    return () => {
      active = false;
    };
  }
};

export const logoutUser = async (): Promise<void> => {
  if (isFirebaseConfigured()) {
    await signOut(auth);
  } else {
    await AsyncStorage.removeItem(MOCK_USER_STORAGE_KEY);
  }
};
