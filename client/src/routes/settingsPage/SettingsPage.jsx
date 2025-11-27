import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import './settingsPage.css';

const SettingsPage = () => {
  const { user, signOut } = useAuth();
  
  // Email state
  const [email, setEmail] = useState('');
  const [originalEmail, setOriginalEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState('unverified');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  
  // Profile state
  const [joinedDate, setJoinedDate] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // Initialize state from user
  useEffect(() => {
    if (user) {
      setEmail(user.email || '');
      setOriginalEmail(user.email || '');
      setJoinedDate(user.created_at ? new Date(user.created_at) : null);
      
      // Compute email status
      computeEmailStatus();
    }
  }, [user]);

  const computeEmailStatus = () => {
    if (!user) {
      setEmailStatus('unverified');
      return;
    }
    
    if (user.email_confirmed_at) {
      setEmailStatus('verified');
    } else if (user.email_change_sent_at) {
      setEmailStatus('pending');
    } else {
      setEmailStatus('unverified');
    }
  };

  // Fetch joined date from profiles if needed
  useEffect(() => {
    const fetchProfileDate = async () => {
      if (!joinedDate && user) {
        const { data } = await supabase
          .from('profiles')
          .select('created_at')
          .eq('id', user.id)
          .single();
        
        if (data?.created_at) {
          setJoinedDate(new Date(data.created_at));
        }
      }
    };
    
    fetchProfileDate();
  }, [user, joinedDate]);

  const getUserDisplayName = () => {
    if (user?.user_metadata?.name) {
      return user.user_metadata.name;
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'User';
  };

  const handleEmailUpdate = async (e) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    
    if (email === originalEmail) {
      setMessage('No changes to save');
      return;
    }
    
    setSaving(true);
    setError(null);
    setMessage(null);
    
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        email: email.trim()
      });
      
      if (updateError) {
        throw updateError;
      }
      
      setEmailStatus('pending');
      setMessage('Check your inbox to confirm your new email address.');
    } catch (err) {
      setError(err.message || 'Failed to update email. Please try again.');
      setEmail(originalEmail);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      // RequireAuth will handle redirect
    } catch (err) {
      console.error('Logout error:', err);
      setLoggingOut(false);
    }
  };

  const getStatusBadgeClass = () => {
    return `status-badge ${emailStatus}`;
  };

  const getStatusLabel = () => {
    switch (emailStatus) {
      case 'verified':
        return 'Verified';
      case 'pending':
        return 'Pending';
      default:
        return 'Unverified';
    }
  };

  return (
    <div className="settings-page">
      <h1>Settings</h1>
      
      {/* Profile Section */}
      <section className="settings-section">
        <h2>Profile</h2>
        <div className="profile-info">
          <div className="profile-row">
            <span className="profile-label">Name</span>
            <span className="profile-value">{getUserDisplayName()}</span>
          </div>
          {joinedDate && (
            <div className="profile-row">
              <span className="profile-label">Joined</span>
              <span className="profile-value">
                {joinedDate.toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </section>
      
      {/* Email Section */}
      <section className="settings-section">
        <h2>Email</h2>
        
        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}
        
        <form className="email-form" onSubmit={handleEmailUpdate}>
          <div className="email-input-row">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              disabled={saving}
              className={error ? 'input-error' : ''}
            />
            <span className={getStatusBadgeClass()}>
              {getStatusLabel()}
            </span>
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || email === originalEmail}
          >
            {saving ? 'Saving...' : 'Update Email'}
          </button>
        </form>
      </section>
      
      {/* Logout Section */}
      <section className="settings-section logout-section">
        <button
          type="button"
          className="btn btn-danger btn-logout"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? 'Logging out...' : 'Log Out'}
        </button>
      </section>
    </div>
  );
};

export default SettingsPage;
