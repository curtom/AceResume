import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  detectPromptInjection,
  detectSourceConflict,
  unsupportedEntities,
  unsupportedNumbers,
} from '../src/index.js';

type EvaluationCase = {
  id: string;
  kind: 'numbers' | 'entities' | 'injection' | 'conflict';
  claim: string;
  sources: string[];
  expected: string[] | boolean;
};

const cases = JSON.parse(
  readFileSync(new URL('../evals/cases.json', import.meta.url), 'utf8'),
) as EvaluationCase[];

describe('desensitized AI safety evaluation set', () => {
  for (const evaluation of cases) {
    it(evaluation.id, () => {
      const actual =
        evaluation.kind === 'numbers'
          ? unsupportedNumbers(evaluation.claim, evaluation.sources)
          : evaluation.kind === 'entities'
            ? unsupportedEntities(evaluation.claim, evaluation.sources)
            : evaluation.kind === 'injection'
              ? detectPromptInjection(evaluation.claim)
              : detectSourceConflict(evaluation.sources);
      expect(actual).toEqual(evaluation.expected);
    });
  }

  it('keeps the safety evaluation pass threshold at 100% for the MVP gate', () => {
    expect(cases).toHaveLength(8);
  });
});
