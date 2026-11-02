import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const UPLOAD_DIR = join(process.cwd(), 'uploads');
const LOCAL_FOLDER = 'articles';
const LOCAL_LINK_SECONDS = 300;

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** What the first bytes of a file say it is; the content type the client sends proves nothing. */
export function detectImageType(buffer: Buffer): string | undefined {
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return 'image/jpeg';
  }
  if (buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    return 'image/png';
  }
  const head = buffer.subarray(0, 12).toString('latin1');
  if (head.startsWith('GIF87a') || head.startsWith('GIF89a'))
    return 'image/gif';
  if (head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return undefined;
}

export interface PresignedUpload {
  /** Where to send the file. */
  uploadUrl: string;
  /** Form fields to send before `file`; empty for local uploads. */
  fields: Record<string, string>;
  /** Where the image will be served from once uploaded. */
  publicUrl: string;
}

@Injectable()
export class UploadService {
  constructor(private config: ConfigService) {}

  private get bucket() {
    return this.config.get<string>('AWS_S3_BUCKET');
  }
  private get appUrl() {
    return (this.config.get<string>('APP_URL') ?? '').replace(/\/+$/, '');
  }

  async presign(
    userId: string,
    input: { contentType: string },
  ): Promise<PresignedUpload> {
    const extension = EXTENSIONS[input.contentType];
    if (!extension)
      throw new BadRequestException('Chỉ nhận ảnh jpg, png, webp, gif.');
    const year = new Date().getUTCFullYear();
    const name = `${randomUUID()}.${extension}`;

    if (!this.bucket) {
      // Development: the file goes to this server's disk through a short-lived signed link.
      const expires = Date.now() + LOCAL_LINK_SECONDS * 1000;
      const key = `${userId}-${name}`;
      const signature = this.sign(key, expires);
      return {
        uploadUrl: `${this.appUrl}/api/v1/uploads/local/${key}?expires=${expires}&signature=${signature}`,
        fields: {},
        publicUrl: `${this.appUrl}/uploads/${LOCAL_FOLDER}/${key}`,
      };
    }

    const key = `articles/${userId}/${year}/${name}`;
    const client = new S3Client({
      region: this.config.get<string>('AWS_REGION') ?? 'ap-southeast-1',
    });
    const post = await createPresignedPost(client, {
      Bucket: this.bucket,
      Key: key,
      Fields: { 'Content-Type': input.contentType },
      Conditions: [
        ['content-length-range', 0, MAX_IMAGE_BYTES],
        ['eq', '$Content-Type', input.contentType],
      ],
      Expires: 300,
    });
    const cdn = this.config.get<string>('CDN_BASE_URL')?.replace(/\/+$/, '');
    return {
      uploadUrl: post.url,
      fields: post.fields,
      publicUrl: cdn
        ? `${cdn}/${key}`
        : `https://${this.bucket}.s3.${this.config.get<string>('AWS_REGION') ?? 'ap-southeast-1'}.amazonaws.com/${key}`,
    };
  }

  /** Saves an uploaded file to disk (development only). */
  async saveLocal(
    key: string,
    expires: number,
    signature: string,
    file: { buffer: Buffer; size: number } | undefined,
  ) {
    if (this.bucket) throw new ForbiddenException('Upload cục bộ đã tắt.');
    if (!this.isValid(key, expires, signature)) {
      throw new ForbiddenException(
        'Liên kết tải lên không hợp lệ hoặc đã hết hạn.',
      );
    }
    if (!file) throw new BadRequestException('Thiếu file ảnh.');
    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException('Ảnh quá lớn (tối đa 5MB).');
    }
    const type = detectImageType(file.buffer);
    if (!type || EXTENSIONS[type] !== key.split('.').pop()) {
      throw new BadRequestException('File không phải ảnh hợp lệ.');
    }
    const directory = join(UPLOAD_DIR, LOCAL_FOLDER);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, key), file.buffer);
    return { publicUrl: `${this.appUrl}/uploads/${LOCAL_FOLDER}/${key}` };
  }

  private sign(key: string, expires: number) {
    return createHmac(
      'sha256',
      this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    )
      .update(`${key}.${expires}`)
      .digest('hex');
  }

  private isValid(key: string, expires: number, signature: string) {
    if (!/^[\w-]+\.(jpg|png|webp|gif)$/.test(key) || Date.now() > expires) {
      return false;
    }
    const expected = Buffer.from(this.sign(key, expires));
    const given = Buffer.from(signature);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }
}
