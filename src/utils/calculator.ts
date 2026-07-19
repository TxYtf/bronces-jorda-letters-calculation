import { PriceSettings, SymbolStats, CoatingType } from "../types";

/**
 * Calculates details about the text: counts of upper/lower letters, digits, punctuation.
 * Implements the requested specific Ukrainian/custom grammar rules:
 * - Spaces are ignored ("пробіли не рахуємо")
 * - Dots over 'і' / 'І' add 1 to punctuation count ("до знаків додаємо крапку над 'і'")
 * - Dots over 'ї' / 'Ї' add 2 to punctuation count ("до знаків додаємо дві крапки над 'ї'")
 * - Tail over 'й' / 'Й' adds 1 to punctuation count ("до знаків додаємо хвостик над 'й'")
 * - Double quotes (", “, ”, «, », „) count as 2 punctuation symbols ("подвійні лапки рахуємо як два знаки")
 */
export function analyzeText(
  text: string,
  settings: PriceSettings,
  digits3cmCount?: number,
  digits4cmCount?: number,
  coating?: CoatingType
): { stats: SymbolStats; cost: number } {
  let upperCount = 0;
  let lowerCount = 0;
  let digitCount = 0;
  let punctuationCount = 0;

  // Double quotes list
  const doubleQuotes = ['"', '“', '”', '«', '»', '„'];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // 1. Ignore whitespaces
    if (/\s/.test(char)) {
      continue;
    }

    // Check if it is a digit
    if (char >= '0' && char <= '9') {
      digitCount++;
      continue;
    }

    // Check if it is a letter
    const isLetter = char.toLowerCase() !== char.toUpperCase();
    if (isLetter) {
      // Determine if it is upper or lower case
      if (char === char.toUpperCase()) {
        upperCount++;
      } else {
        lowerCount++;
      }

      // Special rule: add dots/tails of specific letters to punctuation count
      if (char === 'і' || char === 'i') {
        punctuationCount += 1; // 1 dot over lowercase 'і' or 'i' (uppercase 'І' and 'I' have no dots)
      } else if (char.toLowerCase() === 'ї') {
        punctuationCount += 2; // 2 dots over 'ї' / 'Ї'
      } else if (char.toLowerCase() === 'й') {
        punctuationCount += 1; // 1 tail over 'й' / 'Й'
      }
      continue;
    }

    // It is a punctuation or special character
    if (doubleQuotes.includes(char)) {
      punctuationCount += 2; // double quotes count as 2
    } else {
      punctuationCount += 1; // standard punctuation/special character
    }
  }

  // Detect dates
  const dates = extractDates(text);

  // Determine digits size distribution
  let d3 = digitCount;
  let d4 = 0;
  if (digits3cmCount !== undefined && digits4cmCount !== undefined) {
    if (digits3cmCount + digits4cmCount === digitCount) {
      d3 = digits3cmCount;
      d4 = digits4cmCount;
    } else {
      if (digits3cmCount + digits4cmCount > 0) {
        const ratio3 = digits3cmCount / (digits3cmCount + digits4cmCount);
        d3 = Math.round(digitCount * ratio3);
        d4 = digitCount - d3;
      } else {
        d3 = digitCount;
        d4 = 0;
      }
    }
  }

  // Total characters excluding spaces
  const total = upperCount + lowerCount + digitCount + punctuationCount;

  // Calculate costs with coating coefficients if active
  let upperCoeff = 1.0;
  let lowerCoeff = 1.0;
  let digits3cmCoeff = 1.0;
  let digits4cmCoeff = 1.0;
  let punctuationCoeff = 1.0;

  if (coating && coating !== "transparent_lacquer" && settings.coatings && settings.coatings[coating]) {
    const coeffs = settings.coatings[coating];
    upperCoeff = coeffs.upper !== undefined ? coeffs.upper : 1.0;
    lowerCoeff = coeffs.lower !== undefined ? coeffs.lower : 1.0;
    digits3cmCoeff = coeffs.digits3cm !== undefined ? coeffs.digits3cm : 1.0;
    digits4cmCoeff = coeffs.digits4cm !== undefined ? coeffs.digits4cm : 1.0;
    punctuationCoeff = coeffs.punctuation !== undefined ? coeffs.punctuation : 1.0;
  }

  const price3cm = settings.digits3cm !== undefined ? settings.digits3cm : settings.digits;
  const price4cm = settings.digits4cm !== undefined ? settings.digits4cm : settings.digits;

  const cost = 
    upperCount * (settings.upper * upperCoeff) +
    lowerCount * (settings.lower * lowerCoeff) +
    d3 * (price3cm * digits3cmCoeff) +
    d4 * (price4cm * digits4cmCoeff) +
    punctuationCount * (settings.punctuation * punctuationCoeff);

  // Round cost to 2 decimal places
  const roundedCost = Math.round(cost * 100) / 100;

  return {
    stats: {
      upper: upperCount,
      lower: lowerCount,
      digits: digitCount,
      digits3cm: d3,
      digits4cm: d4,
      punctuation: punctuationCount,
      total,
      dates
    },
    cost: roundedCost
  };
}

/**
 * Extracts dates from text in common Ukrainian formats:
 * - DD.MM.YYYY, DD.MM.YY, DD/MM/YYYY
 * - "13 липня 2026", "5 жовтня 24 року", "24 серпня"
 */
export function extractDates(text: string): string[] {
  if (!text) return [];

  const found: string[] = [];

  // 1. Numeric dates: e.g. 13.07.2026, 13/07/26, 13-07-2026
  const numericRegex = /\b\d{1,2}[\./-]\d{1,2}[\./-]\d{2,4}\b/g;
  let match;
  while ((match = numericRegex.exec(text)) !== null) {
    found.push(match[0]);
  }

  // 2. Ukrainian text dates: e.g. 13 липня 2026, 5 жовтня, 24 серпня 2026 року
  // Months list in Ukrainian (genitive/inflected)
  const monthsPattern = '(?:січня|лютого|березня|квітня|травня|червня|липня|серпня|вересня|жовтня|листопада|грудня)';
  const textDateRegex = new RegExp(`\\b\\d{1,2}\\s+${monthsPattern}(?:\\s+\\d{2,4})?(?:\\s*(?:р\\.|року))?\\b`, 'gi');
  
  while ((match = textDateRegex.exec(text)) !== null) {
    // Avoid duplicating if already found
    if (!found.includes(match[0])) {
      found.push(match[0]);
    }
  }

  return found;
}
