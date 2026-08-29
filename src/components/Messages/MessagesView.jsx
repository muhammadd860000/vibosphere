import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  Sparkles,
  MessageSquare,
  ArrowLeft,
  Paperclip,
  X,
  Check,
  Clock,
  ShieldCheck,
  Search,
  Image as ImageIcon,
  Video,
  UserPlus,
  Ban,
  AlertCircle,
  Play
} from 'lucide-react';
import {
  db,
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  onSnapshot,
  orderBy
} from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

// ─── Constants ─────────────────────────────────────────────────────────────
const MAX_MEDIA_BYTES = 900_000; // ~900 KB (Firestore doc limit is 1 MB)

// ─── Helper: read file as base64 DataURL ───────────────────────────────────
const readFileAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// ─── Sub-component: Message Bubble ─────────────────────────────────────────
function MessageBubble({ msg, isMine }) {
  const [showMedia, setShowMedia] = useState(false);

  const timeStr = msg.createdAt
    ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} gap-0.5`}>
      {/* Media attachment */}
      {msg.mediaUrl && (
        <div className="max-w-[260px] rounded-2xl overflow-hidden shadow-md mb-0.5">
          {msg.mediaType === 'video' ? (
            <video
              src={msg.mediaUrl}
              controls
              className="w-full max-h-48 object-cover bg-black"
            />
          ) : (
            <img
              src={msg.mediaUrl}
              alt="Shared media"
              className="w-full max-h-48 object-cover cursor-pointer"
              onClick={() => setShowMedia(true)}
            />
          )}
        </div>
      )}

      {/* Text bubble */}
      {msg.text && (
        <div
          className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
            isMine
              ? 'bg-vibe-gradient text-white rounded-br-none'
              : 'bg-white dark:bg-[#0E131F] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-none'
          }`}
        >
          {msg.text}
        </div>
      )}

      <span className="text-[10px] text-slate-400 px-1">{timeStr}</span>

      {/* Full-screen image lightbox */}
      {showMedia && msg.mediaType !== 'video' && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowMedia(false)}
        >
          <button className="absolute top-4 right-4 text-white p-2 rounded-full bg-white/10">
            <X className="w-6 h-6" />
          </button>
          <img
            src={msg.mediaUrl}
            alt="Full view"
            className="max-w-full max-h-full rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function MessagesView({ initialTargetUser, openAuthModal }) {
  const { user: currentUser } = useAuth();
  const { sendMessage, realtimeMessages } = useSocket();

  // Tabs: 'chats' | 'requests'
  const [activeTab, setActiveTab] = useState('chats');

  // Accepted conversation partners (users with whom at least one message exists)
  const [conversations, setConversations] = useState([]);
  // Incoming pending message requests
  const [incomingRequests, setIncomingRequests] = useState([]);
  // Outgoing pending requests current user sent
  const [outgoingRequests, setOutgoingRequests] = useState([]);

  const [activePartner, setActivePartner] = useState(initialTargetUser || null);
  // Status of connection with activePartner:
  // 'accepted' | 'pendingOutgoing' | 'pendingIncoming' | 'none'
  const [connectionStatus, setConnectionStatus] = useState('none');

  const [inputText, setInputText] = useState('');
  const [mediaPreview, setMediaPreview] = useState(null); // { base64, type, mimeType, name }
  const [mediaError, setMediaError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);

  // Search state (to find new users to message)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const currentId = currentUser?.uid || currentUser?.id;

  // ── Load accepted conversations (users with exchanged messages) ──────────
  const loadConversations = useCallback(async () => {
    if (!currentId) return;
    setLoading(true);
    try {
      // Get unique partner IDs from messages
      const partnerIds = new Set();
      realtimeMessages.forEach((m) => {
        if (m.senderId === currentId) partnerIds.add(m.receiverId);
        if (m.receiverId === currentId) partnerIds.add(m.senderId);
      });

      if (partnerIds.size === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // Fetch user docs for those IDs
      const usersSnap = await getDocs(collection(db, 'users'));
      const partnerList = [];
      usersSnap.forEach((docSnap) => {
        if (partnerIds.has(docSnap.id)) {
          partnerList.push({ id: docSnap.id, uid: docSnap.id, ...docSnap.data() });
        }
      });

      // Sort by most recent message
      partnerList.sort((a, b) => {
        const lastA = [...realtimeMessages]
          .filter((m) => m.senderId === a.id || m.receiverId === a.id)
          .pop();
        const lastB = [...realtimeMessages]
          .filter((m) => m.senderId === b.id || m.receiverId === b.id)
          .pop();
        return new Date(lastB?.createdAt || 0) - new Date(lastA?.createdAt || 0);
      });

      setConversations(partnerList);
    } catch (err) {
      console.error('Error loading conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [currentId, realtimeMessages]);

  // ── Listen to message requests in real-time ──────────────────────────────
  useEffect(() => {
    if (!currentId) return;

    // Incoming requests TO current user
    const incomingQ = query(
      collection(db, 'messageRequests'),
      where('receiverId', '==', currentId),
      where('status', '==', 'pending')
    );
    const unsubIncoming = onSnapshot(incomingQ, (snap) => {
      const reqs = [];
      snap.forEach((d) => reqs.push({ id: d.id, ...d.data() }));
      setIncomingRequests(reqs);
    });

    // Outgoing requests FROM current user
    const outgoingQ = query(
      collection(db, 'messageRequests'),
      where('senderId', '==', currentId)
    );
    const unsubOutgoing = onSnapshot(outgoingQ, (snap) => {
      const reqs = [];
      snap.forEach((d) => reqs.push({ id: d.id, ...d.data() }));
      setOutgoingRequests(reqs);
    });

    return () => {
      unsubIncoming();
      unsubOutgoing();
    };
  }, [currentId]);

  // ── Reload conversations when messages change ────────────────────────────
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ── Handle initialTargetUser passed from profile "Message" button ────────
  useEffect(() => {
    if (initialTargetUser) {
      setActivePartner(initialTargetUser);
    }
  }, [initialTargetUser]);

  // ── Determine connection status when partner changes ─────────────────────
  useEffect(() => {
    if (!activePartner || !currentId) {
      setConnectionStatus('none');
      return;
    }
    const partnerId = activePartner.uid || activePartner.id;

    // Check if they already have messages (accepted)
    const hasMessages = realtimeMessages.some(
      (m) =>
        (m.senderId === currentId && m.receiverId === partnerId) ||
        (m.senderId === partnerId && m.receiverId === currentId)
    );
    if (hasMessages) {
      setConnectionStatus('accepted');
      return;
    }

    // Check outgoing request
    const outgoing = outgoingRequests.find(
      (r) => r.receiverId === partnerId && r.status === 'pending'
    );
    if (outgoing) {
      setConnectionStatus('pendingOutgoing');
      return;
    }
    // Check if outgoing was accepted
    const acceptedOutgoing = outgoingRequests.find(
      (r) => r.receiverId === partnerId && r.status === 'accepted'
    );
    if (acceptedOutgoing) {
      setConnectionStatus('accepted');
      return;
    }

    // Check incoming request from this partner
    const incoming = incomingRequests.find((r) => r.senderId === partnerId);
    if (incoming) {
      setConnectionStatus('pendingIncoming');
      return;
    }

    setConnectionStatus('none');
  }, [activePartner, currentId, realtimeMessages, outgoingRequests, incomingRequests]);

  // ── Scroll to bottom when messages change ────────────────────────────────
  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [realtimeMessages, activePartner]);

  // ── Live search for new users to message ────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const snap = await getDocs(collection(db, 'users'));
        const q = searchQuery.toLowerCase();
        const results = [];
        snap.forEach((d) => {
          if (d.id === currentId) return;
          const data = d.data();
          if (
            data.username?.toLowerCase().includes(q) ||
            data.name?.toLowerCase().includes(q)
          ) {
            results.push({ id: d.id, uid: d.id, ...data });
          }
        });
        setSearchResults(results);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery, currentId]);

  // ── Send message request ─────────────────────────────────────────────────
  const handleSendRequest = async (targetUser) => {
    if (!currentUser) return;
    setRequestLoading(true);
    try {
      await addDoc(collection(db, 'messageRequests'), {
        senderId: currentId,
        senderUsername: currentUser.username,
        senderName: currentUser.name || currentUser.username,
        senderAvatar:
          currentUser.avatar ||
          `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.username}`,
        receiverId: targetUser.uid || targetUser.id,
        receiverUsername: targetUser.username,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      setActivePartner(targetUser);
      setSearchQuery('');
    } catch (err) {
      console.error('Error sending message request:', err);
    } finally {
      setRequestLoading(false);
    }
  };

  // ── Accept / Decline incoming request ────────────────────────────────────
  const handleRequestAction = async (requestId, action) => {
    try {
      await updateDoc(doc(db, 'messageRequests', requestId), {
        status: action // 'accepted' | 'declined'
      });
    } catch (err) {
      console.error('Error updating request:', err);
    }
  };

  // ── Media file selection ─────────────────────────────────────────────────
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setMediaError('');

    if (file.size > MAX_MEDIA_BYTES) {
      setMediaError(`File too large. Max size is ${Math.round(MAX_MEDIA_BYTES / 1024)} KB for chat media.`);
      return;
    }

    const isVideo = file.type.startsWith('video/');
    const base64 = await readFileAsDataURL(file);
    setMediaPreview({
      base64,
      type: isVideo ? 'video' : 'image',
      mimeType: file.type,
      name: file.name
    });
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  // ── Send message ─────────────────────────────────────────────────────────
  const handleSend = async (e) => {
    e.preventDefault();
    if (!activePartner || !currentUser) return;
    if (!inputText.trim() && !mediaPreview) return;

    const partnerId = activePartner.uid || activePartner.id;

    await sendMessage(
      partnerId,
      inputText.trim(),
      mediaPreview
        ? { base64: mediaPreview.base64, type: mediaPreview.type, mimeType: mediaPreview.mimeType }
        : null
    );

    setInputText('');
    setMediaPreview(null);
  };

  // ─── Guard: not logged in ─────────────────────────────────────────────────
  if (!currentUser) {
    return (
      <div className="text-center py-20">
        <MessageSquare className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">
          Sign in to Direct Message
        </h2>
        <p className="text-xs text-slate-400 mt-1 mb-4">
          Chat securely with people you connect with
        </p>
        <button
          onClick={() => openAuthModal('login')}
          className="px-6 py-2.5 bg-vibe-gradient text-white font-semibold text-sm rounded-xl shadow-lg shadow-purple-500/25"
        >
          Log In
        </button>
      </div>
    );
  }

  const partnerId = activePartner?.uid || activePartner?.id;
  const filteredMessages = realtimeMessages.filter(
    (m) =>
      (m.senderId === currentId && m.receiverId === partnerId) ||
      (m.senderId === partnerId && m.receiverId === currentId)
  );
  const pendingRequestCount = incomingRequests.length;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-5rem)] py-2 px-2 md:px-4">
      <div className="w-full h-full bg-white dark:bg-[#0E131F] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex">

        {/* ── Left Panel ─────────────────────────────────────────────────── */}
        <div
          className={`w-full md:w-80 border-r border-slate-200 dark:border-slate-800 flex flex-col ${
            activePartner ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Header with tabs */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Messages</h2>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-900 rounded-xl p-1">
              <button
                onClick={() => setActiveTab('chats')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'chats'
                    ? 'bg-white dark:bg-[#0E131F] text-purple-600 dark:text-purple-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                Chats
              </button>
              <button
                onClick={() => setActiveTab('requests')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all relative ${
                  activeTab === 'requests'
                    ? 'bg-white dark:bg-[#0E131F] text-purple-600 dark:text-purple-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                Requests
                {pendingRequestCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {pendingRequestCount}
                  </span>
                )}
              </button>
            </div>

            {/* Search to find new users */}
            <div className="relative mt-2">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users to message..."
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">

            {/* Search Results */}
            {searchQuery.trim() ? (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                  Search Results
                </p>
                {searching ? (
                  <div className="flex justify-center py-4">
                    <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : searchResults.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">No users found</p>
                ) : (
                  searchResults.map((u) => {
                    const uid = u.uid || u.id;
                    const sentRequest = outgoingRequests.find((r) => r.receiverId === uid);
                    const hasConvo = conversations.find((c) => (c.uid || c.id) === uid);

                    return (
                      <div
                        key={uid}
                        className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <img
                          src={
                            u.avatar ||
                            `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`
                          }
                          alt={u.username}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                            {u.name || u.username}
                          </p>
                          <p className="text-xs text-slate-400 truncate">@{u.username}</p>
                        </div>

                        {hasConvo ? (
                          <button
                            onClick={() => {
                              setActivePartner(u);
                              setSearchQuery('');
                            }}
                            className="shrink-0 px-3 py-1.5 text-xs bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold rounded-xl"
                          >
                            Open
                          </button>
                        ) : sentRequest ? (
                          <span className="shrink-0 flex items-center gap-1 px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold rounded-xl">
                            <Clock className="w-3 h-3" />
                            Sent
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSendRequest(u)}
                            disabled={requestLoading}
                            className="shrink-0 flex items-center gap-1 px-2.5 py-1 text-xs bg-vibe-gradient text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
                          >
                            <UserPlus className="w-3 h-3" />
                            Request
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            ) : activeTab === 'chats' ? (
              /* ─ Chats Tab ─ */
              conversations.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <MessageSquare className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    No conversations yet
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Search for users above to send a message request
                  </p>
                </div>
              ) : (
                conversations.map((partner) => {
                  const pid = partner.uid || partner.id;
                  const isSelected =
                    (activePartner?.uid || activePartner?.id) === pid;

                  // Last message for preview
                  const threadMsgs = realtimeMessages.filter(
                    (m) =>
                      (m.senderId === currentId && m.receiverId === pid) ||
                      (m.senderId === pid && m.receiverId === currentId)
                  );
                  const lastMsg = threadMsgs[threadMsgs.length - 1];

                  return (
                    <div
                      key={pid}
                      onClick={() => setActivePartner(partner)}
                      className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <img
                        src={
                          partner.avatar ||
                          `https://api.dicebear.com/7.x/avataaars/svg?seed=${partner.username}`
                        }
                        alt={partner.username}
                        className="w-12 h-12 rounded-full object-cover shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                          {partner.name || partner.username}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {lastMsg?.mediaUrl && !lastMsg?.text
                            ? lastMsg.mediaType === 'video'
                              ? '🎥 Video'
                              : '📷 Photo'
                            : lastMsg?.text || '@' + partner.username}
                        </p>
                      </div>
                      {lastMsg?.createdAt && (
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {new Date(lastMsg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      )}
                    </div>
                  );
                })
              )
            ) : (
              /* ─ Requests Tab ─ */
              <div className="space-y-2 p-1">
                {incomingRequests.length === 0 ? (
                  <div className="text-center py-10 px-4">
                    <ShieldCheck className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      No pending requests
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                      Incoming Requests
                    </p>
                    {incomingRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <img
                            src={
                              req.senderAvatar ||
                              `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.senderUsername}`
                            }
                            alt={req.senderUsername}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                              {req.senderName || req.senderUsername}
                            </p>
                            <p className="text-xs text-slate-400">@{req.senderUsername}</p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                          wants to send you a message
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRequestAction(req.id, 'accepted')}
                            className="flex-1 py-1.5 text-xs bg-vibe-gradient text-white font-semibold rounded-xl flex items-center justify-center gap-1 hover:opacity-90"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Accept
                          </button>
                          <button
                            onClick={() => handleRequestAction(req.id, 'declined')}
                            className="flex-1 py-1.5 text-xs bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl flex items-center justify-center gap-1 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* Outgoing requests */}
                {outgoingRequests.filter((r) => r.status === 'pending').length > 0 && (
                  <>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 pt-2">
                      Sent Requests
                    </p>
                    {outgoingRequests
                      .filter((r) => r.status === 'pending')
                      .map((req) => (
                        <div
                          key={req.id}
                          className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">
                              @{req.receiverUsername}
                            </p>
                            <p className="text-xs text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Pending
                            </p>
                          </div>
                        </div>
                      ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right Chat Panel ───────────────────────────────────────────── */}
        {activePartner ? (
          <div className="flex-1 flex flex-col bg-slate-50/50 dark:bg-[#0B0F17]/50">
            {/* Top bar */}
            <div className="p-3.5 px-5 bg-white dark:bg-[#0E131F] border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
              <button
                onClick={() => setActivePartner(null)}
                className="md:hidden p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <img
                src={
                  activePartner.avatar ||
                  `https://api.dicebear.com/7.x/avataaars/svg?seed=${activePartner.username}`
                }
                alt={activePartner.username}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-purple-500/30"
              />
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-none">
                  {activePartner.name || activePartner.username}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">@{activePartner.username}</p>
              </div>
            </div>

            {/* ── Blocked / Pending / Accepted zone ── */}
            {connectionStatus === 'none' && (
              /* No connection at all — show "Send Request" CTA */
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <img
                  src={
                    activePartner.avatar ||
                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${activePartner.username}`
                  }
                  alt={activePartner.username}
                  className="w-20 h-20 rounded-full object-cover ring-4 ring-purple-500/20 mb-4"
                />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
                  {activePartner.name || activePartner.username}
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Send a message request to start chatting with @{activePartner.username}
                </p>
                <button
                  onClick={() => handleSendRequest(activePartner)}
                  disabled={requestLoading}
                  className="flex items-center gap-2 px-6 py-3 bg-vibe-gradient text-white font-semibold text-sm rounded-xl shadow-lg shadow-purple-500/25 hover:opacity-95 disabled:opacity-50 transition-all"
                >
                  {requestLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  Send Message Request
                </button>
              </div>
            )}

            {connectionStatus === 'pendingOutgoing' && (
              /* Waiting for them to accept */
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
                  <Clock className="w-8 h-8 text-amber-500" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
                  Request Sent
                </h3>
                <p className="text-xs text-slate-400">
                  Waiting for @{activePartner.username} to accept your message request
                </p>
              </div>
            )}

            {connectionStatus === 'pendingIncoming' && (
              /* They sent US a request — show accept/decline */
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <img
                  src={
                    activePartner.avatar ||
                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${activePartner.username}`
                  }
                  alt={activePartner.username}
                  className="w-20 h-20 rounded-full object-cover ring-4 ring-purple-500/20 mb-4"
                />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
                  Message Request
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  @{activePartner.username} wants to send you a message
                </p>
                <div className="flex gap-3">
                  {(() => {
                    const req = incomingRequests.find(
                      (r) => r.senderId === (activePartner.uid || activePartner.id)
                    );
                    if (!req) return null;
                    return (
                      <>
                        <button
                          onClick={() => handleRequestAction(req.id, 'accepted')}
                          className="flex items-center gap-2 px-5 py-2.5 bg-vibe-gradient text-white font-semibold text-sm rounded-xl hover:opacity-95"
                        >
                          <Check className="w-4 h-4" /> Accept
                        </button>
                        <button
                          onClick={() => {
                            handleRequestAction(req.id, 'declined');
                            setActivePartner(null);
                          }}
                          className="flex items-center gap-2 px-5 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-sm rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600"
                        >
                          <Ban className="w-4 h-4" /> Decline
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {connectionStatus === 'accepted' && (
              /* ── Full Chat View ── */
              <>
                {/* Message Stream */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {filteredMessages.length === 0 ? (
                    <div className="text-center py-16 text-xs text-slate-400">
                      Wave hello to @{activePartner.username}! 👋
                    </div>
                  ) : (
                    filteredMessages.map((msg) => (
                      <MessageBubble
                        key={msg.id}
                        msg={msg}
                        isMine={msg.senderId === currentId}
                      />
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Media preview bar */}
                {mediaPreview && (
                  <div className="px-3 pb-2 bg-white dark:bg-[#0E131F] border-t border-slate-200 dark:border-slate-800">
                    <div className="relative inline-block mt-2">
                      {mediaPreview.type === 'video' ? (
                        <video
                          src={mediaPreview.base64}
                          className="h-20 rounded-xl object-cover border border-slate-300 dark:border-slate-700"
                        />
                      ) : (
                        <img
                          src={mediaPreview.base64}
                          alt="preview"
                          className="h-20 rounded-xl object-cover border border-slate-300 dark:border-slate-700"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => setMediaPreview(null)}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-sm"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-md">
                        {mediaPreview.type === 'video' ? '🎥 Video' : '📷 Photo'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Error */}
                {mediaError && (
                  <div className="px-3 py-1.5 bg-red-50 dark:bg-red-500/10 border-t border-red-200 dark:border-red-500/20 flex items-center gap-1.5 text-xs text-red-500">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{mediaError}</span>
                    <button onClick={() => setMediaError('')} className="ml-auto">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Input Bar */}
                <form
                  onSubmit={handleSend}
                  className="p-3 bg-white dark:bg-[#0E131F] border-t border-slate-200 dark:border-slate-800 flex items-center gap-2"
                >
                  {/* Attachment button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-slate-400 hover:text-purple-500 dark:hover:text-purple-400 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"
                    title="Attach image or video"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={`Message @${activePartner.username}...`}
                    className="flex-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-purple-500"
                  />

                  <button
                    type="submit"
                    disabled={!inputText.trim() && !mediaPreview}
                    className="w-10 h-10 rounded-2xl bg-vibe-gradient text-white flex items-center justify-center shadow-md shadow-purple-500/20 disabled:opacity-40 hover:scale-105 active:scale-95 transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </>
            )}
          </div>
        ) : (
          <div className="hidden md:flex flex-1 flex-col items-center justify-center text-center p-8">
            <MessageSquare className="w-16 h-16 text-slate-300 dark:text-slate-700 mb-3" />
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">Your Messages</h3>
            <p className="text-xs text-slate-400 mt-1">
              Search for users or select a conversation
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
