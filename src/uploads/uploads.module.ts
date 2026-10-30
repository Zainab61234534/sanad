import { Module } from '@nestjs/common';
import { UploadsService } from './uploads.service.js';

@Module({
  providers: [UploadsService]
})
export class UploadsModule {}
