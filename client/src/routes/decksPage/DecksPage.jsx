import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listDecks, createDeck } from '../../lib/decksService';
import { LANGUAGES } from '../../lib/languages';
import './decksPage.css';

const DecksPage = () => {
  const navigate = useNavigate();
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Create form state
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckLanguage, setNewDeckLanguage] = useState('');
  const [createError, setCreateError] = useState(null);
  const [creating, setCreating] = useState(false);

  // Load decks on mount
  useEffect(() => {
    loadDecks();
  }, []);

  const loadDecks = async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await listDecks();
    if (fetchError) {
      setError('Failed to load decks. Please try again.');
      console.error('Error loading decks:', fetchError);
    } else {
      setDecks(data || []);
    }
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newDeckName.trim()) {
      setCreateError('Deck name is required');
      return;
    }

    setCreating(true);
    setCreateError(null);

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimisticDeck = {
      id: tempId,
      name: newDeckName.trim(),
      language: newDeckLanguage || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setDecks((prev) => [optimisticDeck, ...prev]);
    setNewDeckName('');
    setNewDeckLanguage('');

    const { data, error: createErr } = await createDeck({
      name: optimisticDeck.name,
      language: optimisticDeck.language,
    });

    if (createErr) {
      // Rollback
      setDecks((prev) => prev.filter((d) => d.id !== tempId));
      setCreateError('Failed to create deck. Please try again.');
      setNewDeckName(optimisticDeck.name);
      setNewDeckLanguage(optimisticDeck.language || '');
      console.error('Error creating deck:', createErr);
    } else {
      // Replace temp with real data
      setDecks((prev) => prev.map((d) => (d.id === tempId ? data : d)));
    }

    setCreating(false);
  };

  const openDeckDetail = (deck, e) => {
    e.stopPropagation();
    navigate(`/decks/${deck.id}`);
  };

  if (loading) {
    return (
      <div className="decks-page">
        <h1>Decks</h1>
        <p className="loading-text">Loading decks...</p>
      </div>
    );
  }

  return (
    <div className="decks-page">
      <h1>Decks</h1>

      {error && <div className="error-message">{error}</div>}

      {/* Create Deck Form */}
      <form className="create-deck-form" onSubmit={handleCreate}>
        <div className="form-row">
          <input
            type="text"
            placeholder="Deck name *"
            value={newDeckName}
            onChange={(e) => setNewDeckName(e.target.value)}
            className={createError ? 'input-error' : ''}
            disabled={creating}
          />
          <select
            value={newDeckLanguage}
            onChange={(e) => setNewDeckLanguage(e.target.value)}
            disabled={creating}
          >
            <option value="">Select language</option>
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-primary" disabled={creating}>
            {creating ? 'Creating...' : 'Create Deck'}
          </button>
        </div>
        {createError && <p className="inline-error">{createError}</p>}
      </form>

      {/* Decks List */}
      {decks.length === 0 ? (
        <p className="empty-state">No decks yet. Create your first deck above!</p>
      ) : (
        <ul className="decks-list">
          {decks.map((deck) => (
            <li key={deck.id} className="deck-item-wrapper">
              <div
                className="deck-item"
                aria-label={`${deck.name}, ${deck.cards_count ?? 0} cards${deck.language ? `, ${deck.language}` : ''}`}
              >
                <div className="deck-item-content">
                  <span className="deck-name">{deck.name}</span>
                  {deck.language && (
                    <span className="deck-language">{deck.language}</span>
                  )}
                  <span className="deck-card-count">
                    {deck.cards_count ?? 0} {(deck.cards_count ?? 0) === 1 ? 'card' : 'cards'}
                  </span>
                </div>
                <button
                  type="button"
                  className="deck-edit-btn"
                  onClick={(e) => openDeckDetail(deck, e)}
                  aria-label="View Deck Details"
                  title="View Deck Details"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

    </div>
  );
};

export default DecksPage;
