import { randomInt } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type {
  MembershipOrder,
  MembershipOrderStatus,
  MembershipPlan,
} from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service.js';
import { MembershipEventsService } from './membership-events.service.js';

const PLANS: Record<MembershipPlan, { label: string; months: number }> = {
  MONTH: { label: '1 tháng', months: 1 },
  YEAR: { label: '1 năm', months: 12 },
};

/** Letters and digits that cannot be misread in a bank transfer note. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_OPEN_ORDERS = 5;
const CODE_PATTERN = /PP[A-HJ-NP-Z2-9]{8}/;

/** A bank transfer reported by Casso. */
export interface Transfer {
  /** Casso's id of the transaction; one transaction pays one order, once. */
  ref: string;
  amount: number;
  description: string;
}

export type CassoResult = TransferResult | 'invalid' | 'wrong_account';

export type TransferResult =
  | 'confirmed'
  | 'duplicate'
  | 'no_code'
  | 'no_order'
  | 'not_pending'
  | 'underpaid';

/** The order code a reader typed in the transfer note, wherever the bank put it in the text. */
export function findOrderCode(description: string): string | null {
  return CODE_PATTERN.exec(description.toUpperCase())?.[0] ?? null;
}

export interface PaymentConfig {
  prices: Record<MembershipPlan, number>;
  bankBin: string;
  accountNo: string;
  accountName: string;
}

/** Reads the payment settings; `null` while any of them is missing, which keeps sign-up closed. */
export function readPaymentConfig(
  env: NodeJS.ProcessEnv = process.env,
): PaymentConfig | null {
  const month = Number(env.MEMBERSHIP_PRICE_MONTH);
  const year = Number(env.MEMBERSHIP_PRICE_YEAR);
  const bankBin = env.VIETQR_BANK_BIN?.trim();
  const accountNo = env.VIETQR_ACCOUNT_NO?.trim();
  const accountName = env.VIETQR_ACCOUNT_NAME?.trim();
  const isPrice = (n: number) => Number.isInteger(n) && n > 0;
  if (!isPrice(month) || !isPrice(year)) return null;
  if (!bankBin || !accountNo || !accountName) return null;
  return {
    prices: { MONTH: month, YEAR: year },
    bankBin,
    accountNo,
    accountName,
  };
}

/** The end date after adding whole months, counted from `from`. */
export function addMonths(from: Date, months: number): Date {
  const date = new Date(from);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date;
}

/**
 * Paying for membership by bank transfer. The reader opens an order and gets a
 * QR code with the amount and a unique note; the owner sees the money arrive in
 * the bank app and confirms the order, which is what grants the membership.
 * Nothing here is granted on the reader's word.
 */
@Injectable()
export class MembershipOrdersService {
  private logger = new Logger(MembershipOrdersService.name);

  constructor(
    private prisma: PrismaService,
    private events: MembershipEventsService,
  ) {}

  /** Read on every call so the owner can change prices and bank in `.env` without touching code. */
  private config() {
    return readPaymentConfig();
  }

  plans() {
    const config = this.config();
    return {
      isOpen: config !== null,
      plans: config
        ? (Object.keys(PLANS) as MembershipPlan[]).map((plan) => ({
            plan,
            label: PLANS[plan].label,
            months: PLANS[plan].months,
            amount: config.prices[plan],
          }))
        : [],
    };
  }

  /** Opens an order; asking again for the same plan returns the order still waiting. */
  async create(userId: string, plan: MembershipPlan) {
    const config = this.config();
    if (!config) {
      throw new ServiceUnavailableException(
        'Đăng ký hội viên chưa mở. Bạn quay lại sau nhé.',
      );
    }
    const waiting = await this.prisma.membershipOrder.findMany({
      where: { userId, status: 'PENDING' },
    });
    const same = waiting.find((order) => order.plan === plan);
    if (same) return this.view(same, config);
    if (waiting.length >= MAX_OPEN_ORDERS) {
      throw new BadRequestException(
        'Bạn có quá nhiều đơn đang chờ. Hãy huỷ bớt đơn không dùng.',
      );
    }
    const order = await this.prisma.membershipOrder.create({
      data: {
        userId,
        plan,
        months: PLANS[plan].months,
        amount: config.prices[plan],
        code: this.newCode(),
      },
    });
    return this.view(order, config);
  }

  async listMine(userId: string) {
    const config = this.config();
    const orders = await this.prisma.membershipOrder.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return orders.map((order) => this.view(order, config));
  }

  async cancelMine(userId: string, id: string) {
    const { count } = await this.prisma.membershipOrder.updateMany({
      where: { id, userId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
    if (count === 0) {
      throw new NotFoundException('Không có đơn đang chờ này.');
    }
    return { ok: true };
  }

  async listForAdmin(status: MembershipOrderStatus = 'PENDING') {
    const orders = await this.prisma.membershipOrder.findMany({
      where: { status },
      orderBy: { createdAt: status === 'PENDING' ? 'asc' : 'desc' },
      take: 100,
      include: {
        user: { select: { id: true, email: true, displayName: true } },
      },
    });
    return orders.map((order) => ({
      id: order.id,
      plan: order.plan,
      amount: order.amount,
      code: order.code,
      status: order.status,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      receivedAmount: order.receivedAmount,
      user: order.user,
    }));
  }

  /**
   * The owner has seen the money. Marks the order paid and adds its months on
   * top of what the member has left (or from now, if it ended). Confirming a
   * paid order again changes nothing, so a double click cannot add time twice.
   */
  async confirm(id: string, transfer?: Pick<Transfer, 'ref' | 'amount'>) {
    const result = await this.prisma.$transaction(
      async (
        tx,
      ): Promise<
        | { alreadyPaid: true }
        | { alreadyPaid: false; expiresAt: Date; userId: string }
      > => {
        const claimed = await tx.membershipOrder.updateMany({
          where: { id, status: 'PENDING' },
          data: {
            status: 'PAID',
            paidAt: new Date(),
            ...(transfer && {
              paymentRef: transfer.ref,
              receivedAmount: transfer.amount,
            }),
          },
        });
        const order = await tx.membershipOrder.findUnique({ where: { id } });
        if (!order) throw new NotFoundException('Đơn không tồn tại.');
        if (claimed.count === 0) {
          if (order.status === 'PAID') return { alreadyPaid: true };
          throw new ConflictException('Đơn đã bị huỷ, không thể xác nhận.');
        }
        const current = await tx.membership.findUnique({
          where: { userId: order.userId },
          select: { expiresAt: true },
        });
        const now = new Date();
        const from =
          current && current.expiresAt.getTime() > now.getTime()
            ? current.expiresAt
            : now;
        const expiresAt = addMonths(from, order.months);
        await tx.membership.upsert({
          where: { userId: order.userId },
          create: { userId: order.userId, expiresAt, source: 'PAYMENT' },
          update: { expiresAt, source: 'PAYMENT' },
        });
        return { alreadyPaid: false, expiresAt, userId: order.userId };
      },
    );
    if (result.alreadyPaid) return { ok: true, alreadyPaid: true as const };
    // After the transaction, so a page that asks at once finds the membership.
    this.events.notify(result.userId);
    return {
      ok: true,
      alreadyPaid: false as const,
      expiresAt: result.expiresAt,
    };
  }

  /**
   * One transaction of a Casso webhook (V2: `data` is a single object).
   * Casso also sends a test transaction from "Gọi thử": it has no order code,
   * so it is simply not matched, and the webhook still answers success.
   */
  async handleCassoTransaction(data: unknown): Promise<CassoResult> {
    if (data === null || typeof data !== 'object') return 'invalid';
    const row = data as Record<string, unknown>;
    const ref = row.id === undefined ? '' : String(row.id);
    const amount = Number(row.amount);
    const description = row.description;
    if (!ref || !Number.isFinite(amount) || typeof description !== 'string') {
      return 'invalid';
    }
    // If Casso says which account the money went to, it has to be ours.
    const ours = this.config()?.accountNo;
    if (ours && row.accountNumber && String(row.accountNumber) !== ours) {
      return 'wrong_account';
    }
    const result = await this.confirmByTransfer({
      ref,
      amount,
      description,
    });
    if (result === 'underpaid' || result === 'not_pending') {
      this.logger.warn(
        `Casso ${ref}: ${result} (${amount} đ), left for the owner`,
      );
    }
    return result;
  }

  /**
   * A bank transfer arrived. It pays an order only if its note holds the
   * order's code and it is at least the order's price; anything else is left
   * for the owner to look at. The same transaction cannot pay twice.
   */
  async confirmByTransfer(transfer: Transfer): Promise<TransferResult> {
    const code = findOrderCode(transfer.description);
    if (!code) return 'no_code';
    const order = await this.prisma.membershipOrder.findUnique({
      where: { code },
    });
    if (!order) return 'no_order';
    if (order.status !== 'PENDING') {
      return order.paymentRef === transfer.ref ? 'duplicate' : 'not_pending';
    }
    if (transfer.amount < order.amount) return 'underpaid';
    try {
      const result = await this.confirm(order.id, transfer);
      return result.alreadyPaid ? 'duplicate' : 'confirmed';
    } catch (error) {
      // The transaction id is unique: it was already used for an order.
      if ((error as { code?: string }).code === 'P2002') return 'duplicate';
      throw error;
    }
  }

  async cancel(id: string) {
    const { count } = await this.prisma.membershipOrder.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
    if (count === 0) {
      throw new NotFoundException('Không có đơn đang chờ này.');
    }
    return { ok: true };
  }

  private newCode() {
    let code = 'PP';
    for (let i = 0; i < 8; i += 1) {
      code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    }
    return code;
  }

  /** What the reader needs to pay: the order, the bank details and a ready QR image. */
  private view(order: MembershipOrder, config: PaymentConfig | null) {
    const base = {
      id: order.id,
      plan: order.plan,
      months: order.months,
      amount: order.amount,
      code: order.code,
      status: order.status,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
    };
    if (!config || order.status !== 'PENDING')
      return { ...base, payment: null };
    const query = new URLSearchParams({
      amount: String(order.amount),
      addInfo: order.code,
      accountName: config.accountName,
    });
    return {
      ...base,
      payment: {
        bankBin: config.bankBin,
        accountNo: config.accountNo,
        accountName: config.accountName,
        qrUrl: `https://img.vietqr.io/image/${config.bankBin}-${config.accountNo}-compact2.png?${query}`,
      },
    };
  }
}
