# LevelUp Fitness

A gamified daily tracker for weight, nutrition, water and steps — levels, streaks, quests and trophies that keep you honest across a 100-day challenge.

## Branding

The logo lives at `public/logo.png` and is referenced by the in-app `<Logo />` component, the favicon and the social (OG/Twitter) preview tags. Replace that one file to reskin the brand mark everywhere; a transparent PNG looks best against the wooden background.

## Tech stack

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Supabase (auth + database)

## Getting started

Requires Node.js & npm ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)).

```sh
# Install dependencies
npm install

# Copy environment variables and fill in your Supabase project details
cp .env.example .env

# Start the dev server
npm run dev
```

The app runs at http://localhost:8080.

## Environment variables

| Variable | Description |
| --- | --- |
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your Supabase anon/publishable key |
| `VITE_SUPABASE_PROJECT_ID` | Your Supabase project ID |

## Authentication

Sign-in uses Supabase's built-in Google OAuth provider (`supabase.auth.signInWithOAuth`). For Google sign-in to work, enable the Google provider under **Authentication → Providers** in your Supabase dashboard and add your app's URL(s) under **Authentication → URL Configuration**.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run preview` — preview a production build locally
- `npm run lint` — run ESLint
- `npm run test` — run tests
