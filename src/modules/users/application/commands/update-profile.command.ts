import { Injectable } from '@nestjs/common';
import { UserProfileRepository } from '../../infrastructure/users.repository.js';
import { UpdateProfileDto } from '../dtos/update-profile.dto.js';

@Injectable()
export class UpdateProfileCommand {
  constructor(private repo: UserProfileRepository) {}

  async execute(userId: string, dto: UpdateProfileDto) {
    return this.repo.upsert(userId, dto);
  }
}
