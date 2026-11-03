import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CertificatesService } from './certificates.service.js';
import {
  createCertificateSchema,
  resourceSchema,
} from './certificates.schema.js';

const row = {
  id: 'c1',
  userId: 'u1',
  name: 'AWS SAA',
  issuer: 'Amazon',
  status: 'STUDYING' as const,
  imageUrl: null,
  credentialId: null,
  verifyUrl: null,
  score: null,
  issuedAt: null,
  expiresAt: null,
  startDate: new Date('2026-10-01T00:00:00.000Z'),
  targetDate: null,
  progress: 40,
  notes: null,
  studyListId: null as string | null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

type LinkedList = {
  id: string;
  title: string;
  sections: { steps: { isDone: boolean }[] }[];
};

function setup(
  options: {
    certificate?: typeof row | null;
    studyList?: LinkedList | null;
    ownsList?: boolean;
  } = {},
) {
  const certificate =
    options.certificate === undefined ? row : options.certificate;
  const studyList = options.studyList ?? null;
  const prisma = {
    certificate: {
      findMany: vi
        .fn()
        .mockResolvedValue(certificate ? [{ ...certificate, studyList }] : []),
      findFirst: vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            certificate ? { ...certificate, studyList, resources: [] } : null,
          ),
        ),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: 'c1' }),
      update: vi.fn(),
      delete: vi.fn(),
    },
    studyList: {
      findFirst: vi
        .fn()
        .mockResolvedValue(options.ownsList === false ? null : { id: 'l1' }),
    },
    certificateResource: {
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
    },
  };
  return { service: new CertificatesService(prisma as never), prisma };
}

describe('CertificatesService', () => {
  it("lists only the user's certificates", async () => {
    const { service, prisma } = setup();
    const [item] = await service.list('u1', { q: 'aws' });
    expect(prisma.certificate.findMany.mock.calls[0][0].where).toMatchObject({
      userId: 'u1',
    });
    expect(item).toMatchObject({ progress: 40, studyList: null });
  });

  it('takes its progress from the linked study list once that has steps', async () => {
    const { service } = setup({
      studyList: {
        id: 'l1',
        title: 'AWS plan',
        sections: [{ steps: [{ isDone: true }, { isDone: false }] }],
      },
    });
    const [item] = await service.list('u1', {});
    expect(item.progress).toBe(50);
    expect(item.studyList).toMatchObject({
      id: 'l1',
      title: 'AWS plan',
      stepCount: 2,
      doneStepCount: 1,
    });
  });

  it('keeps the typed progress while the linked list has no steps', async () => {
    const { service } = setup({
      studyList: { id: 'l1', title: 'Empty', sections: [] },
    });
    expect((await service.list('u1', {}))[0].progress).toBe(40);
  });

  it('asks each status for its own date', async () => {
    const { service } = setup();
    const base = { name: 'X', issuer: 'Y' };
    await expect(
      service.create('u1', { ...base, status: 'ACHIEVED' }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.create('u1', { ...base, status: 'STUDYING' }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.create('u1', { ...base, status: 'PLANNED' }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.create('u1', {
        ...base,
        status: 'ACHIEVED',
        issuedAt: '2026-09-15',
        expiresAt: '2026-01-01',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates a certificate for the user', async () => {
    const { service, prisma } = setup();
    await service.create('u1', {
      name: 'AWS',
      issuer: 'Amazon',
      status: 'ACHIEVED',
      issuedAt: '2026-09-15',
      imageUrl: '',
    });
    const data = prisma.certificate.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ userId: 'u1', status: 'ACHIEVED' });
    expect(data.issuedAt).toEqual(new Date('2026-09-15T00:00:00.000Z'));
    expect(data.imageUrl).toBeNull();
    expect(data.studyListId).toBeNull();
  });

  it("links only a study list the user owns, and '' unlinks it", async () => {
    const owned = setup();
    await owned.service.update('u1', 'c1', { studyListId: 'l1' });
    expect(owned.prisma.studyList.findFirst.mock.calls[0][0].where).toEqual({
      id: 'l1',
      userId: 'u1',
    });
    expect(owned.prisma.certificate.update.mock.calls[0][0].data).toMatchObject(
      { studyListId: 'l1' },
    );

    const unlink = setup();
    await unlink.service.update('u1', 'c1', { studyListId: '' });
    expect(
      unlink.prisma.certificate.update.mock.calls[0][0].data,
    ).toMatchObject({ studyListId: null });

    const untouched = setup();
    await untouched.service.update('u1', 'c1', { name: 'New' });
    expect(
      untouched.prisma.certificate.update.mock.calls[0][0].data.studyListId,
    ).toBeUndefined();

    const someoneElses = setup({ ownsList: false });
    await expect(
      someoneElses.service.update('u1', 'c1', { studyListId: 'x' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('checks the merged dates when the status changes', async () => {
    const { service } = setup({
      certificate: { ...row, startDate: null as never },
    });
    await expect(
      service.update('u1', 'c1', { status: 'PLANNED' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('404s for a certificate or resource of someone else', async () => {
    const { service } = setup({ certificate: null });
    await expect(service.get('u1', 'x')).rejects.toThrow(NotFoundException);
    await expect(service.remove('u1', 'x')).rejects.toThrow(NotFoundException);
    await expect(
      service.addResource('u1', 'x', { title: 'A', url: 'https://a.test' }),
    ).rejects.toThrow(NotFoundException);
    await expect(service.removeResource('u1', 'x')).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('certificate schemas', () => {
  it('accepts http links and empty strings, refuses other schemes', () => {
    const base = { name: 'A', issuer: 'B', status: 'PLANNED' as const };
    expect(
      createCertificateSchema.safeParse({ ...base, imageUrl: '' }).success,
    ).toBe(true);
    expect(
      createCertificateSchema.safeParse({
        ...base,
        imageUrl: 'https://x.test/a.png',
      }).success,
    ).toBe(true);
    expect(
      createCertificateSchema.safeParse({
        ...base,
        imageUrl: 'javascript:alert(1)',
      }).success,
    ).toBe(false);
    expect(
      resourceSchema.safeParse({ title: 'Docs', url: 'ftp://x.test' }).success,
    ).toBe(false);
  });
});
