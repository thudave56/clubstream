📄 Product Requirements Document (PRD)
Project: Club Volleyball Live Streaming Manager (Larix + YouTube)
Version

v1.0 (Implementation-ready)

Primary Goal

Enable non-technical parents to easily create, stream, score, and archive live volleyball matches to a single club YouTube channel, using Larix Broadcaster on mobile devices, with one-tap setup and minimal failure risk in unreliable network conditions.

1. Problem Statement

Competitive volleyball tournaments often have:

unreliable venue internet

multiple matches happening simultaneously

non-technical parents acting as streamers

families needing live + replay access

Existing solutions (e.g., SidelineHD) are no longer free or reliable at scale.

2. Core Objectives

One-tap streaming

Parents never handle YouTube keys

A single link opens Larix with correct settings

Clean YouTube archives

One YouTube Live/VOD per match

Clear titles and metadata

Low operational risk

≤5 concurrent matches typical

Stream pool to avoid API fragility

Optional live scoring

Simple scoring UI

Overlay view available

Very low cost

Small cloud server

No video relay initially

3. Non-Goals (v1)

No automated highlights

No replay trimming

No monetization

No advanced analytics

No multi-camera switching

4. User Roles
Parent – Streamer

Creates match

Opens Larix

Starts streaming + recording

Parent – Scorer

Updates score via web UI

Admin (Club)

Configures YouTube integration

Manages stream pool

Controls security (PINs)

5. User Experience Flow
5.1 Create Match

Parent opens web app

Fills:

Team

Opponent

Tournament name

Optional court + start time

Clicks Create Match

5.2 After Creation

Parent sees:

Open Larix (deep link)

Scoreboard

Copy YouTube Watch Link

5.3 Open Larix Flow

If Larix installed → opens with correct destination

If not installed → App Store / Play Store shown

After install → user taps link again

5.4 During Match

Larix streams directly to YouTube

Local recording always enabled

Score updates in real time

5.5 After Match

YouTube VOD automatically available

Match shown as “Ended” in UI

6. Architecture Overview
Mobile Browser
   ↓
Web App (Next.js)
   ↓
Backend API (Node/FastAPI)
   ↓
Postgres (state)
   ↓
YouTube Live Streaming API
   ↓
YouTube Live + VOD


Video path:
Phone → YouTube (no relay)

7. Key Design Decisions
7.1 Stream Pool (Critical)

Pre-create 8–10 reusable YouTube streams

One broadcast per match

Broadcasts are bound to streams dynamically

Avoids quota spikes and failure cases

7.2 Deep Linking via Larix Grove

Server generates Grove payload

Delivered via HTTPS launcher page

Parents never type settings

7.3 Security

Admin PIN required for control panel

Optional PIN for match creation (disabled by default)

8. Data Model (Postgres)
8.1 teams
Field	Type	Notes
id	uuid	PK
slug	text	unique
display_name	text	
enabled	boolean	
created_at	timestamp	
8.2 tournaments
Field	Type
id	uuid
name	text
start_date	date
end_date	date
8.3 matches
Field	Type	Notes
id	uuid	PK
team_id	uuid	FK
opponent_name	text	
tournament_id	uuid	nullable
scheduled_start	timestamp	nullable
court_label	text	nullable
status	enum	draft / scheduled / ready / live / ended / error
youtube_broadcast_id	text	
youtube_watch_url	text	
stream_assignment_id	uuid	FK
idempotency_key	text	
created_at	timestamp	
updated_at	timestamp	
8.4 stream_pool
Field	Type
id	uuid
youtube_stream_id	text
ingest_address	text
stream_name	text
state	enum (available, reserved, in_use, stuck, disabled)
reserved_match_id	uuid
updated_at	timestamp
8.5 scores
Field	Type
match_id	uuid (PK)
set_number	int
home_score	int
away_score	int
updated_at	timestamp
8.6 admin_settings
Field	Type
admin_pin_hash	text
require_create_pin	boolean
create_pin_hash	text
youtube_channel_id	text
oauth_status	enum
updated_at	timestamp
9. API Specification
9.1 Public APIs
GET /api/teams
[
  { "id": "uuid", "display_name": "16U Black" }
]

POST /api/matches

Idempotent

Request

{
  "team_id": "uuid",
  "opponent_name": "XYZ Volleyball",
  "tournament_name": "NEQ Boston",
  "scheduled_start": "2026-03-14T15:30:00Z",
  "court_label": "Court 4",
  "idempotency_key": "uuid",
  "create_pin": "optional"
}


Response

{
  "match_id": "uuid",
  "open_larix_url": "https://club.app/m/abc/stream",
  "scoreboard_url": "https://club.app/m/abc/score",
  "watch_url": "https://youtube.com/watch?v=..."
}

GET /api/matches

Returns today’s matches.

9.2 Match Pages (HTML)
Route	Purpose
/m/:id	Match summary
/m/:id/stream	Open Larix launcher
/m/:id/score	Scoring UI
/m/:id/overlay	Overlay view
9.3 Score APIs
POST /api/matches/:id/score
{ "action": "home_plus" }


Actions:

home_plus

home_minus

away_plus

away_minus

next_set

reset_set

9.4 Admin APIs (PIN Protected)
POST /api/admin/login
{ "pin": "1234" }

POST /api/admin/stream-pool/init
{ "count": 10 }


Creates YouTube streams and stores ingest info.

POST /api/admin/youtube/connect

Starts OAuth flow.

10. YouTube Integration Logic
On Match Create

Reserve available stream (DB lock)

Create liveBroadcast

Bind broadcast → stream

Store watch URL

Return Larix link

On Stream Start

YouTube auto-starts broadcast

Optionally transition to live

On Match End

Mark match ended

Release stream to pool

11. Larix Grove Generation

Each match generates:

RTMP URL

Stream name

Encoder profile (720p, conservative bitrate)

Auto reconnect

Local recording enabled

Grove payload embedded in:

larix://set/<payload>

12. Launcher Page Logic

Show “Open Larix”

On click:

redirect to larix://set/…

After 1s:

if still visible → show install buttons

Instruction: “Install → come back → tap again”

13. Security & Abuse Prevention

Admin PIN required

Optional Create PIN (off by default)

Rate limit match creation

Idempotency enforced

14. Operational Safeguards

Stream pool health dashboard

Manual “mark stream stuck”

Audit log for:

match creation

stream binding

API errors

15. Deployment
Recommended Stack

Next.js (frontend + API)

Postgres (Neon/Supabase)

Hosting: Fly.io / Render

Secrets via environment variables

16. Testing Checklist
Functional

Match creation idempotency

Stream pool exhaustion handling

PIN enforcement

Device

iOS Safari

Android Chrome

Larix installed vs not installed

17. Success Criteria

Parent can stream with one tap

No YouTube key exposure

≤1 admin intervention per tournament

All matches archived automatically

18. Future Enhancements (Out of Scope)

Multi-court viewer

Relay server (MediaMTX)

Automated highlight clips

Team-based permissions

END OF SPEC