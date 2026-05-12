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

## Implemented Features (as of 2026-05-12)
- JWT auth, email OTP signup, Google OAuth login, forgot-password flow
- Tweets: create, like, retweet (toggle), reply, image upload (compressed client-side)
- Follow system with email notifications, followers/following modal lists, real-time counts
- Dynamic `/:username` profile routing with reserved-path protection
- Admin dashboard: user mgmt, verification request approval, tweet moderation
- Mobile-responsive layout, error boundaries, optimistic UI
- N+1-free batched queries (`serialize_tweets`, batched authors/likes/retweets)
- **Private accounts**: `is_private` toggle, `_filter_private_tweets` filters non-followers from feed/profile, `/tweets/{id}` returns 403 for non-allowed viewers (validated: 22/22 tests pass)
- **Timezone fix**: Motor client `tz_aware=True`, `now_utc()` everywhere; `created_at` serialized with `+00:00`; frontend `parseUTC` + `timeAgo` shows `الآن` for posts <60s
- **Logout**: Sidebar pill + Settings row, AppContext `logout()`
- **PWA**: standalone manifest, apple-touch-icon, iOS meta tags, maskable 512 icon

## API Surface
- `POST /api/auth/signup/start` `/verify`, `POST /api/auth/login`, `POST /api/auth/google`
- `POST /api/auth/forgot/start` `/verify`
- `GET/PATCH /api/users/me`, `GET /api/users/:username`, `GET /api/users/:username/tweets`
- `POST /api/users/:id/follow`, `GET /api/users/:username/followers|following`
- `GET /api/tweets/feed?tab=forYou|following|trending`, `POST /api/tweets`, `DELETE`, `POST :id/like|retweet`, `GET :id/replies`
- `GET /api/notifications`
- Admin: `GET /api/admin/users|tweets|verification-requests`, approve/reject/ban

## DB Schema
- `users`: id, email, username, name, bio, avatar, cover, verified, is_private, email_notifications_disabled, followers_count, following_count, created_at
- `tweets`: id, user_id, content, image, parent_id, created_at, likes_count, retweets_count, replies_count, views
- `follows`, `likes`, `retweets`: { user_id, target_id, created_at }
- `notifications`: id, recipient_id, actor_id, type, tweet_id, created_at, read
- `otps`, `password_resets`: TTL-expiring codes

## Roadmap
### P1
- [ ] Stripe (or Tap/HyperPay) integration for paid verification (25 SAR/month, 200 SAR/year). Currently admin-manual approval.

### P2
- [ ] Refactor `/app/backend/server.py` (1041 lines) into modular routers: `routes/auth.py`, `routes/tweets.py`, `routes/users.py`, `routes/admin.py`, `routes/notifications.py`.
- [ ] Profile UI: show "🔒 Private account" banner + Follow CTA when visiting a private profile the viewer doesn't follow (currently shows empty tab silently — backend already returns `is_private` flag).
- [ ] Real-time notifications (WebSocket / SSE)
- [ ] Direct messages
- [ ] Hashtag pages & trending algorithm
- [ ] Bookmarks

## Deployment
- Production: `https://ksa1.com` / `https://social-feed-269.emergent.host`
- Preview: `https://social-feed-269.preview.emergentagent.com`
- **Any preview changes require Redeploy to reflect on production.**

## Critical Notes for Future Agents
- Always append `Z` only when string lacks tz info; `parseUTC` in `/app/frontend/src/utils/dates.js` handles both `Z` and `+00:00`.
- Reserved usernames enforced at: signup, check-username, profile patch. List in `/app/frontend/src/utils/reservedPaths.js` (mirror in backend schemas).
- N+1 prevention: always use `$in` batched queries when serializing lists.
- Tz-aware: Motor client built with `tz_aware=True`. Don't downgrade.
