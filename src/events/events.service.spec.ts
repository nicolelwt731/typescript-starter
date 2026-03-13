import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { EventsService } from './events.service';
import { Event, EventStatus } from './entities/event.entity';
import { User } from '../users/entities/user.entity';

const mockUser = (id: number, name: string): User =>
  ({ id, name, events: [] }) as User;

const mockEvent = (id: number, overrides: Partial<Event> = {}): Event =>
  ({
    id,
    title: `Event ${id}`,
    description: '',
    status: EventStatus.TODO,
    startTime: new Date('2024-01-01T14:00:00Z'),
    endTime: new Date('2024-01-01T15:00:00Z'),
    invitees: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Event;

describe('EventsService', () => {
  let service: EventsService;

  const eventRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findBy: jest.fn(),
    remove: jest.fn(),
    delete: jest.fn(),
  };

  const userRepo = {
    findBy: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: getRepositoryToken(Event), useValue: eventRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates an event without invitees', async () => {
      const dto = {
        title: 'Test',
        status: EventStatus.TODO,
        startTime: '2024-01-01T14:00:00Z',
        endTime: '2024-01-01T15:00:00Z',
      };
      const event = mockEvent(1, { title: 'Test', invitees: [] });
      eventRepo.create.mockReturnValue(event);
      eventRepo.save.mockResolvedValue(event);

      const result = await service.create(dto);

      expect(eventRepo.create).toHaveBeenCalled();
      expect(eventRepo.save).toHaveBeenCalledWith(event);
      expect(result).toBe(event);
    });

    it('attaches invitees when inviteeIds provided', async () => {
      const user = mockUser(1, 'Alice');
      const dto = {
        title: 'Party',
        status: EventStatus.TODO,
        startTime: '2024-01-01T14:00:00Z',
        endTime: '2024-01-01T15:00:00Z',
        inviteeIds: [1],
      };
      const event = mockEvent(1, { title: 'Party', invitees: [user] });
      eventRepo.create.mockReturnValue(event);
      userRepo.findBy.mockResolvedValue([user]);
      eventRepo.save.mockResolvedValue(event);

      const result = await service.create(dto);

      expect(userRepo.findBy).toHaveBeenCalled();
      expect(result.invitees).toContain(user);
    });
  });

  describe('findOne', () => {
    it('returns an event when found', async () => {
      const event = mockEvent(1);
      eventRepo.findOne.mockResolvedValue(event);
      const result = await service.findOne(1);
      expect(result).toBe(event);
    });

    it('throws NotFoundException when not found', async () => {
      eventRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('removes the event', async () => {
      const event = mockEvent(1);
      eventRepo.findOne.mockResolvedValue(event);
      eventRepo.remove.mockResolvedValue(undefined);

      await service.remove(1);

      expect(eventRepo.remove).toHaveBeenCalledWith(event);
    });

    it('throws NotFoundException if event not found', async () => {
      eventRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('mergeAllForUser', () => {
    it('throws NotFoundException if user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.mergeAllForUser(99)).rejects.toThrow(NotFoundException);
    });

    it('returns empty array when user has no events', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, name: 'Alice', events: [] });
      const result = await service.mergeAllForUser(1);
      expect(result).toEqual([]);
    });

    it('returns events unchanged when none overlap', async () => {
      const e1 = mockEvent(1, {
        startTime: new Date('2024-01-01T14:00:00Z'),
        endTime: new Date('2024-01-01T15:00:00Z'),
      });
      const e2 = mockEvent(2, {
        startTime: new Date('2024-01-01T16:00:00Z'),
        endTime: new Date('2024-01-01T17:00:00Z'),
      });
      userRepo.findOne.mockResolvedValue({ id: 1, events: [e1, e2] });

      const result = await service.mergeAllForUser(1);

      expect(result).toHaveLength(2);
      expect(eventRepo.delete).not.toHaveBeenCalled();
    });

    it('merges two overlapping events', async () => {
      const userA = mockUser(1, 'Alice');
      const userB = mockUser(2, 'Bob');

      const e1 = mockEvent(1, {
        title: 'E1',
        description: 'desc1',
        status: EventStatus.TODO,
        startTime: new Date('2024-01-01T14:00:00Z'),
        endTime: new Date('2024-01-01T15:00:00Z'),
        invitees: [userA],
      });
      const e2 = mockEvent(2, {
        title: 'E2',
        description: 'desc2',
        status: EventStatus.IN_PROGRESS,
        startTime: new Date('2024-01-01T14:45:00Z'),
        endTime: new Date('2024-01-01T16:00:00Z'),
        invitees: [userB],
      });

      userRepo.findOne
        .mockResolvedValueOnce({ id: 1, events: [e1, e2] }) // initial user load
        .mockResolvedValueOnce({ id: 1, events: [e1, e2] }) // alice update
        .mockResolvedValueOnce({ id: 2, events: [e1, e2] }); // bob update

      eventRepo.delete.mockResolvedValue(undefined);
      const merged = mockEvent(3, {
        title: 'E1 | E2',
        status: EventStatus.IN_PROGRESS,
        startTime: new Date('2024-01-01T14:00:00Z'),
        endTime: new Date('2024-01-01T16:00:00Z'),
        invitees: [userA, userB],
      });
      eventRepo.create.mockReturnValue(merged);
      eventRepo.save.mockResolvedValue(merged);
      userRepo.save.mockResolvedValue({});

      const result = await service.mergeAllForUser(1);

      expect(eventRepo.delete).toHaveBeenCalledWith([1, 2]);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('E1 | E2');
      expect(result[0].status).toBe(EventStatus.IN_PROGRESS);
    });

    it('picks COMPLETED as highest status', async () => {
      const e1 = mockEvent(1, {
        status: EventStatus.TODO,
        startTime: new Date('2024-01-01T14:00:00Z'),
        endTime: new Date('2024-01-01T15:00:00Z'),
        invitees: [],
      });
      const e2 = mockEvent(2, {
        status: EventStatus.COMPLETED,
        startTime: new Date('2024-01-01T14:30:00Z'),
        endTime: new Date('2024-01-01T16:00:00Z'),
        invitees: [],
      });

      userRepo.findOne.mockResolvedValueOnce({ id: 1, events: [e1, e2] });
      eventRepo.delete.mockResolvedValue(undefined);
      const merged = mockEvent(3, {
        status: EventStatus.COMPLETED,
        startTime: new Date('2024-01-01T14:00:00Z'),
        endTime: new Date('2024-01-01T16:00:00Z'),
        invitees: [],
      });
      eventRepo.create.mockReturnValue(merged);
      eventRepo.save.mockResolvedValue(merged);

      const result = await service.mergeAllForUser(1);
      expect(result[0].status).toBe(EventStatus.COMPLETED);
    });
  });
});
