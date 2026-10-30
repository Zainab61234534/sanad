import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, Query } from '@nestjs/common';
import { CreateAnnouncementDto } from './dto/create-announcement.dto.js';
import { AnnouncementsService } from './announcements.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/index.js';
import type { AuthUser } from '../common/decorators/index.js';
import { Role } from '../common/enums/role.enum.js';
import { ApiTags } from '@nestjs/swagger';
import { PaginationDto } from '../common/dto/pagination.dto.js';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto.js';

// announcements/announcements.controller.ts
@ApiTags('announcements') @Controller()
export class AnnouncementsController {
  constructor(private s: AnnouncementsService) {}

  @Roles(Role.YOUTH) @Get('announcements')
  mine(@CurrentUser() u: AuthUser, @Query() q: PaginationDto) { return this.s.listForYouth(u.id, q); }

  @Roles(Role.SUPERVISOR) @Post('supervisor/programs/:programId/announcements')
  forProgram(@CurrentUser() u: AuthUser, @Param('programId', ParseUUIDPipe) id: string, @Body() dto: CreateAnnouncementDto) {
    return this.s.createForProgram(u, id, dto);
  }

  @Roles(Role.ADMIN) @Post('admin/announcements')
  general(@CurrentUser() u: AuthUser, @Body() dto: CreateAnnouncementDto) { return this.s.createGeneral(u.id, dto); }

  @Get('announcements/general')
  listGeneral(@Query() q: PaginationDto) { return this.s.listGeneral(q); }

  @Roles(Role.ADMIN) @Patch('admin/announcements/:id')
  updateGeneral(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAnnouncementDto) {
    return this.s.updateGeneral(id, dto);
  }

  @Roles(Role.ADMIN) @Delete('admin/announcements/:id')
  removeGeneral(@Param('id', ParseUUIDPipe) id: string) { return this.s.removeGeneral(id); }
}
