import { describe, expect, it } from 'vitest';
import cases from './phrase-matcher.cases.json' with { type: 'json' };
import {
  containsPhrase,
  isSamePhrase,
  isSingleWord,
  matchPhrase,
  normalizePhrase,
  sameWord,
  tokenize,
} from './phrase-matcher.js';

describe('shared cases (the web app runs the same file)', () => {
  it.each(cases)('$phrase | $sentence', ({ phrase, sentence, matched }) => {
    expect(containsPhrase(phrase, sentence)).toBe(matched);
  });
});

describe('sameWord', () => {
  it.each([
    ['meet', 'met'],
    ['run', 'running'],
    ['stop', 'stopped'],
    ['study', 'studies'],
    ['study', 'studied'],
    ['make', 'making'],
    ['need', 'needs'],
    ['be', 'was'],
  ])('%s ~ %s', (a, b) => expect(sameWord(a, b)).toBe(true));

  it.each([
    ['need', 'ne'],
    ['run', 'runn'],
    ['up', 'ups'],
    ['meet', 'meat'],
  ])('%s !~ %s', (a, b) => expect(sameWord(a, b)).toBe(false));
});

describe('matchPhrase', () => {
  it('returns the indexes of the matched words for highlighting', () => {
    const sentence = 'We met the deadline.';
    const result = matchPhrase('meet a deadline', sentence);
    const words = tokenize(sentence);
    expect(result.matched).toBe(true);
    expect(result.indexes.map((index) => words[index])).toEqual([
      'met',
      'the',
      'deadline',
    ]);
  });

  it('allows at most 3 words between phrase words', () => {
    expect(containsPhrase('meet deadline', 'meet one two three deadline')).toBe(
      true,
    );
    expect(
      containsPhrase('meet deadline', 'meet one two three four deadline'),
    ).toBe(false);
  });
});

describe('helpers', () => {
  it('normalizePhrase ignores case and spacing', () => {
    expect(normalizePhrase('  Meet   a Deadline ')).toBe('meet a deadline');
  });

  it('isSingleWord flags one-word phrases', () => {
    expect(isSingleWord('deadline')).toBe(true);
    expect(isSingleWord('meet a deadline')).toBe(false);
  });

  it('isSamePhrase ignores case, punctuation and a leading "to"', () => {
    expect(isSamePhrase('meet a deadline', 'Meet a  deadline.')).toBe(true);
    expect(isSamePhrase('to meet a deadline', 'meet a deadline')).toBe(true);
    expect(isSamePhrase('meet a deadline', 'meet the deadline')).toBe(false);
  });
});
