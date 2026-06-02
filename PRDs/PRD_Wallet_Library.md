# PRD - Wallet Library

## Feature

Saved Wallet Library

## Problem

Users repeatedly paste the same wallet addresses into Wallet Import.

This creates unnecessary friction and makes it difficult to revisit previously analyzed wallets.

## Goal

Allow users to save wallets and instantly reopen previous scan results without re-scanning.

## Target Users

* Solana traders
* Meme coin traders
* Copy traders
* Smart wallet followers

## Requirements

### Save Wallet

Users can save:

* Wallet address
* Optional nickname

Examples:

* Momentum Architect
* Conviction Swing
* Variance Surfer

### Wallet Card

Each saved wallet displays:

* Nickname
* Shortened wallet address
* Last scanned timestamp
* Number of imported trades

Example:

🧠 Momentum Architect

AXc9...Uw2g

49 trades
Last scanned 2 hours ago

[Open] [Re-scan] [Delete]

### Open Wallet

Clicking a wallet:

* Navigates to Wallet Import
* Loads previously saved scan results
* Does not trigger a new scan

### Re-scan Wallet

Users can manually re-scan a saved wallet.

Re-scan updates:

* Results
* Last scanned timestamp
* Trade count

### Delete Wallet

Users can permanently remove a wallet from the library.

## Data To Store

For each wallet:

* wallet_address
* nickname
* last_scanned_at
* trade_count
* saved_results

## V1 Scope

Included:

* Save wallet
* Open wallet
* Re-scan wallet
* Delete wallet
* Wallet nicknames

Not Included:

* Auto refresh
* AI wallet scoring
* Smart wallet rankings
* Social features
* Copy trading integration

## Success Criteria

Users can:

1. Save a wallet once.
2. Reopen it without pasting the address again.
3. Access previous scan results instantly.
4. Re-scan only when desired.

The user should never need to repeatedly paste the same wallet address.
