import { z } from 'zod';

const text = (max: number) => z.string().trim().max(max);
const required = (max: number) => z.string().trim().min(1).max(max);
// "" or null clears an optional field.
const optionalText = (max: number) => text(max).nullish();
const optionalUrl = z
  .union([
    z
      .string()
      .trim()
      .max(2000)
      .url()
      .refine(
        (value) => /^https?:\/\//i.test(value),
        'Link phải bắt đầu bằng http',
      ),
    z.literal(''),
  ])
  .nullish();

export const createStudyListSchema = z.object({
  title: required(200),
  description: optionalText(1000),
});
export const updateStudyListSchema = createStudyListSchema.partial();

export const sectionSchema = z.object({
  title: required(200),
  description: optionalText(1000),
});
export const updateSectionSchema = sectionSchema.partial();

const stepFields = {
  title: required(300),
  note: optionalText(2000),
  url: optionalUrl,
  isDone: z.boolean(),
};
// A step is an article of the site ("articleId": the title is then the article's),
// or something the learner writes down by hand ("title").
const articleId = z.string().min(1).max(64).nullish();
export const createStepSchema = z
  .object({
    title: stepFields.title.optional(),
    note: stepFields.note,
    url: stepFields.url,
    articleId,
  })
  .refine((step) => !!step.title || !!step.articleId, {
    message: 'Chọn một bài viết hoặc nhập tên bước.',
  });
export const updateStepSchema = z
  .object({ ...stepFields, articleId })
  .partial();

export const searchArticlesSchema = z.object({
  q: z.string().trim().max(100).optional(),
});

export const reorderSchema = z.object({
  ids: z.array(z.string().min(1)).max(200),
});

export type CreateStudyListDto = z.infer<typeof createStudyListSchema>;
export type UpdateStudyListDto = z.infer<typeof updateStudyListSchema>;
export type SectionDto = z.infer<typeof sectionSchema>;
export type UpdateSectionDto = z.infer<typeof updateSectionSchema>;
export type CreateStepDto = z.infer<typeof createStepSchema>;
export type UpdateStepDto = z.infer<typeof updateStepSchema>;
export type SearchArticlesQuery = z.infer<typeof searchArticlesSchema>;
