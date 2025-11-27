import { supabase } from './supabaseClient';

/**
 * List all cards for a specific deck, ordered by most recently created
 * @param {string} deckId - The deck ID
 */
export const listCards = async (deckId) => {
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('deck_id', deckId)
    .order('created_at', { ascending: false });

  return { data, error };
};

/**
 * Get a single card by ID
 * @param {string} cardId - The card ID
 */
export const getCard = async (cardId) => {
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('id', cardId)
    .single();

  return { data, error };
};

/**
 * Create a new card in a deck
 * @param {string} deckId - The deck ID
 * @param {Object} card - The card to create
 * @param {string} card.front_text - Front text (required)
 * @param {string} card.back_text - Back text (required)
 */
export const createCard = async (deckId, { front_text, back_text }) => {
  const { data, error } = await supabase
    .from('cards')
    .insert({
      deck_id: deckId,
      front_text,
      back_text,
    })
    .select()
    .single();

  return { data, error };
};

/**
 * Update an existing card
 * @param {string} cardId - The card ID
 * @param {Object} updates - Fields to update
 * @param {string} updates.front_text - New front text
 * @param {string} updates.back_text - New back text
 */
export const updateCard = async (cardId, { front_text, back_text }) => {
  const updates = {};
  if (front_text !== undefined) updates.front_text = front_text;
  if (back_text !== undefined) updates.back_text = back_text;

  const { data, error } = await supabase
    .from('cards')
    .update(updates)
    .eq('id', cardId)
    .select()
    .single();

  return { data, error };
};

/**
 * Delete a card by ID
 * @param {string} cardId - The card ID to delete
 */
export const deleteCard = async (cardId) => {
  const { error } = await supabase
    .from('cards')
    .delete()
    .eq('id', cardId);

  return { error };
};
