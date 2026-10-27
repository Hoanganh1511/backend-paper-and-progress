import { Inject, Injectable } from '@nestjs/common';
import {
  USER_REPOSITORY,
  type UserRepositoryPort,
} from '../../domain/ports/user.repository.port.js';
import { UserEntity } from '../../domain/entities/user.entity.js';

export interface SyncUserInput {
  keycloakSub: string;
  email: string;
}

@Injectable()
export class SyncUserCommand {
  constructor(@Inject(USER_REPOSITORY) private userRepo: UserRepositoryPort) {}

  async execute(input: SyncUserInput): Promise<UserEntity> {
    let user = await this.userRepo.findByKeycloakSub(input.keycloakSub);

    if (!user) {
      user = UserEntity.create({
        keycloakSub: input.keycloakSub,
        email: input.email,
      });
    } else {
      user.email = input.email;
    }

    return this.userRepo.save(user);
  }
}
