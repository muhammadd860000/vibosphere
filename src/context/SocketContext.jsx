import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  db, 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp 
} from '../firebase';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [realtimeMessages, setRealtimeMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    if (!user) return;

    // Listen live to direct messages involving current user
    const q = query(
      collection(db, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.senderId === user.uid || data.receiverId === user.uid) {
          msgs.push({ id: doc.id, ...data });
        }
      });
      setRealtimeMessages(msgs);
    }, (err) => {
      console.warn('Firestore messages snapshot warning:', err);
    });

    return () => unsubscribe();
  }, [user]);

  const sendMessage = async (receiverId, text, mediaUrl = null) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'messages'), {
        senderId: user.uid,
        receiverId,
        text,
        mediaUrl: mediaUrl || null,
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
