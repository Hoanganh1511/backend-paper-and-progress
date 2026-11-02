import { describe, expect, it, vi } from 'vitest';
import {
  MAX_REVISIONS,
  MERGE_WINDOW_MS,
  RevisionsService,
} from './revisions.service.js';

const snapshot = {
  title: 'T',
  contentJson: {},
  contentHtml: '<p>x</p>',
  contentText: 'x',
};
const now = new Date('2026-11-01T10:00:00Z');

function setup(last: unknown) {
  const articleRevision = {
    findFirst: vi.fn().mockResolvedValue(last),
    update: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({}),
    findMany: vi.fn().mockResolvedValue([]),
    deleteMany: vi.fn(),
  };
  return {
    service: new RevisionsService({ articleRevision } as never),
    articleRevision,
  };
}

describe('RevisionsService.record', () => {
  it('overwrites the last revision of the same person within two minutes (auto-save)', async () => {
    const { service, articleRevision } = setup({
      id: 'r1',
      createdById: 'u1',
      createdAt: new Date(now.getTime() - MERGE_WINDOW_MS + 1000),
    });
    await service.record('a1', 'u1', snapshot, { merge: true, now });
    expect(articleRevision.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: snapshot,
    });
    expect(articleRevision.create).not.toHaveBeenCalled();
  });

  it.each([
    ['an older revision', 'u1', MERGE_WINDOW_MS + 1000],
    ['a revision by someone else', 'u2', 1000],
  ])('adds a new one after %s', async (_name, createdById, age) => {
    const { service, articleRevision } = setup({
      id: 'r1',
      createdById,
      createdAt: new Date(now.getTime() - age),
    });
    await service.record('a1', 'u1', snapshot, { merge: true, now });
    expect(articleRevision.create).toHaveBeenCalled();
    expect(articleRevision.update).not.toHaveBeenCalled();
  });

  it('never merges without the merge flag (publish, restore)', async () => {
    const { service, articleRevision } = setup({
      id: 'r1',
      createdById: 'u1',
      createdAt: new Date(now.getTime() - 1000),
    });
    await service.record('a1', 'u1', snapshot, { now });
    expect(articleRevision.create).toHaveBeenCalled();
    expect(articleRevision.findFirst).not.toHaveBeenCalled();
  });

  it('keeps only the newest 50', async () => {
    const { service, articleRevision } = setup(null);
    articleRevision.findMany.mockResolvedValue([
      { id: 'old1' },
      { id: 'old2' },
    ]);
    await service.record('a1', 'u1', snapshot, { now });
    expect(articleRevision.findMany.mock.calls[0][0].skip).toBe(MAX_REVISIONS);
    expect(articleRevision.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['old1', 'old2'] } },
    });
  });
});
