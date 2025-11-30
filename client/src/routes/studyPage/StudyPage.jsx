import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { getDeck } from '../../lib/decksService';
import {
  ensureProgressForDeck,
  getDueCards,
  getSubDayCards,
  getAllLearningCards,
  gradeCardWithRating,
  saveSession,
  loadSession,
  clearSession,
  toUTC,
  RATING,
  CARD_STATE,
  getDeckOptions,
  previewNextIntervals,
  formatInterval,
} from '../../lib/srsService';
import './studyPage.css';

const StudyPage = () => {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [deck, setDeck] = useState(null);
  const [deckOptions, setDeckOptions] = useState(null);
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
      // Load deck info and options in parallel
      const [deckResult, optionsResult] = await Promise.all([
        getDeck(deckId),
        getDeckOptions(deckId),
      ]);

      if (deckResult.error) {
        throw new Error('Failed to load deck');
      }
      setDeck(deckResult.data);
      setDeckOptions(optionsResult.data || {});

      // Check for existing session
      const existingSession = loadSession(user.id, deckId);

      if (existingSession && existingSession.cardIds.length > 0) {
        // Resume session - rebuild queue from card IDs
        const nowUTC = toUTC();
        await ensureProgressForDeck(user.id, deckId, nowUTC);
        const { data: dueCards, error: cardsError } = await getDueCards(
          user.id,
          deckId,
          nowUTC
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
        const nowUTC = toUTC();
        await ensureProgressForDeck(user.id, deckId, nowUTC);
        const { data: dueCards, error: cardsError } = await getDueCards(
          user.id,
          deckId,
          nowUTC
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

  const handleGrade = async (rating) => {
    if (grading) return;

    const currentCard = queue[currentIndex];
    if (!currentCard) return;

    setGrading(true);

    try {
      const { error: gradeError } = await gradeCardWithRating(
        user.id,
        currentCard.card.id,
        rating,
        deckId
      );

      if (gradeError) {
        throw new Error('Failed to save grade');
      }

      // For learning cards with Again or Hard rating, we need to refresh the queue
      // to get the updated due time and potentially requeue the card
      const isAgainOrHard = rating === RATING.AGAIN || rating === RATING.HARD;
      const isLearningOrNew = currentCard.progress.state === CARD_STATE.LEARNING || 
                              currentCard.progress.state === CARD_STATE.NEW;
      
      if (isAgainOrHard && isLearningOrNew) {
        // Card will be requeued with a short delay - refresh from DB
        const nowUTC = toUTC();
        const { data: freshDueCards } = await getDueCards(user.id, deckId, nowUTC);
        
        // Also get sub-day cards that might be due soon
        const { data: subDayCards } = await getSubDayCards(user.id, deckId, nowUTC);
        
        // Combine due cards with sub-day cards, avoiding duplicates
        const dueCardIds = new Set((freshDueCards || []).map((item) => item.card.id));
        const additionalSubDayCards = (subDayCards || []).filter(
          (item) => !dueCardIds.has(item.card.id)
        );
        const combinedQueue = [...(freshDueCards || []), ...additionalSubDayCards];
        
        if (combinedQueue.length > 0) {
          setQueue(combinedQueue);
          setCurrentIndex(0);
          setRevealed(false);
          saveSession(
            user.id,
            deckId,
            combinedQueue.map((item) => item.card.id),
            0
          );
        } else {
          // No due cards but there might be a single card marked again/hard
          // that's not yet due - keep showing it until user marks good/easy
          if (currentCard) {
            // Re-fetch the current card's updated progress
            const { data: updatedProgress } = await getDueCards(user.id, deckId, nowUTC);
            const { data: updatedSubDay } = await getSubDayCards(user.id, deckId, nowUTC);
            
            // Find the current card in either list
            const allCards = [...(updatedProgress || []), ...(updatedSubDay || [])];
            const currentCardUpdated = allCards.find(
              (item) => item.card.id === currentCard.card.id
            );
            
            if (currentCardUpdated && currentCardUpdated.progress.state === CARD_STATE.LEARNING) {
              // Keep showing this card - it's still in learning
              setQueue([currentCardUpdated]);
              setCurrentIndex(0);
              setRevealed(false);
              saveSession(user.id, deckId, [currentCardUpdated.card.id], 0);
            } else {
              clearSession(user.id, deckId);
              setCompleted(true);
            }
          } else {
            // Before ending session, verify no learning cards remain
            const { data: remainingLearning } = await getAllLearningCards(user.id, deckId);
            if (remainingLearning && remainingLearning.length > 0) {
              // There are still learning cards - keep session alive with them
              setQueue(remainingLearning);
              setCurrentIndex(0);
              setRevealed(false);
              saveSession(user.id, deckId, remainingLearning.map((item) => item.card.id), 0);
            } else {
              clearSession(user.id, deckId);
              setCompleted(true);
            }
          }
        }
      } else {
        // Move to next card
        const newIndex = currentIndex + 1;

        if (newIndex >= queue.length) {
          // Check if there are more due cards (learning cards may have become due)
          const nowUTC = toUTC();
          const { data: freshDueCards } = await getDueCards(user.id, deckId, nowUTC);
          const { data: subDayCards } = await getSubDayCards(user.id, deckId, nowUTC);
          
          // Combine due cards with sub-day cards, avoiding duplicates
          const dueCardIds = new Set((freshDueCards || []).map((item) => item.card.id));
          const additionalSubDayCards = (subDayCards || []).filter(
            (item) => !dueCardIds.has(item.card.id)
          );
          const combinedQueue = [...(freshDueCards || []), ...additionalSubDayCards];
          
          if (combinedQueue.length > 0) {
            setQueue(combinedQueue);
            setCurrentIndex(0);
            setRevealed(false);
            saveSession(
              user.id,
              deckId,
              combinedQueue.map((item) => item.card.id),
              0
            );
          } else {
            // Before ending session, verify no learning cards remain
            const { data: remainingLearning } = await getAllLearningCards(user.id, deckId);
            if (remainingLearning && remainingLearning.length > 0) {
              // There are still learning cards - keep session alive with them
              setQueue(remainingLearning);
              setCurrentIndex(0);
              setRevealed(false);
              saveSession(user.id, deckId, remainingLearning.map((item) => item.card.id), 0);
            } else {
              // Session complete - no learning cards remain
              clearSession(user.id, deckId);
              setCompleted(true);
            }
          }
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
      if (loading || grading || error) return;

      // Normal study mode
      if (completed) return;

      if (!revealed) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          handleReveal();
        }
      } else {
        if (e.key === '0' || e.key.toLowerCase() === 'a') {
          handleGrade(RATING.AGAIN);
        } else if (e.key === '1') {
          handleGrade(RATING.HARD);
        } else if (e.key === '2') {
          handleGrade(RATING.GOOD);
        } else if (e.key === '3') {
          handleGrade(RATING.EASY);
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
            <div className="completion-actions">
              <button onClick={handleBackToDashboard} className="back-btn primary">
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
  const cardState = currentCard?.progress?.state || CARD_STATE.NEW;
  const isLearning = cardState === CARD_STATE.LEARNING || cardState === CARD_STATE.NEW;

  // Preview next intervals for each rating
  const intervals = currentCard
    ? previewNextIntervals(currentCard.progress, deckOptions)
    : null;

  return (
    <div className="study-page">
      <div className="study-content">
        {/* Header */}
        <div className="study-header">
          <button onClick={handleBackToDashboard} className="back-link">
            ← Back
          </button>
          <h1 className="deck-title">{deck?.name || 'Study'}</h1>
          <div className="header-right">
            {isLearning && (
              <span className="state-badge learning">Learning</span>
            )}
            <span className="progress-indicator">{progress}</span>
          </div>
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
                onClick={() => handleGrade(RATING.AGAIN)}
                className="grade-btn again"
                disabled={grading}
              >
                <span className="grade-interval">{intervals ? formatInterval(intervals.again) : ''}</span>
                Again
                <span className="keyboard-hint">0</span>
              </button>
              <button
                onClick={() => handleGrade(RATING.HARD)}
                className="grade-btn hard"
                disabled={grading}
              >
                <span className="grade-interval">{intervals ? formatInterval(intervals.hard) : ''}</span>
                Hard
                <span className="keyboard-hint">1</span>
              </button>
              <button
                onClick={() => handleGrade(RATING.GOOD)}
                className="grade-btn good"
                disabled={grading}
                autoFocus
              >
                <span className="grade-interval">{intervals ? formatInterval(intervals.good) : ''}</span>
                Good
                <span className="keyboard-hint">2</span>
              </button>
              <button
                onClick={() => handleGrade(RATING.EASY)}
                className="grade-btn easy"
                disabled={grading}
              >
                <span className="grade-interval">{intervals ? formatInterval(intervals.easy) : ''}</span>
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
