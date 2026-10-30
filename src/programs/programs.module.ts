import { Module } from '@nestjs/common';
import { ProgramsController, SupervisorProgramsController } from './programs.controller.js';
import { ProgramsService } from './programs.service.js';


@Module({
  controllers: [ProgramsController , SupervisorProgramsController],
  providers: [ProgramsService],
})
export class ProgramsModule {}
