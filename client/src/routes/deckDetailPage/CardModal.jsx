import { useState, useEffect, useRef } from 'react';
import './cardModal.css';

const MAX_TEXT_LENGTH = 500;

const CardModal = ({ isOpen, onClose, initialCard, deckId, onSave }) => {
  const [frontText, setFrontText] = useState('');
  const [backText, setBackText] = useState('');
  const [frontError, setFrontError] = useState('');
  const [backError, setBackError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const modalRef = useRef(null);
  const firstInputRef = useRef(null);
  const lastFocusableRef = useRef(null);

  const isEditing = !!initialCard?.id;

  // Reset form when modal opens/closes or initialCard changes
  useEffect(() => {
    if (isOpen) {
      setFrontText(initialCard?.front_text || '');
      setBackText(initialCard?.back_text || '');
      setFrontError('');
      setBackError('');
      setSaveError('');
      setSaving(false);
      // Focus first input after modal opens
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, initialCard]);

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
    let valid = true;
    setFrontError('');
    setBackError('');

    const trimmedFront = frontText.trim();
    const trimmedBack = backText.trim();

    if (!trimmedFront) {
      setFrontError('Front text is required');
      valid = false;
    } else if (trimmedFront.length > MAX_TEXT_LENGTH) {
      setFrontError(`Front text must be ${MAX_TEXT_LENGTH} characters or less`);
      valid = false;
    }

    if (!trimmedBack) {
      setBackError('Back text is required');
      valid = false;
    } else if (trimmedBack.length > MAX_TEXT_LENGTH) {
      setBackError(`Back text must be ${MAX_TEXT_LENGTH} characters or less`);
      valid = false;
    }

    return valid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setSaveError('');

    try {
      await onSave({
        front_text: frontText.trim(),
        back_text: backText.trim(),
      });
    } catch (error) {
      setSaveError(error.message || 'Failed to save card. Please try again.');
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
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        ref={modalRef}
      >
        <div className="modal-header">
          <h2 id="modal-title">{isEditing ? 'Edit Card' : 'Add New Card'}</h2>
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
            <label htmlFor="front-text">Front</label>
            <textarea
              id="front-text"
              ref={firstInputRef}
              value={frontText}
              onChange={(e) => setFrontText(e.target.value)}
              placeholder="Enter front text (question, word, etc.)"
              className={frontError ? 'input-error' : ''}
              disabled={saving}
              rows={4}
            />
            <div className="field-footer">
              {frontError && <span className="inline-error">{frontError}</span>}
              <span className="char-count">
                {frontText.length}/{MAX_TEXT_LENGTH}
              </span>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="back-text">Back</label>
            <textarea
              id="back-text"
              value={backText}
              onChange={(e) => setBackText(e.target.value)}
              placeholder="Enter back text (answer, translation, etc.)"
              className={backError ? 'input-error' : ''}
              disabled={saving}
              rows={4}
            />
            <div className="field-footer">
              {backError && <span className="inline-error">{backError}</span>}
              <span className="char-count">
                {backText.length}/{MAX_TEXT_LENGTH}
              </span>
            </div>
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
              disabled={saving}
              ref={lastFocusableRef}
            >
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Card'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CardModal;
