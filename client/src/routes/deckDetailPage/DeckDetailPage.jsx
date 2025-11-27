import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getDeck } from '../../lib/decksService';
import { listCards, createCard, updateCard, deleteCard, getCard } from '../../lib/cardsService';
import CardItem from './CardItem';
import CardModal from './CardModal';
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
    </div>
  );
};

export default DeckDetailPage;
