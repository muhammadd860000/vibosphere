import React from 'react';
import { 
  Home, 
  Search, 
  MessageSquare, 
  PlusSquare, 
  User, 
  Sun, 
  Moon, 
  LogOut, 
  Sparkles
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar({ activeTab, setActiveTab, openCreatePost, openAuthModal }) {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'feed', label: 'Home', icon: Home },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen sticky top-0 border-r border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0E131F] p-4 transition-colors z-30 justify-between">
      {/* Brand Header */}
      <div>
        <div 
          onClick={() => setActiveTab('feed')}
          className="flex items-center gap-3 px-3 py-4 mb-6 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-vibe-gradient flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-105 transition-transform duration-200">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-vibe-gradient tracking-tight leading-none">
              VibeSphere
            </h1>
            <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 dark:text-slate-500">
              Firebase Social
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
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
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl font-medium text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-purple-600 dark:text-purple-400 scale-110' : ''}`} />
                <span>{item.label}</span>
              </button>
            );
          })}

          {/* Create Post Button */}
          <button
            onClick={() => {
              if (!user) {
                openAuthModal('login');
                return;
              }
              openCreatePost();
            }}
            className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-semibold text-sm bg-vibe-gradient text-white shadow-md shadow-purple-500/25 hover:opacity-95 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <PlusSquare className="w-5 h-5" />
            <span>Create Post</span>
          </button>
        </nav>
      </div>

      {/* User Section & Theme Toggle */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800/80 space-y-3">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            {theme === 'dark' ? <Moon className="w-5 h-5 text-purple-400" /> : <Sun className="w-5 h-5 text-amber-500" />}
            <span>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
          </div>
          <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">{theme}</span>
        </button>

        {user ? (
          <div className="bg-slate-100 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div 
              onClick={() => setActiveTab('profile')}
              className="flex items-center gap-2.5 cursor-pointer overflow-hidden flex-1 min-w-0"
            >
              <img
                src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                alt={user.username}
                className="w-9 h-9 rounded-full object-cover ring-2 ring-purple-500/30"
              />
              <div className="truncate">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{user.name || user.username}</p>
                <p className="text-xs text-slate-400 truncate">@{user.username}</p>
              </div>
            </div>

            <button
              onClick={logout}
              title="Log Out"
              className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              onClick={() => openAuthModal('login')}
              className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Log In
            </button>
            <button
              onClick={() => openAuthModal('signup')}
              className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors"
            >
              Sign Up
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
