# Narrative - Project Handoff

## Overview

Narrative is a Solana-focused trading journal and analytics platform.

Target users:

* Solana traders
* Meme coin traders
* Copy traders
* Smart wallet followers

## Current Stack

Frontend:

* React
* TypeScript
* Vite

Backend:

* Supabase

External APIs:

* Helius
* Birdeye

## Current Status

Working:

* Authentication
* Dashboard
* Trade Journal
* Quick Journal
* Wallet Import
* API Health Checks
* Token Information

Recently Completed:

* Wallet scan persistence
* Supabase Edge Function deployment

## Supabase

Project Ref:

gvzcaylcjfxjmcjmhwbh

Functions:

* api-health
* scan-wallet
* token-info

## Git Workflow

Before coding:

git status

After changes:

git diff --stat

Test:

npm run dev

Then:

git add
git commit
git push

## Known Issues

* Dashboard empty states need improvement
* Watchlist needs improvement
* App.tsx is becoming large and should eventually be split into components

## Current Priorities

1. Dashboard polish
2. Saved Wallet Library
3. Analytics improvements
4. Privacy / Terms / Contact
5. AI-assisted trade reviews
