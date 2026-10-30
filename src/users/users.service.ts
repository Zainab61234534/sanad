import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from '../auth/dto/register.dto.js';
import { Role } from '../generated/prisma/enums.js';
import * as bcrypt from 'bcrypt';
import { Prisma } from '../generated/prisma/client.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    try {
      return await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase(),
          fullName: dto.fullName,
          phone: dto.phone,
          passwordHash: await bcrypt.hash(dto.password, 12),
          role: Role.YOUTH,
        },
        select: SAFE_USER_SELECT,
      });
    } catch (error) {
      this.throwIfEmailAlreadyExists(error);
      throw error;
    }
  }

  async createSupervisor(dto: RegisterDto) {
    try {
      return await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase(),
          fullName: dto.fullName,
          phone: dto.phone,
          passwordHash: await bcrypt.hash(dto.password, 12),
          role: Role.SUPERVISOR,
        },
        select: SAFE_USER_SELECT,
      });
    } catch (error) {
      this.throwIfEmailAlreadyExists(error);
      throw error;
    }
  }

  findAll() {
    return this.prisma.user.findMany({
      select: SAFE_USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  findSupervisors() {
    return this.prisma.user.findMany({
      where: { role: Role.SUPERVISOR },
      select: SAFE_USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: SAFE_USER_SELECT,
    });
    if (!user) throw new NotFoundException('المستخدم غير موجود');
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    try {
      return await this.prisma.user.update({
        where: { id },
        data: {
          ...(dto.email === undefined ? {} : { email: dto.email.toLowerCase() }),
          ...(dto.fullName === undefined ? {} : { fullName: dto.fullName }),
          ...(dto.phone === undefined ? {} : { phone: dto.phone }),
        },
        select: SAFE_USER_SELECT,
      });
    } catch (error) {
      this.throwIfEmailAlreadyExists(error);
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('المستخدم غير موجود');
      }
      throw error;
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.user.delete({
        where: { id },
        select: SAFE_USER_SELECT,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('المستخدم غير موجود');
      }
      throw error;
    }
  }

  private throwIfEmailAlreadyExists(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('البريد الإلكتروني مستخدم مسبقًا');
    }
  }
}

export const SAFE_USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  createdAt: true,
};