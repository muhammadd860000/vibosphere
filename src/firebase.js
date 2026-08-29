import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile as updateFirebaseProfile 
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc,
  deleteDoc,
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  arrayUnion, 
  arrayRemove, 
  serverTimestamp 
} from "firebase/firestore";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

// User Production Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAYkWlBM6z-p0v_67arQsrXDter0Muh7rc",
  authDomain: "vibesphere-c3577.firebaseapp.com",
  projectId: "vibesphere-c3577",
  storageBucket: "vibesphere-c3577.firebasestorage.app",
  messagingSenderId: "768071449850",
  appId: "1:768071449850:web:2997b49210d7df3aa8dd43",
  measurementId: "G-CJX8HQWWHE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { 
  app, 
  auth, 
  db, 
  storage,
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateFirebaseProfile,
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc,
  deleteDoc,
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  arrayUnion, 
  arrayRemove, 
  serverTimestamp,
  ref,
  uploadBytesResumable,
  getDownloadURL
};

