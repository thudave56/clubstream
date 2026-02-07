# Clubstream

Live stream volleyball matches to YouTube with one tap. No technical knowledge required.

Clubstream is a web application for club volleyball teams to live stream and score matches to a shared YouTube channel. Parents can create a match, open Larix Broadcaster on their phone, and start streaming without handling YouTube credentials or complex settings.

## Features

- Admin dashboard with PIN authentication and session management
- YouTube OAuth connect/disconnect for a shared club channel
- Stream pool initialization and status (pre-created YouTube streams)
- Match creation flow (team, opponent, tournament, court, scheduled start)
- Larix launcher links and QR code support
- Live scoring UI and overlay pages
- Rate limiting for admin login endpoints
- Audit logging for admin actions
- Render deployment support via `render.yaml` Blueprint (web + Postgres)

## Quick Start

### Prerequisites

- Node.js 20.x to 22.x (tested on 22.13.1)
- PostgreSQL

### Installation

```bash
git clone https://github.com/thudave56/clubstream.git
cd clubstream
npm install
cp .env.example .env
```

Edit `.env` and set at minimum:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/clubstream"
APP_BASE_URL="http://localhost:3000"

# Optional: default admin PIN used by db:seed (defaults to "1234")
DEFAULT_ADMIN_PIN="1234"

# Google OAuth
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"

# Generate with: openssl rand -hex 32
ENCRYPTION_KEY="your-64-character-hex-string"
```

Initialize the database:

```bash
npm run db:migrate
npm run db:seed
```

Start the dev server:

```bash
npm run dev
```

Admin login: `http://localhost:3000/admin` (PIN defaults to `1234` after seeding).

## Google Cloud Setup (YouTube OAuth)

1. Create or select a Google Cloud project.
2. Enable "YouTube Data API v3".
3. Create OAuth 2.0 credentials (Web application).
4. Add Authorized redirect URIs:
   - Development: `http://localhost:3000/api/admin/oauth/callback`
   - Staging/Production: `https://<your-app-host>/api/admin/oauth/callback`
5. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

Notes:
- On Render, the app will use `RENDER_EXTERNAL_URL` as the base URL if `APP_BASE_URL` is not set.

## Deployment (Render)

This repo includes a Render Blueprint in `render.yaml`.

Typical required environment variables on the Render web service:
- `DATABASE_URL` (from Render Postgres)
- `ENCRYPTION_KEY` (64 hex chars)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- Optional: `APP_BASE_URL` (use if you want redirects to a custom domain)

## Troubleshooting

### Parent quick start

See `docs/runbooks/parent-quickstart.md`.

### Database connection issues

- Verify `DATABASE_URL` is correct.
- Ensure Postgres is running.

### Tests failing

- E2E tests may require the Next dev server (depends on Playwright config).
- Clear the Next cache: delete `.next`.
- In CI and non-production, YouTube API calls are automatically mocked when Google OAuth env vars are not provided.

### Admin login not working

- Verify `npm run db:seed` ran successfully.
- Check the `admin_settings` table exists and has a row with `id = 1`.

## License

Private repository.
