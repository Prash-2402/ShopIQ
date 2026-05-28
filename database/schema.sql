-- Create users table
create table users (
  id uuid primary key default gen_random_uuid(),
  phone text unique,
  store_name text,
  created_at timestamp default now()
);

-- Create bills table
create table bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  bill_number text unique not null,
  total numeric not null,
  created_at timestamp default now()
);

-- Create bill_items table
create table bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid references bills(id) on delete cascade,
  product_name text not null,
  barcode text,
  quantity integer not null default 1,
  price numeric not null,
  subtotal numeric not null
);

-- Create products table (global barcode dictionary)
create table products (
  id uuid primary key default gen_random_uuid(),
  barcode text unique not null,
  name text not null,
  price numeric not null,
  category text,
  created_at timestamp default now()
);

-- Create inventory_items table (per-store stock tracking)
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
