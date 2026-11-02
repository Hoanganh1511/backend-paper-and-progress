import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { MembershipService } from './membership.service.js';

const DAY = 86_400_000;

function setup(row: { expiresAt: Date; source: 'ADMIN' | 'PAYMENT' } | null) {
  const prisma = {
    membership: {
      findUnique: vi.fn().mockResolvedValue(row),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: { findUnique: vi.fn().mockResolvedValue({ id: 'u1' }) },
  };
  return { service: new MembershipService(prisma as never), prisma };
}

describe('MembershipService', () => {
  it('is not a member without a row', async () => {
    const { service } = setup(null);
    expect(await service.get('u1')).toEqual({
      isMember: false,
      expiresAt: null,
      source: null,
    });
  });

  it('is a member until the end date, not after', async () => {
    const future = setup({
      expiresAt: new Date(Date.now() + DAY),
      source: 'ADMIN',
    });
    expect(await future.service.isMember('u1')).toBe(true);
    const past = setup({
      expiresAt: new Date(Date.now() - DAY),
      source: 'ADMIN',
    });
    expect(await past.service.isMember('u1')).toBe(false);
  });

  it('grants by setting the end date, and refuses a date that has passed', async () => {
    const { service, prisma } = setup(null);
    const expiresAt = new Date(Date.now() + 30 * DAY);
    await service.grant('u1', expiresAt);
    expect(prisma.membership.upsert).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      create: { userId: 'u1', expiresAt, source: 'ADMIN' },
      update: { expiresAt, source: 'ADMIN' },
    });
    await expect(
      service.grant('u1', new Date(Date.now() - DAY)),
    ).rejects.toThrow(BadRequestException);
    await expect(service.grant('u1', new Date('nope'))).rejects.toThrow(
      BadRequestException,
    );
  });

  it('does not grant to a user that does not exist', async () => {
    const { service, prisma } = setup(null);
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      service.grant('ghost', new Date(Date.now() + DAY)),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.membership.upsert).not.toHaveBeenCalled();
  });

  it('revokes by deleting the row', async () => {
    const { service, prisma } = setup(null);
    await service.revoke('u1');
    expect(prisma.membership.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
    });
  });
});
