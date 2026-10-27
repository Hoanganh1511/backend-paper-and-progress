/*
Port = hợp đồng giữa domain và database. 
Domain nói “tôi cần lưu/tìm user”, không quan tâm 
dùng Prisma hay gì.
*/
import { UserEntity } from '../entities/user.entity.js';

export interface UserRepositoryPort {
  findByKeycloakSub(sub: string): Promise<UserEntity | null>;
  save(user: UserEntity): Promise<UserEntity>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
