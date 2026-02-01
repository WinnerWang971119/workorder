# goal.md — Work Order System MVP (Website + Discord Bot + Supabase)

## 0) One-sentence goal
Build an MVP work order system with a Discord-first workflow (slash commands + buttons) and a minimal web dashboard, backed by Supabase (Postgres + Auth), with two permission levels (Admin/Member) and editable permissions from Discord server config and the dashboard.

---

## 1) MVP Scope (what “done” means)
### Must ship
1. **Discord bot** supports:
   - Slash commands: `/wo create`, `/wo edit`, `/wo remove`, `/wo assign`, `/wo claim`, `/wo unclaim`, `/wo list` (unfinished only)
   - Message UI buttons (Claim/Unclaim + Status/Quick Actions)
   - Enforced permissions (Admin vs Member)
2. **Website dashboard** supports:
   - Auth + role-based access
   - Work Order list with category filters
   - Work Order detail (view/edit depending on role)
   - Admin actions: add/remove/assign
   - A “User Usage” page: who did work (claims/completions + stats)
3. **Permissions** editable:
   - By Discord server admin (role mapping / config)
   - From dashboard (admin panel)
4. **Data stored in Supabase**:
   - Work orders, users, audit logs, discord config, (optional) comments

### Out of scope for MVP (explicitly NOT required)
- Complex workflow states (beyond “unfinished vs finished”)
- Multi-assignee, subtasks, dependencies
- Parts/time cost accounting
- File uploads (can be added later)
- Full moderation tools beyond role restrictions

---

## 2) Roles & Permissions (MVP rules)
### Roles
- **Admin**
  - Can do anything: create/edit/remove/assign/claim/unclaim/list
  - Can change permission mappings (Discord roles ↔ app roles)
- **Member**
  - Can: create, edit own work orders (configurable), claim, unclaim, list unfinished
  - Cannot: assign, remove (unless Admin)

### Permission logic (source of truth)
- App has its own role model: `ADMIN` | `MEMBER`
- Discord server admins can map one or more Discord roles to `ADMIN` and `MEMBER`
- Dashboard can edit the same mapping
- Effective role = highest role the user has, derived at runtime from Discord roles + mapping in DB

---

## 3) Work Order Model (MVP fields)
**WorkOrder**
- `id` (string/uuid or readable sequence)
- `title` (string)
- `description` (string)
- `category` (enum/string; e.g., mech/electrical/software/general)
- `status` (enum; MVP: `OPEN` | `DONE`)
- `priority` (optional enum; MVP can default)
- `created_by_user_id`
- `assigned_to_user_id` (optional; only Admin can set)
- `claimed_by_user_id` (optional; Member can set via claim)
- `created_at`, `updated_at`
- `discord_message_id` (optional)
- `discord_thread_id` (optional)
- `discord_guild_id` (required)
- `is_deleted` (soft delete recommended)

**AuditLog** (mandatory for “user usage” page)
- `id`
- `guild_id`
- `work_order_id`
- `actor_user_id`
- `action` (CREATE/EDIT/REMOVE/ASSIGN/CLAIM/UNCLAIM/STATUS_CHANGE)
- `meta` (json: old/new values, reason, etc.)
- `created_at`

**GuildConfig**
- `guild_id` (Discord server id, PK)
- `admin_role_ids` (array of string role ids)
- `member_role_ids` (array of string role ids)
- `work_orders_channel_id` (where bot posts summary cards)
- `timezone` (optional)
- `updated_at`

**User**
- `id` (uuid; app user id)
- `discord_user_id` (string, unique)
- `display_name`
- `avatar_url` (optional)
- `last_seen_at`

---

## 4) Discord Bot UX (commands + buttons)
### 4.1 Slash commands (spec)
1. `/wo create`
   - Modal: title, description, category
   - Creates work order + posts a “WO card” message in configured channel
   - Buttons attached to message

2. `/wo edit <wo_id>`
   - Permission:
     - Admin: can edit any
     - Member: can edit if `created_by == self` (MVP default; make configurable later)
   - Modal prefilled (if Discord supports; otherwise show current + ask new)

3. `/wo remove <wo_id>`
   - Admin only
   - Soft delete + update card message (“Removed by Admin”)
   - Log to AuditLog

4. `/wo assign <wo_id> <user>`
   - Admin only
   - Sets `assigned_to_user_id`
   - Updates message card + pings assignee (optional)

5. `/wo claim <wo_id>`
   - Member/Admin
   - Sets `claimed_by_user_id = self`
   - If already claimed by someone else: reject with message (MVP)

6. `/wo unclaim <wo_id>`
   - Member/Admin
   - Allowed if `claimed_by == self` OR Admin override

7. `/wo list`
   - Returns list of unfinished (status=OPEN, not deleted)
   - Minimal formatting: top N + link to dashboard
   - Filters can be later; MVP = unfinished only

### 4.2 Buttons on the WO message card (MVP)
Buttons on the work order message:
- **Claim** (if unclaimed)
- **Unclaim** (if claimed by self; Admin can force show via “Admin Unclaim” optional)
- **Mark Done** (Admin or claimant; define rule)
- **Open Dashboard** (link to WO detail page)
- **Quick Edit** (Admin only, or creator)

Button behavior:
- Always re-render the message embed/card to reflect latest state:
  - Title, Category, Status, Assigned, Claimed, CreatedBy, LastUpdated
- Buttons should be stateful:
  - Claim hidden/disabled when already claimed, etc.

---

## 5) Website Dashboard (minimal multi-page)
### Pages
1. **Login**
   - Supabase auth with Discord identity mapping
   - After login: fetch guild membership/roles if needed for permission evaluation

2. **Work Orders List**
   - Table/cards of work orders (default: unfinished)
   - Filter by category
   - Search by title (optional)
   - Click into detail

3. **Work Order Detail**
   - View fields + audit history
   - Edit fields (permissioned)
   - Admin controls: assign/remove/status

4. **User Usage**
   - Leaderboard-style view:
     - # claimed, # completed, avg time-to-done (optional)
   - Must be driven from AuditLog to avoid trusting client-side events

5. **Admin Settings**
   - Edit GuildConfig:
     - Work order channel id
     - Role mapping: Admin roles / Member roles
   - Optional: “sync from Discord” button

   The design should be alegant, no cards, only tables, text, no hero.!!!
   Use yellow and white as main colors. (Text in balck, gray)

### Dashboard MVP actions
- Add WO (same as Discord create)
- Remove WO (Admin)
- Edit WO (permissioned)
- Assign WO (Admin)

---

## 6) Supabase Requirements (Auth + Security)
### 6.1 Auth
Preferred MVP: **Discord OAuth** (single sign-on)
- Store `discord_user_id` in `User` table
- Associate each WO with `guild_id`

### 6.2 RLS (Row Level Security)
Implement RLS so the web app is secure even if API keys leak:
- Users can read WOs for guild(s) they belong to (MVP: single guild supported)
- Members can insert WOs in their guild
- Members can update:
  - their own created WOs (if rule enabled)
  - claim/unclaim where `claimed_by_user_id == self`
- Admins can update/delete any WO in guild
- AuditLog inserts: server-side only (bot + backend service role)

**Note:** Bot likely uses Supabase service role key (server-side only). Web uses anon/public key with RLS.

---

## 7) System Architecture (MVP)
### Components
- **Discord Bot (Node.js/TypeScript recommended)**
  - Interactions: slash commands, button handlers
  - Uses Supabase service role to perform DB ops + write AuditLog
- **Web Dashboard (Next.js recommended)**
  - Reads/updates via Supabase client (RLS)
  - Admin settings updates GuildConfig
- **Supabase**
  - Postgres tables + RLS policies
  - Optional Edge Functions if needed for secure operations

### Source of truth
- Work order state: Postgres (Supabase)
- Discord messages are a view/cache:
  - bot should update the card whenever WO changes via Discord actions
  - dashboard changes should optionally trigger Discord card refresh (MVP: can be manual “/wo refresh <id>” later)

---

## 8) Milestones / Work Breakdown
### Milestone A — Foundations
- Create Supabase project + schema (WorkOrder, User, GuildConfig, AuditLog)
- Implement Discord OAuth and user linking (web)
- Implement role mapping storage (GuildConfig)

### Milestone B — Discord MVP
- Implement all 7 slash commands
- Implement WO card posting + buttons
- Permission enforcement (Admin vs Member)
- AuditLog for all actions

### Milestone C — Dashboard MVP
- Login + role evaluation
- Work Orders List + category filter
- Work Order Detail + edit/remove/assign controls
- User Usage page powered by AuditLog
- Admin Settings page for role mapping

### Milestone D — Hardening
- RLS policies validated
- Rate limiting / spam prevention (basic)
- Error handling + retries for Discord message edits
- Basic observability (logs)

---

## 9) Acceptance Criteria (MVP verification checklist)
- Member can `/wo create` and see the WO card + buttons
- Member can claim/unclaim via command and via buttons
- Member cannot assign or remove (command or button)
- Admin can do all operations
- Dashboard shows accurate unfinished list and category filtering
- Dashboard User Usage reflects actions (claim/complete etc.) from AuditLog
- Role mapping changes via dashboard immediately affect permissions
- Role mapping changes via Discord admin config also affect permissions
- Supabase RLS prevents unauthorized web edits

---

## 10) Non-functional requirements (MVP)
- Latency: Discord interactions respond within 3 seconds (use deferred replies if needed)
- Reliability: bot updates card message consistently; failures are logged
- Security: service role key never shipped to client; RLS enabled
- Maintainability: consistent naming, typed DB access, shared types for WO model

---

## 11) Future Extensions (post-MVP ideas)
- Status workflow: TRIAGE/IN_PROGRESS/BLOCKED
- Comments + attachments (Supabase Storage)
- Dependency links, subtasks
- Auto reminders for stale work orders
- Multi-guild support
- Sync dashboard edits to Discord automatically (webhook/edge function)
