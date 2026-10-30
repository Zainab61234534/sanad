
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { RegisterDto } from './dto/register.dto.js';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client.js';
import { JwtService } from '@nestjs/jwt';

import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { Role } from '../generated/prisma/enums.js';
import { LoginDto } from './dto/login.dto.js';
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 12);
const newSecret = () => crypto.randomBytes(48).toString('base64url');

type ClientMeta = { ip?: string; userAgent?: string };

@Injectable()
export class AuthService {
  private readonly SAFE_USER_SELECT = {
    id: true,
    email: true,
    fullName: true,
    role: true,
    isActive: true,
  } as const;
  private readonly refreshTtlMs: number;

  constructor(private prisma: PrismaService, private jwt: JwtService, config: ConfigService) {
    this.refreshTtlMs = Number(config.get('REFRESH_TTL_DAYS') ?? 30) * 86_400_000;
  }

  private async sign(userId: string, role: Role, sessionId: string, secret: string) {
    return {
      accessToken: await this.jwt.signAsync({ sub: userId, sid: sessionId, role }),
      refreshToken: `${sessionId}.${secret}`,
    };
  }

  // ───────── التسجيل (بدون تغيير) ─────────
  async register(dto: RegisterDto) {
    try {
      return await this.prisma.user.create({
        data: { email: dto.email.toLowerCase(), fullName: dto.fullName, phone: dto.phone,
                passwordHash: await bcrypt.hash(dto.password, 12), role: Role.YOUTH },
        select: this.SAFE_USER_SELECT,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
        throw new ConflictException('البريد الإلكتروني مستخدم مسبقًا');
      throw e;
    }
  }

  // ───────── الدخول: إنشاء جلسة ─────────
  async login(dto: LoginDto, meta: ClientMeta) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    const valid = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !user.isActive || !valid) throw new UnauthorizedException('بيانات الدخول غير صحيحة');

    const secret = newSecret();
    const session = await this.prisma.authSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: sha256(secret),
        ip: meta.ip,
        userAgent: meta.userAgent?.slice(0, 255),
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
      },
    });
    return {
      ...(await this.sign(user.id, user.role, session.id, secret)),
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
    };
  }

  // ───────── التجديد: Rotation + كشف إعادة الاستخدام ─────────
  async refresh(token: string) {
    const [sid, secret] = token.split('.');
    if (!sid || !secret) throw new UnauthorizedException('Refresh Token غير صالح');

    const next = newSecret();
    // تحديث شرطي ذري: ينجح فقط إن كان الـ secret هو الحالي والجلسة سليمة، فلا يفوز طلبا تجديد متزامنان معًا
    const { count } = await this.prisma.authSession.updateMany({
      where: {
        id: sid,
        refreshTokenHash: sha256(secret),
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { is: { isActive: true } },
      },
      data: { refreshTokenHash: sha256(next), lastUsedAt: new Date() },
    });

    if (count === 0) {
      // جلسة سليمة لكن الـ secret غير مطابق = استخدام توكن قديم (سرقة محتملة): ألغِ الجلسة كاملة
      await this.prisma.authSession.updateMany({
        where: { id: sid, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh Token غير صالح، سجّل الدخول من جديد');
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: sid }, select: { user: { select: { id: true, role: true } } },
    });
    if (!session) throw new UnauthorizedException('Refresh Token غير صالح');
    return this.sign(session.user.id, session.user.role, sid, next);
  }

  // ───────── الجلسات: عرض وإلغاء ─────────
  async logout(userId: string, sessionId: string) {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
    return { success: true };
  }

  async logoutAll(userId: string) {
    const { count } = await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    return { revoked: count };
  }

  async listSessions(userId: string, currentSessionId: string) {
    const rows = await this.prisma.authSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
      select: { id: true, ip: true, userAgent: true, createdAt: true, lastUsedAt: true, expiresAt: true }, // لا hash أبدًا
    });
    return rows.map((row) => ({ ...row, current: row.id === currentSessionId }));
  }

  async revokeSession(userId: string, id: string) {
    const { count } = await this.prisma.authSession.updateMany({
      where: { id, userId, revokedAt: null }, data: { revokedAt: new Date() } });
    if (count === 0) throw new NotFoundException('الجلسة غير موجودة'); // لا يمكن إلغاء جلسة مستخدم آخر
    return { success: true };
  }
}