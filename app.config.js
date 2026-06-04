// app.config.js — reads Firebase config from .env at build time.
// The .env file is git-ignored. Copy .env.example → .env and fill in your keys.
export default {
  expo: {
    name: 'kirana-ai-billing',
    slug: 'kirana-ai-billing',
    version: '1.0.0',
    scheme: 'kirana-ai-billing',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.anonymous.kiranaaibilling',
    },
    android: {
      package: 'com.anonymous.kiranaaibilling',
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: ['expo-router', 'expo-status-bar', 'expo-barcode-scanner'],
    extra: {
      // FirebaseRecaptchaVerifierModal reads its config from here via
      // Constants.expoConfig.extra.firebase — sourced from .env, never hardcoded.
      firebase: {
        apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
      },
    },
  },
};
