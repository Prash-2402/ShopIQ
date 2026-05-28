# ShopIQ — Feature Build Prompts
# One prompt per feature step. Use each prompt as your exact instruction to the AI.
# Read AGENTS.md before using any prompt.

---

## HOW TO USE

Paste each prompt verbatim into the chat. Each prompt is self-contained and references
the exact files, interfaces, and patterns already in the codebase. Do not skip prompts.
Do not combine prompts. Each one builds on the previous.

---

---
# PHASE 1 — FOUNDATION
---

---
## PROMPT 1 — Stock: Supabase Schema + Service Layer

```
Read AGENTS.md.

Add the stock/inventory feature to ShopIQ. This is purely the data layer — no screens yet.

**Step 1 — Update database/schema.sql**

Append this table definition:

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

Tell the user to run this SQL in their Supabase dashboard.

**Step 2 — Create services/supabase/inventory.ts**

Export these typed functions:

```
InventoryItem interface — maps all columns above, with camelCase field names.
  id, userId, name, barcode, quantity, unit, costPrice, sellPrice,
  lowStockThreshold, expiryDate (string | null), category, createdAt, updatedAt

getInventory(phone: string): Promise<InventoryItem[]>
  - Look up user id from users table by phone using .maybeSingle()
  - Fetch all inventory_items for that user_id ordered by name asc
  - On offline/error: return [] and log error

addInventoryItem(phone: string, item: Omit<InventoryItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<InventoryItem>
  - Look up user id by phone
  - Insert into inventory_items, return the inserted row
  - On error: throw with readable message

updateInventoryItem(id: string, updates: Partial<Omit<InventoryItem, 'id' | 'userId' | 'createdAt'>>): Promise<InventoryItem>
  - Update the row, set updated_at to now()
  - Return the updated row
  - On error: throw with readable message

deleteInventoryItem(id: string): Promise<void>
  - Delete the row by id
  - On error: throw with readable message

decrementStock(itemId: string, quantity: number): Promise<void>
  - Fetch current quantity
  - If new quantity would go below 0, set it to 0
  - Update the row
  - On error: log and do not crash

getLowStockItems(phone: string): Promise<InventoryItem[]>
  - Call getInventory(phone)
  - Return items where quantity <= low_stock_threshold

getExpiringItems(phone: string, daysAhead: number = 7): Promise<InventoryItem[]>
  - Call getInventory(phone)
  - Return items where expiryDate is not null AND
    the expiry date is within daysAhead days from today (inclusive)
```

All functions must use the supabase client from services/supabase/config.ts.
Use .maybeSingle() not .single() for lookups that may return no rows.
Every function must have try/catch.
No AsyncStorage in this file — inventory is always fetched live.

**Step 3 — Wire stock decrement into bill creation**

In services/supabase/billing.ts, inside the createBill function, after a bill is
successfully saved to Supabase (after the bill_items insert succeeds), call
decrementStock for each item that has a barcode set.

Import decrementStock from services/supabase/inventory.ts.
The decrement should be fire-and-forget (no await, wrapped in try/catch) — 
it must never block or fail bill creation.

Do not touch any other logic in billing.ts.
```

---

## PROMPT 2 — Stock: React Query Hooks

```
Read AGENTS.md.

Create hooks/useInventory.ts.

Import from @tanstack/react-query and from services/supabase/inventory.ts.

Export these four hooks:

useInventory(phone: string)
  - queryKey: ['inventory', phone]
  - queryFn: () => getInventory(phone)
  - enabled: !!phone
  - staleTime: 2 * 60 * 1000

useLowStockItems(phone: string)
  - queryKey: ['lowStock', phone]
  - queryFn: () => getLowStockItems(phone)
  - enabled: !!phone
  - staleTime: 2 * 60 * 1000

useExpiringItems(phone: string)
  - queryKey: ['expiringItems', phone]
  - queryFn: () => getExpiringItems(phone, 7)
  - enabled: !!phone
  - staleTime: 2 * 60 * 1000

useAddInventoryItem()
  - useMutation wrapping addInventoryItem
  - onSuccess: invalidate queryKey ['inventory'] and ['lowStock'] and ['expiringItems']

useUpdateInventoryItem()
  - useMutation wrapping updateInventoryItem
  - onSuccess: invalidate same three queryKeys

useDeleteInventoryItem()
  - useMutation wrapping deleteInventoryItem
  - onSuccess: invalidate same three queryKeys

Use useQueryClient() for all invalidations.
No other logic in this file.
```

---

## PROMPT 3 — Stock: Dashboard Screen (index)

```
Read AGENTS.md.

Create app/stock/index.tsx — the stock dashboard screen.

This screen shows the owner's full inventory list with alerts.

**Layout (top to bottom):**

SafeAreaView bg-[#0A0E1A] → ScrollView px-6 pt-6 pb-10

Header row:
  Left: "Stock Inventory" (text-white text-3xl font-extrabold tracking-tight)
        "Manage products and track levels" (text-gray-400 text-sm mt-1)
  Right: Round refresh button (🔄 emoji, bg-[#13192B] border border-gray-800 rounded-full w-12 h-12)
         calls refetch on inventory query

Low Stock Alert Banner — show only if lowStockItems.length > 0:
  bg-red-950/40 border border-red-900/60 rounded-3xl p-5 mb-6
  "⚠️ {count} item(s) running low" in text-red-400 font-extrabold text-sm
  List first 3 item names as text-gray-400 text-xs separated by " • "

Expiry Alert Banner — show only if expiringItems.length > 0:
  bg-amber-950/40 border border-amber-900/60 rounded-3xl p-5 mb-6
  "🕐 {count} item(s) expiring within 7 days" in text-amber-400 font-extrabold text-sm

Add New Item button:
  Full width bg-indigo-600 rounded-2xl py-4 mb-6
  "＋ Add New Product" text-white font-extrabold text-base
  onPress: router.push('/stock/add')

Inventory list section heading: "All Products ({total count})" text-white text-lg font-bold mb-4

For each InventoryItem, render a card:
  bg-[#13192B] border border-gray-800 rounded-2xl p-4 mb-3

  Left side:
    Product name: text-white font-bold text-base numberOfLines=1
    Category (if present): text-gray-400 text-xs mt-0.5
    "₹{costPrice} cost  •  ₹{sellPrice} sell" text-gray-500 text-xs mt-1

  Right side (items-end):
    Quantity + unit: text-white font-extrabold text-xl
    If quantity <= lowStockThreshold: show red badge "LOW STOCK" bg-red-950 text-red-400 text-[9px] font-black px-2 py-0.5 rounded
    If expiryDate within 7 days: show amber badge "EXPIRING" bg-amber-950 text-amber-400 text-[9px] font-black px-2 py-0.5 rounded mt-1

  onPress: router.push('/stock/' + item.id)

Loading state: ActivityIndicator size="large" color="#6366F1" centered
Empty state:
  "📦" emoji text-4xl
  "No products added yet" text-gray-500 text-sm font-semibold
  "Add your first product to start tracking stock" text-gray-600 text-xs mt-1

Data:
  phone from useAuthStore
  inventory, isLoading, refetch from useInventory(phone)
  lowStockItems from useLowStockItems(phone)
  expiringItems from useExpiringItems(phone)

Import FlashList from @shopify/flash-list for the inventory list.
Cast FlashList as any (same pattern as history.tsx and analytics.tsx).
estimatedItemSize={88}

Add this tab to app/(tabs)/_layout.tsx:
  name="stock" title="Stock" icon emoji "📦"
  Insert it between History and Analytics tabs.
```

---

## PROMPT 4 — Stock: Add Product Screen

```
Read AGENTS.md.

Create app/stock/add.tsx — form to add a new product to inventory.

**Form fields (all inside a card bg-[#13192B] border border-gray-800 rounded-3xl p-6):**

1. Product Name (required) — TextInput, placeholder "e.g., Tata Salt 1kg"
2. Barcode (optional) — TextInput, placeholder "Scan or type barcode"
   Row: TextInput flex-1 + "📷 Scan" button (bg-[#1F2937] rounded-xl px-3 py-2 ml-2)
   Scan button opens router.push('/bill/scanner') — note to user that scanner
   integration for this field is a future step; for now just manual entry.
3. Category (optional) — TextInput, placeholder "e.g., Dairy, Snacks, Staples"
4. Quantity (required) — TextInput keyboardType numeric, placeholder "0"
5. Unit — TextInput, placeholder "units / kg / litre / dozen / packet", default "units"
6. Cost Price ₹ (required) — TextInput keyboardType numeric, placeholder "0"
7. Sell Price ₹ (required) — TextInput keyboardType numeric, placeholder "0"
8. Low Stock Alert — TextInput keyboardType numeric, placeholder "5"
   Helper text: "Alert fires when stock falls below this number" text-gray-500 text-xs mt-1
9. Expiry Date (optional) — TextInput, placeholder "YYYY-MM-DD"
   Helper text: "Leave blank if item has no expiry" text-gray-500 text-xs mt-1

**Validation before save (show inline error below the field):**
- Product name must not be empty
- Quantity must be a valid non-negative number
- Cost price must be a valid non-negative number
- Sell price must be a valid non-negative number
- If expiry date is filled, it must match YYYY-MM-DD format (simple regex check)

**Save logic:**
Use useAddInventoryItem() mutation from hooks/useInventory.ts.
On success: show success toast via useToastStore, router.back()
On error: show error toast with error.message

**Layout:**
SafeAreaView bg-[#0A0E1A] → ScrollView px-6 pt-6

Header row:
  "← Back" text-indigo-400 font-semibold text-lg → router.back()
  "Add Product" text-white text-xl font-bold (centered)
  empty View for spacing

Each field label: text-gray-400 text-xs font-semibold mb-1 uppercase tracking-wider
Each TextInput: bg-[#0F1424] border border-gray-800 text-white rounded-2xl px-4 py-3 text-base font-semibold mb-4
Inline error: text-red-400 text-xs mt-1 mb-2 (shown below the invalid field)

Save button at bottom:
  bg-emerald-600 rounded-2xl py-4 full width
  "Save Product" text-white font-bold text-base
  Disabled + ActivityIndicator when mutation is pending

All state in useState. No react-hook-form needed here — keep it simple.
```

---

## PROMPT 5 — Stock: Edit Product Screen

```
Read AGENTS.md.

Create app/stock/[id].tsx — view and edit an existing inventory item.

**Data loading:**
- Get id from useLocalSearchParams<{ id: string }>()
- Get inventory from useInventory(phone) — find the item by id from the returned array
- Show ActivityIndicator while loading

**Screen layout:**
SafeAreaView bg-[#0A0E1A] → ScrollView px-6 pt-6

Header row:
  "← Back" → router.back()
  Item name (text-white text-xl font-bold numberOfLines=1, centered)
  "Delete" text-red-400 font-semibold text-sm → triggers delete confirmation

**Top summary card** (read-only display, bg-indigo-600 rounded-3xl p-6 mb-6):
  Row: "Current Stock" label + "{quantity} {unit}" value (text-white text-4xl font-extrabold)
  Row: Cost ₹{costPrice} | Sell ₹{sellPrice}
  Low stock badge if quantity <= lowStockThreshold
  Expiry badge if expiring within 7 days

**Quick stock adjustment section** (bg-[#13192B] border border-gray-800 rounded-3xl p-5 mb-6):
  Title: "Adjust Stock" text-white font-bold text-base mb-3
  Row of 3 buttons:
    "-10" bg-red-950/40 border border-red-900/40 rounded-xl py-3 flex-1 mr-2
    "-1"  bg-red-950/40 border border-red-900/40 rounded-xl py-3 flex-1 mr-2
    "+1"  bg-emerald-950/40 border border-emerald-900/40 rounded-xl py-3 flex-1 mr-2
    "+10" bg-emerald-950/40 border border-emerald-900/40 rounded-xl py-3 flex-1
  Each button calls updateInventoryItem with the new quantity (clamped to minimum 0)
  Show current quantity in the middle of the row as text-white font-extrabold text-2xl

**Edit form** — same fields as add.tsx, pre-populated with current item values:
  Product Name, Barcode, Category, Unit, Cost Price, Sell Price,
  Low Stock Alert Threshold, Expiry Date

  "Save Changes" button — calls useUpdateInventoryItem() mutation
  On success: show success toast, stay on screen and refresh data

**Delete logic:**
  Alert.alert("Delete Product", "This will permanently remove {name} from your inventory. This cannot be undone.", [Cancel, Delete])
  On confirm: call useDeleteInventoryItem() mutation, on success router.back()

Use useUpdateInventoryItem() and useDeleteInventoryItem() from hooks/useInventory.ts.
Use useToastStore for success/error feedback.
```

---

## PROMPT 6 — Udhar: Supabase Schema + Service Layer

```
Read AGENTS.md.

Add the udhar (customer credit) feature. This is purely the data layer — no screens yet.

**Step 1 — Update database/schema.sql**

Append these two table definitions:

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

Tell the user to run this SQL in Supabase.

**Step 2 — Create services/supabase/udhar.ts**

Export these interfaces:

```
Customer:
  id, userId, name, phone (string | null), createdAt
  balance: number        — computed field (total credits minus total repayments)
  lastActivityAt: string — ISO string of most recent udhar_transactions.created_at
  daysSinceActivity: number — days since lastActivityAt (computed on read)

UdharTransaction:
  id, customerId, amount, type ('credit' | 'repayment'), note (string | null), createdAt
```

Export these functions:

getCustomers(phone: string): Promise<Customer[]>
  - Look up user id by phone
  - Fetch all customers for that user, join udhar_transactions
  - For each customer compute balance and daysSinceActivity
  - Return sorted by balance descending (highest debt first)

getCustomerById(customerId: string): Promise<Customer | null>
  - Fetch one customer row by id using .maybeSingle()
  - Compute balance and daysSinceActivity

addCustomer(phone: string, name: string, customerPhone: string | null): Promise<Customer>
  - Look up user id by phone
  - Insert into customers
  - Return the new customer with balance=0, daysSinceActivity=0

addUdharEntry(customerId: string, amount: number, type: 'credit' | 'repayment', note: string | null): Promise<UdharTransaction>
  - Validate: amount must be > 0
  - Insert into udhar_transactions
  - Return the inserted row

getTransactionHistory(customerId: string): Promise<UdharTransaction[]>
  - Fetch all udhar_transactions for customerId ordered by created_at desc
  - Return typed array

deleteCustomer(customerId: string): Promise<void>
  - Delete the customer row (cascade will remove transactions)

Every function must have try/catch. Use supabase client from services/supabase/config.ts.
Use .maybeSingle() for single-row lookups.
```

---

## PROMPT 7 — Udhar: React Query Hooks

```
Read AGENTS.md.

Create hooks/useUdhar.ts.

Import from @tanstack/react-query and from services/supabase/udhar.ts.

Export:

useCustomers(phone: string)
  queryKey: ['customers', phone]
  queryFn: () => getCustomers(phone)
  enabled: !!phone
  staleTime: 2 * 60 * 1000

useCustomer(customerId: string)
  queryKey: ['customer', customerId]
  queryFn: () => getCustomerById(customerId)
  enabled: !!customerId
  staleTime: 2 * 60 * 1000

useTransactionHistory(customerId: string)
  queryKey: ['udharTransactions', customerId]
  queryFn: () => getTransactionHistory(customerId)
  enabled: !!customerId
  staleTime: 1 * 60 * 1000

useAddCustomer()
  useMutation wrapping addCustomer
  onSuccess: invalidate ['customers']

useAddUdharEntry()
  useMutation wrapping addUdharEntry
  onSuccess: invalidate ['customers'], ['customer', customerId], ['udharTransactions', customerId]
  The mutation variables type should be:
  { customerId: string; amount: number; type: 'credit' | 'repayment'; note: string | null }

useDeleteCustomer()
  useMutation wrapping deleteCustomer
  onSuccess: invalidate ['customers']

No other logic in this file.
```

---

## PROMPT 8 — Udhar: Dashboard Screen

```
Read AGENTS.md.

Create app/udhar/index.tsx — the udhar dashboard.

**Layout:**
SafeAreaView bg-[#0A0E1A] → View flex-1 px-6 pt-6

Header row:
  Left: "Udhar Ledger" text-white text-3xl font-extrabold tracking-tight
        "Customer credit and repayment tracking" text-gray-400 text-sm mt-1
  Right: "＋ Add" button bg-indigo-600 rounded-xl px-4 py-2
         text-white font-bold text-sm → router.push('/udhar/add')

Summary banner (bg-[#13192B] border border-gray-800 rounded-3xl p-5 mb-6):
  "Total Outstanding" label text-gray-400 text-xs font-semibold
  "₹{sum of all customer balances}" value text-white text-3xl font-extrabold mt-1
  "{count} customers" text-gray-400 text-sm mt-1

Search bar (same pattern as history.tsx):
  bg-[#13192B] border border-gray-800 rounded-2xl px-4 py-3 flex-row items-center mb-4
  🔍 + TextInput filtering by customer name

Customer list using FlashList (cast as any, estimatedItemSize={90}):
  Each customer card: bg-[#13192B] border border-gray-800 rounded-2xl p-4 mb-3
  onPress: router.push('/udhar/' + customer.id)

  Left:
    Name: text-white font-bold text-base
    Phone (if set): text-gray-400 text-xs mt-0.5
    "Last activity: {daysSinceActivity} day(s) ago" text-gray-500 text-xs mt-1
    If daysSinceActivity > 14: show amber badge "INACTIVE" bg-amber-950 text-amber-400 text-[9px] font-black px-2 py-0.5 rounded ml-2

  Right (items-end):
    "₹{balance}" text-red-400 font-extrabold text-xl (balance > 0)
    "₹{balance}" text-emerald-400 font-extrabold text-xl (balance = 0 — fully paid)
    "OWES" text-red-500 text-[9px] font-black (if balance > 0)
    "CLEAR" text-emerald-500 text-[9px] font-black (if balance = 0)

Loading: ActivityIndicator size="large" color="#6366F1" centered
Empty state: "🤝" emoji + "No customers yet" + "Add your first customer to start tracking udhar"

Data:
  phone from useAuthStore
  customers, isLoading, refetch from useCustomers(phone)

Add this tab to app/(tabs)/_layout.tsx:
  name="udhar" title="Udhar" icon emoji "🤝"
  Insert it between Analytics and Profile tabs.
```

---

## PROMPT 9 — Udhar: Add Customer Screen

```
Read AGENTS.md.

Create app/udhar/add.tsx — form to add a new customer.

This is a simple two-field form.

**Layout:**
SafeAreaView bg-[#0A0E1A] → ScrollView px-6 pt-6

Header row:
  "← Back" text-indigo-400 font-semibold text-lg → router.back()
  "Add Customer" text-white text-xl font-bold (centered)
  Empty View for spacing

Form card bg-[#13192B] border border-gray-800 rounded-3xl p-6 mt-4:
  Title: "Customer Details" text-white text-xl font-bold mb-1
  Subtitle: "Add a customer to start tracking udhar" text-gray-400 text-sm mb-6

  Field 1 — Customer Name (required):
    Label: "CUSTOMER NAME" text-gray-400 text-xs font-semibold mb-1 uppercase tracking-wider
    TextInput bg-[#0F1424] border border-gray-800 text-white rounded-2xl px-4 py-3 text-base font-semibold
    placeholder "e.g., Ramesh Kumar"
    Error: "Customer name is required" shown below if empty on save

  Field 2 — Phone Number (optional):
    Label: "PHONE NUMBER (optional)" same label style
    TextInput keyboardType="phone-pad" maxLength=10
    placeholder "10-digit mobile number"
    Helper: "Used for WhatsApp reminders" text-gray-500 text-xs mt-1

Save button:
  bg-indigo-600 rounded-2xl py-4 w-full mt-6
  "Add Customer" text-white font-bold text-base
  Disabled + ActivityIndicator when mutation pending

**Save logic:**
  Validate name is not empty (show inline error)
  Call useAddCustomer() mutation with (phone, name.trim(), customerPhone || null)
  On success: showToast("{name} added to udhar ledger", "success"), router.back()
  On error: showToast(error.message, "error")

phone from useAuthStore (the logged-in owner's phone)
All state via useState. Keep it simple.
```

---

## PROMPT 10 — Udhar: Customer Ledger Screen

```
Read AGENTS.md.

Create app/udhar/[customerId].tsx — full ledger for one customer.

Get customerId from useLocalSearchParams<{ customerId: string }>()

**Data:**
  customer from useCustomer(customerId)
  transactions from useTransactionHistory(customerId)
  addEntry mutation from useAddUdharEntry()
  deleteCustomer mutation from useDeleteCustomer()

**Layout:**
SafeAreaView bg-[#0A0E1A] → ScrollView px-6 pt-6 pb-10

Header row:
  "← Back" → router.back()
  Customer name (text-white text-xl font-bold numberOfLines=1 centered)
  "Delete" text-red-400 font-semibold text-sm → delete confirmation

Balance hero card (bg-[#13192B] border border-indigo-900/40 rounded-3xl p-6 mb-6):
  "Outstanding Balance" text-gray-400 text-xs font-semibold uppercase tracking-wider
  "₹{customer.balance}" text-red-400 text-5xl font-extrabold mt-1 (balance > 0)
  "₹0" text-emerald-400 text-5xl font-extrabold mt-1 (balance = 0)
  Customer phone (if set): text-gray-400 text-sm mt-2
  "Last activity {customer.daysSinceActivity} day(s) ago" text-gray-500 text-xs mt-1

WhatsApp Reminder button (show only if customer.phone is set AND balance > 0):
  bg-emerald-600 rounded-2xl py-3 px-5 flex-row items-center justify-center mb-6
  "💬 Send WhatsApp Reminder" text-white font-extrabold text-sm
  onPress: open Linking.openURL with this pre-filled URL:
    wa.me/91{customer.phone}?text=Namaste+{customer.name}ji%2C+aapka+udhar+baaki+hai+%E2%82%B9{customer.balance}.+Kripya+jaldi+chukta+karein.+Shukriya!

Record Entry section (bg-[#13192B] border border-gray-800 rounded-3xl p-5 mb-6):
  Title: "Record Transaction" text-white font-bold text-base mb-3

  Toggle row — two buttons side by side:
    "Gave Udhar" (type=credit) active: bg-red-600, inactive: bg-[#1F2937]
    "Received Payment" (type=repayment) active: bg-emerald-600, inactive: bg-[#1F2937]
    Both: rounded-xl py-3 flex-1 items-center text-white font-bold text-sm

  Amount input:
    "₹" prefix in a row with TextInput
    bg-[#0F1424] border border-gray-800 rounded-2xl px-4 py-3
    keyboardType numeric, placeholder "Enter amount"

  Note input (optional):
    placeholder "Add a note (optional)"
    same TextInput style

  "Save Entry" button:
    Active: bg-indigo-600, Disabled: bg-gray-800 opacity-50
    Calls addEntry mutation with { customerId, amount: parseFloat(amount), type, note: note || null }
    On success: clear inputs, show toast "Transaction recorded", invalidate is handled by hook
    On error: show error toast

Transaction history section:
  "Transaction History" text-white text-lg font-bold mb-4
  For each transaction (FlashList cast as any, estimatedItemSize={64}):
    Row: bg-[#13192B] border border-gray-800 rounded-2xl p-4 mb-3 flex-row items-center
    Left icon: "💸" for credit (red bg-red-950/40), "✅" for repayment (green bg-emerald-950/40)
               w-10 h-10 rounded-xl items-center justify-center mr-3
    Middle:
      "Udhar Given" (credit) or "Payment Received" (repayment) text-white font-semibold text-sm
      note if present: text-gray-400 text-xs mt-0.5
      date: text-gray-500 text-xs mt-0.5 (formatted as DD MMM YYYY)
    Right:
      credit: "+₹{amount}" text-red-400 font-extrabold text-base
      repayment: "-₹{amount}" text-emerald-400 font-extrabold text-base

Empty transaction state: "No transactions yet. Record the first udhar entry above."

**Delete logic:**
  Alert.alert("Delete Customer", "This will permanently delete {name} and all their transaction history. This cannot be undone.")
  On confirm: deleteCustomer mutation → on success router.back()

Use Linking from react-native for the WhatsApp button.
Use useToastStore for feedback.
```

---

---
# PHASE 1 — DASHBOARD INTEGRATION
---

---
## PROMPT 11 — Dashboard: Add Stock + Udhar Summary Cards

```
Read AGENTS.md.

Update app/(tabs)/index.tsx to show stock alerts and udhar summary on the dashboard.

Import:
  useLowStockItems, useExpiringItems from hooks/useInventory
  useCustomers from hooks/useUdhar

Get phone from useAuthStore (already in the file).
Add these three hooks calls at the top of DashboardScreen.

**Section 1 — Stock Alerts (insert between Live Intelligence and Quick Actions):**
Show only if lowStockItems.length > 0 OR expiringItems.length > 0.

If lowStockItems.length > 0:
  Tappable banner → router.push('/stock')
  bg-red-950/30 border border-red-900/50 rounded-3xl p-5 mb-4
  "📦 {count} item(s) low on stock" text-red-400 font-extrabold text-sm
  First 3 item names as text-gray-400 text-xs mt-1

If expiringItems.length > 0:
  Tappable banner → router.push('/stock')
  bg-amber-950/30 border border-amber-900/50 rounded-3xl p-5 mb-4
  "🕐 {count} item(s) expiring soon" text-amber-400 font-extrabold text-sm

**Section 2 — Udhar Summary (insert in Quick Actions row, below Create New Bill):**
Replace the existing "flex-row justify-between" with 3 buttons instead of 2:
  View History → router.push('/(tabs)/history')
  Udhar → router.push('/(tabs)/udhar')  (show total outstanding "₹{X}" below label in text-red-400 text-xs if > 0)
  Analytics → router.push('/(tabs)/analytics')

All three buttons use the existing bg-[#13192B] border border-gray-800 rounded-3xl p-4 pattern.
Change w-[48%] to w-[31%] to fit three in a row.

Do not change any other existing logic in this file.
```

---

---
# PHASE 2 — INTELLIGENCE (build only after Phase 1 is complete)
---

---
## PROMPT 12 — AI Demand Prediction: Service Layer

```
Read AGENTS.md.

Create services/ai/demandPrediction.ts.

This module analyses the last 90 days of bill history and returns next-week
demand predictions using pure TypeScript logic (no external ML library).

**Interfaces to export:**

DemandPrediction:
  itemName: string
  predictedQuantity: number       — units expected to be needed next week
  currentStock: number | null     — from inventory if item has a match, else null
  trend: 'rising' | 'stable' | 'falling'
  reasoning: string               — 1 short sentence

**Function to export:**

generateDemandPredictions(phone: string): Promise<DemandPrediction[]>

Algorithm:
1. Call getBillsHistory(phone) — get all bills
2. Filter to last 90 days
3. Build a per-item weekly sales map: { [itemName]: number[] } where index 0 = oldest week, index 12 = most recent week
4. For each item that has appeared at least 2 times:
   a. Compute average weekly quantity sold (last 4 weeks)
   b. Compute trend:
      - rising if last 2 weeks avg > first 2 weeks avg by more than 15%
      - falling if last 2 weeks avg < first 2 weeks avg by more than 15%
      - else stable
   c. predictedQuantity = Math.ceil(last 4 week avg * 1.1) for rising, * 1.0 for stable, * 0.9 for falling
   d. reasoning: short string based on trend
5. Call getInventory(phone) — match items by name (case-insensitive)
   Set currentStock from inventory if matched
6. Sort by predictedQuantity descending
7. Return top 10 predictions

Wrap everything in try/catch. On error return [].
Import getBillsHistory from services/supabase/billing.
Import getInventory from services/supabase/inventory.
```

---

## PROMPT 13 — AI Demand Prediction: Hook + Analytics Screen Integration

```
Read AGENTS.md.

Step 1 — Add hook to hooks/useAnalytics.ts:

useDemandPredictions(phone: string)
  queryKey: ['demandPredictions', phone]
  queryFn: () => generateDemandPredictions(phone)
  enabled: !!phone
  staleTime: 10 * 60 * 1000

Import generateDemandPredictions from services/ai/demandPrediction.

Step 2 — Add Demand Predictions section to app/(tabs)/analytics.tsx:

Add useDemandPredictions(phone) hook call alongside existing hooks.

Insert a new section at the bottom of the ScrollView, after the Top-Selling Products
section.

Section heading: "🔮 Next Week Predictions" text-white text-lg font-bold mb-4

Loading: ChartSkeleton (already defined in analytics.tsx)

For each DemandPrediction, render a card:
  bg-[#13192B] border border-gray-800 rounded-2xl p-4 mb-3

  Row:
    Left:
      Item name: text-white font-bold text-sm numberOfLines=1
      Reasoning: text-gray-400 text-xs mt-0.5 numberOfLines=2
      If currentStock is not null:
        "In stock: {currentStock} units" text-gray-500 text-xs mt-1

    Right (items-end):
      Trend badge:
        rising  → bg-emerald-950 text-emerald-400 "↑ RISING"
        falling → bg-red-950 text-red-400 "↓ FALLING"
        stable  → bg-gray-800 text-gray-400 "→ STABLE"
        All: text-[9px] font-black px-2 py-0.5 rounded mb-1
      "{predictedQuantity} units" text-white font-extrabold text-base

Empty state: "📊 Not enough sales data yet. Keep creating bills to unlock AI predictions."
text-gray-500 text-sm text-center py-6

Do not change any other logic in analytics.tsx.
```

---

## PROMPT 14 — Profit Analytics: Add Cost/Profit Tracking to Bills

```
Read AGENTS.md.

Currently bills only track sell price. We need to also compute profit using cost price
from inventory.

Step 1 — Update services/supabase/analytics.ts:

Add a new exported function:

fetchProfitStats(phone: string): Promise<{
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  profitMarginPercent: number;
  deadStockItems: InventoryItem[];  — items with quantity > 0 unsold for 30+ days
}>

Algorithm:
1. Get bills from getBillsHistory(phone) — last 30 days
2. Compute totalRevenue = sum of all bill totals
3. Get inventory from getInventory(phone)
4. For each bill item, find matching inventory item by name (case-insensitive)
   If found: cost = inventory item costPrice * quantity
   If not found: estimate cost = sell price * 0.7 (30% margin assumption)
5. totalCost = sum of all costs
6. totalProfit = totalRevenue - totalCost
7. profitMarginPercent = (totalProfit / totalRevenue * 100) rounded to 1 decimal, or 0 if no revenue
8. deadStockItems: inventory items where quantity > 0 AND the item name does not appear in any bill from the last 30 days

Import getInventory from services/supabase/inventory.
Import InventoryItem interface from same file.

Step 2 — Add hook to hooks/useAnalytics.ts:

useProfitStats(phone: string)
  queryKey: ['profitStats', phone]
  queryFn: () => fetchProfitStats(phone)
  enabled: !!phone
  staleTime: 5 * 60 * 1000

Step 3 — Add Profit Stats section to app/(tabs)/analytics.tsx:

Insert between the Overview Stats card and the Weekly Revenue chart.

Profit card (bg-[#13192B] border border-gray-800 rounded-3xl p-5 mb-6):
  Title row: "30-Day Profit Overview" text-white font-bold text-base
  3 stat rows:
    Revenue:  "₹{totalRevenue}"  text-white font-extrabold
    Est. Cost: "₹{totalCost}"   text-gray-400 font-semibold
    Profit:   "₹{totalProfit}"  text-emerald-400 font-extrabold (positive) or text-red-400 (negative)
  Margin badge: "{profitMarginPercent}% margin" bg-indigo-950 text-indigo-300 text-xs font-bold px-3 py-1 rounded-xl self-start mt-2

Dead Stock card (show only if deadStockItems.length > 0):
  bg-amber-950/30 border border-amber-900/40 rounded-3xl p-5 mb-6
  "📦 Dead Stock ({count} items)" text-amber-400 font-bold text-sm
  "Items unsold for 30+ days" text-gray-400 text-xs mt-0.5
  List first 5 item names as text-gray-500 text-xs mt-1

Do not touch existing chart or top products rendering.
```

---

## PROMPT 15 — Supplier Module: Schema + Service

```
Read AGENTS.md.

Add the supplier module. Data layer only.

Step 1 — Update database/schema.sql, append:

```sql
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  name text not null,
  phone text,
  products_supplied text[],
  notes text,
  reliability_score integer default 100 check (reliability_score between 0 and 100),
  created_at timestamp default now()
);

create table supplier_invoices (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references suppliers(id) on delete cascade,
  amount numeric not null,
  due_date date,
  paid boolean default false,
  notes text,
  created_at timestamp default now()
);
```

Step 2 — Create services/supabase/suppliers.ts:

Interfaces:
  Supplier: id, userId, name, phone, productsSupplied (string[]), notes, reliabilityScore, createdAt
  SupplierInvoice: id, supplierId, amount, dueDate (string | null), paid, notes, createdAt

Functions:
  getSuppliers(phone: string): Promise<Supplier[]>
  addSupplier(phone: string, data: Omit<Supplier, 'id' | 'userId' | 'createdAt'>): Promise<Supplier>
  updateSupplier(id: string, updates: Partial<Omit<Supplier, 'id' | 'userId' | 'createdAt'>>): Promise<Supplier>
  deleteSupplier(id: string): Promise<void>
  addSupplierInvoice(supplierId: string, amount: number, dueDate: string | null, notes: string | null): Promise<SupplierInvoice>
  getSupplierInvoices(supplierId: string): Promise<SupplierInvoice[]>
  markInvoicePaid(invoiceId: string): Promise<void>
  getOverdueInvoices(phone: string): Promise<(SupplierInvoice & { supplierName: string })[]>
    — returns unpaid invoices where due_date < today, joined with supplier name

generateReorderMessage(supplier: Supplier, items: Array<{ name: string; quantity: number }>): string
  — returns a WhatsApp-ready text string in this format:
  "Namaste {supplier.name}ji, {storeName} se order hai:\n{item list}\nPlease confirm. Shukriya!"
  storeName is passed as a parameter.

All functions: try/catch, supabase client from config.ts, .maybeSingle() for single lookups.
```

---

---
# PHASE 3 — DELIGHT (build only after Phase 2 is complete)
---

---
## PROMPT 16 — Voice Input: Intent Parser + Service

```
Read AGENTS.md.

Create services/ai/voiceIntent.ts.

This module takes a raw transcribed text string (Hindi/Kannada/English mixed)
and parses it into a structured intent that the app can act on.

**Interfaces:**

VoiceIntentType: 'ADD_STOCK' | 'RECORD_SALE' | 'RECORD_PAYMENT' | 'UNKNOWN'

VoiceIntent:
  type: VoiceIntentType
  itemName?: string
  quantity?: number
  unit?: string
  amount?: number
  customerName?: string
  confidence: 'high' | 'low'

**Function:**

parseVoiceIntent(transcript: string): VoiceIntent

Rules (apply in order, all case-insensitive):

ADD_STOCK patterns — transcript contains words like:
  "aaya", "aaye", "received", "stock", "mila", "box", "packet", "laya"
  Extract: quantity (number before unit), unit (box/packet/kg/litre/dozen/piece), item name
  Examples:
    "ek box Maggi aaya" → { type: ADD_STOCK, itemName: "Maggi", quantity: 1, unit: "box" }
    "5 kg chawal aaya" → { type: ADD_STOCK, itemName: "chawal", quantity: 5, unit: "kg" }
  confidence: 'high' if quantity is found, else 'low'

RECORD_PAYMENT patterns — transcript contains:
  "diya", "diye", "paid", "payment", "chukta", "rupay", "rupees", customer name + amount
  Examples:
    "Ramesh ne 200 diya" → { type: RECORD_PAYMENT, customerName: "Ramesh", amount: 200 }
    "Priya ne 500 rupay diye" → { type: RECORD_PAYMENT, customerName: "Priya", amount: 500 }
  confidence: 'high' if both name and amount found, else 'low'

RECORD_SALE patterns — transcript contains:
  "becha", "beche", "sold", "sale", "gaya", "le gaye"
  Extract item name and quantity
  confidence: 'high' if item found

Else: return { type: 'UNKNOWN', confidence: 'low' }

Use simple regex + word matching. No external NLP library.
Export parseVoiceIntent as the only export.
This is pure synchronous TypeScript — no async, no API calls.

Then create services/ai/whisper.ts:

Import from expo-file-system.

transcribeAudio(audioUri: string): Promise<string>
  — Calls OpenAI Whisper API if EXPO_PUBLIC_OPENAI_API_KEY is set
  — If not configured, return a mock transcript for testing:
    Randomly return one of:
      "ek box Maggi aaya"
      "Ramesh ne 200 diya"
      "5 kg atta aaya"
  — Read audio file as base64 using FileSystem.readAsStringAsync
  — POST to https://api.openai.com/v1/audio/transcriptions
    model: whisper-1, language: hi
  — Return transcript text
  — On error: throw with readable message
```

---

## PROMPT 17 — Voice Input: Voice Button Component + Integration

```
Read AGENTS.md.

Step 1 — Create components/VoiceInputButton.tsx

This is a floating action button that records audio and processes voice commands.

Props:
  onIntentParsed: (intent: VoiceIntent) => void
  style?: ViewStyle

Internal state:
  recording: boolean
  processing: boolean
  statusMessage: string | null

Use expo-av for audio recording.
Check if expo-av is in package.json. If not, note to user to run:
  npx expo install expo-av
Do not install it yourself.

UI:
  Circular button w-16 h-16 rounded-full items-center justify-center
  Idle: bg-indigo-600 shadow-lg shadow-indigo-500/30 — "🎤" emoji text-2xl
  Recording: bg-red-600 animate-pulse — "⏺" emoji text-2xl
  Processing: ActivityIndicator color="#FFFFFF"
  Status message: small text-gray-400 text-xs text-center mt-2 (shown below button)

onPress flow:
  If not recording:
    Request audio permissions (Audio.requestPermissionsAsync())
    If denied: showToast("Microphone permission required", "error"); return
    Start recording with Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
    Set recording = true, statusMessage = "Listening..."
  If recording:
    Stop recording
    Set recording = false, processing = true, statusMessage = "Processing..."
    Get URI from recording.getURI()
    Call transcribeAudio(uri) from services/ai/whisper.ts
    Call parseVoiceIntent(transcript) from services/ai/voiceIntent.ts
    Call onIntentParsed(intent)
    Set processing = false, statusMessage = null
    On error: showToast(error.message, "error"), reset state

Export VoiceInputButton as default.

Step 2 — Integrate into app/bill/new.tsx:

Import VoiceInputButton.
Add it below the existing "Scan Barcode / AI" button in the scan actions row.

When intent arrives via onIntentParsed:
  If intent.type === 'ADD_STOCK' and intent.itemName:
    Show Alert.alert("Voice: Stock Update", "Add {quantity} {unit} of {itemName} to inventory?",
      [Cancel, Confirm → router.push('/stock/add') with params])
  If intent.type === 'RECORD_SALE' and intent.itemName:
    addItem({ id: random, name: intent.itemName, price: 0, quantity: intent.quantity || 1 })
    showToast("Added {itemName} to bill", "success")
  If intent.type === 'UNKNOWN':
    showToast("Could not understand command. Try again.", "warning")
  Other intents: showToast("Command understood. Go to the right screen.", "info")
```

---

## PROMPT 18 — Customer Loyalty: Service + Dashboard Card

```
Read AGENTS.md.

Step 1 — Add to services/supabase/udhar.ts:

Add this interface:
  CustomerLoyaltyStats:
    topCustomers: Array<{ name: string; phone: string | null; visitCount: number; totalSpend: number }>
    churnRisk: Array<{ name: string; phone: string | null; daysSinceLastVisit: number }>
    newVsReturningRatio: { newCount: number; returningCount: number }

Add this function:
  getCustomerLoyaltyStats(phone: string): Promise<CustomerLoyaltyStats>
  
  Algorithm:
  1. Get all bills from getBillsHistory(phone)
  2. Get all customers from getCustomers(phone)
  3. topCustomers: group bills by items — use item names to match customer names (best effort)
     Realistically: return top 5 customers by balance (highest udhar = most frequent interaction)
     Map each to { name, phone, visitCount: transactions.length, totalSpend: sum of credits }
  4. churnRisk: customers with daysSinceActivity > 14, sorted by daysSinceActivity desc
  5. newVsReturning: customers created in last 30 days = new, rest = returning

Step 2 — Add hook to hooks/useUdhar.ts:

useCustomerLoyaltyStats(phone: string)
  queryKey: ['loyaltyStats', phone]
  queryFn: () => getCustomerLoyaltyStats(phone)
  enabled: !!phone
  staleTime: 10 * 60 * 1000

Step 3 — Add Loyalty section to app/(tabs)/analytics.tsx:

Insert at the very bottom, after the Demand Predictions section.

"👑 Customer Loyalty" text-white text-lg font-bold mb-4

Top 5 Regulars card (bg-[#13192B] border border-gray-800 rounded-3xl p-5 mb-6):
  For each top customer:
    Row: rank badge (#1 etc in bg-indigo-950 text-indigo-400) | name | "₹{totalSpend} spend" right-aligned

Churn Risk card (show only if churnRisk.length > 0):
  bg-red-950/30 border border-red-900/40 rounded-3xl p-5 mb-6
  "⚠️ {count} customer(s) at churn risk" text-red-400 font-bold text-sm
  For each churn risk customer:
    "{name} — {daysSinceLastVisit} days inactive" text-gray-400 text-xs
    WhatsApp link button if phone is set

New vs Returning badge row:
  Two side-by-side cards:
    "New: {newCount}" bg-indigo-950 text-indigo-300
    "Returning: {returningCount}" bg-emerald-950 text-emerald-300
```

---

---
# PHASE 4 — WOW (build only after Phase 3 is complete)
---

---
## PROMPT 19 — Mini Online Store: Storefront Service + Shareable Link

```
Read AGENTS.md.

Add the mini online store. This phase creates the data foundation and share link.
The actual storefront web page (Next.js) is out of scope for this prompt —
focus only on the mobile app side.

Step 1 — Update database/schema.sql, append:

```sql
create table online_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  customer_name text not null,
  customer_phone text,
  items jsonb not null,
  total numeric not null,
  status text not null default 'pending' check (status in ('pending', 'fulfilled', 'cancelled')),
  created_at timestamp default now()
);
```

Step 2 — Create services/supabase/onlineStore.ts:

Interfaces:
  OnlineOrder:
    id, userId, customerName, customerPhone (string | null),
    items: Array<{ name: string; price: number; quantity: number }>,
    total, status ('pending' | 'fulfilled' | 'cancelled'), createdAt

Functions:
  getOnlineOrders(phone: string): Promise<OnlineOrder[]>
    — fetch pending orders first, then others, ordered by created_at desc

  fulfillOrder(orderId: string): Promise<void>
    — set status = 'fulfilled'

  cancelOrder(orderId: string): Promise<void>
    — set status = 'cancelled'

  getStoreShareLink(phone: string, storeName: string): string
    — return: https://shopiq.app/store/{phone.replace('+', '')}
    — this is just a formatted URL, no API call

Step 3 — Add "Online Store" section to app/(tabs)/profile.tsx:

In the settings list (the array of items rendered with .map()), add a new item:
  { label: 'My Online Store & Share Link', icon: '🌐' }

When tapped (add onPress to the TouchableOpacity in the map):
  If label is 'My Online Store & Share Link':
    const link = getStoreShareLink(phone, storeName)
    Share.share({ message: `Order from my store: ${link}` })

Import Share from react-native and getStoreShareLink from services/supabase/onlineStore.ts.

Step 4 — Create app/orders/index.tsx — Online Order Queue screen:

Show list of pending online orders.
Each card: customer name, phone, items summary, total, timestamp
"Mark Fulfilled" button → fulfillOrder(order.id) → refetch
"Cancel" button → Alert confirm → cancelOrder → refetch

Add this route to app/(tabs)/_layout.tsx:
  name="orders" title="Orders" icon "🛒"
  Place between Udhar and Profile tabs.
```

---

## PROMPT 20 — Credit Score: Scoring Engine

```
Read AGENTS.md.

Create services/ai/creditScore.ts.

This module generates a 0–100 creditworthiness score for the store owner
based purely on data already in the app.

**Interface:**

CreditScoreResult:
  score: number                   — 0 to 100
  grade: 'A' | 'B' | 'C' | 'D'  — A: 80-100, B: 60-79, C: 40-59, D: 0-39
  breakdown: {
    revenuConsistency: number     — 0-30 points
    billVolume: number            — 0-25 points
    inventoryManagement: number   — 0-25 points
    udharRepaymentRate: number    — 0-20 points
  }
  summary: string                 — 2 sentences explaining the score

**Function:**

generateCreditScore(phone: string): Promise<CreditScoreResult>

Algorithm:

1. Revenue Consistency (0-30 pts):
   Get last 12 weeks of bills. Compute weekly revenue.
   Score = 30 * (weeks with revenue > 0) / 12
   Bonus: +5 (capped at 30) if revenue is trending up (last 4 weeks avg > first 4 weeks avg)

2. Bill Volume (0-25 pts):
   Total bills in last 30 days.
   0-9 bills = 10 pts
   10-29 bills = 18 pts
   30-49 bills = 22 pts
   50+ bills = 25 pts

3. Inventory Management (0-25 pts):
   Get inventory. If empty = 5 pts.
   Base = 15 pts
   +5 if zero items are below low_stock_threshold
   +5 if zero items are past expiry date

4. Udhar Repayment Rate (0-20 pts):
   Get all udhar transactions.
   Total credited = sum of credit amounts
   Total repaid = sum of repayment amounts
   If total credited = 0: 20 pts (no udhar given = no risk)
   Else: rate = totalRepaid / totalCredited (capped at 1.0)
   pts = Math.round(rate * 20)

5. score = sum of all four components
6. grade = based on score ranges above
7. summary = short string based on grade

Import getBillsHistory, getInventory, getCustomers from their respective services.
Wrap in try/catch. On error return score=0, grade='D'.

Then add to hooks/useAnalytics.ts:

useCreditScore(phone: string)
  queryKey: ['creditScore', phone]
  queryFn: () => generateCreditScore(phone)
  enabled: !!phone
  staleTime: 30 * 60 * 1000

Then add CreditScore card to app/(tabs)/analytics.tsx at the very bottom:

"🏆 ShopIQ Credit Score" text-white text-lg font-bold mb-4

Card bg-[#13192B] border border-gray-800 rounded-3xl p-6 mb-6:
  Score circle (w-24 h-24 rounded-full border-4 items-center justify-center mx-auto mb-4):
    A grade: border-emerald-500 bg-emerald-950/30, text-emerald-400
    B grade: border-indigo-500 bg-indigo-950/30, text-indigo-400
    C grade: border-amber-500 bg-amber-950/30, text-amber-400
    D grade: border-red-500 bg-red-950/30, text-red-400
    Score number text-3xl font-extrabold + grade text-lg font-bold below it

  Summary text: text-gray-400 text-sm text-center mt-2 leading-5

  Breakdown rows (4 rows, one per component):
    Label left, points right (text-white font-semibold)
    Progress bar: View h-1.5 rounded-full bg-gray-800 mt-1
                  Inner View with width % = points/maxPoints * 100, bg-indigo-500 rounded-full
```

