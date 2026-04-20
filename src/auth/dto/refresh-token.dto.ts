import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for POST /auth/refresh
 */
export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token obtained from login',
    example: 'eyJhbGciOiJSUzI1NiIs...',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
