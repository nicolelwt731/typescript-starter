# NestJS Event Management API

A NestJS REST API for managing **Events** and **Users**, built on the [NestJS TypeScript starter](https://github.com/nestjs/typescript-starter).

## Prerequisites

- Node.js >= 20
- npm >= 10

No external database setup required — the app uses **SQLite** (file `events.db` in the project root), which is created automatically on first run.

## Installation

```bash
npm install
```

## Running the Project

```bash
# development (watch mode — recommended)
npm run start:dev

# single run
npm run start

# production build
npm run build && npm run start:prod
```

The server starts on **http://localhost:3000**.

## Running Tests

```bash
# unit tests (uses mocks, no DB required)
npm test

# unit tests with coverage report
npm run test:cov

# integration / e2e tests (uses in-memory SQLite, no setup required)
npm run test:e2e
```

Expected output:

```
# Unit tests
Test Suites: 5 passed, 5 total
Tests:       22 passed, 22 total

# E2E tests
Test Suites: 2 passed, 2 total
Tests:       9 passed, 9 total
```

---

## API Reference

### Users

| Method | Path | Body | Description |
|--------|------|------|-------------|
| `POST` | `/users` | `{ "name": "string" }` | Create a user |
| `GET` | `/users/:id` | — | Get user by id |
| `POST` | `/users/:userId/merge-events` | — | Merge all overlapping events for a user |

### Events

| Method | Path | Body | Description |
|--------|------|------|-------------|
| `POST` | `/events` | see below | Create an event |
| `GET` | `/events/:id` | — | Get event by id |
| `DELETE` | `/events/:id` | — | Delete event by id (returns 204) |

**Create Event body:**

```json
{
  "title": "string (required)",
  "description": "string (optional)",
  "status": "TODO | IN_PROGRESS | COMPLETED (required)",
  "startTime": "ISO 8601 datetime (required)",
  "endTime": "ISO 8601 datetime (required)",
  "inviteeIds": [1, 2]
}
```

---

## Example Walkthrough

```bash
# 1. Create two users
curl -X POST http://localhost:3000/users \
  -H 'Content-Type: application/json' \
  -d '{"name": "Alice"}'
# → { "id": 1, "name": "Alice" }

curl -X POST http://localhost:3000/users \
  -H 'Content-Type: application/json' \
  -d '{"name": "Bob"}'
# → { "id": 2, "name": "Bob" }

# 2. Create two overlapping events
curl -X POST http://localhost:3000/events \
  -H 'Content-Type: application/json' \
  -d '{"title":"E1","status":"TODO","startTime":"2024-06-01T14:00:00.000Z","endTime":"2024-06-01T15:00:00.000Z","inviteeIds":[1]}'

curl -X POST http://localhost:3000/events \
  -H 'Content-Type: application/json' \
  -d '{"title":"E2","status":"IN_PROGRESS","startTime":"2024-06-01T14:45:00.000Z","endTime":"2024-06-01T16:00:00.000Z","inviteeIds":[2]}'

# 3. Merge overlapping events for user 1
curl -X POST http://localhost:3000/users/1/merge-events
# → [{ "title": "E1 | E2", "startTime": "14:00", "endTime": "16:00", "status": "IN_PROGRESS", "invitees": [Alice, Bob] }]
```

---

## MergeAll Logic

`POST /users/:userId/merge-events` finds all events the user is invited to, groups overlapping ones (A overlaps B when `A.startTime < B.endTime && B.startTime < A.endTime`), and for each group:

- `startTime` = earliest start in the group
- `endTime` = latest end in the group
- `title` / `description` = all values joined with ` | `
- `status` = highest priority (`COMPLETED` > `IN_PROGRESS` > `TODO`)
- `invitees` = union of all invitees

The original events are **deleted** from the database and replaced by the merged event. All affected users' event lists are updated accordingly.

## License

MIT
