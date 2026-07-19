import React, { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { PriceSettings, CoatingType } from "./types";
import Navbar from "./components/Navbar";
import AuthCard from "./components/AuthCard";
import CalculatorView from "./components/CalculatorView";
import HistoryView from "./components/HistoryView";
import AdminPanel from "./components/AdminPanel";
import { Sparkles, Loader2, Info } from "lucide-react";
import { CurrencyCode, ExchangeRates, DEFAULT_RATES } from "./utils/currency";

const DEFAULT_COATINGS = {
  galvanic_nickel: { upper: 1.5, lower: 1.5, digits3cm: 1.5, digits4cm: 1.5, punctuation: 1.5 },
  galvanic_chrome: { upper: 1.8, lower: 1.8, digits3cm: 1.8, digits4cm: 1.8, punctuation: 1.8 },
  galvanic_gold: { upper: 2.5, lower: 2.5, digits3cm: 2.5, digits4cm: 2.5, punctuation: 2.5 },
  black_paint: { upper: 1.2, lower: 1.2, digits3cm: 1.2, digits4cm: 1.2, punctuation: 1.2 },
  white_paint: { upper: 1.2, lower: 1.2, digits3cm: 1.2, digits4cm: 1.2, punctuation: 1.2 },
};

const DEFAULT_SETTINGS: PriceSettings = {
  upper: 0.50,
  lower: 0.10,
  digits: 0.15,
  digits3cm: 0.15,
  digits4cm: 0.25,
  punctuation: 0.20,
  coatings: DEFAULT_COATINGS
};

const mergeWithDefaults = (loaded: any): PriceSettings => {
  const parsed = loaded ? (typeof loaded === "string" ? JSON.parse(loaded) : loaded) : {};
  return {
    ...DEFAULT_SETTINGS,
    ...parsed,
    coatings: {
      ...DEFAULT_SETTINGS.coatings,
      ...(parsed.coatings || {})
    }
  };
};

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDemoAdmin, setIsDemoAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState("calculator");
  const [settings, setSettings] = useState<PriceSettings>(DEFAULT_SETTINGS);
  const [loadedText, setLoadedText] = useState("");
  const [loadedCoating, setLoadedCoating] = useState<CoatingType | undefined>(undefined);

  const [rates, setRates] = useState<ExchangeRates>(DEFAULT_RATES);
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(() => {
    const saved = localStorage.getItem("selected_display_currency");
    if (saved === "EUR" || saved === "UAH" || saved === "USD") {
      return saved as CurrencyCode;
    }
    return "EUR";
  });

  useEffect(() => {
    localStorage.setItem("selected_display_currency", selectedCurrency);
  }, [selectedCurrency]);

  useEffect(() => {
    const CACHE_KEY = "exchange_rates_cache";
    const CACHE_EXPIRY = 2 * 60 * 60 * 1000; // 2 hours in ms

    const fetchRates = async () => {
      // First, try to read from cache to see if we can avoid fetching
      try {
        const cachedStr = localStorage.getItem(CACHE_KEY);
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          const age = Date.now() - cached.timestamp;
          if (age < CACHE_EXPIRY) {
            console.log("Using cached exchange rates (age:", Math.round(age / 1000 / 60), "minutes)");
            setRates(cached.rates);
            return;
          }
        }
      } catch (err) {
        console.warn("Could not read exchange rates cache:", err);
      }

      // If cache expired or is empty, fetch fresh rates
      try {
        console.log("Fetching fresh exchange rates from API...");
        const parseValue = (val: any, fallback: number) => {
          if (val === undefined || val === null) return fallback;
          const str = String(val).replace(",", ".").trim();
          const parsed = parseFloat(str);
          return isNaN(parsed) ? fallback : parsed;
        };

        const eurPromise = fetch("https://nn2sc6e5c5.execute-api.eu-north-1.amazonaws.com/bestobmin-parser-API/rate/EUR")
          .then(res => res.json())
          .then(data => {
            const target = data && data.rate ? data.rate : data;
            const buy = parseValue(target?.buy, DEFAULT_RATES.eurDetail!.buy);
            const sell = parseValue(target?.sell, DEFAULT_RATES.eurDetail!.sell);
            return { buy, sell };
          })
          .catch(() => DEFAULT_RATES.eurDetail!);

        const usdPromise = fetch("https://nn2sc6e5c5.execute-api.eu-north-1.amazonaws.com/bestobmin-parser-API/rate/USDnew")
          .then(res => res.json())
          .then(data => {
            const target = data && data.rate ? data.rate : data;
            const buy = parseValue(target?.buy, DEFAULT_RATES.usdDetail!.buy);
            const sell = parseValue(target?.sell, DEFAULT_RATES.usdDetail!.sell);
            return { buy, sell };
          })
          .catch(() => DEFAULT_RATES.usdDetail!);

        const [eurData, usdData] = await Promise.all([eurPromise, usdPromise]);
        const newRates: ExchangeRates = {
          EUR: eurData.sell,
          USD: usdData.sell,
          eurDetail: eurData,
          usdDetail: usdData
        };

        setRates(newRates);

        // Save to cache
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            rates: newRates
          }));
        } catch (err) {
          console.warn("Could not write exchange rates to cache:", err);
        }
      } catch (err) {
        console.error("Error fetching exchange rates:", err);
      }
    };

    // Load initial state from cache immediately to prevent layout shifts
    try {
      const cachedStr = localStorage.getItem(CACHE_KEY);
      if (cachedStr) {
        const cached = JSON.parse(cachedStr);
        setRates(cached.rates);
      }
    } catch (e) {}

    const handleFocusCheck = () => {
      if (document.visibilityState === "visible") {
        fetchRates();
      }
    };

    // Perform check on mount
    if (document.visibilityState === "visible") {
      fetchRates();
    }

    window.addEventListener("focus", handleFocusCheck);
    document.addEventListener("visibilitychange", handleFocusCheck);

    return () => {
      window.removeEventListener("focus", handleFocusCheck);
      document.removeEventListener("visibilitychange", handleFocusCheck);
    };
  }, []);
  
  const handleGuestLogin = () => {
    setUser({
      uid: "local-guest",
      email: "guest@local.net",
      displayName: "Гість (Локально)",
      isGuest: true
    });
    setIsDemoAdmin(true); // Allow guests to play with the admin panel too!
  };

  const handleSignOut = () => {
    setUser(null);
    setIsAdmin(false);
    setIsDemoAdmin(false);
    setActiveTab("calculator");
  };

  // Listen to Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Fetch user profile to check admin status
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setIsAdmin(!!userData.isAdmin);
          } else {
            // If they are Taras, promote to admin by default
            const isDefaultAdmin = currentUser.email?.toLowerCase() === "yavorskyy.taras@gmail.com";
            setIsAdmin(isDefaultAdmin);
            
            // Save their user document
            await setDoc(doc(db, "users", currentUser.uid), {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName || currentUser.email?.split("@")[0] || "Користувач",
              isAdmin: isDefaultAdmin,
              createdAt: new Date()
            });
          }
        } catch (err) {
          console.error("Error reading user doc:", err);
          // Fallback check
          if (currentUser.email?.toLowerCase() === "yavorskyy.taras@gmail.com") {
            setIsAdmin(true);
          }
        }
      } else {
        setUser(prev => {
          if (prev && prev.isGuest) return prev;
          setIsAdmin(false);
          setIsDemoAdmin(false);
          return null;
        });
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch Pricing Settings
  const fetchSettings = async () => {
    if (!auth.currentUser || (user && user.isGuest)) {
      const localSettings = localStorage.getItem("local_price_settings");
      if (localSettings) {
        try {
          setSettings(mergeWithDefaults(JSON.parse(localSettings)));
        } catch {
          setSettings(DEFAULT_SETTINGS);
        }
      } else {
        const localStandard = localStorage.getItem("local_standard_price_settings");
        if (localStandard) {
          try {
            setSettings(mergeWithDefaults(JSON.parse(localStandard)));
          } catch {
            setSettings(DEFAULT_SETTINGS);
          }
        } else {
          setSettings(DEFAULT_SETTINGS);
        }
      }
      return;
    }
    try {
      const docRef = doc(db, "settings", "prices");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setSettings(mergeWithDefaults(docSnap.data()));
      } else {
        // Try to fetch standard prices as a fallback first
        const standardRef = doc(db, "settings", "standard_prices");
        const standardSnap = await getDoc(standardRef);
        if (standardSnap.exists()) {
          const standardData = standardSnap.data();
          setSettings(mergeWithDefaults(standardData));
          
          // Write these to active prices so we don't have to fetch standard every time
          try {
            await setDoc(docRef, standardData);
          } catch (writeErr) {
            console.warn("Could not save active settings to Firestore:", writeErr);
          }
        } else {
          setSettings(DEFAULT_SETTINGS);
          // Only write default to DB if the user has admin/demo admin role or is Taras
          const isTaras = auth.currentUser.email?.toLowerCase() === "yavorskyy.taras@gmail.com";
          if (isAdmin || isDemoAdmin || isTaras) {
            try {
              await setDoc(docRef, DEFAULT_SETTINGS);
            } catch (writeErr) {
              console.warn("Could not save default settings to Firestore:", writeErr);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
      setSettings(DEFAULT_SETTINGS);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  const handleLoadRecord = (text: string, coating?: CoatingType) => {
    setLoadedText(text);
    setLoadedCoating(coating);
    setActiveTab("calculator");
  };

  const handleToggleDemoAdmin = () => {
    setIsDemoAdmin(prev => !prev);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-slate-900" />
          <h2 className="text-sm font-semibold text-slate-700 font-mono tracking-wider uppercase">
            Завантаження додатку...
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafbfc] text-slate-900 flex flex-col font-sans" id="app-root">
      {user ? (
        <>
          <Navbar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            isAdmin={isAdmin}
            userEmail={user.email || ""}
            displayName={user.displayName || ""}
            isDemoAdmin={isDemoAdmin}
            toggleDemoAdmin={handleToggleDemoAdmin}
            onSignOut={handleSignOut}
            rates={rates}
          />

          <main className="flex-grow mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {activeTab === "calculator" && (
              <CalculatorView
                settings={settings}
                userId={user.uid}
                userEmail={user.email || ""}
                userDisplayName={user.displayName || ""}
                initialText={loadedText}
                initialCoating={loadedCoating}
                onRecordSaved={() => {
                  // clean state after save
                  setLoadedText("");
                  setLoadedCoating(undefined);
                }}
                selectedCurrency={selectedCurrency}
                setSelectedCurrency={setSelectedCurrency}
                rates={rates}
              />
            )}

            {activeTab === "history" && (
              <HistoryView
                userId={user.uid}
                isAdmin={isAdmin || isDemoAdmin}
                onLoadRecord={handleLoadRecord}
                selectedCurrency={selectedCurrency}
                rates={rates}
              />
            )}

            {activeTab === "admin" && (isAdmin || isDemoAdmin) && (
              <AdminPanel
                settings={settings}
                onSettingsUpdated={(newSettings) => setSettings(newSettings)}
                isDemoAdmin={isDemoAdmin}
                isGuest={user.isGuest}
                selectedCurrency={selectedCurrency}
                setSelectedCurrency={setSelectedCurrency}
                rates={rates}
              />
            )}
          </main>
        </>
      ) : (
        <div className="flex-grow flex items-center justify-center p-4 md:p-8">
          <AuthCard onAuthSuccess={fetchSettings} onGuestLogin={handleGuestLogin} />
        </div>
      )}

      {/* Footer */}
      <footer className="py-6 border-t border-slate-100 bg-white text-center text-xs text-slate-400 font-mono">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>TextCost Calc &copy; {new Date().getFullYear()} — Мобільний додаток для розрахунку вартості тексту.</p>
          <div className="flex gap-4">
            <span className="hover:text-slate-600 cursor-help" title="Пробіли не рахуються. Діють спеціальні правила розрахунку.">
              Правила підрахунку
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
