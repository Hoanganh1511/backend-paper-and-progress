import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MembershipOrdersService,
  addMonths,
  readPaymentConfig,
} from './membership-orders.service.js';

const ENV = {
  MEMBERSHIP_PRICE_MONTH: '50000',
  MEMBERSHIP_PRICE_YEAR: '500000',
  VIETQR_BANK_BIN: '970422',
  VIETQR_ACCOUNT_NO: '0123456789',
  VIETQR_ACCOUNT_NAME: 'NGUYEN VAN A',
};

function setup(
  options: {
    waiting?: object[];
    claimed?: number;
    order?: object | null;
    membership?: { expiresAt: Date } | null;
  } = {},
) {
  const order =
    options.order === undefined
      ? { id: 'o1', userId: 'u1', months: 1, status: 'PAID' }
      : options.order;
  const prisma = {
    membershipOrder: {
      findMany: vi.fn().mockResolvedValue(options.waiting ?? []),
      create: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'new',
          status: 'PENDING',
          createdAt: new Date(),
          paidAt: null,
          ...data,
        }),
      ),
      updateMany: vi.fn().mockResolvedValue({ count: options.claimed ?? 1 }),
      findUnique: vi.fn().mockResolvedValue(order),
    },
    membership: {
      findUnique: vi.fn().mockResolvedValue(options.membership ?? null),
      upsert: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  const events = { notify: vi.fn() };
  return {
    service: new MembershipOrdersService(prisma as never, events as never),
    prisma,
    events,
  };
}

describe('readPaymentConfig', () => {
  it('is null while a price or bank detail is missing', () => {
    expect(readPaymentConfig({})).toBeNull();
    expect(
      readPaymentConfig({ ...ENV, VIETQR_ACCOUNT_NO: '' } as never),
    ).toBeNull();
    expect(
      readPaymentConfig({ ...ENV, MEMBERSHIP_PRICE_YEAR: 'abc' } as never),
    ).toBeNull();
  });

  it('reads prices and the bank account', () => {
    expect(readPaymentConfig(ENV as never)).toMatchObject({
      prices: { MONTH: 50000, YEAR: 500000 },
      bankBin: '970422',
    });
  });
});

describe('addMonths', () => {
  it('adds whole months and clamps to the end of a short month', () => {
    expect(addMonths(new Date('2026-01-31T00:00:00Z'), 1).toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    );
    expect(addMonths(new Date('2026-11-02T00:00:00Z'), 12).toISOString()).toBe(
      '2027-11-02T00:00:00.000Z',
    );
  });
});

describe('MembershipOrdersService', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    Object.assign(process.env, ENV);
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it('stays closed until the owner has configured payment', async () => {
    delete process.env.VIETQR_ACCOUNT_NO;
    const { service } = setup();
    expect(service.plans()).toEqual({ isOpen: false, plans: [] });
    await expect(service.create('u1', 'MONTH')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('lists the plans with their prices', () => {
    expect(setup().service.plans()).toMatchObject({
      isOpen: true,
      plans: [
        { plan: 'MONTH', months: 1, amount: 50000 },
        { plan: 'YEAR', months: 12, amount: 500000 },
      ],
    });
  });

  it('opens an order with a transfer note and a QR carrying amount and note', async () => {
    const { service } = setup();
    const order = await service.create('u1', 'MONTH');
    expect(order.code).toMatch(/^PP[A-Z2-9]{8}$/);
    expect(order.amount).toBe(50000);
    const url = new URL(order.payment!.qrUrl);
    expect(url.pathname).toBe('/image/970422-0123456789-compact2.png');
    expect(url.searchParams.get('amount')).toBe('50000');
    expect(url.searchParams.get('addInfo')).toBe(order.code);
  });

  it('takes the price from the server, not from the client', async () => {
    const { service, prisma } = setup();
    await service.create('u1', 'YEAR');
    expect(prisma.membershipOrder.create.mock.calls[0][0].data).toMatchObject({
      amount: 500000,
      months: 12,
    });
  });

  it('returns the order already waiting for the same plan', async () => {
    const waiting = {
      id: 'old',
      userId: 'u1',
      plan: 'MONTH',
      months: 1,
      amount: 50000,
      code: 'PPABCDEFGH',
      status: 'PENDING',
      createdAt: new Date(),
      paidAt: null,
    };
    const { service, prisma } = setup({ waiting: [waiting] });
    expect((await service.create('u1', 'MONTH')).id).toBe('old');
    expect(prisma.membershipOrder.create).not.toHaveBeenCalled();
  });

  it('refuses a sixth waiting order', async () => {
    const waiting = Array.from({ length: 5 }, (_, i) => ({
      id: `o${i}`,
      plan: 'YEAR',
    }));
    const { service } = setup({ waiting });
    await expect(service.create('u1', 'MONTH')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('confirming adds the months from today when there is no membership', async () => {
    const { service, prisma } = setup();
    await service.confirm('o1');
    const call = prisma.membership.upsert.mock.calls[0][0];
    expect(call.create.source).toBe('PAYMENT');
    expect(call.create.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('confirming adds on top of what is left of a running membership', async () => {
    const endsAt = new Date(Date.now() + 10 * 86_400_000);
    const { service, prisma } = setup({ membership: { expiresAt: endsAt } });
    await service.confirm('o1');
    const { expiresAt } = prisma.membership.upsert.mock.calls[0][0].update;
    expect(expiresAt.toISOString()).toBe(addMonths(endsAt, 1).toISOString());
  });

  it('confirming a paid order again adds no time', async () => {
    const { service, prisma } = setup({ claimed: 0 });
    expect(await service.confirm('o1')).toEqual({
      ok: true,
      alreadyPaid: true,
    });
    expect(prisma.membership.upsert).not.toHaveBeenCalled();
  });

  it('does not confirm a cancelled order', async () => {
    const { service, prisma } = setup({
      claimed: 0,
      order: { id: 'o1', status: 'CANCELLED' },
    });
    await expect(service.confirm('o1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.membership.upsert).not.toHaveBeenCalled();
  });
});
