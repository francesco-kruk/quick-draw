import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import './signUpPage.css';

const SignUpPage = () => {
  const { signUp, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  // If already signed in, redirect to dashboard
  if (user) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const data = await signUp(email, password);
      
      // Check if email confirmation is required
      if (data?.user && !data?.session) {
        setSuccess(true);
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Failed to sign up. Please try again.');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="sign-up-page">
        <div className="sign-up-container">
          <h1>Check your email</h1>
          <p className="sign-up-subtitle">
            We've sent a confirmation link to <strong>{email}</strong>. 
            Please check your email and click the link to activate your account.
          </p>
          <p className="sign-up-footer">
            Already confirmed? <Link to="/sign-in">Sign in</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="sign-up-page">
      <div className="sign-up-container">
        <h1>Sign Up</h1>
        <p className="sign-up-subtitle">Create your account</p>
        
        {error && <div className="sign-up-error">{error}</div>}
        
        <form onSubmit={handleSubmit} className="sign-up-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
              disabled={loading}
            />
          </div>
          
          <button 
            type="submit"
            className="sign-up-btn" 
            disabled={loading}
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <p className="sign-up-footer">
          Already have an account? <Link to="/sign-in">Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default SignUpPage;
