/*
  # Extend favorite_wallets for Wallet Library V1

  Adds scan persistence fields to the existing favorite_wallets table.
  Does NOT create a separate wallet_library table.

  New columns:
  - last_scanned_at  — timestamp of the most recent wallet scan
  - trade_count      — denormalized count from the last scan
  - saved_results    — JSONB array of WalletTradeResult objects from scan-wallet

  Also adds:
  - UNIQUE (user_id, wallet_address) — one library entry per wallet per user
  - UPDATE RLS policy — required for re-scan persistence in a later phase
*/

ALTER TABLE favorite_wallets
  ADD COLUMN IF NOT EXISTS last_scanned_at timestamptz,
  ADD COLUMN IF NOT EXISTS trade_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saved_results jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS favorite_wallets_user_wallet_unique
  ON favorite_wallets (user_id, wallet_address);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'favorite_wallets'
      AND policyname = 'Users can update own favorite wallets'
  ) THEN
    CREATE POLICY "Users can update own favorite wallets"
      ON favorite_wallets FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
