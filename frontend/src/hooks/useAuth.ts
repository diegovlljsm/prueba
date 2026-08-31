import { useState, useEffect } from 'react';
import { auth, googleProvider, db } from '../firebase';
import { signInWithPopup, onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export function useAuth() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoadingAuth(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        setIsGuest(false);
        
        // Check/Create user profile in Firestore
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            role: 'user',
            createdAt: serverTimestamp()
          });
        } else {
          const userData = userSnap.data();
          if (userData.role === 'admin') {
            setIsAdmin(true);
          }
        }
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setIsLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error signing in with Google:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setIsGuest(false);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleContinueAsGuest = () => {
    setIsGuest(true);
  };

  const showAuthScreen = !user && !isGuest && !isLoadingAuth;

  return {
    user,
    isGuest,
    // isAdmin reflects the role stored in Firestore for this user - it is
    // set only inside onAuthStateChanged above, never toggled client-side.
    // The server independently re-checks this role on every admin request,
    // so this value should be treated as UI-only (e.g. showing/hiding the
    // admin tab), never as the actual authorization boundary.
    isAdmin,
    isLoadingAuth,
    showAuthScreen,
    handleGoogleSignIn,
    handleSignOut,
    handleContinueAsGuest,
    setIsGuest
  };
}
