import { Test, TestingModule } from '@nestjs/testing';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { Event, EventStatus } from './entities/event.entity';
import { CreateEventDto } from './dto/create-event.dto';

const mockEvent = (id = 1): Event =>
  ({
    id,
    title: 'Test Event',
    description: 'desc',
    status: EventStatus.TODO,
    startTime: new Date('2024-01-01T14:00:00Z'),
    endTime: new Date('2024-01-01T15:00:00Z'),
    invitees: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }) as Event;

describe('EventsController', () => {
  let controller: EventsController;

  const eventsService = {
    create: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [{ provide: EventsService, useValue: eventsService }],
    }).compile();

    controller = module.get<EventsController>(EventsController);
    jest.clearAllMocks();
  });

  it('create calls service and returns event', async () => {
    const dto: CreateEventDto = {
      title: 'Test Event',
      status: EventStatus.TODO,
      startTime: '2024-01-01T14:00:00Z',
      endTime: '2024-01-01T15:00:00Z',
    };
    const event = mockEvent();
    eventsService.create.mockResolvedValue(event);

    const result = await controller.create(dto);

    expect(eventsService.create).toHaveBeenCalledWith(dto);
    expect(result).toBe(event);
  });

  it('findOne returns the event', async () => {
    const event = mockEvent();
    eventsService.findOne.mockResolvedValue(event);

    const result = await controller.findOne(1);

    expect(eventsService.findOne).toHaveBeenCalledWith(1);
    expect(result).toBe(event);
  });

  it('remove calls service remove', async () => {
    eventsService.remove.mockResolvedValue(undefined);

    await controller.remove(1);

    expect(eventsService.remove).toHaveBeenCalledWith(1);
  });
});
