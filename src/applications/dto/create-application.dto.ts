import { IsEnum, IsOptional, IsUUID } from "class-validator";
import { PaginationDto } from "../../common/dto/pagination.dto.js";
import { ApplicationStatus } from "../../generated/prisma/enums.js";

// applications/dto/application.dto.ts
export class ListApplicationsDto extends PaginationDto {
  @IsOptional() @IsEnum(ApplicationStatus) status?: ApplicationStatus;
  @IsOptional() @IsUUID() programId?: string;
}