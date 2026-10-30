import { Module } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { AdminSupervisorsController } from './admin-supervisors.controller.js';

@Module({
  controllers: [AdminSupervisorsController],
  providers: [UsersService],
})
export class UsersModule {}
