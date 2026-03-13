import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { EventsService } from '../events/events.service';

const mockUser = (id = 1): User => ({ id, name: 'Alice', events: [] }) as User;

describe('UsersService', () => {
  let service: UsersService;

  const userRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const eventsService = {
    mergeAllForUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: EventsService, useValue: eventsService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates and returns a user', async () => {
      const user = mockUser();
      userRepo.create.mockReturnValue(user);
      userRepo.save.mockResolvedValue(user);

      const result = await service.create({ name: 'Alice' });

      expect(userRepo.create).toHaveBeenCalledWith({ name: 'Alice', events: [] });
      expect(result).toBe(user);
    });
  });

  describe('findOne', () => {
    it('returns user when found', async () => {
      const user = mockUser();
      userRepo.findOne.mockResolvedValue(user);

      const result = await service.findOne(1);

      expect(result).toBe(user);
    });

    it('throws NotFoundException when not found', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('mergeAll', () => {
    it('delegates to eventsService.mergeAllForUser', async () => {
      eventsService.mergeAllForUser.mockResolvedValue([]);

      const result = await service.mergeAll(1);

      expect(eventsService.mergeAllForUser).toHaveBeenCalledWith(1);
      expect(result).toEqual([]);
    });
  });
});
