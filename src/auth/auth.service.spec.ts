import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma.service';
import { UserRepository } from '../repositories/user.repository';

// Mock implementations
const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: any) => {
    const config: Record<string, any> = {
      JWT_ACCESS_TOKEN_EXPIRATION: 3600,
      JWT_REFRESH_TOKEN_EXPIRATION: 604800,
      KEYCLOAK_BASE_URL: 'http://localhost:8080',
      KEYCLOAK_REALM: 'amdox',
      KEYCLOAK_CLIENT_ID: 'amdox-api',
      KEYCLOAK_CLIENT_SECRET: 'test-secret',
    };
    return config[key] ?? defaultValue;
  }),
};

const mockJwtService = {
  signAsync: jest.fn().mockResolvedValue('mock-access-token'),
  sign: jest.fn().mockReturnValue('mock-refresh-token'),
  decode: jest.fn().mockReturnValue({
    sub: 'user-id-123',
    email: 'test@demo.amdox.com',
    tenant_id: 'tenant-id-123',
    roles: ['tenant_admin'],
    given_name: 'Test',
    family_name: 'User',
    email_verified: true,
  }),
};

const mockPrismaService = {
  refreshToken: {
    create: jest.fn().mockResolvedValue({ id: 'token-id', token: 'mock-refresh-token' }),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  user: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

const mockUserRepository = {
  findByKeycloakId: jest.fn(),
  findByEmail: jest.fn(),
  updateLastLogin: jest.fn().mockResolvedValue(undefined),
  getPermissions: jest.fn().mockResolvedValue(['finance:read', 'finance:write']),
};

// Mock global fetch for Keycloak calls
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: UserRepository, useValue: mockUserRepository },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@demo.amdox.com',
      password: 'Test@123456',
    };

    it('should login successfully with valid credentials', async () => {
      // Mock Keycloak token exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'kc-access-token',
            refresh_token: 'kc-refresh-token',
            expires_in: 3600,
          }),
      });

      // Mock existing user
      mockUserRepository.findByKeycloakId.mockResolvedValueOnce({
        id: 'user-id-123',
        email: 'test@demo.amdox.com',
        firstName: 'Test',
        lastName: 'User',
        tenantId: 'tenant-id-123',
        userRoles: [
          {
            role: {
              name: 'tenant_admin',
              permissions: ['tenant:*'],
            },
          },
        ],
      });

      const result = await service.login(loginDto);

      expect(result).toBeDefined();
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBe('mock-refresh-token');
      expect(result.tokenType).toBe('Bearer');
      expect(result.expiresIn).toBe(3600);
      expect(result.user.email).toBe('test@demo.amdox.com');
      expect(mockUserRepository.updateLastLogin).toHaveBeenCalledWith(
        'user-id-123',
      );
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('invalid_grant'),
      });

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when Keycloak is unreachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refresh', () => {
    it('should refresh tokens successfully', async () => {
      const storedToken = {
        id: 'stored-token-id',
        token: 'old-refresh-token',
        userId: 'user-id-123',
        expiresAt: new Date(Date.now() + 86400000), // 1 day ahead
        isRevoked: false,
        user: {
          id: 'user-id-123',
          email: 'test@demo.amdox.com',
          firstName: 'Test',
          lastName: 'User',
          tenantId: 'tenant-id-123',
          userRoles: [
            { role: { name: 'tenant_admin' } },
          ],
        },
      };

      mockPrismaService.refreshToken.findFirst.mockResolvedValueOnce(
        storedToken,
      );
      mockPrismaService.refreshToken.update.mockResolvedValueOnce({
        ...storedToken,
        isRevoked: true,
      });

      const result = await service.refresh('old-refresh-token');

      expect(result).toBeDefined();
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBe('mock-refresh-token');

      // Verify old token was revoked
      expect(mockPrismaService.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'stored-token-id' },
        data: { isRevoked: true, revokedAt: expect.any(Date) },
      });
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      mockPrismaService.refreshToken.findFirst.mockResolvedValueOnce(null);

      await expect(service.refresh('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for expired refresh token', async () => {
      mockPrismaService.refreshToken.findFirst.mockResolvedValueOnce({
        id: 'stored-token-id',
        token: 'expired-token',
        userId: 'user-id-123',
        expiresAt: new Date(Date.now() - 86400000), // 1 day ago (expired)
        isRevoked: false,
        user: { id: 'user-id-123', email: 'test@demo.amdox.com', tenantId: 'tenant-id-123', userRoles: [] },
      });

      await expect(service.refresh('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should revoke a specific refresh token', async () => {
      await service.logout('user-id-123', 'specific-token');

      expect(
        mockPrismaService.refreshToken.updateMany,
      ).toHaveBeenCalledWith({
        where: {
          userId: 'user-id-123',
          token: 'specific-token',
          isRevoked: false,
        },
        data: { isRevoked: true, revokedAt: expect.any(Date) },
      });
    });

    it('should revoke all refresh tokens when no specific token provided', async () => {
      await service.logout('user-id-123');

      expect(
        mockPrismaService.refreshToken.updateMany,
      ).toHaveBeenCalledWith({
        where: {
          userId: 'user-id-123',
          isRevoked: false,
        },
        data: { isRevoked: true, revokedAt: expect.any(Date) },
      });
    });
  });
});
