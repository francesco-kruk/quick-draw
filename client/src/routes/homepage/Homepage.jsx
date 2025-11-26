import { Link } from 'react-router-dom';
import './homepage.css';

const Homepage = () => {
  return (
    <div className="homepage">
      <h1>Quick Draw</h1>
      <p className="homepage-subtitle">Practice your flashcards with your personal AI language tutor</p>
      <div className="homepage-buttons">
        <Link to="/dashboard" className="btn btn-secondary">
          Sign In
        </Link>
        <Link to="/dashboard" className="btn btn-primary">
          Sign Up
        </Link>
      </div>
    </div>
  );
};

export default Homepage;
