import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const isRealSupabase = 
  supabaseUrl.startsWith('http') && 
  supabaseUrl !== 'YOUR_SUPABASE_URL' && 
  supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY';

const createMockSupabase = () => {
  const handler = {
    get(target: any, prop: string): any {
      if (prop === 'then') {
        return (resolve: any) => resolve({ data: null, error: null });
      }
      return new Proxy(() => {}, {
        apply: () => new Proxy({}, handler),
        get: (t, p) => handler.get(t, p as string),
      });
    }
  };
  return new Proxy({}, handler) as any;
};

export const supabase = isRealSupabase
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createMockSupabase();
