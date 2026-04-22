import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '@auth/auth.controller';
import { AuthService } from '@auth/auth.service';

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

      const mockRequest = { ip: '127.0.0.1', headers: { 'user-agent': 'test' } } as any;
      mockAuthService.login.mockResolvedValue(expectedResult);

      const result = await controller.login(loginDto, mockRequest);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.login).toHaveBeenCalledWith(
        loginDto,
        '127.0.0.1',
        'test',
      );
    });

    it('should propagate UnauthorizedException', async () => {
      const loginDto = { email: 'wrong@test.com', password: 'bad' };
      const mockRequest = { ip: '127.0.0.1', headers: { 'user-agent': 'test' } } as any;
      mockAuthService.login.mockRejectedValue(
        new Error('Invalid credentials'),
      );

      await expect(controller.login(loginDto, mockRequest)).rejects.toThrow(
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

      const mockRequest = { ip: '127.0.0.1', headers: { 'user-agent': 'test' } } as any;
      mockAuthService.login.mockResolvedValue(expectedResult); // Using login mock for refresh as well in this simple mock

      const result = await controller.refresh(refreshDto, mockRequest);

      expect(result).toEqual(expectedResult);
    });
  });

  describe('POST /auth/logout', () => {
    it('should return success on logout', async () => {
      const mockUser = {
        userId: 'user-123',
        email: 'admin@test.com',
        tenantId: 'tenant-123',
        username: 'admin',
        roles: ['admin'],
        permissions: ['*:*'],
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600,
      };
      const authHeader = 'Bearer mock-access-token';
      const body = { refreshToken: 'mock-refresh-token' };

      mockAuthService.logout.mockResolvedValue(undefined);

      const result = await controller.logout(mockUser, authHeader, body);

      expect(result.message).toBe('Logout successful');
      expect(mockAuthService.logout).toHaveBeenCalledWith(
        mockUser.userId,
        'mock-access-token',
        'mock-refresh-token',
      );
    });
  });
});
