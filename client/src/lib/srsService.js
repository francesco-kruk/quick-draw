import { supabase } from './supabaseClient';

/**
 * Spaced Repetition Service
 * Implements SM-2 algorithm adaptation for flashcard scheduling
 */

// Quality grades mapping: Hard=3, Good=4, Easy=5
export const QUALITY = {
  HARD: 3,
  GOOD: 4,
  EASY: 5,
};

/**
 * Convert a Date to UTC ISO string
 * @param {Date} date - The date to convert
 * @returns {string} ISO string in UTC
 */
export const toUTC = (date = new Date()) => {
  return date.toISOString();
};

/**
 * Calculate new SM-2 parameters based on quality grade
 * @param {Object} progress - Current progress state
 * @param {number} quality - Quality grade (3=Hard, 4=Good, 5=Easy)
 * @returns {Object} New progress values
 */
export const calculateSM2 = (progress, quality) => {
  let { repetitions, ease_factor, interval_days } = progress;

  // Calculate new ease factor
  // EF' = EF + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
  const q = quality;
  const efDelta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  let newEaseFactor = ease_factor + efDelta;

  // Clamp minimum EF to 1.3
  if (newEaseFactor < 1.3) {
    newEaseFactor = 1.3;
  }

  // Calculate new interval
  let newIntervalDays;
  if (repetitions === 0) {
    newIntervalDays = 1;
  } else if (repetitions === 1) {
    newIntervalDays = 6;
  } else {
    newIntervalDays = Math.round(interval_days * newEaseFactor);
  }

  // Increment repetitions (all current buttons are grade >= 3)
  const newRepetitions = repetitions + 1;

  // Calculate due_at
  const now = new Date();
  const dueAt = new Date(now.getTime() + newIntervalDays * 24 * 60 * 60 * 1000);

  return {
    repetitions: newRepetitions,
    ease_factor: newEaseFactor,
    interval_days: newIntervalDays,
    due_at: toUTC(dueAt),
    last_reviewed_at: toUTC(now),
  };
};

/**
 * Ensure progress rows exist for all cards in a deck
 * Missing rows are created with due_at = now (immediately due)
 * @param {string} userId - The user ID
 * @param {string} deckId - The deck ID
 * @param {string} nowUTC - Current time in UTC ISO string (optional)
 */
export const ensureProgressForDeck = async (userId, deckId, nowUTC = toUTC()) => {
  // Get all cards in the deck
  const { data: cards, error: cardsError } = await supabase
    .from('cards')
    .select('id')
    .eq('deck_id', deckId);

  if (cardsError) {
    console.error('Error fetching cards:', cardsError);
    return { error: cardsError };
  }

  if (!cards || cards.length === 0) {
    return { data: [], error: null };
  }

  const cardIds = cards.map((c) => c.id);

  // Get existing progress rows for this user and these cards
  const { data: existingProgress, error: progressError } = await supabase
    .from('card_progress')
    .select('card_id')
    .eq('user_id', userId)
    .in('card_id', cardIds);

  if (progressError) {
    console.error('Error fetching progress:', progressError);
    return { error: progressError };
  }

  const existingCardIds = new Set((existingProgress || []).map((p) => p.card_id));
  const missingCardIds = cardIds.filter((id) => !existingCardIds.has(id));

  // Insert missing progress rows
  if (missingCardIds.length > 0) {
    const newRows = missingCardIds.map((cardId) => ({
      user_id: userId,
      card_id: cardId,
      repetitions: 0,
      ease_factor: 2.5,
      interval_days: 0,
      due_at: nowUTC,
    }));

    const { error: insertError } = await supabase
      .from('card_progress')
      .insert(newRows);

    if (insertError) {
      console.error('Error inserting progress rows:', insertError);
      return { error: insertError };
    }
  }

  return { data: cardIds, error: null };
};

/**
 * Get all decks that have at least one due card for the user
 * @param {string} userId - The user ID
 * @param {string} nowUTC - Current time in UTC ISO string
 * @returns {Object} { data: decks[], error }
 */
export const getDueDecks = async (userId, nowUTC = toUTC()) => {
  // Get all user's decks
  const { data: decks, error: decksError } = await supabase
    .from('decks')
    .select('id, name, language, cards_count, created_at, updated_at')
    .order('updated_at', { ascending: false });

  if (decksError) {
    console.error('Error fetching decks:', decksError);
    return { data: null, error: decksError };
  }

  if (!decks || decks.length === 0) {
    return { data: [], error: null };
  }

  // For each deck, ensure progress and count due cards
  const dueDecks = [];

  for (const deck of decks) {
    // Ensure progress rows exist (use same nowUTC for consistent comparison)
    await ensureProgressForDeck(userId, deck.id, nowUTC);

    // Get cards in this deck
    const { data: cards, error: cardsError } = await supabase
      .from('cards')
      .select('id')
      .eq('deck_id', deck.id);

    if (cardsError) {
      console.error('Error fetching cards for deck:', deck.id, cardsError);
      continue;
    }

    if (!cards || cards.length === 0) {
      continue;
    }

    const cardIds = cards.map((c) => c.id);

    // Count due cards
    const { count, error: countError } = await supabase
      .from('card_progress')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('card_id', cardIds)
      .lte('due_at', nowUTC);

    if (countError) {
      console.error('Error counting due cards:', countError);
      continue;
    }

    if (count > 0) {
      dueDecks.push({
        ...deck,
        dueCount: count,
      });
    }
  }

  return { data: dueDecks, error: null };
};

/**
 * Get all due cards for a specific deck
 * @param {string} userId - The user ID
 * @param {string} deckId - The deck ID
 * @param {string} nowUTC - Current time in UTC ISO string
 * @returns {Object} { data: [{ card, progress }], error }
 */
export const getDueCards = async (userId, deckId, nowUTC = toUTC()) => {
  // Get all cards in the deck
  const { data: cards, error: cardsError } = await supabase
    .from('cards')
    .select('*')
    .eq('deck_id', deckId);

  if (cardsError) {
    console.error('Error fetching cards:', cardsError);
    return { data: null, error: cardsError };
  }

  if (!cards || cards.length === 0) {
    return { data: [], error: null };
  }

  const cardIds = cards.map((c) => c.id);

  // Get progress for these cards (only due ones)
  const { data: progressRows, error: progressError } = await supabase
    .from('card_progress')
    .select('*')
    .eq('user_id', userId)
    .in('card_id', cardIds)
    .lte('due_at', nowUTC)
    .order('due_at', { ascending: true });

  if (progressError) {
    console.error('Error fetching progress:', progressError);
    return { data: null, error: progressError };
  }

  // Build card + progress pairs
  const cardMap = new Map(cards.map((c) => [c.id, c]));
  const dueCards = (progressRows || []).map((progress) => ({
    card: cardMap.get(progress.card_id),
    progress,
  }));

  return { data: dueCards, error: null };
};

/**
 * Grade a card and update its progress using SM-2 algorithm
 * @param {string} userId - The user ID
 * @param {string} cardId - The card ID
 * @param {number} quality - Quality grade (3=Hard, 4=Good, 5=Easy)
 * @returns {Object} { data: updatedProgress, error }
 */
export const gradeCard = async (userId, cardId, quality) => {
  // Fetch current progress
  const { data: progress, error: fetchError } = await supabase
    .from('card_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('card_id', cardId)
    .single();

  if (fetchError) {
    console.error('Error fetching progress:', fetchError);
    return { data: null, error: fetchError };
  }

  // Calculate new values using SM-2
  const newValues = calculateSM2(progress, quality);

  // Update progress
  const { data: updated, error: updateError } = await supabase
    .from('card_progress')
    .update(newValues)
    .eq('id', progress.id)
    .select()
    .single();

  if (updateError) {
    console.error('Error updating progress:', updateError);
    return { data: null, error: updateError };
  }

  return { data: updated, error: null };
};

/**
 * Session persistence key generator
 * @param {string} userId - The user ID
 * @param {string} deckId - The deck ID
 * @returns {string} localStorage key
 */
export const getSessionKey = (userId, deckId) => {
  return `studySession:${userId}:${deckId}`;
};

/**
 * Save study session to localStorage
 * @param {string} userId - The user ID
 * @param {string} deckId - The deck ID
 * @param {string[]} cardIds - Array of card IDs in the queue
 * @param {number} currentIndex - Current position in queue
 */
export const saveSession = (userId, deckId, cardIds, currentIndex) => {
  const session = {
    version: 1,
    deckId,
    userId,
    cardIds,
    currentIndex,
    createdAt: toUTC(),
  };
  localStorage.setItem(getSessionKey(userId, deckId), JSON.stringify(session));
};

/**
 * Load study session from localStorage
 * @param {string} userId - The user ID
 * @param {string} deckId - The deck ID
 * @returns {Object|null} Session object or null if expired/missing
 */
export const loadSession = (userId, deckId) => {
  const key = getSessionKey(userId, deckId);
  const stored = localStorage.getItem(key);

  if (!stored) {
    return null;
  }

  try {
    const session = JSON.parse(stored);

    // Validate session structure
    if (session.version !== 1 || session.userId !== userId || session.deckId !== deckId) {
      localStorage.removeItem(key);
      return null;
    }

    // Check if session is older than 24 hours
    const sessionTime = new Date(session.createdAt).getTime();
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (now - sessionTime > maxAge) {
      localStorage.removeItem(key);
      return null;
    }

    return session;
  } catch (e) {
    console.error('Error parsing session:', e);
    localStorage.removeItem(key);
    return null;
  }
};

/**
 * Clear study session from localStorage
 * @param {string} userId - The user ID
 * @param {string} deckId - The deck ID
 */
export const clearSession = (userId, deckId) => {
  localStorage.removeItem(getSessionKey(userId, deckId));
};
