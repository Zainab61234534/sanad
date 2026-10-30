import { IsInt, IsOptional, Max, Min } from "class-validator";
import { Type } from "class-transformer";

// common/dto/pagination.dto.ts
export class PaginationDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit: number = 10;
}
export const skipTake = (p: PaginationDto) => ({ skip: (p.page - 1) * p.limit, take: p.limit });
export const paged = <T>(items: T[], total: number, p: PaginationDto) => ({
  items,
  meta: { page: p.page, limit: p.limit, total, totalPages: Math.ceil(total / p.limit) },
}); 