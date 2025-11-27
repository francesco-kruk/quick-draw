import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { listDecks, createDeck, updateDeck, deleteDeck } from '../../lib/decksService';
import { LANGUAGES } from '../../lib/languages';
import './decksPage.css';

const DecksPage = () => {
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Create form state
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckLanguage, setNewDeckLanguage] = useState('');
  const [createError, setCreateError] = useState(null);
  const [creating, setCreating] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editLanguage, setEditLanguage] = useState('');
  const [editError, setEditError] = useState(null);

  // Delete state
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

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

  const startEditing = (deck) => {
    setEditingId(deck.id);
    setEditName(deck.name);
    setEditLanguage(deck.language || '');
    setEditError(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName('');
    setEditLanguage('');
    setEditError(null);
  };

  const handleUpdate = async (deckId) => {
    if (!editName.trim()) {
      setEditError('Deck name is required');
      return;
    }

    const originalDeck = decks.find((d) => d.id === deckId);
    const updates = {
      name: editName.trim(),
      language: editLanguage || null,
    };

    // Optimistic update
    setDecks((prev) =>
      prev.map((d) =>
        d.id === deckId ? { ...d, ...updates, updated_at: new Date().toISOString() } : d
      )
    );
    setEditingId(null);

    const { error: updateErr } = await updateDeck(deckId, updates);

    if (updateErr) {
      // Rollback
      setDecks((prev) => prev.map((d) => (d.id === deckId ? originalDeck : d)));
      setEditingId(deckId);
      setEditError('Failed to update deck. Please try again.');
      console.error('Error updating deck:', updateErr);
    }
  };

  const handleDelete = async (deckId) => {
    const originalDeck = decks.find((d) => d.id === deckId);
    const originalIndex = decks.findIndex((d) => d.id === deckId);

    setDeletingId(deckId);
    setDeleteError(null);

    // Optimistic delete
    setDecks((prev) => prev.filter((d) => d.id !== deckId));

    const { error: deleteErr } = await deleteDeck(deckId);

    if (deleteErr) {
      // Rollback
      setDecks((prev) => {
        const newDecks = [...prev];
        newDecks.splice(originalIndex, 0, originalDeck);
        return newDecks;
      });
      setDeleteError(`Failed to delete "${originalDeck.name}". Please try again.`);
      console.error('Error deleting deck:', deleteErr);
    }

    setDeletingId(null);
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
      {deleteError && <div className="error-message">{deleteError}</div>}

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
            <li key={deck.id} className="deck-item">
              {editingId === deck.id ? (
                <div className="deck-edit-form">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={editError ? 'input-error' : ''}
                    autoFocus
                  />
                  <select
                    value={editLanguage}
                    onChange={(e) => setEditLanguage(e.target.value)}
                  >
                    <option value="">Select language</option>
                    {LANGUAGES.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </select>
                  <div className="deck-edit-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleUpdate(deck.id)}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={cancelEditing}
                    >
                      Cancel
                    </button>
                  </div>
                  {editError && <p className="inline-error">{editError}</p>}
                </div>
              ) : (
                <div className="deck-display">
                  <div className="deck-info">
                    <Link to={`/decks/${deck.id}`} className="deck-name deck-link">
                      {deck.name}
                    </Link>
                    {deck.language && (
                      <span className="deck-language">{deck.language}</span>
                    )}
                  </div>
                  <div className="deck-actions">
                    <Link
                      to={`/decks/${deck.id}`}
                      className="btn btn-secondary btn-sm"
                    >
                      View
                    </Link>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => startEditing(deck)}
                      disabled={deletingId === deck.id}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(deck.id)}
                      disabled={deletingId === deck.id}
                    >
                      {deletingId === deck.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default DecksPage;
