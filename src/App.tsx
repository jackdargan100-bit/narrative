import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import {
  TrendingUp,
  TrendingDown,
  Target,
  Wallet,
  LineChart,
  PlusCircle,
  Image as ImageIcon,
  X,
  Save,
  DollarSign,
  BarChart3,
  Copy,
  ExternalLink,
  Check,
  AlertCircle,
  Trash2,
  Calendar,
  Hash,
  Search,
  Download,
  Filter,
  ChevronUp,
  ChevronDown,
  History,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Activity,
  Star,
  Eye,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Menu,
  Flame,
  Award,
  Layers,
  Percent,
  LogOut,
  Mail,
  Lock,
  UserPlus,
  Sparkles,
  Upload,
  FileText,
  ChevronRight as ChevronRightIcon,
  RefreshCw,
  BookOpen,
  TrendingDown as TrendingDownIcon,
  ShieldAlert,
  Crosshair,
  Globe,
  BarChart2,
  Droplets,
  Clock as ClockIcon,
  ArrowRight,
  CheckCircle2,
  Edit3,
  Wallet as WalletIcon,
  ClipboardList,
  ShieldCheck,
  AlertTriangle,
  Table,
  ScanLine,
  Clipboard,
  MoreHorizontal,
  Loader2,
} from 'lucide-react';

const SETUP_TYPES = [
  { value: 'reclaim', label: 'Reclaim', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50' },
  { value: 'support_bounce', label: 'Support Bounce', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' },
  { value: 'breakout', label: 'Breakout', color: 'bg-blue-500/20 text-blue-400 border-blue-500/50' },
  { value: 'momentum_scalp', label: 'Momentum Scalp', color: 'bg-orange-500/20 text-orange-400 border-orange-500/50' },
  { value: 'avoid', label: 'Avoid', color: 'bg-red-500/20 text-red-400 border-red-500/50' },
] as const;

type SetupType = typeof SETUP_TYPES[number]['value'];

interface Trade {
  id: string;
  token_name: string;
  contract_address: string;
  entry_price: number;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  position_size: number;
  setup_type: SetupType;
  notes: string | null;
  screenshots: string[];
  status: 'open' | 'closed';
  pnl: number | null;
  rr_ratio: number | null;
  created_at: string;
}

interface FavoriteWallet {
  id: string;
  wallet_address: string;
  nickname: string;
  notes: string | null;
  created_at: string;
}

const STORAGE_KEYS = {
  TRADES: 'narrative_trades',
  WALLETS: 'narrative_wallets',
};

interface WatchlistItem {
  id: string;
  token_name: string;
  contract_address: string;
  notes: string;
  created_at: string;
}

const STORAGE_KEY_WATCHLIST = 'narrative_watchlist';

// ─── helpers to load from localStorage (fallback) ────────────────────────────
function loadLocalTrades(): Trade[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.TRADES) || '[]'); } catch { return []; }
}
function loadLocalWallets(): FavoriteWallet[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.WALLETS) || '[]'); } catch { return []; }
}
function loadLocalWatchlist(): WatchlistItem[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_WATCHLIST) || '[]'); } catch { return []; }
}

function App() {
  // ── auth state ──────────────────────────────────────────────────────────────
  const [session, setSession] = useState<Session | null | undefined>(undefined); // undefined = loading
  const [user, setUser] = useState<User | null>(null);

  // ── app state ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'dashboard' | 'add' | 'history' | 'analytics' | 'wallets' | 'journal' | 'import'>('dashboard');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [wallets, setWallets] = useState<FavoriteWallet[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // ── subscribe to auth changes ───────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── load data when session changes ─────────────────────────────────────────
  const loadUserData = useCallback(async (uid: string) => {
    setDataLoading(true);
    try {
      const [tradesRes, walletsRes, watchlistRes] = await Promise.all([
        supabase.from('trades').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
        supabase.from('favorite_wallets').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
        supabase.from('watchlist_items').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
      ]);

      if (tradesRes.data) setTrades(tradesRes.data as Trade[]);
      if (walletsRes.data) setWallets(walletsRes.data as FavoriteWallet[]);
      if (watchlistRes.data) setWatchlist(watchlistRes.data as WatchlistItem[]);
    } catch {
      // Supabase unavailable — fall back to localStorage
      setTrades(loadLocalTrades());
      setWallets(loadLocalWallets());
      setWatchlist(loadLocalWatchlist());
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadUserData(user.id);
    } else if (!user && session === null) {
      setTrades([]);
      setWallets([]);
      setWatchlist([]);
    }
  }, [user, session, loadUserData]);

  // ── logout ──────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // ── watchlist CRUD ──────────────────────────────────────────────────────────
  const handleAddWatchlistItem = async (item: Omit<WatchlistItem, 'id' | 'created_at'>) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('watchlist_items')
      .insert({ ...item, user_id: user.id })
      .select()
      .maybeSingle();
    if (!error && data) setWatchlist(prev => [data as WatchlistItem, ...prev]);
  };

  const handleDeleteWatchlistItem = async (id: string) => {
    setWatchlist(prev => prev.filter(w => w.id !== id));
    if (user) {
      await supabase.from('watchlist_items').delete().eq('id', id).eq('user_id', user.id);
    }
  };

  // ── trade CRUD ──────────────────────────────────────────────────────────────
  const handleAddTrade = async (trade: Omit<Trade, 'id' | 'created_at' | 'pnl' | 'rr_ratio'>) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('trades')
      .insert({ ...trade, user_id: user.id, pnl: null, rr_ratio: null })
      .select()
      .maybeSingle();
    if (!error && data) {
      setTrades(prev => [data as Trade, ...prev]);
      setActiveTab('dashboard');
    }
  };

  const handleCloseTrade = async (id: string, exitPrice: number) => {
    const trade = trades.find(t => t.id === id);
    if (!trade) return;

    const pnlValue = ((exitPrice - trade.entry_price) / trade.entry_price) * 100;
    const rrValue = trade.stop_loss
      ? Math.abs((exitPrice - trade.entry_price) / (trade.entry_price - trade.stop_loss))
      : 0;

    const updates = {
      exit_price: exitPrice,
      status: 'closed' as const,
      pnl: pnlValue,
      rr_ratio: rrValue,
    };

    setTrades(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));

    if (user) {
      await supabase.from('trades').update(updates).eq('id', id).eq('user_id', user.id);
    }
  };

  const handleDeleteTrade = async (id: string) => {
    setTrades(prev => prev.filter(t => t.id !== id));
    if (user) {
      await supabase.from('trades').delete().eq('id', id).eq('user_id', user.id);
    }
  };

  const handleUpdateTrade = async (id: string, updates: Partial<Trade>) => {
    setTrades(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    if (user) {
      await supabase.from('trades').update(updates).eq('id', id).eq('user_id', user.id);
    }
  };

  // ── wallet CRUD ─────────────────────────────────────────────────────────────
  const handleAddWallet = async (wallet: Omit<FavoriteWallet, 'id' | 'created_at'>) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('favorite_wallets')
      .insert({ ...wallet, user_id: user.id })
      .select()
      .maybeSingle();
    if (!error && data) setWallets(prev => [data as FavoriteWallet, ...prev]);
  };

  const handleDeleteWallet = async (id: string) => {
    setWallets(prev => prev.filter(w => w.id !== id));
    if (user) {
      await supabase.from('favorite_wallets').delete().eq('id', id).eq('user_id', user.id);
    }
  };

  // ── derived stats ───────────────────────────────────────────────────────────
  const openTrades = trades.filter(t => t.status === 'open');
  const closedTrades = trades.filter(t => t.status === 'closed');

  const winRate = closedTrades.length > 0
    ? ((closedTrades.filter(t => (t.pnl || 0) > 0).length / closedTrades.length) * 100).toFixed(1)
    : '0';

  const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const avgRR = closedTrades.length > 0
    ? (closedTrades.reduce((sum, t) => sum + (t.rr_ratio || 0), 0) / closedTrades.length).toFixed(2)
    : '0';

  // ── render ──────────────────────────────────────────────────────────────────

  // Still resolving session
  if (session === undefined) {
    return (
      <div className="min-h-screen bg-[#0a0c10] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-5 h-5 border-2 border-emerald-500/40 border-t-emerald-400 rounded-full animate-spin" />
          <span className="text-sm font-mono">Loading…</span>
        </div>
      </div>
    );
  }

  // Not authenticated — show login/signup
  if (!session) {
    return <AuthPage />;
  }

  const loading = dataLoading;

  return (
    <div className="min-h-screen bg-[#0a0c10] text-gray-100 font-mono flex">
      {/* Ambient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-emerald-900/8 via-transparent to-cyan-900/8 pointer-events-none" />
      <div className="fixed top-0 left-1/3 w-96 h-96 bg-emerald-500/3 rounded-full blur-3xl pointer-events-none" />

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => { setActiveTab(tab); setMobileSidebarOpen(false); }}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(p => !p)}
        mobileOpen={mobileSidebarOpen}
        trades={trades}
        openCount={openTrades.length}
        onLogout={handleLogout}
        userEmail={user?.email ?? ''}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-0">
        {/* Top bar */}
        <header className="border-b border-gray-800/60 bg-[#0e1016]/95 backdrop-blur-xl sticky top-0 z-30 flex-shrink-0">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 gap-4">
            <div className="flex items-center gap-3">
              {/* Mobile menu button */}
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="lg:hidden p-2 text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 rounded-lg transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="hidden lg:block">
                <h2 className="text-sm font-semibold text-white capitalize">
                  {activeTab === 'add' ? 'Log New Trade' : activeTab === 'journal' ? 'Quick Journal' : activeTab === 'import' ? 'Import Trades' : activeTab}
                </h2>
                <p className="text-xs text-gray-600">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Quick stats */}
              <div className="hidden lg:flex items-center gap-1 divide-x divide-gray-800">
                <div className="pr-3 text-right">
                  <p className="text-xs text-gray-600">Open</p>
                  <p className="text-sm font-bold text-cyan-400">{openTrades.length}</p>
                </div>
                <div className="px-3 text-right">
                  <p className="text-xs text-gray-600">Win Rate</p>
                  <p className={`text-sm font-bold ${parseFloat(winRate) >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{winRate}%</p>
                </div>
                <div className="pl-3 text-right">
                  <p className="text-xs text-gray-600">P&L</p>
                  <p className={`text-sm font-bold ${totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(1)}%
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveTab('add')}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg text-sm font-semibold hover:from-emerald-400 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/20"
              >
                <PlusCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Log Trade</span>
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 sm:p-6 pb-16">
            {loading ? (
              <LoadingState />
            ) : (
              <>
                {activeTab === 'dashboard' && (
                  <Dashboard
                    openTrades={openTrades}
                    closedTrades={closedTrades}
                    winRate={winRate}
                    totalPnL={totalPnL}
                    avgRR={avgRR}
                    onCloseTrade={handleCloseTrade}
                    onDeleteTrade={handleDeleteTrade}
                    trades={trades}
                    watchlist={watchlist}
                    onAddWatchlist={handleAddWatchlistItem}
                    onDeleteWatchlist={handleDeleteWatchlistItem}
                    onLogTrade={() => setActiveTab('add')}
                    onImport={() => setActiveTab('import')}
                  />
                )}
                {activeTab === 'add' && (
                  <AddTradeForm
                    onSubmit={handleAddTrade}
                    onCancel={() => setActiveTab('dashboard')}
                  />
                )}
                {activeTab === 'history' && (
                  <TradeHistory
                    trades={trades}
                    onCloseTrade={handleCloseTrade}
                    onDeleteTrade={handleDeleteTrade}
                    onUpdateTrade={handleUpdateTrade}
                  />
                )}
                {activeTab === 'analytics' && (
                  <Analytics
                    trades={trades}
                    closedTrades={closedTrades}
                    winRate={winRate}
                    totalPnL={totalPnL}
                    avgRR={avgRR}
                  />
                )}
                {activeTab === 'wallets' && (
                  <FavoriteWallets
                    wallets={wallets}
                    onAdd={handleAddWallet}
                    onDelete={handleDeleteWallet}
                  />
                )}
                {activeTab === 'journal' && (
                  <QuickJournal
                    onSaveTrade={handleAddTrade}
                    onCancel={() => setActiveTab('dashboard')}
                  />
                )}
                {activeTab === 'import' && (
                  <ImportTrades
                    onImport={(trades) => {
                      trades.forEach(t => handleAddTrade(t));
                      setActiveTab('history');
                    }}
                    onCancel={() => setActiveTab('dashboard')}
                  />
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// ─── Auth Page ───────────────────────────────────────────────────────────────
function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setSubmitting(true);

    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        setInfo('Account created! Check your email for a confirmation link, or sign in if confirmation is disabled.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0c10] font-mono flex items-center justify-center p-4">
      {/* Ambient */}
      <div className="fixed inset-0 bg-gradient-to-br from-emerald-900/8 via-transparent to-cyan-900/8 pointer-events-none" />
      <div className="fixed top-1/4 left-1/3 w-96 h-96 bg-emerald-500/4 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-2xl shadow-emerald-500/30 mb-4">
            <LineChart className="w-7 h-7 text-gray-900" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Narrative
          </h1>
          <p className="text-gray-600 text-sm mt-1">Track the narrative. Trade the momentum.</p>
        </div>

        {/* Card */}
        <div className="bg-[#0e1016]/95 border border-gray-800/60 rounded-2xl p-8 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <div className="flex gap-1 mb-6 p-1 bg-gray-900/60 rounded-xl">
            <button
              onClick={() => { setMode('login'); setError(''); setInfo(''); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === 'login'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('signup'); setError(''); setInfo(''); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === 'signup'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1.5 font-semibold">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-gray-900/60 border border-gray-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1.5 font-semibold">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full bg-gray-900/60 border border-gray-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 px-3.5 py-3 bg-red-500/10 border border-red-500/25 rounded-xl">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-400 leading-relaxed">{error}</p>
              </div>
            )}

            {info && (
              <div className="flex items-start gap-2.5 px-3.5 py-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl">
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-400 leading-relaxed">{info}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-bold hover:from-emerald-400 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : mode === 'login' ? (
                <>Sign In</>
              ) : (
                <><UserPlus className="w-4 h-4" /> Create Account</>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-gray-600 mt-6">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setInfo(''); }}
              className="text-emerald-400 hover:text-emerald-300 transition-colors font-medium"
            >
              {mode === 'login' ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </div>

        <p className="text-center text-xs text-gray-700 mt-4">
          Your data is private and encrypted — only you can see your trades.
        </p>
      </div>
    </div>
  );
}

function Sidebar({ activeTab, setActiveTab, collapsed, onToggleCollapse, mobileOpen, trades, openCount, onLogout, userEmail }: {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  trades: Trade[];
  openCount: number;
  onLogout: () => void;
  userEmail: string;
}) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3, badge: null, primary: false },
    { id: 'add', label: 'Log Trade', icon: PlusCircle, badge: null, primary: true },
    { id: 'journal', label: 'Quick Journal', icon: Sparkles, badge: 'AI', primary: false },
    { id: 'import', label: 'Import Trades', icon: Download, badge: null, primary: false },
    { id: 'history', label: 'Trade History', icon: History, badge: trades.length > 0 ? trades.length : null, primary: false },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp, badge: null, primary: false },
    { id: 'wallets', label: 'Wallets', icon: Wallet, badge: null, primary: false },
  ] as const;

  const closedTrades = trades.filter(t => t.status === 'closed');
  const winRate = closedTrades.length > 0
    ? ((closedTrades.filter(t => (t.pnl || 0) > 0).length / closedTrades.length) * 100).toFixed(0)
    : '0';

  return (
    <aside className={`
      fixed lg:sticky top-0 h-screen z-50 lg:z-auto
      flex flex-col bg-[#0c0e14] border-r border-gray-800/60
      transition-all duration-300 ease-in-out flex-shrink-0
      ${collapsed ? 'lg:w-16' : 'lg:w-56'}
      ${mobileOpen ? 'left-0 w-64 shadow-2xl shadow-black/50' : '-left-64 lg:left-auto'}
    `}>
      {/* Logo */}
      <div className={`flex items-center border-b border-gray-800/60 h-[57px] flex-shrink-0 ${collapsed ? 'justify-center px-3' : 'px-4 gap-3'}`}>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 flex-shrink-0">
          <LineChart className="w-4 h-4 text-gray-900" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent leading-tight">Narrative</p>
            <p className="text-[10px] text-gray-600 leading-tight">Track the narrative. Trade the momentum.</p>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex p-1 text-gray-600 hover:text-gray-400 transition-colors rounded"
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
        {!collapsed && (
          <p className="text-[10px] text-gray-600 uppercase tracking-widest px-2 pb-2 pt-1 font-semibold">Navigation</p>
        )}
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const isPrimary = item.primary;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center rounded-lg transition-all duration-150 group relative
                ${collapsed ? 'justify-center p-3' : 'px-3 py-2.5 gap-3'}
                ${isActive
                  ? isPrimary
                    ? 'bg-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/10'
                    : 'bg-emerald-500/15 text-emerald-400 shadow-lg shadow-emerald-500/5'
                  : isPrimary
                  ? 'text-emerald-500 hover:text-emerald-300 hover:bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/30'
                  : 'text-gray-500 hover:text-gray-200 hover:bg-gray-800/60'
                }
              `}
            >
              {isActive && !collapsed && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-emerald-400 rounded-r" />
              )}
              <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive || isPrimary ? 'text-emerald-400' : ''}`} />
              {!collapsed && (
                <>
                  <span className="text-sm font-medium flex-1 text-left">{item.label}</span>
                  {item.badge !== null && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-500'}`}>
                      {item.badge}
                    </span>
                  )}
                </>
              )}
              {collapsed && item.badge !== null && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-400 rounded-full" />
              )}
            </button>
          );
        })}

        {/* Open Positions indicator */}
        {!collapsed && openCount > 0 && (
          <div className="mt-4 mx-1">
            <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Open Positions</span>
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
              </div>
              <p className="text-xl font-bold text-cyan-400">{openCount}</p>
            </div>
          </div>
        )}
      </nav>

      {/* Sidebar bottom: stats + user + logout */}
      <div className="border-t border-gray-800/60 flex-shrink-0">
        {!collapsed && (
          <div className="p-3 space-y-2">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold px-1">Performance</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-800/40 rounded-lg p-2.5">
                <p className="text-[10px] text-gray-600 mb-0.5">Win Rate</p>
                <p className={`text-sm font-bold ${parseInt(winRate) >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{winRate}%</p>
              </div>
              <div className="bg-gray-800/40 rounded-lg p-2.5">
                <p className="text-[10px] text-gray-600 mb-0.5">Trades</p>
                <p className="text-sm font-bold text-white">{trades.length}</p>
              </div>
            </div>
          </div>
        )}

        {/* User row + logout */}
        <div className={`px-3 pb-3 ${collapsed ? 'flex flex-col items-center gap-2 pt-3' : 'space-y-2'}`}>
          {!collapsed && userEmail && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-900/50 border border-gray-800/50">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                <span className="text-[9px] font-bold text-emerald-400 uppercase">
                  {userEmail.charAt(0)}
                </span>
              </div>
              <span className="text-[10px] text-gray-500 truncate flex-1">{userEmail}</span>
            </div>
          )}
          <button
            onClick={onLogout}
            title="Sign out"
            className={`flex items-center gap-2 text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all rounded-lg text-xs font-medium border border-transparent hover:border-red-500/20
              ${collapsed ? 'justify-center p-3 w-full' : 'w-full px-2.5 py-2'}
            `}
          >
            <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}

function Dashboard({ openTrades, closedTrades, winRate, totalPnL, avgRR, onCloseTrade, onDeleteTrade, trades, watchlist, onAddWatchlist, onDeleteWatchlist, onLogTrade, onImport }) {
  const recentTrades = [...trades].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10);
  const isEmpty = trades.length === 0;

  return (
    <div className="space-y-5">
      {isEmpty ? (
        /* ── Empty state ── */
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <div className="relative mb-8">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/15 border border-emerald-500/20 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/10">
              <LineChart className="w-12 h-12 text-emerald-400" />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-400/20 border border-emerald-400/40 flex items-center justify-center">
              <span className="text-emerald-400 text-xs font-bold">+</span>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Start tracking your trades</h2>
          <p className="text-gray-500 text-sm max-w-md mb-8 leading-relaxed">
            Log your Solana meme coin trades to track win rate, P&L, and setup performance over time.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 mb-10">
            <button
              onClick={onLogTrade}
              className="flex items-center gap-2.5 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-bold hover:from-emerald-400 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-105"
            >
              <PlusCircle className="w-5 h-5" />
              Log Your First Trade
            </button>
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full">
            {[
              { icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', title: 'Track P&L', desc: 'See win rate, avg R:R, and cumulative returns' },
              { icon: BarChart3, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', title: 'Setup Analytics', desc: 'Discover which setups perform best for you' },
              { icon: History, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', title: 'Trade Journal', desc: 'Log entries, exits, notes, and screenshots' },
            ].map(({ icon: Icon, color, bg, title, desc }) => (
              <div key={title} className={`border rounded-xl p-4 text-left ${bg}`}>
                <Icon className={`w-5 h-5 ${color} mb-3`} />
                <p className="text-sm font-semibold text-white mb-1">{title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Stats row */}
          <StatsCards
            openCount={openTrades.length}
            closedCount={closedTrades.length}
            winRate={winRate}
            totalPnL={totalPnL}
            avgRR={avgRR}
          />

          {/* Main terminal grid — full width left, compact right panel */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-5">
            {/* Left: positions + closed — takes all available space */}
            <div className="space-y-5 min-w-0">
              {/* Open Positions */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-cyan-400 flex items-center gap-2">
                    <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                    Open Positions
                    <span className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold">{openTrades.length}</span>
                  </h2>
                  {openTrades.length === 0 && (
                    <button
                      onClick={onLogTrade}
                      className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-medium"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      Open a position
                    </button>
                  )}
                </div>
                {openTrades.length === 0 ? (
                  <div className="bg-[#12141a]/40 border border-dashed border-gray-800/60 rounded-xl p-6 text-center">
                    <p className="text-gray-600 text-sm">No open positions — ready to enter a trade?</p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
                    {openTrades.map((trade) => (
                      <TradeCard key={trade.id} trade={trade} onClose={onCloseTrade} onDelete={onDeleteTrade} />
                    ))}
                  </div>
                )}
              </section>

              {/* Closed Trades */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 flex items-center gap-2">
                    <Target className="w-3.5 h-3.5 text-emerald-500" />
                    Recent Closed Trades
                    <span className="bg-gray-800/60 text-gray-500 border border-gray-700/50 text-[10px] px-2 py-0.5 rounded-full font-bold">{closedTrades.length}</span>
                  </h2>
                </div>
                {closedTrades.length === 0 ? (
                  <div className="bg-[#12141a]/60 border border-dashed border-gray-800/60 rounded-xl overflow-hidden">
                    <div className="flex items-start gap-3 px-5 pt-5 pb-4">
                      <div className="w-8 h-8 rounded-lg bg-gray-800/80 border border-gray-700/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Target className="w-4 h-4 text-gray-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-400">No closed trades yet</p>
                        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                          Close a position or import your wallet history to start building your performance record.
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 px-4 pb-4">
                      <button
                        onClick={onImport}
                        className="group flex items-center gap-2.5 px-4 py-3 bg-cyan-500/8 border border-cyan-500/20 rounded-xl hover:bg-cyan-500/12 hover:border-cyan-500/35 transition-all text-left"
                      >
                        <Download className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-cyan-400">Import Wallet</p>
                          <p className="text-[10px] text-gray-600">Scan a Solana wallet for past swaps</p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-cyan-700 group-hover:text-cyan-500 group-hover:translate-x-0.5 transition-all ml-auto flex-shrink-0" />
                      </button>
                      <button
                        onClick={onLogTrade}
                        className="group flex items-center gap-2.5 px-4 py-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/12 hover:border-emerald-500/35 transition-all text-left"
                      >
                        <PlusCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-emerald-400">Log a Trade</p>
                          <p className="text-[10px] text-gray-600">Enter an entry and exit manually</p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-emerald-700 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all ml-auto flex-shrink-0" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
                    {closedTrades.slice(0, 6).map((trade) => (
                      <TradeCard key={trade.id} trade={trade} onClose={onCloseTrade} onDelete={onDeleteTrade} />
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Right panel: activity + watchlist */}
            <div className="space-y-4 min-w-0">
              <RecentActivityPanel trades={recentTrades} onLogTrade={onLogTrade} />
              <WatchlistPanel watchlist={watchlist} onAdd={onAddWatchlist} onDelete={onDeleteWatchlist} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatsCards({ openCount, closedCount, winRate, totalPnL, avgRR }) {
  const pnlPositive = totalPnL >= 0;
  const winRatePositive = parseFloat(winRate) >= 50;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {/* Open Positions */}
      <div className="relative overflow-hidden bg-[#12141a]/80 border border-gray-800/50 rounded-xl p-4 hover:border-cyan-500/20 hover:shadow-lg hover:shadow-cyan-500/5 transition-all duration-300 group">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/8 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Open</span>
            <div className="w-6 h-6 rounded-md bg-cyan-500/15 flex items-center justify-center">
              <AlertCircle className="w-3 h-3 text-cyan-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-cyan-400 leading-none mb-1">{openCount}</p>
          <p className="text-[10px] text-gray-600">positions</p>
        </div>
      </div>

      {/* Closed Trades */}
      <div className="relative overflow-hidden bg-[#12141a]/80 border border-gray-800/50 rounded-xl p-4 hover:border-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300 group">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/8 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Closed</span>
            <div className="w-6 h-6 rounded-md bg-emerald-500/15 flex items-center justify-center">
              <Target className="w-3 h-3 text-emerald-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-emerald-400 leading-none mb-1">{closedCount}</p>
          <p className="text-[10px] text-gray-600">trades</p>
        </div>
      </div>

      {/* Win Rate */}
      <div className={`relative overflow-hidden bg-[#12141a]/80 border border-gray-800/50 rounded-xl p-4 transition-all duration-300 group ${winRatePositive ? 'hover:border-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/5' : 'hover:border-red-500/20 hover:shadow-lg hover:shadow-red-500/5'}`}>
        <div className={`absolute inset-0 bg-gradient-to-br to-transparent opacity-0 group-hover:opacity-100 transition-opacity ${winRatePositive ? 'from-emerald-500/8' : 'from-red-500/8'}`} />
        <div className="relative">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Win Rate</span>
            <div className={`w-6 h-6 rounded-md flex items-center justify-center ${winRatePositive ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
              <TrendingUp className={`w-3 h-3 ${winRatePositive ? 'text-emerald-400' : 'text-red-400'}`} />
            </div>
          </div>
          <p className={`text-3xl font-bold leading-none mb-1 ${winRatePositive ? 'text-emerald-400' : 'text-red-400'}`}>{winRate}%</p>
          <p className="text-[10px] text-gray-600">closed trades</p>
        </div>
      </div>

      {/* Total P&L */}
      <div className={`relative overflow-hidden bg-[#12141a]/80 border border-gray-800/50 rounded-xl p-4 transition-all duration-300 group ${pnlPositive ? 'hover:border-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/5' : 'hover:border-red-500/20 hover:shadow-lg hover:shadow-red-500/5'}`}>
        <div className={`absolute inset-0 bg-gradient-to-br to-transparent opacity-0 group-hover:opacity-100 transition-opacity ${pnlPositive ? 'from-emerald-500/8' : 'from-red-500/8'}`} />
        <div className="relative">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Total P&L</span>
            <div className={`w-6 h-6 rounded-md flex items-center justify-center ${pnlPositive ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
              <DollarSign className={`w-3 h-3 ${pnlPositive ? 'text-emerald-400' : 'text-red-400'}`} />
            </div>
          </div>
          <p className={`text-3xl font-bold leading-none mb-1 ${pnlPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {pnlPositive ? '+' : ''}{totalPnL.toFixed(1)}%
          </p>
          <p className="text-[10px] text-gray-600">cumulative</p>
        </div>
      </div>

      {/* Avg R:R */}
      <div className="relative overflow-hidden bg-[#12141a]/80 border border-gray-800/50 rounded-xl p-4 hover:border-orange-500/20 hover:shadow-lg hover:shadow-orange-500/5 transition-all duration-300 group">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/8 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Avg R:R</span>
            <div className="w-6 h-6 rounded-md bg-orange-500/15 flex items-center justify-center">
              <BarChart3 className="w-3 h-3 text-orange-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-orange-400 leading-none mb-1">{avgRR}R</p>
          <p className="text-[10px] text-gray-600">risk/reward</p>
        </div>
      </div>
    </div>
  );
}

function TradeCard({ trade, onClose, onDelete }) {
  const setupType = SETUP_TYPES.find((s) => s.value === trade.setup_type);
  const pnl = trade.pnl || 0;
  const isOpen = trade.status === 'open';

  const handleClose = () => {
    const exitPrice = prompt('Enter exit price:');
    if (exitPrice && !isNaN(parseFloat(exitPrice))) {
      onClose(trade.id, parseFloat(exitPrice));
    }
  };

  const formatPrice = (price: number) => {
    if (price >= 1) return `$${price.toFixed(4)}`;
    if (price >= 0.0001) return `$${price.toFixed(6)}`;
    return `$${price.toFixed(9)}`;
  };

  return (
    <div className={`group relative bg-[#12141a]/80 border rounded-xl overflow-hidden transition-all duration-200 hover:translate-y-[-1px] ${
      isOpen
        ? 'border-cyan-500/20 hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-500/10'
        : pnl >= 0
        ? 'border-gray-800/50 hover:border-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/5'
        : 'border-gray-800/50 hover:border-red-500/20 hover:shadow-lg hover:shadow-red-500/5'
    }`}>
      {/* Top accent bar */}
      <div className={`h-0.5 w-full ${isOpen ? 'bg-gradient-to-r from-cyan-500/60 to-transparent' : pnl >= 0 ? 'bg-gradient-to-r from-emerald-500/50 to-transparent' : 'bg-gradient-to-r from-red-500/50 to-transparent'}`} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold ${
              isOpen ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20' : 'bg-gray-800/60 text-gray-300 border border-gray-700/50'
            }`}>
              {trade.token_name.slice(0, 2)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-sm leading-tight">{trade.token_name}</h3>
                {isOpen && <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse flex-shrink-0" />}
              </div>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] border mt-0.5 ${setupType?.color}`}>
                {setupType?.label}
              </span>
            </div>
          </div>

          {/* PnL badge for closed */}
          {!isOpen && (
            <div className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-bold ${
              pnl >= 0 ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/15 text-red-400 border border-red-500/20'
            }`}>
              {pnl >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              {pnl >= 0 ? '+' : ''}{pnl.toFixed(1)}%
            </div>
          )}
          {isOpen && (
            <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 bg-cyan-500/15 border border-cyan-500/25 rounded-lg text-[10px] text-cyan-400 font-semibold">
              LIVE
            </span>
          )}
        </div>

        {/* Price row */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-gray-900/50 rounded-lg px-2.5 py-2">
            <p className="text-[10px] text-gray-600 mb-0.5 uppercase tracking-wider">Entry</p>
            <p className="text-emerald-400 font-semibold text-xs">{formatPrice(trade.entry_price)}</p>
          </div>
          {trade.exit_price ? (
            <div className="bg-gray-900/50 rounded-lg px-2.5 py-2">
              <p className="text-[10px] text-gray-600 mb-0.5 uppercase tracking-wider">Exit</p>
              <p className="text-blue-400 font-semibold text-xs">{formatPrice(trade.exit_price)}</p>
            </div>
          ) : (
            <div className="bg-gray-900/50 rounded-lg px-2.5 py-2">
              <p className="text-[10px] text-gray-600 mb-0.5 uppercase tracking-wider">Target</p>
              <p className="text-cyan-400 font-semibold text-xs">{trade.take_profit ? formatPrice(trade.take_profit) : '—'}</p>
            </div>
          )}
        </div>

        {/* R:R + SL row */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            {trade.stop_loss && (
              <span className="text-red-400/80 text-[10px]">SL {formatPrice(trade.stop_loss)}</span>
            )}
            {!isOpen && trade.rr_ratio !== null && (
              <span className={`text-[10px] font-bold ${trade.rr_ratio >= 1 ? 'text-orange-400' : 'text-red-400'}`}>
                {trade.rr_ratio >= 0 ? '+' : ''}{trade.rr_ratio.toFixed(2)}R
              </span>
            )}
          </div>
          <span className="text-gray-600 text-[10px]">
            {new Date(trade.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>

        {/* Notes */}
        {trade.notes && (
          <p className="text-[10px] text-gray-500 mt-2.5 line-clamp-1 border-t border-gray-800/50 pt-2.5">{trade.notes}</p>
        )}
      </div>

      {/* Hover action bar */}
      <div className="px-4 pb-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200 -mt-1">
        {isOpen && (
          <button
            onClick={handleClose}
            className="flex-1 py-1.5 bg-blue-500/15 text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-500/25 transition-colors border border-blue-500/20 flex items-center justify-center gap-1.5"
          >
            <Target className="w-3 h-3" />
            Close Trade
          </button>
        )}
        <button
          onClick={() => onDelete(trade.id)}
          className="p-1.5 bg-red-500/15 text-red-400 rounded-lg hover:bg-red-500/25 transition-colors border border-red-500/20"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function RecentActivityPanel({ trades, onLogTrade }: { trades: Trade[]; onLogTrade: () => void }) {
  const formatPrice = (price: number) => {
    if (price >= 1) return `$${price.toFixed(4)}`;
    if (price >= 0.0001) return `$${price.toFixed(6)}`;
    return `$${price.toFixed(8)}`;
  };

  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (d > 0) return `${d}d ago`;
    if (h > 0) return `${h}h ago`;
    return 'recently';
  };

  return (
    <div className="bg-[#12141a]/80 border border-gray-800/50 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/50">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Recent Activity</span>
        </div>
        <span className="text-[10px] text-gray-600">{trades.length} trades</span>
      </div>

      <div className="divide-y divide-gray-800/40 max-h-72 overflow-y-auto scrollbar-thin">
        {trades.length === 0 ? (
          <div className="px-4 py-5 space-y-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-gray-700 flex-shrink-0" />
              <p className="text-xs font-semibold text-gray-500">No activity yet</p>
            </div>
            <p className="text-[11px] text-gray-700 leading-relaxed">
              This feed shows your recent trade events — opens, closes, and P&amp;L updates — as they happen.
            </p>
            <button
              onClick={onLogTrade}
              className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 hover:text-emerald-400 transition-colors"
            >
              <PlusCircle className="w-3 h-3 flex-shrink-0" />
              Log your first trade
            </button>
          </div>
        ) : (
          trades.map((trade) => {
            const setupType = SETUP_TYPES.find(s => s.value === trade.setup_type);
            const isOpen = trade.status === 'open';
            return (
              <div key={trade.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800/30 transition-colors">
                <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                  isOpen ? 'bg-cyan-500/15 text-cyan-400' : 'bg-gray-800/60 text-gray-400'
                }`}>
                  {trade.token_name.slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-white">{trade.token_name}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border ${setupType?.color}`}>{setupType?.label}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-gray-500">{formatPrice(trade.entry_price)}</span>
                    <span className="text-[10px] text-gray-700">{getTimeAgo(trade.created_at)}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {isOpen ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-cyan-400 font-semibold">
                      <span className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse" />
                      OPEN
                    </span>
                  ) : (
                    <span className={`text-xs font-bold ${(trade.pnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {(trade.pnl || 0) >= 0 ? '+' : ''}{(trade.pnl || 0).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function WatchlistPanel({ watchlist, onAdd, onDelete }: {
  watchlist: WatchlistItem[];
  onAdd: (item: Omit<WatchlistItem, 'id' | 'created_at'>) => void;
  onDelete: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ token_name: '', contract_address: '', notes: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.token_name.trim()) return;
    onAdd(form);
    setForm({ token_name: '', contract_address: '', notes: '' });
    setShowForm(false);
  };

  return (
    <div className="bg-[#12141a]/80 border border-gray-800/50 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/50">
        <div className="flex items-center gap-2">
          <Eye className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Watchlist</span>
        </div>
        <button
          onClick={() => setShowForm(p => !p)}
          className={`text-[10px] px-2 py-1 rounded border transition-colors font-medium ${showForm ? 'bg-gray-800/60 text-gray-400 border-gray-700' : 'bg-orange-500/15 text-orange-400 border-orange-500/30 hover:bg-orange-500/25'}`}
        >
          {showForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="p-3 border-b border-gray-800/50 space-y-2 bg-gray-900/30">
          <input
            type="text"
            placeholder="Token name (e.g. BONK)"
            value={form.token_name}
            onChange={e => setForm(p => ({ ...p, token_name: e.target.value }))}
            className="w-full bg-gray-900/60 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50 transition-colors"
            required
          />
          <input
            type="text"
            placeholder="Contract address (optional)"
            value={form.contract_address}
            onChange={e => setForm(p => ({ ...p, contract_address: e.target.value }))}
            className="w-full bg-gray-900/60 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 font-mono focus:outline-none focus:border-orange-500/50 transition-colors"
          />
          <input
            type="text"
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            className="w-full bg-gray-900/60 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50 transition-colors"
          />
          <button
            type="submit"
            className="w-full py-2 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-lg text-xs font-semibold hover:bg-orange-500/30 transition-colors"
          >
            Add to Watchlist
          </button>
        </form>
      )}

      <div className="divide-y divide-gray-800/40 max-h-64 overflow-y-auto scrollbar-thin">
        {watchlist.length === 0 && !showForm ? (
          <div className="px-4 py-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Eye className="w-3.5 h-3.5 text-orange-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-300">Track tokens before you trade</p>
                <p className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">
                  Add tokens you're watching to your watchlist. Monitor setups and jump in when the time is right.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="w-full py-2 bg-orange-500/15 text-orange-400 border border-orange-500/25 rounded-lg text-xs font-semibold hover:bg-orange-500/25 hover:border-orange-500/40 transition-all flex items-center justify-center gap-1.5"
            >
              <Star className="w-3.5 h-3.5" /> Add First Token
            </button>
          </div>
        ) : (
          watchlist.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 group hover:bg-gray-800/30 transition-colors">
              <div className="w-7 h-7 rounded-md bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-orange-400">{item.token_name.slice(0, 2)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white">{item.token_name}</p>
                {item.notes && <p className="text-[10px] text-gray-500 truncate">{item.notes}</p>}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {item.contract_address && (
                  <a
                    href={`https://solscan.io/account/${item.contract_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-gray-600 hover:text-cyan-400 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <button
                  onClick={() => onDelete(item.id)}
                  className="p-1 text-gray-600 hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TradeHistory({ trades, onCloseTrade, onDeleteTrade, onUpdateTrade }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [setupFilter, setSetupFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [resultFilter, setResultFilter] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'created_at',
    direction: 'desc',
  });
  

  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  const filteredAndSortedTrades = useMemo(() => {
    let result = [...trades];

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(trade =>
        trade.token_name.toLowerCase().includes(search) ||
        trade.contract_address.toLowerCase().includes(search)
      );
    }

    // Apply setup type filter
    if (setupFilter !== 'all') {
      result = result.filter(trade => trade.setup_type === setupFilter);
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter(trade => trade.status === statusFilter);
    }

    // Apply result filter (win/loss)
    if (resultFilter === 'win') {
      result = result.filter(trade => trade.status === 'closed' && (trade.pnl || 0) > 0);
    } else if (resultFilter === 'loss') {
      result = result.filter(trade => trade.status === 'closed' && (trade.pnl || 0) < 0);
    }

    // Apply sorting
    result.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortConfig.key) {
        case 'token_name':
          aValue = a.token_name.toLowerCase();
          bValue = b.token_name.toLowerCase();
          break;
        case 'pnl':
          aValue = a.pnl || 0;
          bValue = b.pnl || 0;
          break;
        case 'rr_ratio':
          aValue = a.rr_ratio || 0;
          bValue = b.rr_ratio || 0;
          break;
        case 'entry_price':
          aValue = a.entry_price;
          bValue = b.entry_price;
          break;
        case 'created_at':
        default:
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [trades, searchTerm, setupFilter, statusFilter, resultFilter, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  const exportToCSV = () => {
    const headers = [
      'Token Name',
      'Contract Address',
      'Entry Price',
      'Exit Price',
      'Stop Loss',
      'Take Profit',
      'Position Size',
      'Setup Type',
      'Status',
      'PnL %',
      'R:R',
      'Notes',
      'Created At',
    ];

    const csvContent = [
      headers.join(','),
      ...filteredAndSortedTrades.map(trade =>
        [
          trade.token_name,
          trade.contract_address,
          trade.entry_price,
          trade.exit_price || '',
          trade.stop_loss || '',
          trade.take_profit || '',
          trade.position_size,
          trade.setup_type,
          trade.status,
          trade.pnl?.toFixed(2) || '',
          trade.rr_ratio?.toFixed(2) || '',
          `"${(trade.notes || '').replace(/"/g, '""')}"`,
          trade.created_at,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `narrative_trades_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const formatPrice = (price: number) => {
    if (price >= 1) return `$${price.toFixed(4)}`;
    if (price >= 0.0001) return `$${price.toFixed(6)}`;
    return `$${price.toFixed(9)}`;
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig.key !== columnKey) return null;
    return sortConfig.direction === 'asc' ? (
      <ChevronUp className="w-3 h-3" />
    ) : (
      <ChevronDown className="w-3 h-3" />
    );
  };

  const activeFiltersCount = [
    statusFilter !== 'all',
    setupFilter !== 'all',
    resultFilter !== 'all',
    searchTerm !== ''
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-br from-[#12141a]/95 to-[#0d1017]/95 backdrop-blur-xl border border-gray-800/60 rounded-2xl p-5 sm:p-7 shadow-xl shadow-black/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-7">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/30 to-amber-500/20 flex items-center justify-center border border-orange-500/30">
              <History className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-0.5">Trade History</h2>
              <p className="text-sm text-gray-500">
                {filteredAndSortedTrades.length} {filteredAndSortedTrades.length === 1 ? 'trade' : 'trades'}
                {activeFiltersCount > 0 && (
                  <span className="ml-2 text-orange-400">({activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''} active)</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Stats */}
            <div className="hidden md:flex items-center gap-2 px-4 py-2.5 bg-gray-800/40 rounded-xl border border-gray-700/50">
              <span className="text-xs text-gray-500">Wins:</span>
              <span className="text-sm font-bold text-emerald-400">
                {filteredAndSortedTrades.filter(t => t.status === 'closed' && (t.pnl || 0) > 0).length}
              </span>
              <span className="text-gray-700 mx-1">|</span>
              <span className="text-xs text-gray-500">Losses:</span>
              <span className="text-sm font-bold text-red-400">
                {filteredAndSortedTrades.filter(t => t.status === 'closed' && (t.pnl || 0) < 0).length}
              </span>
            </div>

            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500/20 via-teal-500/20 to-emerald-500/20 border border-cyan-500/40 rounded-xl text-cyan-400 hover:from-cyan-500/30 hover:via-teal-500/30 hover:to-emerald-500/30 transition-all text-sm font-semibold shadow-lg shadow-cyan-500/10"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">Export</span>
            </button>
          </div>
        </div>

        {/* Search and Filters Section */}
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-cyan-400 transition-colors" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by token name or contract address..."
              className="w-full bg-gray-900/60 border border-gray-800/80 rounded-xl pl-12 pr-12 py-3.5 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all text-white placeholder-gray-600 text-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-gray-400">
              <Filter className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Filters</span>
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`bg-gray-900/60 border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all cursor-pointer ${
                statusFilter !== 'all'
                  ? 'border-cyan-500/50 bg-cyan-500/10'
                  : 'border-gray-800/80 hover:border-gray-700'
              }`}
            >
              <option value="all">All Status</option>
              <option value="open">Open Positions</option>
              <option value="closed">Closed Trades</option>
            </select>

            {/* Setup Type Filter */}
            <select
              value={setupFilter}
              onChange={(e) => setSetupFilter(e.target.value)}
              className={`bg-gray-900/60 border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all cursor-pointer ${
                setupFilter !== 'all'
                  ? 'border-orange-500/50 bg-orange-500/10'
                  : 'border-gray-800/80 hover:border-gray-700'
              }`}
            >
              <option value="all">All Setups</option>
              {SETUP_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>

            {/* Result Filter */}
            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              className={`bg-gray-900/60 border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all cursor-pointer ${
                resultFilter !== 'all'
                  ? 'border-emerald-500/50 bg-emerald-500/10'
                  : 'border-gray-800/80 hover:border-gray-700'
              }`}
            >
              <option value="all">All Results</option>
              <option value="win">Wins Only</option>
              <option value="loss">Losses Only</option>
            </select>

            {/* Clear Filters */}
            {activeFiltersCount > 0 && (
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setSetupFilter('all');
                  setResultFilter('all');
                  setSearchTerm('');
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-gray-400 hover:text-red-400 transition-colors rounded-xl hover:bg-red-500/10"
              >
                <XCircle className="w-4 h-4" />
                <span className="font-medium">Clear All</span>
              </button>
            )}
          </div>

          {/* Active Filter Tags */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-800/50">
              {statusFilter !== 'all' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/15 border border-cyan-500/30 rounded-lg text-xs text-cyan-400">
                  <span className="font-medium">Status:</span>
                  {statusFilter === 'open' ? 'Open' : 'Closed'}
                  <button onClick={() => setStatusFilter('all')} className="ml-1 hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {setupFilter !== 'all' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/15 border border-orange-500/30 rounded-lg text-xs text-orange-400">
                  <span className="font-medium">Setup:</span>
                  {SETUP_TYPES.find(t => t.value === setupFilter)?.label}
                  <button onClick={() => setSetupFilter('all')} className="ml-1 hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {resultFilter !== 'all' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-xs text-emerald-400">
                  <span className="font-medium">Result:</span>
                  {resultFilter === 'win' ? 'Wins' : 'Losses'}
                  <button onClick={() => setResultFilter('all')} className="ml-1 hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {searchTerm && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-xs text-gray-300">
                  <span className="font-medium">Search:</span>
                  "{searchTerm}"
                  <button onClick={() => setSearchTerm('')} className="ml-1 hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Trade Table */}
      <div className="bg-[#12141a]/90 backdrop-blur border border-gray-800/60 rounded-2xl overflow-hidden shadow-xl shadow-black/20">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800/80 bg-gray-900/40">
                <th
                  className="text-left py-4 px-5 font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('token_name')}
                >
                  <div className="flex items-center gap-2">
                    Token
                    <SortIcon columnKey="token_name" />
                  </div>
                </th>
                <th className="text-left py-4 px-5 font-semibold text-gray-300">Setup</th>
                <th
                  className="text-right py-4 px-5 font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('entry_price')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Entry
                    <SortIcon columnKey="entry_price" />
                  </div>
                </th>
                <th className="text-right py-4 px-5 font-semibold text-gray-300">Exit</th>
                <th
                  className="text-right py-4 px-5 font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('pnl')}
                >
                  <div className="flex items-center justify-end gap-2">
                    PnL %
                    <SortIcon columnKey="pnl" />
                  </div>
                </th>
                <th
                  className="text-right py-4 px-5 font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('rr_ratio')}
                >
                  <div className="flex items-center justify-end gap-2">
                    R:R
                    <SortIcon columnKey="rr_ratio" />
                  </div>
                </th>
                <th className="text-center py-4 px-5 font-semibold text-gray-300">Status</th>
                <th
                  className="text-left py-4 px-5 font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('created_at')}
                >
                  <div className="flex items-center gap-2">
                    Date
                    <SortIcon columnKey="created_at" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedTrades.map((trade, index) => {
                const setupType = SETUP_TYPES.find((s) => s.value === trade.setup_type);
                return (
                  <tr
                    key={trade.id}
                    onClick={() => setSelectedTrade(trade)}
                    className="border-b border-gray-800/40 hover:bg-gradient-to-r hover:from-cyan-500/5 hover:to-transparent cursor-pointer transition-all group"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center border border-gray-700/50 group-hover:border-cyan-500/30 transition-colors">
                          <span className="text-sm font-bold text-white">
                            {trade.token_name.slice(0, 2)}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-white group-hover:text-cyan-400 transition-colors">
                            {trade.token_name}
                          </p>
                          <p className="text-xs text-gray-500 font-mono truncate max-w-[120px]">
                            {trade.contract_address.slice(0, 8)}...{trade.contract_address.slice(-4)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-5">
                      <span className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${setupType?.color}`}>
                        {setupType?.label}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right">
                      <span className="text-emerald-400 font-semibold">{formatPrice(trade.entry_price)}</span>
                    </td>
                    <td className="py-4 px-5 text-right">
                      {trade.exit_price ? (
                        <span className="text-blue-400 font-semibold">{formatPrice(trade.exit_price)}</span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>
                    <td className="py-4 px-5 text-right">
                      {trade.status === 'closed' && trade.pnl !== null ? (
                        <div className="flex items-center justify-end gap-1.5">
                          {trade.pnl >= 0 ? (
                            <TrendingUp className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-red-400" />
                          )}
                          <span className={`font-bold ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>
                    <td className="py-4 px-5 text-right">
                      {trade.status === 'closed' && trade.rr_ratio !== null ? (
                        <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold ${
                          trade.rr_ratio >= 1
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : trade.rr_ratio >= 0
                            ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                            : 'bg-red-500/15 text-red-400 border border-red-500/30'
                        }`}>
                          {trade.rr_ratio >= 0 ? '+' : ''}{trade.rr_ratio.toFixed(2)}R
                        </span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>
                    <td className="py-4 px-5 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                        trade.status === 'open'
                          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                          : 'bg-gray-700/50 text-gray-400 border border-gray-600/30'
                      }`}>
                        {trade.status === 'open' && <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />}
                        {trade.status}
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-2 text-gray-400 text-xs">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(trade.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-gray-800/50">
          {filteredAndSortedTrades.map((trade) => {
            const setupType = SETUP_TYPES.find((s) => s.value === trade.setup_type);
            return (
              <div
                key={trade.id}
                onClick={() => setSelectedTrade(trade)}
                className="p-4 hover:bg-cyan-500/5 cursor-pointer transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center border border-gray-700/50">
                      <span className="text-sm font-bold text-white">
                        {trade.token_name.slice(0, 2)}
                      </span>
                    </div>
                    <div>
                      <p className="font-bold text-white text-base">{trade.token_name}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border mt-1 ${setupType?.color}`}>
                        {setupType?.label}
                      </span>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                    trade.status === 'open'
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'bg-gray-700/50 text-gray-400 border border-gray-600/30'
                  }`}>
                    {trade.status === 'open' && <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />}
                    {trade.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-gray-800/30 rounded-lg p-2.5">
                    <p className="text-xs text-gray-500 mb-1">Entry</p>
                    <p className="text-sm text-emerald-400 font-semibold">{formatPrice(trade.entry_price)}</p>
                  </div>
                  <div className="bg-gray-800/30 rounded-lg p-2.5">
                    <p className="text-xs text-gray-500 mb-1">Exit</p>
                    <p className="text-sm text-blue-400 font-semibold">
                      {trade.exit_price ? formatPrice(trade.exit_price) : '-'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">
                    {new Date(trade.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                  {trade.status === 'closed' && trade.pnl !== null && (
                    <div className="flex items-center gap-3">
                      {trade.rr_ratio !== null && (
                        <span className={`font-bold ${trade.rr_ratio >= 0 ? 'text-orange-400' : 'text-red-400'}`}>
                          {trade.rr_ratio >= 0 ? '+' : ''}{trade.rr_ratio.toFixed(2)}R
                        </span>
                      )}
                      <span className={`font-bold flex items-center gap-1 ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {trade.pnl >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredAndSortedTrades.length === 0 && (
          <div className="text-center py-16 px-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-800/50 to-gray-900/50 flex items-center justify-center mx-auto mb-5 border border-gray-700/50">
              <Search className="w-10 h-10 text-gray-600" />
            </div>
            <p className="text-gray-400 text-base mb-2">No trades found</p>
            <p className="text-gray-600 text-sm">Try adjusting your filters or add a new trade</p>
          </div>
        )}
      </div>

      {/* Trade Details Modal */}
      {selectedTrade && (
        <TradeDetailsModal
          trade={selectedTrade}
          onClose={() => setSelectedTrade(null)}
          onCloseTrade={onCloseTrade}
          onDelete={onDeleteTrade}
        />
      )}
    </div>
  );
}

function TradeDetailsModal({ trade, onClose, onCloseTrade, onDelete }) {
  const setupType = SETUP_TYPES.find((s) => s.value === trade.setup_type);
  const pnl = trade.pnl || 0;

  const formatPrice = (price: number) => {
    if (price >= 1) return `$${price.toFixed(4)}`;
    if (price >= 0.0001) return `$${price.toFixed(6)}`;
    return `$${price.toFixed(9)}`;
  };

  const handleClose = () => {
    const exitPrice = prompt('Enter exit price:');
    if (exitPrice && !isNaN(parseFloat(exitPrice))) {
      onCloseTrade(trade.id, parseFloat(exitPrice));
      onClose();
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Calculate potential P&L for open positions
  const calculatePotentialPnL = (targetPrice: number) => {
    return ((targetPrice - trade.entry_price) / trade.entry_price) * 100;
  };

  // Calculate potential R:R for open positions
  const calculatePotentialRR = (targetPrice: number) => {
    if (!trade.stop_loss) return 0;
    return Math.abs((targetPrice - trade.entry_price) / (trade.entry_price - trade.stop_loss));
  };

  return (
    <div
      className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-br from-[#12141a] to-[#0d1017] border border-gray-800/60 rounded-2xl max-w-3xl w-full my-8 shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-6 sm:p-8 border-b border-gray-800/50 bg-gradient-to-r from-gray-900/50 to-transparent">
          {/* Background gradient decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-cyan-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center border border-gray-700/50 shadow-lg">
                <span className="text-2xl font-bold text-white">
                  {trade.token_name.slice(0, 2)}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <h2 className="text-3xl font-bold text-white">{trade.token_name}</h2>
                  <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${setupType?.color}`}>
                    {setupType?.label}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                    trade.status === 'open'
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                      : 'bg-gray-700/50 text-gray-400 border border-gray-600/30'
                  }`}>
                    {trade.status === 'open' && <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />}
                    {trade.status === 'open' ? 'Open Position' : 'Closed Trade'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <div className="flex items-center gap-1.5 font-mono">
                    <Hash className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[200px]">{trade.contract_address}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(trade.contract_address)}
                    className="hover:text-cyan-400 transition-colors"
                    title="Copy address"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <a
                    href={`https://solscan.io/account/${trade.contract_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-emerald-400 transition-colors"
                    title="View on Solscan"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2.5 hover:bg-gray-800/80 rounded-xl transition-colors text-gray-500 hover:text-white border border-gray-800/50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Stats Bar */}
          <div className="relative mt-4 flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(trade.created_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            {trade.position_size > 0 && (
              <span className="flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5" />
                {trade.position_size} SOL position
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Price Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-xl p-4">
              <p className="text-gray-400 text-xs mb-2 uppercase tracking-wider font-medium">Entry Price</p>
              <p className="text-emerald-400 font-bold text-2xl">{formatPrice(trade.entry_price)}</p>
            </div>

            {trade.exit_price ? (
              <div className="bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20 rounded-xl p-4">
                <p className="text-gray-400 text-xs mb-2 uppercase tracking-wider font-medium">Exit Price</p>
                <p className="text-blue-400 font-bold text-2xl">{formatPrice(trade.exit_price)}</p>
              </div>
            ) : trade.status === 'open' ? (
              <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4">
                <p className="text-gray-400 text-xs mb-2 uppercase tracking-wider font-medium">Exit Price</p>
                <p className="text-gray-600 font-bold text-2xl">Open</p>
              </div>
            ) : null}

            {trade.stop_loss && (
              <div className="bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/20 rounded-xl p-4">
                <p className="text-gray-400 text-xs mb-2 uppercase tracking-wider font-medium">Stop Loss</p>
                <p className="text-red-400 font-bold text-2xl">{formatPrice(trade.stop_loss)}</p>
                {trade.status === 'open' && (
                  <p className="text-xs text-gray-500 mt-1">
                    Risk: {Math.abs(calculatePotentialPnL(trade.stop_loss)).toFixed(1)}%
                  </p>
                )}
              </div>
            )}

            {trade.take_profit && (
              <div className="bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/20 rounded-xl p-4">
                <p className="text-gray-400 text-xs mb-2 uppercase tracking-wider font-medium">Take Profit</p>
                <p className="text-cyan-400 font-bold text-2xl">{formatPrice(trade.take_profit)}</p>
                {trade.status === 'open' && (
                  <p className="text-xs text-emerald-400 mt-1">
                    Target: +{calculatePotentialPnL(trade.take_profit).toFixed(1)}%
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Results Section for Closed Trades */}
          {trade.status === 'closed' && (
            <div className="grid grid-cols-2 gap-4">
              <div className={`rounded-xl p-5 ${
                pnl >= 0
                  ? 'bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 border-2 border-emerald-500/30'
                  : 'bg-gradient-to-br from-red-500/15 to-red-500/5 border-2 border-red-500/30'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Profit/Loss</p>
                  {pnl >= 0 ? (
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-400" />
                  )}
                </div>
                <p className={`font-bold text-3xl ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
                </p>
              </div>

              {trade.rr_ratio !== null && (
                <div className={`rounded-xl p-5 border-2 ${
                  trade.rr_ratio >= 2
                    ? 'bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 border-emerald-500/30'
                    : trade.rr_ratio >= 1
                    ? 'bg-gradient-to-br from-orange-500/15 to-orange-500/5 border-orange-500/30'
                    : 'bg-gradient-to-br from-red-500/15 to-red-500/5 border-red-500/30'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Risk:Reward</p>
                    <BarChart3 className="w-5 h-5 text-orange-400" />
                  </div>
                  <p className={`font-bold text-3xl ${
                    trade.rr_ratio >= 2 ? 'text-emerald-400' :
                    trade.rr_ratio >= 1 ? 'text-orange-400' : 'text-red-400'
                  }`}>
                    {trade.rr_ratio >= 0 ? '+' : ''}{trade.rr_ratio.toFixed(2)}R
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {trade.rr_ratio >= 2 ? 'Excellent' : trade.rr_ratio >= 1 ? 'Good' : 'Poor'} R:R ratio
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Potential Results for Open Trades */}
          {trade.status === 'open' && trade.stop_loss && trade.take_profit && (
            <div className="bg-gray-800/20 border border-gray-800/50 rounded-xl p-5">
              <p className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <Target className="w-4 h-4 text-cyan-400" />
                Potential Outcomes
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">If stopped out</p>
                  <p className="text-lg font-bold text-red-400">
                    {calculatePotentialPnL(trade.stop_loss).toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">Risk: 1R</p>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">If target hit</p>
                  <p className="text-lg font-bold text-emerald-400">
                    +{calculatePotentialPnL(trade.take_profit).toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Reward: {calculatePotentialRR(trade.take_profit).toFixed(2)}R
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-700/50">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">R:R Ratio</span>
                  <span className={`font-bold ${calculatePotentialRR(trade.take_profit) >= 2 ? 'text-emerald-400' : 'text-orange-400'}`}>
                    1:{calculatePotentialRR(trade.take_profit).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Position Size */}
          {trade.position_size > 0 && (
            <div className="flex items-center justify-between bg-gray-800/30 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-cyan-400" />
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Position Size</p>
                  <p className="text-white font-bold text-xl">{trade.position_size} SOL</p>
                </div>
              </div>
              {trade.status === 'closed' && trade.exit_price && (
                <div className="text-right">
                  <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">PnL (SOL)</p>
                  <p className={`font-bold text-xl ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {pnl >= 0 ? '+' : ''}{(trade.position_size * (pnl / 100)).toFixed(3)} SOL
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Notes/Analysis */}
          {trade.notes && (
            <div className="bg-gray-800/20 border border-gray-800/50 rounded-xl p-5">
              <p className="text-gray-400 text-xs mb-3 uppercase tracking-wider font-medium flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5" />
                Trade Analysis
              </p>
              <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{trade.notes}</p>
            </div>
          )}

          {/* Screenshots */}
          {trade.screenshots.length > 0 && (
            <div>
              <p className="text-gray-400 text-xs mb-3 uppercase tracking-wider font-medium flex items-center gap-2">
                <ImageIcon className="w-3.5 h-3.5" />
                Screenshots ({trade.screenshots.length})
              </p>
              <div className="grid grid-cols-2 gap-3">
                {trade.screenshots.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative"
                  >
                    <img
                      src={url}
                      alt={`Screenshot ${i + 1}`}
                      className="rounded-xl bg-gray-800 w-full h-40 object-cover border border-gray-800 group-hover:border-cyan-500/50 transition-colors"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="96" fill="%23374151"><rect width="100%" height="100%"/></svg>';
                      }}
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                      <ExternalLink className="w-6 h-6 text-white" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-5 border-t border-gray-800/50">
            {trade.status === 'open' && (
              <button
                onClick={handleClose}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-400 px-6 py-4 rounded-xl font-semibold hover:from-blue-500/30 hover:to-cyan-500/30 transition-all border border-blue-500/30 shadow-lg shadow-blue-500/10"
              >
                <Target className="w-5 h-5" />
                Close Trade
              </button>
            )}
            <button
              onClick={() => {
                if (confirm('Are you sure you want to delete this trade? This action cannot be undone.')) {
                  onDelete(trade.id);
                  onClose();
                }
              }}
              className="flex items-center gap-2 px-5 py-4 bg-red-500/15 text-red-400 rounded-xl font-semibold hover:bg-red-500/25 transition-all border border-red-500/30"
            >
              <Trash2 className="w-5 h-5" />
              <span className="hidden sm:inline">Delete Trade</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddTradeForm({ onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    token_name: '',
    contract_address: '',
    entry_price: '',
    stop_loss: '',
    take_profit: '',
    position_size: '',
    setup_type: 'reclaim' as SetupType,
    notes: '',
    screenshots: [] as string[],
    status: 'open' as 'open' | 'closed',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      token_name: formData.token_name,
      contract_address: formData.contract_address,
      entry_price: parseFloat(formData.entry_price),
      stop_loss: formData.stop_loss ? parseFloat(formData.stop_loss) : null,
      take_profit: formData.take_profit ? parseFloat(formData.take_profit) : null,
      position_size: formData.position_size ? parseFloat(formData.position_size) : 0,
      setup_type: formData.setup_type,
      notes: formData.notes || null,
      screenshots: formData.screenshots,
      status: formData.status,
    });
    // Reset form
    setFormData({
      token_name: '',
      contract_address: '',
      entry_price: '',
      stop_loss: '',
      take_profit: '',
      position_size: '',
      setup_type: 'reclaim',
      notes: '',
      screenshots: [],
      status: 'open',
    });
  };

  const addScreenshot = () => {
    const url = prompt('Enter screenshot URL:');
    if (url && url.trim()) {
      setFormData({ ...formData, screenshots: [...formData.screenshots, url.trim()] });
    }
  };

  const removeScreenshot = (index: number) => {
    setFormData({
      ...formData,
      screenshots: formData.screenshots.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-[#12141a]/90 backdrop-blur border border-gray-800/60 rounded-2xl p-6 sm:p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <PlusCircle className="w-5 h-5 text-emerald-400" />
              </div>
              Log New Trade
            </h2>
            <p className="text-sm text-gray-500 mt-1 ml-13">Record your trade entry and setup details</p>
          </div>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-300 transition-colors p-2 hover:bg-gray-800/50 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Token Info Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Token Information</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2 font-medium">Token Name</label>
                <input
                  type="text"
                  value={formData.token_name}
                  onChange={(e) => setFormData({ ...formData, token_name: e.target.value })}
                  placeholder="e.g., BONK, WIF, PEPE"
                  className="w-full bg-gray-900/50 border border-gray-800 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500/50 focus:bg-gray-900/70 transition-all text-white placeholder-gray-600"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2 font-medium">Contract Address</label>
                <input
                  type="text"
                  value={formData.contract_address}
                  onChange={(e) => setFormData({ ...formData, contract_address: e.target.value })}
                  placeholder="Solana token address"
                  className="w-full bg-gray-900/50 border border-gray-800 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500/50 focus:bg-gray-900/70 transition-all font-mono text-sm text-white placeholder-gray-600"
                  required
                />
              </div>
            </div>
          </div>

          {/* Price Levels Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Price Levels</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2 font-medium">Entry Price *</label>
                <input
                  type="number"
                  step="any"
                  value={formData.entry_price}
                  onChange={(e) => setFormData({ ...formData, entry_price: e.target.value })}
                  placeholder="0.000000000"
                  className="w-full bg-gray-900/50 border border-gray-800 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500/50 focus:bg-gray-900/70 transition-all text-white placeholder-gray-600"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2 font-medium">Position Size (SOL)</label>
                <input
                  type="number"
                  step="any"
                  value={formData.position_size}
                  onChange={(e) => setFormData({ ...formData, position_size: e.target.value })}
                  placeholder="0.00"
                  className="w-full bg-gray-900/50 border border-gray-800 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500/50 focus:bg-gray-900/70 transition-all text-white placeholder-gray-600"
                />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2 font-medium">Stop Loss</label>
                <input
                  type="number"
                  step="any"
                  value={formData.stop_loss}
                  onChange={(e) => setFormData({ ...formData, stop_loss: e.target.value })}
                  placeholder="0.000000000"
                  className="w-full bg-gray-900/50 border border-gray-800 rounded-xl px-4 py-3 focus:outline-none focus:border-red-500/50 focus:bg-gray-900/70 transition-all text-white placeholder-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2 font-medium">Take Profit</label>
                <input
                  type="number"
                  step="any"
                  value={formData.take_profit}
                  onChange={(e) => setFormData({ ...formData, take_profit: e.target.value })}
                  placeholder="0.000000000"
                  className="w-full bg-gray-900/50 border border-gray-800 rounded-xl px-4 py-3 focus:outline-none focus:border-cyan-500/50 focus:bg-gray-900/70 transition-all text-white placeholder-gray-600"
                />
              </div>
            </div>
          </div>

          {/* Setup Type Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Setup Type</h3>
            <div className="flex flex-wrap gap-2">
              {SETUP_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, setup_type: type.value })}
                  className={`px-4 py-2.5 rounded-xl border transition-all duration-200 font-medium text-sm ${
                    formData.setup_type === type.value
                      ? `${type.color} shadow-lg`
                      : 'border-gray-800 text-gray-500 hover:border-gray-700 hover:text-gray-400'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Analysis</h3>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Trade analysis, entry reasoning, lessons learned..."
              className="w-full bg-gray-900/50 border border-gray-800 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500/50 focus:bg-gray-900/70 transition-all min-h-[120px] resize-y text-white placeholder-gray-600"
            />
          </div>

          {/* Screenshots Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Screenshots</h3>
            <div className="flex flex-wrap gap-3">
              {formData.screenshots.map((url, i) => (
                <div key={i} className="relative group">
                  <img
                    src={url}
                    alt={`Screenshot ${i + 1}`}
                    className="h-24 w-32 object-cover rounded-xl bg-gray-800 border border-gray-800"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="96" fill="%23374151"><rect width="100%" height="100%"/></svg>';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => removeScreenshot(i)}
                    className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addScreenshot}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-900/50 border border-dashed border-gray-700 rounded-xl text-gray-500 hover:border-emerald-500/50 hover:text-emerald-400 transition-all duration-200"
            >
              <ImageIcon className="w-4 h-4" />
              <span className="text-sm font-medium">Add Screenshot URL</span>
            </button>
          </div>

          {/* Submit Section */}
          <div className="flex gap-3 pt-4 border-t border-gray-800/50">
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-6 py-3.5 rounded-xl font-semibold hover:from-emerald-400 hover:to-teal-400 transition-all duration-200 shadow-lg shadow-emerald-500/20"
            >
              <Save className="w-4 h-4" />
              Save Trade
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3.5 border border-gray-800 rounded-xl text-gray-400 hover:border-gray-700 hover:text-gray-200 transition-all duration-200 font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


const SETUP_BAR_COLORS: Record<string, string> = {
  reclaim: '#22d3ee',
  support_bounce: '#34d399',
  breakout: '#60a5fa',
  momentum_scalp: '#fb923c',
  avoid: '#f87171',
};

// ─── Analytics ──────────────────────────────────────────────────────────────
function Analytics({ trades, closedTrades, winRate, totalPnL, avgRR }) {
  const [activeSetup, setActiveSetup] = useState<string | null>(null);

  // ── derived stats ──────────────────────────────────────────────────────────
  const wins = closedTrades.filter((t: Trade) => (t.pnl || 0) > 0);
  const losses = closedTrades.filter((t: Trade) => (t.pnl || 0) < 0);

  // Per-setup full stats
  const setupStats = useMemo(() => SETUP_TYPES.map((type) => {
    const typeTrades: Trade[] = closedTrades.filter((t: Trade) => t.setup_type === type.value);
    const typeWins = typeTrades.filter((t: Trade) => (t.pnl || 0) > 0);
    const totalPnlSum = typeTrades.reduce((s: number, t: Trade) => s + (t.pnl || 0), 0);
    const totalRR = typeTrades.reduce((s: number, t: Trade) => s + (t.rr_ratio || 0), 0);
    const wr = typeTrades.length > 0 ? (typeWins.length / typeTrades.length) * 100 : 0;
    const avgPnl = typeTrades.length > 0 ? totalPnlSum / typeTrades.length : 0;
    const avgRr = typeTrades.length > 0 ? totalRR / typeTrades.length : 0;
    return {
      ...type,
      total: typeTrades.length,
      wins: typeWins.length,
      losses: typeTrades.length - typeWins.length,
      winRate: wr,
      avgPnl,
      avgRR: avgRr,
      totalPnl: totalPnlSum,
      color: SETUP_BAR_COLORS[type.value],
    };
  }), [closedTrades]);

  // Best/worst setups by avg PnL (with at least 1 trade)
  const activeSetups = setupStats.filter(s => s.total > 0);
  const bestSetup = activeSetups.length > 0
    ? activeSetups.reduce((a, b) => a.avgPnl > b.avgPnl ? a : b)
    : null;
  const worstSetup = activeSetups.length > 0
    ? activeSetups.reduce((a, b) => a.avgPnl < b.avgPnl ? a : b)
    : null;

  // Best / worst individual trades
  const bestTrade: Trade | null = closedTrades.length > 0
    ? closedTrades.reduce((a: Trade, b: Trade) => (a.pnl || 0) > (b.pnl || 0) ? a : b)
    : null;
  const worstTrade: Trade | null = closedTrades.length > 0
    ? closedTrades.reduce((a: Trade, b: Trade) => (a.pnl || 0) < (b.pnl || 0) ? a : b)
    : null;

  // Win/loss streak from most recent trades
  const { currentStreak, longestWinStreak, longestLossStreak } = useMemo(() => {
    const sorted = [...closedTrades].sort(
      (a: Trade, b: Trade) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    let cur = 0;
    let curType: 'W' | 'L' | null = null;
    let lwStreak = 0, llStreak = 0, wRun = 0, lRun = 0;
    for (const t of sorted) {
      const isWin = (t.pnl || 0) > 0;
      if (cur === 0) { curType = isWin ? 'W' : 'L'; cur = 1; }
      else if ((curType === 'W') === isWin) cur++;
      else break;
    }
    for (const t of sorted) {
      if ((t.pnl || 0) > 0) { wRun++; lwStreak = Math.max(lwStreak, wRun); lRun = 0; }
      else { lRun++; llStreak = Math.max(llStreak, lRun); wRun = 0; }
    }
    return { currentStreak: { count: cur, type: curType }, longestWinStreak: lwStreak, longestLossStreak: llStreak };
  }, [closedTrades]);

  // Cumulative PnL curve (sorted ascending)
  const pnlCurve = useMemo(() => {
    const sorted = [...closedTrades].sort(
      (a: Trade, b: Trade) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    let cum = 0;
    return sorted.map((t: Trade, i: number) => {
      cum += (t.pnl || 0);
      return { trade: i + 1, pnl: parseFloat(cum.toFixed(2)), token: t.token_name };
    });
  }, [closedTrades]);

  // Bar chart data for setup comparison
  const setupBarData = setupStats.map(s => ({
    name: s.label,
    winRate: parseFloat(s.winRate.toFixed(1)),
    avgPnl: parseFloat(s.avgPnl.toFixed(1)),
    avgRR: parseFloat(s.avgRR.toFixed(2)),
    total: s.total,
    fill: s.color,
  }));

  // Day-of-week performance
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayStats = useMemo(() => DAYS.map((day, idx) => {
    const dayTrades: Trade[] = closedTrades.filter((t: Trade) => new Date(t.created_at).getDay() === idx);
    const dayWins = dayTrades.filter((t: Trade) => (t.pnl || 0) > 0);
    const avgP = dayTrades.length > 0
      ? dayTrades.reduce((s: number, t: Trade) => s + (t.pnl || 0), 0) / dayTrades.length
      : 0;
    return {
      day,
      trades: dayTrades.length,
      winRate: dayTrades.length > 0 ? parseFloat(((dayWins.length / dayTrades.length) * 100).toFixed(1)) : 0,
      avgPnl: parseFloat(avgP.toFixed(1)),
    };
  }), [closedTrades]);

  // Hour-of-day performance (0–23 bucketed into 6 blocks)
  const HOUR_LABELS = ['00–04', '04–08', '08–12', '12–16', '16–20', '20–24'];
  const hourStats = useMemo(() => HOUR_LABELS.map((label, idx) => {
    const lo = idx * 4, hi = lo + 4;
    const block: Trade[] = closedTrades.filter((t: Trade) => {
      const h = new Date(t.created_at).getHours();
      return h >= lo && h < hi;
    });
    const bWins = block.filter((t: Trade) => (t.pnl || 0) > 0);
    const avgP = block.length > 0
      ? block.reduce((s: number, t: Trade) => s + (t.pnl || 0), 0) / block.length
      : 0;
    return {
      label,
      trades: block.length,
      winRate: block.length > 0 ? parseFloat(((bWins.length / block.length) * 100).toFixed(1)) : 0,
      avgPnl: parseFloat(avgP.toFixed(1)),
    };
  }), [closedTrades]);

  // Market-cap buckets inferred from entry price
  const MC_BUCKETS = [
    { label: 'Micro (<$0.0001)', test: (p: number) => p < 0.0001 },
    { label: 'Small ($0.0001–$0.01)', test: (p: number) => p >= 0.0001 && p < 0.01 },
    { label: 'Mid ($0.01–$1)', test: (p: number) => p >= 0.01 && p < 1 },
    { label: 'Large (>$1)', test: (p: number) => p >= 1 },
  ];
  const mcStats = useMemo(() => MC_BUCKETS.map(b => {
    const bTrades: Trade[] = closedTrades.filter((t: Trade) => b.test(t.entry_price));
    const bWins = bTrades.filter((t: Trade) => (t.pnl || 0) > 0);
    const avgP = bTrades.length > 0
      ? bTrades.reduce((s: number, t: Trade) => s + (t.pnl || 0), 0) / bTrades.length
      : 0;
    return {
      label: b.label,
      trades: bTrades.length,
      winRate: bTrades.length > 0 ? parseFloat(((bWins.length / bTrades.length) * 100).toFixed(1)) : 0,
      avgPnl: parseFloat(avgP.toFixed(1)),
    };
  }), [closedTrades]);

  // Radar data for selected or all setups
  const radarData = setupStats.map(s => ({
    subject: s.label,
    winRate: parseFloat(s.winRate.toFixed(1)),
    avgPnl: Math.max(0, parseFloat(s.avgPnl.toFixed(1))),
    avgRR: Math.max(0, parseFloat(s.avgRR.toFixed(2))) * 20,
    trades: s.total * 10,
    fullMark: 100,
  }));

  const noData = closedTrades.length === 0;

  return (
    <div className="space-y-5">
      {/* ── Section header ─────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            Setup Performance Analytics
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {closedTrades.length} closed trades · {trades.filter((t: Trade) => t.status === 'open').length} open
          </p>
        </div>
      </div>

      {/* ── Top KPI row ────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Total Trades" value={trades.length} sub="all time" color="text-white" icon={<Layers className="w-3.5 h-3.5" />} />
        <KpiCard label="Win Rate" value={`${winRate}%`} sub={`${wins.length}W / ${losses.length}L`} color={parseFloat(winRate) >= 50 ? 'text-emerald-400' : 'text-red-400'} icon={<Percent className="w-3.5 h-3.5" />} />
        <KpiCard label="Total P&L" value={`${totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(1)}%`} sub="cumulative" color={totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'} icon={<DollarSign className="w-3.5 h-3.5" />} />
        <KpiCard label="Avg R:R" value={`${avgRR}R`} sub="per closed trade" color="text-orange-400" icon={<Target className="w-3.5 h-3.5" />} />
        <KpiCard
          label="Current Streak"
          value={currentStreak.count > 0 ? `${currentStreak.count}${currentStreak.type}` : '—'}
          sub={currentStreak.type === 'W' ? 'wins running' : currentStreak.type === 'L' ? 'losses running' : 'no data'}
          color={currentStreak.type === 'W' ? 'text-emerald-400' : currentStreak.type === 'L' ? 'text-red-400' : 'text-gray-500'}
          icon={<Flame className="w-3.5 h-3.5" />}
        />
        <KpiCard label="Best Streak" value={`${longestWinStreak}W`} sub={`worst: ${longestLossStreak}L`} color="text-emerald-400" icon={<Award className="w-3.5 h-3.5" />} />
      </div>

      {/* ── Best/Worst setup highlight ─────────────────────── */}
      {(bestSetup || worstSetup) && (
        <div className="grid sm:grid-cols-2 gap-3">
          {bestSetup && (
            <div className="relative overflow-hidden bg-[#12141a]/80 border border-emerald-500/25 rounded-xl p-4 flex items-center gap-4">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/8 to-transparent pointer-events-none" />
              <div className="w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-emerald-400 uppercase tracking-widest font-semibold mb-0.5">Most Profitable Setup</p>
                <p className="text-white font-bold text-base">{bestSetup.label}</p>
                <p className="text-xs text-gray-500">{bestSetup.total} trades · {bestSetup.winRate.toFixed(0)}% win rate</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-emerald-400 font-bold text-xl">+{bestSetup.avgPnl.toFixed(1)}%</p>
                <p className="text-[10px] text-gray-600">avg PnL</p>
              </div>
            </div>
          )}
          {worstSetup && (
            <div className="relative overflow-hidden bg-[#12141a]/80 border border-red-500/25 rounded-xl p-4 flex items-center gap-4">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/8 to-transparent pointer-events-none" />
              <div className="w-10 h-10 rounded-lg bg-red-500/15 border border-red-500/25 flex items-center justify-center flex-shrink-0">
                <TrendingDown className="w-5 h-5 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-red-400 uppercase tracking-widest font-semibold mb-0.5">Worst Performing Setup</p>
                <p className="text-white font-bold text-base">{worstSetup.label}</p>
                <p className="text-xs text-gray-500">{worstSetup.total} trades · {worstSetup.winRate.toFixed(0)}% win rate</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-red-400 font-bold text-xl">{worstSetup.avgPnl.toFixed(1)}%</p>
                <p className="text-[10px] text-gray-600">avg PnL</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Setup deep-dive cards ──────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {setupStats.map(s => {
          const isSelected = activeSetup === s.value;
          return (
            <button
              key={s.value}
              onClick={() => setActiveSetup(isSelected ? null : s.value)}
              className={`text-left bg-[#12141a]/80 border rounded-xl p-4 transition-all duration-200 hover:translate-y-[-1px] ${
                isSelected
                  ? 'border-opacity-80 shadow-lg'
                  : 'border-gray-800/50 hover:border-gray-700/70'
              }`}
              style={isSelected ? { borderColor: s.color + 'aa', boxShadow: `0 8px 32px ${s.color}20` } : {}}
            >
              <div className="h-1 rounded-full mb-3" style={{ backgroundColor: s.color + '80' }} />
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold border px-2 py-0.5 rounded ${SETUP_TYPES.find(x => x.value === s.value)?.color}`}>
                  {s.label}
                </span>
                <span className="text-[10px] text-gray-600">{s.total} trades</span>
              </div>
              {s.total === 0 ? (
                <p className="text-gray-600 text-xs mt-3">No data</p>
              ) : (
                <div className="space-y-2 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">Win Rate</span>
                    <span className={`text-sm font-bold ${s.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{s.winRate.toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-1 bg-gray-800/60 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${s.winRate}%`, backgroundColor: s.winRate >= 50 ? '#34d399' : '#f87171' }} />
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">Avg PnL</span>
                    <span className={`text-sm font-bold ${s.avgPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{s.avgPnl >= 0 ? '+' : ''}{s.avgPnl.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">Avg R:R</span>
                    <span className="text-sm font-bold text-orange-400">{s.avgRR.toFixed(2)}R</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-600 pt-1 border-t border-gray-800/50">
                    <span className="text-emerald-500">{s.wins}W</span>
                    <span className="text-red-500">{s.losses}L</span>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Charts row 1: Win rate bar + Avg PnL bar ──────── */}
      <div className="grid md:grid-cols-2 gap-4">
        <ChartCard title="Win Rate by Setup" subtitle="% of winning closed trades">
          {noData ? <EmptyChartState /> : (
            <CSSBarChart
              data={setupBarData}
              valueKey="winRate"
              labelKey="name"
              height={200}
              maxValue={100}
              referenceValue={50}
              formatValue={v => `${v}%`}
              colorFn={entry => entry.total > 0 ? entry.fill : 'rgba(255,255,255,0.1)'}
            />
          )}
        </ChartCard>

        <ChartCard title="Avg PnL by Setup" subtitle="Average % return per trade">
          {noData ? <EmptyChartState /> : (
            <CSSBarChart
              data={setupBarData}
              valueKey="avgPnl"
              labelKey="name"
              height={200}
              referenceValue={0}
              formatValue={v => `${v >= 0 ? '+' : ''}${v}%`}
              colorFn={entry => entry.avgPnl >= 0 ? '#34d399' : '#f87171'}
              bipolar
            />
          )}
        </ChartCard>
      </div>

      {/* ── Charts row 2: Avg R:R bar + Cumulative PnL curve */}
      <div className="grid md:grid-cols-2 gap-4">
        <ChartCard title="Avg R:R by Setup" subtitle="Risk-reward ratio per setup">
          {noData ? <EmptyChartState /> : (
            <CSSBarChart
              data={setupBarData}
              valueKey="avgRR"
              labelKey="name"
              height={200}
              referenceValue={1}
              formatValue={v => `${v}R`}
              colorFn={entry => entry.total > 0 ? '#fb923c' : 'rgba(255,255,255,0.1)'}
            />
          )}
        </ChartCard>

        <ChartCard title="Cumulative P&L" subtitle="Running total across closed trades">
          {pnlCurve.length < 2 ? <EmptyChartState msg="Need 2+ closed trades" /> : (
            <CSSLineChart data={pnlCurve} height={200} />
          )}
        </ChartCard>
      </div>

      {/* ── Win/Loss streaks visual ────────────────────────── */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div className={`bg-[#12141a]/80 border rounded-xl p-4 flex items-center gap-4 ${currentStreak.type === 'W' ? 'border-emerald-500/25' : currentStreak.type === 'L' ? 'border-red-500/25' : 'border-gray-800/50'}`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${currentStreak.type === 'W' ? 'bg-emerald-500/15' : currentStreak.type === 'L' ? 'bg-red-500/15' : 'bg-gray-800/40'}`}>
            <Flame className={`w-6 h-6 ${currentStreak.type === 'W' ? 'text-emerald-400' : currentStreak.type === 'L' ? 'text-red-400' : 'text-gray-600'}`} />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Current Streak</p>
            <p className={`text-2xl font-bold ${currentStreak.type === 'W' ? 'text-emerald-400' : currentStreak.type === 'L' ? 'text-red-400' : 'text-gray-600'}`}>
              {currentStreak.count > 0 ? `${currentStreak.count} ${currentStreak.type === 'W' ? 'Wins' : 'Losses'}` : '—'}
            </p>
            <p className="text-[10px] text-gray-600">in a row</p>
          </div>
        </div>
        <div className="bg-[#12141a]/80 border border-emerald-500/15 rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
            <Award className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Best Win Streak</p>
            <p className="text-2xl font-bold text-emerald-400">{longestWinStreak} Wins</p>
            <p className="text-[10px] text-gray-600">longest run</p>
          </div>
        </div>
        <div className="bg-[#12141a]/80 border border-red-500/15 rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
            <TrendingDown className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Worst Loss Streak</p>
            <p className="text-2xl font-bold text-red-400">{longestLossStreak} Losses</p>
            <p className="text-[10px] text-gray-600">longest run</p>
          </div>
        </div>
      </div>

      {/* ── Best / Worst individual trades ────────────────── */}
      <div className="grid sm:grid-cols-2 gap-3">
        {bestTrade && (
          <div className="bg-[#12141a]/80 border border-emerald-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-widest">Best Trade</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-bold text-base">{bestTrade.token_name}</p>
                <p className="text-xs text-gray-500">{SETUP_TYPES.find(s => s.value === bestTrade.setup_type)?.label} · {new Date(bestTrade.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
              </div>
              <div className="text-right">
                <p className="text-emerald-400 font-bold text-2xl">+{bestTrade.pnl?.toFixed(1)}%</p>
                {bestTrade.rr_ratio !== null && <p className="text-xs text-orange-400">{bestTrade.rr_ratio.toFixed(2)}R</p>}
              </div>
            </div>
          </div>
        )}
        {worstTrade && (
          <div className="bg-[#12141a]/80 border border-red-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="w-4 h-4 text-red-400" />
              <span className="text-[10px] text-red-400 font-semibold uppercase tracking-widest">Worst Trade</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-bold text-base">{worstTrade.token_name}</p>
                <p className="text-xs text-gray-500">{SETUP_TYPES.find(s => s.value === worstTrade.setup_type)?.label} · {new Date(worstTrade.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
              </div>
              <div className="text-right">
                <p className="text-red-400 font-bold text-2xl">{worstTrade.pnl?.toFixed(1)}%</p>
                {worstTrade.rr_ratio !== null && <p className="text-xs text-orange-400">{worstTrade.rr_ratio.toFixed(2)}R</p>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Day of week + Hour heatmaps ────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">
        <ChartCard title="Performance by Day" subtitle="Avg PnL by day of week">
          {noData ? <EmptyChartState /> : (
            <CSSBarChart
              data={dayStats}
              valueKey="avgPnl"
              labelKey="day"
              height={180}
              referenceValue={0}
              formatValue={v => `${v >= 0 ? '+' : ''}${v}%`}
              colorFn={entry => entry.trades > 0 ? (entry.avgPnl >= 0 ? '#34d399' : '#f87171') : 'rgba(255,255,255,0.1)'}
              bipolar
            />
          )}
        </ChartCard>

        <ChartCard title="Performance by Hour (UTC)" subtitle="Avg PnL by time block">
          {noData ? <EmptyChartState /> : (
            <CSSBarChart
              data={hourStats}
              valueKey="avgPnl"
              labelKey="label"
              height={180}
              referenceValue={0}
              formatValue={v => `${v >= 0 ? '+' : ''}${v}%`}
              colorFn={entry => entry.trades > 0 ? (entry.avgPnl >= 0 ? '#60a5fa' : '#f87171') : 'rgba(255,255,255,0.1)'}
              bipolar
            />
          )}
        </ChartCard>
      </div>

      {/* ── Market-cap range table ─────────────────────────── */}
      <ChartCard title="Performance by Price Range" subtitle="Grouped by token entry price (proxy for market cap)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800/60">
                {['Price Range', 'Trades', 'Win Rate', 'Avg PnL', 'Signal'].map(h => (
                  <th key={h} className="text-left py-2.5 px-3 text-[10px] text-gray-500 uppercase tracking-widest font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mcStats.map((row, i) => (
                <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-800/20 transition-colors">
                  <td className="py-3 px-3 text-xs text-gray-300 font-medium">{row.label}</td>
                  <td className="py-3 px-3 text-xs text-gray-400">{row.trades}</td>
                  <td className="py-3 px-3">
                    {row.trades > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-800/60 rounded-full overflow-hidden w-16">
                          <div className="h-full rounded-full" style={{ width: `${row.winRate}%`, backgroundColor: row.winRate >= 50 ? '#34d399' : '#f87171' }} />
                        </div>
                        <span className={`text-xs font-bold ${row.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{row.winRate}%</span>
                      </div>
                    ) : <span className="text-gray-700 text-xs">—</span>}
                  </td>
                  <td className="py-3 px-3">
                    {row.trades > 0 ? (
                      <span className={`text-xs font-bold ${row.avgPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {row.avgPnl >= 0 ? '+' : ''}{row.avgPnl}%
                      </span>
                    ) : <span className="text-gray-700 text-xs">—</span>}
                  </td>
                  <td className="py-3 px-3">
                    {row.trades >= 3 ? (
                      <span className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${row.avgPnl >= 10 ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : row.avgPnl >= 0 ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' : 'bg-red-500/15 text-red-400 border-red-500/30'}`}>
                        {row.avgPnl >= 10 ? 'Strong' : row.avgPnl >= 0 ? 'Neutral' : 'Weak'}
                      </span>
                    ) : <span className="text-gray-700 text-xs">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {noData && (
            <div className="py-8 text-center text-gray-600 text-sm">No closed trades yet</div>
          )}
        </div>
      </ChartCard>

      {/* ── Setup radar chart ──────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">
        <ChartCard title="Setup Radar" subtitle="Multi-dimensional setup comparison (win rate / avg PnL / avg R:R)">
          {noData || activeSetups.length < 2 ? <EmptyChartState msg="Need trades across 2+ setups" /> : (
            <SVGRadarChart data={radarData} height={260} />
          )}
        </ChartCard>

        {/* Win/Loss ratio per setup visual */}
        <ChartCard title="Win / Loss Breakdown" subtitle="Wins vs losses per setup type">
          {noData ? <EmptyChartState /> : (
            <div className="space-y-3 mt-2">
              {setupStats.filter(s => s.total > 0).map(s => (
                <div key={s.value}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] font-semibold border px-1.5 py-0.5 rounded ${SETUP_TYPES.find(x => x.value === s.value)?.color}`}>{s.label}</span>
                    <span className="text-[10px] text-gray-500">{s.wins}W · {s.losses}L · {s.total} total</span>
                  </div>
                  <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-800/50 border border-gray-800/40">
                    {s.wins > 0 && (
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                        style={{ width: `${(s.wins / s.total) * 100}%` }}
                      />
                    )}
                    {s.losses > 0 && (
                      <div
                        className="h-full bg-gradient-to-r from-red-500 to-red-400 transition-all duration-500"
                        style={{ width: `${(s.losses / s.total) * 100}%` }}
                      />
                    )}
                  </div>
                </div>
              ))}
              {activeSetups.length === 0 && (
                <p className="text-gray-600 text-xs text-center py-4">No closed trades yet</p>
              )}
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

// ─── custom chart components ─────────────────────────────────────────────────

interface CSSBarChartEntry {
  [key: string]: string | number;
}

function CSSBarChart({
  data,
  valueKey,
  labelKey,
  height = 200,
  maxValue,
  referenceValue,
  formatValue,
  colorFn,
  bipolar = false,
}: {
  data: CSSBarChartEntry[];
  valueKey: string;
  labelKey: string;
  height?: number;
  maxValue?: number;
  referenceValue?: number;
  formatValue?: (v: number) => string;
  colorFn: (entry: CSSBarChartEntry) => string;
  bipolar?: boolean;
}) {
  const [tooltip, setTooltip] = useState<{ idx: number; x: number; y: number } | null>(null);
  const values = data.map(d => d[valueKey] as number);
  const absValues = values.map(Math.abs);
  const maxAbs = maxValue !== undefined ? maxValue : Math.max(...absValues, 0.01);
  const posMax = bipolar ? Math.max(...values.filter(v => v >= 0), 0.01) : maxAbs;
  const negMax = bipolar ? Math.max(...values.filter(v => v < 0).map(Math.abs), 0.01) : 0;

  const BAR_AREA_HEIGHT = height - 36;
  const posAreaH = bipolar ? Math.round(BAR_AREA_HEIGHT * (posMax / (posMax + negMax))) : BAR_AREA_HEIGHT;
  const negAreaH = bipolar ? BAR_AREA_HEIGHT - posAreaH : 0;

  return (
    <div className="relative select-none" style={{ height }}>
      <div className="flex items-end gap-1 h-full pb-6">
        {data.map((entry, i) => {
          const val = entry[valueKey] as number;
          const isNeg = val < 0;
          const barH = bipolar
            ? isNeg
              ? Math.round((Math.abs(val) / (negMax || 1)) * negAreaH)
              : Math.round((val / (posMax || 1)) * posAreaH)
            : Math.round((Math.abs(val) / maxAbs) * BAR_AREA_HEIGHT);
          const color = colorFn(entry);

          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center cursor-pointer group"
              onMouseEnter={e => setTooltip({ idx: i, x: e.currentTarget.getBoundingClientRect().left, y: e.currentTarget.getBoundingClientRect().top })}
              onMouseLeave={() => setTooltip(null)}
            >
              {/* positive bar area */}
              <div className="w-full flex flex-col justify-end" style={{ height: posAreaH }}>
                {!isNeg && (
                  <div
                    className="w-full rounded-t-sm transition-all duration-300 group-hover:brightness-110"
                    style={{ height: barH, backgroundColor: color, minHeight: barH > 0 ? 2 : 0 }}
                  />
                )}
              </div>
              {/* negative bar area */}
              {bipolar && (
                <div className="w-full flex flex-col justify-start" style={{ height: negAreaH }}>
                  {isNeg && (
                    <div
                      className="w-full rounded-b-sm transition-all duration-300 group-hover:brightness-110"
                      style={{ height: barH, backgroundColor: color, minHeight: barH > 0 ? 2 : 0 }}
                    />
                  )}
                </div>
              )}
              {/* label */}
              <div className="mt-1 text-center" style={{ height: 20 }}>
                <span className="text-[9px] text-gray-500 leading-none block truncate w-full text-center">
                  {String(entry[labelKey]).replace(' ', '\u00A0').substring(0, 8)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* reference line */}
      {referenceValue !== undefined && (() => {
        const fromBottom = bipolar
          ? 20 + negAreaH + Math.round((Math.max(0, referenceValue) / (posMax || 1)) * posAreaH)
          : 20 + Math.round((1 - referenceValue / maxAbs) * BAR_AREA_HEIGHT);
        return (
          <div
            className="absolute left-0 right-0 pointer-events-none"
            style={{ bottom: fromBottom, borderTop: '1px dashed #4b5563' }}
          />
        );
      })()}

      {/* tooltip */}
      {tooltip !== null && (
        <div className="absolute z-20 bg-[#12141a] border border-gray-700/60 rounded-lg px-3 py-2 text-xs pointer-events-none shadow-lg"
          style={{ bottom: '100%', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
          <span className="text-gray-400">{String(data[tooltip.idx][labelKey])}</span>
          <span className="text-white font-bold ml-2">
            {formatValue ? formatValue(data[tooltip.idx][valueKey] as number) : data[tooltip.idx][valueKey]}
          </span>
        </div>
      )}
    </div>
  );
}

function CSSLineChart({ data, height = 200 }: { data: { trade: number; pnl: number; token: string }[]; height?: number }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const PAD = { top: 12, right: 8, bottom: 28, left: 36 };
  const W = 400;
  const H = height;
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const pnlValues = data.map(d => d.pnl);
  const minPnl = Math.min(...pnlValues, 0);
  const maxPnl = Math.max(...pnlValues, 0);
  const range = maxPnl - minPnl || 1;

  const xScale = (i: number) => PAD.left + (i / Math.max(data.length - 1, 1)) * chartW;
  const yScale = (v: number) => PAD.top + chartH - ((v - minPnl) / range) * chartH;

  const points = data.map((d, i) => `${xScale(i).toFixed(1)},${yScale(d.pnl).toFixed(1)}`).join(' ');
  const zeroY = yScale(0);

  const fillPoints = [
    `${xScale(0).toFixed(1)},${zeroY.toFixed(1)}`,
    ...data.map((d, i) => `${xScale(i).toFixed(1)},${yScale(d.pnl).toFixed(1)}`),
    `${xScale(data.length - 1).toFixed(1)},${zeroY.toFixed(1)}`,
  ].join(' ');

  const yTicks = [minPnl, 0, maxPnl].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => b - a);

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-full"
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* grid */}
        {yTicks.map((v, i) => {
          const y = yScale(v);
          return (
            <g key={i}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              <text x={PAD.left - 4} y={y + 3} textAnchor="end" fill="#6b7280" fontSize="9">
                {v >= 0 ? `+${v.toFixed(0)}` : v.toFixed(0)}%
              </text>
            </g>
          );
        })}
        {/* zero reference */}
        <line x1={PAD.left} y1={zeroY} x2={W - PAD.right} y2={zeroY} stroke="#4b5563" strokeWidth="1" strokeDasharray="4 3" />
        {/* fill */}
        <polygon points={fillPoints} fill="#34d399" fillOpacity="0.07" />
        {/* line */}
        <polyline points={points} fill="none" stroke="#34d399" strokeWidth="2" strokeLinejoin="round" />
        {/* hover dots */}
        {data.map((d, i) => (
          <circle
            key={i}
            cx={xScale(i)}
            cy={yScale(d.pnl)}
            r={hoverIdx === i ? 4 : 2.5}
            fill={d.pnl >= 0 ? '#34d399' : '#f87171'}
            stroke="#12141a"
            strokeWidth="1.5"
            className="cursor-pointer"
            onMouseEnter={() => setHoverIdx(i)}
          />
        ))}
        {/* x axis labels */}
        {data.filter((_, i) => i === 0 || i === data.length - 1 || (data.length > 4 && i % Math.ceil(data.length / 4) === 0)).map((d) => {
          const i = data.indexOf(d);
          return (
            <text key={i} x={xScale(i)} y={H - 6} textAnchor="middle" fill="#6b7280" fontSize="9">
              #{d.trade}
            </text>
          );
        })}
      </svg>
      {/* tooltip */}
      {hoverIdx !== null && (
        <div className="absolute z-20 bg-[#12141a] border border-gray-700/60 rounded-lg px-3 py-2 text-xs pointer-events-none shadow-lg"
          style={{ bottom: '70%', left: `${(hoverIdx / Math.max(data.length - 1, 1)) * 100}%`, transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
          <p className="text-gray-400">Trade #{data[hoverIdx].trade} · {data[hoverIdx].token}</p>
          <p className={`font-bold ${data[hoverIdx].pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {data[hoverIdx].pnl >= 0 ? '+' : ''}{data[hoverIdx].pnl.toFixed(2)}%
          </p>
        </div>
      )}
    </div>
  );
}

function SVGRadarChart({ data, height = 260 }: { data: { subject: string; winRate: number; avgPnl: number; fullMark: number }[]; height?: number }) {
  const size = Math.min(260, height);
  const cx = size / 2;
  const cy = size / 2;
  const r = (size / 2) * 0.72;
  const n = data.length;
  if (n < 2) return <EmptyChartState msg="Need trades across 2+ setups" />;

  const angleStep = (2 * Math.PI) / n;
  const angle = (i: number) => -Math.PI / 2 + i * angleStep;

  const ptWinRate = data.map((d, i) => {
    const a = angle(i);
    const frac = d.winRate / 100;
    return { x: cx + r * frac * Math.cos(a), y: cy + r * frac * Math.sin(a) };
  });

  const ptPnl = data.map((d, i) => {
    const a = angle(i);
    const frac = Math.min(1, Math.max(0, d.avgPnl / 100));
    return { x: cx + r * frac * Math.cos(a), y: cy + r * frac * Math.sin(a) };
  });

  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  const polygonPoints = (pts: { x: number; y: number }[]) =>
    pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <div className="flex justify-center items-center" style={{ height }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* grid circles */}
        {gridLevels.map((lvl, li) => (
          <polygon
            key={li}
            points={polygonPoints(data.map((_, i) => {
              const a = angle(i);
              return { x: cx + r * lvl * Math.cos(a), y: cy + r * lvl * Math.sin(a) };
            }))}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />
        ))}
        {/* spokes */}
        {data.map((_, i) => {
          const a = angle(i);
          return (
            <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(a)} y2={cy + r * Math.sin(a)}
              stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          );
        })}
        {/* win rate polygon */}
        <polygon points={polygonPoints(ptWinRate)} fill="#34d399" fillOpacity="0.15" stroke="#34d399" strokeWidth="1.5" />
        {/* avg pnl polygon */}
        <polygon points={polygonPoints(ptPnl)} fill="#60a5fa" fillOpacity="0.1" stroke="#60a5fa" strokeWidth="1.5" />
        {/* axis labels */}
        {data.map((d, i) => {
          const a = angle(i);
          const lx = cx + (r + 16) * Math.cos(a);
          const ly = cy + (r + 16) * Math.sin(a);
          return (
            <text key={i} x={lx} y={ly + 3} textAnchor="middle" fill="#6b7280" fontSize="9">
              {d.subject.length > 7 ? d.subject.substring(0, 7) : d.subject}
            </text>
          );
        })}
      </svg>
      <div className="ml-4 space-y-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-emerald-400 rounded" />
          <span className="text-[10px] text-gray-400">Win Rate</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-blue-400 rounded" />
          <span className="text-[10px] text-gray-400">Avg PnL</span>
        </div>
      </div>
    </div>
  );
}

// ─── sub-components ──────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, icon }: { label: string; value: string | number; sub: string; color: string; icon: React.ReactNode }) {
  return (
    <div className="bg-[#12141a]/80 border border-gray-800/50 rounded-xl p-4 hover:border-gray-700/60 transition-colors group">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold leading-tight">{label}</span>
        <span className="text-gray-600 group-hover:text-gray-400 transition-colors">{icon}</span>
      </div>
      <p className={`text-2xl font-bold leading-none mb-1 ${color}`}>{value}</p>
      <p className="text-[10px] text-gray-600 leading-tight">{sub}</p>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#12141a]/80 border border-gray-800/50 rounded-xl p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-[10px] text-gray-600 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function EmptyChartState({ msg }: { msg?: string }) {
  return (
    <div className="flex items-center justify-center h-[180px]">
      <div className="text-center">
        <BarChart3 className="w-8 h-8 text-gray-700 mx-auto mb-2" />
        <p className="text-gray-600 text-xs">{msg || 'No data yet — log some trades'}</p>
      </div>
    </div>
  );
}


function FavoriteWallets({ wallets, onAdd, onDelete }) {
  const [newWallet, setNewWallet] = useState({ wallet_address: '', nickname: '', notes: '' });
  const [copied, setCopied] = useState<string | null>(null);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd(newWallet);
    setNewWallet({ wallet_address: '', nickname: '', notes: '' });
  };

  const copyToClipboard = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(address);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#12141a]/90 backdrop-blur border border-gray-800/60 rounded-2xl p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Add Favorite Wallet</h2>
            <p className="text-sm text-gray-500">Track wallets to follow their moves</p>
          </div>
        </div>

        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2 font-medium">Wallet Address</label>
              <input
                type="text"
                value={newWallet.wallet_address}
                onChange={(e) => setNewWallet({ ...newWallet, wallet_address: e.target.value })}
                placeholder="Solana wallet address"
                className="w-full bg-gray-900/50 border border-gray-800 rounded-xl px-4 py-3 focus:outline-none focus:border-cyan-500/50 focus:bg-gray-900/70 transition-all font-mono text-sm text-white placeholder-gray-600"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2 font-medium">Nickname</label>
              <input
                type="text"
                value={newWallet.nickname}
                onChange={(e) => setNewWallet({ ...newWallet, nickname: e.target.value })}
                placeholder="e.g., Whale Alpha, Smart Money"
                className="w-full bg-gray-900/50 border border-gray-800 rounded-xl px-4 py-3 focus:outline-none focus:border-cyan-500/50 focus:bg-gray-900/70 transition-all text-white placeholder-gray-600"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2 font-medium">Notes</label>
            <textarea
              value={newWallet.notes}
              onChange={(e) => setNewWallet({ ...newWallet, notes: e.target.value })}
              placeholder="Why do you track this wallet?"
              className="w-full bg-gray-900/50 border border-gray-800 rounded-xl px-4 py-3 focus:outline-none focus:border-cyan-500/50 focus:bg-gray-900/70 transition-all min-h-[80px] resize-y text-white placeholder-gray-600"
            />
          </div>
          <button
            type="submit"
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-teal-500 text-white px-6 py-3.5 rounded-xl font-semibold hover:from-cyan-400 hover:to-teal-400 transition-all duration-200 shadow-lg shadow-cyan-500/20"
          >
            <PlusCircle className="w-4 h-4" />
            Add Wallet
          </button>
        </form>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {wallets.map((wallet) => (
          <div
            key={wallet.id}
            className="group bg-[#12141a]/90 backdrop-blur border border-gray-800/60 rounded-xl p-5 hover:border-cyan-500/40 transition-all duration-300"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg text-white mb-1">{wallet.nickname}</h3>
                <p className="text-xs text-gray-500 font-mono truncate flex items-center gap-1.5">
                  <Hash className="w-3 h-3 flex-shrink-0" />
                  {wallet.wallet_address.slice(0, 8)}...{wallet.wallet_address.slice(-8)}
                </p>
              </div>
              <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button
                  onClick={() => copyToClipboard(wallet.wallet_address)}
                  className="p-2 bg-gray-800/80 rounded-lg text-gray-500 hover:text-cyan-400 hover:bg-gray-800 transition-colors"
                  title="Copy address"
                >
                  {copied === wallet.wallet_address ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
                <a
                  href={`https://solscan.io/account/${wallet.wallet_address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-gray-800/80 rounded-lg text-gray-500 hover:text-emerald-400 hover:bg-gray-800 transition-colors"
                  title="View on Solscan"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => onDelete(wallet.id)}
                  className="p-2 bg-gray-800/80 rounded-lg text-gray-500 hover:text-red-400 hover:bg-gray-800 transition-colors"
                  title="Remove wallet"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {wallet.notes && (
              <p className="text-sm text-gray-400 line-clamp-2 bg-gray-800/20 rounded-lg p-2.5">{wallet.notes}</p>
            )}
          </div>
        ))}
      </div>

      {wallets.length === 0 && (
        <EmptyState message="No favorite wallets yet. Add wallets you want to track!" />
      )}
    </div>
  );
}

// ─── Import Trades ───────────────────────────────────────────────────────────

type ImportMethod = 'csv' | 'wallet' | 'manual';

interface CsvRow {
  token_name: string;
  contract_address: string;
  entry_price: string;
  exit_price: string;
  stop_loss: string;
  take_profit: string;
  position_size: string;
  setup_type: string;
  notes: string;
  status: string;
}

interface ParsedImportTrade {
  id: string;
  token_name: string;
  contract_address: string;
  entry_price: number;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  position_size: number;
  setup_type: SetupType;
  notes: string;
  status: 'open' | 'closed';
  selected: boolean;
}

const CSV_TEMPLATE_HEADERS = 'token_name,contract_address,entry_price,exit_price,stop_loss,take_profit,position_size,setup_type,notes,status';
const CSV_TEMPLATE_EXAMPLE = 'BONK,DezXAZ8z7PnrnRJNzbnJt6tJVLsGrLjdFY2JQCvN9,0.00002847,0.00004123,0.00002400,0.00004500,15.5,breakout,Strong breakout setup,closed';

function parseCsvText(text: string): ParsedImportTrade[] {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
  const idx = (name: string) => headers.indexOf(name);

  return lines.slice(1).map((line, i) => {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const get = (name: string) => cols[idx(name)] ?? '';
    const validSetups: SetupType[] = ['reclaim', 'support_bounce', 'breakout', 'momentum_scalp', 'avoid'];
    const rawSetup = get('setup_type').toLowerCase().replace(/\s+/g, '_');
    const setup: SetupType = validSetups.includes(rawSetup as SetupType) ? (rawSetup as SetupType) : 'breakout';
    const rawStatus = get('status').toLowerCase();
    const status: 'open' | 'closed' = rawStatus === 'closed' ? 'closed' : 'open';
    return {
      id: `csv_${i}_${Date.now()}`,
      token_name: get('token_name') || `Token ${i + 1}`,
      contract_address: get('contract_address') || '',
      entry_price: parseFloat(get('entry_price')) || 0,
      exit_price: get('exit_price') ? parseFloat(get('exit_price')) || null : null,
      stop_loss: get('stop_loss') ? parseFloat(get('stop_loss')) || null : null,
      take_profit: get('take_profit') ? parseFloat(get('take_profit')) || null : null,
      position_size: parseFloat(get('position_size')) || 0,
      setup_type: setup,
      notes: get('notes') || '',
      status,
      selected: true,
    };
  }).filter(t => t.token_name);
}

function ImportTrades({ onImport, onCancel }: {
  onImport: (trades: Array<Omit<Trade, 'id' | 'created_at' | 'pnl' | 'rr_ratio'>>) => void;
  onCancel: () => void;
}) {
  const [method, setMethod] = useState<ImportMethod | null>(null);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/30 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center">
            <Download className="w-4 h-4 text-blue-400" />
          </div>
          Import Trades
        </h2>
        <p className="text-xs text-gray-500 mt-1 ml-[42px]">Bring in your existing trade history from multiple sources</p>
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-3 px-4 py-3.5 bg-red-500/8 border border-red-500/20 rounded-xl">
        <ShieldCheck className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-red-400 mb-0.5">Security notice</p>
          <p className="text-xs text-red-400/80 leading-relaxed">
            Never share your wallet recovery phrase, seed phrase, or private key with anyone — including this app. Narrative only ever needs a <span className="font-semibold text-red-300">public wallet address</span> (read-only).
          </p>
        </div>
      </div>

      {!method ? (
        <ImportMethodPicker onSelect={setMethod} />
      ) : (
        <>
          <button
            onClick={() => setMethod(null)}
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            Back to import options
          </button>
          {method === 'csv' && <CsvImport onImport={onImport} />}
          {method === 'wallet' && <WalletImport onImport={onImport} />}
          {method === 'manual' && <ManualImport onImport={onImport} />}
        </>
      )}
    </div>
  );
}

function ImportMethodPicker({ onSelect }: { onSelect: (m: ImportMethod) => void }) {
  const methods = [
    {
      id: 'csv' as ImportMethod,
      icon: Table,
      label: 'Upload CSV',
      description: 'Import from a spreadsheet export. Download our template to get started.',
      badge: null,
      color: 'emerald',
    },
    {
      id: 'wallet' as ImportMethod,
      icon: WalletIcon,
      label: 'Paste Wallet Address',
      description: 'Enter a public Solana wallet address to scan for token transactions via Helius.',
      badge: 'Live',
      color: 'cyan',
    },
    {
      id: 'manual' as ImportMethod,
      icon: ClipboardList,
      label: 'Manual Quick Import',
      description: 'Paste a contract address with notes to create a draft journal entry instantly.',
      badge: null,
      color: 'blue',
    },
  ];

  const colorMap: Record<string, { card: string; icon: string; iconBg: string; badge: string }> = {
    emerald: { card: 'hover:border-emerald-500/40 hover:bg-emerald-500/4', icon: 'text-emerald-400', iconBg: 'bg-emerald-500/15 border-emerald-500/25', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
    cyan: { card: 'hover:border-cyan-500/40 hover:bg-cyan-500/4', icon: 'text-cyan-400', iconBg: 'bg-cyan-500/15 border-cyan-500/25', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
    blue: { card: 'hover:border-blue-500/40 hover:bg-blue-500/4', icon: 'text-blue-400', iconBg: 'bg-blue-500/15 border-blue-500/25', badge: '' },
  };

  return (
    <div className="grid sm:grid-cols-3 gap-4">
      {methods.map(m => {
        const c = colorMap[m.color];
        return (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            className={`group text-left bg-[#0e1016]/80 border border-gray-800/60 rounded-2xl p-5 transition-all duration-200 ${c.card} hover:shadow-lg`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${c.iconBg}`}>
                <m.icon className={`w-5 h-5 ${c.icon}`} />
              </div>
              {m.badge && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${c.badge}`}>{m.badge}</span>
              )}
            </div>
            <p className="text-sm font-bold text-white mb-1.5 group-hover:text-gray-100">{m.label}</p>
            <p className="text-xs text-gray-500 leading-relaxed">{m.description}</p>
            <div className={`mt-4 flex items-center gap-1 text-xs font-medium ${c.icon} opacity-0 group-hover:opacity-100 transition-opacity`}>
              Get started <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── CSV Import ────────────────────────────────────────────────────────────────
function CsvImport({ onImport }: { onImport: (trades: Array<Omit<Trade, 'id' | 'created_at' | 'pnl' | 'rr_ratio'>>) => void }) {
  const [dragging, setDragging] = useState(false);
  const [parsed, setParsed] = useState<ParsedImportTrade[] | null>(null);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setError('');
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setError('Please upload a .csv file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCsvText(text);
      if (rows.length === 0) {
        setError('No valid trade rows found. Make sure your CSV matches the template headers.');
      } else {
        setParsed(rows);
      }
    };
    reader.readAsText(file);
  };

  const toggleRow = (id: string) => setParsed(prev => prev ? prev.map(r => r.id === id ? { ...r, selected: !r.selected } : r) : prev);
  const toggleAll = () => {
    const allSelected = parsed?.every(r => r.selected);
    setParsed(prev => prev ? prev.map(r => ({ ...r, selected: !allSelected })) : prev);
  };

  const handleImport = async () => {
    if (!parsed) return;
    const selected = parsed.filter(r => r.selected);
    if (!selected.length) return;
    setImporting(true);
    await new Promise(r => setTimeout(r, 800));
    onImport(selected.map(({ selected: _s, id: _id, ...t }) => t));
    setDone(true);
  };

  const downloadTemplate = () => {
    const content = `${CSV_TEMPLATE_HEADERS}\n${CSV_TEMPLATE_EXAMPLE}`;
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'narrative_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (done) return <ImportSuccessState count={parsed?.filter(r => r.selected).length ?? 0} />;

  return (
    <div className="space-y-4">
      {/* Template download */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#0e1016]/60 border border-gray-800/50 rounded-xl">
        <div className="flex items-center gap-2.5">
          <FileText className="w-4 h-4 text-gray-500" />
          <div>
            <p className="text-xs font-semibold text-gray-300">Download CSV template</p>
            <p className="text-[10px] text-gray-600">Use this format for clean imports</p>
          </div>
        </div>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium rounded-lg hover:bg-emerald-500/20 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Template
        </button>
      </div>

      {/* Drop zone */}
      {!parsed && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 ${
            dragging ? 'border-emerald-500/60 bg-emerald-500/6' : 'border-gray-700/60 bg-gray-900/20 hover:border-gray-600 hover:bg-gray-900/40'
          }`}
        >
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <Upload className={`w-8 h-8 mx-auto mb-3 transition-colors ${dragging ? 'text-emerald-400' : 'text-gray-600'}`} />
          <p className="text-sm text-gray-400 font-medium">Drop your CSV file here</p>
          <p className="text-xs text-gray-600 mt-1">or click to browse</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-red-500/10 border border-red-500/25 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Preview table */}
      {parsed && parsed.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400 font-medium">{parsed.length} trades found — select which to import</p>
            <button onClick={toggleAll} className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
              {parsed.every(r => r.selected) ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          <div className="bg-[#0e1016]/80 border border-gray-800/60 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800/60 bg-gray-900/40">
                    <th className="px-4 py-2.5 text-left w-8">
                      <input type="checkbox" checked={parsed.every(r => r.selected)} onChange={toggleAll} className="accent-emerald-500 cursor-pointer" />
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Token</th>
                    <th className="px-3 py-2.5 text-left text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Entry</th>
                    <th className="px-3 py-2.5 text-left text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Exit</th>
                    <th className="px-3 py-2.5 text-left text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Setup</th>
                    <th className="px-3 py-2.5 text-left text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40">
                  {parsed.map(row => {
                    const setupInfo = SETUP_TYPES.find(s => s.value === row.setup_type);
                    return (
                      <tr key={row.id} onClick={() => toggleRow(row.id)} className={`cursor-pointer transition-colors ${row.selected ? 'bg-emerald-500/3' : 'opacity-40'} hover:bg-gray-800/30`}>
                        <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={row.selected} onChange={() => toggleRow(row.id)} className="accent-emerald-500 cursor-pointer" />
                        </td>
                        <td className="px-3 py-2.5 font-medium text-white">{row.token_name}</td>
                        <td className="px-3 py-2.5 font-mono text-gray-300">{row.entry_price}</td>
                        <td className="px-3 py-2.5 font-mono text-gray-400">{row.exit_price ?? '—'}</td>
                        <td className="px-3 py-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${setupInfo?.color ?? ''}`}>{setupInfo?.label ?? row.setup_type}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`text-[10px] font-semibold ${row.status === 'open' ? 'text-cyan-400' : 'text-gray-500'}`}>
                            {row.status === 'open' ? '● Open' : '○ Closed'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setParsed(null); setError(''); }} className="px-4 py-2.5 bg-gray-800/60 border border-gray-700/50 text-gray-400 rounded-xl text-xs font-medium hover:bg-gray-800 transition-colors">
              Upload different file
            </button>
            <button
              onClick={handleImport}
              disabled={importing || !parsed.some(r => r.selected)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-bold hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/20"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {importing ? 'Importing…' : `Import ${parsed.filter(r => r.selected).length} trade${parsed.filter(r => r.selected).length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Debug Panel ───────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DebugPanel({ data, wallet }: { data: any; wallet: string }) {
  const [open, setOpen] = useState(true);
  const [rawOpen, setRawOpen] = useState(false);

  const oldest = data.date_range?.oldest ? new Date(data.date_range.oldest).toLocaleString() : 'N/A';
  const newest = data.date_range?.newest ? new Date(data.date_range.newest).toLocaleString() : 'N/A';

  return (
    <div className="bg-[#0a0c10] border border-orange-500/25 rounded-2xl overflow-hidden text-xs font-mono">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-orange-500/8 border-b border-orange-500/20 hover:bg-orange-500/12 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
          <span className="text-orange-300 font-bold tracking-wide">SCAN DIAGNOSTICS</span>
          <span className="text-orange-600 text-[10px]">debug mode</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-orange-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* Summary counters */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Txs fetched', value: data.txs_fetched ?? 0, color: 'text-cyan-400' },
              { label: 'Swaps detected', value: data.swaps_detected ?? 0, color: data.swaps_detected > 0 ? 'text-emerald-400' : 'text-red-400' },
              { label: 'Trades built', value: data.trades_built ?? 0, color: data.trades_built > 0 ? 'text-emerald-400' : 'text-red-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-3 text-center">
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-[10px] text-gray-600 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Date range */}
          <div className="bg-gray-900/40 border border-gray-800/40 rounded-xl p-3 space-y-1.5">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2">Scan Window</p>
            <div className="flex justify-between">
              <span className="text-gray-600">Oldest tx:</span>
              <span className="text-gray-300">{oldest}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Newest tx:</span>
              <span className="text-gray-300">{newest}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Wallet:</span>
              <span className="text-gray-400 truncate max-w-[200px]">{wallet}</span>
            </div>
          </div>

          {/* Swap breakdown */}
          {data.swap_breakdown?.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2">Detected Swaps ({data.swap_breakdown.length})</p>
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {data.swap_breakdown.map((s: { sig: string; type: string; via: string; mint: string; sol: string; ts: string }, i: number) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/5 border border-emerald-500/15 rounded-lg">
                    <span className={`text-[10px] font-bold w-8 ${s.type === 'buy' ? 'text-emerald-400' : 'text-red-400'}`}>{s.type.toUpperCase()}</span>
                    <span className="text-gray-500 flex-1 truncate">{s.sig}</span>
                    <span className="text-cyan-600 text-[10px]">{s.via}</span>
                    <span className="text-gray-400">{s.sol} SOL</span>
                    <span className="text-gray-600 text-[10px]">{new Date(s.ts).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw tx sample */}
          <div>
            <button
              onClick={() => setRawOpen(o => !o)}
              className="flex items-center gap-2 text-[10px] text-gray-500 hover:text-gray-300 transition-colors mb-2"
            >
              <ChevronDown className={`w-3 h-3 transition-transform ${rawOpen ? 'rotate-180' : ''}`} />
              Last {data.raw_tx_sample?.length ?? 0} raw transactions (all types)
            </button>
            {rawOpen && data.raw_tx_sample?.length > 0 && (
              <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                <div className="grid grid-cols-[1fr_80px_80px_80px_60px_60px] gap-x-2 px-2 pb-1 text-[9px] text-gray-600 uppercase tracking-widest border-b border-gray-800/50">
                  <span>Signature</span><span>Type</span><span>Source</span><span>Date</span><span>Swap?</span><span>TokTxfr</span>
                </div>
                {data.raw_tx_sample.map((tx: { sig: string; type: string; source: string; timestamp: string; has_swap_event: boolean; has_token_transfers: number; description: string }, i: number) => (
                  <div key={i} className="grid grid-cols-[1fr_80px_80px_80px_60px_60px] gap-x-2 px-2 py-1.5 bg-gray-900/30 rounded hover:bg-gray-900/60 transition-colors items-center">
                    <span className="text-gray-400 truncate">{tx.sig}</span>
                    <span className={`text-[10px] font-semibold ${tx.type === 'SWAP' ? 'text-emerald-400' : tx.type === 'UNKNOWN' ? 'text-gray-600' : 'text-cyan-400'}`}>{tx.type}</span>
                    <span className="text-gray-600 truncate">{tx.source}</span>
                    <span className="text-gray-600">{tx.timestamp !== '?' ? new Date(tx.timestamp).toLocaleDateString() : '?'}</span>
                    <span className={tx.has_swap_event ? 'text-emerald-400' : 'text-gray-700'}>{tx.has_swap_event ? 'YES' : 'no'}</span>
                    <span className={tx.has_token_transfers > 0 ? 'text-cyan-400' : 'text-gray-700'}>{tx.has_token_transfers}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Filtered out */}
          {data.filtered_out_sample?.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2">
                Filtered Out — Why Not Parsed ({data.filtered_out_sample.length} shown)
              </p>
              <div className="space-y-0.5 max-h-40 overflow-y-auto">
                {data.filtered_out_sample.map((r: string, i: number) => (
                  <p key={i} className="text-[10px] text-gray-600 leading-relaxed px-2 py-0.5 hover:text-gray-400 transition-colors">{r}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Wallet Import ─────────────────────────────────────────────────────────────
// Validate Solana base58 public key (32–44 chars, base58 charset)
function isValidSolanaAddress(addr: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr.trim());
}

type ScanStatus = 'idle' | 'scanning' | 'found' | 'empty' | 'error';

interface WalletTradeResult {
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
}

const SCAN_STEPS = [
  'Validating wallet address…',
  'Connecting to Helius RPC…',
  'Fetching recent swap transactions…',
  'Filtering token interactions…',
  'Resolving token metadata…',
  'Pairing buys and sells…',
  'Building trade entries…',
];

type ApiStatus = 'checking' | 'ok' | 'error';

interface ApiHealthState {
  helius: { status: ApiStatus; latency_ms?: number; error?: string; configured: boolean };
  birdeye: { status: ApiStatus; latency_ms?: number; error?: string; configured: boolean };
}

function WalletImport({ onImport }: { onImport: (trades: Array<Omit<Trade, 'id' | 'created_at' | 'pnl' | 'rr_ratio'>>) => void }) {
  const [address, setAddress] = useState('');
  const [validationError, setValidationError] = useState('');
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [scanStep, setScanStep] = useState(0);
  const [results, setResults] = useState<WalletTradeResult[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [debugData, setDebugData] = useState<any>(null);
  const [apiHealth, setApiHealth] = useState<ApiHealthState>({
    helius: { status: 'checking', configured: false },
    birdeye: { status: 'checking', configured: false },
  });

  useEffect(() => {
    const check = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        const res = await fetch(`${supabaseUrl}/functions/v1/api-health`, {
          headers: { 'Authorization': `Bearer ${supabaseAnonKey}` },
        });
        if (!res.ok) throw new Error(`Health check HTTP ${res.status}`);
        const data = await res.json();
        setApiHealth({
          helius: {
            status: data.helius.ok ? 'ok' : 'error',
            latency_ms: data.helius.latency_ms,
            error: data.helius.error,
            configured: data.helius.configured,
          },
          birdeye: {
            status: data.birdeye.ok ? 'ok' : 'error',
            latency_ms: data.birdeye.latency_ms,
            error: data.birdeye.error,
            configured: data.birdeye.configured,
          },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Health check failed';
        setApiHealth({
          helius: { status: 'error', error: msg, configured: false },
          birdeye: { status: 'error', error: msg, configured: false },
        });
      }
    };
    check();
  }, []);
  const [errorMessage, setErrorMessage] = useState('');
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  const handleAddressChange = (val: string) => {
    setAddress(val);
    if (validationError && val.trim()) setValidationError('');
  };

  const handleScan = async () => {
    const trimmed = address.trim();
    if (!trimmed) return;

    if (!isValidSolanaAddress(trimmed)) {
      setValidationError('That doesn\'t look like a valid Solana address. Public keys are 32–44 base58 characters.');
      return;
    }

    setValidationError('');
    setStatus('scanning');
    setScanStep(0);
    setErrorMessage('');

    // Step 0: validating — immediate
    await new Promise(r => setTimeout(r, 200));
    setScanStep(1); // connecting to RPC

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

      setScanStep(2); // fetching transactions

      // Kick off a slow-tick to advance remaining visual steps while waiting
      let currentStep = 2;
      const stepInterval = setInterval(() => {
        currentStep = Math.min(currentStep + 1, SCAN_STEPS.length - 2);
        setScanStep(currentStep);
      }, 900);

      const res = await fetch(`${supabaseUrl}/functions/v1/scan-wallet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ wallet_address: trimmed, limit: 100 }),
      });

      clearInterval(stepInterval);
      setScanStep(SCAN_STEPS.length); // all done

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        if (res.status === 422) {
          setValidationError(body.error ?? 'Invalid wallet address.');
          setStatus('idle');
          return;
        }
        if (res.status === 429) {
          throw new Error(body.error ?? 'Rate limit reached. Please wait a moment and try again.');
        }
        if (res.status === 401) {
          throw new Error(body.error ?? 'Helius API key is invalid or missing. Check your Edge Function secrets.');
        }
        throw new Error(body.error ?? `Scan failed (HTTP ${res.status})`);
      }

      const data = await res.json();
      if (data.debug) setDebugData(data.debug);

      const trades: WalletTradeResult[] = (data.trades ?? []).map((t: WalletTradeResult) => ({
        ...t,
        selected: true,
        mock: false,
      }));

      await new Promise(r => setTimeout(r, 200));

      if (trades.length === 0) {
        setStatus('empty');
      } else {
        setResults(trades);
        setStatus('found');
      }
    } catch (err) {
      setScanStep(0);
      setErrorMessage(err instanceof Error ? err.message : 'Unexpected error scanning wallet.');
      setStatus('error');
    }
  };

  const toggleRow = (id: string) =>
    setResults(prev => prev.map(r => r.id === id ? { ...r, selected: !r.selected } : r));
  const toggleAll = () => {
    const allOn = results.every(r => r.selected);
    setResults(prev => prev.map(r => ({ ...r, selected: !allOn })));
  };

  const handleImport = async () => {
    const selected = results.filter(r => r.selected);
    if (!selected.length) return;
    setImporting(true);
    await new Promise(r => setTimeout(r, 600));
    onImport(selected.map(({ selected: _s, id: _id, mock: _m, tx_signature: _tx, timestamp: _ts, trade_type: _tt, sol_amount: _sa, usd_value: _uv, token_symbol: _sym, ...t }) => ({
      ...t,
      exit_price: t.exit_price,
      screenshots: [],
    })));
    setDone(true);
  };

  const handleReset = () => {
    setAddress('');
    setValidationError('');
    setStatus('idle');
    setScanStep(0);
    setResults([]);
    setErrorMessage('');
    setImporting(false);
    setDone(false);
    setDebugData(null);
  };

  if (done) return <ImportSuccessState count={results.filter(r => r.selected).length} />;

  const ApiStatusRow = ({ label, s }: { label: string; s: ApiHealthState['helius'] }) => {
    const isChecking = s.status === 'checking';
    const isOk = s.status === 'ok';
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {isChecking ? (
            <div className="w-2 h-2 rounded-full bg-gray-600 animate-pulse" />
          ) : isOk ? (
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-red-400" />
          )}
          <span className="text-xs font-semibold text-gray-300">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {isChecking && <span className="text-[10px] text-gray-600">Checking…</span>}
          {!isChecking && isOk && (
            <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
              Connected {s.latency_ms !== undefined && <span className="text-gray-600 font-normal">({s.latency_ms}ms)</span>}
            </span>
          )}
          {!isChecking && !isOk && (
            <span className="text-[10px] font-semibold text-red-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              {s.error ?? 'Failed'}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* ── Connection Status ── */}
      <div className="bg-[#0e1016]/80 border border-gray-800/60 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-800/60 bg-gray-900/30">
          <Activity className="w-3.5 h-3.5 text-gray-500" />
          <p className="text-xs font-semibold text-gray-300">Connection Status</p>
          <button
            onClick={() => {
              setApiHealth({
                helius: { status: 'checking', configured: false },
                birdeye: { status: 'checking', configured: false },
              });
              const check = async () => {
                try {
                  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
                  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
                  const res = await fetch(`${supabaseUrl}/functions/v1/api-health`, {
                    headers: { 'Authorization': `Bearer ${supabaseAnonKey}` },
                  });
                  if (!res.ok) throw new Error(`Health check HTTP ${res.status}`);
                  const data = await res.json();
                  setApiHealth({
                    helius: { status: data.helius.ok ? 'ok' : 'error', latency_ms: data.helius.latency_ms, error: data.helius.error, configured: data.helius.configured },
                    birdeye: { status: data.birdeye.ok ? 'ok' : 'error', latency_ms: data.birdeye.latency_ms, error: data.birdeye.error, configured: data.birdeye.configured },
                  });
                } catch (e) {
                  const msg = e instanceof Error ? e.message : 'Health check failed';
                  setApiHealth({ helius: { status: 'error', error: msg, configured: false }, birdeye: { status: 'error', error: msg, configured: false } });
                }
              };
              check();
            }}
            className="ml-auto flex items-center gap-1 text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Recheck
          </button>
        </div>
        <div className="px-4 py-3 space-y-2.5">
          <ApiStatusRow label="Helius" s={apiHealth.helius} />
          <ApiStatusRow label="Birdeye" s={apiHealth.birdeye} />
        </div>
      </div>

      {/* ── Idle: address input ── */}
      {status === 'idle' && (
        <div className="bg-[#0e1016]/80 border border-gray-800/60 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2 font-semibold">
              Public Wallet Address
            </label>
            <div className="relative">
              <WalletIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
              <input
                type="text"
                value={address}
                onChange={e => handleAddressChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && address.trim() && handleScan()}
                placeholder="e.g. 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgA"
                className={`w-full bg-gray-900/60 border rounded-xl pl-11 pr-4 py-3.5 text-sm text-white placeholder-gray-600 font-mono focus:outline-none transition-all ${
                  validationError
                    ? 'border-red-500/50 focus:border-red-500/70 focus:ring-1 focus:ring-red-500/20'
                    : 'border-gray-800 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20'
                }`}
              />
            </div>
            {validationError ? (
              <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                {validationError}
              </p>
            ) : (
              <p className="text-[10px] text-gray-600 mt-1.5 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Public address only — never share your seed phrase or private key
              </p>
            )}
          </div>
          <button
            onClick={handleScan}
            disabled={!address.trim()}
            className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl text-sm font-bold hover:from-cyan-400 hover:to-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
          >
            <ScanLine className="w-4 h-4" />
            Scan Wallet
          </button>
        </div>
      )}

      {/* ── Scanning animation ── */}
      {status === 'scanning' && (
        <div className="bg-[#0e1016]/80 border border-gray-800/60 rounded-2xl p-10 flex flex-col items-center">
          <div className="relative w-20 h-20 mb-6">
            <div className="absolute inset-0 rounded-full border-2 border-cyan-500/10 animate-ping" style={{ animationDuration: '2s' }} />
            <div className="absolute inset-3 rounded-full border-2 border-cyan-500/20 animate-spin" style={{ animationDuration: '3s' }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
                <ScanLine className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
          </div>
          <p className="text-white font-bold mb-1">Scanning Wallet</p>
          <p className="text-[10px] text-gray-600 font-mono mb-1 truncate max-w-[280px]">{address.trim()}</p>
          <p className="text-[10px] text-cyan-600 mb-6">Fetching live data from Helius…</p>
          <div className="w-full max-w-xs space-y-2">
            {SCAN_STEPS.map((msg, i) => {
              const isDone = scanStep > i;
              const isActive = scanStep === i;
              return (
                <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300 ${isDone ? 'bg-cyan-500/8 border border-cyan-500/15' : isActive ? 'bg-gray-800/60 border border-gray-700/50' : 'opacity-25'}`}>
                  <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                    {isDone
                      ? <Check className="w-3.5 h-3.5 text-cyan-400" />
                      : isActive
                      ? <div className="w-3 h-3 border-2 border-gray-600 border-t-cyan-400 rounded-full animate-spin" />
                      : <div className="w-1.5 h-1.5 rounded-full bg-gray-700" />}
                  </div>
                  <span className={`text-xs ${isDone ? 'text-cyan-400' : isActive ? 'text-gray-300' : 'text-gray-700'}`}>{msg}</span>
                </div>
              );
            })}
          </div>
          <div className="w-full max-w-xs mt-5 h-0.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-400 rounded-full transition-all duration-500" style={{ width: `${(scanStep / SCAN_STEPS.length) * 100}%` }} />
          </div>
        </div>
      )}

      {/* ── Error state ── */}
      {status === 'error' && (
        <div className="space-y-3">
          <div className="flex items-start gap-3 px-5 py-4 bg-red-500/8 border border-red-500/20 rounded-2xl">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-red-400">Scan failed</p>
              <p className="text-xs text-red-400/80 leading-relaxed">{errorMessage}</p>
              {errorMessage.toLowerCase().includes('rate limit') && (
                <p className="text-[11px] text-gray-500 mt-1">Wait 10–15 seconds before retrying. Helius free tier allows 10 requests/second.</p>
              )}
              {(errorMessage.toLowerCase().includes('api key') || errorMessage.toLowerCase().includes('invalid or missing')) && (
                <p className="text-[11px] text-gray-500 mt-1">Go to Supabase → Edge Functions → scan-wallet → Secrets and add <span className="font-mono text-gray-400">HELIUS_API_KEY</span>.</p>
              )}
            </div>
          </div>
          <button onClick={handleReset} className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-200 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Try again
          </button>
        </div>
      )}

      {/* ── Empty state ── */}
      {status === 'empty' && (
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center py-10 bg-[#0e1016]/80 border border-orange-500/20 rounded-2xl gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
            </div>
            <p className="text-sm font-semibold text-orange-300">No swap transactions parsed</p>
            <p className="text-xs text-gray-500 text-center max-w-sm">
              Helius returned transactions but none matched our swap detection logic. Review the debug panel below to diagnose why.
            </p>
          </div>
          {debugData && <DebugPanel data={debugData} wallet={address.trim()} />}
          <button onClick={handleReset} className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-200 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Try a different address
          </button>
        </div>
      )}

      {/* ── Found: review table ── */}
      {status === 'found' && results.length > 0 && (
        <div className="space-y-3">
          {/* Source badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-400 font-medium">
                {results.length} trade{results.length !== 1 ? 's' : ''} detected
              </p>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE DATA — Helius
              </span>
            </div>
            <button onClick={toggleAll} className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
              {results.every(r => r.selected) ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          <div className="bg-[#0e1016]/80 border border-gray-800/60 rounded-2xl overflow-hidden">
            <div className="px-4 py-1.5 bg-emerald-500/8 border-b border-emerald-500/15 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
              <span className="text-[9px] font-bold tracking-widest text-emerald-500 uppercase">Live data from Helius</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800/60 bg-gray-900/40">
                    <th className="px-4 py-2.5 w-8">
                      <input type="checkbox" checked={results.every(r => r.selected)} onChange={toggleAll} className="accent-emerald-500 cursor-pointer" />
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Token</th>
                    <th className="px-3 py-2.5 text-left text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Type</th>
                    <th className="px-3 py-2.5 text-left text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Entry (SOL)</th>
                    <th className="px-3 py-2.5 text-left text-[10px] text-gray-500 uppercase tracking-wider font-semibold">SOL Spent</th>
                    <th className="px-3 py-2.5 text-left text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Tokens</th>
                    <th className="px-3 py-2.5 text-left text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Setup</th>
                    <th className="px-3 py-2.5 text-left text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Status</th>
                    <th className="px-3 py-2.5 text-left text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40">
                  {results.map(row => {
                    const setupInfo = SETUP_TYPES.find(s => s.value === row.setup_type);
                    const date = new Date(row.timestamp * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    return (
                      <tr
                        key={row.id}
                        onClick={() => toggleRow(row.id)}
                        className={`cursor-pointer transition-colors ${row.selected ? 'bg-cyan-500/3' : 'opacity-40'} hover:bg-gray-800/30`}
                      >
                        <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={row.selected} onChange={() => toggleRow(row.id)} className="accent-emerald-500 cursor-pointer" />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-white">{row.token_name}</div>
                          <div className="text-[10px] text-gray-500 font-mono">{row.token_symbol}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`text-[10px] font-bold uppercase ${row.trade_type === 'buy' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {row.trade_type}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-gray-300 text-[11px]">{row.entry_price.toFixed(8)}</td>
                        <td className="px-3 py-2.5 font-mono text-gray-400">{row.sol_amount.toFixed(3)}</td>
                        <td className="px-3 py-2.5 font-mono text-gray-500 text-[10px]">
                          {row.token_amount > 1e6
                            ? `${(row.token_amount / 1e6).toFixed(2)}M`
                            : row.token_amount > 1e3
                            ? `${(row.token_amount / 1e3).toFixed(1)}K`
                            : row.token_amount.toFixed(2)}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${setupInfo?.color ?? 'bg-gray-800 text-gray-500 border-gray-700'}`}>
                            {setupInfo?.label ?? row.setup_type}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`text-[10px] font-semibold ${row.status === 'open' ? 'text-cyan-400' : 'text-gray-500'}`}>
                            {row.status === 'open' ? '● Open' : '○ Closed'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[10px] text-gray-600 font-mono">{date}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="px-4 py-2.5 bg-gray-800/60 border border-gray-700/50 text-gray-400 rounded-xl text-xs font-medium hover:bg-gray-800 hover:text-gray-200 transition-colors"
            >
              Different address
            </button>
            <button
              onClick={handleImport}
              disabled={importing || !results.some(r => r.selected)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl text-sm font-bold hover:from-cyan-400 hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/20"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {importing ? 'Importing…' : `Import ${results.filter(r => r.selected).length} trade${results.filter(r => r.selected).length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}

      {/* ── Debug panel — always shown after a scan ── */}
      {debugData && (status === 'found' || status === 'empty') && (
        <DebugPanel data={debugData} wallet={address.trim()} />
      )}
    </div>
  );
}

// ── Manual Quick Import ───────────────────────────────────────────────────────
function ManualImport({ onImport }: { onImport: (trades: Array<Omit<Trade, 'id' | 'created_at' | 'pnl' | 'rr_ratio'>>) => void }) {
  const [form, setForm] = useState({
    token_name: '',
    contract_address: '',
    entry_price: '',
    stop_loss: '',
    take_profit: '',
    position_size: '',
    setup_type: 'breakout' as SetupType,
    notes: '',
    status: 'open' as 'open' | 'closed',
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof form) => (v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.contract_address.trim()) return;
    setSaving(true);
    await new Promise(r => setTimeout(r, 500));
    onImport([{
      token_name: form.token_name || 'Unknown Token',
      contract_address: form.contract_address,
      entry_price: parseFloat(form.entry_price) || 0,
      exit_price: null,
      stop_loss: form.stop_loss ? parseFloat(form.stop_loss) : null,
      take_profit: form.take_profit ? parseFloat(form.take_profit) : null,
      position_size: parseFloat(form.position_size) || 0,
      setup_type: form.setup_type,
      notes: form.notes || null,
      screenshots: [],
      status: form.status,
    }]);
    setDone(true);
  };

  if (done) return <ImportSuccessState count={1} />;

  return (
    <div className="bg-[#0e1016]/80 border border-gray-800/60 rounded-2xl p-6 space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1.5 font-semibold">Contract Address *</label>
          <div className="relative">
            <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
            <input type="text" value={form.contract_address} onChange={e => set('contract_address')(e.target.value)} placeholder="Solana contract address" className="w-full bg-gray-900/60 border border-gray-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-gray-600 font-mono focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all" />
          </div>
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1.5 font-semibold">Token Name</label>
          <input type="text" value={form.token_name} onChange={e => set('token_name')(e.target.value)} placeholder="e.g. Bonk Inu" className="w-full bg-gray-900/60 border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all" />
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1.5 font-semibold">Entry Price</label>
          <input type="number" step="any" value={form.entry_price} onChange={e => set('entry_price')(e.target.value)} placeholder="0.00" className="w-full bg-gray-900/60 border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-600 font-mono focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all" />
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1.5 font-semibold">Position Size (SOL)</label>
          <input type="number" step="any" value={form.position_size} onChange={e => set('position_size')(e.target.value)} placeholder="0.0" className="w-full bg-gray-900/60 border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-600 font-mono focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all" />
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1.5 font-semibold">Stop Loss</label>
          <input type="number" step="any" value={form.stop_loss} onChange={e => set('stop_loss')(e.target.value)} placeholder="0.00" className="w-full bg-gray-900/60 border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-600 font-mono focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all" />
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1.5 font-semibold">Take Profit</label>
          <input type="number" step="any" value={form.take_profit} onChange={e => set('take_profit')(e.target.value)} placeholder="0.00" className="w-full bg-gray-900/60 border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-600 font-mono focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all" />
        </div>
      </div>

      <div>
        <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-semibold">Setup Type</label>
        <div className="flex flex-wrap gap-2">
          {SETUP_TYPES.map(s => (
            <button key={s.value} onClick={() => set('setup_type')(s.value)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${form.setup_type === s.value ? s.color : 'bg-gray-800/40 text-gray-600 border-gray-700/40 hover:border-gray-600'}`}>{s.label}</button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1.5 font-semibold">Status</label>
        <div className="flex gap-2">
          {(['open', 'closed'] as const).map(s => (
            <button key={s} onClick={() => set('status')(s)} className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${form.status === s ? s === 'open' ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400' : 'bg-gray-700/40 border-gray-600 text-gray-300' : 'bg-gray-800/40 border-gray-700/40 text-gray-600 hover:border-gray-600'}`}>{s}</button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1.5 font-semibold">Notes</label>
        <textarea value={form.notes} onChange={e => set('notes')(e.target.value)} placeholder="Trade context, setup details, anything relevant…" rows={3} className="w-full bg-gray-900/60 border border-gray-800 rounded-xl px-4 py-3 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/15 transition-all resize-none" />
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !form.contract_address.trim()}
        className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl text-sm font-bold hover:from-blue-400 hover:to-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saving ? 'Saving…' : 'Save Trade'}
      </button>
    </div>
  );
}

// ── Shared success state ──────────────────────────────────────────────────────
function ImportSuccessState({ count }: { count: number }) {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <p className="text-white font-bold text-lg">{count} trade{count !== 1 ? 's' : ''} imported!</p>
        <p className="text-gray-500 text-sm mt-1">Redirecting to Trade History…</p>
      </div>
    </div>
  );
}

// ─── Quick Journal ────────────────────────────────────────────────────────────

type JournalStep = 'input' | 'generating' | 'review';

interface GeneratedJournalData {
  token_name: string;
  ticker: string;
  contract_address: string;
  market_cap: string;
  liquidity: string;
  volume_24h: string;
  token_age: string;
  dexscreener_url: string;
  setup_type: SetupType;
  entry_price: string;
  stop_loss: string;
  take_profit: string;
  position_size: string;
  trade_thesis: string;
  risk_notes: string;
  support_levels: string;
  resistance_levels: string;
  notes: string;
  screenshot: string | null;
}

async function fetchJournalData(contractAddress: string, hasScreenshot: boolean): Promise<GeneratedJournalData> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const res = await fetch(`${supabaseUrl}/functions/v1/token-info`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ contract_address: contractAddress }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(body.error ?? `Token data fetch failed (HTTP ${res.status})`);
  }

  const d = await res.json();

  const setupTypes: SetupType[] = ['reclaim', 'support_bounce', 'breakout', 'momentum_scalp'];
  const setup: SetupType = setupTypes[0];

  const entryPrice = d.price ?? 0;
  const slPct = 12;
  const tpPct = 40;
  const stopLoss = parseFloat((entryPrice * (1 - slPct / 100)).toFixed(10));
  const takeProfit = parseFloat((entryPrice * (1 + tpPct / 100)).toFixed(10));

  return {
    token_name: d.name ?? contractAddress.slice(0, 8),
    ticker: d.symbol ?? '???',
    contract_address: contractAddress,
    market_cap: d.market_cap ? `$${(d.market_cap / 1e6).toFixed(2)}M` : 'N/A',
    liquidity: d.liquidity ? `$${(d.liquidity / 1e3).toFixed(0)}K` : 'N/A',
    volume_24h: d.volume_24h ? `$${(d.volume_24h / 1e3).toFixed(0)}K` : 'N/A',
    token_age: d.token_age ?? 'N/A',
    dexscreener_url: `https://dexscreener.com/solana/${contractAddress}`,
    setup_type: setup,
    entry_price: entryPrice.toFixed(10),
    stop_loss: stopLoss.toFixed(10),
    take_profit: takeProfit.toFixed(10),
    position_size: '10.0',
    trade_thesis: `${d.symbol ?? 'Token'} at $${entryPrice.toFixed(8)}. Market cap ${d.market_cap ? `$${(d.market_cap / 1e6).toFixed(2)}M` : 'unknown'}. Review the DexScreener chart and fill in your trade thesis.`,
    risk_notes: `Stop loss set at ${slPct}% below entry ($${stopLoss.toFixed(8)}). Adjust based on your risk tolerance.`,
    support_levels: 'Review chart',
    resistance_levels: 'Review chart',
    notes: '',
    screenshot: hasScreenshot ? 'uploaded' : null,
  };
}

function QuickJournal({ onSaveTrade, onCancel }: {
  onSaveTrade: (trade: Omit<Trade, 'id' | 'created_at' | 'pnl' | 'rr_ratio'>) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<JournalStep>('input');
  const [contractAddress, setContractAddress] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState('');
  const [dragging, setDragging] = useState(false);
  const [generated, setGenerated] = useState<GeneratedJournalData | null>(null);
  const [generatingPhase, setGeneratingPhase] = useState(0);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generatingMessages = [
    'Fetching token data…',
    'Analyzing price action…',
    'Identifying setup type…',
    'Generating trade thesis…',
    'Calculating risk levels…',
    'Finalizing journal entry…',
  ];

  const handleFileRead = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setScreenshotName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => setScreenshot(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileRead(file);
  };

  const handleGenerate = async () => {
    if (!contractAddress.trim()) return;
    setStep('generating');
    setGeneratingPhase(0);

    // Advance visual steps while fetching
    const interval = setInterval(() => {
      setGeneratingPhase(p => Math.min(p + 1, generatingMessages.length - 1));
    }, 600);

    try {
      const data = await fetchJournalData(contractAddress.trim(), !!screenshot);
      clearInterval(interval);
      setGeneratingPhase(generatingMessages.length);
      if (screenshot) data.screenshot = screenshot;
      setGenerated(data);
      await new Promise(r => setTimeout(r, 200));
      setStep('review');
    } catch (err) {
      clearInterval(interval);
      setGenerated(null);
      setStep('input');
      alert(err instanceof Error ? err.message : 'Failed to fetch token data.');
    }
  };

  const handleSave = () => {
    if (!generated) return;
    onSaveTrade({
      token_name: generated.token_name,
      contract_address: generated.contract_address,
      entry_price: parseFloat(generated.entry_price) || 0,
      exit_price: null,
      stop_loss: parseFloat(generated.stop_loss) || null,
      take_profit: parseFloat(generated.take_profit) || null,
      position_size: parseFloat(generated.position_size) || 0,
      setup_type: generated.setup_type,
      notes: [
        `Ticker: ${generated.ticker}`,
        `Market Cap: ${generated.market_cap} | Liq: ${generated.liquidity} | Vol 24h: ${generated.volume_24h}`,
        `Age: ${generated.token_age}`,
        ``,
        `THESIS: ${generated.trade_thesis}`,
        ``,
        `RISK: ${generated.risk_notes}`,
        ``,
        `Support: ${generated.support_levels}`,
        `Resistance: ${generated.resistance_levels}`,
        generated.notes ? `\nNotes: ${generated.notes}` : '',
      ].filter(Boolean).join('\n'),
      screenshots: generated.screenshot && generated.screenshot !== 'uploaded' ? [generated.screenshot] : [],
      status: 'open',
    });
    setSaved(true);
    setTimeout(() => onCancel(), 1200);
  };

  const handleReset = () => {
    setStep('input');
    setContractAddress('');
    setScreenshot(null);
    setScreenshotName('');
    setGenerated(null);
    setSaved(false);
  };

  if (saved) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <p className="text-white font-bold text-lg">Trade saved!</p>
          <p className="text-gray-500 text-sm mt-1">Redirecting to dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/30 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            Quick Journal
          </h2>
          <p className="text-xs text-gray-500 mt-1 ml-10.5">Paste a contract address — get a complete trade journal in seconds</p>
        </div>
        {step !== 'input' && (
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 bg-gray-800/60 hover:bg-gray-800 border border-gray-700/50 rounded-lg transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Start over
          </button>
        )}
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-2">
        {(['input', 'generating', 'review'] as JournalStep[]).map((s, i) => {
          const labels = ['Paste Address', 'Generating', 'Review & Save'];
          const isDone = step === 'review' && s !== 'review' || (step === 'generating' && s === 'input');
          const isActive = step === s;
          return (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isActive ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400' :
                isDone ? 'bg-gray-800/40 border border-gray-700/30 text-gray-500' :
                'bg-gray-900/40 border border-gray-800/30 text-gray-700'
              }`}>
                {isDone ? <Check className="w-3 h-3" /> : <span className="w-3 h-3 flex items-center justify-center text-[10px] font-bold">{i + 1}</span>}
                {labels[i]}
              </div>
              {i < 2 && <div className={`flex-1 h-px ${isDone || (isActive && i > 0) ? 'bg-emerald-500/30' : 'bg-gray-800/60'}`} />}
            </React.Fragment>
          );
        })}
      </div>

      {/* ── Step 1: Input ──────────────────────────────────────────────────────── */}
      {step === 'input' && (
        <div className="space-y-4">
          <div className="bg-[#0e1016]/80 border border-gray-800/60 rounded-2xl p-6 space-y-5">
            {/* Contract address input */}
            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2 font-semibold">
                Token Contract Address
              </label>
              <div className="relative">
                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                <input
                  type="text"
                  value={contractAddress}
                  onChange={e => setContractAddress(e.target.value)}
                  placeholder="Paste Solana contract address…"
                  className="w-full bg-gray-900/60 border border-gray-800 rounded-xl pl-11 pr-4 py-3.5 text-sm text-white placeholder-gray-600 font-mono focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                  onKeyDown={e => e.key === 'Enter' && contractAddress.trim() && handleGenerate()}
                />
                {contractAddress && (
                  <button onClick={() => setContractAddress('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Screenshot drag-and-drop */}
            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2 font-semibold">
                Chart Screenshot <span className="text-gray-700 normal-case tracking-normal font-normal">(optional)</span>
              </label>
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
                  dragging
                    ? 'border-emerald-500/60 bg-emerald-500/8'
                    : screenshot
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-gray-700/60 bg-gray-900/30 hover:border-gray-600 hover:bg-gray-900/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleFileRead(e.target.files[0])}
                />
                {screenshot ? (
                  <div className="flex items-center justify-center gap-3">
                    <img src={screenshot} alt="chart" className="w-16 h-10 object-cover rounded-lg border border-emerald-500/30" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-emerald-400">Screenshot attached</p>
                      <p className="text-xs text-gray-500 truncate max-w-[200px]">{screenshotName}</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setScreenshot(null); setScreenshotName(''); }}
                      className="ml-auto p-1.5 text-gray-600 hover:text-red-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <Upload className={`w-6 h-6 mx-auto mb-2 transition-colors ${dragging ? 'text-emerald-400' : 'text-gray-600'}`} />
                    <p className="text-sm text-gray-500">
                      <span className="text-gray-400 font-medium">Drop a chart screenshot</span> or click to browse
                    </p>
                    <p className="text-xs text-gray-700 mt-1">PNG, JPG, WebP supported</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={!contractAddress.trim()}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-bold hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2.5 hover:shadow-emerald-500/30 hover:scale-[1.01]"
          >
            <Sparkles className="w-4 h-4" />
            Generate Journal Entry
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Step 2: Generating ─────────────────────────────────────────────────── */}
      {step === 'generating' && (
        <div className="bg-[#0e1016]/80 border border-gray-800/60 rounded-2xl p-12 flex flex-col items-center">
          {/* Animated rings */}
          <div className="relative w-24 h-24 mb-8">
            <div className="absolute inset-0 rounded-full border-2 border-emerald-500/10 animate-ping" style={{ animationDuration: '2s' }} />
            <div className="absolute inset-2 rounded-full border-2 border-emerald-500/20 animate-ping" style={{ animationDuration: '1.6s', animationDelay: '0.2s' }} />
            <div className="absolute inset-4 rounded-full border-2 border-emerald-500/30 animate-spin" style={{ animationDuration: '3s' }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-cyan-500/20 border border-emerald-500/40 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
          </div>

          <h3 className="text-white font-bold text-lg mb-2">Analyzing Token</h3>
          <p className="text-xs font-mono text-gray-600 mb-6 truncate max-w-[280px]">{contractAddress}</p>

          {/* Progress steps */}
          <div className="w-full max-w-sm space-y-2">
            {generatingMessages.map((msg, i) => {
              const isDone = generatingPhase > i;
              const isActive = generatingPhase === i;
              return (
                <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-300 ${
                  isDone ? 'bg-emerald-500/8 border border-emerald-500/15' :
                  isActive ? 'bg-gray-800/60 border border-gray-700/50' :
                  'opacity-30'
                }`}>
                  <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                    {isDone ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : isActive ? (
                      <div className="w-3.5 h-3.5 border-2 border-gray-500 border-t-emerald-400 rounded-full animate-spin" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-gray-700" />
                    )}
                  </div>
                  <span className={`text-xs font-medium ${isDone ? 'text-emerald-400' : isActive ? 'text-gray-300' : 'text-gray-700'}`}>{msg}</span>
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="w-full max-w-sm mt-6 h-1 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
              style={{ width: `${(generatingPhase / generatingMessages.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Step 3: Review & Edit ──────────────────────────────────────────────── */}
      {step === 'review' && generated && (
        <ReviewStep generated={generated} setGenerated={setGenerated} onSave={handleSave} onBack={handleReset} />
      )}
    </div>
  );
}

function ReviewStep({ generated, setGenerated, onSave, onBack }: {
  generated: GeneratedJournalData;
  setGenerated: (d: GeneratedJournalData) => void;
  onSave: () => void;
  onBack: () => void;
}) {
  const set = (key: keyof GeneratedJournalData) => (val: string) =>
    setGenerated({ ...generated, [key]: val });

  const setupType = SETUP_TYPES.find(s => s.value === generated.setup_type);

  return (
    <div className="space-y-4">
      {/* AI notice */}
      <div className="flex items-start gap-3 px-4 py-3 bg-amber-500/8 border border-amber-500/20 rounded-xl">
        <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-400/90 leading-relaxed">
          Live token data fetched from Birdeye. Review all fields, fill in your trade thesis, then save to your trade log.
        </p>
      </div>

      {/* Token overview card */}
      <div className="bg-[#0e1016]/80 border border-gray-800/60 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-800/60 bg-gradient-to-r from-emerald-500/5 to-transparent">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center font-bold text-emerald-400 text-sm flex-shrink-0">
            {generated.ticker.slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <EditableField value={generated.token_name} onChange={set('token_name')} className="text-base font-bold text-white" />
              <span className="text-gray-600">/</span>
              <EditableField value={generated.ticker} onChange={set('ticker')} className="text-sm font-bold text-emerald-400" />
            </div>
            <p className="text-[10px] text-gray-600 font-mono truncate">{generated.contract_address}</p>
          </div>
          <a
            href={generated.dexscreener_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg text-xs hover:bg-blue-500/20 transition-colors flex-shrink-0"
          >
            <Globe className="w-3.5 h-3.5" />
            DexScreener
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Token metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-gray-800/50">
          {[
            { icon: BarChart2, label: 'Market Cap', key: 'market_cap' as const, color: 'text-cyan-400' },
            { icon: Droplets, label: 'Liquidity', key: 'liquidity' as const, color: 'text-blue-400' },
            { icon: Activity, label: 'Vol 24h', key: 'volume_24h' as const, color: 'text-emerald-400' },
            { icon: ClockIcon, label: 'Token Age', key: 'token_age' as const, color: 'text-orange-400' },
          ].map(({ icon: Icon, label, key, color }) => (
            <div key={key} className="px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className={`w-3 h-3 ${color}`} />
                <span className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold">{label}</span>
              </div>
              <EditableField value={generated[key] as string} onChange={set(key)} className={`text-sm font-bold ${color}`} />
            </div>
          ))}
        </div>
      </div>

      {/* Setup type + price levels */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Setup type */}
        <div className="bg-[#0e1016]/80 border border-gray-800/60 rounded-2xl p-5">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-3">Setup Type</p>
          <div className="flex flex-wrap gap-2">
            {SETUP_TYPES.map(s => (
              <button
                key={s.value}
                onClick={() => set('setup_type')(s.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  generated.setup_type === s.value ? s.color : 'bg-gray-800/40 text-gray-600 border-gray-700/40 hover:border-gray-600'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Price levels */}
        <div className="bg-[#0e1016]/80 border border-gray-800/60 rounded-2xl p-5">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-3">Price Levels</p>
          <div className="space-y-2">
            {[
              { label: 'Entry', key: 'entry_price' as const, color: 'text-emerald-400' },
              { label: 'Stop Loss', key: 'stop_loss' as const, color: 'text-red-400' },
              { label: 'Take Profit', key: 'take_profit' as const, color: 'text-cyan-400' },
              { label: 'Size (SOL)', key: 'position_size' as const, color: 'text-orange-400' },
            ].map(({ label, key, color }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{label}</span>
                <EditableField value={generated[key] as string} onChange={set(key)} className={`text-xs font-bold font-mono ${color} text-right`} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Support & Resistance */}
      <div className="bg-[#0e1016]/80 border border-gray-800/60 rounded-2xl p-5">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-3 flex items-center gap-1.5">
          <Crosshair className="w-3.5 h-3.5" /> Key Levels
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-emerald-500 mb-1.5 font-medium uppercase tracking-wider">Support</p>
            <EditableField value={generated.support_levels} onChange={set('support_levels')} className="text-xs text-gray-300 font-mono w-full" multiline />
          </div>
          <div>
            <p className="text-[10px] text-red-500 mb-1.5 font-medium uppercase tracking-wider">Resistance</p>
            <EditableField value={generated.resistance_levels} onChange={set('resistance_levels')} className="text-xs text-gray-300 font-mono w-full" multiline />
          </div>
        </div>
      </div>

      {/* Trade thesis */}
      <div className="bg-[#0e1016]/80 border border-gray-800/60 rounded-2xl p-5">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-3 flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5" /> Trade Thesis
        </p>
        <EditableField value={generated.trade_thesis} onChange={set('trade_thesis')} className="text-sm text-gray-300 leading-relaxed w-full" multiline />
      </div>

      {/* Risk notes */}
      <div className="bg-[#0e1016]/80 border border-gray-800/60 rounded-2xl p-5">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-3 flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-red-400" /> Risk Notes
        </p>
        <EditableField value={generated.risk_notes} onChange={set('risk_notes')} className="text-sm text-gray-300 leading-relaxed w-full" multiline />
      </div>

      {/* Screenshot preview */}
      {generated.screenshot && generated.screenshot !== 'uploaded' && (
        <div className="bg-[#0e1016]/80 border border-gray-800/60 rounded-2xl p-5">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-3">Chart Screenshot</p>
          <img src={generated.screenshot} alt="chart" className="w-full rounded-xl border border-gray-800/60 max-h-64 object-contain bg-gray-900/40" />
        </div>
      )}

      {/* Personal notes */}
      <div className="bg-[#0e1016]/80 border border-gray-800/60 rounded-2xl p-5">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-3 flex items-center gap-1.5">
          <Edit3 className="w-3.5 h-3.5" /> Your Notes <span className="text-gray-700 normal-case tracking-normal font-normal text-[10px]">(optional)</span>
        </p>
        <textarea
          value={generated.notes}
          onChange={e => set('notes')(e.target.value)}
          placeholder="Add any personal observations or context…"
          rows={3}
          className="w-full bg-gray-900/60 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-300 placeholder-gray-700 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/15 transition-all resize-none"
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 pb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-3 bg-gray-800/60 border border-gray-700/50 text-gray-400 rounded-xl text-sm font-medium hover:bg-gray-800 hover:text-gray-200 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Start Over
        </button>
        <button
          onClick={onSave}
          className="flex-1 flex items-center justify-center gap-2.5 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-bold hover:from-emerald-400 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:scale-[1.01]"
        >
          <Save className="w-4 h-4" />
          Save Trade to Journal
          <span className={`px-2 py-0.5 rounded text-[10px] border ${setupType?.color}`}>{setupType?.label}</span>
        </button>
      </div>
    </div>
  );
}

function EditableField({ value, onChange, className, multiline = false }: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    if (multiline) {
      return (
        <textarea
          autoFocus
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          rows={Math.max(2, value.split('\n').length)}
          className={`bg-gray-900/80 border border-emerald-500/40 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 resize-none leading-relaxed ${className}`}
        />
      );
    }
    return (
      <input
        autoFocus
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={e => e.key === 'Enter' && setEditing(false)}
        className={`bg-gray-900/80 border border-emerald-500/40 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 min-w-[60px] ${className}`}
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="Click to edit"
      className={`group relative text-left hover:opacity-80 transition-opacity ${className}`}
    >
      {value || <span className="text-gray-600 italic text-xs">click to edit</span>}
      <Edit3 className="w-2.5 h-2.5 text-gray-700 group-hover:text-gray-400 inline ml-1.5 transition-colors flex-shrink-0" />
    </button>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin"></div>
        </div>
        <p className="text-gray-500 text-sm">Loading your trades...</p>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-16">
      <div className="w-20 h-20 rounded-2xl bg-gray-800/50 flex items-center justify-center mx-auto mb-4 border border-gray-700/50">
        <Target className="w-10 h-10 text-gray-600" />
      </div>
      <p className="text-gray-500 text-sm">{message}</p>
    </div>
  );
}

export default App;
