import { Injectable } from '@nestjs/common';
import { User, Prisma } from '@prisma/client';
import { BaseRepository, PaginatedResult, BaseQueryOptions } from '../database/base.repository';
import { PrismaService } from '../database/prisma.service';

/**
 * UserRepository provides specialized data access for User entities.
 * Includes role relationship loading, Keycloak ID lookups, and status management.
 */
@Injectable()
export class UserRepository extends BaseRepository<User> {
  constructor(prisma: PrismaService) {
    super(prisma, 'User');
  }

  protected getDelegate() {
    return this.prisma.user;
  }

  /**
   * Find user by email within a tenant.
   */
  async findByEmail(
    tenantId: string,
    email: string,
  ): Promise<(User & { userRoles: any[] }) | null> {
    return this.prisma.user.findFirst({
      where: {
        tenantId,
        email,
        deletedAt: null,
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  /**
   * Find user by Keycloak ID (for SSO token validation).
   */
  async findByKeycloakId(
    keycloakId: string,
  ): Promise<(User & { userRoles: any[]; tenant: any }) | null> {
    return this.prisma.user.findFirst({
      where: {
        keycloakId,
        deletedAt: null,
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
        tenant: true,
      },
    });
  }

  /**
   * Find user by ID with full role and tenant relationships.
   */
  async findByIdWithRoles(
    id: string,
    tenantId: string,
  ): Promise<(User & { userRoles: any[] }) | null> {
    return this.prisma.user.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  /**
   * Get all users with their roles for a tenant (paginated).
   */
  async findAllWithRoles(
    tenantId: string,
    options: BaseQueryOptions = {},
  ): Promise<PaginatedResult<User>> {
    const {
      page = 1,
      pageSize = 20,
      orderBy = { createdAt: 'desc' as const },
    } = options;

    const skip = (page - 1) * pageSize;

    const where: Prisma.UserWhereInput = {
      tenantId,
      deletedAt: null,
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          userRoles: {
            include: {
              role: {
                select: {
                  id: true,
                  name: true,
                  displayName: true,
                  permissions: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data,
      meta: {
        total,
        page,
        pageSize,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  /**
   * Assign a role to a user.
   */
  async assignRole(userId: string, roleId: string): Promise<void> {
    await this.prisma.userRole.upsert({
      where: {
        userId_roleId: { userId, roleId },
      },
      create: { userId, roleId },
      update: {},
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
   * Get user permissions (aggregated from all roles).
   */
  async getPermissions(userId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          select: { permissions: true },
        },
      },
    });

    const allPermissions = new Set<string>();
    for (const ur of userRoles) {
      const perms = ur.role.permissions as string[];
      if (Array.isArray(perms)) {
        perms.forEach((p) => allPermissions.add(p));
      }
    }

    return Array.from(allPermissions);
  }

  /**
   * Update last login timestamp.
   */
  async updateLastLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  /**
   * Deactivate a user.
   */
  async deactivate(userId: string, tenantId: string): Promise<User | null> {
    const user = await this.findById(userId, tenantId);
    if (!user) return null;

    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
  }

  /**
   * Search users by name or email.
   */
  async search(
    tenantId: string,
    query: string,
    options: BaseQueryOptions = {},
  ): Promise<PaginatedResult<User>> {
    const { page = 1, pageSize = 20 } = options;
    const skip = (page - 1) * pageSize;

    const where: Prisma.UserWhereInput = {
      tenantId,
      deletedAt: null,
      OR: [
        { email: { contains: query, mode: 'insensitive' } },
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
      ],
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          userRoles: {
            include: { role: { select: { name: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data,
      meta: {
        total,
        page,
        pageSize,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  /**
   * Count active users for a tenant (for subscription limit checks).
   */
  async countActiveUsers(tenantId: string): Promise<number> {
    return this.prisma.user.count({
      where: {
        tenantId,
        isActive: true,
        deletedAt: null,
      },
    });
  }
}
