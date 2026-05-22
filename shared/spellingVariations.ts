/**
 * Spelling Variation Generator
 * 
 * Automatically generates at least 10 phonetic/spelling variations
 * of a given word to improve voice recognition accuracy.
 * 
 * Strategies:
 * 1. Common vowel substitutions (a→e, i→y, etc.)
 * 2. Consonant doubling/removal
 * 3. Space insertion (splitting word into syllables)
 * 4. Common phonetic misspellings
 * 5. Accent/diacritic removal
 * 6. Letter transposition
 * 7. Common speech-to-text errors
 * 8. Catalan/Spanish phonetic equivalences
 */

// Common phonetic substitution maps for Catalan/Spanish/English
const VOWEL_SUBS: Record<string, string[]> = {
  a: ["e", "à", "á"],
  e: ["a", "i", "è", "é"],
  i: ["y", "ee", "í"],
  o: ["u", "ó", "ò"],
  u: ["o", "ú", "ü"],
  à: ["a", "e"],
  á: ["a", "e"],
  è: ["e", "a"],
  é: ["e", "i"],
  í: ["i", "y"],
  ó: ["o", "u"],
  ò: ["o", "u"],
  ú: ["u", "o"],
  ü: ["u"],
  y: ["i", "ie"],
};

const CONSONANT_SUBS: Record<string, string[]> = {
  b: ["v"],
  v: ["b"],
  c: ["k", "s"],
  k: ["c", "q"],
  q: ["k", "c"],
  s: ["z", "c", "ss"],
  z: ["s"],
  g: ["j", "gu"],
  j: ["g", "h"],
  h: ["", "j"],
  ll: ["l", "y"],
  l: ["ll"],
  n: ["nn", "m"],
  m: ["n"],
  r: ["rr"],
  rr: ["r"],
  t: ["d"],
  d: ["t"],
  x: ["sh", "ch"],
  ch: ["x", "tx"],
  tx: ["ch", "x"],
  ny: ["ñ", "ni"],
  ñ: ["ny", "ni"],
};

/**
 * Remove diacritics/accents from a string
 */
function removeDiacritics(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Generate variations by substituting single vowels
 */
function vowelSubstitutions(word: string): string[] {
  const results: string[] = [];
  for (let i = 0; i < word.length; i++) {
    const char = word[i].toLowerCase();
    const subs = VOWEL_SUBS[char];
    if (subs) {
      for (const sub of subs) {
        const variant = word.slice(0, i) + sub + word.slice(i + 1);
        results.push(variant.toLowerCase());
      }
    }
  }
  return results;
}

/**
 * Generate variations by substituting consonant pairs
 */
function consonantSubstitutions(word: string): string[] {
  const results: string[] = [];
  const lw = word.toLowerCase();
  
  // Check for multi-char consonant groups first
  for (const [from, toList] of Object.entries(CONSONANT_SUBS)) {
    if (from.length > 1 && lw.includes(from)) {
      for (const to of toList) {
        results.push(lw.replace(from, to));
      }
    }
  }
  
  // Single char substitutions
  for (let i = 0; i < lw.length; i++) {
    const char = lw[i];
    const subs = CONSONANT_SUBS[char];
    if (subs) {
      for (const sub of subs) {
        if (sub.length <= 1) {
          const variant = lw.slice(0, i) + sub + lw.slice(i + 1);
          results.push(variant);
        }
      }
    }
  }
  return results;
}

/**
 * Generate variations by inserting spaces (syllable splits)
 */
function spaceSplits(word: string): string[] {
  const results: string[] = [];
  if (word.length < 3) return results;
  
  for (let i = 1; i < word.length; i++) {
    const before = word[i - 1];
    const after = word[i];
    const isVowel = (c: string) => "aeiouàèéíóòúü".includes(c.toLowerCase());
    
    if ((isVowel(before) && !isVowel(after)) || (!isVowel(before) && isVowel(after))) {
      const variant = word.slice(0, i) + " " + word.slice(i);
      results.push(variant.toLowerCase());
    }
  }
  return results;
}

/**
 * Generate variations by letter transposition (adjacent swap)
 */
function transpositions(word: string): string[] {
  const results: string[] = [];
  for (let i = 0; i < word.length - 1; i++) {
    const arr = word.split("");
    [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
    results.push(arr.join("").toLowerCase());
  }
  return results;
}

/**
 * Generate variations by dropping single letters
 */
function letterDrops(word: string): string[] {
  const results: string[] = [];
  if (word.length < 3) return results;
  for (let i = 0; i < word.length; i++) {
    const variant = word.slice(0, i) + word.slice(i + 1);
    if (variant.length >= 2) {
      results.push(variant.toLowerCase());
    }
  }
  return results;
}

/**
 * Generate variations by doubling letters
 */
function letterDoubles(word: string): string[] {
  const results: string[] = [];
  for (let i = 0; i < word.length; i++) {
    const isVowel = "aeiouàèéíóòúü".includes(word[i].toLowerCase());
    if (!isVowel) {
      const variant = word.slice(0, i) + word[i] + word.slice(i);
      results.push(variant.toLowerCase());
    }
  }
  return results;
}

/**
 * Generate variations with common prefix/suffix additions
 */
function affixVariations(word: string): string[] {
  const results: string[] = [];
  const lw = word.toLowerCase();
  
  const prefixes = ["h", "a"];
  for (const p of prefixes) {
    if (!lw.startsWith(p)) {
      results.push(p + lw);
    }
  }
  
  if (lw.startsWith("h")) {
    results.push(lw.slice(1));
  }
  
  if (lw.endsWith("a")) {
    results.push(lw.slice(0, -1) + "ah");
    results.push(lw.slice(0, -1));
  }
  
  return results;
}

/**
 * Main function: Generate at least 10 spelling variations of a word.
 * Returns unique, deduplicated variations (excluding the original word).
 */
export function generateSpellingVariations(word: string, minCount = 10): string[] {
  const original = word.toLowerCase().trim();
  if (!original) return [];
  
  const allVariants = new Set<string>();
  
  // Strategy 1: Remove diacritics
  const noDiacritics = removeDiacritics(original);
  if (noDiacritics !== original) {
    allVariants.add(noDiacritics);
  }
  
  // Strategy 2: Vowel substitutions
  for (const v of vowelSubstitutions(original)) {
    allVariants.add(v);
  }
  
  // Strategy 3: Consonant substitutions
  for (const v of consonantSubstitutions(original)) {
    allVariants.add(v);
  }
  
  // Strategy 4: Space splits
  for (const v of spaceSplits(original)) {
    allVariants.add(v);
  }
  
  // Strategy 5: Letter transpositions
  for (const v of transpositions(original)) {
    allVariants.add(v);
  }
  
  // Strategy 6: Letter drops
  for (const v of letterDrops(original)) {
    allVariants.add(v);
  }
  
  // Strategy 7: Letter doubles
  for (const v of letterDoubles(original)) {
    allVariants.add(v);
  }
  
  // Strategy 8: Affix variations
  for (const v of affixVariations(original)) {
    allVariants.add(v);
  }
  
  // Remove the original word and any empty strings
  allVariants.delete(original);
  allVariants.delete("");
  
  // Convert to array and sort by similarity to original
  const sorted = Array.from(allVariants)
    .filter((v) => v.length >= 2)
    .sort((a, b) => {
      const aDiff = Math.abs(a.length - original.length);
      const bDiff = Math.abs(b.length - original.length);
      return aDiff - bDiff;
    });
  
  // If we still don't have enough, generate second-order variations
  if (sorted.length < minCount) {
    const firstBatch = sorted.slice(0, 5);
    for (const variant of firstBatch) {
      for (const v of vowelSubstitutions(variant)) {
        if (v !== original && v.length >= 2) allVariants.add(v);
      }
      const noDiac = removeDiacritics(variant);
      if (noDiac !== original && noDiac !== variant) allVariants.add(noDiac);
    }
    allVariants.delete(original);
    allVariants.delete("");
  }
  
  const final = Array.from(allVariants)
    .filter((v) => v.length >= 2)
    .sort((a, b) => {
      const aDiff = Math.abs(a.length - original.length);
      const bDiff = Math.abs(b.length - original.length);
      return aDiff - bDiff;
    });
  
  return final.slice(0, Math.max(minCount, final.length));
}

/**
 * Merge new auto-generated variations with existing manual ones,
 * ensuring no duplicates and preserving manual entries.
 */
export function mergeVariations(existing: string[], autoGenerated: string[]): string[] {
  const set = new Set(existing.map((v) => v.toLowerCase().trim()));
  for (const v of autoGenerated) {
    set.add(v.toLowerCase().trim());
  }
  set.delete("");
  return Array.from(set);
}
