import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../dist/generated/prisma/client.js';


(async () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  await prisma.user.upsert({
    where: { email: 'admin@sanad.local' },
    update: {},
    create: { email: 'admin@sanad.local', fullName: 'Admin', role: 'ADMIN',
              passwordHash: await bcrypt.hash('Admin@12345', 12) },
  });
  await prisma.$disconnect();
})();