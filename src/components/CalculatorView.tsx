import React, { useState, useEffect, useRef } from "react";
import { PriceSettings, SymbolStats, TextRecord, CoatingType, COATING_LABELS } from "../types";
import { analyzeText } from "../utils/calculator";
import { db } from "../firebase";
import { collection, addDoc } from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import { 
  FileText, 
  Trash2, 
  Download, 
  Printer, 
  Save, 
  Info, 
  CheckCircle, 
  HelpCircle,
  Hash,
  FileDown,
  FileSpreadsheet
} from "lucide-react";
import { CurrencyCode, ExchangeRates, convertEurTo, formatCurrencyValue, CURRENCY_SYMBOLS } from "../utils/currency";

interface CalculatorViewProps {
  settings: PriceSettings;
  userId: string;
  userEmail?: string;
  userDisplayName?: string;
  initialText?: string;
  initialCoating?: CoatingType;
  onRecordSaved?: () => void;
  selectedCurrency: CurrencyCode;
  setSelectedCurrency: (currency: CurrencyCode) => void;
  rates: ExchangeRates;
}

export default function CalculatorView({
  settings,
  userId,
  userEmail,
  userDisplayName,
  initialText = "",
  initialCoating,
  onRecordSaved,
  selectedCurrency,
  setSelectedCurrency,
  rates
}: CalculatorViewProps) {
  const [text, setText] = useState(initialText);
  const [coating, setCoating] = useState<CoatingType>("transparent_lacquer");
  const [stats, setStats] = useState<SymbolStats>({
    upper: 0,
    lower: 0,
    digits: 0,
    punctuation: 0,
    total: 0,
    dates: []
  });
  const [cost, setCost] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [exportPrices, setExportPrices] = useState(true);
  const [showRulesInfo, setShowRulesInfo] = useState(false);
  
  const d3PriceBase = settings.digits3cm !== undefined ? settings.digits3cm : settings.digits;
  const d4PriceBase = settings.digits4cm !== undefined ? settings.digits4cm : 0.25;

  const activeCoeffs = (coating !== "transparent_lacquer" && settings.coatings && settings.coatings[coating])
    ? settings.coatings[coating]
    : { upper: 1, lower: 1, digits3cm: 1, digits4cm: 1, punctuation: 1 };

  const displayUpper = convertEurTo(settings.upper * (activeCoeffs.upper ?? 1), selectedCurrency, rates);
  const displayLower = convertEurTo(settings.lower * (activeCoeffs.lower ?? 1), selectedCurrency, rates);
  const displayDigits3cm = convertEurTo(d3PriceBase * (activeCoeffs.digits3cm ?? 1), selectedCurrency, rates);
  const displayDigits4cm = convertEurTo(d4PriceBase * (activeCoeffs.digits4cm ?? 1), selectedCurrency, rates);
  const displayPunctuation = convertEurTo(settings.punctuation * (activeCoeffs.punctuation ?? 1), selectedCurrency, rates);
  const displayCost = convertEurTo(cost, selectedCurrency, rates);
  
  const [digitsSizeMode, setDigitsSizeMode] = useState<"all3cm" | "all4cm" | "mixed">("all3cm");
  const [custom3cmCount, setCustom3cmCount] = useState<number | null>(null);

  const digitMatches = text.match(/[0-9]/g);
  const totalDigits = digitMatches ? digitMatches.length : 0;

  // Sync when initialText or initialCoating changes (loaded from history)
  useEffect(() => {
    if (initialText !== undefined) {
      setText(initialText);
    }
  }, [initialText]);

  useEffect(() => {
    if (initialCoating !== undefined) {
      setCoating(initialCoating);
    } else {
      setCoating("transparent_lacquer");
    }
  }, [initialCoating]);

  // Recalculate on text, settings, coating or digit size configuration changes
  useEffect(() => {
    const digitMatches = text.match(/[0-9]/g);
    const totalDigits = digitMatches ? digitMatches.length : 0;

    let d3 = totalDigits;
    let d4 = 0;

    if (digitsSizeMode === "all3cm") {
      d3 = totalDigits;
      d4 = 0;
    } else if (digitsSizeMode === "all4cm") {
      d3 = 0;
      d4 = totalDigits;
    } else if (digitsSizeMode === "mixed") {
      if (custom3cmCount === null || custom3cmCount > totalDigits) {
        d3 = Math.ceil(totalDigits / 2);
        d4 = totalDigits - d3;
      } else {
        d3 = custom3cmCount;
        d4 = totalDigits - d3;
      }
    }

    const analysis = analyzeText(text, settings, d3, d4, coating);
    setStats(analysis.stats);
    setCost(analysis.cost);
  }, [text, settings, digitsSizeMode, custom3cmCount, coating]);

  const handleClear = () => {
    setText("");
  };

  const handleSaveToHistory = async () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    try {
      if (userId === "local-guest") {
        const stored = localStorage.getItem("local_history");
        const historyList = stored ? JSON.parse(stored) : [];
        const newRecord = {
          id: "local_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
          userId: "local-guest",
          userEmail: "",
          userDisplayName: "Гість",
          text,
          stats,
          cost,
          coating,
          createdAt: new Date().toISOString()
        };
        historyList.unshift(newRecord);
        localStorage.setItem("local_history", JSON.stringify(historyList));
      } else {
        await addDoc(collection(db, "history"), {
          userId,
          userEmail: userEmail || "",
          userDisplayName: userDisplayName || "",
          text,
          stats,
          cost,
          coating,
          createdAt: new Date()
        });
      }
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 3000);
      if (onRecordSaved) onRecordSaved();
    } catch (err) {
      console.error("Error saving history record:", err);
    } finally {
      setSaving(false);
    }
  };

  const getPunctuationName = (char: string): string => {
    const PUNCTUATION_NAMES: Record<string, string> = {
      '.': 'крапка',
      ',': 'кома',
      '-': 'дефіс / тире',
      '—': 'довге тире',
      '–': 'середнє тире',
      '^': 'галочка',
      ':': 'двокрапка',
      ';': 'крапка з комою',
      '!': 'знак оклику',
      '?': 'знак питання',
      '"': 'подвійні лапки',
      '\'': 'одинарна лапка / апостроф',
      '«': 'відкриваючі лапки (ялинка)',
      '»': 'закриваючі лапки (ялинка)',
      '„': 'відкриваючі лапки (лапки)',
      '“': 'лапки верхні',
      '”': 'лапки верхні закриваючі',
      '(': 'ліва дужка',
      ')': 'права дужка',
      '[': 'ліва квадратна дужка',
      ']': 'права квадратна дужка',
      '{': 'ліва фігурна дужка',
      '}': 'права фігурна дужка',
      '/': 'скисна риска (слеш)',
      '\\': 'зворотна скисна риска (бекслеш)',
      '@': 'собачка (@)',
      '#': 'решітка',
      '$': 'знак долара',
      '%': 'відсоток',
      '*': 'зірочка',
      '&': 'амперсанд',
      '_': 'підкреслення',
      '+': 'плюс',
      '=': 'дорівнює',
      '<': 'менше',
      '>': 'більше',
      '~': 'тильда',
      '`': 'зворотний апостроф',
      '|': 'вертикальна риска'
    };

    const name = PUNCTUATION_NAMES[char];
    return name ? `${char} (${name})` : char;
  };

  const getSymbolBreakdowns = () => {
    const lettersMap: Record<string, { upper: number; lower: number }> = {};
    const digitsMap: Record<string, { size3: number; size4: number }> = {};
    const punctuationMap: Record<string, number> = {};

    // Determine 3cm vs 4cm digit counts as in the stats / calculation
    const digitMatches = text.match(/[0-9]/g);
    const totalDigits = digitMatches ? digitMatches.length : 0;

    let d3Remaining = 0;
    let d4Remaining = 0;

    if (digitsSizeMode === "all3cm") {
      d3Remaining = totalDigits;
    } else if (digitsSizeMode === "all4cm") {
      d4Remaining = totalDigits;
    } else if (digitsSizeMode === "mixed") {
      const d3Count = custom3cmCount === null || custom3cmCount > totalDigits
        ? Math.ceil(totalDigits / 2)
        : custom3cmCount;
      d3Remaining = d3Count;
      d4Remaining = totalDigits - d3Count;
    }

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (/\s/.test(char)) {
        continue;
      }

      if (char >= '0' && char <= '9') {
        if (!digitsMap[char]) {
          digitsMap[char] = { size3: 0, size4: 0 };
        }
        if (d3Remaining > 0) {
          digitsMap[char].size3++;
          d3Remaining--;
        } else {
          digitsMap[char].size4++;
          d4Remaining--;
        }
        continue;
      }

      const isLetter = char.toLowerCase() !== char.toUpperCase();
      if (isLetter) {
        const lowerChar = char.toLowerCase();
        if (!lettersMap[lowerChar]) {
          lettersMap[lowerChar] = { upper: 0, lower: 0 };
        }
        if (char === char.toUpperCase()) {
          lettersMap[lowerChar].upper++;
        } else {
          lettersMap[lowerChar].lower++;
        }
        continue;
      }

      if (char === '«' || char === '»') {
        punctuationMap['^'] = (punctuationMap['^'] || 0) + 2;
        continue;
      }

      punctuationMap[char] = (punctuationMap[char] || 0) + 1;
    }

    // Sort letters alphabetically
    const letters = Object.entries(lettersMap).map(([lowerChar, counts]) => {
      return {
        char: lowerChar.toUpperCase(),
        upperCount: counts.upper > 0 ? counts.upper : null,
        lowerCount: counts.lower > 0 ? counts.lower : null,
        total: counts.upper + counts.lower
      };
    }).sort((a, b) => a.char.localeCompare(b.char, "uk-UA"));

    // Sort digits alphabetically/numerically
    const digits = Object.entries(digitsMap).map(([char, counts]) => {
      return {
        char,
        size3Count: counts.size3 > 0 ? counts.size3 : null,
        size4Count: counts.size4 > 0 ? counts.size4 : null,
        total: counts.size3 + counts.size4
      };
    }).sort((a, b) => a.char.localeCompare(b.char));

    // Sort punctuation/symbols alphabetically
    const punctuation = Object.entries(punctuationMap).map(([char, count]) => {
      return {
        char,
        displayName: getPunctuationName(char),
        count
      };
    }).sort((a, b) => a.char.localeCompare(b.char, "uk-UA"));

    return { letters, digits, punctuation };
  };

  // Export to CSV with UTF-8 BOM so Excel displays Ukrainian letters correctly
  const handleExportCSV = () => {
    const d3Price = settings.digits3cm !== undefined ? settings.digits3cm : settings.digits;
    const d4Price = settings.digits4cm !== undefined ? settings.digits4cm : 0.25;

    const reportCoeffs = (coating !== "transparent_lacquer" && settings.coatings && settings.coatings[coating])
      ? settings.coatings[coating]
      : { upper: 1, lower: 1, digits3cm: 1, digits4cm: 1, punctuation: 1 };

    const u = convertEurTo(settings.upper * (reportCoeffs.upper ?? 1), selectedCurrency, rates);
    const l = convertEurTo(settings.lower * (reportCoeffs.lower ?? 1), selectedCurrency, rates);
    const d3 = convertEurTo(d3Price * (reportCoeffs.digits3cm ?? 1), selectedCurrency, rates);
    const d4 = convertEurTo(d4Price * (reportCoeffs.digits4cm ?? 1), selectedCurrency, rates);
    const p = convertEurTo(settings.punctuation * (reportCoeffs.punctuation ?? 1), selectedCurrency, rates);
    const totalCost = convertEurTo(cost, selectedCurrency, rates);

    const { letters, digits, punctuation } = getSymbolBreakdowns();

    const formatDecimal = (val: number) => val.toFixed(2).replace('.', ',');

    const csvRows = exportPrices ? [
      ["Звіт аналізу вартості тексту"],
      [`Дата генерації: ${new Date().toLocaleString("uk-UA")}`],
      [`Користувач: ${userDisplayName || "Гість"}`],
      [`Електронна пошта: ${userEmail || "Не вказано"}`],
      [],
      ["Аналізований текст:"],
      [text.replace(/"/g, '""')],
      [],
      [`Покриття літер: ${COATING_LABELS[coating] || coating}`],
      [],
      ["ОСНОВНИЙ РОЗРАХУНОК"],
      ["Категорія символів", "Кількість", `Ціна (${selectedCurrency}/символ)`, `Вартість (${selectedCurrency})`],
      ["Великі літери", stats.upper, formatDecimal(u), formatDecimal(stats.upper * u)],
      ["Малі літери", stats.lower, formatDecimal(l), formatDecimal(stats.lower * l)],
      ["Цифри 3см (висота 3см)", stats.digits3cm || 0, formatDecimal(d3), formatDecimal((stats.digits3cm || 0) * d3)],
      ["Цифри 4см (висота 4см)", stats.digits4cm || 0, formatDecimal(d4), formatDecimal((stats.digits4cm || 0) * d4)],
      ["Знаки", stats.punctuation, formatDecimal(p), formatDecimal(stats.punctuation * p)],
      ["Усього", stats.total, "", formatDecimal(totalCost)],
      [],
      ["ДЕТАЛІЗАЦІЯ ЗА ГРУПАМИ"],
      [],
      ["Символ", "5см (Велика)", "4см (мала)"],
      ...letters.map(item => [item.char, item.upperCount !== null ? item.upperCount : "—", item.lowerCount !== null ? item.lowerCount : "—"]),
      [],
      ["Символ", "3см", "4см"],
      ...digits.map(item => [item.char, item.size3Count !== null ? item.size3Count : "—", item.size4Count !== null ? item.size4Count : "—"]),
      [],
      ["Символ", "Кількість"],
      ...punctuation.map(item => [item.displayName, item.count]),
      []
    ] : [
      ["Звіт аналізу тексту"],
      [`Дата генерації: ${new Date().toLocaleString("uk-UA")}`],
      [`Користувач: ${userDisplayName || "Гість"}`],
      [`Електронна пошта: ${userEmail || "Не вказано"}`],
      [],
      ["Аналізований текст:"],
      [text.replace(/"/g, '""')],
      [],
      [`Покриття літер: ${COATING_LABELS[coating] || coating}`],
      [],
      ["ОСНОВНА СТАТИСТИКА"],
      ["Категорія символів", "Кількість"],
      ["Великі літери", stats.upper],
      ["Малі літери", stats.lower],
      ["Цифри 3см (висота 3см)", stats.digits3cm || 0],
      ["Цифри 4см (висота 4см)", stats.digits4cm || 0],
      ["Знаки", stats.punctuation],
      ["Усього", stats.total],
      [],
      ["ДЕТАЛІЗАЦІЯ ЗА ГРУПАМИ"],
      [],
      ["Символ", "5см (Велика)", "4см (мала)"],
      ...letters.map(item => [item.char, item.upperCount !== null ? item.upperCount : "—", item.lowerCount !== null ? item.lowerCount : "—"]),
      [],
      ["Символ", "3см", "4см"],
      ...digits.map(item => [item.char, item.size3Count !== null ? item.size3Count : "—", item.size4Count !== null ? item.size4Count : "—"]),
      [],
      ["Символ", "Кількість"],
      ...punctuation.map(item => [item.displayName, item.count]),
      []
    ];

    // standard CSV separator for European locales (Excel-friendly)
    const csvContent = csvRows.map(e => e.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `text_cost_report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to MS Excel (.xls)
  const handleExportExcel = () => {
    const d3Price = settings.digits3cm !== undefined ? settings.digits3cm : settings.digits;
    const d4Price = settings.digits4cm !== undefined ? settings.digits4cm : 0.25;

    const reportCoeffs = (coating !== "transparent_lacquer" && settings.coatings && settings.coatings[coating])
      ? settings.coatings[coating]
      : { upper: 1, lower: 1, digits3cm: 1, digits4cm: 1, punctuation: 1 };

    const u = convertEurTo(settings.upper * (reportCoeffs.upper ?? 1), selectedCurrency, rates);
    const l = convertEurTo(settings.lower * (reportCoeffs.lower ?? 1), selectedCurrency, rates);
    const d3 = convertEurTo(d3Price * (reportCoeffs.digits3cm ?? 1), selectedCurrency, rates);
    const d4 = convertEurTo(d4Price * (reportCoeffs.digits4cm ?? 1), selectedCurrency, rates);
    const p = convertEurTo(settings.punctuation * (reportCoeffs.punctuation ?? 1), selectedCurrency, rates);
    const totalCost = convertEurTo(cost, selectedCurrency, rates);

    const { letters, digits, punctuation } = getSymbolBreakdowns();

    const formatDecimal = (val: number) => val.toFixed(2).replace('.', ',');

    // Create Excel HTML format
    const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
<!--[if gte mso 9]>
<xml>
 <x:ExcelWorkbook>
  <x:ExcelWorksheets>
   <x:ExcelWorksheet>
    <x:Name>Звіт аналізу</x:Name>
    <x:WorksheetOptions>
     <x:DisplayGridlines/>
    </x:WorksheetOptions>
   </x:ExcelWorksheet>
  </x:ExcelWorksheets>
 </x:ExcelWorkbook>
</xml>
<![endif]-->
<style>
  table { border-collapse: collapse; margin-bottom: 20px; }
  td, th { border: 0.5pt solid #cbd5e1; font-family: 'Segoe UI', Calibri, Arial, sans-serif; font-size: 11pt; padding: 6px; }
  th { background-color: #f1f5f9; font-weight: bold; color: #475569; }
  .title { font-size: 16pt; font-weight: bold; color: #0f172a; margin-bottom: 5px; }
  .total-row td { font-weight: bold; background-color: #f8fafc; border-top: 1.5pt double #94a3b8; }
  .section-header { font-size: 12pt; font-weight: bold; color: #1e293b; background-color: #e2e8f0; padding: 6px; }
  .meta-label { font-weight: bold; color: #64748b; }
</style>
</head>
<body>
  <table>
    <tr>
      <td colspan="4" class="title">${exportPrices ? "Звіт про розрахунок вартості тексту" : "Звіт про аналіз тексту"}</td>
    </tr>
    <tr>
      <td colspan="4" style="font-size: 10pt; color: #64748b; font-style: italic;">Програма: Click Translator</td>
    </tr>
    <tr>
      <td class="meta-label">Користувач:</td>
      <td colspan="3">${userDisplayName || "Гість"}</td>
    </tr>
    <tr>
      <td class="meta-label">Електронна пошта:</td>
      <td colspan="3">${userEmail || "Не вказано"}</td>
    </tr>
    <tr>
      <td class="meta-label">Дата генерації:</td>
      <td colspan="3">${new Date().toLocaleString("uk-UA")}</td>
    </tr>
    <tr>
      <td class="meta-label">Покриття літер:</td>
      <td colspan="3">${COATING_LABELS[coating] || coating}</td>
    </tr>
    <tr><td colspan="4" style="border: none; height: 10px;"></td></tr>
    <tr>
      <td class="meta-label" valign="top">Аналізований текст:</td>
      <td colspan="3" style="font-size: 11pt; white-space: pre-wrap; background-color: #f8fafc;">${text}</td>
    </tr>
    <tr><td colspan="4" style="border: none; height: 20px;"></td></tr>
    
    <tr>
      <td colspan="4" class="section-header">${exportPrices ? "ОСНОВНИЙ РОЗРАХУНОК" : "ОСНОВНА СТАТИСТИКА"}</td>
    </tr>
    <tr>
      <th>Категорія символів</th>
      <th>Кількість</th>
      ${exportPrices ? `<th>Ціна (${selectedCurrency}/символ)</th><th>Вартість (${selectedCurrency})</th>` : ""}
    </tr>
    <tr>
      <td>Великі літери</td>
      <td align="right">${stats.upper}</td>
      ${exportPrices ? `<td align="right">${formatDecimal(u)}</td><td align="right">${formatDecimal(stats.upper * u)}</td>` : ""}
    </tr>
    <tr>
      <td>Малі літери</td>
      <td align="right">${stats.lower}</td>
      ${exportPrices ? `<td align="right">${formatDecimal(l)}</td><td align="right">${formatDecimal(stats.lower * l)}</td>` : ""}
    </tr>
    <tr>
      <td>Цифри 3см (висота 3см)</td>
      <td align="right">${stats.digits3cm || 0}</td>
      ${exportPrices ? `<td align="right">${formatDecimal(d3)}</td><td align="right">${formatDecimal((stats.digits3cm || 0) * d3)}</td>` : ""}
    </tr>
    <tr>
      <td>Цифри 4см (висота 4см)</td>
      <td align="right">${stats.digits4cm || 0}</td>
      ${exportPrices ? `<td align="right">${formatDecimal(d4)}</td><td align="right">${formatDecimal((stats.digits4cm || 0) * d4)}</td>` : ""}
    </tr>
    <tr>
      <td>Знаки</td>
      <td align="right">${stats.punctuation}</td>
      ${exportPrices ? `<td align="right">${formatDecimal(p)}</td><td align="right">${formatDecimal(stats.punctuation * p)}</td>` : ""}
    </tr>
    <tr class="total-row">
      <td>Усього</td>
      <td align="right">${stats.total}</td>
      ${exportPrices ? `<td></td><td align="right">${formatDecimal(totalCost)}</td>` : ""}
    </tr>
    <tr><td colspan="4" style="border: none; height: 20px;"></td></tr>
    
    <tr>
      <td colspan="4" class="section-header">ДЕТАЛІЗАЦІЯ ЗА ГРУПАМИ</td>
    </tr>
    <tr><td colspan="4" style="border: none; height: 10px;"></td></tr>
    
    <!-- Letters Detail Table -->
    <tr>
      <th colspan="2">Літери</th>
      <th colspan="2"></th>
    </tr>
    <tr>
      <th>Символ</th>
      <th>5см (Велика)</th>
      <th colspan="2">4см (мала)</th>
    </tr>
    ${letters.map(item => `
    <tr>
      <td>${item.char}</td>
      <td align="right">${item.upperCount !== null ? item.upperCount : "—"}</td>
      <td colspan="2" align="right">${item.lowerCount !== null ? item.lowerCount : "—"}</td>
    </tr>
    `).join("")}
    <tr><td colspan="4" style="border: none; height: 15px;"></td></tr>
    
    <!-- Digits Detail Table -->
    <tr>
      <th colspan="2">Цифри</th>
      <th colspan="2"></th>
    </tr>
    <tr>
      <th>Символ</th>
      <th>3см</th>
      <th colspan="2">4см</th>
    </tr>
    ${digits.map(item => `
    <tr>
      <td>${item.char}</td>
      <td align="right">${item.size3Count !== null ? item.size3Count : "—"}</td>
      <td colspan="2" align="right">${item.size4Count !== null ? item.size4Count : "—"}</td>
    </tr>
    `).join("")}
    <tr><td colspan="4" style="border: none; height: 15px;"></td></tr>
    
    <!-- Punctuation Detail Table -->
    <tr>
      <th colspan="2">Знаки</th>
      <th colspan="2"></th>
    </tr>
    <tr>
      <th colspan="2">Символ</th>
      <th colspan="2">Кількість</th>
    </tr>
    ${punctuation.length > 0 ? punctuation.map(item => `
    <tr>
      <td colspan="2">${item.displayName}</td>
      <td colspan="2" align="right">${item.count}</td>
    </tr>
    `).join("") : `
    <tr>
      <td colspan="4" align="center" style="color: #94a3b8;">Знаки відсутні</td>
    </tr>
    `}
  </table>
</body>
</html>
    `;

    const blob = new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `text_cost_report_${new Date().toISOString().slice(0, 10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to PDF / Print using standard print helper styled layout
  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const d3Price = settings.digits3cm !== undefined ? settings.digits3cm : settings.digits;
    const d4Price = settings.digits4cm !== undefined ? settings.digits4cm : 0.25;

    const reportCoeffs = (coating !== "transparent_lacquer" && settings.coatings && settings.coatings[coating])
      ? settings.coatings[coating]
      : { upper: 1, lower: 1, digits3cm: 1, digits4cm: 1, punctuation: 1 };

    const u = convertEurTo(settings.upper * (reportCoeffs.upper ?? 1), selectedCurrency, rates);
    const l = convertEurTo(settings.lower * (reportCoeffs.lower ?? 1), selectedCurrency, rates);
    const d3 = convertEurTo(d3Price * (reportCoeffs.digits3cm ?? 1), selectedCurrency, rates);
    const d4 = convertEurTo(d4Price * (reportCoeffs.digits4cm ?? 1), selectedCurrency, rates);
    const p = convertEurTo(settings.punctuation * (reportCoeffs.punctuation ?? 1), selectedCurrency, rates);
    const totalCost = convertEurTo(cost, selectedCurrency, rates);

    const { letters, digits, punctuation } = getSymbolBreakdowns();

    printWindow.document.write(`
      <html>
        <head>
          <title>${exportPrices ? "Аналіз вартості тексту - Звіт" : "Аналіз тексту - Звіт"}</title>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
            h1 { font-size: 24px; color: #0f172a; margin-bottom: 5px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
            .meta { font-size: 13px; color: #334155; margin-bottom: 25px; line-height: 1.6; }
            .user-info { margin-bottom: 25px; padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 13px; line-height: 1.6; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { background: #f8fafc; text-align: left; padding: 12px; font-size: 13px; text-transform: uppercase; border-bottom: 2px solid #cbd5e1; }
            td { padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
            .total-row { font-weight: bold; background: #f1f5f9; }
            .section-title { font-size: 16px; font-weight: bold; margin-top: 35px; margin-bottom: 15px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
            
            .detail-table { width: 100%; font-size: 13px; border-collapse: collapse; margin-bottom: 25px; }
            .detail-table th { background: #f1f5f9; padding: 8px 12px; border-bottom: 1px solid #cbd5e1; font-size: 12px; color: #475569; }
            .detail-table td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }
            
            .text-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; font-size: 14pt; white-space: pre-wrap; word-break: break-all; }
            .footer { margin-top: 50px; font-size: 11px; text-align: center; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px;">
            <h1 style="font-size: 20px; color: #0f172a; margin: 0; padding: 0; border: none;">${exportPrices ? "Звіт про розрахунок вартості тексту" : "Звіт про аналіз тексту"}</h1>
            <div style="display: flex; align-items: center; gap: 5px; font-family: 'Helvetica Neue', Arial, sans-serif;">
              <div style="background: #0f172a; color: white; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border-radius: 4px; font-weight: bold; font-size: 10px;">★</div>
              <span style="font-size: 11px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">Click Translator</span>
            </div>
          </div>

          <div class="user-info">
            <strong>Користувач:</strong> ${userDisplayName || "Гість"}<br/>
            <strong>Електронна пошта:</strong> ${userEmail || "Не вказано"}<br/>
            <strong>Дата генерації:</strong> ${new Date().toLocaleString("uk-UA")}
          </div>

          <div class="section-title">Аналізований текст</div>
          <div class="text-box" style="margin-bottom: 20px;">${text || "<em>Текст відсутній</em>"}</div>

          <div class="meta">
            <strong>Покриття літер:</strong> ${COATING_LABELS[coating] || coating}
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Категорія символів</th>
                <th>Кількість</th>
                ${exportPrices ? `
                <th>Ціна (${selectedCurrency})</th>
                <th>Сума (${selectedCurrency})</th>
                ` : ""}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Великі літери</td>
                <td>${stats.upper}</td>
                ${exportPrices ? `
                <td>${u.toFixed(2)}</td>
                <td>${(stats.upper * u).toFixed(2)}</td>
                ` : ""}
              </tr>
              <tr>
                <td>Малі літери</td>
                <td>${stats.lower}</td>
                ${exportPrices ? `
                <td>${l.toFixed(2)}</td>
                <td>${(stats.lower * l).toFixed(2)}</td>
                ` : ""}
              </tr>
              <tr>
                <td>Цифри (3 см)</td>
                <td>${stats.digits3cm || 0}</td>
                ${exportPrices ? `
                <td>${d3.toFixed(2)}</td>
                <td>${((stats.digits3cm || 0) * d3).toFixed(2)}</td>
                ` : ""}
              </tr>
              <tr>
                <td>Цифри (4 см)</td>
                <td>${stats.digits4cm || 0}</td>
                ${exportPrices ? `
                <td>${d4.toFixed(2)}</td>
                <td>${((stats.digits4cm || 0) * d4).toFixed(2)}</td>
                ` : ""}
              </tr>
              <tr>
                <td>Знаки</td>
                <td>${stats.punctuation}</td>
                ${exportPrices ? `
                <td>${p.toFixed(2)}</td>
                <td>${(stats.punctuation * p).toFixed(2)}</td>
                ` : ""}
              </tr>
              <tr class="total-row">
                <td>Усього</td>
                <td>${stats.total}</td>
                ${exportPrices ? `
                <td>-</td>
                <td>${totalCost.toFixed(2)} ${selectedCurrency}</td>
                ` : ""}
              </tr>
            </tbody>
          </table>

          <div class="section-title" style="page-break-before: always; break-before: page;">Деталізація за групами</div>

          <table class="detail-table">
            <thead>
              <tr>
                <th>Символ</th>
                <th>5см (Велика)</th>
                <th>4см (мала)</th>
              </tr>
            </thead>
            <tbody>
              ${letters.length > 0 ? letters.map(item => `
                <tr>
                  <td><strong>${item.char}</strong></td>
                  <td>${item.upperCount !== null ? item.upperCount : "—"}</td>
                  <td>${item.lowerCount !== null ? item.lowerCount : "—"}</td>
                </tr>
              `).join("") : `<tr><td colspan="3" style="text-align: center; color: #94a3b8;">Літери відсутні</td></tr>`}
            </tbody>
          </table>

          <table class="detail-table">
            <thead>
              <tr>
                <th>Символ</th>
                <th>3см</th>
                <th>4см</th>
              </tr>
            </thead>
            <tbody>
              ${digits.length > 0 ? digits.map(item => `
                <tr>
                  <td><strong>${item.char}</strong></td>
                  <td>${item.size3Count !== null ? item.size3Count : "—"}</td>
                  <td>${item.size4Count !== null ? item.size4Count : "—"}</td>
                </tr>
              `).join("") : `<tr><td colspan="3" style="text-align: center; color: #94a3b8;">Цифри відсутні</td></tr>`}
            </tbody>
          </table>

          <table class="detail-table">
            <thead>
              <tr>
                <th>Символ</th>
                <th>Кількість</th>
              </tr>
            </thead>
            <tbody>
              ${punctuation.length > 0 ? punctuation.map(item => `
                <tr>
                  <td><strong>${item.displayName}</strong></td>
                  <td>${item.count}</td>
                </tr>
              `).join("") : `<tr><td colspan="2" style="text-align: center; color: #94a3b8;">Знаки відсутні</td></tr>`}
            </tbody>
          </table>

          <div class="footer">
            TextCost Calc &copy; ${new Date().getFullYear()} - Автоматичний білінг та аналіз тексту.
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto" id="calculator-view">
      
      {/* Rules Card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-2">
            <Info className="w-5 h-5 text-slate-700 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-sans">
                Правила підрахунку кількості символів
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Пробіли не рахуються. Діють спеціальні правила для українських літер та лапок.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowRulesInfo(!showRulesInfo)}
            id="toggle-rules-btn"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition-all cursor-pointer self-start sm:self-auto"
          >
            {showRulesInfo ? "Сховати деталі" : "Показати деталі"}
          </button>
        </div>

        {/* Rules Details Box */}
        <AnimatePresence>
          {showRulesInfo && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-4 border-t border-slate-100 space-y-3 text-xs text-slate-600">
                <h4 className="font-bold text-slate-800">Як виконується підрахунок:</h4>
                <ul className="list-disc pl-5 space-y-2 text-slate-500">
                  <li>
                    <span className="font-semibold text-slate-700">Пробіли:</span> повністю ігноруються в аналізі.
                  </li>
                  <li>
                    <span className="font-semibold text-slate-700">Великі та Малі літери:</span> рахуються стандартно (А-Я, а-я, A-Z, a-z).
                  </li>
                  <li>
                    <span className="font-semibold text-slate-700">Крапки над 'і' та 'ї':</span> за кожну малу букву <strong>і / i</strong> (кириличну чи латинську) до кількості знаків додається <strong>+1</strong> знак (велика буква <strong>І / I</strong> крапки не має); за кожну <strong>ї / Ї</strong> до знаків додається <strong>+2</strong> знаки.
                  </li>
                  <li>
                    <span className="font-semibold text-slate-700">Хвостик над 'й':</span> за кожну букву <strong>й / Й</strong> до кількості знаків додається <strong>+1</strong> знак.
                  </li>
                  <li>
                    <span className="font-semibold text-slate-700">Подвійні лапки:</span> символи <code className="bg-slate-100 px-1 rounded">"</code>, <code className="bg-slate-150 px-1 rounded">“</code>, <code className="bg-slate-150 px-1 rounded">”</code>, <code className="bg-slate-150 px-1 rounded">«</code>, <code className="bg-slate-150 px-1 rounded">»</code>, <code className="bg-slate-150 px-1 rounded">„</code> рахуються як <strong>два знаки</strong>.
                  </li>
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input Text Section */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-700" />
            <h2 className="text-base font-bold text-slate-900">Введіть текст для аналізу</h2>
          </div>
          {text && (
            <button
              onClick={handleClear}
              id="clear-text-btn"
              className="text-xs text-slate-400 hover:text-rose-600 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Очистити
            </button>
          )}
        </div>

        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            // Reset custom count when text changes to recalculate naturally
            setCustom3cmCount(null);
          }}
          placeholder="Напишіть або вставте ваш текст сюди"
          id="text-input-field"
          className="w-full min-h-[180px] md:min-h-[220px] p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 text-slate-800 text-sm leading-relaxed placeholder:text-slate-400 transition-all resize-y"
        />

        {/* Letter Coating Configuration */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-slate-700 block">
                Покриття літер
              </span>
              <span className="text-[11px] text-slate-400">
                Оберіть варіант покриття для автоматичного перерахунку цін
              </span>
            </div>
            
            <div className="relative w-full sm:w-64">
              <select
                value={coating}
                onChange={(e) => setCoating(e.target.value as CoatingType)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all cursor-pointer appearance-none shadow-sm pr-10"
              >
                {Object.keys(COATING_LABELS).map((key) => (
                  <option key={key} value={key}>
                    {COATING_LABELS[key as CoatingType]}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-500">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Digits Size configuration */}
        {totalDigits > 0 && (
          <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-slate-700 block">
                  Типорозміри знайдених цифр ({totalDigits})
                </span>
                <span className="text-[11px] text-slate-400">
                  Вкажіть розмір (висоту) для виявлених у тексті цифр
                </span>
              </div>
              <div className="flex bg-slate-200/50 p-1 rounded-xl w-fit self-start sm:self-center">
                <button
                  type="button"
                  onClick={() => setDigitsSizeMode("all3cm")}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    digitsSizeMode === "all3cm"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Всі 3 см
                </button>
                <button
                  type="button"
                  onClick={() => setDigitsSizeMode("all4cm")}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    digitsSizeMode === "all4cm"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Всі 4 см
                </button>
                <button
                  type="button"
                  onClick={() => setDigitsSizeMode("mixed")}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    digitsSizeMode === "mixed"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Змішані
                </button>
              </div>
            </div>

            {digitsSizeMode === "mixed" && (
              <div className="bg-white border border-slate-150 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-600 block">
                    Розподіліть кількість цифр між розмірами:
                  </span>
                  <div className="flex gap-4 text-[11px] text-slate-400">
                    <span>Висота 3см: <strong className="text-slate-700">{stats.digits3cm || 0}</strong></span>
                    <span>Висота 4см: <strong className="text-slate-700">{stats.digits4cm || 0}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {/* Controls for 3cm count */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500">3 см:</span>
                    <button
                      type="button"
                      disabled={(stats.digits3cm || 0) <= 0}
                      onClick={() => {
                        const current3 = stats.digits3cm || 0;
                        setCustom3cmCount(Math.max(0, current3 - 1));
                      }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold transition-all disabled:opacity-30 cursor-pointer"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-xs font-mono font-bold text-slate-800">
                      {stats.digits3cm || 0}
                    </span>
                    <button
                      type="button"
                      disabled={(stats.digits3cm || 0) >= totalDigits}
                      onClick={() => {
                        const current3 = stats.digits3cm || 0;
                        setCustom3cmCount(Math.min(totalDigits, current3 + 1));
                      }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold transition-all disabled:opacity-30 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {/* Quick Tariff Indicators */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 text-[11px] text-slate-500 bg-slate-50 py-1.5 px-3 rounded-xl border border-slate-100">
            <span className="font-semibold block sm:inline">Діючі ціни ({selectedCurrency}):</span>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span>Великі: <strong>{displayUpper.toFixed(2)}</strong></span>
              <span className="text-slate-300">|</span>
              <span>Малі: <strong>{displayLower.toFixed(2)}</strong></span>
              <span className="text-slate-300">|</span>
              <span>Цифри 3см: <strong>{displayDigits3cm.toFixed(2)}</strong></span>
              <span className="text-slate-300">|</span>
              <span>Цифри 4см: <strong>{displayDigits4cm.toFixed(2)}</strong></span>
              <span className="text-slate-300">|</span>
              <span>Знаки: <strong>{displayPunctuation.toFixed(2)}</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleSaveToHistory}
              disabled={!text.trim() || saving}
              id="save-history-btn"
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white dark-btn bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:pointer-events-none rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Збереження..." : "Зберегти в історію"}
            </button>
          </div>
        </div>
      </div>

      {/* Save Success Toast */}
      <AnimatePresence>
        {showSavedToast && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl p-3 flex items-center gap-2 max-w-sm mx-auto text-xs font-semibold justify-center"
          >
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            Запис успішно збережено в історію!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live Calculation Table Results */}
      <div className="w-full" id="results-section">
        
        {/* Statistics Table Card */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-sans">
              Результати розрахунку
            </h3>
            
            {/* Currency Selector */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200" id="currency-selector">
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

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-medium">
                  <th className="pb-3 font-semibold">Символи</th>
                  <th className="pb-3 font-semibold text-center">Кількість</th>
                  <th className="pb-3 font-semibold text-right">Сума ({selectedCurrency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-700">
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 font-medium flex flex-col items-start gap-0.5">
                    <span>Великі літери</span>
                    <span className="text-[10px] text-slate-400 font-mono">(А, Б...)</span>
                  </td>
                  <td className="py-3 text-center font-mono font-medium">{stats.upper}</td>
                  <td className="py-3 text-right font-mono font-semibold">{(stats.upper * displayUpper).toFixed(2)}</td>
                </tr>
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 font-medium flex flex-col items-start gap-0.5">
                    <span>Малі літери</span>
                    <span className="text-[10px] text-slate-400 font-mono">(а, б...)</span>
                  </td>
                  <td className="py-3 text-center font-mono font-medium">{stats.lower}</td>
                  <td className="py-3 text-right font-mono font-semibold">{(stats.lower * displayLower).toFixed(2)}</td>
                </tr>
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 font-medium flex flex-col items-start gap-0.5">
                    <span>Цифри (3 см)</span>
                    <span className="text-[10px] text-slate-400 font-mono">(висота 3см)</span>
                  </td>
                  <td className="py-3 text-center font-mono font-medium">{stats.digits3cm || 0}</td>
                  <td className="py-3 text-right font-mono font-semibold">{((stats.digits3cm || 0) * displayDigits3cm).toFixed(2)}</td>
                </tr>
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 font-medium flex flex-col items-start gap-0.5">
                    <span>Цифри (4 см)</span>
                    <span className="text-[10px] text-slate-400 font-mono">(висота 4см)</span>
                  </td>
                  <td className="py-3 text-center font-mono font-medium">{stats.digits4cm || 0}</td>
                  <td className="py-3 text-right font-mono font-semibold">{((stats.digits4cm || 0) * displayDigits4cm).toFixed(2)}</td>
                </tr>
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 font-medium flex flex-col items-start gap-0.5">
                    <span>Знаки *</span>
                    <span className="text-[10px] text-slate-400 font-mono">(. , - ^)</span>
                  </td>
                  <td className="py-3 text-center font-mono font-medium">{stats.punctuation}</td>
                  <td className="py-3 text-right font-mono font-semibold">{(stats.punctuation * displayPunctuation).toFixed(2)}</td>
                </tr>
                
                {/* Highlighted Total */}
                <tr className="bg-slate-900 text-white rounded-xl">
                  <td className="py-3.5 pl-3 font-bold rounded-l-xl">Усього (без пробілів)</td>
                  <td className="py-3.5 text-center font-mono font-bold">{stats.total}</td>
                  <td className="py-3.5 pr-3 text-right font-mono font-bold rounded-r-xl text-amber-300">
                    {displayCost.toFixed(2)} {selectedCurrency}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <span className="text-[10px] text-slate-400 italic leading-relaxed max-w-md block">
              * Враховує крапки над малими і (кирилична/латинська), над ї/Ї, хвостики над й/Й та подвійні лапки
            </span>
          </div>
        </div>

        {/* Export Section Card */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4" id="export-section">
          <div className="flex items-center gap-2">
            <FileDown className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-sans">
              Експорт результатів розрахунку
            </h3>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-200/60 rounded-2xl">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-700 block">
                Експортувати ціни та вартість
              </span>
              <span className="text-[11px] text-slate-400 block">
                Якщо вимкнено, звіт міститиме лише кількість символів без фінансових показників. Валюта: <span className="font-bold text-slate-600 font-mono">{selectedCurrency}</span>
              </span>
            </div>

            <div className="flex items-center">
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={exportPrices}
                  onChange={(e) => setExportPrices(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                <span className="ml-3 text-xs font-semibold text-slate-700">
                  {exportPrices ? "Увімкнено" : "Вимкнено"}
                </span>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={handlePrint}
              id="export-print-btn"
              className="flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
              title="Друкувати або зберегти як PDF через принтер"
            >
              <Printer className="w-4 h-4 text-indigo-600" />
              PDF / Друк
            </button>

            <button
              onClick={handleExportExcel}
              id="export-excel-btn"
              className="flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
              title="Завантажити звіт як MS Excel (.xls) файл"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              Експорт в MS Excel
            </button>

            <button
              onClick={handleExportCSV}
              id="export-csv-btn"
              className="flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
              title="Завантажити звіт як CSV файл"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              Експорт CSV
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
