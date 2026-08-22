import { describe, expect, it } from 'vitest';
import { feedbackSchema, personasSchema, summarySchema } from './definitions';

describe('Agent output schemas', () => {
  it('accepts the summary contract returned to the existing UI', () => {
    expect(summarySchema.parse({ productTitle: '产品想法', product: '用户明确', aiAdvice: '先访谈', userNotes: '待验证', cases: [] }).productTitle).toBe('产品想法');
  });

  it('rejects an invalid board vote and an incomplete persona payload', () => {
    expect(() => feedbackSchema.parse({ vote: 'BLUE', comment: 'x' })).toThrow();
    expect(() => personasSchema.parse([])).toThrow();
  });
});
