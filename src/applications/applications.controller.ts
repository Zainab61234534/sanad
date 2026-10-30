import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, ParseUUIDPipe, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApplicationsService } from './applications.service.js';
import { CurrentUser, Roles } from '../common/decorators/index.js';
import type { AuthUser } from '../common/decorators/index.js';
import { ListApplicationsDto } from './dto/create-application.dto.js';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Role } from '../common/enums/role.enum.js';
import { finalizeUpload, UploadCleanupInterceptor, uploadOptions } from '../common/uploads/upload.util.js';
import { ReviewDto } from './dto/ReviewDto.js';


// applications/applications.controller.ts
@ApiTags('applications') @Controller()
export class ApplicationsController {
  constructor(private s: ApplicationsService) {}

  @Roles(Role.YOUTH) @Post('programs/:programId/applications')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('cv', uploadOptions('cv')), UploadCleanupInterceptor)
  async apply(@CurrentUser() u: AuthUser, @Param('programId', ParseUUIDPipe) programId: string,
              @UploadedFile() cv?: Express.Multer.File) {
    const cvPath = cv ? (await finalizeUpload('cv', cv)).path : undefined;
    return this.s.apply(u.id, programId, cvPath);
  }

  // تنزيل السيرة: صاحبها أو الأدمن فقط
  @Roles(Role.YOUTH, Role.ADMIN) @Get('applications/:id/cv')
  cv(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.s.cvFile(u, id); }

  @Roles(Role.YOUTH) @Get('applications/me')
  mine(@CurrentUser() u: AuthUser, @Query() q: ListApplicationsDto) { return this.s.listMine(u.id, q); }

  @Roles(Role.YOUTH) @Patch('applications/:id/cancel')
  cancel(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.s.cancel(u.id, id); }
}

@ApiTags('admin') @Roles(Role.ADMIN) @Controller('admin/applications')
export class AdminApplicationsController {
  constructor(private s: ApplicationsService) {}
  @Get() 
  list(@Query() q: ListApplicationsDto) 
  { return this.s.listAll(q); }
  @Patch(':id/accept') 
  accept(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() d: ReviewDto) 
  { return this.s.accept(u.id, id, d.note); }
  @Patch(':id/reject') 
  reject(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() d: ReviewDto) 
  { return this.s.reject(u.id, id, d.note); }
}