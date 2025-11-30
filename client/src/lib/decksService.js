import { supabase } from './supabaseClient';

/**
 * List all decks for the current user, ordered by most recently updated.
 * Includes cards_count for scalable card counting.
 * Note: If cards_count drifts, run fn_recompute_deck_counts() on the database.
 */
export const listDecks = async () => {
  const { data, error } = await supabase
    .from('decks')
    .select('id, name, language, cards_count, created_at, updated_at')
    .order('updated_at', { ascending: false });

  return { data, error };
};

/**
 * Get a single deck by ID.
 * Includes cards_count for display.
 * @param {string} deckId - The deck ID
 */
export const getDeck = async (deckId) => {
  const { data, error } = await supabase
    .from('decks')
    .select('id, name, language, cards_count, created_at, updated_at')
    .eq('id', deckId)
    .single();

  return { data, error };
};

/**
 * Create a new deck
 * @param {Object} deck - The deck to create
 * @param {string} deck.name - Required deck name
 * @param {string} deck.language - Optional language
 */
export const createDeck = async ({ name, language }) => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    return { data: null, error: userError || new Error('Not authenticated') };
  }

  const { data, error } = await supabase
    .from('decks')
    .insert({
      user_id: user.id,
      name,
      language,
    })
    .select()
    .single();

  return { data, error };
};

/**
 * Update an existing deck
 * @param {string} id - The deck ID
 * @param {Object} updates - Fields to update
 * @param {string} updates.name - New deck name
 * @param {string} updates.language - New language
 */
export const updateDeck = async (id, { name, language }) => {
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (language !== undefined) updates.language = language;

  const { data, error } = await supabase
    .from('decks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  return { data, error };
};

/**
 * Delete a deck by ID
 * @param {string} id - The deck ID to delete
 */
export const deleteDeck = async (id) => {
  const { error } = await supabase
    .from('decks')
    .delete()
    .eq('id', id);

  return { error };
};

/**
 * Default SM-2 deck options
 */
const DEFAULT_DECK_OPTIONS = {
  easyBonus: 1.3,
  hardIntervalFactor: 1.2,
  lapseIntervalPercent: 10,
  intervalModifier: 1.0,
  maxIntervalDays: 36500,
  learningSteps: '10m,1d',
};

/**
 * Get SM-2 options for a deck
 * @param {string} deckId - The deck ID
 * @returns {Object} { data: deckOptions, error }
 */
export const getDeckOptions = async (deckId) => {
  const { data, error } = await supabase
    .from('decks')
    .select('easy_bonus, hard_interval_factor, lapse_interval_percent, interval_modifier, max_interval_days, learning_steps')
    .eq('id', deckId)
    .single();

  if (error) {
    return { data: null, error };
  }

  // Map snake_case to camelCase and apply defaults for null values
  const options = {
    easyBonus: data.easy_bonus ?? DEFAULT_DECK_OPTIONS.easyBonus,
    hardIntervalFactor: data.hard_interval_factor ?? DEFAULT_DECK_OPTIONS.hardIntervalFactor,
    lapseIntervalPercent: data.lapse_interval_percent ?? DEFAULT_DECK_OPTIONS.lapseIntervalPercent,
    intervalModifier: data.interval_modifier ?? DEFAULT_DECK_OPTIONS.intervalModifier,
    maxIntervalDays: data.max_interval_days ?? DEFAULT_DECK_OPTIONS.maxIntervalDays,
    learningSteps: data.learning_steps ?? DEFAULT_DECK_OPTIONS.learningSteps,
  };

  return { data: options, error: null };
};

/**
 * Update SM-2 options for a deck
 * @param {string} deckId - The deck ID
 * @param {Object} opts - The options to update
 * @returns {Object} { data: updatedOptions, error }
 */
export const updateDeckOptions = async (deckId, opts) => {
  const updates = {};
  if (opts.easyBonus !== undefined) updates.easy_bonus = opts.easyBonus;
  if (opts.hardIntervalFactor !== undefined) updates.hard_interval_factor = opts.hardIntervalFactor;
  if (opts.lapseIntervalPercent !== undefined) updates.lapse_interval_percent = opts.lapseIntervalPercent;
  if (opts.intervalModifier !== undefined) updates.interval_modifier = opts.intervalModifier;
  if (opts.maxIntervalDays !== undefined) updates.max_interval_days = opts.maxIntervalDays;
  if (opts.learningSteps !== undefined) updates.learning_steps = opts.learningSteps;

  const { data, error } = await supabase
    .from('decks')
    .update(updates)
    .eq('id', deckId)
    .select('easy_bonus, hard_interval_factor, lapse_interval_percent, interval_modifier, max_interval_days, learning_steps')
    .single();

  if (error) {
    return { data: null, error };
  }

  // Map back to camelCase
  const options = {
    easyBonus: data.easy_bonus,
    hardIntervalFactor: data.hard_interval_factor,
    lapseIntervalPercent: data.lapse_interval_percent,
    intervalModifier: data.interval_modifier,
    maxIntervalDays: data.max_interval_days,
    learningSteps: data.learning_steps,
  };

  return { data: options, error: null };
};
