# Deployment Guide

This guide covers deploying the FRC Work Order System to production.

## Prerequisites

1. **Supabase Project** - Already set up with migrations applied
2. **Discord Application** - Created with OAuth configured
3. **Node.js 18+** and **pnpm**

## Environment Setup

### Supabase

1. Create a Supabase project at https://supabase.com
2. Run migrations in the SQL editor:
   - Copy contents of `supabase/migrations/001_initial_schema.sql`
   - Copy contents of `supabase/migrations/002_rls_policies.sql`
3. Configure Discord OAuth:
   - Go to Authentication > Providers > Discord
   - Add your redirect URLs:
     - Development: `http://localhost:3000/auth/callback`
     - Production: `https://yourdomain.com/auth/callback`

### Discord Application

1. Create an application at https://discord.com/developers/applications
2. Go to OAuth2 > General:
   - Copy **Client ID** and **Client Secret**
3. Go to Bot:
   - Create a bot user
   - Copy **Token**
   - Enable these **Intent**s:
     - Server Members Intent
     - Message Content Intent
4. Go to OAuth2 > URL Generator:
   - Scopes: `bot`
   - Permissions: `Send Messages`, `Embed Links`, `Read Message History`, `Use Slash Commands`, `Manage Webhooks`
   - Copy the generated URL and join your bot to a test server

## Deploying the Discord Bot

### Option 1: Railway (Recommended for MVP)

1. **Create Account** at https://railway.app
2. **Create Project** from GitHub repo
3. **Set Environment Variables:**
   ```
   DISCORD_TOKEN=<your_bot_token>
   DISCORD_CLIENT_ID=<your_client_id>
   SUPABASE_URL=<your_supabase_url>
   SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
   NODE_ENV=production
   ```
4. **Set Build Command:** `pnpm --filter bot build`
5. **Set Start Command:** `pnpm --filter bot start`
6. **Deploy** - Railway will auto-deploy on push to `main`

### Option 2: Fly.io

1. **Create Account** at https://fly.io
2. **Install CLI** - `curl https://fly.io/install.sh | sh`
3. **Create Dockerfile** in `packages/bot/`:
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY pnpm-lock.yaml ./
   RUN npm install -g pnpm
   RUN pnpm install --frozen-lockfile
   COPY . .
   RUN pnpm --filter bot build
   CMD ["pnpm", "--filter", "bot", "start"]
   ```
4. **Deploy:**
   ```bash
   fly launch --name workorder-bot
   fly secrets set DISCORD_TOKEN=<token> DISCORD_CLIENT_ID=<id> SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<key>
   fly deploy
   ```

### Option 3: VPS (DigitalOcean, Linode)

1. **SSH into server**
2. **Install dependencies:**
   ```bash
   curl -fsSL https://get.pnpm.io/install.sh | sh -
   curl -sL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs git
   ```
3. **Clone repo and setup:**
   ```bash
   git clone <your_repo_url>
   cd workorder
   pnpm install
   pnpm --filter bot build
   ```
4. **Create `.env` file** in `packages/bot/` with production credentials
5. **Use PM2 for process management:**
   ```bash
   npm install -g pm2
   pm2 start packages/bot/dist/index.js --name workorder-bot
   pm2 save
   pm2 startup
   ```

## Deploying the Next.js Dashboard

### Option 1: Vercel (Recommended)

1. **Connect Repository:**
   - Go to https://vercel.com/new
   - Import your GitHub repo
   - Select `packages/web` as root directory
2. **Set Environment Variables:**
   ```
   NEXT_PUBLIC_SUPABASE_URL=<your_supabase_url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_anon_key>
   ```
3. **Deploy** - Vercel will auto-deploy on push to `main`

### Option 2: Netlify

1. **Connect Repository:**
   - Go to https://netlify.com
   - Select your repo
   - Set build command: `cd packages/web && npm run build`
   - Set publish directory: `packages/web/.next`
2. **Set Environment Variables** in Site Settings
3. **Deploy**

### Option 3: Railway (Multi-service)

If using Railway for the bot, you can add the dashboard:

1. **Create new service** in your Railway project
2. **Set Environment Variables** for Supabase
3. **Set Build Command:** `pnpm --filter web build`
4. **Set Start Command:** `pnpm --filter web start`

## Post-Deployment Checklist

- [ ] Bot responds to `/wo-list` command in test server
- [ ] Discord OAuth login works on dashboard
- [ ] Work orders appear in database
- [ ] Buttons trigger claims/unclaims
- [ ] Dashboard displays work orders
- [ ] Audit logs are being recorded
- [ ] Set up monitoring/logging (e.g., Sentry)
- [ ] Configure custom domain (optional)
- [ ] Invite bot to production server
- [ ] Update Discord OAuth redirect URLs for production domain

## Monitoring & Logs

### Railway
- View logs in project dashboard
- Set up error notifications

### Fly.io
```bash
fly logs -a workorder-bot
```

### Vercel
- Logs available in dashboard
- Enable analytics and monitoring

### VPS with PM2
```bash
pm2 logs workorder-bot
pm2 monit
```

## Troubleshooting

**Bot not responding:**
- Verify `DISCORD_TOKEN` and `DISCORD_CLIENT_ID`
- Check bot has proper permissions in server
- Verify message content intent is enabled

**Dashboard 500 errors:**
- Check Supabase connection
- Verify environment variables
- Check RLS policies are enabled

**Auth not working:**
- Verify redirect URLs in Supabase
- Check Discord OAuth credentials
- Clear browser cookies and retry

**Database errors:**
- Verify migrations were applied
- Check RLS policies are set correctly
- Verify service role key has full access
