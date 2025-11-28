import { useState, useEffect, useRef } from 'react';
import { LANGUAGES } from '../lib/languages';
import './editDeckModal.css';

const EditDeckModal = ({ isOpen, onClose, deck, onSave }) => {
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('');
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const modalRef = useRef(null);
  const nameInputRef = useRef(null);

  // Reset form when modal opens or deck changes
  useEffect(() => {
    if (isOpen && deck) {
      setName(deck.name || '');
      setLanguage(deck.language || '');
      setNameError('');
      setSaveError('');
      setSaving(false);
      // Focus name input after modal opens
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, deck]);

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

  const validate = () => {
    setNameError('');
    const trimmedName = name.trim();

    if (!trimmedName) {
      setNameError('Deck name is required');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setSaveError('');

    try {
      await onSave({
        name: name.trim(),
        language: language || null,
      });
      onClose();
    } catch (error) {
      setSaveError(error.message || 'Failed to save deck. Please try again.');
      setSaving(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div
        className="modal edit-deck-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-deck-modal-title"
        ref={modalRef}
      >
        <div className="modal-header">
          <h2 id="edit-deck-modal-title">Edit Deck</h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {saveError && <div className="modal-error">{saveError}</div>}

          <div className="form-group">
            <label htmlFor="deck-name">Name</label>
            <input
              id="deck-name"
              type="text"
              ref={nameInputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter deck name"
              className={nameError ? 'input-error' : ''}
              disabled={saving}
            />
            {nameError && <span className="inline-error">{nameError}</span>}
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !name.trim()}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditDeckModal;
