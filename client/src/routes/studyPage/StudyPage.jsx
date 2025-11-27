import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { getDeck } from '../../lib/decksService';
import {
  ensureProgressForDeck,
  getDueCards,
  gradeCard,
  saveSession,
  loadSession,
  clearSession,
  toUTC,
  QUALITY,
} from '../../lib/srsService';
import './studyPage.css';

const StudyPage = () => {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [deck, setDeck] = useState(null);
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState(null);
  const [completed, setCompleted] = useState(false);

  // Load deck and queue on mount
  useEffect(() => {
    if (user && deckId) {
      loadStudySession();
    }
  }, [user, deckId]);

  const loadStudySession = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load deck info
      const { data: deckData, error: deckError } = await getDeck(deckId);
      if (deckError) {
        throw new Error('Failed to load deck');
      }
      setDeck(deckData);

      // Check for existing session
      const existingSession = loadSession(user.id, deckId);

      if (existingSession && existingSession.cardIds.length > 0) {
        // Resume session - rebuild queue from card IDs
        await ensureProgressForDeck(user.id, deckId);
        const { data: dueCards, error: cardsError } = await getDueCards(
          user.id,
          deckId,
          toUTC()
        );

        if (cardsError) {
          throw new Error('Failed to load cards');
        }

        // Filter to only cards that are still in the session
        const sessionCardSet = new Set(existingSession.cardIds);
        const cardMap = new Map(dueCards.map((item) => [item.card.id, item]));
        
        // Rebuild queue in session order, only including cards that are still due
        const resumedQueue = existingSession.cardIds
          .filter((id) => cardMap.has(id))
          .map((id) => cardMap.get(id));

        if (resumedQueue.length === 0) {
          // Session expired or all cards reviewed elsewhere
          clearSession(user.id, deckId);
          setCompleted(true);
        } else {
          setQueue(resumedQueue);
          // Ensure currentIndex is valid
          const newIndex = Math.min(existingSession.currentIndex, resumedQueue.length - 1);
          setCurrentIndex(newIndex);
          // Update session with potentially reduced queue
          saveSession(
            user.id,
            deckId,
            resumedQueue.map((item) => item.card.id),
            newIndex
          );
        }
      } else {
        // Start new session
        await ensureProgressForDeck(user.id, deckId);
        const { data: dueCards, error: cardsError } = await getDueCards(
          user.id,
          deckId,
          toUTC()
        );

        if (cardsError) {
          throw new Error('Failed to load cards');
        }

        if (!dueCards || dueCards.length === 0) {
          setCompleted(true);
        } else {
          setQueue(dueCards);
          setCurrentIndex(0);
          // Save new session
          saveSession(
            user.id,
            deckId,
            dueCards.map((item) => item.card.id),
            0
          );
        }
      }
    } catch (err) {
      console.error('Error loading study session:', err);
      setError(err.message || 'Failed to load study session');
    } finally {
      setLoading(false);
    }
  };

  const handleReveal = () => {
    setRevealed(true);
  };

  const handleGrade = async (quality) => {
    if (grading) return;

    const currentCard = queue[currentIndex];
    if (!currentCard) return;

    setGrading(true);

    try {
      const { error: gradeError } = await gradeCard(
        user.id,
        currentCard.card.id,
        quality
      );

      if (gradeError) {
        throw new Error('Failed to save grade');
      }

      // Move to next card
      const newIndex = currentIndex + 1;

      if (newIndex >= queue.length) {
        // Session complete
        clearSession(user.id, deckId);
        setCompleted(true);
      } else {
        setCurrentIndex(newIndex);
        setRevealed(false);
        // Update session
        saveSession(
          user.id,
          deckId,
          queue.map((item) => item.card.id),
          newIndex
        );
      }
    } catch (err) {
      console.error('Error grading card:', err);
      setError(err.message || 'Failed to save grade. Please try again.');
    } finally {
      setGrading(false);
    }
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  const handleKeyDown = useCallback(
    (e) => {
      if (loading || grading || completed || error) return;

      if (!revealed) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          handleReveal();
        }
      } else {
        if (e.key === '1') {
          handleGrade(QUALITY.HARD);
        } else if (e.key === '2') {
          handleGrade(QUALITY.GOOD);
        } else if (e.key === '3') {
          handleGrade(QUALITY.EASY);
        }
      }
    },
    [revealed, loading, grading, completed, error]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (loading) {
    return (
      <div className="study-page">
        <div className="study-content">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading cards...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="study-page">
        <div className="study-content">
          <div className="error-state">
            <p className="error-message">{error}</p>
            <div className="error-actions">
              <button onClick={loadStudySession} className="retry-btn">
                Try Again
              </button>
              <button onClick={handleBackToDashboard} className="back-btn">
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="study-page">
        <div className="study-content">
          <div className="completion-state" role="status" aria-live="polite">
            <div className="completion-icon">🎉</div>
            <h2>Review complete!</h2>
            <p>You've finished reviewing all due cards in this deck.</p>
            <button onClick={handleBackToDashboard} className="back-btn primary">
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentCard = queue[currentIndex];
  const progress = `${currentIndex + 1} / ${queue.length}`;

  return (
    <div className="study-page">
      <div className="study-content">
        {/* Header */}
        <div className="study-header">
          <button onClick={handleBackToDashboard} className="back-link">
            ← Back
          </button>
          <h1 className="deck-title">{deck?.name || 'Study'}</h1>
          <span className="progress-indicator">{progress}</span>
        </div>

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

        {/* Actions */}
        <div className="study-actions">
          {!revealed ? (
            <button
              onClick={handleReveal}
              className="reveal-btn"
              autoFocus
            >
              Show Answer
              <span className="keyboard-hint">Space</span>
            </button>
          ) : (
            <div className="grade-buttons">
              <button
                onClick={() => handleGrade(QUALITY.HARD)}
                className="grade-btn hard"
                disabled={grading}
              >
                Hard
                <span className="keyboard-hint">1</span>
              </button>
              <button
                onClick={() => handleGrade(QUALITY.GOOD)}
                className="grade-btn good"
                disabled={grading}
                autoFocus
              >
                Good
                <span className="keyboard-hint">2</span>
              </button>
              <button
                onClick={() => handleGrade(QUALITY.EASY)}
                className="grade-btn easy"
                disabled={grading}
              >
                Easy
                <span className="keyboard-hint">3</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudyPage;
