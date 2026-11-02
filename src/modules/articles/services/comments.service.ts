import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import type { Viewer } from './articles.service.js';

export interface CommentNode {
  id: string;
  parentId: string | null;
  body: string;
  isDeleted: boolean;
  createdAt: Date;
  author: { id: string; displayName: string | null } | null;
  replies: CommentNode[];
}

export const DELETED_BODY = '[Đã xoá]';

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  private async requireReadable(articleId: string, viewer?: Viewer) {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      select: { id: true, status: true, visibility: true, authorId: true },
    });
    if (!article || article.status !== 'PUBLISHED') {
      throw new NotFoundException('Không tìm thấy bài viết này.');
    }
    if (article.visibility === 'MEMBERS_ONLY' && !viewer) {
      throw new UnauthorizedException('Đăng nhập để xem bình luận.');
    }
    return article;
  }

  /** All comments of an article as a tree. A deleted one keeps its place so replies do not float away. */
  async tree(articleId: string, viewer?: Viewer): Promise<CommentNode[]> {
    await this.requireReadable(articleId, viewer);
    const rows = await this.prisma.comment.findMany({
      where: { articleId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, displayName: true } } },
    });
    const nodes = new Map<string, CommentNode>(
      rows.map((row) => [
        row.id,
        {
          id: row.id,
          parentId: row.parentId,
          body: row.isDeleted ? DELETED_BODY : row.body,
          isDeleted: row.isDeleted,
          createdAt: row.createdAt,
          author: row.isDeleted ? null : row.user,
          replies: [],
        },
      ]),
    );
    const roots: CommentNode[] = [];
    for (const node of nodes.values()) {
      const parent = node.parentId ? nodes.get(node.parentId) : undefined;
      (parent ? parent.replies : roots).push(node);
    }
    return roots;
  }

  async create(
    viewer: Viewer,
    articleId: string,
    input: { body: string; parentId?: string },
  ) {
    await this.requireReadable(articleId, viewer);
    if (input.parentId) {
      const parent = await this.prisma.comment.findFirst({
        where: { id: input.parentId, articleId },
        select: { id: true },
      });
      if (!parent) {
        throw new BadRequestException('Bình luận được trả lời không tồn tại.');
      }
    }
    return this.prisma.comment.create({
      data: {
        articleId,
        userId: viewer.sub,
        parentId: input.parentId ?? null,
        body: input.body,
      },
      select: { id: true, parentId: true, body: true, createdAt: true },
    });
  }

  /** Soft delete: the author, or an admin. */
  async remove(viewer: Viewer, commentId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment) throw new NotFoundException('Không tìm thấy bình luận này.');
    if (comment.userId !== viewer.sub && viewer.role !== 'ADMIN') {
      throw new ForbiddenException('Bạn không thể xoá bình luận này.');
    }
    await this.prisma.comment.update({
      where: { id: commentId },
      data: { isDeleted: true, body: '' },
    });
    return { deleted: true };
  }
}
