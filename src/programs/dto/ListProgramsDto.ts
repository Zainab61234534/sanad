import { IsOptional, IsString, MaxLength } from "class-validator";
import { PaginationDto } from "../../common/dto/pagination.dto.js";

export class ListProgramsDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
}