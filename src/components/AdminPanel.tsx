import React, { useState, useEffect } from "react";
import { PriceSettings, COATING_LABELS, CoatingType } from "../types";
import { db } from "../firebase";
import { doc, setDoc, getDoc, collection, addDoc, getDocs, deleteDoc } from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import { Settings, Save, RefreshCcw, CheckCircle, ShieldAlert, Coins, Sparkles, FolderHeart, Plus, Trash2, Layers, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { CurrencyCode, ExchangeRates, convertEurTo, convertToEur, CURRENCY_SYMBOLS, CURRENCY_LABELS } from "../utils/currency";

interface AdminPanelProps {
  settings: PriceSettings;
  onSettingsUpdated: (newSettings: PriceSettings) => void;
  isDemoAdmin: boolean;
  isGuest?: boolean;
  selectedCurrency: CurrencyCode;
  setSelectedCurrency: (currency: CurrencyCode) => void;
  rates: ExchangeRates;
}

export default function AdminPanel({
  settings,
  onSettingsUpdated,
  isDemoAdmin,
  isGuest,
  selectedCurrency,
  setSelectedCurrency,
  rates
}: AdminPanelProps) {
  const [upperPrice, setUpperPrice] = useState(settings.upper.toString());
  const [lowerPrice, setLowerPrice] = useState(settings.lower.toString());
  const [digits3cmPrice, setDigits3cmPrice] = useState((settings.digits3cm !== undefined ? settings.digits3cm : settings.digits).toString());
  const [digits4cmPrice, setDigits4cmPrice] = useState((settings.digits4cm !== undefined ? settings.digits4cm : 0.25).toString());
  const [punctuationPrice, setPunctuationPrice] = useState(settings.punctuation.toString());

  // Helper to initialize coatingsState
  const getInitialCoatingsState = (settingsObj: PriceSettings) => {
    const defaults = {
      galvanic_nickel: { upper: "1.5", lower: "1.5", digits3cm: "1.5", digits4cm: "1.5", punctuation: "1.5" },
      galvanic_chrome: { upper: "1.8", lower: "1.8", digits3cm: "1.8", digits4cm: "1.8", punctuation: "1.8" },
      galvanic_gold: { upper: "2.5", lower: "2.5", digits3cm: "2.5", digits4cm: "2.5", punctuation: "2.5" },
      black_paint: { upper: "1.2", lower: "1.2", digits3cm: "1.2", digits4cm: "1.2", punctuation: "1.2" },
      white_paint: { upper: "1.2", lower: "1.2", digits3cm: "1.2", digits4cm: "1.2", punctuation: "1.2" }
    };
    
    const state: any = {};
    Object.keys(defaults).forEach((key) => {
      const c = settingsObj.coatings?.[key] || (defaults as any)[key];
      state[key] = {
        upper: c.upper?.toString() || "1.0",
        lower: c.lower?.toString() || "1.0",
        digits3cm: c.digits3cm?.toString() || "1.0",
        digits4cm: c.digits4cm?.toString() || "1.0",
        punctuation: c.punctuation?.toString() || "1.0"
      };
    });
    return state;
  };

  const [coatingsState, setCoatingsState] = useState(() => getInitialCoatingsState(settings));
  const [showCoatings, setShowCoatings] = useState(false);
  
  const [saving, setSaving] = useState(false);
  const [savingStandard, setSavingStandard] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Presets states and handlers
  const [presets, setPresets] = useState<any[]>([]);
  const [loadingPresets, setLoadingPresets] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);

  const fetchPresets = async () => {
    setLoadingPresets(true);
    try {
      if (isGuest) {
        const stored = localStorage.getItem("local_price_presets");
        if (stored) {
          setPresets(JSON.parse(stored));
        } else {
          setPresets([]);
        }
      } else {
        const querySnapshot = await getDocs(collection(db, "price_presets"));
        const fetchedPresets: any[] = [];
        querySnapshot.forEach((doc) => {
          fetchedPresets.push({ id: doc.id, ...doc.data() });
        });
        fetchedPresets.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        setPresets(fetchedPresets);
      }
    } catch (err) {
      console.error("Error fetching presets:", err);
    } finally {
      setLoadingPresets(false);
    }
  };

  useEffect(() => {
    fetchPresets();
  }, [isGuest]);

  const handleCreatePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) {
      setError("Будь ласка, введіть назву пресету.");
      return;
    }

    setError("");
    setSuccess(false);
    setSavingPreset(true);

    const rawUpper = parseFloat(upperPrice);
    const rawLower = parseFloat(lowerPrice);
    const rawD3 = parseFloat(digits3cmPrice);
    const rawD4 = parseFloat(digits4cmPrice);
    const rawPunctuation = parseFloat(punctuationPrice);

    if (isNaN(rawUpper) || isNaN(rawLower) || isNaN(rawD3) || isNaN(rawD4) || isNaN(rawPunctuation)) {
      setError("Усі значення мають бути коректними числами для збереження пресету.");
      setSavingPreset(false);
      return;
    }

    if (rawUpper < 0 || rawLower < 0 || rawD3 < 0 || rawD4 < 0 || rawPunctuation < 0) {
      setError("Ціни не можуть бути меншими за 0.");
      setSavingPreset(false);
      return;
    }

    const upper = convertToEur(rawUpper, selectedCurrency, rates);
    const lower = convertToEur(rawLower, selectedCurrency, rates);
    const d3 = convertToEur(rawD3, selectedCurrency, rates);
    const d4 = convertToEur(rawD4, selectedCurrency, rates);
    const punctuation = convertToEur(rawPunctuation, selectedCurrency, rates);

    const presetData = {
      name: newPresetName.trim(),
      upper,
      lower,
      digits: d3, // fallback
      digits3cm: d3,
      digits4cm: d4,
      punctuation,
      createdAt: new Date().toISOString()
    };

    try {
      if (isGuest) {
        const stored = localStorage.getItem("local_price_presets");
        const existing = stored ? JSON.parse(stored) : [];
        const newPreset = { id: Date.now().toString(), ...presetData };
        const updated = [newPreset, ...existing];
        localStorage.setItem("local_price_presets", JSON.stringify(updated));
        setPresets(updated);
      } else {
        const docRef = await addDoc(collection(db, "price_presets"), presetData);
        setPresets(prev => [{ id: docRef.id, ...presetData }, ...prev]);
      }
      setNewPresetName("");
      setSuccessMessage(`Пресет "${presetData.name}" успішно створено!`);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error("Error saving preset:", err);
      setError(`Не вдалося зберегти пресет: ${err.message || err}`);
    } finally {
      setSavingPreset(false);
    }
  };

  const handleDeletePreset = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setError("");
    setSuccess(false);
    setDeletingPresetId(id);

    try {
      if (isGuest) {
        const stored = localStorage.getItem("local_price_presets");
        if (stored) {
          const existing = JSON.parse(stored);
          const updated = existing.filter((p: any) => p.id !== id);
          localStorage.setItem("local_price_presets", JSON.stringify(updated));
          setPresets(updated);
        }
      } else {
        await deleteDoc(doc(db, "price_presets", id));
        setPresets(prev => prev.filter(p => p.id !== id));
      }
      setSuccessMessage(`Пресет "${name}" успішно видалено.`);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error("Error deleting preset:", err);
      setError(`Не вдалося видалити пресет: ${err.message || err}`);
    } finally {
      setDeletingPresetId(null);
    }
  };

  const handleApplyPreset = (p: any) => {
    const displayU = convertEurTo(p.upper, selectedCurrency, rates).toFixed(2);
    const displayL = convertEurTo(p.lower, selectedCurrency, rates).toFixed(2);
    const d3Base = p.digits3cm !== undefined ? p.digits3cm : p.digits;
    const displayD3 = convertEurTo(d3Base, selectedCurrency, rates).toFixed(2);
    const d4Base = p.digits4cm !== undefined ? p.digits4cm : 0.25;
    const displayD4 = convertEurTo(d4Base, selectedCurrency, rates).toFixed(2);
    const displayP = convertEurTo(p.punctuation, selectedCurrency, rates).toFixed(2);

    setUpperPrice(displayU);
    setLowerPrice(displayL);
    setDigits3cmPrice(displayD3);
    setDigits4cmPrice(displayD4);
    setPunctuationPrice(displayP);

    setSuccessMessage(`Ціни з пресету "${p.name}" завантажено. Натисніть "Активувати ціни" нижче!`);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 4000);
  };

  // Keep in sync with parent settings updates and currency changes
  useEffect(() => {
    const u = convertEurTo(settings.upper, selectedCurrency, rates);
    const l = convertEurTo(settings.lower, selectedCurrency, rates);
    const d3Base = settings.digits3cm !== undefined ? settings.digits3cm : settings.digits;
    const d3 = convertEurTo(d3Base, selectedCurrency, rates);
    const d4Base = settings.digits4cm !== undefined ? settings.digits4cm : 0.25;
    const d4 = convertEurTo(d4Base, selectedCurrency, rates);
    const p = convertEurTo(settings.punctuation, selectedCurrency, rates);

    setUpperPrice(u.toFixed(2));
    setLowerPrice(l.toFixed(2));
    setDigits3cmPrice(d3.toFixed(2));
    setDigits4cmPrice(d4.toFixed(2));
    setPunctuationPrice(p.toFixed(2));
    setCoatingsState(getInitialCoatingsState(settings));
  }, [settings, selectedCurrency, rates]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setSaving(true);

    const rawUpper = parseFloat(upperPrice);
    const rawLower = parseFloat(lowerPrice);
    const rawD3 = parseFloat(digits3cmPrice);
    const rawD4 = parseFloat(digits4cmPrice);
    const rawPunctuation = parseFloat(punctuationPrice);

    if (isNaN(rawUpper) || isNaN(rawLower) || isNaN(rawD3) || isNaN(rawD4) || isNaN(rawPunctuation)) {
      setError("Усі значення цін мають бути коректними числами.");
      setSaving(false);
      return;
    }

    if (rawUpper < 0 || rawLower < 0 || rawD3 < 0 || rawD4 < 0 || rawPunctuation < 0) {
      setError("Ціни не можуть бути меншими за 0.");
      setSaving(false);
      return;
    }

    // Parse coatingsState
    const parsedCoatings: Record<string, any> = {};
    for (const key of Object.keys(coatingsState)) {
      const u = parseFloat(coatingsState[key].upper);
      const l = parseFloat(coatingsState[key].lower);
      const d3 = parseFloat(coatingsState[key].digits3cm);
      const d4 = parseFloat(coatingsState[key].digits4cm);
      const p = parseFloat(coatingsState[key].punctuation);
      
      if (isNaN(u) || isNaN(l) || isNaN(d3) || isNaN(d4) || isNaN(p)) {
        setError("Усі коефіцієнти для покриттів мають бути коректними числами.");
        setSaving(false);
        return;
      }
      if (u < 0 || l < 0 || d3 < 0 || d4 < 0 || p < 0) {
        setError("Коефіцієнти покриттів не можуть бути меншими за 0.");
        setSaving(false);
        return;
      }
      parsedCoatings[key] = { upper: u, lower: l, digits3cm: d3, digits4cm: d4, punctuation: p };
    }

    const upper = convertToEur(rawUpper, selectedCurrency, rates);
    const lower = convertToEur(rawLower, selectedCurrency, rates);
    const d3 = convertToEur(rawD3, selectedCurrency, rates);
    const d4 = convertToEur(rawD4, selectedCurrency, rates);
    const punctuation = convertToEur(rawPunctuation, selectedCurrency, rates);

    const newSettings: PriceSettings = { 
      upper, 
      lower, 
      digits: d3, // fallback
      digits3cm: d3, 
      digits4cm: d4, 
      punctuation,
      coatings: parsedCoatings
    };

    try {
      if (isGuest) {
        localStorage.setItem("local_price_settings", JSON.stringify(newSettings));
      } else {
        await setDoc(doc(db, "settings", "prices"), newSettings);
      }
      onSettingsUpdated(newSettings);
      setSuccessMessage("Ціни успішно збережено та активовано!");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.warn("Error saving settings to Firestore, saving to local storage instead:", err);
      try {
        localStorage.setItem("local_price_settings", JSON.stringify(newSettings));
        onSettingsUpdated(newSettings);
        setSuccessMessage("Ціни успішно збережено та активовано!");
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } catch (localErr) {
        console.error("Local storage error:", localErr);
        setError("Помилка збереження цін. Спробуйте ще раз.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAsStandard = async () => {
    setError("");
    setSuccess(false);
    setSavingStandard(true);

    const rawUpper = parseFloat(upperPrice);
    const rawLower = parseFloat(lowerPrice);
    const rawD3 = parseFloat(digits3cmPrice);
    const rawD4 = parseFloat(digits4cmPrice);
    const rawPunctuation = parseFloat(punctuationPrice);

    if (isNaN(rawUpper) || isNaN(rawLower) || isNaN(rawD3) || isNaN(rawD4) || isNaN(rawPunctuation)) {
      setError("Усі значення мають бути коректними числами.");
      setSavingStandard(false);
      return;
    }

    if (rawUpper < 0 || rawLower < 0 || rawD3 < 0 || rawD4 < 0 || rawPunctuation < 0) {
      setError("Ціни не можуть бути меншими за 0.");
      setSavingStandard(false);
      return;
    }

    // Parse coatingsState
    const parsedCoatings: Record<string, any> = {};
    for (const key of Object.keys(coatingsState)) {
      const u = parseFloat(coatingsState[key].upper);
      const l = parseFloat(coatingsState[key].lower);
      const d3 = parseFloat(coatingsState[key].digits3cm);
      const d4 = parseFloat(coatingsState[key].digits4cm);
      const p = parseFloat(coatingsState[key].punctuation);
      
      if (isNaN(u) || isNaN(l) || isNaN(d3) || isNaN(d4) || isNaN(p)) {
        setError("Усі коефіцієнти для покриттів мають бути коректними числами.");
        setSavingStandard(false);
        return;
      }
      if (u < 0 || l < 0 || d3 < 0 || d4 < 0 || p < 0) {
        setError("Коефіцієнти покриттів не можуть бути меншими за 0.");
        setSavingStandard(false);
        return;
      }
      parsedCoatings[key] = { upper: u, lower: l, digits3cm: d3, digits4cm: d4, punctuation: p };
    }

    const upper = convertToEur(rawUpper, selectedCurrency, rates);
    const lower = convertToEur(rawLower, selectedCurrency, rates);
    const d3 = convertToEur(rawD3, selectedCurrency, rates);
    const d4 = convertToEur(rawD4, selectedCurrency, rates);
    const punctuation = convertToEur(rawPunctuation, selectedCurrency, rates);

    const standardSettings: PriceSettings = {
      upper,
      lower,
      digits: d3, // fallback
      digits3cm: d3,
      digits4cm: d4,
      punctuation,
      coatings: parsedCoatings
    };

    try {
      if (isGuest) {
        localStorage.setItem("local_standard_price_settings", JSON.stringify(standardSettings));
        localStorage.setItem("local_price_settings", JSON.stringify(standardSettings));
      } else {
        await setDoc(doc(db, "settings", "standard_prices"), standardSettings);
        await setDoc(doc(db, "settings", "prices"), standardSettings);
      }
      onSettingsUpdated(standardSettings);
      setSuccessMessage("Ціни успішно збережено як стандартні та активовано!");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.warn("Failed to save standard prices to db, saving locally:", err);
      localStorage.setItem("local_standard_price_settings", JSON.stringify(standardSettings));
      localStorage.setItem("local_price_settings", JSON.stringify(standardSettings));
      onSettingsUpdated(standardSettings);
      setSuccessMessage("Ціни успішно збережено як стандартні (локально) та активовано!");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } finally {
      setSavingStandard(false);
    }
  };

  const handleResetToDefaults = async () => {
    setError("");
    setSuccess(false);
    try {
      let standard: PriceSettings | null = null;
      if (isGuest) {
        const stored = localStorage.getItem("local_standard_price_settings");
        if (stored) standard = JSON.parse(stored);
      } else {
        const docRef = doc(db, "settings", "standard_prices");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          standard = docSnap.data() as PriceSettings;
        }
      }

      if (standard) {
        const u = convertEurTo(standard.upper, selectedCurrency, rates);
        const l = convertEurTo(standard.lower, selectedCurrency, rates);
        const d3Base = standard.digits3cm !== undefined ? standard.digits3cm : standard.digits;
        const d3 = convertEurTo(d3Base, selectedCurrency, rates);
        const d4Base = standard.digits4cm !== undefined ? standard.digits4cm : 0.25;
        const d4 = convertEurTo(d4Base, selectedCurrency, rates);
        const p = convertEurTo(standard.punctuation, selectedCurrency, rates);

        setUpperPrice(u.toFixed(2));
        setLowerPrice(l.toFixed(2));
        setDigits3cmPrice(d3.toFixed(2));
        setDigits4cmPrice(d4.toFixed(2));
        setPunctuationPrice(p.toFixed(2));
        
        setSuccessMessage("Завантажено збережені стандартні ціни!");
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        // Fallback to hardcoded factory defaults
        const u = convertEurTo(0.50, selectedCurrency, rates);
        const l = convertEurTo(0.10, selectedCurrency, rates);
        const d3 = convertEurTo(0.15, selectedCurrency, rates);
        const d4 = convertEurTo(0.25, selectedCurrency, rates);
        const p = convertEurTo(0.20, selectedCurrency, rates);

        setUpperPrice(u.toFixed(2));
        setLowerPrice(l.toFixed(2));
        setDigits3cmPrice(d3.toFixed(2));
        setDigits4cmPrice(d4.toFixed(2));
        setPunctuationPrice(p.toFixed(2));
        
        setSuccessMessage("Завантажено заводські стандартні ціни.");
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Error loading standard prices:", err);
      const u = convertEurTo(0.50, selectedCurrency, rates);
      const l = convertEurTo(0.10, selectedCurrency, rates);
      const d3 = convertEurTo(0.15, selectedCurrency, rates);
      const d4 = convertEurTo(0.25, selectedCurrency, rates);
      const p = convertEurTo(0.20, selectedCurrency, rates);

      setUpperPrice(u.toFixed(2));
      setLowerPrice(l.toFixed(2));
      setDigits3cmPrice(d3.toFixed(2));
      setDigits4cmPrice(d4.toFixed(2));
      setPunctuationPrice(p.toFixed(2));
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6" id="admin-panel-view">
      
      {/* Demo Admin Info Banner */}
      {isDemoAdmin && (
        <div className="bg-amber-50 rounded-2xl border border-amber-150 p-4 flex gap-3">
          <div className="p-2 bg-amber-500/10 text-amber-700 h-fit rounded-lg">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-amber-800 uppercase tracking-wider">
              Режим Демо-Адміністратора
            </h3>
            <p className="text-xs text-amber-700 mt-1">
              Ви увійшли як Демо-Адмін. Це дозволяє протестувати зміну цін у базі даних Firestore. Змінені ціни миттєво оновлять калькулятор для всіх користувачів!
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 text-white rounded-xl">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Налаштування цін
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Встановіть ціну за кожен тип символу тексту
              </p>
            </div>
          </div>

          {/* Currency Switcher in Admin Panel */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200" id="admin-currency-selector">
            <button
              type="button"
              onClick={() => setSelectedCurrency("EUR")}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                selectedCurrency === "EUR"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              € EUR
            </button>
            <button
              type="button"
              onClick={() => setSelectedCurrency("UAH")}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                selectedCurrency === "UAH"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              ₴ UAH
            </button>
            <button
              type="button"
              onClick={() => setSelectedCurrency("USD")}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                selectedCurrency === "USD"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              $ USD
            </button>
          </div>
        </div>

        {/* Message states */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-rose-50 text-rose-600 text-xs p-4 rounded-xl border border-rose-100 font-medium"
            >
              {error}
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-emerald-50 text-emerald-700 text-xs p-4 rounded-xl border border-emerald-100 font-semibold flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              {successMessage || "Ціни успішно збережено та активовано!"}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form fields */}
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Upper letters */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Великі літери ({selectedCurrency}/симв)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400 font-mono text-xs">
                  {CURRENCY_SYMBOLS[selectedCurrency]}
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={upperPrice}
                  onChange={(e) => setUpperPrice(e.target.value)}
                  placeholder="0.50"
                  className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 text-slate-800 text-sm font-mono transition-all"
                />
              </div>
            </div>

            {/* Lower letters */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Малі літери ({selectedCurrency}/симв)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400 font-mono text-xs">
                  {CURRENCY_SYMBOLS[selectedCurrency]}
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={lowerPrice}
                  onChange={(e) => setLowerPrice(e.target.value)}
                  placeholder="0.10"
                  className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 text-slate-800 text-sm font-mono transition-all"
                />
              </div>
            </div>

            {/* Digits 3cm */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Цифри висотою 3см ({selectedCurrency}/симв)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400 font-mono text-xs">
                  {CURRENCY_SYMBOLS[selectedCurrency]}
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={digits3cmPrice}
                  onChange={(e) => setDigits3cmPrice(e.target.value)}
                  placeholder="0.15"
                  className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 text-slate-800 text-sm font-mono transition-all"
                />
              </div>
            </div>

            {/* Digits 4cm */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Цифри висотою 4см ({selectedCurrency}/симв)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400 font-mono text-xs">
                  {CURRENCY_SYMBOLS[selectedCurrency]}
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={digits4cmPrice}
                  onChange={(e) => setDigits4cmPrice(e.target.value)}
                  placeholder="0.25"
                  className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 text-slate-800 text-sm font-mono transition-all"
                />
              </div>
            </div>

            {/* Punctuation */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Розділові знаки ({selectedCurrency}/симв)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400 font-mono text-xs">
                  {CURRENCY_SYMBOLS[selectedCurrency]}
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={punctuationPrice}
                  onChange={(e) => setPunctuationPrice(e.target.value)}
                  placeholder="0.20"
                  className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 text-slate-800 text-sm font-mono transition-all"
                />
              </div>
            </div>

          </div>

          {/* Coating Coefficients Section */}
          <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 space-y-4">
            <button
              type="button"
              onClick={() => setShowCoatings(!showCoatings)}
              className="flex items-center justify-between w-full font-bold text-xs text-slate-700 uppercase tracking-wider cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Коефіцієнти покриттів літер
              </span>
              {showCoatings ? (
                <ChevronUp className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              )}
            </button>
            
            <AnimatePresence>
              {showCoatings && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 pt-2 overflow-hidden"
                >
                  <p className="text-[11px] text-slate-500 normal-case font-normal leading-relaxed">
                    Тут налаштовуються коефіцієнти для різних покриттів літер. Стандартні ціни множаться на ці коефіцієнти при виборі відповідного покриття в калькуляторі. (Коефіцієнт 1.0 означає базову ціну без змін).
                  </p>
                  
                  <div className="space-y-4">
                    {Object.keys(coatingsState).map((coatingKey) => {
                      const label = COATING_LABELS[coatingKey as CoatingType] || coatingKey;
                      return (
                        <div key={coatingKey} className="bg-white border border-slate-150 p-4 rounded-xl space-y-3 shadow-sm">
                          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
                            <span className="text-xs font-bold text-slate-800">
                              {label}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                            {/* Upper */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                                Великі
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                required
                                value={coatingsState[coatingKey].upper}
                                onChange={(e) => {
                                  setCoatingsState((prev: any) => ({
                                    ...prev,
                                    [coatingKey]: { ...prev[coatingKey], upper: e.target.value }
                                  }));
                                }}
                                placeholder="1.5"
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 text-slate-800 text-xs font-mono transition-all"
                              />
                            </div>
                            
                            {/* Lower */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                                Малі
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                required
                                value={coatingsState[coatingKey].lower}
                                onChange={(e) => {
                                  setCoatingsState((prev: any) => ({
                                    ...prev,
                                    [coatingKey]: { ...prev[coatingKey], lower: e.target.value }
                                  }));
                                }}
                                placeholder="1.5"
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 text-slate-800 text-xs font-mono transition-all"
                              />
                            </div>

                            {/* Digits 3cm */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                                Цифри 3см
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                required
                                value={coatingsState[coatingKey].digits3cm}
                                onChange={(e) => {
                                  setCoatingsState((prev: any) => ({
                                    ...prev,
                                    [coatingKey]: { ...prev[coatingKey], digits3cm: e.target.value }
                                  }));
                                }}
                                placeholder="1.5"
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 text-slate-800 text-xs font-mono transition-all"
                              />
                            </div>

                            {/* Digits 4cm */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                                Цифри 4см
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                required
                                value={coatingsState[coatingKey].digits4cm}
                                onChange={(e) => {
                                  setCoatingsState((prev: any) => ({
                                    ...prev,
                                    [coatingKey]: { ...prev[coatingKey], digits4cm: e.target.value }
                                  }));
                                }}
                                placeholder="1.5"
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 text-slate-800 text-xs font-mono transition-all"
                              />
                            </div>

                            {/* Punctuation */}
                            <div className="space-y-1 col-span-2 sm:col-span-1">
                              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                                Знаки
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                required
                                value={coatingsState[coatingKey].punctuation}
                                onChange={(e) => {
                                  setCoatingsState((prev: any) => ({
                                    ...prev,
                                    [coatingKey]: { ...prev[coatingKey], punctuation: e.target.value }
                                  }));
                                }}
                                placeholder="1.5"
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 text-slate-800 text-xs font-mono transition-all"
                              />
                            </div>

                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-3">
            <button
              type="button"
              onClick={handleResetToDefaults}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-3 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-all cursor-pointer"
              title="Завантажити раніше збережені стандартні ціни"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              Завантажити стандартні
            </button>

            <button
              type="button"
              onClick={handleSaveAsStandard}
              disabled={savingStandard || saving}
              className="w-full sm:w-auto sm:ml-auto flex items-center justify-center gap-1.5 px-4 py-3 text-xs font-semibold text-slate-700 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 rounded-xl border border-amber-200 transition-all cursor-pointer active:scale-98"
              title="Зберегти поточні ціни у базі даних як стандартний шаблон"
            >
              <FolderHeart className="w-3.5 h-3.5 text-amber-600" />
              {savingStandard ? "Збереження цін..." : "Зберегти як стандартні"}
            </button>

            <button
              type="submit"
              disabled={saving || savingStandard}
              id="save-settings-btn"
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-6 py-3 text-xs font-semibold text-white dark-btn bg-slate-900 hover:bg-slate-850 disabled:opacity-50 rounded-xl shadow-md transition-all cursor-pointer active:scale-98"
              title="Активувати поточні ціни для підрахунків"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Активація цін..." : "Активувати ціни"}
            </button>
          </div>
        </form>

      </div>

      {/* Price Presets Card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6" id="presets-card">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="p-2.5 bg-slate-900 text-white rounded-xl">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Пресети цін
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Створюйте та зберігайте різні шаблони цін для швидкого застосування
            </p>
          </div>
        </div>

        {/* Create Preset Form */}
        <form onSubmit={handleCreatePreset} className="space-y-3">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Зберегти поточні значення як новий пресет
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              required
              placeholder="Введіть назву пресету (напр. Літні ціни, Гурт)..."
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              className="flex-grow px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 text-slate-800 text-xs transition-all"
            />
            <button
              type="submit"
              disabled={savingPreset || !newPresetName.trim()}
              className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white dark-btn rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              {savingPreset ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              Зберегти пресет
            </button>
          </div>
        </form>

        {/* Presets List */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Збережені пресети цін
          </h3>

          {loadingPresets ? (
            <div className="flex items-center justify-center py-6 text-slate-400 gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
              <span className="text-xs font-mono">Завантаження пресетів...</span>
            </div>
          ) : presets.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <span className="text-slate-400 text-xs font-mono block">Немає збережених пресетів</span>
              <span className="text-[10px] text-slate-400 mt-1 block">Введіть назву вище, щоб зберегти поточні ціни</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 max-h-72 overflow-y-auto pr-1">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className="p-3.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-150 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors group"
                >
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-800 block">
                      {preset.name}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[9px] font-mono font-medium px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-500">
                        В: {convertEurTo(preset.upper, selectedCurrency, rates).toFixed(2)} {CURRENCY_SYMBOLS[selectedCurrency]}
                      </span>
                      <span className="text-[9px] font-mono font-medium px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-500">
                        М: {convertEurTo(preset.lower, selectedCurrency, rates).toFixed(2)} {CURRENCY_SYMBOLS[selectedCurrency]}
                      </span>
                      <span className="text-[9px] font-mono font-medium px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-500">
                        Ц3: {convertEurTo(preset.digits3cm, selectedCurrency, rates).toFixed(2)} {CURRENCY_SYMBOLS[selectedCurrency]}
                      </span>
                      <span className="text-[9px] font-mono font-medium px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-500">
                        Ц4: {convertEurTo(preset.digits4cm, selectedCurrency, rates).toFixed(2)} {CURRENCY_SYMBOLS[selectedCurrency]}
                      </span>
                      <span className="text-[9px] font-mono font-medium px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-500">
                        Зн: {convertEurTo(preset.punctuation, selectedCurrency, rates).toFixed(2)} {CURRENCY_SYMBOLS[selectedCurrency]}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className="px-3 py-1.5 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-150 border border-slate-200 rounded-lg transition-all cursor-pointer"
                    >
                      Застосувати
                    </button>
                    <button
                      type="button"
                      disabled={deletingPresetId === preset.id}
                      onClick={(e) => handleDeletePreset(preset.id, preset.name, e)}
                      className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Видалити пресет"
                    >
                      {deletingPresetId === preset.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pricing explanation widget */}
      <div className="bg-slate-50 rounded-3xl border border-slate-100 p-5 space-y-3">
        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1">
          <Coins className="w-3.5 h-3.5 text-indigo-500 animate-bounce" />
          Розрахунок у реальному часі:
        </h4>
        <p className="text-xs text-slate-600 leading-relaxed">
          Всі ціни записуються безпосередньо у глобальну базу даних Google Cloud Firestore. Оновлені ціни одразу використовуються для підрахунку вартості нових та вже написаних текстів у калькуляторі.
        </p>
      </div>

    </div>
  );
}
