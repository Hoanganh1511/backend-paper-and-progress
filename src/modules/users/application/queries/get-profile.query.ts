import { Injectable } from '@nestjs/common';
import { UserProfileRepository } from '../../infrastructure/users.repository.js';

@Injectable()
export class GetProfileQuery {
  constructor(private repo: UserProfileRepository) {}

  async execute(userId: string, email: string) {
    let profile = await this.repo.findByUserId(userId);

    if (!profile) {
      profile = await this.repo.upsert(userId, {});
    }

    return { ...profile, email };
  }
}
