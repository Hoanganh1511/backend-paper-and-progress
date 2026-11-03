import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Certificate } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service.js';
import { progressOfSections } from '../study-lists/study-lists.service.js';
import type {
  CreateCertificateDto,
  ListCertificatesQuery,
  ResourceDto,
  UpdateCertificateDto,
} from './certificates.schema.js';

const MAX_CERTIFICATES = 200;
const MAX_RESOURCES = 100;

const dateKey = (date: Date | null) =>
  date ? date.toISOString().slice(0, 10) : null;
// undefined = unchanged, ""/null = cleared
const toDate = (value: string | null | undefined) =>
  value === undefined
    ? undefined
    : value
      ? new Date(`${value}T00:00:00.000Z`)
      : null;
const toText = (value: string | null | undefined) =>
  value === undefined ? undefined : value || null;

type LinkedList = {
  id: string;
  title: string;
  sections: { steps: { isDone: boolean }[] }[];
} | null;

/** The certificate as the dashboard lists it; progress follows the linked study list. */
function summary(certificate: Certificate, studyList: LinkedList) {
  const list = studyList
    ? {
        id: studyList.id,
        title: studyList.title,
        ...progressOfSections(studyList.sections),
      }
    : null;
  return {
    id: certificate.id,
    name: certificate.name,
    issuer: certificate.issuer,
    status: certificate.status,
    imageUrl: certificate.imageUrl,
    credentialId: certificate.credentialId,
    score: certificate.score,
    issuedAt: dateKey(certificate.issuedAt),
    expiresAt: dateKey(certificate.expiresAt),
    startDate: dateKey(certificate.startDate),
    targetDate: dateKey(certificate.targetDate),
    progress: list && list.stepCount > 0 ? list.progress : certificate.progress,
    studyList: list,
  };
}

/** What each status needs before it can be saved, and the order of dates. */
function assertValid(certificate: {
  status: string;
  issuedAt: string | null;
  expiresAt: string | null;
  startDate: string | null;
  targetDate: string | null;
}) {
  if (certificate.status === 'ACHIEVED' && !certificate.issuedAt) {
    throw new BadRequestException('Chứng chỉ đã đạt cần có ngày đạt.');
  }
  if (certificate.status === 'STUDYING' && !certificate.startDate) {
    throw new BadRequestException('Chứng chỉ đang học cần có ngày bắt đầu.');
  }
  if (certificate.status === 'PLANNED' && !certificate.startDate) {
    throw new BadRequestException('Kế hoạch cần có ngày dự kiến bắt đầu.');
  }
  if (
    certificate.issuedAt &&
    certificate.expiresAt &&
    certificate.expiresAt < certificate.issuedAt
  ) {
    throw new BadRequestException('Ngày hết hạn phải sau ngày đạt.');
  }
  if (
    certificate.startDate &&
    certificate.targetDate &&
    certificate.targetDate < certificate.startDate
  ) {
    throw new BadRequestException(
      'Ngày dự kiến hoàn thành phải sau ngày bắt đầu.',
    );
  }
}

const withList = {
  studyList: {
    select: {
      id: true,
      title: true,
      sections: { select: { steps: { select: { isDone: true } } } },
    },
  },
} as const;

// Every query carries userId: nobody reads or changes another user's certificates.
@Injectable()
export class CertificatesService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string, { q, status }: ListCertificatesQuery) {
    const rows = await this.prisma.certificate.findMany({
      where: {
        userId,
        ...(status && { status }),
        ...(q && {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { issuer: { contains: q, mode: 'insensitive' } },
          ],
        }),
      },
      include: withList,
      orderBy: [{ createdAt: 'desc' }],
      take: MAX_CERTIFICATES,
    });
    return rows.map(({ studyList, ...certificate }) =>
      summary(certificate, studyList),
    );
  }

  async get(userId: string, id: string) {
    const certificate = await this.prisma.certificate.findFirst({
      where: { id, userId },
      include: {
        ...withList,
        resources: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!certificate) throw new NotFoundException('Không tìm thấy chứng chỉ.');
    const { studyList, resources, ...rest } = certificate;
    return {
      ...summary(rest, studyList),
      verifyUrl: rest.verifyUrl,
      notes: rest.notes,
      createdAt: rest.createdAt.toISOString(),
      resources: resources.map(({ id: resourceId, title, url }) => ({
        id: resourceId,
        title,
        url,
      })),
    };
  }

  async create(userId: string, dto: CreateCertificateDto) {
    assertValid({
      status: dto.status,
      issuedAt: dto.issuedAt || null,
      expiresAt: dto.expiresAt || null,
      startDate: dto.startDate || null,
      targetDate: dto.targetDate || null,
    });
    const count = await this.prisma.certificate.count({ where: { userId } });
    if (count >= MAX_CERTIFICATES) {
      throw new BadRequestException('Bạn đã có quá nhiều chứng chỉ.');
    }
    const studyListId = await this.checkedStudyList(userId, dto.studyListId);
    const created = await this.prisma.certificate.create({
      data: {
        userId,
        name: dto.name,
        issuer: dto.issuer,
        status: dto.status,
        imageUrl: toText(dto.imageUrl),
        credentialId: toText(dto.credentialId),
        verifyUrl: toText(dto.verifyUrl),
        score: toText(dto.score),
        issuedAt: toDate(dto.issuedAt),
        expiresAt: toDate(dto.expiresAt),
        startDate: toDate(dto.startDate),
        targetDate: toDate(dto.targetDate),
        progress: dto.progress ?? 0,
        notes: toText(dto.notes),
        studyListId: studyListId ?? null,
      },
    });
    return this.get(userId, created.id);
  }

  async update(userId: string, id: string, dto: UpdateCertificateDto) {
    const existing = await this.findOwned(userId, id);
    assertValid({
      status: dto.status ?? existing.status,
      issuedAt:
        dto.issuedAt === undefined
          ? dateKey(existing.issuedAt)
          : dto.issuedAt || null,
      expiresAt:
        dto.expiresAt === undefined
          ? dateKey(existing.expiresAt)
          : dto.expiresAt || null,
      startDate:
        dto.startDate === undefined
          ? dateKey(existing.startDate)
          : dto.startDate || null,
      targetDate:
        dto.targetDate === undefined
          ? dateKey(existing.targetDate)
          : dto.targetDate || null,
    });
    const studyListId = await this.checkedStudyList(userId, dto.studyListId);
    await this.prisma.certificate.update({
      where: { id },
      data: {
        name: dto.name,
        issuer: dto.issuer,
        status: dto.status,
        imageUrl: toText(dto.imageUrl),
        credentialId: toText(dto.credentialId),
        verifyUrl: toText(dto.verifyUrl),
        score: toText(dto.score),
        issuedAt: toDate(dto.issuedAt),
        expiresAt: toDate(dto.expiresAt),
        startDate: toDate(dto.startDate),
        targetDate: toDate(dto.targetDate),
        progress: dto.progress,
        notes: toText(dto.notes),
        studyListId,
      },
    });
    return this.get(userId, id);
  }

  async remove(userId: string, id: string) {
    await this.findOwned(userId, id);
    await this.prisma.certificate.delete({ where: { id } });
    return { deleted: true as const };
  }

  /* ------------------------------------------------------------------------ */
  /* Resources                                                                */
  /* ------------------------------------------------------------------------ */

  async addResource(userId: string, certificateId: string, dto: ResourceDto) {
    await this.findOwned(userId, certificateId);
    const count = await this.prisma.certificateResource.count({
      where: { certificateId },
    });
    if (count >= MAX_RESOURCES) {
      throw new BadRequestException('Đã có quá nhiều tài liệu.');
    }
    await this.prisma.certificateResource.create({
      data: { certificateId, title: dto.title, url: dto.url },
    });
    return this.get(userId, certificateId);
  }

  async removeResource(userId: string, resourceId: string) {
    const resource = await this.prisma.certificateResource.findFirst({
      where: { id: resourceId, certificate: { userId } },
    });
    if (!resource) throw new NotFoundException('Không tìm thấy tài liệu.');
    await this.prisma.certificateResource.delete({ where: { id: resourceId } });
    return this.get(userId, resource.certificateId);
  }

  /* ------------------------------------------------------------------------ */

  /**
   * The study list to link: undefined leaves it as it is, "" or null unlinks,
   * and an id must be one of the user's own lists.
   */
  private async checkedStudyList(
    userId: string,
    studyListId: string | null | undefined,
  ): Promise<string | null | undefined> {
    if (studyListId === undefined) return undefined;
    if (!studyListId) return null;
    const list = await this.prisma.studyList.findFirst({
      where: { id: studyListId, userId },
      select: { id: true },
    });
    if (!list) throw new BadRequestException('Danh sách học không hợp lệ.');
    return list.id;
  }

  private async findOwned(userId: string, id: string) {
    const certificate = await this.prisma.certificate.findFirst({
      where: { id, userId },
    });
    if (!certificate) throw new NotFoundException('Không tìm thấy chứng chỉ.');
    return certificate;
  }
}
