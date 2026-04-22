import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from './base.repository';

/**
 * Repository for User entities with role relationship handling.
 */
@Injectable()
export class UserRepository extends BaseRepository<User> {
  protected readonly modelName = 'User';

  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
  }

  protected getDelegate() {
    return this.prisma.user;
  }

  /**
   * Find user by email within a tenant.
   */
  async findByEmail(email: string, tenantId: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { email, tenantId },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });
  }

  /**
   * Find user by Keycloak ID (globally unique).
   */
  async findByKeycloakId(keycloakId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { keycloakId },
      include: {
        roles: {
          include: { role: true },
        },
        tenant: true,
      },
    });
  }

  /**
   * Find user by ID with full role and permission details.
   */
  async findByIdWithRoles(id: string, tenantId: string) {
    return this.prisma.user.findFirst({
      where: { id, tenantId },
      include: {
        roles: {
          include: { role: true },
        },
        employee: true,
      },
    });
  }

  /**
   * Assign a role to a user.
   */
  async assignRole(userId: string, roleId: string): Promise<void> {
    await this.prisma.userRole.upsert({
      where: {
        userId_roleId: { userId, roleId },
      },
      update: {},
      create: { userId, roleId },
    });
  }

  /**
   * Remove a role from a user.
   */
  async removeRole(userId: string, roleId: string): Promise<void> {
    await this.prisma.userRole.deleteMany({
      where: { userId, roleId },
    });
  }

  /**
   * Get all permissions for a user (flattened from their roles).
   */
  async getUserPermissions(userId: string, tenantId: string): Promise<string[]> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    if (!user) return [];

    const permissions = new Set<string>();
    for (const userRole of user.roles) {
      const rolePermissions = userRole.role.permissions as string[];
      if (Array.isArray(rolePermissions)) {
        rolePermissions.forEach((p) => permissions.add(p));
      }
    }

    return Array.from(permissions);
  }

  /**
   * List active users for a tenant with pagination.
   */
  async findActiveUsers(
    tenantId: string,
    options: { page?: number; limit?: number } = {},
  ) {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { tenantId, isActive: true },
        include: {
          roles: { include: { role: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({
        where: { tenantId, isActive: true },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update last login timestamp for a user.
   */
  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }
}
