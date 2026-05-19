# Heartstrings Club — V1

This repository contains the V1 implementation of Heartstrings Club: a Next.js + Tailwind frontend with Next API routes, NeonDB integration, Resend email support, and placeholder AI chatbot logic.

Setup:

1. Copy `.env.example` to `.env.local` and fill values.
2. Install dependencies: `npm install`
3. Run dev server: `npm run dev`
4. Apply SQL schema in your NeonDB project using `database/schema.sql`.

Key features implemented:
- Auth (email/password), sessions via HttpOnly cookies
- Diary CRUD + calendar view
- Chatbot with persistent memory and safety filters
- Quotes book with chapters and favorites
- Gamification (streaks, badges)

Safety notes:
- Self-harm keyword detection in chatbot route returns helpline guidance.
- Harmful chatbot content is not persisted when safety filter triggers.
