import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { listDecks, getDeck } from '../../lib/decksService';
import {
  getSubDayCards,
  getUpcomingCards,
  toUTC,
} from '../../lib/srsService';
import './previewPage.css';

const PreviewPage = () => {
  const navigate = useNavigate();
  const { deckId } = useParams();
  const { user } = useAuth();

  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deckName, setDeckName] = useState(null);

  useEffect(() => {
    if (user) {
      loadPreviewCards();
    }
  }, [user, deckId]);

  const loadPreviewCards = async () => {
    setLoading(true);
    setError(null);

    try {
      let decksToPreview = [];

      if (deckId) {
        // Fetch specific deck
        const { data: deck, error: deckError } = await getDeck(deckId);

        if (deckError || !deck) {
          throw new Error('Deck not found');
        }

        decksToPreview = [deck];
        setDeckName(deck.name);
      } else {
        // Get all user decks
        const { data: allDecks, error: decksError } = await listDecks();

        if (decksError) {
          throw new Error('Failed to load decks');
        }

        if (!allDecks || allDecks.length === 0) {
          setError('No decks found.');
          setLoading(false);
          return;
        }

        decksToPreview = allDecks;
        setDeckName(null);
      }

      const nowUTC = toUTC();
      const allPreviewCards = [];

      // Gather preview cards from selected decks
      for (const deck of decksToPreview) {
        // Fetch sub-day future learning cards
        const { data: subDayCards } = await getSubDayCards(user.id, deck.id, nowUTC);

        // Fetch upcoming review cards
        const { data: upcomingCards } = await getUpcomingCards(user.id, deck.id, nowUTC, 25);

        // Merge and add deck info
        const cardMap = new Map();
        for (const item of subDayCards || []) {
          cardMap.set(item.card.id, { ...item, deckName: deck.name });
        }
        for (const item of upcomingCards || []) {
          if (!cardMap.has(item.card.id)) {
            cardMap.set(item.card.id, { ...item, deckName: deck.name });
          }
        }

        allPreviewCards.push(...cardMap.values());
      }

      // Sort by due_at ascending
      allPreviewCards.sort(
        (a, b) => new Date(a.progress.due_at) - new Date(b.progress.due_at)
      );

      // Take first 10
      const previewItems = allPreviewCards.slice(0, 10);

      if (previewItems.length === 0) {
        setError('No upcoming cards to preview.');
        setLoading(false);
        return;
      }

      setQueue(previewItems);
      setCurrentIndex(0);
      setRevealed(false);
    } catch (err) {
      console.error('Error loading preview:', err);
      setError('Failed to load preview cards.');
    } finally {
      setLoading(false);
    }
  };

  const handleReveal = () => {
    setRevealed(true);
  };

  const handleNext = () => {
    if (currentIndex + 1 >= queue.length) {
      // Preview complete
      navigate('/dashboard');
    } else {
      setCurrentIndex(currentIndex + 1);
      setRevealed(false);
    }
  };

  const handleQuit = () => {
    navigate('/dashboard');
  };

  const handleKeyDown = useCallback(
    (e) => {
      if (loading || error) return;

      if (!revealed) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          handleReveal();
        }
      } else {
        if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === ' ') {
          e.preventDefault();
          handleNext();
        }
      }

      // Quit shortcuts
      if (e.key === 'Escape' || e.key.toLowerCase() === 'q') {
        e.preventDefault();
        handleQuit();
      }
    },
    [revealed, loading, error, currentIndex, queue]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (loading) {
    return (
      <div className="preview-page">
        <div className="preview-content">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading preview cards...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="preview-page">
        <div className="preview-content">
          <div className="error-state">
            <p className="error-message">{error}</p>
            <div className="error-actions">
              <button onClick={loadPreviewCards} className="retry-btn">
                Try Again
              </button>
              <button onClick={handleQuit} className="back-btn">
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentCard = queue[currentIndex];
  const progress = `${currentIndex + 1} / ${queue.length}`;
  const displayTitle = deckName || currentCard?.deckName || 'Preview';

  return (
    <div className="preview-page">
      <div className="preview-content">
        {/* Header */}
        <div className="preview-header">
          <button onClick={handleQuit} className="back-link">
            ← Quit
          </button>
          <h1 className="deck-title">{displayTitle}</h1>
          <div className="header-right">
            <span className="state-badge preview">Preview</span>
            <span className="progress-indicator">{progress}</span>
          </div>
        </div>

        {/* Preview Disclaimer */}
        <p className="preview-disclaimer">Preview only — schedule unchanged</p>

        {/* Card */}
        <div className="flashcard">
          <div className="card-front">
            <p>{currentCard?.card.front_text}</p>
          </div>

          {revealed && (
            <div className="card-back">
              <div className="divider"></div>
              <p>{currentCard?.card.back_text}</p>
            </div>
          )}
        </div>

        {/* Preview Actions */}
        <div className="preview-actions">
          {!revealed ? (
            <button
              onClick={handleReveal}
              className="reveal-btn"
              autoFocus
            >
              Show Answer
              <span className="keyboard-hint">Space</span>
            </button>
          ) : currentIndex + 1 >= queue.length ? (
            <button
              onClick={handleQuit}
              className="quit-btn"
              autoFocus
            >
              Quit
              <span className="keyboard-hint">Esc</span>
            </button>
          ) : (
            <div className="preview-buttons">
              <button
                onClick={handleNext}
                className="next-btn"
                autoFocus
              >
                Next
                <span className="keyboard-hint">Enter</span>
              </button>
              <button
                onClick={handleQuit}
                className="quit-btn"
              >
                Quit
                <span className="keyboard-hint">Esc</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PreviewPage;
