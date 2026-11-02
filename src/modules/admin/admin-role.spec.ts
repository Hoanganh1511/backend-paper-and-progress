import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AdminService } from './admin.service.js';

function setup(found: unknown = { id: 'u2' }) {
  const user = {
    findUnique: vi.fn().mockResolvedValue(found),
    update: vi.fn().mockImplementation(({ data }) => ({ id: 'u2', ...data })),
  };
  return { service: new AdminService({ user } as never), user };
}

describe('AdminService.setUserRole', () => {
  it('changes another user role', async () => {
    const { service, user } = setup();
    expect(await service.setUserRole('admin', 'u2', 'CREATOR')).toEqual({
      id: 'u2',
      role: 'CREATOR',
    });
    expect(user.update).toHaveBeenCalledWith({
      where: { id: 'u2' },
      data: { role: 'CREATOR' },
      select: { id: true, role: true },
    });
  });

  it('refuses to change your own role, so the last admin cannot lock everyone out', async () => {
    const { service, user } = setup();
    await expect(service.setUserRole('u2', 'u2', 'USER')).rejects.toThrow(
      BadRequestException,
    );
    expect(user.update).not.toHaveBeenCalled();
  });

  it('404s for an unknown user', async () => {
    const { service, user } = setup(null);
    await expect(service.setUserRole('admin', 'x', 'USER')).rejects.toThrow(
      NotFoundException,
    );
    expect(user.update).not.toHaveBeenCalled();
  });
});
