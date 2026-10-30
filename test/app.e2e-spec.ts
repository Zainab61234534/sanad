import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { ApplicationStatus } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const PASSWORD = 'E2e@12345';
const suffix = Date.now();
const emails = {
  admin: `e2e.admin.${suffix}@sanad.local`,
  supervisor: `e2e.supervisor.${suffix}@sanad.local`,
  youth1: `e2e.youth1.${suffix}@sanad.local`,
  youth2: `e2e.youth2.${suffix}@sanad.local`,
  createdSupervisor: `e2e.created.${suffix}@sanad.local`,
};

describe('Sanad core flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let adminId: string;
  let supervisorId: string;
  let youth1Id: string;
  let youth2Id: string;
  let createdSupervisorId: string | undefined;
  let programId: string;

  let adminToken: string;
  let supervisorToken: string;
  let youth1Token: string;
  let youth2Token: string;

  const http = () => app.getHttpServer();

  async function login(email: string): Promise<string> {
    const res = await request(http())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    process.env.THROTTLE_DISABLED = 'true';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = moduleFixture.get(PrismaService);

    const passwordHash = await bcrypt.hash(PASSWORD, 4);
    const [admin, supervisor, youth1, youth2] = await Promise.all([
      prisma.user.create({
        data: {
          email: emails.admin,
          passwordHash,
          fullName: 'E2E Admin',
          role: 'ADMIN',
        },
      }),
      prisma.user.create({
        data: {
          email: emails.supervisor,
          passwordHash,
          fullName: 'E2E Supervisor',
          role: 'SUPERVISOR',
        },
      }),
      prisma.user.create({
        data: {
          email: emails.youth1,
          passwordHash,
          fullName: 'E2E Youth One',
          role: 'YOUTH',
        },
      }),
      prisma.user.create({
        data: {
          email: emails.youth2,
          passwordHash,
          fullName: 'E2E Youth Two',
          role: 'YOUTH',
        },
      }),
    ]);

    adminId = admin.id;
    supervisorId = supervisor.id;
    youth1Id = youth1.id;
    youth2Id = youth2.id;

    const program = await prisma.program.create({
      data: {
        title: 'E2E Program',
        description: 'E2E program used to test the last-seat race',
        capacity: 1,
        supervisorId: supervisor.id,
      },
    });
    programId = program.id;

    [adminToken, supervisorToken, youth1Token, youth2Token] = await Promise.all([
      login(emails.admin),
      login(emails.supervisor),
      login(emails.youth1),
      login(emails.youth2),
    ]);
  }, 30_000);

  afterAll(async () => {
    if (prisma) {
      if (supervisorId) {
        await prisma.program.deleteMany({ where: { supervisorId } });
      }
      const ids = [
        adminId,
        supervisorId,
        youth1Id,
        youth2Id,
        createdSupervisorId,
      ].filter((id): id is string => Boolean(id));
      await prisma.user.deleteMany({
        where: {
          OR: [
            ...(ids.length ? [{ id: { in: ids } }] : []),
            { email: { in: Object.values(emails) } },
          ],
        },
      });
    }
    await app?.close();
  }, 30_000);

  it('lists and details published programs', async () => {
    const list = await request(http())
      .get('/api/programs?page=1&limit=10')
      .expect(200);

    expect(
      list.body.items.some((program: { id: string }) => program.id === programId),
    ).toBe(true);

    const detail = await request(http())
      .get(`/api/programs/${programId}`)
      .expect(200);

    expect(detail.body.remainingSeats).toBe(1);
  });

  it('enforces role-based access', async () => {
    await request(http())
      .get('/api/admin/applications')
      .set('Authorization', `Bearer ${youth1Token}`)
      .expect(403);

    await request(http())
      .post('/api/supervisor/programs')
      .set('Authorization', `Bearer ${youth1Token}`)
      .send({
        title: 'Not allowed',
        description: 'This request must be rejected by the role guard',
        capacity: 1,
      })
      .expect(403);
  });

  it('blocks mass assignment on program update', async () => {
    await request(http())
      .patch(`/api/supervisor/programs/${programId}`)
      .set('Authorization', `Bearer ${supervisorToken}`)
      .send({ supervisorId: adminId })
      .expect(400);
  });

  it('reserves the last seat exactly once under concurrent applications', async () => {
    const apply = (token: string) =>
      request(http())
        .post(`/api/programs/${programId}/applications`)
        .set('Authorization', `Bearer ${token}`)
        .field('note', 'e2e');

    const [first, second] = await Promise.all([
      apply(youth1Token),
      apply(youth2Token),
    ]);

    expect([first.status, second.status].sort()).toEqual([201, 409]);

    const program = await prisma.program.findUniqueOrThrow({
      where: { id: programId },
    });
    expect(program.reservedSeats).toBe(1);
  }, 15_000);

  it('accepts an application and returns the seat when the youth cancels', async () => {
    const application = await prisma.application.findFirstOrThrow({
      where: { programId, status: ApplicationStatus.PENDING },
    });
    const ownerToken =
      application.userId === youth1Id ? youth1Token : youth2Token;

    await request(http())
      .patch(`/api/admin/applications/${application.id}/accept`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ note: 'ok' })
      .expect(200);

    let program = await prisma.program.findUniqueOrThrow({
      where: { id: programId },
    });
    expect(program.reservedSeats).toBe(1);

    await request(http())
      .patch(`/api/applications/${application.id}/cancel`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    program = await prisma.program.findUniqueOrThrow({
      where: { id: programId },
    });
    expect(program.reservedSeats).toBe(0);
  });

  it('rejects a new application and returns the seat', async () => {
    const canceled = await prisma.application.findFirstOrThrow({
      where: { programId, status: ApplicationStatus.CANCELED },
    });
    const otherToken =
      canceled.userId === youth1Id ? youth2Token : youth1Token;

    await request(http())
      .post(`/api/programs/${programId}/applications`)
      .set('Authorization', `Bearer ${otherToken}`)
      .field('note', 'e2e')
      .expect(201);

    const pending = await prisma.application.findFirstOrThrow({
      where: { programId, status: ApplicationStatus.PENDING },
    });

    await request(http())
      .patch(`/api/admin/applications/${pending.id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ note: 'no' })
      .expect(200);

    const program = await prisma.program.findUniqueOrThrow({
      where: { id: programId },
    });
    expect(program.reservedSeats).toBe(0);
  });

  it('lets an admin create a supervisor', async () => {
    const res = await request(http())
      .post('/api/admin/supervisors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: emails.createdSupervisor,
        password: PASSWORD,
        fullName: 'E2E Created Supervisor',
      })
      .expect(201);

    expect(res.body.role).toBe('SUPERVISOR');
    createdSupervisorId = res.body.id as string;
  });
});
