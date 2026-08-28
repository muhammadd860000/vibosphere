import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, MessageSquare, ArrowLeft } from 'lucide-react';
import { db, collection, getDocs } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

export default function MessagesView({ initialTargetUser, openAuthModal }) {
  const { user: currentUser } = useAuth();
  const { sendMessage, realtimeMessages } = useSocket();

  const [conversations, setConversations] = useState([]);
  const [activePartner, setActivePartner] = useState(initialTargetUser || null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const currentId = currentUser?.uid || currentUser?.id;

  useEffect(() => {
    fetchRegisteredUsers();
  }, [currentUser]);

  useEffect(() => {
    if (initialTargetUser) {
      setActivePartner(initialTargetUser);
    }
  }, [initialTargetUser]);

  useEffect(() => {
    scrollToBottom();
  }, [realtimeMessages, activePartner]);

  const fetchRegisteredUsers = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const partnerList = [];

      snap.forEach(docSnap => {
        const uData = docSnap.data();
        const uId = docSnap.id;
        if (uId !== currentId) {
          partnerList.push({ id: uId, uid: uId, ...uData });
        }
      });

      setConversations(partnerList);
      if (!activePartner && partnerList.length > 0) {
        setActivePartner(partnerList[0]);
      }
    } catch (err) {
      console.error('Error loading conversations from Firestore:', err);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !activePartner || !currentUser) return;

    const textToSend = inputText.trim();
    setInputText('');

    const targetId = activePartner.uid || activePartner.id;
    await sendMessage(targetId, textToSend);
    scrollToBottom();
  };

  if (!currentUser) {
    return (
      <div className="text-center py-20">
        <MessageSquare className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Sign in to Direct Message</h2>
        <p className="text-xs text-slate-400 mt-1 mb-4">Chat live with registered users on Firebase</p>
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
    m => (m.senderId === currentId && m.receiverId === partnerId) ||
         (m.senderId === partnerId && m.receiverId === currentId)
  );

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-5rem)] py-2 px-2 md:px-4">
      <div className="w-full h-full bg-white dark:bg-[#0E131F] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex">
        
        {/* Left Inbox List */}
        <div className={`w-full md:w-80 border-r border-slate-200 dark:border-slate-800 flex flex-col ${activePartner ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              Direct Messages
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations.length === 0 ? (
              <div className="text-center py-10 px-4 text-xs text-slate-400">
                No other registered users found yet.
              </div>
            ) : (
              conversations.map((partner) => {
                const isSelected = (activePartner?.uid || activePartner?.id) === (partner.uid || partner.id);

                return (
                  <div
                    key={partner.id}
                    onClick={() => setActivePartner(partner)}
                    className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <img
                      src={partner.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${partner.username}`}
                      alt={partner.username}
                      className="w-12 h-12 rounded-full object-cover"
                    />

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {partner.name || partner.username}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        @{partner.username}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Chat Panel */}
        {activePartner ? (
          <div className={`flex-1 flex flex-col bg-slate-50/50 dark:bg-[#0B0F17]/50 ${!activePartner ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-3.5 px-5 bg-white dark:bg-[#0E131F] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActivePartner(null)}
                  className="md:hidden p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <img
                  src={activePartner.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activePartner.username}`}
                  alt={activePartner.username}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-purple-500/30"
                />

                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-none">
                    {activePartner.name || activePartner.username}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    @{activePartner.username}
                  </p>
                </div>
              </div>
            </div>

            {/* Message Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredMessages.length === 0 ? (
                <div className="text-center py-16 text-xs text-slate-400">
                  Wave hello to @{activePartner.username}! Start the conversation on Cloud Firestore.
                </div>
              ) : (
                filteredMessages.map((msg) => {
                  const isMine = msg.senderId === currentId;

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                          isMine
                            ? 'bg-vibe-gradient text-white rounded-br-none'
                            : 'bg-white dark:bg-[#0E131F] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-none'
                        }`}
                      >
                        {msg.text}
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 px-1">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSend} className="p-3 bg-white dark:bg-[#0E131F] border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Message @${activePartner.username}...`}
                className="flex-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-purple-500"
              />

              <button
                type="submit"
                disabled={!inputText.trim()}
                className="w-10 h-10 rounded-2xl bg-vibe-gradient text-white flex items-center justify-center shadow-md shadow-purple-500/20 disabled:opacity-40 hover:scale-105 active:scale-95 transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          <div className="hidden md:flex flex-1 flex-col items-center justify-center text-center p-8">
            <MessageSquare className="w-16 h-16 text-slate-300 dark:text-slate-700 mb-3" />
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">Your Messages</h3>
            <p className="text-xs text-slate-400 mt-1">Select a user to chat in real-time</p>
          </div>
        )}
      </div>
    </div>
  );
}
