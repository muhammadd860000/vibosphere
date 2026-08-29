import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  db, 
  collection, 
  addDoc, 
  onSnapshot
} from '../firebase';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [realtimeMessages, setRealtimeMessages] = useState([]);
  const [onlineUsers] = useState([]);

  useEffect(() => {
    if (!user) return;

    // Real-time listener on ALL messages — filter client-side for privacy
    const unsubscribe = onSnapshot(collection(db, 'messages'), (snapshot) => {
      const msgs = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        // Only surface messages involving the current user
        if (data.senderId === user.uid || data.receiverId === user.uid) {
          msgs.push({ id: docSnap.id, ...data });
        }
      });
      // Sort chronologically
      msgs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      setRealtimeMessages(msgs);
    }, (err) => {
      console.warn('Firestore messages snapshot warning:', err);
    });

    return () => unsubscribe();
  }, [user]);

  /**
   * Send a text or media message to a receiver.
   * @param {string} receiverId
   * @param {string} text
   * @param {{ base64: string, type: 'image'|'video', mimeType: string } | null} mediaData
   */
  const sendMessage = async (receiverId, text, mediaData = null) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'messages'), {
        senderId: user.uid,
        receiverId,
        text: text || '',
        mediaUrl: mediaData?.base64 || null,   // inline base64 data-URL
        mediaType: mediaData?.type || null,     // 'image' | 'video'
        mimeType: mediaData?.mimeType || null,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error sending message to Firestore:', err);
    }
  };

  const startTyping = () => {};
  const stopTyping = () => {};

  return (
    <SocketContext.Provider value={{
      onlineUsers,
      realtimeMessages,
      sendMessage,
      startTyping,
      stopTyping
    }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
