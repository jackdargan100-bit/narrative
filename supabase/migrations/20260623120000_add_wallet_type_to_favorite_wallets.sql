/*
  # Add wallet roles to favorite_wallets (Phase 10A)

  Distinguishes:
  - my      — user's own trading wallet
  - tracked — smart/research wallets in the library

  Existing rows default to 'tracked' for backwards compatibility.
  At most one 'my' wallet per user.
*/

ALTER TABLE favorite_wallets
  ADD COLUMN IF NOT EXISTS wallet_type text NOT NULL DEFAULT 'tracked';

ALTER TABLE favorite_wallets
  DROP CONSTRAINT IF EXISTS favorite_wallets_wallet_type_check;

ALTER TABLE favorite_wallets
  ADD CONSTRAINT favorite_wallets_wallet_type_check
  CHECK (wallet_type IN ('my', 'tracked'));

CREATE UNIQUE INDEX IF NOT EXISTS favorite_wallets_one_my_wallet_per_user
  ON favorite_wallets (user_id)
  WHERE wallet_type = 'my';
