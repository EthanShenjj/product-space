import { describe, expect, it } from 'vitest';
import { extractWebSearchSources } from './web-search';

describe('web search source handling', () => {
  it('keeps only deduplicated URLs emitted by the hosted web-search call', () => {
    expect(extractWebSearchSources([
      { type: 'message' },
      { type: 'web_search_call', action: { sources: [{ url: 'https://example.com/a' }, { url: 'https://example.com/a' }] } },
      { type: 'web_search_call', action: { sources: [{ url: 'https://example.org/b' }, { url: 42 }] } },
    ])).toEqual([
      { url: 'https://example.com/a' },
      { url: 'https://example.org/b' },
    ]);
  });
});
