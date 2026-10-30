import { IsString, MaxLength, MinLength } from 'class-validator';

export class RefreshDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  refreshToken!: string;
}
