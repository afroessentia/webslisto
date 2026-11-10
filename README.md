# Webslisto

Build the foundation of an internal CRM web app called "WebListo CRM". It is a single-user tool for managing local business leads in Spain.

Enable the backend for this project (Lovable Cloud / Supabase). Do NOT create any tables yet. I will send the database migration in my next message.

Stack: React + TypeScript + Tailwind + Lucide icons + supabase-js + TanStack Query + shadcn/ui components.

Design system (dark theme only):

- Background #0B1118, surface/cards #111A24, borders #1E2B3A, muted text #8A9BB0, primary text white.

- Accent green #00D285 for primary buttons, success and the WhatsApp action. Hover: slightly darker green.

- Absolutely NO orange, amber or yellow tones anywhere. Warnings use a soft red (#F26D6D) or neutral gray-blue instead.

- Geometric, modern sans-serif font (use "Plus Jakarta Sans" or "Manrope" from Google Fonts).

- Rounded-xl cards, generous spacing, subtle borders, no heavy shadows.

- All UI text in Brazilian Portuguese.

- Mobile-first and fully responsive.

Auth: email + password login screen using Supabase Auth (no sign-up form, no social login). Protect all routes. Include a logout button.

Create the app shell with routes: "/" (dashboard) and "/login". Use placeholders for now.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://webslisto.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8c776d7f-1416-4178-b6f2-3131fc12761a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
