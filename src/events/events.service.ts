import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Event, EventStatus } from './entities/event.entity';
import { User } from '../users/entities/user.entity';
import { CreateEventDto } from './dto/create-event.dto';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(dto: CreateEventDto): Promise<Event> {
    const event = this.eventRepository.create({
      title: dto.title,
      description: dto.description,
      status: dto.status,
      startTime: new Date(dto.startTime),
      endTime: new Date(dto.endTime),
    });

    if (dto.inviteeIds?.length) {
      event.invitees = await this.userRepository.findBy({
        id: In(dto.inviteeIds),
      });
    } else {
      event.invitees = [];
    }

    return this.eventRepository.save(event);
  }

  async findOne(id: number): Promise<Event> {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: ['invitees'],
    });
    if (!event) {
      throw new NotFoundException(`Event #${id} not found`);
    }
    return event;
  }

  async remove(id: number): Promise<void> {
    const event = await this.findOne(id);
    await this.eventRepository.remove(event);
  }

  /**
   * Merge all overlapping events for a given user.
   * Overlapping = two events whose time ranges intersect.
   * Merged event:
   *   - startTime = min of group
   *   - endTime   = max of group
   *   - title     = joined titles
   *   - description = joined descriptions
   *   - status    = highest (COMPLETED > IN_PROGRESS > TODO)
   *   - invitees  = union of all invitees
   * Deletes the original events and replaces them in the DB.
   */
  async mergeAllForUser(userId: number): Promise<Event[]> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['events', 'events.invitees'],
    });
    if (!user) {
      throw new NotFoundException(`User #${userId} not found`);
    }

    const events = user.events ?? [];
    if (events.length === 0) return [];

    // Sort by startTime
    const sorted = [...events].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );

    // Group overlapping events using interval-merge logic
    const groups: Event[][] = [];
    let current: Event[] = [sorted[0]];
    let maxEnd = new Date(sorted[0].endTime).getTime();

    for (let i = 1; i < sorted.length; i++) {
      const e = sorted[i];
      const start = new Date(e.startTime).getTime();
      if (start < maxEnd) {
        // Overlapping
        current.push(e);
        maxEnd = Math.max(maxEnd, new Date(e.endTime).getTime());
      } else {
        groups.push(current);
        current = [e];
        maxEnd = new Date(e.endTime).getTime();
      }
    }
    groups.push(current);

    const mergedEvents: Event[] = [];

    for (const group of groups) {
      if (group.length === 1) {
        mergedEvents.push(group[0]);
        continue;
      }

      // Build merged event
      const titles = group.map((e) => e.title).join(' | ');
      const descriptions = group
        .map((e) => e.description)
        .filter(Boolean)
        .join(' | ');
      const startTime = new Date(
        Math.min(...group.map((e) => new Date(e.startTime).getTime())),
      );
      const endTime = new Date(
        Math.max(...group.map((e) => new Date(e.endTime).getTime())),
      );
      const status = this.pickHighestStatus(group.map((e) => e.status));

      // Union of all invitees (by id)
      const inviteeMap = new Map<number, User>();
      for (const e of group) {
        for (const invitee of e.invitees ?? []) {
          inviteeMap.set(invitee.id, invitee);
        }
      }
      const invitees = Array.from(inviteeMap.values());

      // Delete originals
      const originalIds = group.map((e) => e.id);
      await this.eventRepository.delete(originalIds);

      // Create merged event
      const merged = this.eventRepository.create({
        title: titles,
        description: descriptions || undefined,
        status,
        startTime,
        endTime,
        invitees,
      });
      const saved = await this.eventRepository.save(merged);
      mergedEvents.push(saved);

      // Update each user's events list: remove originals, add merged
      for (const invitee of invitees) {
        const u = await this.userRepository.findOne({
          where: { id: invitee.id },
          relations: ['events'],
        });
        if (!u) continue;
        u.events = (u.events ?? []).filter((ev) => !originalIds.includes(ev.id));
        u.events.push(saved);
        await this.userRepository.save(u);
      }
    }

    return mergedEvents;
  }

  private pickHighestStatus(statuses: EventStatus[]): EventStatus {
    if (statuses.includes(EventStatus.COMPLETED)) return EventStatus.COMPLETED;
    if (statuses.includes(EventStatus.IN_PROGRESS)) return EventStatus.IN_PROGRESS;
    return EventStatus.TODO;
  }
}
