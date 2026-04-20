import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for POST /auth/login
 * Credentials are forwarded to Keycloak for validation.
 */
export class LoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'admin@amdox.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'StrongP@ssw0rd!',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}
