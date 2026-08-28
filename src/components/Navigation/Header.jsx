import React from 'react';
import { Sparkles, MessageSquare, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

export default function Header({ setActiveTab, openAuthModal }) {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

  return (
    <header className="md:hidden sticky top-0 left-0 right-0 h-14 bg-white/90 dark:bg-[#0E131F]/90 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 z-40">
      <div 
        onClick={() => setActiveTab('feed')}
        className="flex items-center gap-2 cursor-pointer"
      >
        <div className="w-8 h-8 rounded-lg bg-vibe-gradient flex items-center justify-center shadow-md shadow-purple-500/20">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <span className="text-lg font-bold text-vibe-gradient tracking-tight">
          VibeSphere
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
        >
          {theme === 'dark' ? <Moon className="w-5 h-5 text-purple-400" /> : <Sun className="w-5 h-5 text-amber-500" />}
        </button>

        <button
          onClick={() => {
            if (!user) {
              openAuthModal('login');
              return;
            }
            setActiveTab('messages');
          }}
          className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors relative"
        >
          <MessageSquare className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
