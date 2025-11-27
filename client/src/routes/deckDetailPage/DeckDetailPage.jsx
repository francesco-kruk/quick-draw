import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getDeck, updateDeck, deleteDeck } from '../../lib/decksService';
import { listCards, createCard, updateCard, deleteCard, getCard } from '../../lib/cardsService';
import CardItem from './CardItem';
import CardModal from './CardModal';
import EditDeckModal from '../../components/EditDeckModal';
import './deckDetailPage.css';

const DeckDetailPage = () => {
  const { deckId, cardId } = useParams();
  const navigate = useNavigate();

  // Deck state
  const [deck, setDeck] = useState(null);
  const [deckLoading, setDeckLoading] = useState(true);
  const [deckError, setDeckError] = useState(null);

  // Cards state
  const [cards, setCards] = useState([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [cardsError, setCardsError] = useState(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  // Deck edit modal state
  const [isEditDeckModalOpen, setIsEditDeckModalOpen] = useState(false);
  const [deletingDeck, setDeletingDeck] = useState(false);

  // Load deck
  useEffect(() => {
    const loadDeck = async () => {
      setDeckLoading(true);
      setDeckError(null);
      const { data, error } = await getDeck(deckId);
      if (error) {
        setDeckError('Failed to load deck. Please try again.');
        console.error('Error loading deck:', error);
      } else {
        setDeck(data);
      }
      setDeckLoading(false);
    };
    loadDeck();
  }, [deckId]);

  // Load cards
  const loadCards = useCallback(async () => {
    setCardsLoading(true);
    setCardsError(null);
    const { data, error } = await listCards(deckId);
    if (error) {
      setCardsError('Failed to load cards. Please try again.');
      console.error('Error loading cards:', error);
    } else {
      setCards(data || []);
    }
    setCardsLoading(false);
  }, [deckId]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  // Handle deep-link to card modal
  useEffect(() => {
    if (cardId && cardId !== 'new') {
      // Try to find card in existing list
      const existingCard = cards.find((c) => c.id === cardId);
      if (existingCard) {
        setEditingCard(existingCard);
        setIsModalOpen(true);
      } else if (!cardsLoading) {
        // Fetch single card if not in list
        const fetchCard = async () => {
          const { data, error } = await getCard(cardId);
          if (!error && data) {
            setEditingCard(data);
            setIsModalOpen(true);
          } else {
            // Card not found, navigate back
            navigate(`/decks/${deckId}`, { replace: true });
          }
        };
        fetchCard();
      }
    } else if (cardId === 'new') {
      setEditingCard(null);
      setIsModalOpen(true);
    } else {
      setIsModalOpen(false);
      setEditingCard(null);
    }
  }, [cardId, cards, cardsLoading, deckId, navigate]);

  const openCreateModal = () => {
    navigate(`/decks/${deckId}/new`);
  };

  const openEditModal = (card) => {
    navigate(`/decks/${deckId}/${card.id}`);
  };

  const closeModal = () => {
    navigate(`/decks/${deckId}`);
  };

  const handleCardSave = async ({ front_text, back_text }) => {
    if (editingCard) {
      // Update existing card
      const originalCard = editingCard;
      const updatedCard = {
        ...originalCard,
        front_text,
        back_text,
        updated_at: new Date().toISOString(),
      };

      // Optimistic update
      setCards((prev) => prev.map((c) => (c.id === originalCard.id ? updatedCard : c)));
      closeModal();

      const { data, error } = await updateCard(originalCard.id, { front_text, back_text });
      if (error) {
        // Rollback
        setCards((prev) => prev.map((c) => (c.id === originalCard.id ? originalCard : c)));
        console.error('Error updating card:', error);
        throw new Error('Failed to update card. Please try again.');
      } else {
        // Update with real data
        setCards((prev) => prev.map((c) => (c.id === originalCard.id ? data : c)));
      }
    } else {
      // Create new card
      const tempId = `temp-${Date.now()}`;
      const optimisticCard = {
        id: tempId,
        deck_id: deckId,
        front_text,
        back_text,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Optimistic add
      setCards((prev) => [optimisticCard, ...prev]);
      closeModal();

      const { data, error } = await createCard(deckId, { front_text, back_text });
      if (error) {
        // Rollback
        setCards((prev) => prev.filter((c) => c.id !== tempId));
        console.error('Error creating card:', error);
        throw new Error('Failed to create card. Please try again.');
      } else {
        // Replace temp with real data
        setCards((prev) => prev.map((c) => (c.id === tempId ? data : c)));
      }
    }
  };

  const handleDeleteCard = async (cardToDelete) => {
    const originalIndex = cards.findIndex((c) => c.id === cardToDelete.id);

    // Optimistic delete
    setCards((prev) => prev.filter((c) => c.id !== cardToDelete.id));
    setDeleteError(null);

    const { error } = await deleteCard(cardToDelete.id);
    if (error) {
      // Rollback
      setCards((prev) => {
        const newCards = [...prev];
        newCards.splice(originalIndex, 0, cardToDelete);
        return newCards;
      });
      setDeleteError('Failed to delete card. Please try again.');
      console.error('Error deleting card:', error);
    }
  };

  const handleEditDeck = async ({ name, language }) => {
    const originalDeck = deck;
    const updates = { name, language };

    // Optimistic update
    setDeck((prev) => ({ ...prev, ...updates, updated_at: new Date().toISOString() }));

    const { error: updateErr } = await updateDeck(deckId, updates);

    if (updateErr) {
      // Rollback
      setDeck(originalDeck);
      console.error('Error updating deck:', updateErr);
      throw new Error('Failed to update deck. Please try again.');
    }
  };

  const handleDeleteDeck = async () => {
    if (!window.confirm('Delete this deck and all its cards? This action cannot be undone.')) {
      return;
    }

    setDeletingDeck(true);

    const { error } = await deleteDeck(deckId);

    if (error) {
      setDeletingDeck(false);
      console.error('Error deleting deck:', error);
      alert('Failed to delete deck. Please try again.');
    } else {
      navigate('/decks');
    }
  };

  if (deckLoading) {
    return (
      <div className="deck-detail-page">
        <p className="loading-text">Loading deck...</p>
      </div>
    );
  }

  if (deckError) {
    return (
      <div className="deck-detail-page">
        <div className="error-message">{deckError}</div>
        <Link to="/decks" className="btn btn-secondary">
          Back to Decks
        </Link>
      </div>
    );
  }

  return (
    <div className="deck-detail-page">
      <div className="deck-detail-header">
        <Link to="/decks" className="back-link">
          ← Back to Decks
        </Link>
        <div className="deck-title-row">
          <h1>{deck?.name}</h1>
          {deck?.language && <span className="deck-language-badge">{deck.language}</span>}
          <span className="deck-cards-count-badge">
            {deck?.cards_count ?? cards.length} {(deck?.cards_count ?? cards.length) === 1 ? 'card' : 'cards'}
          </span>
          <button
            type="button"
            className="deck-header-edit-btn"
            onClick={() => setIsEditDeckModalOpen(true)}
            aria-label="Edit Deck"
            title="Edit Deck"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
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
        <div className="deck-meta-actions">
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleDeleteDeck}
            disabled={deletingDeck}
          >
            {deletingDeck ? 'Deleting...' : 'Delete Deck'}
          </button>
        </div>
      </div>

      {deleteError && <div className="error-message">{deleteError}</div>}
      {cardsError && <div className="error-message">{cardsError}</div>}

      <div className="cards-section">
        <div className="cards-header">
          <h2>Cards ({cards.length})</h2>
          <button type="button" className="btn btn-primary" onClick={openCreateModal}>
            Add Card
          </button>
        </div>

        {cardsLoading ? (
          <p className="loading-text">Loading cards...</p>
        ) : cards.length === 0 ? (
          <p className="empty-state">No cards yet. Add your first card to start learning!</p>
        ) : (
          <div className="cards-list">
            {cards.map((card) => (
              <CardItem
                key={card.id}
                card={card}
                onEdit={() => openEditModal(card)}
                onDelete={() => handleDeleteCard(card)}
              />
            ))}
          </div>
        )}
      </div>

      <CardModal
        isOpen={isModalOpen}
        onClose={closeModal}
        initialCard={editingCard}
        deckId={deckId}
        onSave={handleCardSave}
      />

      <EditDeckModal
        isOpen={isEditDeckModalOpen}
        onClose={() => setIsEditDeckModalOpen(false)}
        deck={deck}
        onSave={handleEditDeck}
      />
    </div>
  );
};

export default DeckDetailPage;
