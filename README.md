# 🏐 Clubstream

> **Live stream your volleyball matches to YouTube with one tap** — No technical knowledge required!

Clubstream is a web application designed for club volleyball teams to easily live stream and score matches to a shared YouTube channel. Parents can create a match, open Larix Broadcaster on their phone, and start streaming — all without handling YouTube credentials or complex settings.

---

## ✨ Features

- **🔐 Secure Admin Panel** - PIN-protected dashboard for managing streams and settings
- **📺 YouTube Integration** - Direct streaming to your club's YouTube channel *(Coming in PR #3)*
- **🎥 Stream Pool Management** - Pre-configured streams ready to use *(Coming in PR #4)*
- **📱 One-Tap Streaming** - Larix deep links configure everything automatically *(Coming in PR #6)*
- **📊 Live Scoring** - Real-time score updates with overlay support *(Coming in PR #7)*
- **🛡️ Rate Limiting** - Protection against brute force login attempts
- **📝 Audit Logging** - Track all admin actions for security

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 20.x - 22.x** (tested on 22.13.1)
- **PostgreSQL** database
- **npm** or **yarn**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/thudave56/clubstream.git
   cd clubstream
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and configure:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/clubstream"
   APP_BASE_URL="http://localhost:3000"

   # Optional: Set custom default admin PIN for seeding (defaults to "1234")
   DEFAULT_ADMIN_PIN="1234"
   ```

4. **Initialize database**
   ```bash
   npm run db:migrate    # Apply database schema
   npm run db:seed       # Add sample teams + default admin PIN
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   - Navigate to `http://localhost:3000`
   - Admin login: `http://localhost:3000/admin` (PIN: `1234`)

---

## 🎯 Default Credentials

⚠️ **Admin PIN:** `1234` (Development only - change in production!)

The default admin PIN is set during database seeding. You can customize it by:
- Setting `DEFAULT_ADMIN_PIN` environment variable before running `npm run db:seed`
- Updating the hash in the `admin_settings` table directly
- Or implementing a PIN change feature (future enhancement)

---

## 📚 Usage Guide

### For Admins

1. **Login to Admin Panel**
   - Visit `/admin`
   - Enter your PIN (default: `1234`)

2. **View Dashboard**
   - Check YouTube OAuth connection status
   - Monitor stream pool health (available/reserved/in_use/stuck)
   - Toggle security settings

3. **Configure Settings**
   - Enable/disable "Require PIN for Match Creation"
   - View audit logs (coming soon)

### For Parents (Coming Soon)

1. **Create a Match**
   - Select your team
   - Enter opponent name
   - Choose court and start time

2. **Open Larix**
   - Tap "Open Larix" button
   - App opens with pre-configured settings
   - Hit "Go Live"

3. **Score the Match** (Optional)
   - Use scoring interface to update scores
   - Scores appear on stream overlay in real-time

---

## 🛠️ Development

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:ui` | Run tests with interactive UI |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run test:e2e:ui` | Run E2E tests with UI mode |
| `npm run test:all` | Run all tests (unit + E2E) |
| `npm run db:generate` | Generate database migrations |
| `npm run db:migrate` | Push schema to database (dev mode) |
| `npm run db:seed` | Seed database with sample data |
| `npm run db:studio` | Open Drizzle Studio (database GUI) |

### Project Structure

```
clubstream/
├── app/                    # Next.js App Router (pages & API routes)
│   ├── admin/             # Admin panel pages
│   ├── api/               # API endpoints
│   ├── m/[id]/           # Match detail pages
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page
├── src/
│   ├── db/               # Database schema & utilities
│   └── lib/              # Utility functions (auth, sessions, rate limiting)
├── tests/
│   └── e2e/              # End-to-end tests
└── drizzle/              # Database migrations
```

### Tech Stack

- **Frontend:** Next.js 14.2 (App Router), React 18, Tailwind CSS
- **Backend:** Next.js API Routes, TypeScript
- **Database:** PostgreSQL with Drizzle ORM 0.36
- **Authentication:** Scrypt PIN hashing, HTTP-only cookies
- **Testing:** Vitest 1.6 (unit), Playwright 1.58 (E2E)
- **Validation:** Zod 3.23

---

## 🧪 Testing

### Run Tests Locally

```bash
# Unit tests
npm test

# E2E tests (requires dev server running)
npm run test:e2e

# All tests
npm run test:all
```

### CI/CD Pipeline

Tests run automatically on every commit and pull request:

1. ✅ **Unit Tests** - Fast utility function tests
2. ✅ **Lint** - Code quality checks
3. ✅ **Build** - TypeScript compilation
4. ✅ **E2E Tests** - Full integration tests

All tests must pass before merging to `main`.

---

## 📦 Database Schema

### Tables

- **teams** - Club volleyball teams (slug, display_name, enabled)
- **tournaments** - Tournament information
- **matches** - Match records (team vs opponent, status, YouTube links)
- **scores** - Set-based volleyball scoring (match_id, set_number, home/away scores)
- **stream_pool** - Pre-configured YouTube streams
- **admin_settings** - Singleton settings table (PINs, OAuth status)
- **audit_log** - Security audit trail
- **sessions** - Admin login sessions

### Key Design Decisions

- **Team + Opponent Model**: One club team (in database) vs external opponent (text field)
  - Prevents database bloat from one-time opponents
  - Clear ownership: "our team" vs "their team"

- **Set-Based Scoring**: Composite primary key (match_id, set_number)
  - Natural fit for volleyball (3-5 sets per match)
  - Atomic score updates

- **Dual PIN System**: Separate admin PIN and optional create PIN
  - Admin PIN: Always required for dashboard
  - Create PIN: Optional for match creation (toggle-able)

---

## 🔒 Security

### Admin Authentication

- **PIN Hashing**: Scrypt with random salt
- **Session Management**: HTTP-only secure cookies (24-hour expiry)
- **Rate Limiting**: 5 failed attempts per 15 minutes per IP
- **Audit Logging**: All admin actions tracked

### Rate Limiting

The system automatically blocks IP addresses after 5 failed login attempts for 15 minutes. Successful logins clear the counter.

---

## 🚀 Deployment

### Environment Variables (Production)

```env
DATABASE_URL="postgresql://..."        # Production database
APP_BASE_URL="https://yourdomain.com" # Production URL
NODE_ENV="production"                  # Enable production mode
DEFAULT_ADMIN_PIN="your-secure-pin"    # Custom admin PIN for seeding
```

### Deployment Checklist

- [ ] Set `DEFAULT_ADMIN_PIN` environment variable to a strong PIN before seeding
- [ ] Set `NODE_ENV=production`
- [ ] Use HTTPS for `APP_BASE_URL`
- [ ] Configure secure database connection
- [ ] Enable database backups
- [ ] Set up error monitoring (Sentry, etc.)
- [ ] Configure YouTube OAuth credentials *(PR #3)*

### Recommended Platforms

- **Vercel** - Zero-config Next.js hosting
- **Fly.io** - Full-stack with Postgres
- **Render** - Web services + databases
- **Railway** - Integrated hosting

---

## 📖 API Documentation

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/teams` | List all enabled teams |
| `GET` | `/api/matches?date=YYYY-MM-DD` | Get matches for a date |

### Admin Endpoints (Protected)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/admin/login` | Authenticate with PIN |
| `POST` | `/api/admin/logout` | End admin session |
| `GET` | `/api/admin/settings` | Get admin settings |
| `PATCH` | `/api/admin/settings` | Update settings |

---

## 🗺️ Roadmap

### ✅ Completed (PR #1 & #2)

- [x] Next.js scaffold with Tailwind CSS
- [x] Database schema aligned with PRD
- [x] Admin PIN authentication
- [x] Session management
- [x] Rate limiting
- [x] Admin dashboard UI
- [x] Automated testing (unit + E2E)

### 🚧 In Progress (PR #3)

- [ ] YouTube OAuth integration
- [ ] Channel connection UI
- [ ] OAuth status display

### 📅 Upcoming

- **PR #4** - Stream pool initialization
- **PR #5** - Match creation with idempotency
- **PR #6** - Larix deep links
- **PR #7** - Live scoring + overlay
- **PR #8** - Hardening + production readiness

---

## 🤝 Contributing

### Workflow

1. Create feature branch from `main`
2. Make changes and write tests
3. Ensure all tests pass: `npm run test:all`
4. Create pull request
5. Wait for CI checks to pass
6. Request review

### Code Style

- Use TypeScript for type safety
- Follow ESLint rules (`npm run lint`)
- Write tests for new features
- Keep components small and focused
- Use meaningful variable names

---

## 🐛 Troubleshooting

### npm install fails with 403

```bash
npm install --registry=https://registry.npmjs.org/
```

### Database connection issues

- Verify `DATABASE_URL` is correct
- Ensure PostgreSQL is running
- Check firewall/network settings

### Tests failing

- Make sure dev server is running for E2E tests
- Clear `.next` cache: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`

### Admin login not working

- Verify admin PIN was set during `npm run db:seed`
- Check `admin_settings` table for `admin_pin_hash`
- Try rate limit clearing (wait 15 minutes or restart server)

---

## 📄 License

This project is private and proprietary to the club volleyball organization.

---

## 💬 Support

For questions or issues:

1. Check the [Troubleshooting](#-troubleshooting) section
2. Review [GitHub Issues](https://github.com/thudave56/clubstream/issues)
3. Contact your system administrator

---

**Built with ❤️ for club volleyball teams**
