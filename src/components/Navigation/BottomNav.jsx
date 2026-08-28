import React from 'react';
import { Home, Search, PlusSquare, MessageSquare, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function BottomNav({ activeTab, setActiveTab, openCreatePost, openAuthModal }) {
  const { user } = useAuth();

  const navItems = [
    { id: 'feed', label: 'Home', icon: Home },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'create', label: 'Post', icon: PlusSquare, isAction: true },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/90 dark:bg-[#0E131F]/90 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 flex items-center justify-around z-40 px-2">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        if (item.isAction) {
          return (
            <button
              key={item.id}
              onClick={() => {
                if (!user) {
                  openAuthModal('login');
                  return;
                }
                openCreatePost();
              }}
              className="w-11 h-11 rounded-xl bg-vibe-gradient text-white flex items-center justify-center shadow-lg shadow-purple-500/30 active:scale-95 transition-transform"
            >
              <Icon className="w-6 h-6" />
            </button>
          );
        }

        return (
          <button
            key={item.id}
            onClick={() => {
              if (!user && (item.id === 'messages' || item.id === 'profile')) {
                openAuthModal('login');
                return;
              }
              setActiveTab(item.id);
            }}
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-colors ${
              isActive
                ? 'text-purple-600 dark:text-purple-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            {item.id === 'profile' && user ? (
              <img
                src={user.avatar}
                alt={user.username}
                className={`w-6 h-6 rounded-full object-cover ${
                  isActive ? 'ring-2 ring-purple-500' : ''
                }`}
              />
            ) : (
              <Icon className={`w-6 h-6 ${isActive ? 'scale-110' : ''}`} />
            )}
          </button>
        );
      })}
    </div>
  );
}
