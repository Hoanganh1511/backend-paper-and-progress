import { z } from 'zod';

const visibility = z.enum(['PUBLIC', 'PREVIEW', 'MEMBERS_ONLY']);

/** What kind of piece it is (Tutorial, Experience...). Not the Knowledge category: that is the topic. */
export const ARTICLE_TYPES = [
  'TUTORIAL',
  'LEARNING_NOTES',
  'EXPERIENCE',
  'OPINION',
  'CASE_STUDY',
  'REVIEW',
] as const;
const articleType = z.enum(ARTICLE_TYPES);

const fields = {
  title: z.string().trim().min(1, 'Hãy nhập tiêu đề').max(200),
  /** Empty or missing: generated from the title. */
  slug: z.string().trim().max(200).optional(),
  excerpt: z.string().trim().max(400).nullish(),
  coverImageUrl: z.string().url().max(1000).nullish(),
  /** TipTap JSON, kept as the source of truth. */
  contentJson: z.record(z.string(), z.unknown()),
  /** `editor.getHTML()`; sanitized again here before it is stored. */
  contentHtml: z.string().max(1_000_000),
  visibility: visibility.optional(),
  articleType: articleType.optional(),
  /** Slugs of Knowledge topics to link to; the writer picks existing ones, never creates new. */
  topics: z.array(z.string().trim().min(1).max(100)).max(8).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  seriesId: z.string().uuid().nullish(),
  seriesOrder: z.number().int().min(1).max(999).nullish(),
};

export const createArticleSchema = z.object(fields);

export const updateArticleSchema = z.object(fields).partial().extend({
  /** Auto-save sends this so a quick burst of saves does not fill the history. */
  isAutosave: z.boolean().optional(),
  /** The `version` the editor loaded or last saved; a different one stored means a conflict (409). */
  baseVersion: z.string().max(64).optional(),
  /** Save even if the article changed elsewhere: the writer chose their copy. */
  force: z.boolean().optional(),
});

export const publishArticleSchema = z.object({
  scheduledAt: z.coerce.date().optional(),
});

export const listArticlesSchema = z.object({
  tag: z.string().trim().max(60).optional(),
  series: z.string().trim().max(200).optional(),
  topic: z.string().trim().max(100).optional(),
  type: articleType.optional(),
  q: z.string().trim().max(100).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export const tagSchema = z.object({ name: z.string().trim().min(1).max(40) });

export const seriesSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullish(),
});

export const commentSchema = z.object({
  body: z.string().trim().min(1, 'Hãy nhập bình luận').max(2000),
  parentId: z.string().uuid().optional(),
});

export const viewSchema = z.object({
  maxScrollPercent: z.union([
    z.literal(0),
    z.literal(25),
    z.literal(50),
    z.literal(75),
    z.literal(100),
  ]),
});

export const presignSchema = z.object({
  filename: z.string().trim().min(1).max(200),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
});

export type CreateArticleInput = z.infer<typeof createArticleSchema>;
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;
export type ListArticlesInput = z.infer<typeof listArticlesSchema>;
