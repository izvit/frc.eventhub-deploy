# Calendar Management Backend

Minimal FastAPI backend for a basic event signup system.

## Features
- Users: `id`, `name`, `type`, `role`
- Events: `id`, `description`, `datetime`
- Endpoints to add/list/delete users and events

## Requirements
- Python 3.12+

## Install
Open PowerShell and run:

```powershell
python -m pip install --upgrade pip
pip install fastapi uvicorn sqlmodel
```

## Run (development)

```powershell
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Visit the interactive API docs at `http://127.0.0.1:8000/docs`.

## API (summary)
- `POST /users` — create a user
  - Body example: `{"name": "Alice", "type": "member", "role": "attendee"}`
- `GET /users` — list users
- `DELETE /users/{user_id}` — delete user

- `POST /events` — create an event
  - Body example: `{"description": "Team Meeting", "datetime": "2025-12-03T15:00:00"}`
- `GET /events` — list events
- `DELETE /events/{event_id}` — delete event

## Data
- The app uses SQLite and will create `calendar.db` in the project folder.

## Next ideas
- Add validation for `type`/`role`
- Add signup relationships between users and events
- Add tests and CI

---
Created for the `calendar_management/backend` project.
