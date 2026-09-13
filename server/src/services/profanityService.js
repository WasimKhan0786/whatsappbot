/**
  * Profanity & Abuse Detection Service
  * 
  * Identifies abusive language, insults, vulgarity, and harassment across:
  * 1. English profanity & derogatory terms
  * 2. Hindi / Hinglish / Urdu cuss words & slurs (in Latin / Roman transliteration)
  * 3. Leetspeak, spacing obfuscation, and repeated character evasion
  *
  * When flagged, the system intercepts the message, skips Google Gemini AI entirely,
  * and returns the owner-predefined dignified response.
  */

// Common Hinglish / Hindi / Urdu abusive terms (Latin transliteration)
const HINGLISH_ABUSIVE_TERMS = [
  'bhenchod',
  'behenchod',
  'bhenchodh',
  'madarchod',
  'madar\\s*chod',
  'madar\\s*ch**d',
  'bhosdike',
  'bhosdi',
  'bhosdika',
  'bhosadike',
  'chutiya',
  'chutiye',
  'chutiyapa',
  'ch**iya',
  'gaand',
  'gand',
  'gandu',
  'gaandu',
  'gaand\\s*mar',
  'harami',
  'haraami',
  'haramkhor',
  'kamine',
  'kaminay',
  'kamina',
  'kameena',
  'kutta',
  'kutte',
  'kutti',
  'saala',
  'saale',
  'sale',
  'suar',
  'randi',
  'raand',
  'lodu',
  'lauda',
  'lavda',
  'loda',
  'lund',
  'tatte',
  'tatta',
  'jhaatu',
  'jhatu',
  'maderchod',
  'bhen\\s*chod',
  'maa\\s*ki\\s*chut',
  'teri\\s*maa\\s*ki',
  'teri\\s*behen\\s*ki',
  'behen\\s*ke\\s*lode',
  'bkl',
  'mc',
  'bc',
  'bsdk',
  'mkc',
  'c\\*\\*tiya',
];

// Common English abusive, toxic, or offensive insults
const ENGLISH_ABUSIVE_TERMS = [
  'fuck',
  'fucking',
  'fucker',
  'f\\*+ck',
  'f\\*+ing',
  'motherfucker',
  'shit',
  'shiting',
  'bullshit',
  'bitch',
  'bitches',
  'b!tch',
  'asshole',
  'ass\\s*hole',
  'bastard',
  'bastards',
  'dickhead',
  'dick',
  'pussy',
  'cunt',
  'c\\*nt',
  'slut',
  'whore',
  'retard',
  'retarded',
  'nigger',
  'nigga',
  'faggot',
  'shut\\s*up',
  'get\\s*lost',
  'idiot',
  'stupid',
  'moron',
  'dumbass',
  'scumbag',
];

/**
 * Normalizes text to defeat simple evasion tactics:
 * - Leetspeak substitutions (@ -> a, $ -> s, 1 -> i, 0 -> o, 3 -> e, ! -> i)
 * - Asterisk masking stripping ('f***ing' -> 'fucking')
 * - Removing repetitive excessive letters ('fuuuuck' -> 'fuck')
 * - Collapsing multiple spaces and stripping common masking punctuation
 */
function normalizeForProfanityCheck(text) {
  if (!text || typeof text !== 'string') return '';

  let normalized = text.toLowerCase();

  // Replace common leetspeak substitutions
  normalized = normalized
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/!/g, 'i')
    .replace(/3/g, 'e')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/8/g, 'b');

  // Collapse repeated asterisks or punctuation (f***ing -> f*ing)
  normalized = normalized.replace(/\*+/g, '*');

  // Collapse letters repeated 3+ times to a single instance (e.g., 'fuuuuck' -> 'fuck', 'kamineeee' -> 'kamine')
  normalized = normalized.replace(/(.)\1{2,}/g, '$1');

  return normalized;
}

/**
 * Inspects a message for profanity, slurs, or toxic insults.
 * 
 * @param {string} messageText - The raw incoming WhatsApp text
 * @param {string[]} customKeywords - Optional custom owner-provided blacklisted keywords
 * @returns {{ hasProfanity: boolean, matches: string[], detectedWord: string|null, confidence: number }}
 */
function detectProfanity(messageText, customKeywords = []) {
  if (!messageText || typeof messageText !== 'string') {
    return {
      hasProfanity: false,
      matches: [],
      detectedWord: null,
      confidence: 0,
    };
  }

  const rawLower = messageText.toLowerCase().trim();
  const normalized = normalizeForProfanityCheck(rawLower);

  const matchedWords = new Set();

  // 1. Check custom owner keywords first (exact word boundaries or direct includes)
  if (Array.isArray(customKeywords)) {
    for (const rawKw of customKeywords) {
      if (!rawKw || typeof rawKw !== 'string') continue;
      const kw = rawKw.trim().toLowerCase();
      if (!kw) continue;

      try {
        const pattern = new RegExp(`\\b${escapeRegExp(kw)}\\b`, 'i');
        if (pattern.test(rawLower) || pattern.test(normalized) || rawLower.includes(kw)) {
          matchedWords.add(kw);
        }
      } catch (err) {
        if (rawLower.includes(kw)) matchedWords.add(kw);
      }
    }
  }

  // 2. Check Hinglish / Hindi / Urdu abusive terms
  for (const term of HINGLISH_ABUSIVE_TERMS) {
    try {
      const regex = new RegExp(`(^|\\b|\\s|_)${term}(\\b|\\s|_|$)`, 'i');
      if (regex.test(rawLower) || regex.test(normalized)) {
        matchedWords.add(term.replace(/\\s\*/g, '').replace(/\\b/g, ''));
      }
    } catch (e) {
      // ignore regex build error
    }
  }

  // 3. Check English abusive terms
  for (const term of ENGLISH_ABUSIVE_TERMS) {
    try {
      const regex = new RegExp(`(^|\\b|\\s|_)${term}(\\b|\\s|_|$)`, 'i');
      if (regex.test(rawLower) || regex.test(normalized)) {
        matchedWords.add(term.replace(/\\s\*/g, '').replace(/\\b/g, ''));
      }
    } catch (e) {
      // ignore
    }
  }

  const matchesList = Array.from(matchedWords);
  const hasProfanity = matchesList.length > 0;

  return {
    hasProfanity,
    matches: matchesList,
    detectedWord: matchesList[0] || null,
    confidence: hasProfanity ? 0.98 : 0,
  };
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  detectProfanity,
  normalizeForProfanityCheck,
  HINGLISH_ABUSIVE_TERMS,
  ENGLISH_ABUSIVE_TERMS,
};
