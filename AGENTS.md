You are a senior React Native + Expo engineer working on **ShopIQ** — a production-quality AI-powered billing and business intelligence app built for Indian kirana (grocery) store owners.

This is a real, serious project. The code you write must be production-grade: clean, typed, maintainable, performant, and strictly consistent with the existing architecture. There are no shortcuts. Every feature must work end-to-end.

---

## Project Overview

**ShopIQ** is an Android-first React Native app that helps small Indian kirana store owners:

- Create and manage bills with barcode scanning and AI-powered product lookup
- Track stock inventory with expiry alerts and low-stock thresholds
- Manage udhar (customer credit/debt) ledgers
- View business analytics: revenue trends, top-selling products, live intelligence
- Operate fully offline with automatic background sync to cloud when reconnected
- Eventually: AI demand prediction, WhatsApp automation, customer loyalty, supplier management, neighbourhood network, and built-in credit scoring

The app is in active hackathon development. The current phase is **Phase 1 (Foundation)**. Billing and basic analytics are done. Stock tracking and Udhar manager are next. Do not build Phase 2+ features unless explicitly asked.

---

## Tech Stack

| Layer | Library / Service |
|---|---|
| Framework | Expo ~56.0.3 (SDK 56), React Native 0.85.3 |
| Language | TypeScript ~6.0.3 (strict) |
| Navigation | Expo Router ~56.2.5 |
| Styling | NativeWind ^4.2.4 + Tailwind CSS ^3.4.17 |
| State | Zustand ^5.0.13 |
| Server state / cache | TanStack React Query ^5.100.13 |
| Offline storage | AsyncStorage 2.2.0 |
| Cloud DB | Supabase (@supabase/supabase-js ^2.106.1) |
| Auth | Firebase Phone OTP (firebase ^12.13.0) |
| AI — barcode lookup | Gemini 1.5 Flash (via Gemini REST API) |
| List rendering | @shopify/flash-list ^2.3.1 |
| Charts | react-native-gifted-charts ^1.4.77 |
| Forms | react-hook-form ^7.76.0 + zod ^4.4.3 |
| Camera | expo-camera ~56.0.7 |
| Barcode | expo-barcode-scanner ^13.0.1 |
| Animations | react-native-reanimated ^4.3.1 |
| Gradients | expo-linear-gradient ^56.0.4 |
| Receipts | Custom ESC/POS thermal receipt utility (utils/thermalReceipt.ts) |

**Do not introduce new major libraries without asking the user first.** If a library would significantly simplify or improve the implementation, recommend it, explain why, and wait for approval before installing.

---

## Project Structure

```
shopiq/
├── app/
│   ├── _layout.tsx              # Root layout — auth guard, QueryClient, auto-sync loop, Toast
│   ├── (auth)/
│   │   ├── login.tsx            # Phone number entry
│   │   ├── otp.tsx              # OTP verification
│   │   └── onboarding.tsx       # First-time store name setup
│   ├── (tabs)/
│   │   ├── _layout.tsx          # Tab navigator (Dashboard, History, Analytics, Profile)
│   │   ├── index.tsx            # Dashboard — today's stats + live intelligence panel
│   │   ├── history.tsx          # Bill history with filters
│   │   ├── analytics.tsx        # Revenue charts + top products (react-native-gifted-charts)
│   │   └── profile.tsx          # Store info + logout
│   ├── bill/
│   │   ├── new.tsx              # Create bill — manual add + product cache search
│   │   ├── scanner.tsx          # Barcode scanner → product resolver
│   │   ├── [id].tsx             # View specific past bill
│   │   └── success.tsx          # Post-bill confirmation + receipt preview
│   ├── stock/                   # [TO BUILD — Phase 1]
│   │   ├── index.tsx            # Stock dashboard — product list, low stock alerts
│   │   ├── add.tsx              # Add new product to inventory
│   │   └── [id].tsx             # Edit product / view stock history
│   └── udhar/                   # [TO BUILD — Phase 1]
│       ├── index.tsx            # Udhar dashboard — total outstanding, customer list
│       ├── [customerId].tsx     # Customer ledger — balance, history, repayment
│       └── add.tsx              # Add new customer / new udhar entry
│
├── components/
│   ├── ErrorBoundary.tsx        # Global error boundary
│   └── Toast.tsx                # Animated top toast (success/error/warning/info)
│
├── services/
│   ├── ai/
│   │   └── gemini.ts            # Gemini 1.5 Flash — barcode → product name, price, category
│   ├── api/
│   │   └── barcode.ts           # Barcode API stub
│   ├── firebase/
│   │   ├── config.ts            # Firebase app init
│   │   └── auth.ts              # OTP send/verify, mock mode when unconfigured, Supabase user sync
│   └── supabase/
│       ├── config.ts            # Supabase client init
│       ├── billing.ts           # createBill, getBillsHistory, offline queue, sync, bill number generation
│       ├── products.ts          # Barcode resolution: AsyncStorage cache → Supabase → Gemini AI
│       └── analytics.ts         # fetchOverviewStats, fetchMonthlyRevenueTrend, fetchWeeklyRevenueTrend, fetchTopSellingProducts, fetchLiveIntelligence
│
├── hooks/
│   └── useAnalytics.ts          # React Query hooks: useAnalyticsStats, useMonthlyRevenue, useWeeklyRevenue, useTopProducts
│
├── store/
│   ├── authStore.ts             # phone, storeName, isAuthenticated, isLoading, setSession, logout
│   ├── billStore.ts             # Active cart: items, total, addItem, updateQuantity, removeItem, clearBill
│   └── toastStore.ts            # Toast queue: showToast(message, type), hideToast
│
├── utils/
│   └── thermalReceipt.ts        # ESC/POS thermal receipt compiler (58mm / 80mm)
│
├── database/
│   └── schema.sql               # Supabase schema: users, bills, bill_items, products
│
├── assets/                      # App icons, splash, android adaptive icons
├── .env                         # EXPO_PUBLIC_ prefixed keys only — never hardcode secrets
├── .claude/settings.json        # Claude Expo plugin enabled
├── global.css                   # @tailwind base/components/utilities
├── tailwind.config.js           # NativeWind preset, scans app/ and components/
├── babel.config.js              # babel-preset-expo with jsxImportSource nativewind
├── metro.config.js              # withNativeWind, unstable_enablePackageExports: false (Firebase fix)
└── package.json
```

**Follow this structure exactly.** New screens go in the correct `app/` subfolder. New reusable UI goes in `components/`. New service integrations go in `services/`. New Zustand stores go in `store/`. New React Query hooks go in `hooks/`.

---

## Before Writing Any Code

1. **Read this file first. Every time.**
2. Identify which existing files need to change and which new files need to be created.
3. Check the Supabase schema (`database/schema.sql`) before adding any DB queries. If your feature requires new tables or columns, add them to the schema file and note what SQL to run in Supabase.
4. Check existing service files before writing new data-fetching logic. Do not duplicate what already exists in `billing.ts`, `analytics.ts`, or `products.ts`.
5. Check existing stores before creating new state. Add to an existing store if it logically belongs there.

---

## Architecture Rules

### Screens (`app/`)

Screens are **thin**. They:
- Call hooks and stores to get data
- Compose components
- Handle navigation with `useRouter()`
- Contain local UI state (loading spinners, modal open/close, form inputs) with `useState`

Screens do **not**:
- Contain large reusable UI blocks that appear in multiple places
- Call Supabase or external APIs directly — that belongs in `services/`
- Contain complex business logic — that belongs in `services/` or `hooks/`

### Services (`services/`)

All external communication lives here:
- Supabase queries in `services/supabase/`
- Firebase auth in `services/firebase/`
- Gemini AI calls in `services/ai/`

Service functions must be async and return typed values. They must handle errors gracefully — never let an unhandled promise rejection crash the app.

### Hooks (`hooks/`)

Use React Query hooks for all server state that needs caching, background refresh, or loading/error states. Pattern:

```ts
export const useInventory = (phone: string) => {
  return useQuery({
    queryKey: ['inventory', phone],
    queryFn: () => fetchInventory(phone),
    enabled: !!phone,
    staleTime: 5 * 60 * 1000,
  });
};
```

Use plain custom hooks (no React Query) for local logic that needs to be shared across screens.

### Stores (`store/`)

Use Zustand for global client state. Use `useState` for temporary local UI state. Never put server data (fetched from Supabase) into a Zustand store — use React Query for that.

Persist to AsyncStorage only when the data needs to survive app restarts (e.g., offline bill queue, product cache, auth session).

### Components (`components/`)

Create a component when:
- It is used in more than one screen
- It represents a clear UI concept (`BillCard`, `StockItemRow`, `UdharCustomerCard`, `StatCard`, `SectionHeader`)
- Extracting it makes a screen significantly easier to read

Do not over-componentize. A UI block used in exactly one place can stay in the screen until there is a clear reason to extract it.

---

## Database Rules

The Supabase schema currently has four tables: `users`, `bills`, `bill_items`, `products`.

**When adding new features that require persistence:**
1. Write the new table definitions in `database/schema.sql`
2. Include the exact SQL to run in Supabase (with RLS policies if needed)
3. Create the corresponding service functions in `services/supabase/`
4. Tell the user exactly what SQL to run in their Supabase dashboard

**Naming conventions:**
- Tables: lowercase snake_case plural (`inventory_items`, `customers`, `udhar_transactions`)
- Foreign keys: `{table_singular}_id` (e.g., `user_id`, `customer_id`)
- Timestamps: `created_at`, `updated_at` (use `default now()`)
- UUIDs: `id uuid primary key default gen_random_uuid()`

**Offline-first principle:** Every write operation must work offline. Save to AsyncStorage queue first, then sync to Supabase when online. The existing sync pattern in `billing.ts` is the reference implementation — follow it.

---

## Offline-First Rules

ShopIQ must work without internet. This is non-negotiable — kirana store owners may have unreliable connectivity.

- **Writes:** Queue in AsyncStorage if offline. Sync when online. Follow the `@pending_bills` pattern in `billing.ts`.
- **Reads:** Cache results in AsyncStorage after the first successful fetch. Show cached data when offline.
- **Connectivity check:** Use `checkInternetConnection()` from `services/supabase/billing.ts` before any network call.
- **User feedback:** Always show a visual indicator when operating in offline mode. Use the `showToast` from `toastStore` to notify the user of sync success/failure.
- **Never block the UI** waiting for a network call. Show optimistic UI or cached state immediately.

---

## Styling Rules

### NativeWind First

Use NativeWind Tailwind classes for all styling. Do **not** use `StyleSheet.create()` unless the component or scenario is in the exceptions table below.

**Check the installed NativeWind version before writing any styling code:**
- Current version: `nativewind ^4.2.4`
- Docs: https://www.nativewind.dev/v5/llms-full.txt
- Do not use syntax from NativeWind v2 or v3.

### Design System

The app uses a dark theme. These are the established color tokens — use them consistently:

| Token | Hex | Usage |
|---|---|---|
| Background | `#0A0E1A` | Screen backgrounds |
| Card | `#13192B` | Cards, list items, input containers |
| Border | `#1F2937` (gray-800) | Card borders, dividers |
| Primary | `#6366F1` (indigo-500) | CTAs, active states, highlights |
| Primary Dark | `#4F46E5` (indigo-600) | Pressed states, chart bars |
| Success | `#10B981` (emerald-500) | Positive values, sync success |
| Danger | `#EF4444` (red-500) | Errors, negative values, delete |
| Warning | `#F59E0B` (amber-500) | Warnings, pending states |
| Text Primary | `#FFFFFF` | Headings, primary labels |
| Text Secondary | `#9CA3AF` (gray-400) | Subtext, timestamps, hints |
| Text Muted | `#6B7280` (gray-500) | Empty states, placeholders |

**Do not introduce new colors without a strong reason.** When in doubt, use the closest token from the table above.

### StyleSheet Exceptions

Use `StyleSheet` or inline styles (not NativeWind classes) for these specific cases:

| Component / Scenario | Reason | Correct approach |
|---|---|---|
| `SafeAreaView` | `className` not reliably supported | `style={{ flex: 1, backgroundColor: '#0A0E1A' }}` |
| `Animated.View` | Animated values require style prop | `StyleSheet.create()` with animated values |
| `ScrollView` `contentContainerStyle` | RN-specific prop | Inline object `contentContainerStyle={{ paddingBottom: 40 }}` |
| Dynamic styles (runtime values) | Cannot express in static classes | Inline or `StyleSheet` |
| Platform-specific styles | iOS/Android divergence | Conditional inline with `Platform.OS` |
| Shadow (cross-platform) | Different APIs per platform | `StyleSheet` with platform checks |
| Complex transforms | Transform arrays | `StyleSheet` |
| `Toast.tsx` animation | Spring/timing animations | Existing `StyleSheet` — do not change |

### Existing Patterns to Follow

```tsx
// Screen wrapper — always this pattern
<SafeAreaView style={{ flex: 1, backgroundColor: '#0A0E1A' }}>
  <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>

// Card
<View className="bg-[#13192B] border border-gray-800 rounded-3xl p-5 mb-6">

// Section heading
<Text className="text-white text-3xl font-extrabold tracking-tight">Title</Text>
<Text className="text-gray-400 text-sm mt-1">Subtitle</Text>

// Primary CTA button
<TouchableOpacity className="bg-indigo-600 rounded-2xl py-4 px-6 items-center">
  <Text className="text-white font-bold text-base">Label</Text>
</TouchableOpacity>

// Stat badge (positive)
<View className="px-3 py-1.5 rounded-xl bg-emerald-950">
  <Text className="text-xs font-bold text-emerald-300">▲ +12%</Text>
</View>

// Stat badge (negative)
<View className="px-3 py-1.5 rounded-xl bg-red-950">
  <Text className="text-xs font-bold text-red-300">▼ -5%</Text>
</View>

// Empty state
<View className="flex-1 justify-center items-center py-12">
  <Text className="text-3xl mb-3">📦</Text>
  <Text className="text-gray-500 text-sm font-semibold text-center">Descriptive message</Text>
</View>

// Loading skeleton (animate-pulse)
<View className="bg-[#13192B] border border-gray-800 rounded-3xl p-5 mb-6 animate-pulse">
  <View className="w-1/2 h-4 bg-gray-800 rounded" />
</View>
```

---

## TypeScript Rules

- **Strict TypeScript everywhere.** No `any` unless casting a known third-party incompatibility (like `FlashList as any` for the cast workaround — document why with a comment).
- Define interfaces for all data shapes. Put them in the same file as the service/component unless they are shared across multiple files, in which case create a `types/` directory.
- Use `type` for union types and simple aliases. Use `interface` for object shapes.
- Never use `// @ts-ignore` without a comment explaining why.
- Return types must be explicit on all service functions.

---

## Authentication Rules

Auth uses **Firebase Phone OTP** for identity + **Supabase** for data storage. The two are linked by the user's phone number.

- The `subscribeAuthState` listener in `services/firebase/auth.ts` is the single source of truth for auth state. It calls `syncSupabaseUser` to upsert the user into Supabase on every Firebase session.
- The `useAuthStore` (Zustand) holds the in-memory session: `phone`, `storeName`, `isAuthenticated`, `isLoading`.
- The root `_layout.tsx` reads from `useAuthStore` and handles all navigation guards. Do not add auth redirect logic inside individual screens.
- **Simulation mode:** When `EXPO_PUBLIC_FIREBASE_API_KEY` is not configured (dev/demo), auth works with any phone number and OTP `123456`. This is intentional — never remove it.
- Never expose Firebase or Supabase keys in committed code. They live in `.env` only.

---

## Supabase Rules

- Always use the `supabase` client from `services/supabase/config.ts`. Never create a second client.
- Prefer `.maybeSingle()` over `.single()` for queries that may return no rows — `.single()` throws on empty.
- Always destructure `{ data, error }` and check `error` before using `data`.
- Use `phone` as the user identifier for all data queries (not Firebase UID). The Supabase `users.phone` column is the join key.
- When querying user-specific data, always scope by `phone` or `user_id`. Never fetch all rows.

---

## Gemini AI Rules

- Gemini is used **only** for barcode-to-product lookup (`services/ai/gemini.ts`). Do not use it for anything else without discussion.
- When `EXPO_PUBLIC_GEMINI_API_KEY` is not configured, the service falls back to a mock barcode database and random popular Indian grocery items. This simulation mode must always work.
- Gemini responses must always be validated before use. If parsing fails, fall back gracefully — never crash.
- The product lookup chain is: **AsyncStorage local cache → Supabase global products table → Gemini API**. Maintain this order. It minimises API calls and costs.
- After a successful Gemini lookup, always write back to both AsyncStorage cache and Supabase products table.

---

## Error Handling Rules

- Every async function in `services/` must have a `try/catch`.
- On Supabase errors: log with `console.error`, return a safe fallback or re-throw with a user-readable message.
- On network errors: never crash the app. Fall back to cached/offline data and notify the user with a toast.
- Use `showToast` from `useToastStore` for all user-visible error and success notifications. Do not use `Alert.alert` for routine feedback (only for destructive confirmation dialogs like "Delete this entry?").
- The `ErrorBoundary` component wraps the entire app. It catches uncaught render errors. Do not use it as an excuse to skip proper error handling in services.

---

## Performance Rules

- **FlashList over FlatList** for all list rendering. Use `estimatedItemSize` accurately (measure the actual item height).
- **Memoize derived data** that is used in charts or expensive renders with `useMemo`. See `analytics.tsx` for the reference pattern.
- **React Query caching:** Set `staleTime: 5 * 60 * 1000` (5 minutes) on analytics queries. Dashboard data (`loadData`) refetches every 30 seconds via `setInterval` — keep this pattern on new dashboard sections.
- **Never fetch inside a render.** All data fetching happens in `useEffect`, React Query `queryFn`, or event handlers.
- **Avoid re-renders:** Use `useCallback` for functions passed as props to list items.

---

## Build Phases — What Exists vs What to Build

| Feature | Status | Location |
|---|---|---|
| Phone OTP auth + onboarding | ✅ Done | `app/(auth)/` |
| Bill creation (manual + barcode) | ✅ Done | `app/bill/` |
| Bill history | ✅ Done | `app/(tabs)/history.tsx` |
| Offline bill queue + sync | ✅ Done | `services/supabase/billing.ts` |
| Barcode → Gemini product lookup | ✅ Done | `services/ai/gemini.ts`, `services/supabase/products.ts` |
| Analytics (charts, stats, top products) | ✅ Done | `app/(tabs)/analytics.tsx` |
| Live intelligence panel | ✅ Done | `services/supabase/analytics.ts` → `fetchLiveIntelligence` |
| Thermal receipt compiler | ✅ Done | `utils/thermalReceipt.ts` |
| **Stock tracking** | ❌ Not built | `app/stock/` — Phase 1 priority |
| **Udhar manager** | ❌ Not built | `app/udhar/` — Phase 1 priority |
| AI demand prediction | ❌ Phase 2 | — |
| Supplier module | ❌ Phase 2 | — |
| Voice input (Hindi/Kannada) | ❌ Phase 3 | — |
| WhatsApp automation | ❌ Phase 3 | — |
| Customer loyalty | ❌ Phase 3 | — |
| Mini online store | ❌ Phase 4 | — |
| Neighbourhood network | ❌ Phase 4 | — |
| Built-in credit score | ❌ Phase 4 | — |

**Do not build Phase 2, 3, or 4 features unless explicitly instructed.**

---

## Stock Tracking — Implementation Spec (Phase 1)

When building stock tracking, follow this exact data model:

```sql
create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  name text not null,
  barcode text,
  quantity numeric not null default 0,
  unit text not null default 'units',
  cost_price numeric not null default 0,
  sell_price numeric not null default 0,
  low_stock_threshold integer not null default 5,
  expiry_date date,
  category text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);
```

Key behaviours to implement:
- Auto-decrement `quantity` when a bill is confirmed (wire into `createBill` in `billing.ts`)
- Alert fires when `quantity <= low_stock_threshold` (show on dashboard + stock screen)
- 7-day advance expiry warning (compute on read, not stored)
- Batch stock entry after supplier delivery (bulk quantity increment)

---

## Udhar Manager — Implementation Spec (Phase 1)

```sql
create table customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  name text not null,
  phone text,
  created_at timestamp default now()
);

create table udhar_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete cascade,
  amount numeric not null,
  type text not null check (type in ('credit', 'repayment')),
  note text,
  created_at timestamp default now()
);
```

Key behaviours:
- Total outstanding = sum of credits minus sum of repayments per customer
- "Days since last activity" = days since last `udhar_transactions` row
- WhatsApp reminder button formats and opens `wa.me/{phone}?text=...` with a polite pre-filled message
- Partial repayment supported — record each repayment as a separate `type: 'repayment'` row

---

## Notification and Feedback Rules

- **Toast** (`showToast`) for: sync results, save confirmations, offline mode warning, non-critical errors.
- **Alert.alert** for: destructive actions only (delete customer, clear all pending bills, reset stock).
- **Inline UI feedback** for: form validation errors (show below field), empty states (show in list area).
- Never show a raw JavaScript error message to the user. Always translate to a user-readable string.

---

## Indian Market Context

This app is built for India. Keep this in mind at all times:

- **Currency:** Always display as `₹` with `toLocaleString('en-IN')` formatting (e.g., `₹1,23,456`)
- **Phone numbers:** Default to `+91` country code. Use `normalizePhoneNumber()` from `services/firebase/auth.ts`
- **Units:** Support Indian units — kg, g, litre, ml, dozen, piece, box, packet, bundle
- **GST:** Bills should be GST-aware. Tag items with their GST rate for future export. The schema already has this in mind.
- **Udhar:** "Udhar" means credit/debt given to a trusted customer. It is a deeply ingrained kirana business practice. Treat the Udhar Manager as a first-class feature.
- **Language:** UI text is in English, but product names, store names, and customer names will often be in Hindi/Kannada. Ensure text rendering supports this.
- **Connectivity:** Assume the user may be on 2G or offline for extended periods. Offline-first is not optional.

---

## Communication Style

When responding to feature requests:

1. State which files you will create or modify.
2. If a new Supabase table is needed, write the SQL and tell the user to run it.
3. Build the feature end-to-end — don't leave TODOs in production code paths.
4. After implementing, tell the user what to test and how to verify it works.
5. If something is unclear, ask one focused question before proceeding.
6. If you see a bug or architectural issue in existing code while working on a related feature, flag it. Don't silently fix unrelated things — ask first.

Be direct. No filler. The user is technical.

---

## Final Rules — Non-Negotiable

- **Never hardcode secrets.** All keys go in `.env` as `EXPO_PUBLIC_` prefixed variables.
- **Never break offline mode.** Every write path must queue if offline.
- **Never skip TypeScript types.** No `any` without explanation.
- **Never use `FlatList`.** Use `FlashList` from `@shopify/flash-list`.
- **Never call Supabase from a screen directly.** Always through a service function.
- **Never skip error handling** in async service functions.
- **Always follow the dark theme color tokens.** No random colors.
- **Always check this file before writing code.**
