-- AlterEnum
-- The learner can write one more list per word for each learning category.
ALTER TYPE "WordEntryKind" ADD VALUE 'WORD_FAMILY';
ALTER TYPE "WordEntryKind" ADD VALUE 'PHRASAL_VERB';
ALTER TYPE "WordEntryKind" ADD VALUE 'WORD_PATTERN';
ALTER TYPE "WordEntryKind" ADD VALUE 'WORD_FORMATION';
ALTER TYPE "WordEntryKind" ADD VALUE 'DEPENDENT_PREPOSITION';
ALTER TYPE "WordEntryKind" ADD VALUE 'SYNONYM';
ALTER TYPE "WordEntryKind" ADD VALUE 'ANTONYM';
ALTER TYPE "WordEntryKind" ADD VALUE 'CONVERSATION';
