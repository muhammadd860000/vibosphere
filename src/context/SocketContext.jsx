import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import {
  db,
  collection,
  addDoc,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  where,
  query
} from '../firebase';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();

  /* ── State ─────────────────────────────────────────────── */
  const [realtimeMessages, setRealtimeMessages] = useState([]);
  const [typingPartners, setTypingPartners]     = useState({}); // { [partnerId]: true|false }

  // WebRTC call state
  const [incomingCall, setIncomingCall]   = useState(null);  // { callId, callerId, callerName, callerAvatar, type }
  const [activeCall, setActiveCall]       = useState(null);  // { callId, partnerId, type, isInitiator }
  const [localStream, setLocalStream]     = useState(null);
  const [remoteStream, setRemoteStream]   = useState(null);
  const peerRef                           = useRef(null);
  const typingTimerRef                    = useRef({});       // debounce timers per partner

  const uid = user?.uid;

  /* ── 1. Real-time Messages Listener ───────────────────── */
  useEffect(() => {
    if (!uid) return;

    const unsubscribe = onSnapshot(collection(db, 'messages'), (snapshot) => {
      const msgs = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.senderId === uid || data.receiverId === uid) {
          msgs.push({ id: docSnap.id, ...data });
        }
      });
      msgs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      setRealtimeMessages(msgs);
    }, err => console.warn('Messages snapshot error:', err));

    return () => unsubscribe();
  }, [uid]);

  /* ── 2. Typing Status Listener ─────────────────────────── */
  useEffect(() => {
    if (!uid) return;

    // Listen to typingStatus docs where receiverId == current user
    const q = query(collection(db, 'typingStatus'), where('receiverId', '==', uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const map = {};
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        map[data.senderId] = data.isTyping || false;
      });
      setTypingPartners(map);
    }, err => console.warn('Typing snapshot error:', err));

    return () => unsubscribe();
  }, [uid]);

  /* ── 3. WebRTC — Incoming Call Listener ────────────────── */
  useEffect(() => {
    if (!uid) return;

    const callDocRef = doc(db, 'calls', uid);
    const unsubscribe = onSnapshot(callDocRef, async (docSnap) => {
      if (!docSnap.exists()) return;
      const data = docSnap.data();

      // Incoming call for me
      if (data.status === 'calling' && data.calleeId === uid && !activeCall) {
        setIncomingCall({
          callId:      data.callId,
          callerId:    data.callerId,
          callerName:  data.callerName,
          callerAvatar:data.callerAvatar,
          type:        data.type
        });
      }

      // Remote ICE candidates or SDP answers
      if (data.answer && peerRef.current && !peerRef.current.remoteDescription) {
        try {
          await peerRef.current.setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );
        } catch (e) { console.warn('setRemoteDescription error', e); }
      }

      if (data.iceCandidates && peerRef.current) {
        for (const candidate of (data.iceCandidates || [])) {
          try { await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate)); }
          catch (e) {}
        }
      }

      if (data.status === 'declined' || data.status === 'ended') {
        endCall();
      }
    });

    return () => unsubscribe();
  }, [uid, activeCall]);

  /* ── Helper: Create RTCPeerConnection ──────────────────── */
  const createPeer = (stream, onRemoteStream) => {
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    stream.getTracks().forEach(track => peer.addTrack(track, stream));

    peer.ontrack = (event) => {
      onRemoteStream(event.streams[0]);
      setRemoteStream(event.streams[0]);
    };

    peer.onicecandidate = async (event) => {
      if (!event.candidate) return;
      // Store ICE candidates in the callee's call doc
      // Using a sub-collection would be ideal; here append to array
    };

    peerRef.current = peer;
    return peer;
  };

  /* ── Initiate a Call ───────────────────────────────────── */
  const initiateCall = useCallback(async (partner, type = 'audio') => {
    if (!user || !partner) return;
    const partnerId = partner.uid || partner.id;

    try {
      const constraints = type === 'video'
        ? { audio: true, video: true }
        : { audio: true, video: false };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);

      const callId = `call_${uid}_${partnerId}_${Date.now()}`;
      const peer   = createPeer(stream, setRemoteStream);

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      // Write call doc for partner
      await setDoc(doc(db, 'calls', partnerId), {
        callId,
        callerId:    uid,
        calleeId:    partnerId,
        callerName:  user.name || user.username,
        callerAvatar:user.avatar || '',
        type,
        offer:       { sdp: offer.sdp, type: offer.type },
        answer:      null,
        status:      'calling',
        iceCandidates: [],
        createdAt:   new Date().toISOString()
      });

      // Store my own call state so I can listen for answer
      await setDoc(doc(db, 'calls', uid), {
        callId,
        callerId: uid,
        calleeId: partnerId,
        type,
        offer:    { sdp: offer.sdp, type: offer.type },
        answer:   null,
        status:   'initiated',
        iceCandidates: [],
        createdAt: new Date().toISOString()
      });

      // ICE candidates → update callee's doc
      peer.onicecandidate = async (event) => {
        if (!event.candidate) return;
        const calleeDocRef = doc(db, 'calls', partnerId);
        const snap = await getDoc(calleeDocRef);
        const existing = snap.data()?.iceCandidates || [];
        await updateDoc(calleeDocRef, {
          iceCandidates: [...existing, event.candidate.toJSON()]
        });
      };

      setActiveCall({ callId, partnerId, type, isInitiator: true, partner });
    } catch (err) {
      console.error('Initiate call error:', err);
    }
  }, [user, uid]);

  /* ── Accept Incoming Call ──────────────────────────────── */
  const acceptCall = useCallback(async () => {
    if (!incomingCall || !user) return;
    const { callerId, callId, type } = incomingCall;

    try {
      const constraints = type === 'video'
        ? { audio: true, video: true }
        : { audio: true, video: false };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);

      const peer = createPeer(stream, setRemoteStream);

      // Get offer from caller's doc (stored in my doc)
      const myCallDoc = await getDoc(doc(db, 'calls', uid));
      const offerData = myCallDoc.data()?.offer;

      if (offerData) {
        await peer.setRemoteDescription(new RTCSessionDescription(offerData));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        // Write answer to caller's call doc
        await updateDoc(doc(db, 'calls', callerId), {
          answer: { sdp: answer.sdp, type: answer.type },
          status: 'accepted'
        });

        await updateDoc(doc(db, 'calls', uid), {
          status: 'accepted'
        });
      }

      // ICE candidates → caller doc
      peer.onicecandidate = async (event) => {
        if (!event.candidate) return;
        const callerDocRef = doc(db, 'calls', callerId);
        const snap = await getDoc(callerDocRef);
        const existing = snap.data()?.iceCandidates || [];
        await updateDoc(callerDocRef, {
          iceCandidates: [...existing, event.candidate.toJSON()]
        });
      };

      setActiveCall({ callId, partnerId: callerId, type, isInitiator: false });
      setIncomingCall(null);
    } catch (err) {
      console.error('Accept call error:', err);
    }
  }, [incomingCall, user, uid]);

  /* ── Decline Call ──────────────────────────────────────── */
  const declineCall = useCallback(async () => {
    if (!incomingCall) return;
    try {
      await updateDoc(doc(db, 'calls', uid), { status: 'declined' });
      await updateDoc(doc(db, 'calls', incomingCall.callerId), { status: 'declined' });
    } catch (e) {}
    setIncomingCall(null);
  }, [incomingCall, uid]);

  /* ── End Active Call ───────────────────────────────────── */
  const endCall = useCallback(async () => {
    peerRef.current?.close();
    peerRef.current = null;

    localStream?.getTracks().forEach(t => t.stop());
    setLocalStream(null);
    setRemoteStream(null);

    if (activeCall) {
      try {
        await updateDoc(doc(db, 'calls', uid), { status: 'ended' });
        await updateDoc(doc(db, 'calls', activeCall.partnerId), { status: 'ended' });
      } catch (e) {}
    }

    setActiveCall(null);
    setIncomingCall(null);
  }, [activeCall, localStream, uid]);

  /* ── Send Message (text / media / voice) ──────────────── */
  const sendMessage = async (receiverId, text, mediaData = null) => {
    if (!user) return;
    try {
      const payload = {
        senderId:  uid,
        receiverId,
        text:      text || '',
        mediaUrl:  mediaData?.base64  || null,
        mediaType: mediaData?.type    || null,   // 'image' | 'video' | 'audio'
        mimeType:  mediaData?.mimeType || null,
        status:    'sent',  // 'sent' | 'delivered' | 'read'
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'messages'), payload);
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  /* ── Mark Messages as Read ─────────────────────────────── */
  const markMessagesRead = useCallback(async (partnerId) => {
    if (!uid || !partnerId) return;
    // Find unread messages from partner to me
    const q = query(
      collection(db, 'messages'),
      where('senderId', '==', partnerId),
      where('receiverId', '==', uid),
      where('status', '!=', 'read')
    );
    try {
      const snap = await getDocs(q);
      snap.forEach(async (docSnap) => {
        await updateDoc(doc(db, 'messages', docSnap.id), { status: 'read' });
      });
    } catch (err) {
      // status != query may fail without index; fallback: iterate realtimeMessages
      realtimeMessages.forEach(async (msg) => {
        if (msg.senderId === partnerId && msg.receiverId === uid && msg.status !== 'read') {
          try {
            await updateDoc(doc(db, 'messages', msg.id), { status: 'read' });
          } catch (e) {}
        }
      });
    }
  }, [uid, realtimeMessages]);

  /* ── Typing Indicators ─────────────────────────────────── */
  const startTyping = useCallback(async (receiverId) => {
    if (!uid || !receiverId) return;
    const docId = `${uid}_${receiverId}`;
    try {
      await setDoc(doc(db, 'typingStatus', docId), {
        senderId:   uid,
        receiverId,
        isTyping:   true,
        updatedAt:  new Date().toISOString()
      });
    } catch (e) {}

    // Auto-clear after 4s of no activity
    if (typingTimerRef.current[receiverId]) {
      clearTimeout(typingTimerRef.current[receiverId]);
    }
    typingTimerRef.current[receiverId] = setTimeout(() => {
      stopTyping(receiverId);
    }, 4000);
  }, [uid]);

  const stopTyping = useCallback(async (receiverId) => {
    if (!uid || !receiverId) return;
    if (typingTimerRef.current[receiverId]) {
      clearTimeout(typingTimerRef.current[receiverId]);
      delete typingTimerRef.current[receiverId];
    }
    const docId = `${uid}_${receiverId}`;
    try {
      await setDoc(doc(db, 'typingStatus', docId), {
        senderId:   uid,
        receiverId,
        isTyping:   false,
        updatedAt:  new Date().toISOString()
      });
    } catch (e) {}
  }, [uid]);

  /* ── Cleanup typing on unmount ─────────────────────────── */
  useEffect(() => {
    return () => {
      Object.keys(typingTimerRef.current).forEach(rid => {
        clearTimeout(typingTimerRef.current[rid]);
        stopTyping(rid);
      });
    };
  }, [stopTyping]);

  return (
    <SocketContext.Provider value={{
      realtimeMessages,
      typingPartners,
      sendMessage,
      markMessagesRead,
      startTyping,
      stopTyping,
      // Call
      incomingCall,
      activeCall,
      localStream,
      remoteStream,
      initiateCall,
      acceptCall,
      declineCall,
      endCall
    }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
