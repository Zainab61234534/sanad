import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../common/decorators/index.js';
import type { AuthUser } from '../common/decorators/index.js';
import { Role } from '../common/enums/role.enum.js';
import {
  finalizeUpload,
  UploadCleanupInterceptor,
  uploadOptions,
} from '../common/uploads/upload.util.js';
import { CreateMaterialDto } from './dto/create-material.dto.js';
import { MaterialsService } from './materials.service.js';

@ApiTags('materials')
@Controller()
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Roles(Role.SUPERVISOR)
  @Post('supervisor/programs/:programId/materials')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', uploadOptions('material')),
    UploadCleanupInterceptor,
  )
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async upload(
    @CurrentUser() user: AuthUser,
    @Param('programId', ParseUUIDPipe) programId: string,
    @Body() dto: CreateMaterialDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('الملف مطلوب');
    return this.materialsService.create(
      user,
      programId,
      dto.title,
      await finalizeUpload('material', file),
    );
  }

  @Get('programs/:programId/materials')
  list(
    @CurrentUser() user: AuthUser,
    @Param('programId', ParseUUIDPipe) programId: string,
  ) {
    return this.materialsService.list(user, programId);
  }

  @Get('materials/:id/download')
  download(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.materialsService.download(user, id);
  }

  @Roles(Role.SUPERVISOR)
  @Delete('supervisor/materials/:id')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.materialsService.remove(user, id);
  }
}
