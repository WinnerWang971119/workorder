# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Rules

1. When answering questions, provide multiple solutions if possible.
2. When explaining solutions, use words not code. Only write code when implementing.
3. Debate with the user when you disagree. The user is not always right.
4. Comment code clearly — explain the why, not the what.
5. Write clean, readable code. Prioritize clarity over cleverness.
6. Use English to respond.
7. Don't use emojis.

## How to slove problems
1. Understand the problem: Read the user's question carefully. Ask clarifying questions if needed.
2. Read the relevant code: Identify which files and functions are related to the user's question. Skim through them to get a sense of their purpose.
3. Research: If the question involves unfamiliar concepts, look them up. Use official documentation and reputable sources.
4. Give multiple solutions: Whenever possible, provide more than one way to solve the problem. Explain the pros and cons of each approach.
5. Wait for user feedback: After providing an answer, ask if the user needs further clarification or assistance.

## Project Overview

FRC Work Order System - A work order management system designed for First Robotics Competition (FRC) teams.

- **License**: MIT License
- **Repository**: https://github.com/WinnerWang971119/workorder.git
- **Type**: Monorepo using pnpm workspaces
- **Stack**: TypeScript, Discord.js, Next.js, Supabase PostgreSQL

## Architecture

### Monorepo Structure
```
workorder/
├── packages/
│   ├── shared/       # Shared TypeScript types and constants
│   ├── bot/          # Discord bot application (discord.js)
│   └── web/          # Next.js web dashboard
├── supabase/         # Database migrations and schema
└── .claude/          # Claude Code settings
```

### Technologies
- **Language**: TypeScript 5.3+
- **Runtime**: Node.js 18+
- **Bot**: discord.js 14.14
- **Web**: Next.js 14 (App Router), React 18, Tailwind CSS
- **Database**: Supabase PostgreSQL with Row Level Security
- **Auth**: Supabase Discord OAuth
- **Package Manager**: pnpm

### packages/shared
Centralized shared types and constants used by both bot and web packages.

**Key Files:**
- `src/types/workorder.ts` - Core interfaces (WorkOrder, User, GuildConfig, Subsystem, AuditLog)
- `src/types/permissions.ts` - Permission enums (MEMBER, ADMIN)
- `src/constants.ts` - UI labels, colors, priority emojis, display helpers

**Import**: `@workorder/shared`

### packages/bot
Discord bot application with slash commands and interactive buttons.

**Directory Structure:**
- `src/commands/` - 8 slash command handlers
  - `wo-create.ts` - Create work order
  - `wo-edit.ts` - Edit work order
  - `wo-remove.ts` - Delete work order (admin only)
  - `wo-assign.ts` - Assign to user (admin only)
  - `wo-claim.ts` - User claims work order
  - `wo-unclaim.ts` - Release claim
  - `wo-list.ts` - List open work orders
  - `wo-finish.ts` - Mark work order complete

- `src/buttons/` - 3 interactive button handlers
  - `claim.ts` - Claim button handler
  - `unclaim.ts` - Unclaim button handler
  - `done.ts` - Mark done button handler

- `src/services/` - Business logic layer
  - `workorder.service.ts` - CRUD operations for work orders
  - `permission.service.ts` - Role-based access control (MEMBER vs ADMIN)
  - `audit.service.ts` - Audit trail logging
  - `discord.service.ts` - Discord embeds, buttons, message formatting
  - `user.service.ts` - User synchronization with Discord
  - `subsystem.service.ts` - Guild-scoped subsystems management

**Key Files:**
- `src/index.ts` - Main entry point, Discord event handlers
- `src/client.ts` - Discord client initialization, slash command registration
- `src/config.ts` - Environment variable validation
- `src/supabase.ts` - Supabase client initialization

**Environment Variables** (`.env`):
- `DISCORD_TOKEN` - Bot token
- `DISCORD_CLIENT_ID` - Application ID
- `SUPABASE_URL` - Database URL
- `SUPABASE_SERVICE_ROLE_KEY` - Server-side database key
- `NODE_ENV` - Environment mode

### packages/web
Next.js web dashboard with Discord OAuth authentication.

**Routes:**
- `/` - Home (redirects to /workorders)
- `/login` - Discord OAuth login page
- `/auth/callback` - OAuth callback handler
- `/workorders` - Paginated list of open work orders
- `/workorders/[id]` - Detailed work order view with audit history
- `/usage` - User statistics and leaderboards
- `/admin` - Guild configuration (admin-only)

**Key Files:**
- `app/layout.tsx` - Root layout
- `app/middleware.ts` - Session management and authentication
- `lib/` - Utilities and helpers
- `components/` - Reusable React components

**Environment Variables** (`.env`):
- `NEXT_PUBLIC_SUPABASE_URL` - Database URL (public)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anonymous key with RLS

## Database Schema

### Tables

**users**
- `id` (UUID, PK) - User identifier
- `discord_user_id` (TEXT, UNIQUE) - Discord snowflake ID
- `display_name` (TEXT) - User's display name
- `avatar_url` (TEXT) - Avatar image URL
- `last_seen_at` (TIMESTAMP) - Last activity timestamp

**guild_configs**
- `guild_id` (TEXT, PK) - Discord guild/server ID
- `admin_role_ids` (TEXT[]) - Admin role IDs array
- `member_role_ids` (TEXT[]) - Member role IDs array
- `work_orders_channel_id` (TEXT) - Channel for work order messages
- `timezone` (TEXT) - Guild timezone

**subsystems** (Guild-scoped categories)
- `id` (UUID, PK)
- `guild_id` (TEXT, FK) - Guild this subsystem belongs to
- `name` (TEXT) - Internal name (e.g., MECH, ELECTRICAL, SOFTWARE, GENERAL)
- `display_name` (TEXT) - User-facing display name
- `emoji` (TEXT) - Unicode emoji for visual representation
- `color` (TEXT) - Hex color code
- `sort_order` (INTEGER) - Display order

**work_orders**
- `id` (UUID, PK)
- `title` (TEXT)
- `description` (TEXT)
- `subsystem_id` (UUID, FK) - Reference to subsystem
- `status` (TEXT) - OPEN or DONE
- `priority` (TEXT) - LOW, MEDIUM, or HIGH
- `created_by_user_id` (UUID, FK) - Creator
- `assigned_to_user_id` (UUID, FK) - Admin-assigned user
- `claimed_by_user_id` (UUID, FK) - User who claimed it
- `discord_message_id` (TEXT) - Discord message ID
- `discord_channel_id` (TEXT) - Discord channel
- `discord_thread_id` (TEXT) - Discord thread
- `discord_guild_id` (TEXT) - Discord guild
- `is_deleted` (BOOLEAN) - Soft delete flag

**audit_logs** (Immutable audit trail)
- `id` (UUID, PK)
- `guild_id` (TEXT)
- `work_order_id` (UUID, FK)
- `actor_user_id` (UUID, FK)
- `action` (TEXT) - CREATE, EDIT, REMOVE, ASSIGN, CLAIM, UNCLAIM, STATUS_CHANGE
- `meta` (JSONB) - Action metadata

### Migrations
1. `001_initial_schema.sql` - Core tables, indexes, triggers
2. `002_rls_policies.sql` - Row Level Security policies
3. `003_allow_authenticated_guild_config_writes.sql` - Auth enhancements
4. `004_add_subsystems.sql` - Subsystems table + migration

## Key Features

### Work Order Management
- Full CRUD operations
- Status tracking (OPEN, DONE)
- Priority levels (LOW, MEDIUM, HIGH)
- Soft deletion
- Assignment (admin-assigned) and claiming (user self-assignment)
- Discord integration with embeds and buttons

### Permission System
- Role-based access control (MEMBER vs ADMIN)
- Guild-configurable role IDs
- Creator can edit own work orders
- Admins have full control
- Supabase RLS for data protection

### Audit Trail
- Complete action history
- User tracking (who, what, when)
- Immutable log
- JSONB metadata for context

### Subsystems (Recent Enhancement)
- Dynamic, guild-scoped categories
- Replaces hardcoded categories
- Custom emoji, color, sort order per subsystem
- Autocomplete support in Discord commands

## Development Scripts

```bash
# Root workspace
pnpm dev              # Run all packages in parallel
pnpm build            # Build all packages
pnpm bot:dev          # Run bot in development
pnpm web:dev          # Run web dashboard in development
pnpm bot:build        # Build bot
pnpm web:build        # Build web
pnpm shared:build     # Build shared types
```

## Current Configuration

**Claude Code Settings** (`.claude/settings.local.json`):
- Allows execution of the `tree` bash command for viewing project structure
- Modify this file if additional bash commands or permissions are needed for development

## Resources

- **README.md**: Brief project description
- **SETUP.md**: Detailed local development setup
- **DEPLOYMENT.md**: Production deployment guide
- **IMPLEMENTATION_SUMMARY.md**: Technical details and completion status
- **TESTING.md**: Manual testing checklist
- **LICENSE**: MIT License terms
- **GitHub**: https://github.com/WinnerWang971119/workorder.git
