import { Module } from '@nestjs/common';
import { AdminApplicationsController, ApplicationsController } from './applications.controller.js';
import { ApplicationsService } from './applications.service.js';


@Module({
  controllers: [ApplicationsController, AdminApplicationsController],
  providers: [ApplicationsService],
})
export class ApplicationsModule {}
