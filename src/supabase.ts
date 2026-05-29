import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type DbTrade = {
  id: string;
  user_id: string;
  token_name: string;
  contract_address: string;
  entry_price: number;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  position_size: number;
  setup_type: string;
  notes: string | null;
  screenshots: string[];
  status: string;
  pnl: number | null;
  rr_ratio: number | null;
  created_at: string;
};

export type DbWallet = {
  id: string;
  user_id: string;
  wallet_address: string;
  nickname: string;
  notes: string | null;
  created_at: string;
};

export type DbWatchlistItem = {
  id: string;
  user_id: string;
  token_name: string;
  contract_address: string;
  notes: string;
  created_at: string;
};
