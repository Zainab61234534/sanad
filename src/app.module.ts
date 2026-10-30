import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { createObserveModule } from '@nestjs/observe';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { UploadsModule } from './uploads/uploads.module.js';
import { ProgramsModule } from './programs/programs.module.js';
import { SessionsModule } from './sessions/sessions.module.js';
import { ApplicationsModule } from './applications/applications.module.js';
import { AnnouncementsModule } from './announcements/announcements.module.js';
import { MaterialsModule } from './materials/materials.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { AppCacheModule } from './common/cache/app-cache.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 100,
        skipIf: () => process.env.THROTTLE_DISABLED === 'true',
      },
    ]),
   ConfigModule.forRoot({
     isGlobal: true,
     envFilePath: ['../.env', '.env'],
   }),
   PrismaModule,
   AppCacheModule,
   // Distributed tracing, auto-correlated logs, request/job metrics, error
   // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
   ObserveModule.forRoot({
     appKey: process.env.OBSERVE_APP_KEY,
     appSecret: process.env.OBSERVE_APP_SECRET,
     serviceId: 'sanad-youth',
   }),
   ProgramsModule,
   SessionsModule,
   ApplicationsModule,
   AnnouncementsModule,
   MaterialsModule,
   UploadsModule,
   AuthModule,
   UsersModule,
 ],
 controllers: [],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
