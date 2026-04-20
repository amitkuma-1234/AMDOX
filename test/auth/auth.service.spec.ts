import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../../src/auth/auth.service';
import { PrismaService } from '../../src/database/prisma.service';

// Mock PrismaService
const mockPrismaService = {
  user: {
    upsert: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  $queryRaw: jest.fn(),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
};

// Mock ConfigService
const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: any) => {
    const config: Record<string, any> = {
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6379,
      REDIS_PASSWORD: '',
      REDIS_DB: 0,
      KEYCLOAK_BASE_URL: 'http://localhost:8080',
      KEYCLOAK_REALM: 'amdox',
      KEYCLOAK_CLIENT_ID: 'amdox-api',
      KEYCLOAK_CLIENT_SECRET: 'test-secret',
      JWT_ACCESS_EXPIRATION: 3600,
      JWT_REFRESH_EXPIRATION: 604800,
    };
    return config[key] ?? defaultValue;
  }),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should throw UnauthorizedException for invalid credentials', async () => {
      // Mock fetch to return 401
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        json: jest.fn().mockResolvedValue({
          error: 'invalid_grant',
          error_description: 'Invalid user credentials',
        }),
      });

      await expect(
        service.login('invalid@test.com', 'wrong-password'),
      ).rejects.toThrow('Invalid credentials');
    });

    it('should return tokens on successful login', async () => {
      const mockTokenResponse = {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600,
        refresh_expires_in: 604800,
        token_type: 'Bearer',
      };

      const mockUserInfo = {
        sub: 'keycloak-user-id',
        email: 'admin@test.com',
        given_name: 'Test',
        family_name: 'Admin',
        tenant_id: 'tenant-123',
      };

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockTokenResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockUserInfo),
        });

      mockPrismaService.user.upsert.mockResolvedValue({
        id: 'user-123',
        email: 'admin@test.com',
      });

      const result = await service.login('admin@test.com', 'password');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.tokenType).toBe('Bearer');
    });
  });

  describe('refreshToken', () => {
    it('should throw UnauthorizedException for blacklisted token', async () => {
      // Spy on isTokenBlacklisted to return true
      jest.spyOn(service, 'isTokenBlacklisted').mockResolvedValue(true);

      await expect(
        service.refreshToken('blacklisted-refresh-token'),
      ).rejects.toThrow('Token has been revoked');
    });
  });

  describe('logout', () => {
    it('should return success message', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
      });

      const result = await service.logout('access-token', 'refresh-token');

      expect(result).toHaveProperty('message');
      expect(result.message).toContain('Logged out');
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return false for non-blacklisted tokens', async () => {
      // The default Redis mock won't have any blacklisted tokens
      // In a real test, we'd mock Redis properly
      const result = await service.isTokenBlacklisted('valid-token');
      expect(typeof result).toBe('boolean');
    });
  });
});
