import { BadRequestException, Controller, Get, Post, Body, Patch, Param, Query, ParseUUIDPipe, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { ProgramsService } from './programs.service.js';
import { CreateProgramDto } from './dto/create-program.dto.js';
import { UpdateProgramDto } from './dto/update-program.dto.js';
import { CurrentUser, Public, Roles } from '../common/decorators/index.js';
import type { AuthUser } from '../common/decorators/index.js';
import { ListProgramsDto } from './dto/ListProgramsDto.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';
import { Role } from '../common/enums/role.enum.js';
import { finalizeUpload, UploadCleanupInterceptor, uploadOptions } from '../common/uploads/upload.util.js';


// programs/programs.controller.ts
@ApiTags('programs') @Controller('programs')
export class ProgramsController {
  constructor(private s: ProgramsService) {}
  @Public() 
  @Get() 
  list(@Query() q: ListProgramsDto)
   { return this.s.list(q); }

  @Public()
  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.s.detail(id);
  }
}

@ApiTags('supervisor') 
@Roles(Role.SUPERVISOR as Parameters<typeof Roles>[0]) 
@Controller('supervisor/programs')
export class SupervisorProgramsController {
  constructor(private s: ProgramsService) {}
  @Post() 
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateProgramDto) 
  { return this.s.createProgram(u, dto); }
  @Get() 
  listMine(@CurrentUser() u: AuthUser, @Query() q: PaginationDto)
   { return this.s.listMine(u, q); }
  @Patch(':id') update(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProgramDto) {
    return this.s.update(u, id, dto);
  }

  @Post(':id/image')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image', uploadOptions('image')), UploadCleanupInterceptor)
  async image(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('الصورة مطلوبة');
    const imagePath = (await finalizeUpload('image', file)).path;
    return this.s.setImage(u, id, imagePath);
  }
}
