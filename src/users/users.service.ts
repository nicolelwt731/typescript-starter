import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { EventsService } from '../events/events.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly eventsService: EventsService,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const user = this.userRepository.create({ name: dto.name, events: [] });
    return this.userRepository.save(user);
  }

  async findOne(id: number): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['events'],
    });
    if (!user) throw new NotFoundException(`User #${id} not found`);
    return user;
  }

  async mergeAll(userId: number) {
    return this.eventsService.mergeAllForUser(userId);
  }
}
