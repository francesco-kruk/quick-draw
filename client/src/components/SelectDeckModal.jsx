import { useState, useEffect, useRef } from 'react';
import { LANGUAGES } from '../lib/languages';
import './selectDeckModal.css';

const SelectDeckModal = ({ isOpen, onClose, decks, onSelect, title = 'Select a Deck' }) => {
  const [selectedDeckId, setSelectedDeckId] = useState(null);
  const modalRef = useRef(null);

  // Reset selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedDeckId(null);
    }
  }, [isOpen]);

  // Handle ESC key and focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Focus trap
      if (e.key === 'Tab') {
        const focusableElements = modalRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusableElements || focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const getLanguageName = (code) => {
    if (!code) return null;
    const lang = LANGUAGES.find((l) => l.code === code);
    return lang ? lang.name : code;
  };

  const handleDeckClick = (deckId) => {
    setSelectedDeckId(deckId);
  };

  const handleDeckDoubleClick = (deckId) => {
    onSelect(deckId);
  };

  const handleConfirm = () => {
    if (selectedDeckId) {
      onSelect(selectedDeckId);
    }
  };

  const handleSelectAll = () => {
    onSelect(null); // null means all decks
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal select-deck-modal"
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="select-deck-title"
      >
        <div className="modal-header">
          <h2 id="select-deck-title">{title}</h2>
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-description">
            Choose a deck to preview, or study cards from all decks.
          </p>

          <div className="deck-list">
            {decks.map((deck) => (
              <button
                key={deck.id}
                className={`deck-option ${selectedDeckId === deck.id ? 'selected' : ''}`}
                onClick={() => handleDeckClick(deck.id)}
                onDoubleClick={() => handleDeckDoubleClick(deck.id)}
              >
                <span className="deck-option-name">{deck.name}</span>
                {deck.language && (
                  <span className="deck-option-language">
                    {getLanguageName(deck.language)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="all-decks-btn"
            onClick={handleSelectAll}
          >
            All Decks
          </button>
          <div className="footer-right">
            <button
              className="cancel-btn"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="confirm-btn"
              onClick={handleConfirm}
              disabled={!selectedDeckId}
            >
              Preview Deck
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SelectDeckModal;
