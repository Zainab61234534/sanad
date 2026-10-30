import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RegisterDto } from '../auth/dto/register.dto.js';
import { Roles } from '../common/decorators/index.js';
import { Role } from '../common/enums/role.enum.js';
import { UsersService } from './users.service.js';

@ApiTags('admin')
@Roles(Role.ADMIN)
@Controller('admin/supervisors')
export class AdminSupervisorsController {
  constructor(private readonly users: UsersService) {}

  @Post()
  create(@Body() dto: RegisterDto) {
    return this.users.createSupervisor(dto);
  }

  @Get()
  list() {
    return this.users.findSupervisors();
  }
}
