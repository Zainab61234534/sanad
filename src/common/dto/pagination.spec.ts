import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { paged, skipTake } from './pagination.dto.js';

describe('pagination helpers', () => {
  it('computes skip and take from page and limit', () => {
    expect(skipTake({ page: 3, limit: 10 })).toEqual({ skip: 20, take: 10 });
  });

  it('builds page metadata', () => {
    expect(paged(['a', 'b'], 5, { page: 2, limit: 2 })).toEqual({
      items: ['a', 'b'],
      meta: { page: 2, limit: 2, total: 5, totalPages: 3 },
    });
  });

  it('reports zero pages for an empty result', () => {
    expect(paged([], 0, { page: 1, limit: 10 }).meta.totalPages).toBe(0);
  });
});
