import React, { useState } from "react";
import { auth, db } from "../firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { motion } from "motion/react";
import { LogIn, UserPlus, Key, Mail, Sparkles, Loader2 } from "lucide-react";

interface AuthCardProps {
  onAuthSuccess: () => void;
  onGuestLogin?: () => void;
}

export default function AuthCard({ onAuthSuccess, onGuestLogin }: AuthCardProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;
      
      // Create user document in Firestore if it doesn't exist
      const isDefaultAdmin = user.email?.toLowerCase() === "yavorskyy.taras@gmail.com";
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split("@")[0] || "Користувач",
        isAdmin: isDefaultAdmin,
        createdAt: new Date()
      }, { merge: true });

      onAuthSuccess();
    } catch (err: any) {
      console.error("Google Auth error:", err);
      if (err.code !== "auth/popup-closed-by-user") {
        setError(`Помилка авторизації Google: ${err.message || err.code}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!isLogin && password !== confirmPassword) {
      setError("Паролі не збігаються. Будь ласка, перевірте правильність введення.");
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Set displayName
        await updateProfile(user, { displayName: displayName || email.split("@")[0] });
        
        // Create user document in Firestore
        const isDefaultAdmin = email.toLowerCase() === "yavorskyy.taras@gmail.com";
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: displayName || email.split("@")[0],
          isAdmin: isDefaultAdmin,
          createdAt: new Date()
        });
      }
      onAuthSuccess();
    } catch (err: any) {
      console.error("Auth error details:", err);
      let errMsg = "Сталася помилка при авторизації. Перевірте дані.";
      
      if (err.code === "auth/operation-not-allowed") {
        errMsg = "Вхід за поштою та паролем наразі не активовано в консолі Firebase. Будь ласка, перейдіть до: Console -> Authentication -> Sign-in method -> Email/Password та увімкніть його. Або просто натисніть 'Продовжити як гість' нижче!";
      } else if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        errMsg = "Неправильна пошта або пароль. Якщо ви намагаєтесь зареєструвати новий акаунт, переконайтеся, що ви перейшли на вкладку 'Реєстрація' вгорі.";
      } else if (err.code === "auth/email-already-in-use") {
        errMsg = "Користувач з такою поштою вже існує. Будь ласка, увійдіть у свій акаунт за допомогою вкладки 'Вхід' вгорі.";
      } else if (err.code === "auth/weak-password") {
        errMsg = "Пароль занадто простий. Він має містити щонайменше 6 символів.";
      } else if (err.code === "auth/invalid-email") {
        errMsg = "Некоректний формат електронної пошти.";
      } else if (err.message) {
        errMsg = `Помилка: ${err.message} (${err.code || "unknown"})`;
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto" id="auth-card-container">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden"
      >
        <div className="px-8 pt-8 pb-6 bg-slate-900 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-500 rounded-full blur-3xl opacity-10 -ml-10 -mb-10"></div>
          
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-indigo-500/20 backdrop-blur-sm rounded-xl">
              <Sparkles className="w-6 h-6 text-indigo-400 animate-pulse" />
            </div>
            <span className="text-xs font-mono tracking-widest text-indigo-300 uppercase">
              TextCost Calc
            </span>
          </div>
          
          <h2 className="text-2xl font-bold font-sans tracking-tight">
            {isLogin ? "Ласкаво просимо" : "Створити акаунт"}
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            {isLogin 
              ? "Увійдіть для розрахунку вартості та збереження історії" 
              : "Зареєструйтесь для доступу до персонального калькулятора"}
          </p>
        </div>

        {/* Toggle Mode Tabs */}
        <div className="flex border-b border-slate-100 bg-slate-50/50" id="auth-mode-tabs">
          <button
            type="button"
            onClick={() => {
              setIsLogin(true);
              setError("");
            }}
            className={`flex-1 py-3 text-sm font-semibold transition-all border-b-2 ${
              isLogin
                ? "border-indigo-600 text-indigo-600 bg-white font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            Вхід (Логін)
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLogin(false);
              setError("");
            }}
            className={`flex-1 py-3 text-sm font-semibold transition-all border-b-2 ${
              !isLogin
                ? "border-indigo-600 text-indigo-600 bg-white font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            Реєстрація
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="bg-rose-50 text-rose-600 text-sm p-4 rounded-xl border border-rose-100 font-medium"
            >
              {error}
            </motion.div>
          )}

          {!isLogin && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider block ml-1">
                Ім'я
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Олексій"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 transition-all text-sm"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider block ml-1">
              Електронна пошта
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 transition-all text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider block ml-1">
              Пароль
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                <Key className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 transition-all text-sm"
              />
            </div>
          </div>

          {!isLogin && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider block ml-1">
                Повторіть пароль
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                  <Key className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 transition-all text-sm"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            id="auth-submit-btn"
            className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white dark-btn rounded-xl font-medium shadow-md transition-all flex items-center justify-center gap-2 text-sm select-none active:scale-[0.98] cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isLogin ? (
              <>
                <LogIn className="w-4 h-4" />
                Увійти
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Зареєструватися
              </>
            )}
          </button>

          {/* Separator for Google Sign In */}
          <div className="relative flex py-1 items-center text-slate-300">
            <div className="flex-grow border-t border-slate-100"></div>
            <span className="flex-shrink mx-4 text-[10px] uppercase tracking-wider font-semibold font-mono text-slate-400">або увійти через</span>
            <div className="flex-grow border-t border-slate-100"></div>
          </div>

          {/* Google Sign In Button */}
          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleSignIn}
            className="w-full py-3 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-semibold shadow-xs transition-all flex items-center justify-center gap-2.5 text-xs select-none active:scale-[0.98] cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.54 14.98 1 12 1 7.35 1 3.37 3.67 1.39 7.56l3.89 3.02C6.21 7.54 8.87 5.04 12 5.04z"
              />
              <path
                fill="#4285F4"
                d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.44h6.44c-.28 1.44-1.11 2.66-2.33 3.48l3.61 2.81c2.11-1.95 3.33-4.82 3.33-8.39z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.58a7.21 7.21 0 0 1 0-4.32L1.39 7.24a11.956 11.956 0 0 0 0 9.52l3.89-3.18z"
              />
              <path
                fill="#34A853"
                d="M12 23c3.24 0 5.97-1.08 7.96-2.91l-3.61-2.81c-1.01.68-2.3 1.09-3.96 1.09-3.13 0-5.79-2.5-6.72-5.54l-3.89 3.02C3.37 20.33 7.35 23 12 23z"
              />
            </svg>
            Продовжити з Google
          </button>

          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError("");
              }}
              className="text-indigo-600 hover:text-indigo-750 text-xs font-semibold cursor-pointer transition-colors"
            >
              {isLogin 
                ? "Немає акаунту? Створіть новий" 
                : "Вже маєте акаунт? Увійдіть"}
            </button>
          </div>

          {onGuestLogin && (
            <>
              <div className="relative flex py-2 items-center text-slate-300">
                <div className="flex-grow border-t border-slate-100"></div>
                <span className="flex-shrink mx-4 text-[10px] uppercase tracking-wider font-semibold font-mono text-slate-400">або</span>
                <div className="flex-grow border-t border-slate-100"></div>
              </div>

              <button
                type="button"
                onClick={onGuestLogin}
                id="auth-guest-btn"
                className="w-full py-3 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-xs select-none cursor-pointer"
              >
                Продовжити як гість (Локальний режим)
              </button>
            </>
          )}
        </form>
      </motion.div>
    </div>
  );
}
