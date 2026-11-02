import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  detectImageType,
  MAX_IMAGE_BYTES,
  UploadService,
} from './upload.service.js';

const png = Buffer.concat([
  Buffer.from('89504e470d0a1a0a', 'hex'),
  Buffer.alloc(20),
]);

function service(env: Record<string, string> = {}) {
  const values: Record<string, string> = {
    APP_URL: 'http://localhost:8000',
    JWT_ACCESS_SECRET: 'test-secret-test-secret',
    ...env,
  };
  return new UploadService({
    get: (key: string) => values[key],
    getOrThrow: (key: string) => values[key],
  } as never);
}

describe('detectImageType', () => {
  it('reads the type from the first bytes', () => {
    expect(detectImageType(png)).toBe('image/png');
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      'image/jpeg',
    );
    expect(detectImageType(Buffer.from('GIF89a......'))).toBe('image/gif');
    expect(detectImageType(Buffer.from('RIFF....WEBPVP8 '))).toBe('image/webp');
    expect(detectImageType(Buffer.from('<?php echo 1; ?>'))).toBeUndefined();
  });
});

describe('UploadService (local mode, no S3 bucket)', () => {
  const link = async (contentType = 'image/png') => {
    const uploads = service();
    const result = await uploads.presign('u1', { contentType });
    const url = new URL(result.uploadUrl);
    return {
      uploads,
      key: url.pathname.split('/').pop() as string,
      expires: Number(url.searchParams.get('expires')),
      signature: url.searchParams.get('signature') as string,
      result,
    };
  };

  it('refuses a content type that is not an image', async () => {
    await expect(
      service().presign('u1', { contentType: 'text/html' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns a signed link and the public URL', async () => {
    const { result, key } = await link();
    expect(result.publicUrl).toBe(
      `http://localhost:8000/uploads/articles/${key}`,
    );
    expect(key).toMatch(/^u1-[\w-]+\.png$/);
  });

  it('rejects a bad signature and an expired link', async () => {
    const { uploads, key, expires, signature } = await link();
    const file = { buffer: png, size: png.length };
    await expect(
      uploads.saveLocal(key, expires, 'f'.repeat(signature.length), file),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      uploads.saveLocal(key, Date.now() - 1000, signature, file),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects a file whose bytes are not the promised image, and files over 5MB', async () => {
    const { uploads, key, expires, signature } = await link();
    const fake = Buffer.from('<script>alert(1)</script>');
    await expect(
      uploads.saveLocal(key, expires, signature, {
        buffer: fake,
        size: fake.length,
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      uploads.saveLocal(key, expires, signature, {
        buffer: png,
        size: MAX_IMAGE_BYTES + 1,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
