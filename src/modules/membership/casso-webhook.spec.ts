import { createHmac } from 'node:crypto';
import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sortKeys, verifyCassoSignature } from './casso-signature.js';
import { MembershipController } from './membership.controller.js';
import { MembershipEventsService } from './membership-events.service.js';
import {
  MembershipOrdersService,
  findOrderCode,
} from './membership-orders.service.js';

const KEY = 'secure-key';
const T = '1734924830020';

/** Signs the way Casso documents it: HMAC-SHA512 of `<t>.<sorted JSON>`. */
const sign = (data: unknown, key = KEY) =>
  `t=${T},v1=${createHmac('sha512', key)
    .update(`${T}.${JSON.stringify(sortKeys(data))}`)
    .digest('hex')}`;

const transaction = {
  id: 9001,
  reference: 'FT1',
  description: 'NGUYEN VAN A chuyen tien PPABCDEFGH',
  amount: 39000,
  accountNumber: '0123456789',
};
const body = { error: 0, data: transaction };

describe('sortKeys', () => {
  it('sorts the keys of every object, however deep, and leaves arrays in order', () => {
    expect(
      JSON.stringify(sortKeys({ b: 1, a: { d: 2, c: [{ z: 1, y: 2 }] } })),
    ).toBe('{"a":{"c":[{"y":2,"z":1}],"d":2},"b":1}');
  });

  it('keeps null as a value', () => {
    expect(sortKeys({ a: null })).toEqual({ a: null });
  });
});

describe('verifyCassoSignature', () => {
  it('accepts a signature made over the data', () => {
    expect(verifyCassoSignature(sign(transaction), body, KEY)).toBe(true);
  });

  it('accepts a signature made over the whole body', () => {
    expect(verifyCassoSignature(sign(body), body, KEY)).toBe(true);
  });

  it('does not depend on the order of the keys in the call', () => {
    const shuffled = {
      data: Object.fromEntries(Object.entries(transaction).reverse()),
      error: 0,
    };
    expect(verifyCassoSignature(sign(transaction), shuffled, KEY)).toBe(true);
  });

  it('rejects a changed amount', () => {
    const tampered = { ...body, data: { ...transaction, amount: 1 } };
    expect(verifyCassoSignature(sign(transaction), tampered, KEY)).toBe(false);
  });

  it('rejects another key, a missing or a broken header', () => {
    expect(verifyCassoSignature(sign(transaction, 'other'), body, KEY)).toBe(
      false,
    );
    expect(verifyCassoSignature(undefined, body, KEY)).toBe(false);
    expect(verifyCassoSignature('garbage', body, KEY)).toBe(false);
    expect(verifyCassoSignature(`t=${T},v1=abcd`, body, KEY)).toBe(false);
    expect(verifyCassoSignature(sign(transaction), body, '')).toBe(false);
  });
});

describe('findOrderCode', () => {
  it('finds the code anywhere in the note, whatever its case', () => {
    expect(findOrderCode('NGUYEN VAN A chuyen tien PPABCDEFGH')).toBe(
      'PPABCDEFGH',
    );
    expect(findOrderCode('thanh toan ppabcdefgh cam on')).toBe('PPABCDEFGH');
    expect(findOrderCode('MBVCB.123.PPABCDEFGH.CT tu NGUYEN')).toBe(
      'PPABCDEFGH',
    );
  });

  it('finds nothing in a note without a code, or with a letter the codes never use', () => {
    expect(findOrderCode('chuyen tien hoc phi')).toBeNull();
    expect(findOrderCode('PPABCDEFGO')).toBeNull();
  });
});

function orderService(order: object | null, claimed = 1) {
  const prisma = {
    membershipOrder: {
      findUnique: vi
        .fn()
        .mockImplementation(({ where }) =>
          Promise.resolve(
            where.code
              ? order
              : { id: 'o1', userId: 'u1', months: 1, status: 'PAID' },
          ),
        ),
      updateMany: vi.fn().mockResolvedValue({ count: claimed }),
    },
    membership: {
      findUnique: vi.fn().mockResolvedValue(null),
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

const waiting = {
  id: 'o1',
  userId: 'u1',
  months: 1,
  amount: 39000,
  code: 'PPABCDEFGH',
  status: 'PENDING',
  paymentRef: null,
};

describe('MembershipOrdersService: money from the bank', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    Object.assign(process.env, {
      MEMBERSHIP_PRICE_MONTH: '39000',
      MEMBERSHIP_PRICE_YEAR: '400000',
      VIETQR_BANK_BIN: '970443',
      VIETQR_ACCOUNT_NO: '0123456789',
      VIETQR_ACCOUNT_NAME: 'NGUYEN VAN A',
    });
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("pays the order, records the transaction and tells the reader's page", async () => {
    const { service, prisma, events } = orderService(waiting);
    expect(await service.handleCassoTransaction(transaction)).toBe('confirmed');
    expect(
      prisma.membershipOrder.updateMany.mock.calls[0][0].data,
    ).toMatchObject({
      status: 'PAID',
      paymentRef: '9001',
      receivedAmount: 39000,
    });
    expect(prisma.membership.upsert).toHaveBeenCalled();
    expect(events.notify).toHaveBeenCalledWith('u1');
  });

  it('accepts more than the price, not less', async () => {
    const over = orderService(waiting);
    expect(
      await over.service.handleCassoTransaction({
        ...transaction,
        amount: 50000,
      }),
    ).toBe('confirmed');
    const under = orderService(waiting);
    expect(
      await under.service.handleCassoTransaction({
        ...transaction,
        amount: 38999,
      }),
    ).toBe('underpaid');
    expect(under.prisma.membership.upsert).not.toHaveBeenCalled();
    expect(under.events.notify).not.toHaveBeenCalled();
  });

  it('leaves a transfer without a code, or for an unknown code, alone', async () => {
    const { service, prisma } = orderService(null);
    expect(
      await service.handleCassoTransaction({
        ...transaction,
        description: 'hoc phi',
      }),
    ).toBe('no_code');
    expect(await service.handleCassoTransaction(transaction)).toBe('no_order');
    expect(prisma.membership.upsert).not.toHaveBeenCalled();
  });

  it('answers a repeated call for the same transaction with duplicate, and adds no time', async () => {
    const { service, prisma, events } = orderService({
      ...waiting,
      status: 'PAID',
      paymentRef: '9001',
    });
    expect(await service.handleCassoTransaction(transaction)).toBe('duplicate');
    expect(prisma.membership.upsert).not.toHaveBeenCalled();
    expect(events.notify).not.toHaveBeenCalled();
  });

  it('does not let a second transaction pay an order that is already paid', async () => {
    const { service, prisma } = orderService({
      ...waiting,
      status: 'PAID',
      paymentRef: '1111',
    });
    expect(await service.handleCassoTransaction(transaction)).toBe(
      'not_pending',
    );
    expect(prisma.membership.upsert).not.toHaveBeenCalled();
  });

  it('does not use one transaction for two orders', async () => {
    const { service, prisma } = orderService(waiting);
    prisma.$transaction.mockRejectedValueOnce(
      Object.assign(new Error('unique'), { code: 'P2002' }),
    );
    expect(await service.handleCassoTransaction(transaction)).toBe('duplicate');
  });

  it('ignores money that went to another account', async () => {
    const { service, prisma } = orderService(waiting);
    expect(
      await service.handleCassoTransaction({
        ...transaction,
        accountNumber: '999',
      }),
    ).toBe('wrong_account');
    expect(prisma.membership.upsert).not.toHaveBeenCalled();
  });

  it('calls a malformed transaction invalid', async () => {
    const { service } = orderService(waiting);
    expect(await service.handleCassoTransaction(null)).toBe('invalid');
    expect(await service.handleCassoTransaction({ id: 1 })).toBe('invalid');
    expect(
      await service.handleCassoTransaction({ ...transaction, amount: 'lots' }),
    ).toBe('invalid');
  });
});

describe('MembershipController: casso webhook', () => {
  const saved = process.env.CASSO_CHECKSUM_KEY;
  afterEach(() => {
    process.env.CASSO_CHECKSUM_KEY = saved;
  });

  function controller() {
    const orders = {
      handleCassoTransaction: vi.fn().mockResolvedValue('confirmed'),
    };
    return {
      orders,
      controller: new MembershipController(
        {} as never,
        orders as never,
        {} as never,
      ),
    };
  }

  it('says it is not set up while there is no key', async () => {
    delete process.env.CASSO_CHECKSUM_KEY;
    await expect(
      controller().controller.cassoWebhook(sign(transaction), body),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('turns away a call with a bad signature, and does nothing', async () => {
    process.env.CASSO_CHECKSUM_KEY = KEY;
    const { controller: c, orders } = controller();
    await expect(
      c.cassoWebhook(sign(transaction, 'wrong'), body),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(orders.handleCassoTransaction).not.toHaveBeenCalled();
  });

  it('handles a signed call and answers success', async () => {
    process.env.CASSO_CHECKSUM_KEY = KEY;
    const { controller: c, orders } = controller();
    expect(await c.cassoWebhook(sign(transaction), body)).toEqual({
      success: true,
      results: ['confirmed'],
    });
    expect(orders.handleCassoTransaction).toHaveBeenCalledWith(transaction);
  });

  it('answers success even when the transaction matched nothing', async () => {
    process.env.CASSO_CHECKSUM_KEY = KEY;
    const { controller: c, orders } = controller();
    orders.handleCassoTransaction.mockResolvedValue('no_code');
    expect((await c.cassoWebhook(sign(transaction), body)).success).toBe(true);
  });
});

describe('MembershipEventsService', () => {
  it('tells only the user whose membership changed', () => {
    vi.useFakeTimers();
    const events = new MembershipEventsService();
    const mine: unknown[] = [];
    const others: unknown[] = [];
    const a = events.streamFor('u1').subscribe((e) => mine.push(e));
    const b = events.streamFor('u2').subscribe((e) => others.push(e));
    events.notify('u1');
    expect(mine).toEqual([{ type: 'membership', data: { changed: true } }]);
    expect(others).toEqual([]);
    a.unsubscribe();
    b.unsubscribe();
    vi.useRealTimers();
  });

  it('sends a ping now and then to keep the connection open', () => {
    vi.useFakeTimers();
    const events = new MembershipEventsService();
    const seen: { type?: string }[] = [];
    const sub = events.streamFor('u1').subscribe((e) => seen.push(e));
    vi.advanceTimersByTime(26_000);
    expect(seen.map((e) => e.type)).toEqual(['ping']);
    sub.unsubscribe();
    vi.useRealTimers();
  });
});
