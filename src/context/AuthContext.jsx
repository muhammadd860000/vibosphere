import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  auth, 
  db, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  doc, 
  setDoc, 
  getDoc, 
  updateDoc,
  collection,
  getDocs,
  query,
  where
} from '../firebase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    // Listen to Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await fetchUserProfile(firebaseUser.uid, firebaseUser.email);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchUserProfile = async (uid, fallbackEmail) => {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        setUser({
          id: uid,
          uid,
          ...userData,
          followerCount: userData.followers?.length || 0,
          followingCount: userData.following?.length || 0
        });
      } else {
        // Fallback user state
        setUser({
          id: uid,
          uid,
          email: fallbackEmail,
          username: fallbackEmail?.split('@')[0] || 'user',
          name: fallbackEmail?.split('@')[0] || 'User',
          followers: [],
          following: [],
          followerCount: 0,
          followingCount: 0
        });
      }
    } catch (err) {
      console.error('Error fetching user profile from Firestore:', err);
    } finally {
      setLoading(false);
    }
  };

  const signup = async ({ email, password, username, name }) => {
    try {
      // 1. Create Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // 2. Create User Profile Document in Firestore
      const newUserProfile = {
        id: uid,
        uid,
        username: username.toLowerCase().trim(),
        name: name || username,
        email,
        bio: '',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
        banner: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80',
        followers: [],
        following: [],
        verified: false,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', uid), newUserProfile);
      
      setUser({ ...newUserProfile, followerCount: 0, followingCount: 0 });
      setNeedsOnboarding(true);
      return newUserProfile;
    } catch (err) {
      console.error('Firebase Signup error:', err);
      throw new Error(err.message || 'Failed to sign up');
    }
  };

  const login = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await fetchUserProfile(userCredential.user.uid, email);
      return userCredential.user;
    } catch (err) {
      console.error('Firebase Login error:', err);
      throw new Error(err.message || 'Invalid credentials');
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setNeedsOnboarding(false);
    } catch (err) {
      console.error('Firebase Signout error:', err);
    }
  };

  const updateProfile = async (updates) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, updates);

      const updated = { ...user, ...updates };
      setUser(updated);
      setNeedsOnboarding(false);
      return updated;
    } catch (err) {
      console.error('Failed to update Firestore user profile:', err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      signup,
      logout,
      updateProfile,
      needsOnboarding,
      setNeedsOnboarding,
      fetchUserProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
