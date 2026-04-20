import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for user login.
 */
export class LoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'admin@demo-tenant.amdox.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description: 'User password',
    example: 'Demo@123456',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;

  @ApiProperty({
    description: 'Tenant slug or identifier',
    example: 'demo-tenant-001',
    required: false,
  })
  @IsString()
  tenantSlug?: string;
}

/**
 * DTO for token refresh.
 */
export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token from previous login/refresh',
    example: 'eyJhbGciOiJSUzI1NiIs...',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

/**
 * DTO for logout.
 */
export class LogoutDto {
  @ApiProperty({
    description: 'Refresh token to revoke',
    example: 'eyJhbGciOiJSUzI1NiIs...',
    required: false,
  })
  @IsString()
  refreshToken?: string;
}

/**
 * Auth response DTO.
 */
export class AuthResponseDto {
  @ApiProperty({ description: 'JWT access token' })
  accessToken!: string;

  @ApiProperty({ description: 'JWT refresh token' })
  refreshToken!: string;

  @ApiProperty({ description: 'Access token type', example: 'Bearer' })
  tokenType!: string;

  @ApiProperty({ description: 'Access token expiration in seconds', example: 3600 })
  expiresIn!: number;

  @ApiProperty({
    description: 'Authenticated user information',
    type: 'object',
  })
  user!: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    tenantId: string;
    roles: string[];
    permissions: string[];
  };
}
