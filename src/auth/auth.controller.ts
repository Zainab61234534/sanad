import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { CurrentUser, Public } from '../common/decorators/index.js';
import type { AuthUser } from '../common/decorators/index.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { RegisterDto } from './dto/register.dto.js';

@Controller('auth')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public() @Post('register')
  register(@Body() dto: RegisterDto) { return this.auth.register(dto); }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.auth.login(dto, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) { return this.auth.refresh(dto.refreshToken); }

  @HttpCode(200)
  @Post('logout')
  logout(@CurrentUser() u: AuthUser) { return this.auth.logout(u.id, u.sessionId); }

  @HttpCode(200)
  @Post('logout-all')
  logoutAll(@CurrentUser() u: AuthUser) { return this.auth.logoutAll(u.id); }

  @Get('sessions')
  sessions(@CurrentUser() u: AuthUser) { return this.auth.listSessions(u.id, u.sessionId); }

  @Delete('sessions/:id')
  revoke(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.auth.revokeSession(u.id, id);
  }

  @Get('me')
  me(@CurrentUser() u: AuthUser) {
    const { isActive: _isActive, sessionId: _sessionId, ...safe } = u;
    return safe;
  }
}
