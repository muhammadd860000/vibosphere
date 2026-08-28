import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';

// Navigation Components
import Sidebar from './components/Navigation/Sidebar';
import BottomNav from './components/Navigation/BottomNav';
import Header from './components/Navigation/Header';

// View Components
import Stories from './components/Feed/Stories';
import PostCard from './components/Feed/PostCard';
import SearchView from './components/Search/SearchView';
import ProfileView from './components/Profile/ProfileView';
import MessagesView from './components/Messages/MessagesView';

// Modals
import AuthModal from './components/Auth/AuthModal';
import ProfileSetupModal from './components/Auth/ProfileSetupModal';
import CreatePostModal from './components/CreatePost/CreatePostModal';

import { Sparkles } from 'lucide-react';
import { db, collection, query, orderBy, onSnapshot } from './firebase';

function AppContent() {
  const { user, needsOnboarding, setNeedsOnboarding } = useAuth();

  const [activeTab, setActiveTab] = useState('feed');
  const [profileTargetUser, setProfileTargetUser] = useState(null);
  const [chatTargetUser, setChatTargetUser] = useState(null);

  // Modal States
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  // Real-time Posts Feed State from Cloud Firestore
  const [posts, setPosts] = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);

  useEffect(() => {
    // Real-time listener for posts in Cloud Firestore
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsList = [];
      snapshot.forEach(docSnap => {
        postsList.push({ id: docSnap.id, ...docSnap.data() });
      });
      setPosts(postsList);
      setFeedLoading(false);
    }, (err) => {
      console.warn('Posts feed snapshot warning:', err);
      setFeedLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleOpenAuth = (mode = 'login') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  const handleUserClick = (username) => {
    setProfileTargetUser(username);
    setActiveTab('profile');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenChatWithUser = (targetUser) => {
    setChatTargetUser(targetUser);
    setActiveTab('messages');
  };

  const handlePostCreated = (newPost) => {
    setActiveTab('feed');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 flex flex-col md:flex-row transition-colors">
      {/* Desktop Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab === 'profile') setProfileTargetUser(null);
          setActiveTab(tab);
        }}
        openCreatePost={() => setCreatePostOpen(true)}
        openAuthModal={handleOpenAuth}
      />

      {/* Mobile Header */}
      <Header
        setActiveTab={setActiveTab}
        openAuthModal={handleOpenAuth}
      />

      {/* Main View Area */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-2 md:px-6 pt-4 min-h-screen">
        {activeTab === 'feed' && (
          <div className="max-w-2xl mx-auto pb-24">
            <Stories openCreatePost={() => setCreatePostOpen(true)} />

            {feedLoading ? (
              <div className="flex justify-center py-20">
                <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-[#0E131F] rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
                <Sparkles className="w-12 h-12 text-purple-500 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">No Posts in VibeSphere Yet</h3>
                <p className="text-xs text-slate-400 mt-1 mb-4">Be the first creator to post an image or video to Firebase!</p>
                <button
                  onClick={() => {
                    if (!user) {
                      handleOpenAuth('signup');
                      return;
                    }
                    setCreatePostOpen(true);
                  }}
                  className="px-5 py-2.5 bg-vibe-gradient text-white font-semibold text-xs rounded-xl shadow-lg shadow-purple-500/25"
                >
                  Create First Post
                </button>
              </div>
            ) : (
              posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onUserClick={handleUserClick}
                  openAuthModal={handleOpenAuth}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'search' && (
          <SearchView
            onSelectUser={handleUserClick}
            openAuthModal={handleOpenAuth}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileView
            username={profileTargetUser || user?.username}
            onOpenChat={handleOpenChatWithUser}
            openAuthModal={handleOpenAuth}
            openEditProfile={() => setEditProfileOpen(true)}
          />
        )}

        {activeTab === 'messages' && (
          <MessagesView
            initialTargetUser={chatTargetUser}
            openAuthModal={handleOpenAuth}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab === 'profile') setProfileTargetUser(null);
          setActiveTab(tab);
        }}
        openCreatePost={() => setCreatePostOpen(true)}
        openAuthModal={handleOpenAuth}
      />

      {/* Modals */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authMode}
      />

      <ProfileSetupModal
        isOpen={needsOnboarding || editProfileOpen}
        onClose={() => {
          setNeedsOnboarding(false);
          setEditProfileOpen(false);
        }}
      />

      <CreatePostModal
        isOpen={createPostOpen}
        onClose={() => setCreatePostOpen(false)}
        onPostCreated={handlePostCreated}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <AppContent />
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
