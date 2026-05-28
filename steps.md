# Setup Environment Variables for ShopIQ

You need credentials for **3 services**. Here's exactly how to get each one:

---

## 🔥 1. Firebase (Phone OTP Auth) — 6 keys

**Go to:** [console.firebase.google.com](https://console.firebase.google.com)

1. Click **"Add project"** → give it a name (e.g. `shopiq`) → Create
2. Once created, click the **`</>`** (Web) icon to add a Web app
3. Register the app → Firebase will show you a `firebaseConfig` object:
   ```javascript
   apiKey: "..."           → EXPO_PUBLIC_FIREBASE_API_KEY
   authDomain: "..."       → EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
   projectId: "..."        → EXPO_PUBLIC_FIREBASE_PROJECT_ID
   storageBucket: "..."    → EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
   messagingSenderId: "..."→ EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
   appId: "..."            → EXPO_PUBLIC_FIREBASE_APP_ID
   ```
4. **Enable Phone Auth:**
   - Left sidebar → **Authentication** → **Sign-in method**
   - Enable **Phone** → Save

> **Tip:** For testing, add your own phone number as a **test number** under Authentication → Sign-in method → Phone → Scroll down to "Phone numbers for testing". Use code `123456`.

---

## 🟢 2. Supabase (Database) — 2 keys

**Go to:** [supabase.com](https://supabase.com)

1. Click **"New project"** → choose org → set name + DB password → Create
2. Wait ~2 min for it to provision
3. Go to **Project Settings** (gear icon) → **API**
4. Copy:
   ```
   Project URL          → EXPO_PUBLIC_SUPABASE_URL
   anon / public key    → EXPO_PUBLIC_SUPABASE_ANON_KEY
   ```
5. **Run your schema:** Go to **SQL Editor** → New query → paste contents of `database/schema.sql` → Run

> **Important:** Use the **`anon` key**, not the `service_role` key. The service_role key bypasses all RLS and must never be in client code.

---

## 🤖 3. Gemini API — 1 key

**Go to:** [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

1. Sign in with your Google account
2. Click **"Create API key"**
3. Select your Google Cloud project (or create a new one)
4. Copy the key → `EXPO_PUBLIC_GEMINI_API_KEY`

> **Tip:** Gemini has a **free tier** (15 req/min, 1M tokens/day with Gemini 1.5 Flash) — plenty for dev and hackathon use.

---

## ✅ Final `.env` should look like:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSy...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=shopiq-xxxx.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=shopiq-xxxx
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=shopiq-xxxx.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...

EXPO_PUBLIC_GEMINI_API_KEY=AIzaSy...
```

> **Note:** Until you fill these in, the app runs in **simulation mode** — any phone number works with OTP `123456` and Gemini falls back to a mock product database. So you can keep developing without credentials right now.
