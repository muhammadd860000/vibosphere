import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, Sparkles, MessageSquare, ArrowLeft, Paperclip, X, Check, Clock,
  ShieldCheck, Search, UserPlus, Ban, AlertCircle,
  Mic, MicOff, Phone, PhoneOff, Video, VideoOff, CheckCheck,
  PhoneIncoming, PhoneMissed
} from 'lucide-react';
import {
  db, collection, getDocs, addDoc, doc, updateDoc,
  query, where, onSnapshot
} from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

/* ─── Constants ──────────────────────────────────────────────────────────── */
const MAX_MEDIA_BYTES = 900_000;

/* ─── Helper: File → base64 DataURL ─────────────────────────────────────── */
const readFileAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/* ─── Read-Receipt Tick Component ────────────────────────────────────────── */
function Ticks({ status }) {
  if (!status) return null;
  if (status === 'sent') {
    return <Check className="w-3.5 h-3.5 text-slate-300 inline ml-1" />;
  }
  if (status === 'delivered') {
    return <CheckCheck className="w-3.5 h-3.5 text-slate-300 inline ml-1" />;
  }
  if (status === 'read') {
    return <CheckCheck className="w-3.5 h-3.5 text-blue-400 inline ml-1" />;
  }
  return null;
}

/* ─── Voice Note Player ──────────────────────────────────────────────────── */
function VoiceNotePlayer({ src, isMine }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const fmt = (s) => {
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl max-w-[220px] ${
      isMine ? 'bg-vibe-gradient' : 'bg-white dark:bg-[#0E131F] border border-slate-200 dark:border-slate-800'
    }`}>
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={() => {
          if (audioRef.current) {
            setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100 || 0);
          }
        }}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
      />

      <button
        onClick={togglePlay}
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          isMine ? 'bg-white/20 hover:bg-white/30' : 'bg-purple-500/10 hover:bg-purple-500/20'
        } transition-colors`}
      >
        {playing
          ? <MicOff className={`w-4 h-4 ${isMine ? 'text-white' : 'text-purple-500'}`} />
          : <Mic    className={`w-4 h-4 ${isMine ? 'text-white' : 'text-purple-500'}`} />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="h-1.5 bg-white/30 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isMine ? 'bg-white' : 'bg-purple-500'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className={`text-[10px] mt-0.5 block ${isMine ? 'text-white/70' : 'text-slate-400'}`}>
          {playing
            ? fmt((progress / 100) * duration)
            : fmt(duration)}
        </span>
      </div>
    </div>
  );
}

/* ─── Message Bubble ─────────────────────────────────────────────────────── */
function MessageBubble({ msg, isMine }) {
  const [showMedia, setShowMedia] = useState(false);
  const timeStr = msg.createdAt
    ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} gap-0.5 group`}>

      {/* ── Voice note ── */}
      {msg.mediaType === 'audio' && msg.mediaUrl && (
        <div>
          <VoiceNotePlayer src={msg.mediaUrl} isMine={isMine} />
        </div>
      )}

      {/* ── Image / Video ── */}
      {msg.mediaUrl && msg.mediaType !== 'audio' && (
        <div className="max-w-[260px] rounded-2xl overflow-hidden shadow-md">
          {msg.mediaType === 'video' ? (
            <video src={msg.mediaUrl} controls className="w-full max-h-48 object-cover bg-black" />
          ) : (
            <img
              src={msg.mediaUrl} alt="Shared media"
              className="w-full max-h-48 object-cover cursor-pointer"
              onClick={() => setShowMedia(true)}
            />
          )}
        </div>
      )}

      {/* ── Text ── */}
      {msg.text && (
        <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
          isMine
            ? 'bg-vibe-gradient text-white rounded-br-none'
            : 'bg-white dark:bg-[#0E131F] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-none'
        }`}>
          {msg.text}
        </div>
      )}

      {/* ── Timestamp + Read Receipt ── */}
      <div className="flex items-center gap-0.5 px-1">
        <span className="text-[10px] text-slate-400">{timeStr}</span>
        {isMine && <Ticks status={msg.status} />}
      </div>

      {/* Lightbox */}
      {showMedia && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowMedia(false)}>
          <button className="absolute top-4 right-4 p-2 bg-white/10 rounded-full text-white">
            <X className="w-5 h-5" />
          </button>
          <img src={msg.mediaUrl} alt="Full view"
            className="max-w-full max-h-full rounded-2xl"
            onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

/* ─── Incoming Call Banner ───────────────────────────────────────────────── */
function IncomingCallBanner({ call, onAccept, onDecline }) {
  return (
    <div className="fixed inset-x-0 top-0 z-50 flex justify-center pointer-events-none pt-4 px-4">
      <div className="bg-white dark:bg-[#0E131F] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-4 flex items-center gap-4 pointer-events-auto max-w-sm w-full animate-bounce">
        <img
          src={call.callerAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${call.callerId}`}
          alt="Caller"
          className="w-12 h-12 rounded-full object-cover ring-2 ring-purple-500/30"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
            {call.callerName}
          </p>
          <p className="text-xs text-slate-400 flex items-center gap-1">
            {call.type === 'video' ? <Video className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
            Incoming {call.type === 'video' ? 'Video' : 'Voice'} Call...
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onAccept}
            className="w-10 h-10 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
          >
            <Phone className="w-4 h-4" />
          </button>
          <button
            onClick={onDecline}
            className="w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Active Call Overlay ────────────────────────────────────────────────── */
function ActiveCallOverlay({ call, localStream, remoteStream, onEnd }) {
  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);
  const [muted, setMuted]   = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    const timer = setInterval(() => setElapsedSec(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleMute = () => {
    localStream?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setMuted(m => !m);
  };

  const toggleCam = () => {
    localStream?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setCamOff(c => !c);
  };

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center">
      {/* Remote video / audio */}
      {call.type === 'video' ? (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="w-24 h-24 rounded-full bg-purple-500/20 flex items-center justify-center">
            <Phone className="w-12 h-12 text-purple-400 animate-pulse" />
          </div>
          <p className="text-white text-xl font-bold">{call.partner?.name || 'Calling...'}</p>
          {!remoteStream && <p className="text-slate-400 text-sm">Ringing...</p>}
        </div>
      )}

      {/* Local video (PiP) */}
      {call.type === 'video' && (
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="absolute bottom-24 right-4 w-28 h-40 object-cover rounded-2xl border-2 border-white/20 shadow-xl"
        />
      )}

      {/* Timer */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-full">
        <p className="text-white text-sm font-mono">{fmt(elapsedSec)}</p>
      </div>

      {/* Controls */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4">
        <button
          onClick={toggleMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${
            muted ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          {muted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        <button
          onClick={onEnd}
          className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-2xl transition-colors"
        >
          <PhoneOff className="w-7 h-7" />
        </button>

        {call.type === 'video' && (
          <button
            onClick={toggleCam}
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${
              camOff ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {camOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Main MessagesView ──────────────────────────────────────────────────── */
export default function MessagesView({ initialTargetUser, openAuthModal }) {
  const { user: currentUser } = useAuth();
  const {
    sendMessage, realtimeMessages, markMessagesRead,
    typingPartners, startTyping, stopTyping,
    incomingCall, activeCall, localStream, remoteStream,
    initiateCall, acceptCall, declineCall, endCall
  } = useSocket();

  const [activeTab, setActiveTab]       = useState('chats');
  const [conversations, setConversations] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [activePartner, setActivePartner] = useState(initialTargetUser || null);
  const [connectionStatus, setConnectionStatus] = useState('none');

  const [inputText, setInputText]       = useState('');
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaError, setMediaError]     = useState('');
  const [loading, setLoading]           = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);

  // Voice recording
  const [recording, setRecording]       = useState(false);
  const [recordSecs, setRecordSecs]     = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef   = useRef([]);
  const recordTimerRef   = useRef(null);

  // Search
  const [searchQuery, setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]       = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef   = useRef(null);
  const typingDebounceRef = useRef(null);

  const currentId = currentUser?.uid || currentUser?.id;

  /* ── Load accepted conversations ─────────────────────── */
  const loadConversations = useCallback(async () => {
    if (!currentId) return;
    setLoading(true);
    try {
      const partnerIds = new Set();
      realtimeMessages.forEach(m => {
        if (m.senderId === currentId) partnerIds.add(m.receiverId);
        if (m.receiverId === currentId) partnerIds.add(m.senderId);
      });
      if (partnerIds.size === 0) { setConversations([]); setLoading(false); return; }

      const usersSnap = await getDocs(collection(db, 'users'));
      const list = [];
      usersSnap.forEach(d => {
        if (partnerIds.has(d.id)) list.push({ id: d.id, uid: d.id, ...d.data() });
      });

      list.sort((a, b) => {
        const lastA = [...realtimeMessages].filter(m => m.senderId === a.id || m.receiverId === a.id).pop();
        const lastB = [...realtimeMessages].filter(m => m.senderId === b.id || m.receiverId === b.id).pop();
        return new Date(lastB?.createdAt || 0) - new Date(lastA?.createdAt || 0);
      });

      setConversations(list);
    } catch (err) {
      console.error('Error loading conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [currentId, realtimeMessages]);

  /* ── Message requests listeners ──────────────────────── */
  useEffect(() => {
    if (!currentId) return;
    const inQ = query(collection(db, 'messageRequests'), where('receiverId', '==', currentId), where('status', '==', 'pending'));
    const outQ = query(collection(db, 'messageRequests'), where('senderId', '==', currentId));
    const u1 = onSnapshot(inQ, snap => { const r=[]; snap.forEach(d=>r.push({id:d.id,...d.data()})); setIncomingRequests(r); });
    const u2 = onSnapshot(outQ, snap => { const r=[]; snap.forEach(d=>r.push({id:d.id,...d.data()})); setOutgoingRequests(r); });
    return () => { u1(); u2(); };
  }, [currentId]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    if (initialTargetUser) setActivePartner(initialTargetUser);
  }, [initialTargetUser]);

  /* ── Connection status ───────────────────────────────── */
  useEffect(() => {
    if (!activePartner || !currentId) { setConnectionStatus('none'); return; }
    const pid = activePartner.uid || activePartner.id;
    const hasMsg = realtimeMessages.some(m =>
      (m.senderId === currentId && m.receiverId === pid) ||
      (m.senderId === pid && m.receiverId === currentId)
    );
    if (hasMsg) { setConnectionStatus('accepted'); return; }
    const out = outgoingRequests.find(r => r.receiverId === pid);
    if (out?.status === 'accepted') { setConnectionStatus('accepted'); return; }
    if (out?.status === 'pending')  { setConnectionStatus('pendingOutgoing'); return; }
    const inc = incomingRequests.find(r => r.senderId === pid);
    if (inc) { setConnectionStatus('pendingIncoming'); return; }
    setConnectionStatus('none');
  }, [activePartner, currentId, realtimeMessages, outgoingRequests, incomingRequests]);

  /* ── Mark read when viewing a conversation ───────────── */
  useEffect(() => {
    if (!activePartner || connectionStatus !== 'accepted') return;
    const pid = activePartner.uid || activePartner.id;
    markMessagesRead(pid);
  }, [activePartner, connectionStatus, realtimeMessages]);

  /* ── Scroll to bottom ────────────────────────────────── */
  useEffect(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [realtimeMessages, activePartner]);

  /* ── User search ─────────────────────────────────────── */
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const snap = await getDocs(collection(db, 'users'));
        const q = searchQuery.toLowerCase();
        const res = [];
        snap.forEach(d => {
          if (d.id === currentId) return;
          const data = d.data();
          if (data.username?.toLowerCase().includes(q) || data.name?.toLowerCase().includes(q))
            res.push({ id: d.id, uid: d.id, ...data });
        });
        setSearchResults(res);
      } catch (e) { console.error(e); }
      finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery, currentId]);

  /* ── Send message request ────────────────────────────── */
  const handleSendRequest = async (targetUser) => {
    if (!currentUser) return;
    setRequestLoading(true);
    try {
      await addDoc(collection(db, 'messageRequests'), {
        senderId: currentId, senderUsername: currentUser.username,
        senderName: currentUser.name || currentUser.username,
        senderAvatar: currentUser.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.username}`,
        receiverId: targetUser.uid || targetUser.id, receiverUsername: targetUser.username,
        status: 'pending', createdAt: new Date().toISOString()
      });
      setActivePartner(targetUser);
      setSearchQuery('');
    } catch (err) { console.error(err); }
    finally { setRequestLoading(false); }
  };

  const handleRequestAction = async (requestId, action) => {
    try { await updateDoc(doc(db, 'messageRequests', requestId), { status: action }); }
    catch (err) { console.error(err); }
  };

  /* ── File picker ─────────────────────────────────────── */
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setMediaError('');
    if (file.size > MAX_MEDIA_BYTES) {
      setMediaError(`File too large. Max ~${Math.round(MAX_MEDIA_BYTES / 1024)} KB`);
      return;
    }
    const isVideo = file.type.startsWith('video/');
    const base64  = await readFileAsDataURL(file);
    setMediaPreview({ base64, type: isVideo ? 'video' : 'image', mimeType: file.type });
    e.target.value = '';
  };

  /* ── Voice recording ─────────────────────────────────── */
  const startRecording = async () => {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      audioChunksRef.current = [];
      mr.ondataavailable = e => audioChunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (blob.size > MAX_MEDIA_BYTES) {
          setMediaError('Voice note too long. Keep under 1 minute.');
          return;
        }
        const base64 = await readFileAsDataURL(blob);
        setMediaPreview({ base64, type: 'audio', mimeType: 'audio/webm' });
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setRecordSecs(0);
      recordTimerRef.current = setInterval(() => setRecordSecs(s => s + 1), 1000);
    } catch (err) {
      setMediaError('Microphone access denied.');
    }
  };

  const stopRecording = () => {
    if (!recording || !mediaRecorderRef.current) return;
    clearInterval(recordTimerRef.current);
    mediaRecorderRef.current.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
    setRecordSecs(0);
  };

  /* ── Typing input handler ─────────────────────────────── */
  const handleInputChange = (e) => {
    setInputText(e.target.value);
    if (!activePartner) return;
    const pid = activePartner.uid || activePartner.id;
    startTyping(pid);
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = setTimeout(() => stopTyping(pid), 2000);
  };

  /* ── Send ─────────────────────────────────────────────── */
  const handleSend = async (e) => {
    e.preventDefault();
    if (!activePartner || !currentUser) return;
    if (!inputText.trim() && !mediaPreview) return;
    const pid = activePartner.uid || activePartner.id;
    stopTyping(pid);
    await sendMessage(pid, inputText.trim(), mediaPreview
      ? { base64: mediaPreview.base64, type: mediaPreview.type, mimeType: mediaPreview.mimeType }
      : null);
    setInputText('');
    setMediaPreview(null);
  };

  /* ── Guards ──────────────────────────────────────────── */
  if (!currentUser) {
    return (
      <div className="text-center py-20">
        <MessageSquare className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Sign in to Direct Message</h2>
        <p className="text-xs text-slate-400 mt-1 mb-4">Chat securely with people you connect with</p>
        <button onClick={() => openAuthModal('login')}
          className="px-6 py-2.5 bg-vibe-gradient text-white font-semibold text-sm rounded-xl shadow-lg shadow-purple-500/25">
          Log In
        </button>
      </div>
    );
  }

  const partnerId = activePartner?.uid || activePartner?.id;
  const filteredMessages = realtimeMessages.filter(m =>
    (m.senderId === currentId && m.receiverId === partnerId) ||
    (m.senderId === partnerId && m.receiverId === currentId)
  );
  const isPartnerTyping = !!(partnerId && typingPartners[partnerId]);
  const pendingCount = incomingRequests.length;
  const fmtRecordSecs = `${Math.floor(recordSecs/60)}:${String(recordSecs%60).padStart(2,'0')}`;

  return (
    <>
      {/* ── Incoming Call Banner ── */}
      {incomingCall && (
        <IncomingCallBanner call={incomingCall} onAccept={acceptCall} onDecline={declineCall} />
      )}

      {/* ── Active Call Overlay ── */}
      {activeCall && (
        <ActiveCallOverlay
          call={activeCall}
          localStream={localStream}
          remoteStream={remoteStream}
          onEnd={endCall}
        />
      )}

      <div className="max-w-5xl mx-auto h-[calc(100vh-5rem)] py-2 px-2 md:px-4">
        <div className="w-full h-full bg-white dark:bg-[#0E131F] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex">

          {/* ── LEFT PANEL ─────────────────────────────────── */}
          <div className={`w-full md:w-80 border-r border-slate-200 dark:border-slate-800 flex flex-col ${activePartner ? 'hidden md:flex' : 'flex'}`}>
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-purple-500" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Messages</h2>
              </div>
              {/* Tabs */}
              <div className="flex gap-1 bg-slate-100 dark:bg-slate-900 rounded-xl p-1 mb-2">
                {['chats','requests'].map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all relative ${
                      activeTab === tab
                        ? 'bg-white dark:bg-[#0E131F] text-purple-600 dark:text-purple-400 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase()+tab.slice(1)}
                    {tab === 'requests' && pendingCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        {pendingCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search users to message..."
                  className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-purple-500" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {/* Search Results */}
              {searchQuery.trim() ? (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">Search Results</p>
                  {searching ? (
                    <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>
                  ) : searchResults.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">No users found</p>
                  ) : searchResults.map(u => {
                    const uid = u.uid || u.id;
                    const sent = outgoingRequests.find(r => r.receiverId === uid);
                    const hasConvo = conversations.find(c => (c.uid||c.id) === uid);
                    return (
                      <div key={uid} className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <img src={u.avatar||`https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`} alt={u.username} className="w-10 h-10 rounded-full object-cover" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{u.name||u.username}</p>
                          <p className="text-xs text-slate-400 truncate">@{u.username}</p>
                        </div>
                        {hasConvo ? (
                          <button onClick={() => { setActivePartner(u); setSearchQuery(''); }}
                            className="shrink-0 px-3 py-1.5 text-xs bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold rounded-xl">
                            Open
                          </button>
                        ) : sent ? (
                          <span className="shrink-0 flex items-center gap-1 px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold rounded-xl">
                            <Clock className="w-3 h-3" /> Sent
                          </span>
                        ) : (
                          <button onClick={() => handleSendRequest(u)} disabled={requestLoading}
                            className="shrink-0 flex items-center gap-1 px-2.5 py-1 text-xs bg-vibe-gradient text-white font-semibold rounded-xl hover:opacity-90">
                            <UserPlus className="w-3 h-3" /> Request
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

              ) : activeTab === 'chats' ? (
                /* Chats List */
                conversations.length === 0 ? (
                  <div className="text-center py-10 px-4">
                    <MessageSquare className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">No conversations yet</p>
                    <p className="text-[11px] text-slate-400 mt-1">Search users above to connect</p>
                  </div>
                ) : conversations.map(partner => {
                  const pid = partner.uid || partner.id;
                  const isSelected = (activePartner?.uid||activePartner?.id) === pid;
                  const thread = realtimeMessages.filter(m =>
                    (m.senderId === currentId && m.receiverId === pid) ||
                    (m.senderId === pid && m.receiverId === currentId)
                  );
                  const lastMsg = thread[thread.length - 1];
                  const unreadCount = thread.filter(m => m.senderId === pid && m.status !== 'read').length;

                  return (
                    <div key={pid} onClick={() => setActivePartner(partner)}
                      className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-colors ${
                        isSelected ? 'bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}>
                      <div className="relative">
                        <img src={partner.avatar||`https://api.dicebear.com/7.x/avataaars/svg?seed=${partner.username}`}
                          alt={partner.username} className="w-12 h-12 rounded-full object-cover" />
                        {typingPartners[pid] && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 border-2 border-white dark:border-[#0E131F] rounded-full" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-sm truncate ${unreadCount > 0 ? 'font-bold text-slate-900 dark:text-slate-100' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>
                            {partner.name||partner.username}
                          </p>
                          {lastMsg?.createdAt && (
                            <span className="text-[10px] text-slate-400 shrink-0 ml-1">
                              {new Date(lastMsg.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {typingPartners[pid] ? (
                              <span className="text-green-500 font-medium">Typing...</span>
                            ) : lastMsg?.mediaType === 'audio' ? '🎤 Voice note'
                              : lastMsg?.mediaType === 'video' ? '🎥 Video'
                              : lastMsg?.mediaType === 'image' ? '📷 Photo'
                              : lastMsg?.text || `@${partner.username}`}
                          </p>
                          {unreadCount > 0 && (
                            <span className="ml-1 shrink-0 w-5 h-5 bg-purple-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                              {unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })

              ) : (
                /* Requests Tab */
                <div className="space-y-2 p-1">
                  {incomingRequests.length === 0 ? (
                    <div className="text-center py-10 px-4">
                      <ShieldCheck className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">No pending requests</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Incoming</p>
                      {incomingRequests.map(req => (
                        <div key={req.id} className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                          <div className="flex items-center gap-3 mb-2">
                            <img src={req.senderAvatar||`https://api.dicebear.com/7.x/avataaars/svg?seed=${req.senderUsername}`}
                              alt={req.senderUsername} className="w-10 h-10 rounded-full object-cover" />
                            <div>
                              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{req.senderName||req.senderUsername}</p>
                              <p className="text-xs text-slate-400">@{req.senderUsername}</p>
                            </div>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">wants to send you a message</p>
                          <div className="flex gap-2">
                            <button onClick={() => handleRequestAction(req.id, 'accepted')}
                              className="flex-1 py-1.5 text-xs bg-vibe-gradient text-white font-semibold rounded-xl flex items-center justify-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Accept
                            </button>
                            <button onClick={() => handleRequestAction(req.id, 'declined')}
                              className="flex-1 py-1.5 text-xs bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl flex items-center justify-center gap-1 hover:bg-red-50 hover:text-red-600">
                              <Ban className="w-3.5 h-3.5" /> Decline
                            </button>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                  {outgoingRequests.filter(r=>r.status==='pending').length > 0 && (
                    <>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 pt-2">Sent</p>
                      {outgoingRequests.filter(r=>r.status==='pending').map(req => (
                        <div key={req.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">@{req.receiverUsername}</p>
                            <p className="text-xs text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</p>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT CHAT PANEL ─────────────────────────── */}
          {activePartner ? (
            <div className="flex-1 flex flex-col bg-slate-50/50 dark:bg-[#0B0F17]/50">
              {/* Top Bar */}
              <div className="p-3.5 px-5 bg-white dark:bg-[#0E131F] border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
                <button onClick={() => setActivePartner(null)} className="md:hidden p-1 text-slate-400">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <img src={activePartner.avatar||`https://api.dicebear.com/7.x/avataaars/svg?seed=${activePartner.username}`}
                  alt={activePartner.username} className="w-10 h-10 rounded-full object-cover ring-2 ring-purple-500/30" />
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-none">
                    {activePartner.name||activePartner.username}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isPartnerTyping
                      ? <span className="text-green-500 font-medium">Typing...</span>
                      : `@${activePartner.username}`}
                  </p>
                </div>

                {/* ── Call Buttons ── */}
                {connectionStatus === 'accepted' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => initiateCall(activePartner, 'audio')}
                      title="Voice Call"
                      className="p-2 text-slate-500 dark:text-slate-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 rounded-xl transition-colors"
                    >
                      <Phone className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => initiateCall(activePartner, 'video')}
                      title="Video Call"
                      className="p-2 text-slate-500 dark:text-slate-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-xl transition-colors"
                    >
                      <Video className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>

              {/* ── Connection Status Screens ── */}
              {connectionStatus === 'none' && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  <img src={activePartner.avatar||`https://api.dicebear.com/7.x/avataaars/svg?seed=${activePartner.username}`}
                    className="w-20 h-20 rounded-full object-cover ring-4 ring-purple-500/20 mb-4" alt="" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">{activePartner.name||activePartner.username}</h3>
                  <p className="text-xs text-slate-400 mb-4">Send a request to start chatting</p>
                  <button onClick={() => handleSendRequest(activePartner)} disabled={requestLoading}
                    className="flex items-center gap-2 px-6 py-3 bg-vibe-gradient text-white font-semibold text-sm rounded-xl shadow-lg hover:opacity-95">
                    {requestLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <UserPlus className="w-4 h-4" />}
                    Send Message Request
                  </button>
                </div>
              )}

              {connectionStatus === 'pendingOutgoing' && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
                    <Clock className="w-8 h-8 text-amber-500" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">Request Sent</h3>
                  <p className="text-xs text-slate-400">Waiting for @{activePartner.username} to accept</p>
                </div>
              )}

              {connectionStatus === 'pendingIncoming' && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  <img src={activePartner.avatar||`https://api.dicebear.com/7.x/avataaars/svg?seed=${activePartner.username}`}
                    className="w-20 h-20 rounded-full object-cover ring-4 ring-purple-500/20 mb-4" alt="" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">Message Request</h3>
                  <p className="text-xs text-slate-400 mb-4">@{activePartner.username} wants to message you</p>
                  <div className="flex gap-3">
                    {(() => {
                      const req = incomingRequests.find(r => r.senderId === (activePartner.uid||activePartner.id));
                      if (!req) return null;
                      return (
                        <>
                          <button onClick={() => handleRequestAction(req.id, 'accepted')}
                            className="flex items-center gap-2 px-5 py-2.5 bg-vibe-gradient text-white font-semibold text-sm rounded-xl hover:opacity-95">
                            <Check className="w-4 h-4" /> Accept
                          </button>
                          <button onClick={() => { handleRequestAction(req.id, 'declined'); setActivePartner(null); }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-sm rounded-xl hover:bg-red-50 hover:text-red-600">
                            <Ban className="w-4 h-4" /> Decline
                          </button>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {connectionStatus === 'accepted' && (
                <>
                  {/* ── Message Stream ── */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {filteredMessages.length === 0 ? (
                      <div className="text-center py-16 text-xs text-slate-400">
                        Wave hello to @{activePartner.username}! 👋
                      </div>
                    ) : (
                      filteredMessages.map(msg => (
                        <MessageBubble key={msg.id} msg={msg} isMine={msg.senderId === currentId} />
                      ))
                    )}

                    {/* Typing Indicator */}
                    {isPartnerTyping && (
                      <div className="flex items-center gap-2 py-1">
                        <img src={activePartner.avatar||`https://api.dicebear.com/7.x/avataaars/svg?seed=${activePartner.username}`}
                          alt="" className="w-6 h-6 rounded-full object-cover" />
                        <div className="bg-white dark:bg-[#0E131F] border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-2xl rounded-bl-none shadow-sm">
                          <div className="flex gap-1 items-center h-4">
                            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}} />
                            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}} />
                            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}} />
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Media Preview Bar */}
                  {mediaPreview && (
                    <div className="px-3 pb-2 bg-white dark:bg-[#0E131F] border-t border-slate-200 dark:border-slate-800">
                      <div className="relative inline-block mt-2">
                        {mediaPreview.type === 'audio' ? (
                          <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-500/10 rounded-xl border border-purple-200 dark:border-purple-500/20">
                            <Mic className="w-5 h-5 text-purple-500" />
                            <span className="text-xs text-purple-600 dark:text-purple-400 font-semibold">Voice Note Ready</span>
                          </div>
                        ) : mediaPreview.type === 'video' ? (
                          <video src={mediaPreview.base64} className="h-20 rounded-xl object-cover border border-slate-300 dark:border-slate-700" />
                        ) : (
                          <img src={mediaPreview.base64} alt="preview" className="h-20 rounded-xl object-cover border border-slate-300 dark:border-slate-700" />
                        )}
                        <button type="button" onClick={() => setMediaPreview(null)}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-sm">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  {mediaError && (
                    <div className="px-3 py-1.5 bg-red-50 dark:bg-red-500/10 border-t border-red-200 dark:border-red-500/20 flex items-center gap-1.5 text-xs text-red-500">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{mediaError}</span>
                      <button onClick={() => setMediaError('')} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  )}

                  {/* ── Input Bar ── */}
                  <form onSubmit={handleSend}
                    className="p-3 bg-white dark:bg-[#0E131F] border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">

                    {/* Attachment */}
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="p-2 text-slate-400 hover:text-purple-500 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors" title="Attach file">
                      <Paperclip className="w-5 h-5" />
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileSelect} className="hidden" />

                    {/* Voice Record Button */}
                    {recording ? (
                      <div className="flex items-center gap-2 flex-1 bg-red-50 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 rounded-2xl px-3 py-2">
                        <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-xs text-red-500 font-mono font-bold">{fmtRecordSecs}</span>
                        <span className="text-xs text-red-400 flex-1">Recording... tap 🛑 to stop</span>
                        <button type="button" onClick={stopRecording}
                          className="w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md">
                          <MicOff className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <input type="text" value={inputText} onChange={handleInputChange}
                          placeholder={`Message @${activePartner.username}...`}
                          className="flex-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-purple-500" />

                        {/* Mic button (hold-to-record) */}
                        {!inputText.trim() && !mediaPreview && (
                          <button type="button"
                            onMouseDown={startRecording}
                            onMouseUp={stopRecording}
                            onTouchStart={startRecording}
                            onTouchEnd={stopRecording}
                            className="p-2 text-slate-400 hover:text-purple-500 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"
                            title="Hold to record voice note">
                            <Mic className="w-5 h-5" />
                          </button>
                        )}
                      </>
                    )}

                    {/* Send */}
                    {!recording && (
                      <button type="submit" disabled={!inputText.trim() && !mediaPreview}
                        className="w-10 h-10 rounded-2xl bg-vibe-gradient text-white flex items-center justify-center shadow-md shadow-purple-500/20 disabled:opacity-40 hover:scale-105 active:scale-95 transition-all">
                        <Send className="w-4 h-4" />
                      </button>
                    )}
                  </form>
                </>
              )}
            </div>
          ) : (
            <div className="hidden md:flex flex-1 flex-col items-center justify-center text-center p-8">
              <MessageSquare className="w-16 h-16 text-slate-300 dark:text-slate-700 mb-3" />
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">Your Messages</h3>
              <p className="text-xs text-slate-400 mt-1">Search or select a conversation</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
