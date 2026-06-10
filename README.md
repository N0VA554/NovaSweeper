# Novasweeper

Novasweeper is a neon black, red, blue, and purple Minesweeper web product built with:

- Frontend: Next.js, React, TypeScript
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL
- Shared package: board generation, reveal logic, score math, and shared types

## Structure

```text
apps/
  api/      Node.js API and PostgreSQL persistence
  web/      Next.js player experience
packages/
  shared/   Minesweeper domain logic and TypeScript contracts
```

## Run locally

```bash
cp .env.example .env
docker compose up -d
npm install
npm run dev:api
npm run dev:web
```

Open `http://localhost:3000`.

The API runs on `http://localhost:4000` and creates the required `scores` table on startup. PostgreSQL is exposed on host port `55432` to avoid conflicts with local PostgreSQL installs.
