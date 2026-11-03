import { z } from 'zod';

export const CERTIFICATE_STATUSES = [
  'ACHIEVED',
  'STUDYING',
  'PLANNED',
] as const;

const text = (max: number) => z.string().trim().max(max);
const required = (max: number) => z.string().trim().min(1).max(max);
/** "2026-11-05" */
const date = z.string().date();
const url = z
  .string()
  .trim()
  .max(2000)
  .url()
  .refine(
    (value) => /^https?:\/\//i.test(value),
    'Link phải bắt đầu bằng http',
  );
// "" or null clears an optional field.
const optionalText = (max: number) => text(max).nullish();
const optionalDate = z.union([date, z.literal('')]).nullish();
const optionalUrl = z.union([url, z.literal('')]).nullish();

const fields = {
  name: required(200),
  issuer: required(200),
  status: z.enum(CERTIFICATE_STATUSES),
  imageUrl: optionalUrl,
  credentialId: optionalText(100),
  verifyUrl: optionalUrl,
  score: optionalText(50),
  issuedAt: optionalDate,
  expiresAt: optionalDate,
  startDate: optionalDate,
  targetDate: optionalDate,
  progress: z.number().int().min(0).max(100).optional(),
  notes: optionalText(5000),
  /** The study list linked to this certificate; "" or null unlinks. */
  studyListId: z.string().max(64).nullish(),
};

export const createCertificateSchema = z.object(fields);
export const updateCertificateSchema = z.object(fields).partial();

export const listCertificatesQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  status: z.enum(CERTIFICATE_STATUSES).optional(),
});

export const resourceSchema = z.object({
  title: required(200),
  url,
});

export type CreateCertificateDto = z.infer<typeof createCertificateSchema>;
export type UpdateCertificateDto = z.infer<typeof updateCertificateSchema>;
export type ListCertificatesQuery = z.infer<typeof listCertificatesQuerySchema>;
export type ResourceDto = z.infer<typeof resourceSchema>;
