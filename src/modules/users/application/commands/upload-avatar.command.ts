import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { UserProfileRepository } from '../../infrastructure/users.repository.js';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

@Injectable()
export class UploadAvatarCommand {
  private readonly logger = new Logger(UploadAvatarCommand.name);
  private s3: S3Client;
  private bucket: string;
  private region: string;

  constructor(private repo: UserProfileRepository) {
    this.region = process.env.AWS_REGION || 'ap-southeast-1';
    this.bucket = process.env.AWS_S3_BUCKET || '';
    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }

  async execute(userId: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Thiếu file ảnh (field "avatar")');
    }

    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Chỉ chấp nhận JPEG, PNG hoặc WebP');
    }

    if (file.size > MAX_SIZE) {
      throw new BadRequestException('Ảnh tối đa 2MB');
    }

    // Resize + convert webp
    const buffer = await sharp(file.buffer)
      .resize(256, 256, { fit: 'cover', position: 'center' })
      .webp({ quality: 80 })
      .toBuffer();

    // Upload to S3
    const key = `avatars/${userId}.webp`;

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: 'image/webp',
        }),
      );
    } catch (error) {
      this.logger.error('S3 upload failed', error);
      throw new InternalServerErrorException('Upload ảnh thất bại');
    }

    const avatarUrl = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;

    // Lưu URL vào DB (đổi field avatarBase64 → dùng làm avatarUrl luôn)
    await this.repo.upsert(userId, { avatarBase64: avatarUrl });

    return { avatarUrl };
  }

  async delete(userId: string) {
    const key = `avatars/${userId}.webp`;

    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch {
      // Không throw nếu file không tồn tại
    }

    await this.repo.upsert(userId, { avatarBase64: null });
  }
}
