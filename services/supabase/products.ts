import { supabase } from './config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lookupProductByBarcode } from '../ai/gemini';
import { checkInternetConnection } from './billing';

export interface CachedProduct {
  barcode: string;
  name: string;
  price: number;
  category: string;
  lastUsed: number;
}

const PRODUCT_CACHE_KEY = '@product_cache';
const CACHE_LIMIT = 200;

export const getLocalCache = async (): Promise<CachedProduct[]> => {
  try {
    const data = await AsyncStorage.getItem(PRODUCT_CACHE_KEY);
    return data ? (JSON.parse(data) as CachedProduct[]) : [];
  } catch (e) {
    console.error('Failed to load local product cache:', e);
    return [];
  }
};

export const saveToLocalCache = async (barcode: string, name: string, price: number, category: string) => {
  try {
    const cache = await getLocalCache();
    const existingIdx = cache.findIndex((p) => p.barcode === barcode);
    
    const newEntry: CachedProduct = {
      barcode,
      name,
      price,
      category,
      lastUsed: Date.now(),
    };

    if (existingIdx > -1) {
      cache[existingIdx] = newEntry;
    } else {
      if (cache.length >= CACHE_LIMIT) {
        cache.sort((a, b) => a.lastUsed - b.lastUsed);
        cache.shift();
      }
      cache.push(newEntry);
    }

    await AsyncStorage.setItem(PRODUCT_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error('Failed to save to local product cache:', e);
  }
};

export const resolveProductByBarcode = async (barcode: string): Promise<{ name: string; price: number; category: string }> => {
  const cache = await getLocalCache();
  const cachedProduct = cache.find((p) => p.barcode === barcode);
  
  if (cachedProduct) {
    console.log(`[PRODUCT-CACHE] Resolved ${barcode} from local cache.`);
    await saveToLocalCache(barcode, cachedProduct.name, cachedProduct.price, cachedProduct.category);
    return {
      name: cachedProduct.name,
      price: cachedProduct.price,
      category: cachedProduct.category,
    };
  }

  const isOnline = await checkInternetConnection();
  if (isOnline) {
    try {
      const { data: dbProduct, error } = await supabase
        .from('products')
        .select('*')
        .eq('barcode', barcode)
        .maybeSingle();

      if (error) throw error;

      if (dbProduct) {
        console.log(`[PRODUCT-CACHE] Resolved ${barcode} from Supabase products directory.`);
        await saveToLocalCache(barcode, dbProduct.name, parseFloat(dbProduct.price), dbProduct.category);
        return {
          name: dbProduct.name,
          price: parseFloat(dbProduct.price),
          category: dbProduct.category || 'General',
        };
      }
    } catch (e) {
      console.warn('Failed to query global products table from Supabase:', e);
    }
  }

  console.log(`[PRODUCT-CACHE] Cold lookup. Querying Gemini API for barcode ${barcode}`);
  const geminiResult = await lookupProductByBarcode(barcode);

  await saveToLocalCache(barcode, geminiResult.productName, geminiResult.price, geminiResult.category);

  if (isOnline) {
    try {
      await supabase
        .from('products')
        .insert([{
          barcode,
          name: geminiResult.productName,
          price: geminiResult.price,
          category: geminiResult.category,
        }]);
      console.log(`[PRODUCT-CACHE] Successfully synced ${barcode} to Supabase global directory.`);
    } catch (e) {
      console.warn('Failed to write product back to Supabase:', e);
    }
  }

  return {
    name: geminiResult.productName,
    price: geminiResult.price,
    category: geminiResult.category,
  };
};
