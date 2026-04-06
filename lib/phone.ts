/**
 * Pakistani phone number normalization.
 *
 * Accepts all of these messy inputs and returns +92XXXXXXXXXX:
 *   03001234567
 *   0300-1234567
 *   0300 1234567
 *   +923001234567
 *   +92-300-1234567
 *   92 300 1234567
 *   300 1234567
 *   "zero three double zero one two three four five six seven"  (handled upstream by LLM)
 *
 * Valid Pakistani mobile format: 11 digits starting with 03, or +923 + 9 digits.
 */

const WORD_TO_DIGIT: Record<string, string> = {
  zero: '0', one: '1', two: '2', three: '3', four: '4',
  five: '5', six: '6', seven: '7', eight: '8', nine: '9',
  oh: '0', o: '0',
  double: 'DOUBLE', triple: 'TRIPLE', // handled specially
};

export function wordsToDigits(input: string): string {
  // Handle "double zero" = "00", "triple five" = "555"
  const tokens = input.toLowerCase().split(/[\s-]+/);
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === 'double' || t === 'triple') {
      const next = tokens[i + 1];
      if (next && WORD_TO_DIGIT[next]) {
        const digit = WORD_TO_DIGIT[next];
        out.push(t === 'double' ? digit + digit : digit + digit + digit);
        i++;
        continue;
      }
    }
    if (WORD_TO_DIGIT[t]) {
      out.push(WORD_TO_DIGIT[t]);
    } else {
      out.push(t);
    }
  }
  return out.join(' ');
}

export function normalizePakistaniPhone(raw: string): string | null {
  if (!raw) return null;

  // First pass: convert any spelled-out digits
  let s = wordsToDigits(raw);

  // Strip everything that's not a digit or +
  s = s.replace(/[^\d+]/g, '');

  // Remove leading +
  const hasPlus = s.startsWith('+');
  if (hasPlus) s = s.slice(1);

  // Now we have only digits
  if (!/^\d+$/.test(s)) return null;

  // Cases:
  // 03001234567          (11 digits, starts with 03) -> +923001234567
  // 923001234567         (12 digits, starts with 92) -> +923001234567
  // 3001234567           (10 digits, starts with 3)  -> +923001234567  (missing leading 0)
  if (s.length === 11 && s.startsWith('03')) {
    return '+92' + s.slice(1);
  }
  if (s.length === 12 && s.startsWith('92')) {
    const rest = s.slice(2);
    if (rest.startsWith('3')) return '+92' + rest;
  }
  if (s.length === 10 && s.startsWith('3')) {
    return '+92' + s;
  }

  return null;
}

export function isValidPakistaniMobile(phone: string): boolean {
  return /^\+923\d{9}$/.test(phone);
}

export function formatForDisplay(phone: string): string {
  // +923001234567 -> 0300-1234567
  if (!isValidPakistaniMobile(phone)) return phone;
  const local = '0' + phone.slice(3);
  return `${local.slice(0, 4)}-${local.slice(4)}`;
}
