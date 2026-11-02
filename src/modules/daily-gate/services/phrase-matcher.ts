/**
 * Does a sentence contain a phrase? "meet a deadline" is found in "We met the
 * deadline" and "She meets deadlines", but not in "I meet him... the deadline".
 * Pure functions: the server decides, and the web app runs the same
 * phrase-matcher.cases.json to give instant feedback without drifting apart.
 */

/** Largest number of sentence tokens allowed between two neighbouring phrase tokens. */
export const MAX_GAP = 3;
/** Largest number of tokens a placeholder such as "sth" may stand for. */
const MAX_PLACEHOLDER = 3;

const DETERMINERS = new Set([
  'a',
  'an',
  'the',
  'my',
  'your',
  'his',
  'her',
  'its',
  'our',
  'their',
  'this',
  'that',
  'these',
  'those',
  'some',
  'any',
]);

const PLACEHOLDERS = new Set([
  'sb',
  'sth',
  'someone',
  'somebody',
  'something',
  "one's",
  'oneself',
]);

/** Forms of one irregular word; any two words of a group count as the same word. */
const IRREGULAR_GROUPS: string[][] = [
  ['be', 'am', 'is', 'are', 'was', 'were', 'been', 'being'],
  ['have', 'has', 'had', 'having'],
  ['do', 'does', 'did', 'done', 'doing'],
  ['go', 'goes', 'went', 'gone', 'going'],
  ['make', 'makes', 'made', 'making'],
  ['take', 'takes', 'took', 'taken', 'taking'],
  ['meet', 'meets', 'met', 'meeting'],
  ['get', 'gets', 'got', 'gotten', 'getting'],
  ['give', 'gives', 'gave', 'given', 'giving'],
  ['come', 'comes', 'came', 'coming'],
  ['see', 'sees', 'saw', 'seen', 'seeing'],
  ['know', 'knows', 'knew', 'known', 'knowing'],
  ['think', 'thinks', 'thought', 'thinking'],
  ['say', 'says', 'said', 'saying'],
  ['tell', 'tells', 'told', 'telling'],
  ['find', 'finds', 'found', 'finding'],
  ['bring', 'brings', 'brought', 'bringing'],
  ['buy', 'buys', 'bought', 'buying'],
  ['catch', 'catches', 'caught', 'catching'],
  ['keep', 'keeps', 'kept', 'keeping'],
  ['leave', 'leaves', 'left', 'leaving'],
  ['lose', 'loses', 'lost', 'losing'],
  ['pay', 'pays', 'paid', 'paying'],
  ['put', 'puts', 'putting'],
  ['run', 'runs', 'ran', 'running'],
  ['set', 'sets', 'setting'],
  ['sit', 'sits', 'sat', 'sitting'],
  ['speak', 'speaks', 'spoke', 'spoken', 'speaking'],
  ['spend', 'spends', 'spent', 'spending'],
  ['stand', 'stands', 'stood', 'standing'],
  ['teach', 'teaches', 'taught', 'teaching'],
  ['write', 'writes', 'wrote', 'written', 'writing'],
  ['break', 'breaks', 'broke', 'broken', 'breaking'],
  ['choose', 'chooses', 'chose', 'chosen', 'choosing'],
  ['drive', 'drives', 'drove', 'driven', 'driving'],
  ['eat', 'eats', 'ate', 'eaten', 'eating'],
  ['fall', 'falls', 'fell', 'fallen', 'falling'],
  ['feel', 'feels', 'felt', 'feeling'],
  ['hold', 'holds', 'held', 'holding'],
  ['hear', 'hears', 'heard', 'hearing'],
  ['pick', 'picks', 'picked', 'picking'],
  ['rise', 'rises', 'rose', 'risen', 'rising'],
  ['sell', 'sells', 'sold', 'selling'],
  ['send', 'sends', 'sent', 'sending'],
  ['show', 'shows', 'showed', 'shown', 'showing'],
  ['understand', 'understands', 'understood', 'understanding'],
  ['wake', 'wakes', 'woke', 'woken', 'waking'],
  ['wear', 'wears', 'wore', 'worn', 'wearing'],
  ['win', 'wins', 'won', 'winning'],
  ['child', 'children'],
  ['person', 'people'],
  ['man', 'men'],
  ['woman', 'women'],
  ['foot', 'feet'],
];

const GROUP_OF = new Map<string, number>();
IRREGULAR_GROUPS.forEach((group, index) => {
  for (const word of group) GROUP_OF.set(word, index);
});

const VOWELS = 'aeiou';
const isVowel = (char: string) => VOWELS.includes(char);

/** Lowercased words; punctuation is dropped, apostrophes inside a word stay. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9'/\s]+/g, ' ')
    .split(/\s+/)
    .map((token) => token.replace(/^'+|'+$/g, ''))
    .filter(Boolean);
}

/** For comparing phrases: trimmed, lowercase, single spaces. */
export const normalizePhrase = (text: string) =>
  text.trim().toLowerCase().replace(/\s+/g, ' ');

/** Regular inflections of a base word: -s/-es/-ies, -ed/-ied, -ing, doubled final consonant, dropped -e. */
function regularForms(base: string): Set<string> {
  const forms = new Set<string>([base]);
  if (base.length < 2) return forms;
  const last = base.at(-1) as string;
  const beforeLast = base.at(-2) as string;

  // -s
  if (/(s|x|z|ch|sh|o)$/.test(base)) forms.add(`${base}es`);
  if (last === 'y' && !isVowel(beforeLast))
    forms.add(`${base.slice(0, -1)}ies`);
  forms.add(`${base}s`);

  // -ed
  if (last === 'e') forms.add(`${base}d`);
  else if (last === 'y' && !isVowel(beforeLast))
    forms.add(`${base.slice(0, -1)}ied`);
  else forms.add(`${base}ed`);

  // -ing
  if (last === 'e' && base.length > 2 && base.at(-2) !== 'e')
    forms.add(`${base.slice(0, -1)}ing`);
  else forms.add(`${base}ing`);

  // stop -> stopped / stopping (one syllable: consonant-vowel-consonant)
  const beforeBefore = base.at(-3);
  if (
    base.length >= 3 &&
    beforeBefore !== undefined &&
    !isVowel(last) &&
    !'wxy'.includes(last) &&
    isVowel(beforeLast) &&
    !isVowel(beforeBefore) &&
    base.length <= 4
  ) {
    forms.add(`${base}${last}ed`);
    forms.add(`${base}${last}ing`);
  }
  return forms;
}

/** Does a sentence word count as the same word as a phrase word, in any inflection? */
export function sameWord(phraseWord: string, sentenceWord: string): boolean {
  if (phraseWord === sentenceWord) return true;
  const phraseGroup = GROUP_OF.get(phraseWord);
  const sentenceGroup = GROUP_OF.get(sentenceWord);
  if (phraseGroup !== undefined || sentenceGroup !== undefined) {
    return phraseGroup === sentenceGroup;
  }
  if (phraseWord.length < 3) return false; // "up", "of": exact only
  return regularForms(phraseWord).has(sentenceWord);
}

type Part =
  | { kind: 'determiner' }
  | { kind: 'placeholder' }
  | { kind: 'word'; options: string[] };

function toParts(phrase: string): Part[] {
  const tokens = tokenize(phrase);
  if (tokens[0] === 'to' && tokens.length > 1) tokens.shift();
  return tokens.map((token): Part => {
    if (PLACEHOLDERS.has(token)) return { kind: 'placeholder' };
    if (DETERMINERS.has(token)) return { kind: 'determiner' };
    return { kind: 'word', options: token.split('/').filter(Boolean) };
  });
}

export interface PhraseMatch {
  matched: boolean;
  /** Indexes (into `tokenize(sentence)`) of the words that matched, for highlighting. */
  indexes: number[];
}

const NO_MATCH: PhraseMatch = { matched: false, indexes: [] };

/**
 * Finds the phrase in the sentence. Every word of the phrase must appear, in
 * order, at most MAX_GAP words apart. Determiners may be swapped or left out.
 */
export function matchPhrase(phrase: string, sentence: string): PhraseMatch {
  const parts = toParts(phrase);
  const words = tokenize(sentence);
  if (!parts.some((part) => part.kind === 'word')) return NO_MATCH;

  // Matches parts[partIndex..] starting at `from` or up to MAX_GAP words later (anywhere for the
  // first part). Returns the matched word indexes, or null.
  const search = (
    partIndex: number,
    from: number,
    isFirst: boolean,
  ): number[] | null => {
    const part = parts[partIndex];
    if (part === undefined) return [];
    const lastStart = isFirst ? words.length - 1 : from + MAX_GAP;

    for (
      let start = from;
      start <= Math.min(lastStart, words.length - 1);
      start++
    ) {
      if (part.kind === 'determiner') {
        if (DETERMINERS.has(words[start])) {
          const rest = search(partIndex + 1, start + 1, false);
          if (rest) return [start, ...rest];
        }
        continue;
      }
      if (part.kind === 'placeholder') {
        for (let length = 1; length <= MAX_PLACEHOLDER; length++) {
          if (start + length > words.length) break;
          const rest = search(partIndex + 1, start + length, false);
          if (rest) {
            const covered = Array.from({ length }, (_, i) => start + i);
            return [...covered, ...rest];
          }
        }
        continue;
      }
      if (part.options.some((option) => sameWord(option, words[start]))) {
        const rest = search(partIndex + 1, start + 1, false);
        if (rest) return [start, ...rest];
      }
    }
    // A determiner may be missing from the sentence: "meet deadlines".
    if (part.kind === 'determiner') {
      return search(partIndex + 1, from, isFirst);
    }
    return null;
  };

  const indexes = search(0, 0, true);
  return indexes && indexes.length > 0 ? { matched: true, indexes } : NO_MATCH;
}

/** Is the sentence a use of the phrase? */
export const containsPhrase = (phrase: string, sentence: string) =>
  matchPhrase(phrase, sentence).matched;

/** A phrase of one word is better learned with its partners ("meet a deadline", not "deadline"). */
export const isSingleWord = (phrase: string) => toParts(phrase).length <= 1;

/** Is what the user typed the phrase itself, ignoring case, spacing and a leading "to"? */
export function isSamePhrase(phrase: string, typed: string): boolean {
  const strip = (text: string) => {
    const tokens = tokenize(text);
    if (tokens[0] === 'to' && tokens.length > 1) tokens.shift();
    return tokens.join(' ');
  };
  return strip(phrase) === strip(typed);
}
