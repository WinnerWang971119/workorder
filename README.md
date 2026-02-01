# FRC Work Order System

A complete work order management system designed for FIRST Robotics Competition (FRC) teams, featuring a Discord bot for team collaboration and a web dashboard for administration and analytics.

## Overview

The FRC Work Order System streamlines task management for robotics teams by providing:

- **Discord Integration**: Manage work orders directly from Discord using slash commands and interactive buttons
- **Web Dashboard**: View analytics, manage permissions, and access detailed work order information
- **Permission System**: Role-based access control with admin and member levels
- **Audit Trail**: Complete history of all actions for accountability and analytics
- **Real-time Updates**: Work order status synchronized between Discord and the web dashboard

## Features

### Discord Bot
- Create, edit, assign, claim, and complete work orders using slash commands
- Interactive buttons for quick actions (Claim, Unclaim, Mark Done)
- Beautiful embedded messages with color-coded status indicators
- Permission enforcement based on Discord roles
- All actions logged for audit purposes

### Web Dashboard
- Discord OAuth authentication
- Work order list with filtering by category and status
- Detailed work order views with full audit history
- User usage analytics and leaderboards
- Admin panel for guild configuration and role mapping
- Clean, responsive design with yellow and white color scheme

### Work Order Management
- **Categories**: Mechanical, Electrical, Software, General
- **Status Tracking**: Open, Done
- **Priority Levels**: Low, Medium, High
- **Assignment**: Admin-assigned or self-claimed
- **Audit Trail**: Complete history of who did what and when

## Tech Stack

### Core
- TypeScript 5.3+
- Node.js 18+
- pnpm workspace (monorepo)

### Discord Bot
- discord.js 14.14
- Supabase PostgreSQL
- @supabase/supabase-js

### Web Dashboard
- Next.js 14 (App Router)
- React 18
- Tailwind CSS
- Supabase (with Row Level Security)

## Quick Start

### Prerequisites
- Node.js 18 or higher
- pnpm (`npm install -g pnpm`)
- Supabase account
- Discord application

### Installation

1. Clone the repository:
```bash
git clone https://github.com/WinnerWang971119/workorder.git
cd workorder
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up Supabase:
   - Create a new Supabase project
   - Run migrations from `supabase/migrations/`
   - Configure Discord OAuth in Supabase Authentication settings

4. Configure Discord application:
   - Create a Discord bot at https://discord.com/developers
   - Enable necessary intents (Server Members, Message Content)
   - Add bot to your Discord server

5. Set environment variables:

**Bot** (`packages/bot/.env`):
```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NODE_ENV=development
```

**Dashboard** (`packages/web/.env.local`):
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

6. Run in development:
```bash
# Terminal 1 - Discord bot
pnpm --filter bot dev

# Terminal 2 - Web dashboard
pnpm --filter web dev
```

The dashboard will be available at http://localhost:3000

For detailed setup instructions, see [SETUP.md](./SETUP.md).

## Project Structure

```
workorder/
├── packages/
│   ├── shared/       # Shared TypeScript types and constants
│   ├── bot/          # Discord bot (discord.js)
│   └── web/          # Web dashboard (Next.js)
├── supabase/         # Database migrations and schema
│   └── migrations/
├── SETUP.md          # Detailed setup guide
├── DEPLOYMENT.md     # Production deployment guide
├── TESTING.md        # Testing checklist
└── IMPLEMENTATION_SUMMARY.md  # Implementation details
```

## Usage

### Discord Commands

All commands use the `/wo` prefix:

```
/wo-create title:"Fix drivetrain" category:MECH description:"Tighten loose chain"
/wo-list
/wo-claim id:1
/wo-unclaim id:1
```

Admin-only commands:
```
/wo-assign id:1 user:@teammate
/wo-edit id:1 title:"Updated title"
/wo-remove id:1
```

### Interactive Buttons

Each work order message includes buttons for quick actions:
- **Claim**: Take ownership of a work order
- **Unclaim**: Release your claim
- **Mark Done**: Complete the work order

### Web Dashboard

1. Navigate to the deployed dashboard URL
2. Click "Login with Discord"
3. View and manage work orders from the web interface
4. Access usage analytics at `/usage`
5. Configure guild settings at `/admin` (admin only)

## Documentation

- **[SETUP.md](./SETUP.md)**: Complete setup instructions for local development
- **[DEPLOYMENT.md](./DEPLOYMENT.md)**: Production deployment guide (Railway, Fly.io, Vercel, etc.)
- **[TESTING.md](./TESTING.md)**: Testing checklist and procedures
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)**: Technical implementation details
- **[goal.md](./goal.md)**: Original MVP requirements and specifications

## Security

- Row Level Security (RLS) enabled on all Supabase tables
- Service role key used only server-side (Discord bot)
- Public/anon key used client-side with RLS enforcement
- Discord OAuth for secure authentication
- Permission checks on both client and server

## Development

### Running Tests

Manual testing checklist available in [TESTING.md](./TESTING.md).

### Building for Production

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter bot build
pnpm --filter web build
```

### Code Structure

The project uses a monorepo structure with shared types:

- **packages/shared**: Common TypeScript types and constants used by both bot and web
- **packages/bot**: Discord bot with services for permissions, work orders, audit logging, and Discord interactions
- **packages/web**: Next.js application with pages for work orders, usage analytics, and admin settings

## Contributing

This is an internal FRC team project. For questions or issues:

1. Check existing documentation (SETUP.md, DEPLOYMENT.md)
2. Review the Discord bot console for errors
3. Check Supabase logs for database issues
4. Verify environment variables are set correctly

## License

MIT License - See [LICENSE](./LICENSE) file for details.

## Repository

https://github.com/WinnerWang971119/workorder

## Acknowledgments

Built for FRC teams to streamline work order management and team collaboration during build season and beyond.
