import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, query, where, orderBy, getDocs, deleteDoc, doc } from "firebase/firestore";
import { TextRecord, COATING_LABELS, CoatingType } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { CurrencyCode, ExchangeRates, formatCurrencyValue } from "../utils/currency";
import { 
  History, 
  Trash2, 
  ChevronRight, 
  FileText, 
  Calendar, 
  Search, 
  Loader2, 
  Coins, 
  Hash,
  RefreshCw,
  User,
  Users
} from "lucide-react";

interface HistoryViewProps {
  userId: string;
  isAdmin?: boolean;
  onLoadRecord: (text: string, coating?: CoatingType) => void;
  selectedCurrency: CurrencyCode;
  rates: ExchangeRates;
}

export default function HistoryView({ userId, isAdmin = false, onLoadRecord, selectedCurrency, rates }: HistoryViewProps) {
  const [records, setRecords] = useState<TextRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      if (userId === "local-guest") {
        const stored = localStorage.getItem("local_history");
        const historyList = stored ? JSON.parse(stored) : [];
        setRecords(historyList);
      } else {
        let q;
        if (isAdmin && showAllHistory) {
          q = query(
            collection(db, "history"),
            orderBy("createdAt", "desc")
          );
        } else {
          q = query(
            collection(db, "history"),
            where("userId", "==", userId),
            orderBy("createdAt", "desc")
          );
        }
        const querySnapshot = await getDocs(q);
        const docs: TextRecord[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data() as any;
          docs.push({
            id: doc.id,
            userId: data.userId,
            userEmail: data.userEmail,
            userDisplayName: data.userDisplayName,
            text: data.text,
            stats: data.stats,
            cost: data.cost,
            coating: data.coating,
            createdAt: data.createdAt
          });
        });
        setRecords(docs);
      }
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [userId, showAllHistory]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent clicking the card to load it
    
    setDeletingId(id);
    try {
      if (userId === "local-guest") {
        const stored = localStorage.getItem("local_history");
        let historyList = stored ? JSON.parse(stored) : [];
        historyList = historyList.filter((r: any) => r.id !== id);
        localStorage.setItem("local_history", JSON.stringify(historyList));
        setRecords(historyList);
      } else {
        await deleteDoc(doc(db, "history", id));
        setRecords(records.filter(r => r.id !== id));
      }
    } catch (err) {
      console.error("Error deleting record:", err);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  // Filter records based on search query
  const filteredRecords = records.filter(rec => 
    rec.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (rec.stats.dates && rec.stats.dates.some(d => d.toLowerCase().includes(searchQuery.toLowerCase()))) ||
    (rec.userDisplayName && rec.userDisplayName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (rec.userEmail && rec.userEmail.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto" id="history-view">
      
      {/* Search and Action Bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col lg:flex-row items-center justify-between gap-3">
        <div className="relative w-full lg:max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Шукати в історії за текстом, датою або користувачем..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 text-slate-800 text-xs transition-all"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto justify-end">
          {isAdmin && (
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/60 w-full sm:w-auto">
              <button
                onClick={() => setShowAllHistory(false)}
                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all flex-grow sm:flex-grow-0 cursor-pointer ${
                  !showAllHistory
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <User className="w-3.5 h-3.5" />
                Моя історія
              </button>
              <button
                onClick={() => setShowAllHistory(true)}
                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all flex-grow sm:flex-grow-0 cursor-pointer ${
                  showAllHistory
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Вся історія
              </button>
            </div>
          )}

          <button
            onClick={fetchHistory}
            id="refresh-history-btn"
            className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer active:scale-95 w-full sm:w-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Оновити
          </button>
        </div>
      </div>

      {/* History Records List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-slate-900 mb-2" />
          <p className="text-sm font-semibold">Завантаження історії...</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center text-slate-400 shadow-sm">
          <History className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">Історія порожня</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {searchQuery 
              ? "Не знайдено жодного запису за вашим пошуковим запитом." 
              : "Тут з'являться ваші проаналізовані тексти після збереження їх у калькуляторі."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filteredRecords.map((record) => {
              const formattedDate = record.createdAt?.toDate 
                ? record.createdAt.toDate().toLocaleString("uk-UA") 
                : new Date(record.createdAt).toLocaleString("uk-UA");

              return (
                <motion.div
                  key={record.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onClick={() => onLoadRecord(record.text, record.coating)}
                  className="bg-white hover:bg-slate-50/50 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all p-5 flex items-start justify-between gap-4 cursor-pointer relative overflow-hidden group select-none"
                >
                  <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                        <Calendar className="w-3 h-3" />
                        {formattedDate}
                      </span>
                      <span className="h-3 w-px bg-slate-200"></span>
                      <span className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-50 border px-2 py-0.5 rounded font-mono font-semibold">
                        <Coins className="w-3 h-3 text-amber-500" />
                        {formatCurrencyValue(record.cost, selectedCurrency, rates)}
                      </span>
                      {record.coating && (
                        <>
                          <span className="h-3 w-px bg-slate-200"></span>
                          <span className="flex items-center gap-1 text-[10px] text-slate-600 bg-slate-50 border px-2 py-0.5 rounded-md font-sans font-semibold">
                            Покриття: {COATING_LABELS[record.coating] || record.coating}
                          </span>
                        </>
                      )}
                      {(record.userDisplayName || record.userEmail) && (
                        <>
                          <span className="h-3 w-px bg-slate-200"></span>
                          <span className="flex items-center gap-1 text-[10px] text-indigo-600 bg-indigo-50/50 border border-indigo-100 px-2 py-0.5 rounded-md font-sans font-medium">
                            <User className="w-3 h-3 text-indigo-500" />
                            <span>
                              {record.userDisplayName || "Користувач"}
                              {record.userEmail && <span className="text-slate-400 font-normal"> ({record.userEmail})</span>}
                            </span>
                          </span>
                        </>
                      )}
                    </div>

                    {/* Preview Text */}
                    <p className="text-slate-800 text-xs leading-relaxed line-clamp-2 pr-4">
                      {record.text}
                    </p>

                    {/* Meta stats tags */}
                    <div className="flex flex-wrap gap-2 text-[10px] font-mono text-slate-500">
                      <span className="bg-slate-50 px-2 py-1 rounded">
                        Великі: <strong className="text-slate-700">{record.stats.upper}</strong>
                      </span>
                      <span className="bg-slate-50 px-2 py-1 rounded">
                        Малі: <strong className="text-slate-700">{record.stats.lower}</strong>
                      </span>
                      {record.stats.digits3cm !== undefined || record.stats.digits4cm !== undefined ? (
                        <>
                          <span className="bg-slate-50 px-2 py-1 rounded">
                            Цифри 3см: <strong className="text-slate-700">{record.stats.digits3cm || 0}</strong>
                          </span>
                          <span className="bg-slate-50 px-2 py-1 rounded">
                            Цифри 4см: <strong className="text-slate-700">{record.stats.digits4cm || 0}</strong>
                          </span>
                        </>
                      ) : (
                        <span className="bg-slate-50 px-2 py-1 rounded">
                          Цифри: <strong className="text-slate-700">{record.stats.digits}</strong>
                        </span>
                      )}
                      <span className="bg-slate-50 px-2 py-1 rounded">
                        Розділові: <strong className="text-slate-700">{record.stats.punctuation}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {confirmDeleteId === record.id ? (
                      <div className="flex items-center gap-1 bg-rose-50 border border-rose-100 p-1 rounded-xl">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(null);
                          }}
                          className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        >
                          Скасувати
                        </button>
                        <button
                          onClick={(e) => handleDelete(record.id, e)}
                          disabled={deletingId === record.id}
                          className="px-2 py-1 text-[10px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                        >
                          {deletingId === record.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            "Так"
                          )}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(record.id);
                        }}
                        disabled={deletingId === record.id}
                        className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Видалити запис"
                      >
                        {deletingId === record.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-600 transition-colors" />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
