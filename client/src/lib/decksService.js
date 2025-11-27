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
