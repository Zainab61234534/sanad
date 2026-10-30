import { IsDateString, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateSessionDto {
  @IsDateString()
  startsAt!: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string | null;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  onlineUrl?: string | null;
}
