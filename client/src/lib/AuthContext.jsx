import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let subscription = null;

    const initAuth = async () => {
      try {
        // Set up auth listener first to avoid race conditions
        const { data } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            setSession(session);
            setUser(session?.user ?? null);

            // Upsert profile on sign in (handles both new and returning users)
            if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
              await upsertProfile(session.user);
            }
            
            // Set loading to false after initial session is processed
            if (event === 'INITIAL_SESSION') {
              setLoading(false);
            }
          }
        );
        subscription = data?.subscription;
      } catch (error) {
        console.error('Failed to set up auth listener:', error);
        setLoading(false);
      }
    };

    initAuth();

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Upsert user profile on first sign-in
  const upsertProfile = async (user) => {
    const { error } = await supabase
      .from('profiles')
      .upsert(
        { id: user.id, email: user.email },
        { onConflict: 'id' }
      );

    if (error) {
      console.error('Error upserting profile:', error);
    }
  };

  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      console.error('Error signing up:', error);
      throw error;
    }

    return data;
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Error signing in:', error);
      throw error;
    }

    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const refreshUser = async () => {
    const { data: { user: refreshedUser }, error } = await supabase.auth.getUser();
    if (error) {
      console.error('Error refreshing user:', error);
      throw error;
    }
    setUser(refreshedUser);
    return refreshedUser;
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
