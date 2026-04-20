import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
<<<<<<< HEAD
  Headers,
  Logger,
} from '@nestjs/common';
=======
  Req,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
<<<<<<< HEAD
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser, AuthenticatedUser } from './decorators/current-user.decorator';
import { SkipThrottle } from '@nestjs/throttler';
=======
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RefreshTokenDto, LogoutDto, AuthResponseDto } from './dto';
import { CurrentUser } from './decorators';
import { JwtPayload } from './strategies/jwt.strategy';
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/login
<<<<<<< HEAD
   * Authenticate with email/password via Keycloak.
   * Returns JWT access token + refresh token.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle()
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({
    status: 200,
    description: 'Login successful — returns access and refresh tokens',
    schema: {
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        expiresIn: { type: 'number', example: 3600 },
        refreshExpiresIn: { type: 'number', example: 604800 },
        tokenType: { type: 'string', example: 'Bearer' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    this.logger.log(`Login attempt for: ${loginDto.email}`);
    return this.authService.login(loginDto.email, loginDto.password);
=======
   * Authenticate user and return JWT tokens.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { ttl: 60000, limit: 10 } })
  @ApiOperation({
    summary: 'User login',
    description: 'Authenticate with email/password via Keycloak and receive JWT tokens.',
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many login attempts' })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.authService.login(loginDto, ipAddress, userAgent);
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
  }

  /**
   * POST /auth/refresh
<<<<<<< HEAD
   * Exchange a valid refresh token for a new access token + refresh token pair.
   * The old refresh token is blacklisted (rotation).
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({
    status: 200,
    description: 'Tokens refreshed successfully',
    schema: {
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        expiresIn: { type: 'number', example: 3600 },
        refreshExpiresIn: { type: 'number', example: 604800 },
        tokenType: { type: 'string', example: 'Bearer' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
=======
   * Refresh access token using a valid refresh token.
   * Implements token rotation (old refresh token is revoked).
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { ttl: 60000, limit: 30 } })
  @ApiOperation({
    summary: 'Refresh tokens',
    description:
      'Exchange a valid refresh token for new access and refresh tokens. ' +
      'The old refresh token is revoked (rotation).',
  })
  @ApiResponse({
    status: 200,
    description: 'Token refresh successful',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(
    @Body() refreshDto: RefreshTokenDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.authService.refresh(
      refreshDto.refreshToken,
      ipAddress,
      userAgent,
    );
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
  }

  /**
   * POST /auth/logout
<<<<<<< HEAD
   * Revoke tokens at Keycloak and blacklist locally.
   * Requires a valid access token in Authorization header.
=======
   * Revoke refresh tokens and invalidate session.
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
<<<<<<< HEAD
  @ApiOperation({ summary: 'Logout and revoke tokens' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @ApiResponse({ status: 401, description: 'Invalid access token' })
  async logout(
    @Headers('authorization') authHeader: string,
    @Body() body: RefreshTokenDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const accessToken = authHeader?.replace('Bearer ', '');
    this.logger.log(`Logout for user: ${user.email}`);
    return this.authService.logout(accessToken, body.refreshToken);
=======
  @ApiOperation({
    summary: 'User logout',
    description:
      'Revoke the specified refresh token or all refresh tokens for the user.',
  })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async logout(
    @CurrentUser() user: JwtPayload,
    @Body() logoutDto: LogoutDto,
  ): Promise<{ message: string }> {
    await this.authService.logout(user.sub, logoutDto.refreshToken);

    return { message: 'Logout successful' };
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
  }
}
