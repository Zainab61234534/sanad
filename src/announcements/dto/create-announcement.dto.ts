import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAnnouncementDto {
    @IsString()
    @MinLength(3)
    @MaxLength(150)
    title: string;

    @IsString()
    @MinLength(3)
    @MaxLength(5000)
    content: string;
}