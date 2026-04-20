import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RefreshTokenDto, LogoutDto, AuthResponseDto } from './dto';
import { CurrentUser } from './decorators';
import { JwtPayload } from './strategies/jwt.strategy';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/login
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
  }

  /**
   * POST /auth/refresh
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
  }

  /**
   * POST /auth/logout
   * Revoke refresh tokens and invalidate session.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
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
  }
}
