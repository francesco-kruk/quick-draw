-- Quick Draw Database Schema + RLS Policies
-- Run this in your Supabase SQL Editor (Database > SQL Editor)

-- ======================
-- PROFILES TABLE
-- ======================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies: users can only access their own profile
CREATE POLICY "Users can view their own profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ======================
-- DECKS TABLE
-- ======================
CREATE TABLE IF NOT EXISTS decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  language TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on decks
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;

-- Decks policies: users can only access their own decks
CREATE POLICY "Users can view their own decks"
  ON decks
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own decks"
  ON decks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own decks"
  ON decks
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own decks"
  ON decks
  FOR DELETE
  USING (auth.uid() = user_id);

-- ======================
-- HELPER FUNCTION FOR updated_at
-- ======================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on decks
CREATE TRIGGER update_decks_updated_at
  BEFORE UPDATE ON decks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ======================
-- CARDS TABLE
-- ======================
CREATE TABLE IF NOT EXISTS public.cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
  front_text TEXT NOT NULL,
  back_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optional length constraints
ALTER TABLE public.cards
  ADD CONSTRAINT cards_front_text_length CHECK (char_length(front_text) <= 500),
  ADD CONSTRAINT cards_back_text_length CHECK (char_length(back_text) <= 500);

-- Trigger to auto-update updated_at on cards
CREATE TRIGGER update_cards_updated_at
  BEFORE UPDATE ON public.cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on cards
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

-- Cards policies: users can only access cards in their own decks
CREATE POLICY "Cards Select" ON public.cards
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.decks d WHERE d.id = deck_id AND d.user_id = auth.uid())
  );

CREATE POLICY "Cards Insert" ON public.cards
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.decks d WHERE d.id = deck_id AND d.user_id = auth.uid())
  );

CREATE POLICY "Cards Update" ON public.cards
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.decks d WHERE d.id = deck_id AND d.user_id = auth.uid())
  );

CREATE POLICY "Cards Delete" ON public.cards
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.decks d WHERE d.id = deck_id AND d.user_id = auth.uid())
  );

-- ======================
-- CARDS COUNT COLUMN & TRIGGERS
-- ======================

-- Add cards_count column to decks
ALTER TABLE decks ADD COLUMN IF NOT EXISTS cards_count INT NOT NULL DEFAULT 0;

-- Backfill existing decks with card counts
UPDATE decks d
SET cards_count = (
  SELECT COUNT(*) FROM cards c WHERE c.deck_id = d.id
);

-- Function to increment cards_count
CREATE OR REPLACE FUNCTION fn_cards_count_inc()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE decks SET cards_count = cards_count + 1 WHERE id = NEW.deck_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to decrement cards_count
CREATE OR REPLACE FUNCTION fn_cards_count_dec()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE decks SET cards_count = GREATEST(cards_count - 1, 0) WHERE id = OLD.deck_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Function to handle deck_id change (move card between decks)
CREATE OR REPLACE FUNCTION fn_cards_count_move()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.deck_id IS DISTINCT FROM NEW.deck_id THEN
    UPDATE decks SET cards_count = GREATEST(cards_count - 1, 0) WHERE id = OLD.deck_id;
    UPDATE decks SET cards_count = cards_count + 1 WHERE id = NEW.deck_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: increment count after card insert
CREATE TRIGGER cards_count_after_insert
  AFTER INSERT ON cards
  FOR EACH ROW
  EXECUTE FUNCTION fn_cards_count_inc();

-- Trigger: decrement count after card delete
CREATE TRIGGER cards_count_after_delete
  AFTER DELETE ON cards
  FOR EACH ROW
  EXECUTE FUNCTION fn_cards_count_dec();

-- Trigger: adjust counts when card moves to different deck
CREATE TRIGGER cards_count_on_update
  BEFORE UPDATE ON cards
  FOR EACH ROW
  WHEN (OLD.deck_id IS DISTINCT FROM NEW.deck_id)
  EXECUTE FUNCTION fn_cards_count_move();

-- Future: Optional function to recompute all deck counts if drift suspected
-- CREATE OR REPLACE FUNCTION fn_recompute_deck_counts() RETURNS VOID AS $$
-- BEGIN
--   UPDATE decks d SET cards_count = (SELECT COUNT(*) FROM cards c WHERE c.deck_id = d.id);
-- END;
-- $$ LANGUAGE plpgsql;

-- ======================
-- CARD_PROGRESS TABLE (Spaced Repetition)
-- ======================
CREATE TABLE IF NOT EXISTS public.card_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  repetitions INT NOT NULL DEFAULT 0,
  ease_factor REAL NOT NULL DEFAULT 2.5,
  interval_days INT NOT NULL DEFAULT 0,
  due_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, card_id)
);

-- Enable RLS on card_progress
ALTER TABLE public.card_progress ENABLE ROW LEVEL SECURITY;

-- Card progress policies: users can only access their own progress
CREATE POLICY "Users can view their own card progress"
  ON public.card_progress
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own card progress"
  ON public.card_progress
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own card progress"
  ON public.card_progress
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own card progress"
  ON public.card_progress
  FOR DELETE
  USING (auth.uid() = user_id);
