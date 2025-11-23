# Experiment1
# To-Do + Reminders App

## Run locally
1. `npm install`
2. `npm start`
3. Open http://localhost:3000

## API
- `GET /api/todos` - list
- `POST /api/todos` - create `{title, notes?, due?}` (due ISO date string)
- `PUT /api/todos/:id` - update fields
- `DELETE /api/todos/:id`
- `GET /api/todos/:id/ics` - download calendar (.ics) event

## Persistence
Data persisted to `data.json` in repo root. On Render, this file is persisted per instance; for durable multi-instance persistence use a DB (Postgres, Mongo, etc).

## Reminders
- Server runs a scheduler (every minute) to mark reminders and log to console.
- Client will show browser notifications when items become due.
