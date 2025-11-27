import { supabase } from './supabaseClient';

/**
 * List all decks for the current user, ordered by most recently updated
 */
export const listDecks = async () => {
  const { data, error } = await supabase
    .from('decks')
    .select('*')
    .order('updated_at', { ascending: false });

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
