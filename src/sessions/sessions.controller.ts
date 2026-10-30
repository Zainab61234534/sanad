import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../common/decorators/index.js';
import type { AuthUser } from '../common/decorators/index.js';
import { Role } from '../common/enums/role.enum.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { UpdateSessionDto } from './dto/update-session.dto.js';
import { SessionsService } from './sessions.service.js';

@ApiTags('supervisor')
@Roles(Role.SUPERVISOR)
@Controller('supervisor')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post('programs/:programId/sessions')
  create(
    @CurrentUser() user: AuthUser,
    @Param('programId', ParseUUIDPipe) programId: string,
    @Body() dto: CreateSessionDto,
  ) {
    return this.sessionsService.create(user, programId, dto);
  }

  @Patch('sessions/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSessionDto,
  ) {
    return this.sessionsService.update(user, id, dto);
  }

  @Delete('sessions/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.remove(user, id);
  }
}
