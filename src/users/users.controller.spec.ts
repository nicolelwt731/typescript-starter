import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

const mockUser = (id = 1): User => ({ id, name: 'Alice', events: [] }) as User;

describe('UsersController', () => {
  let controller: UsersController;

  const usersService = {
    create: jest.fn(),
    findOne: jest.fn(),
    mergeAll: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    jest.clearAllMocks();
  });

  it('create calls service and returns user', async () => {
    const user = mockUser();
    usersService.create.mockResolvedValue(user);

    const result = await controller.create({ name: 'Alice' });

    expect(usersService.create).toHaveBeenCalledWith({ name: 'Alice' });
    expect(result).toBe(user);
  });

  it('findOne returns user', async () => {
    const user = mockUser();
    usersService.findOne.mockResolvedValue(user);

    const result = await controller.findOne(1);

    expect(usersService.findOne).toHaveBeenCalledWith(1);
    expect(result).toBe(user);
  });

  it('mergeAll calls service mergeAll', async () => {
    usersService.mergeAll.mockResolvedValue([]);

    const result = await controller.mergeAll(1);

    expect(usersService.mergeAll).toHaveBeenCalledWith(1);
    expect(result).toEqual([]);
  });
});
