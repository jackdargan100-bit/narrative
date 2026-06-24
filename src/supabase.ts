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

/** Shape of each item in favorite_wallets.saved_results (matches scan-wallet output). */
export type DbWalletScanTrade = {
  id: string;
  token_name: string;
  token_symbol: string;
  contract_address: string;
  entry_price: number;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  position_size: number;
  setup_type: string;
  notes: string;
  status: 'open' | 'closed';
  tx_signature: string;
  timestamp: number;
  trade_type: 'buy' | 'sell';
  token_amount: number;
  sol_amount: number;
  usd_value: number | null;
  selected: boolean;
  mock: boolean;
};

export type WalletRole = 'my' | 'tracked';

export type DbWallet = {
  id: string;
  user_id: string;
  wallet_address: string;
  nickname: string;
  notes: string | null;
  wallet_type: WalletRole;
  last_scanned_at: string | null;
  trade_count: number;
  saved_results: DbWalletScanTrade[] | null;
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
