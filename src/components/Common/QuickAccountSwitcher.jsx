import React, { useState } from 'react';
import { Users, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function QuickAccountSwitcher() {
  const { user, allDemoUsers, switchUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (!user || allDemoUsers.length === 0) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-40">
      {isOpen && (
        <div className="mb-2 p-3 bg-white dark:bg-[#0E131F] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl space-y-2 animate-fade-in w-56">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Users className="w-3 h-3 text-purple-500" /> Switch Logged In User
          </p>

          <div className="space-y-1">
            {allDemoUsers.map(account => {
              const isCurrent = account.id === user.id;
              return (
                <button
                  key={account.id}
                  onClick={() => {
                    if (!isCurrent) {
                      switchUser(account.username);
                      setIsOpen(false);
                    }
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-colors ${
                    isCurrent
                      ? 'bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 text-purple-600 font-bold'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <img src={account.avatar} alt={account.username} className="w-6 h-6 rounded-full object-cover shrink-0" />
                    <span className="truncate">@{account.username}</span>
                  </div>
                  {isCurrent && <span className="text-[10px] bg-purple-500 text-white px-1.5 py-0.5 rounded-full">Active</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full font-bold text-xs shadow-xl hover:scale-105 active:scale-95 transition-all border border-slate-700 dark:border-slate-200"
      >
        <RefreshCw className={`w-3.5 h-3.5 text-purple-400 ${isOpen ? 'animate-spin' : ''}`} />
        <span>Switch User</span>
      </button>
    </div>
  );
}
