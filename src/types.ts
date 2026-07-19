export interface CoatingCoefficients {
  upper: number;
  lower: number;
  digits3cm: number;
  digits4cm: number;
  punctuation: number;
}

export type CoatingType = 
  | "transparent_lacquer"
  | "galvanic_nickel"
  | "galvanic_chrome"
  | "galvanic_gold"
  | "black_paint"
  | "white_paint";

export const COATING_LABELS: Record<CoatingType, string> = {
  transparent_lacquer: "Прозорий Лак",
  galvanic_nickel: "Гальванічний Нікель",
  galvanic_chrome: "Гальванічний Хром",
  galvanic_gold: "Гальванічне Золото",
  black_paint: "Чорна фарба",
  white_paint: "Біла фарба"
};

export interface PriceSettings {
  upper: number;       // Ціна за велику букву (грн/символ)
  lower: number;       // Ціна за малу букву (грн/символ)
  digits: number;      // Ціна за цифру (грн/символ) - fallback
  digits3cm: number;   // Ціна за цифру 3см (грн/символ)
  digits4cm: number;   // Ціна за цифру 4см (грн/символ)
  punctuation: number; // Ціна за розділовий знак (грн/символ)
  coatings?: Record<string, CoatingCoefficients>; // Коефіцієнти для різних покриттів
}

export interface SymbolStats {
  upper: number;
  lower: number;
  digits: number;
  digits3cm: number;
  digits4cm: number;
  punctuation: number;
  total: number;       // Загальна кількість символів (без пробілів)
  dates: string[];     // Знайдені дати в тексті
}

export interface TextRecord {
  id: string;
  userId: string;
  userEmail?: string;
  userDisplayName?: string;
  text: string;
  stats: SymbolStats;
  cost: number;
  coating?: CoatingType; // Вибране покриття
  createdAt: any; // firebase timestamp
}

export interface UserProfile {
  uid: string;
  email: string;
  isAdmin?: boolean;
}
