import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import slugify from 'slugify';
import { PrismaService } from '../../../shared/database/prisma.service.js';

const toSlug = (text: string) =>
  slugify(text, { lower: true, locale: 'vi', strict: true }) || 'muc';

/** Tags and series: small lookup tables with the same create, rename, delete shape. */
@Injectable()
export class TaxonomyService {
  constructor(private prisma: PrismaService) {}

  /* Tags */

  listTags() {
    return this.prisma.tag
      .findMany({
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: {
              articles: { where: { article: { status: 'PUBLISHED' } } },
            },
          },
        },
      })
      .then((rows) =>
        rows.map(({ _count, ...tag }) => ({
          ...tag,
          articleCount: _count.articles,
        })),
      );
  }

  async createTag(name: string) {
    const slug = toSlug(name);
    const existing = await this.prisma.tag.findFirst({
      where: { OR: [{ slug }, { name }] },
    });
    if (existing) throw new ConflictException('Tag này đã có.');
    return this.prisma.tag.create({ data: { name, slug } });
  }

  async renameTag(id: string, name: string) {
    await this.requireTag(id);
    const slug = toSlug(name);
    const clash = await this.prisma.tag.findFirst({
      where: { id: { not: id }, OR: [{ slug }, { name }] },
    });
    if (clash) throw new ConflictException('Tag này đã có.');
    return this.prisma.tag.update({ where: { id }, data: { name, slug } });
  }

  async deleteTag(id: string) {
    await this.requireTag(id);
    await this.prisma.tag.delete({ where: { id } });
    return { deleted: true };
  }

  private async requireTag(id: string) {
    const tag = await this.prisma.tag.findUnique({ where: { id } });
    if (!tag) throw new NotFoundException('Không tìm thấy tag này.');
  }

  /* Series */

  listSeries() {
    return this.prisma.series
      .findMany({
        orderBy: { title: 'asc' },
        include: {
          _count: { select: { articles: { where: { status: 'PUBLISHED' } } } },
        },
      })
      .then((rows) =>
        rows.map(({ _count, ...series }) => ({
          ...series,
          articleCount: _count.articles,
        })),
      );
  }

  async createSeries(input: { title: string; description?: string | null }) {
    return this.prisma.series.create({
      data: {
        title: input.title,
        description: input.description || null,
        slug: await this.uniqueSeriesSlug(input.title),
      },
    });
  }

  async updateSeries(
    id: string,
    input: { title: string; description?: string | null },
  ) {
    await this.requireSeries(id);
    return this.prisma.series.update({
      where: { id },
      data: { title: input.title, description: input.description || null },
    });
  }

  async deleteSeries(id: string) {
    await this.requireSeries(id);
    await this.prisma.series.delete({ where: { id } });
    return { deleted: true };
  }

  private async requireSeries(id: string) {
    const series = await this.prisma.series.findUnique({ where: { id } });
    if (!series) throw new NotFoundException('Không tìm thấy series này.');
  }

  private async uniqueSeriesSlug(title: string) {
    const base = toSlug(title);
    const taken = await this.prisma.series.findMany({
      where: { slug: { startsWith: base } },
      select: { slug: true },
    });
    const used = new Set(taken.map((row) => row.slug));
    if (!used.has(base)) return base;
    let n = 2;
    while (used.has(`${base}-${n}`)) n += 1;
    return `${base}-${n}`;
  }
}
