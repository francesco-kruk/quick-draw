/**
 * Session Service for study session persistence
 * Handles saving/loading study sessions to/from localStorage
 */

import { toUTC } from './dateUtils';

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
