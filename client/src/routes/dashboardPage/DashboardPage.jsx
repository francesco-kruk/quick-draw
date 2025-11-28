import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { getDueDecks, toUTC } from '../../lib/srsService';
import { listDecks } from '../../lib/decksService';
import { LANGUAGES } from '../../lib/languages';
import './dashboardPage.css';

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dueDecks, setDueDecks] = useState([]);
  const [hasDecks, setHasDecks] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) {
      loadDueDecks();
    }
  }, [user]);

  const loadDueDecks = async () => {
    setLoading(true);
    setError(null);

    // First check if user has any decks
    const { data: allDecks, error: decksError } = await listDecks();

    if (decksError) {
      setError('Failed to load decks. Please try again.');
      console.error('Error loading decks:', decksError);
      setLoading(false);
      return;
    }

    if (!allDecks || allDecks.length === 0) {
      setHasDecks(false);
      setDueDecks([]);
      setLoading(false);
      return;
    }

    setHasDecks(true);

    const nowUTC = toUTC();
    const { data, error: fetchError } = await getDueDecks(user.id, nowUTC);

    if (fetchError) {
      setError('Failed to load due decks. Please try again.');
      console.error('Error loading due decks:', fetchError);
    } else {
      setDueDecks(data || []);
    }

    setLoading(false);
  };

  const startStudy = (deckId) => {
    navigate(`/study/${deckId}`);
  };

  const getLanguageName = (code) => {
    const lang = LANGUAGES.find((l) => l.code === code);
    return lang ? lang.name : code;
  };

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-content">
          <h1>Dashboard</h1>
          <p className="loading-text">Loading due cards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-content">
        <h1>Dashboard</h1>

        {error && (
          <div className="error-message">
            {error}
            <button onClick={loadDueDecks} className="retry-btn">
              Retry
            </button>
          </div>
        )}

        {!error && !hasDecks && (
          <div className="empty-state">
            <div className="empty-icon">👋</div>
            <h2>Welcome to Quick Draw!</h2>
            <p>Create your first deck and add cards to start learning.</p>
            <button onClick={() => navigate('/decks')} className="browse-decks-btn">
              Create Deck
            </button>
          </div>
        )}

        {!error && hasDecks && dueDecks.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🎉</div>
            <h2>No cards due!</h2>
            <p>Great job! You've reviewed all your cards for now.</p>
            <button onClick={() => navigate('/decks')} className="browse-decks-btn">
              Browse Decks
            </button>
          </div>
        )}

        {dueDecks.length > 0 && (
          <>
            <p className="dashboard-subtitle">
              {dueDecks.length} {dueDecks.length === 1 ? 'deck has' : 'decks have'} cards ready for review
            </p>
            <ul className="due-decks-list">
              {dueDecks.map((deck) => (
                <li key={deck.id} className="due-deck-item-wrapper">
                  <button
                    className="due-deck-item"
                    onClick={() => startStudy(deck.id)}
                    aria-label={`Study ${deck.name}`}
                  >
                    <div className="due-deck-content">
                      <span className="due-deck-name">{deck.name}</span>
                      {deck.language && (
                        <span className="due-deck-language">
                          {getLanguageName(deck.language)}
                        </span>
                      )}
                    </div>
                    <div className="due-deck-stats">
                      <span className="due-count">{deck.dueCount} due</span>
                      <span className="study-arrow">→</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
