/*
  # Add watchlist_items table

  New table for per-user token watchlist.
  - id, user_id, token_name, contract_address, notes, created_at
  - RLS enabled with full CRUD policies per user
*/

CREATE TABLE IF NOT EXISTS watchlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_name text NOT NULL DEFAULT '',
  contract_address text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE watchlist_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'watchlist_items' AND policyname = 'Users can select own watchlist'
  ) THEN
    CREATE POLICY "Users can select own watchlist"
      ON watchlist_items FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'watchlist_items' AND policyname = 'Users can insert own watchlist'
  ) THEN
    CREATE POLICY "Users can insert own watchlist"
      ON watchlist_items FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'watchlist_items' AND policyname = 'Users can update own watchlist'
  ) THEN
    CREATE POLICY "Users can update own watchlist"
      ON watchlist_items FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'watchlist_items' AND policyname = 'Users can delete own watchlist'
  ) THEN
    CREATE POLICY "Users can delete own watchlist"
      ON watchlist_items FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS watchlist_items_user_id_idx ON watchlist_items(user_id);
