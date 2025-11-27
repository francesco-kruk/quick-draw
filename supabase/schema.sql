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
