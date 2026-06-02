# Narrative Decisions

## Product Focus

Narrative is a Solana-focused trading journal and analytics platform.

Narrative is currently focused on:

- Solana traders
- Meme coin traders
- Copy traders
- Smart wallet followers

Narrative is not intended to support:

- Stocks
- Forex
- Generic investing

at this stage.

## Wallet Library

Wallet Library V1 will:

- Save wallet addresses
- Support wallet nicknames
- Open previous scan results
- Re-scan wallets manually
- Delete saved wallets

Wallet Library V1 will NOT:

- Auto-refresh wallets
- Score wallets with AI
- Include copy trading automation
- Place trades

## Wallet Import

Wallet Import persistence is enabled.

Users should not lose scan results when navigating away.

## AI Features

AI should assist with:

- Trade reviews
- Journal summaries
- Mistake detection
- Pattern recognition

AI should not:

- Give financial advice
- Place trades
- Control wallets
- Require private keys

## Security

Narrative should never request:

- Seed phrases
- Private keys
- Exchange passwords

API keys should remain server-side where possible.

## Development Process

All major features require:

- PRD
- Minimal code changes
- Local testing
- Git commit
- GitHub push

## UX

Narrative should feel:

- Professional
- Fast
- Clean
- Focused

Avoid:

- Clutter
- Generic trading features
- Half-finished UI
- Unnecessary complexity