# Studyverse Garden - Deployment Guide

This guide will help you deploy your app so it's accessible via a website link and can be installed as a Progressive Web App (PWA) on any device.

---

## 🌐 Deploy to Vercel (Recommended - FREE)

Vercel is the easiest and fastest way to deploy Next.js apps with a free tier.

### Step 1: Prepare Your App

1. Make sure your app builds successfully:
   ```bash
   npm run build
   ```

2. Generate icons (if not done already):
   - Go to https://svgtopng.com/
   - Upload `public/icon.svg`
   - Generate and save:
     - 192x192 → `public/icon-192.png`
     - 512x512 → `public/icon-512.png`
     - 32x32 → `public/favicon.ico`

### Step 2: Deploy to Vercel

**Option A: Using Vercel Dashboard (Easiest)**

1. Go to [vercel.com](https://vercel.com) and sign up (free)
2. Click "Add New Project"
3. Import your GitHub repository (or upload your folder)
4. Vercel will auto-detect Next.js settings
5. Click "Deploy"
6. Wait 2-3 minutes
7. You'll get a live URL like: `https://your-app.vercel.app`

**Option B: Using Vercel CLI**

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Follow the prompts, then deploy to production
vercel --prod
```

### Step 3: Configure Environment Variables

In Vercel Dashboard:
1. Go to your project → Settings → Environment Variables
2. Add all your `.env` variables (Supabase, API keys, etc.)
3. Redeploy if needed

---

## 📱 Make Your App Installable (PWA)

Once deployed, users can install your app on any device!

### On Desktop (Chrome, Edge, Brave):
1. Visit your deployed URL
2. Look for the install icon in the address bar (🖥️ ➕)
3. Click "Install Studyverse Garden"
4. The app will appear as a desktop application!

### On Mobile (iOS Safari):
1. Visit your deployed URL
2. Tap the Share button
3. Tap "Add to Home Screen"
4. The app will appear as a native app icon!

### On Mobile (Android Chrome):
1. Visit your deployed URL
2. Tap the three dots menu
3. Tap "Install app" or "Add to Home Screen"
4. The app appears as a native app!

---

## 🔗 Custom Domain (Optional)

To use your own domain like `studyverse.com`:

1. Buy a domain from Namecheap, GoDaddy, etc.
2. In Vercel Dashboard: Settings → Domains
3. Add your custom domain
4. Update your domain's DNS settings (Vercel provides instructions)
5. Wait 24-48 hours for DNS propagation

---

## 🎯 Alternative Deployment Options

### Netlify (Free)
```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

### Railway (Free tier)
1. Go to [railway.app](https://railway.app)
2. Connect GitHub repo
3. Deploy automatically

### Render (Free tier)
1. Go to [render.com](https://render.com)
2. Connect GitHub repo
3. Select "Static Site" or "Web Service"
4. Deploy

---

## 🚀 Enable Demo Mode for Live Demo

After deploying, you can enable demo mode:

1. Visit your deployed URL
2. Click the "Demo" button in bottom-right corner
3. Click "Start Demo"
4. Share this URL - it will run continuously!

Or set demo mode by default by adding this to your environment variables:
```
NEXT_PUBLIC_DEMO_MODE=true
```

---

## 📊 Monitor Your App

### Vercel Analytics (Free)
- Automatically enabled
- View traffic, performance in Vercel Dashboard

### Add Custom Analytics
Add to `.env`:
```
NEXT_PUBLIC_GA_ID=your-google-analytics-id
```

---

## 🔧 Troubleshooting

### Build Fails
```bash
# Check for TypeScript errors
npm run typecheck

# Check for linting errors
npm run lint

# Try building locally first
npm run build
```

### Environment Variables Not Working
- Make sure to add them in Vercel Dashboard
- Redeploy after adding variables
- Check variable names match exactly

### PWA Not Installing
- Ensure HTTPS is enabled (automatic on Vercel)
- Check that `manifest.json` is accessible at `/manifest.json`
- Verify icons exist in `/public` folder

---

## 📝 Quick Checklist

- [ ] App builds successfully locally (`npm run build`)
- [ ] Icons generated (icon-192.png, icon-512.png, favicon.ico)
- [ ] Environment variables ready
- [ ] Deployed to Vercel
- [ ] Tested PWA installation on mobile/desktop
- [ ] Demo mode tested
- [ ] Custom domain configured (optional)

---

## 🎉 Your App is Live!

Share your link:
- **Website**: `https://your-app.vercel.app`
- **Install Instructions**: "Visit the link and click the install button!"

Users can now access your app 24/7 and install it on their devices! 🌱
