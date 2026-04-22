import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../../src/auth/auth.controller';
import { AuthService } from '../../src/auth/auth.service';

const mockAuthService = {
  login: jest.fn(),
  refreshToken: jest.fn(),
  logout: jest.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /auth/login', () => {
    it('should return tokens on successful login', async () => {
      const loginDto = { email: 'admin@test.com', password: 'StrongP@ss123' };
      const expectedResult = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 3600,
        refreshExpiresIn: 604800,
        tokenType: 'Bearer',
      };

      mockAuthService.login.mockResolvedValue(expectedResult);

      const result = await controller.login(loginDto);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.login).toHaveBeenCalledWith(
        loginDto.email,
        loginDto.password,
      );
    });

    it('should propagate UnauthorizedException', async () => {
      const loginDto = { email: 'wrong@test.com', password: 'bad' };
      mockAuthService.login.mockRejectedValue(
        new Error('Invalid credentials'),
      );

      await expect(controller.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );
    });
  });

  describe('POST /auth/refresh', () => {
    it('should return new tokens on successful refresh', async () => {
      const refreshDto = { refreshToken: 'valid-refresh-token' };
      const expectedResult = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 3600,
        refreshExpiresIn: 604800,
        tokenType: 'Bearer',
      };

      mockAuthService.refreshToken.mockResolvedValue(expectedResult);

      const result = await controller.refresh(refreshDto);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(
        refreshDto.refreshToken,
      );
    });
  });

  describe('POST /auth/logout', () => {
    it('should return success on logout', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'admin@test.com',
        tenantId: 'tenant-123',
        keycloakId: 'kc-123',
        roles: ['admin'],
        permissions: ['*:*'],
      };
      const authHeader = 'Bearer mock-access-token';
      const body = { refreshToken: 'mock-refresh-token' };

      mockAuthService.logout.mockResolvedValue({
        message: 'Logged out successfully',
      });

      const result = await controller.logout(authHeader, body, mockUser);

      expect(result.message).toBe('Logged out successfully');
      expect(mockAuthService.logout).toHaveBeenCalledWith(
        'mock-access-token',
        'mock-refresh-token',
      );
    });
  });
});
