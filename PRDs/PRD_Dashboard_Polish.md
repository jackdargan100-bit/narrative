# PRD - Dashboard Polish

## Feature

Dashboard Polish

## Problem

The Dashboard currently feels unfinished when users have little or no data.

Several sections display generic placeholder messages such as:

* "Close a trade to see it here"
* "Watchlist is empty"

This creates the impression of an incomplete product.

## Goal

Make the Dashboard feel useful and intentional even when the user has not yet imported trades or added watchlist items.

## Target Users

* Solana traders
* Meme coin traders
* Copy traders
* Smart wallet followers

## Requirements

### Recent Closed Trades

Replace generic empty state with onboarding guidance.

Display:

* Short explanation
* Import Wallet button
* Log Trade button

Goal:

Help users understand what to do next.

---

### Watchlist

Replace generic empty state.

Display:

* Explanation of watchlist purpose
* Add Token button

Goal:

Encourage users to begin tracking tokens.

---

### Recent Activity

Replace generic empty state.

Display:

* Explanation of activity feed
* Guidance on how activity appears

Goal:

Help users understand the feature before using it.

---

### Empty State Design

All empty states should:

* Match existing Narrative design language
* Feel professional
* Feel intentional
* Include clear actions

Avoid:

* Generic placeholders
* Large empty spaces
* Developer-style messaging

---

## V1 Scope

Included:

* Better empty states
* Better onboarding messaging
* Better action buttons

Not Included:

* AI insights
* Dashboard analytics redesign
* New backend functionality
* Additional database tables

---

## Success Criteria

A brand-new user should immediately understand:

1. What the Dashboard is.
2. What actions are available.
3. What they should do next.

The Dashboard should feel complete even without user data.

