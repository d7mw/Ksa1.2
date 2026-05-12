# ksa1 — Twitter/X Clone (Saudi Theme) — PRD

## Original Problem Statement
Build a pixel-perfect Twitter (X) clone with Saudi-green theme. Full-stack app with Arabic/English, real user registration (no bots), email OTP, image uploads, dynamic profile handles (`/:username`), follow system, retweets, paid verifications, and PWA capabilities.

User language: Arabic (always respond in Arabic).

## Tech Stack
- Backend: FastAPI + Motor (Async MongoDB)
- Frontend: React + Tailwind + Shadcn UI
- Auth: JWT (bcrypt) + Emergent Google Auth
- Email: SendGrid (OTP + follow notifications)
- PWA: standalone manifest + iOS meta tags

## Implemented Features
- JWT auth, email OTP signup, Google OAuth login, forgot-password flow
- Tweets: create, like, retweet (toggle), reply, image upload (compressed client-side)
- Follow system with email notifications, followers/following modal lists, real-time counts
- Dynamic `/:username` profile routing with reserved-path protection
- Admin dashboard: user mgmt, verification request approval, tweet moderation
- Mobile-responsive layout, error boundaries, optimistic UI
- N+1-free batched queries
- **Private accounts** (`is_private`): filters non-followers from feed/profile, 403 on tweet detail (22/22 tests)
- **Timezone-aware** datetimes (`+00:00` ISO offset), frontend `parseUTC`+`timeAgo` shows `الآن` <60s
- **Logout**: Sidebar pill + Settings row + AppContext `logout()`
- **PWA**: standalone manifest, apple-touch-icon, iOS meta tags, maskable 512 icon
- **Direct Messages (DMs)** (2026-05-12, 17/17 backend + frontend e2e tests):
  - Conversation list `/messages`, conversation thread `/messages/:id`
  - Text + image (auto-compressed) + arbitrary file attachments via base64
  - `dm_privacy` user setting: `everyone` (default) or `followers` (followers-only)
  - Privacy enforced on send (403 `dm_restricted_to_followers`), opening blocked convs shows explanation
  - Unread badges in Sidebar + BottomNav + per-conversation row
  - Soft-delete (hidden_for) preserves canonical participant list so reopening resurfaces same thread
  - New-message modal with user search
- **Settings access on mobile**: gear icon in Profile header (top-right) → /settings
- **Message-from-profile**: small message button next to Follow on other users' profiles

## API Surface
- Auth: `/auth/signup/start|verify`, `/auth/login`, `/auth/google`, `/auth/forgot-password/*`
- Users: `GET/PATCH /users/me`, `GET /users/:username`, `GET /users/:username/tweets|followers|following`, `POST /users/:username/follow`
- Tweets: `/tweets/feed?tab=forYou|following|trending`, CRUD, `:id/like|retweet|replies`
- Notifications: `/notifications`, `/notifications/unread-count`
- Search: `/search/tweets|users`
- Admin: `/admin/users|tweets|verification-requests|stats`
- **Messages (NEW)**:
  - `GET /messages/conversations` — sorted by `last_message_at` desc, excludes `hidden_for` caller
  - `POST /messages/conversations` `{username}` — start (idempotent), un-hides if previously hidden, 400 on self
  - `GET /messages/unread-count`
  - `GET /messages/conversations/:id?before=:msg_id`
  - `POST /messages/conversations/:id` `{content, attachments[]}` — 403 if recipient dm_privacy=followers and viewer not followed
  - `POST /messages/conversations/:id/read`
  - `DELETE /messages/conversations/:id` — hides for caller; if both hide, real delete

## DB Schema additions
- `users.dm_privacy`: 'everyone' | 'followers' (default 'everyone')
- `conversations`: `{id, participants:[a,b] sorted, created_at, last_message_at, last_message_preview, last_sender_id, hidden_for:[user_id]}`
- `messages`: `{id, conversation_id, sender_id, content, attachments:[{type:'image|file', url, name, size, mime}], created_at, read_by:[user_id]}`

## Roadmap
### P1
- [ ] Stripe (or Tap/HyperPay) integration for paid verification (25/200 SAR). Currently admin-manual.

### P2
- [ ] Refactor `/app/backend/server.py` (1290+ lines) → modular routers (auth, tweets, users, admin, messages).
- [ ] Validate attachment.url format (data: or https:) on backend.
- [ ] Show toast (use `sonner`) instead of `window.alert` for DM/profile errors.
- [ ] DM Notifications: SendGrid email on first message from a new contact.
- [ ] Profile UI: show "🔒 حساب خاص" banner + Follow CTA on private profiles you don't follow.
- [ ] Real-time DMs via WebSocket/SSE (currently 5–8s polling).
- [ ] Hashtag pages, bookmarks list, trending algo.

## Deployment
- Production: `https://ksa1.sa` / `https://social-feed-269.emergent.host`
- Preview: `https://social-feed-269.preview.emergentagent.com`
- **Any preview changes require Redeploy to push to production.**

## Critical Notes
- `parseUTC` handles both `Z` and `+00:00` suffixes — Motor `tz_aware=True` returns the latter.
- Reserved usernames enforced at signup, check-username, profile patch.
- N+1 prevention: always `$in` batched queries when serializing lists.
- DM `_can_dm` returns True if `recipient.dm_privacy == 'everyone'` OR `recipient follows sender` (Twitter semantics: you can DM people who follow you).
