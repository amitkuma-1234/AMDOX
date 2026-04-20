import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Headers,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser, AuthenticatedUser } from './decorators/current-user.decorator';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/login
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
  }

  /**
   * POST /auth/refresh
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
  }

  /**
   * POST /auth/logout
   * Revoke tokens at Keycloak and blacklist locally.
   * Requires a valid access token in Authorization header.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
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
  }
}
