import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { EventsModule } from '../src/events/events.module';
import { UsersModule } from '../src/users/users.module';
import { Event } from '../src/events/entities/event.entity';
import { User } from '../src/users/entities/user.entity';
import { EventStatus } from '../src/events/entities/event.entity';

describe('Events & Users (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [Event, User],
          synchronize: true,
        }),
        EventsModule,
        UsersModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /users', () => {
    it('creates a user', async () => {
      const res = await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'Alice' })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('Alice');
    });
  });

  describe('POST /events', () => {
    it('creates an event', async () => {
      const res = await request(app.getHttpServer())
        .post('/events')
        .send({
          title: 'Meeting',
          status: EventStatus.TODO,
          startTime: '2024-01-01T14:00:00.000Z',
          endTime: '2024-01-01T15:00:00.000Z',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('Meeting');
    });

    it('rejects missing title', () => {
      return request(app.getHttpServer())
        .post('/events')
        .send({ status: EventStatus.TODO, startTime: '2024-01-01T14:00:00.000Z', endTime: '2024-01-01T15:00:00.000Z' })
        .expect(400);
    });
  });

  describe('GET /events/:id', () => {
    it('returns the event', async () => {
      const create = await request(app.getHttpServer())
        .post('/events')
        .send({ title: 'Stand-up', status: EventStatus.TODO, startTime: '2024-01-01T09:00:00.000Z', endTime: '2024-01-01T09:30:00.000Z' });

      const res = await request(app.getHttpServer())
        .get(`/events/${create.body.id}`)
        .expect(200);

      expect(res.body.title).toBe('Stand-up');
    });

    it('returns 404 for unknown id', () => {
      return request(app.getHttpServer()).get('/events/9999').expect(404);
    });
  });

  describe('DELETE /events/:id', () => {
    it('deletes event and returns 204', async () => {
      const create = await request(app.getHttpServer())
        .post('/events')
        .send({ title: 'ToDelete', status: EventStatus.TODO, startTime: '2024-01-01T10:00:00.000Z', endTime: '2024-01-01T11:00:00.000Z' });

      await request(app.getHttpServer())
        .delete(`/events/${create.body.id}`)
        .expect(204);

      await request(app.getHttpServer()).get(`/events/${create.body.id}`).expect(404);
    });
  });

  describe('POST /users/:userId/merge-events', () => {
    it('merges overlapping events for a user', async () => {
      // Create user
      const userRes = await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'Bob' });
      const userId = userRes.body.id;

      // Create overlapping events with this user as invitee
      const e1 = await request(app.getHttpServer())
        .post('/events')
        .send({
          title: 'E1',
          status: EventStatus.TODO,
          startTime: '2024-06-01T14:00:00.000Z',
          endTime: '2024-06-01T15:00:00.000Z',
          inviteeIds: [userId],
        });

      const e2 = await request(app.getHttpServer())
        .post('/events')
        .send({
          title: 'E2',
          status: EventStatus.IN_PROGRESS,
          startTime: '2024-06-01T14:45:00.000Z',
          endTime: '2024-06-01T16:00:00.000Z',
          inviteeIds: [userId],
        });

      expect(e1.status).toBe(201);
      expect(e2.status).toBe(201);

      const res = await request(app.getHttpServer())
        .post(`/users/${userId}/merge-events`)
        .expect(201);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('E1 | E2');
      expect(res.body[0].status).toBe(EventStatus.IN_PROGRESS);

      // Originals should be gone
      await request(app.getHttpServer()).get(`/events/${e1.body.id}`).expect(404);
      await request(app.getHttpServer()).get(`/events/${e2.body.id}`).expect(404);
    });

    it('returns 404 for unknown user', () => {
      return request(app.getHttpServer())
        .post('/users/9999/merge-events')
        .expect(404);
    });
  });
});
