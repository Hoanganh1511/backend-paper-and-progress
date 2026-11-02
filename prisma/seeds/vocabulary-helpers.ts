// Builders for the vocabulary data, so a unit can be written as plain rows.
// Run with node --experimental-strip-types, so keep to erasable TypeScript only.
import type { Entry, UnitData } from './vocabulary-data.ts';

/** [word, easily confused words, meaning, example] */
type ContrastRow = [string, string, string, string];
/** [word, meaning, example] */
type PlainRow = [string, string, string];
/** [word, grammar pattern, meaning, example] */
type PatternRow = [string, string, string, string];
/** [word, derived words, meaning, example] */
type FormationRow = [string, string, string, string];

export interface UnitRows {
  contrast: ContrastRow[];
  phrasal: PlainRow[];
  collocation: PlainRow[];
  pattern: PatternRow[];
  formation: FormationRow[];
}

/** Turns the rows of one unit into the entries the seed and the quiz read. */
export function unitFromRows(
  unitNumber: number,
  topic: string,
  rows: UnitRows,
): UnitData {
  const plain = ([word, meaning, example]: PlainRow): Entry => ({
    word,
    meaning,
    example,
  });
  return {
    unitNumber,
    topic,
    sections: {
      TOPIC_CONTRAST: rows.contrast.map(
        ([word, contrast, meaning, example]): Entry => ({
          word,
          contrast,
          meaning,
          example,
        }),
      ),
      PHRASAL_VERB: rows.phrasal.map(plain),
      PHRASE_COLLOCATION: rows.collocation.map(plain),
      WORD_PATTERN: rows.pattern.map(
        ([word, pattern, meaning, example]): Entry => ({
          word,
          pattern,
          meaning,
          example,
        }),
      ),
      WORD_FORMATION: rows.formation.map(
        ([word, forms, meaning, example]): Entry => ({
          word,
          forms,
          meaning,
          example,
        }),
      ),
    },
  };
}
