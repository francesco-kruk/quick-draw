import './cardItem.css';

const MAX_PREVIEW_LENGTH = 100;

const truncateText = (text, maxLength = MAX_PREVIEW_LENGTH) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};

const CardItem = ({ card, onEdit, onDelete }) => {
  return (
    <div className="card-item">
      <div className="card-content">
        <div className="card-side">
          <span className="card-label">Front:</span>
          <span className="card-text">{truncateText(card.front_text)}</span>
        </div>
        <div className="card-side">
          <span className="card-label">Back:</span>
          <span className="card-text">{truncateText(card.back_text)}</span>
        </div>
      </div>
      <div className="card-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onEdit}
          aria-label={`Edit card: ${truncateText(card.front_text, 30)}`}
        >
          Edit
        </button>
        <button
          type="button"
          className="btn btn-danger btn-sm"
          onClick={onDelete}
          aria-label={`Delete card: ${truncateText(card.front_text, 30)}`}
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default CardItem;
