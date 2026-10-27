/*
Mục đích: Định nghĩa User là gì, có những field nào, 
logic tạo mới ra sao. Không import NestJS hay Prisma ở đây.

*/
export enum Role {
  USER = 'USER',
  CREATOR = 'CREATOR',
  ADMIN = 'ADMIN',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DELETED = 'DELETED',
}

export class UserEntity {
  id: string;
  keycloakSub: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;

  static create(props: { keycloakSub: string; email: string }): UserEntity {
    const user = new UserEntity();
    user.keycloakSub = props.keycloakSub;
    user.email = props.email;
    user.role = Role.USER;
    user.status = UserStatus.ACTIVE;
    return user;
  }
}
