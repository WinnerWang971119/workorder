# FRC Work Order System - Setup Guide

A complete Discord-integrated work order management system for FRC teams.

## Project Structure

```
workorder/
├── packages/
│   ├── shared/          # Shared types and constants
│   ├── bot/             # Discord bot (discord.js)
│   └── web/             # Next.js dashboard
├── supabase/            # Database migrations
└── DEPLOYMENT.md        # Production deployment guide
```

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm (install with: `npm install -g pnpm`)
- Git
- Supabase account (https://supabase.com)
- Discord application (https://discord.com/developers)

### 1. Supabase Setup

1. Create a new Supabase project
2. Navigate to the SQL Editor
3. Copy and execute both migration files:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
4. Navigate to Settings > API:
   - Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - Copy **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy **service_role secret** key → `SUPABASE_SERVICE_ROLE_KEY`
5. Configure Discord OAuth:
   - Go to Authentication > Providers > Discord
   - Log in with your Discord account or create one
   - Add redirect URLs:
     - `http://localhost:3000/auth/callback`
     - `http://localhost:3001/auth/callback` (if testing on different port)

### 2. Discord Application Setup

1. Go to https://discord.com/developers/applications
2. Click "New Application" and give it a name
3. Go to the "Bot" section and click "Add Bot"
4. Under TOKEN, click "Copy":
   - Save this as `DISCORD_TOKEN`
5. Go to OAuth2 > General:
   - Copy **Client ID** → `DISCORD_CLIENT_ID`
   - Copy **Client Secret** (for bot auth, if needed)
6. Go to OAuth2 > URL Generator:
   - Scopes: Select `bot`
   - Permissions: `Send Messages`, `Embed Links`, `Read Message History`, `Use Slash Commands`
   - Copy the URL and open it to add bot to a test server
7. Enable these Gateway Intents in the Bot section:
   - Server Members Intent
   - Message Content Intent

### 3. Environment Variables

#### Bot (`packages/bot/.env`)

```bash
cp packages/bot/.env.example packages/bot/.env
```

Edit and fill in:
```env
DISCORD_TOKEN=<your_bot_token>
DISCORD_CLIENT_ID=<your_client_id>
SUPABASE_URL=<your_supabase_url>
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
NODE_ENV=development
```

#### Dashboard (`packages/web/.env.local`)

```bash
cp packages/web/.env.local.example packages/web/.env.local
```

Edit and fill in:
```env
NEXT_PUBLIC_SUPABASE_URL=<your_supabase_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_anon_key>
```

### 4. Install Dependencies

```bash
pnpm install
```

### 5. Run in Development

**Terminal 1 - Bot:**
```bash
pnpm --filter bot dev
```

**Terminal 2 - Dashboard:**
```bash
pnpm --filter web dev
```

The dashboard will be available at `http://localhost:3000`

## Testing

### Discord Bot Commands

In your test Discord server:

```
/wo-create title:"Test Work" category:MECH description:"Testing the bot"
/wo-list
/wo-claim id:<work_order_id>
/wo-unclaim id:<work_order_id>
```

Admin commands (requires admin role):
```
/wo-edit id:<work_order_id> title:"Updated Title"
/wo-assign id:<work_order_id> user:@username
/wo-remove id:<work_order_id>
```

### Dashboard

1. Open http://localhost:3000
2. Click "Login with Discord"
3. Authorize the application
4. You'll be redirected to `/workorders`
5. View, filter, and manage work orders

## Architecture

### Discord Bot Flow

1. User runs slash command in Discord
2. Bot creates/updates work order in Supabase
3. Work order embed card posted to configured channel
4. Buttons trigger CLAIM/UNCLAIM/MARK DONE actions
5. All actions logged to audit_logs table

### Dashboard Flow

1. User logs in with Discord OAuth
2. Dashboard fetches work orders from Supabase (RLS-enforced)
3. Users see only work orders they have permission to access
4. Admins can manage guild settings
5. Usage analytics aggregated from audit logs

## Database Schema

### tables
- **users** - Discord user information
- **guild_configs** - Server-specific role and channel settings
- **work_orders** - Main work order records
- **audit_logs** - Complete audit trail of all actions

See `supabase/migrations/001_initial_schema.sql` for full schema.

## File Structure

### packages/shared
- `types/workorder.ts` - Core data structures
- `types/permissions.ts` - Role enums
- `constants.ts` - Labels and configuration constants

### packages/bot
- `src/index.ts` - Entry point, event handlers
- `src/client.ts` - Discord client setup
- `src/config.ts` - Environment variable validation
- `src/supabase.ts` - Supabase client initialization
- `src/services/` - Business logic
  - `permission.service.ts` - Role-based access control
  - `workorder.service.ts` - CRUD operations
  - `audit.service.ts` - Audit logging
  - `discord.service.ts` - Discord embed/button helpers
  - `user.service.ts` - User management
- `src/commands/` - Slash command handlers
- `src/buttons/` - Interactive button handlers

### packages/web
- `app/` - Next.js App Router pages
  - `layout.tsx` - Root layout
  - `login/page.tsx` - Discord OAuth login
  - `workorders/page.tsx` - Work order list
  - `workorders/[id]/page.tsx` - Work order detail
  - `usage/page.tsx` - Usage statistics
  - `admin/page.tsx` - Admin settings
- `lib/` - Utilities
  - `supabase/` - Supabase clients (browser, server, middleware)
  - `permissions.ts` - Permission checking
  - `utils.ts` - Helpers (formatting, truncation, etc.)
- `components/ui/` - Reusable UI components
- `components/error-boundary.tsx` - Error handling

## Common Issues

### Bot not responding to commands
- Verify `DISCORD_TOKEN` and `DISCORD_CLIENT_ID`
- Check bot has "Use Slash Commands" permission in server
- Restart bot after permission changes

### Dashboard login loops
- Clear browser cookies
- Verify OAuth redirect URLs in Supabase match your domain
- Check Discord application has correct URLs configured

### Database permission errors
- Verify RLS policies are enabled
- Check service role key is correct
- Run migrations again to ensure policies exist

### Message not posting to Discord
- Verify `work_orders_channel_id` is set in guild config
- Check bot has "Send Messages" and "Embed Links" permissions
- Check channel is not archived

## Next Steps

1. **Customize Colors & Branding**
   - Edit `packages/web/tailwind.config.ts` for color scheme
   - Update bot embed colors in `packages/bot/src/services/discord.service.ts`

2. **Add Guild Configuration UI**
   - Complete the admin settings page
   - Allow teams to configure their own role mappings

3. **Implement Real-time Updates**
   - Add Supabase real-time subscriptions
   - Live update work order status across users

4. **Add Notifications**
   - Discord notifications for claimed/done work orders
   - Email notifications (optional)

5. **Analytics & Reporting**
   - Generate team productivity reports
   - Track metrics over time

## Deployment

See `DEPLOYMENT.md` for production deployment instructions.

## Support

For issues or questions:
1. Check Discord for errors in console
2. Check Supabase logs
3. Verify environment variables
4. Review `CLAUDE.md` for project requirements

## License

MIT License - See LICENSE file
