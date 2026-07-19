import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import { BookOpen, History, Settings, LogOut, Shield, Sparkles, User } from "lucide-react";
import { ExchangeRates } from "../utils/currency";

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isAdmin: boolean;
  userEmail: string;
  displayName: string;
  isDemoAdmin: boolean;
  toggleDemoAdmin: () => void;
  onSignOut?: () => void;
  rates: ExchangeRates;
}

export default function Navbar({
  activeTab,
  setActiveTab,
  isAdmin,
  userEmail,
  displayName,
  isDemoAdmin,
  toggleDemoAdmin,
  onSignOut,
  rates
}: NavbarProps) {
  const handleSignOut = () => {
    signOut(auth);
    if (onSignOut) {
      onSignOut();
    }
  };

  const showAdminTab = isAdmin || isDemoAdmin;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-100 bg-white" id="app-header">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div 
              className="flex h-10 w-10 items-center justify-center rounded-xl shadow-sm"
              style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
            >
              <Sparkles className="h-5 w-5" style={{ color: '#ffffff' }} />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-none text-slate-900 tracking-tight">
                Ціна Тексту
              </h1>
              <span className="text-[10px] font-medium text-slate-500 font-mono tracking-wider uppercase block leading-[0.8]">
                Аналізатор & Калькулятор
              </span>
            </div>
          </div>

          {/* Desktop Exchange Rates */}
          <div className="hidden lg:flex items-center gap-3 text-xs font-mono border-l border-slate-100 pl-3">
            <div className="flex flex-col">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-0.5">EUR</span>
              <span className="text-[11px] font-medium text-slate-700 leading-none">
                <span className="text-emerald-600 font-bold" title="Купівля">{(rates.eurDetail?.buy ?? 45.0).toFixed(2)}₴</span>
                <span className="text-slate-300 mx-1">/</span>
                <span className="text-rose-600 font-bold" title="Продаж">{(rates.eurDetail?.sell ?? rates.EUR ?? 45.8).toFixed(2)}₴</span>
              </span>
            </div>
            <div className="h-6 w-px bg-slate-100"></div>
            <div className="flex flex-col">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-0.5">USD</span>
              <span className="text-[11px] font-medium text-slate-700 leading-none">
                <span className="text-emerald-600 font-bold" title="Купівля">{(rates.usdDetail?.buy ?? 41.5).toFixed(2)}₴</span>
                <span className="text-slate-300 mx-1">/</span>
                <span className="text-rose-600 font-bold" title="Продаж">{(rates.usdDetail?.sell ?? rates.USD ?? 42.1).toFixed(2)}₴</span>
              </span>
            </div>
          </div>

          {/* Navigation links for Desktop & Mobile */}
          <nav className="flex items-center gap-1.5 md:gap-2">
            <button
              onClick={() => setActiveTab("calculator")}
              id="nav-tab-calculator"
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "calculator"
                  ? "text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
              style={
                activeTab === "calculator"
                  ? { backgroundColor: '#0f172a', color: '#ffffff' }
                  : undefined
              }
            >
              <BookOpen className="h-3.5 w-3.5" style={activeTab === "calculator" ? { color: '#ffffff' } : undefined} />
              <span className="hidden sm:inline">Калькулятор</span>
            </button>

            <button
              onClick={() => setActiveTab("history")}
              id="nav-tab-history"
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "history"
                  ? "text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
              style={
                activeTab === "history"
                  ? { backgroundColor: '#0f172a', color: '#ffffff' }
                  : undefined
              }
            >
              <History className="h-3.5 w-3.5" style={activeTab === "history" ? { color: '#ffffff' } : undefined} />
              <span className="hidden sm:inline">Історія</span>
            </button>

            {showAdminTab && (
              <button
                onClick={() => setActiveTab("admin")}
                id="nav-tab-admin"
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "admin"
                    ? "text-white shadow-sm"
                    : "text-amber-700 bg-amber-50 hover:bg-amber-100/80"
                }`}
                style={
                  activeTab === "admin"
                    ? { backgroundColor: '#0f172a', color: '#ffffff' }
                    : undefined
                }
              >
                <Settings className="h-3.5 w-3.5" style={activeTab === "admin" ? { color: '#ffffff' } : undefined} />
                <span className="hidden sm:inline">Налаштування</span>
              </button>
            )}
          </nav>

          {/* User profile & controls */}
          <div className="flex items-center gap-2">
            
            {/* Demo admin toggle */}
            {!isAdmin && (
              <button
                onClick={toggleDemoAdmin}
                id="demo-admin-toggle"
                className={`hidden lg:flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-mono transition-all cursor-pointer ${
                  isDemoAdmin 
                    ? "bg-amber-500/10 border-amber-300 text-amber-700 font-semibold"
                    : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                }`}
                title="Дозволяє переглянути адмін-панель для тестів"
              >
                <Shield className="w-3.5 h-3.5" />
                Demo Admin: {isDemoAdmin ? "ON" : "OFF"}
              </button>
            )}

            <div className="hidden md:flex flex-col items-end text-right">
              <span className="text-xs font-semibold text-slate-900 max-w-[120px] truncate">
                {displayName || userEmail}
              </span>
              <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                {userEmail}
              </span>
            </div>

            <div className="h-4 w-px bg-slate-200 hidden md:block"></div>

            <button
              onClick={handleSignOut}
              id="logout-btn"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-rose-600 transition-all cursor-pointer active:scale-95"
              title="Вийти"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

        </div>
      </div>
      
      {/* Small notification bar for Demo Admin on mobile */}
      {!isAdmin && (
        <div className="lg:hidden flex items-center justify-center gap-2 bg-slate-50 border-t border-slate-100 py-1 px-4 text-[10px] text-slate-500 font-mono">
          <span>Режим розробника:</span>
          <button
            onClick={toggleDemoAdmin}
            id="mobile-demo-admin-btn"
            className={`px-1.5 py-0.5 rounded border text-[9px] transition-all cursor-pointer ${
              isDemoAdmin 
                ? "bg-amber-50 border-amber-300 text-amber-700 font-bold" 
                : "bg-white border-slate-200 text-slate-500"
            }`}
          >
            Demo Admin: {isDemoAdmin ? "УВІМК" : "ВИМК"}
          </button>
        </div>
      )}

      {/* Exchange rates bar for mobile / tablet */}
      <div className="lg:hidden flex items-center justify-around bg-slate-50/80 backdrop-blur-sm border-t border-slate-100 py-1.5 px-4 text-[10px] text-slate-600 font-mono">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-slate-400">EUR:</span>
          <span className="text-emerald-600 font-bold" title="Купівля">{(rates.eurDetail?.buy ?? 45.0).toFixed(2)} ₴</span>
          <span className="text-slate-300">/</span>
          <span className="text-rose-600 font-bold" title="Продаж">{(rates.eurDetail?.sell ?? rates.EUR ?? 45.8).toFixed(2)} ₴</span>
        </div>
        <div className="h-3 w-px bg-slate-200"></div>
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-slate-400">USD:</span>
          <span className="text-emerald-600 font-bold" title="Купівля">{(rates.usdDetail?.buy ?? 41.5).toFixed(2)} ₴</span>
          <span className="text-slate-300">/</span>
          <span className="text-rose-600 font-bold" title="Продаж">{(rates.usdDetail?.sell ?? rates.USD ?? 42.1).toFixed(2)} ₴</span>
        </div>
      </div>
    </header>
  );
}
