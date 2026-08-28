import React, { useState, useEffect } from 'react';
import { Search, UserCheck, UserPlus, Sparkles, Users } from 'lucide-react';
import { db, collection, getDocs, doc, updateDoc, arrayUnion, arrayRemove } from '../../firebase';
import { useAuth } from '../../context/AuthContext';

export default function SearchView({ onSelectUser, openAuthModal }) {
  const { user: currentUser } = useAuth();
  const [queryText, setQueryText] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followingMap, setFollowingMap] = useState({});

  useEffect(() => {
    fetchUsers();
  }, [currentUser]);

  useEffect(() => {
    if (!queryText.trim()) {
      setFilteredUsers(allUsers);
    } else {
      const q = queryText.toLowerCase();
      setFilteredUsers(
        allUsers.filter(u => 
          u.username?.toLowerCase().includes(q) || u.name?.toLowerCase().includes(q)
        )
      );
    }
  }, [queryText, allUsers]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const list = [];
      const followMap = {};

      querySnapshot.forEach(docSnap => {
        const uData = docSnap.data();
        const uId = docSnap.id;
        list.push({ id: uId, uid: uId, ...uData });

        if (currentUser) {
          const isFollowing = uData.followers?.includes(currentUser.uid || currentUser.id) || currentUser.following?.includes(uId);
          followMap[uId] = !!isFollowing;
        }
      });

      setAllUsers(list);
      setFilteredUsers(list);
      setFollowingMap(followMap);
    } catch (err) {
      console.error('Failed to fetch Firestore users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async (e, targetUser) => {
    e.stopPropagation();
    if (!currentUser) {
      openAuthModal('login');
      return;
    }

    const currentId = currentUser.uid || currentUser.id;
    const targetId = targetUser.uid || targetUser.id;
    const isFollowing = followingMap[targetId];

    setFollowingMap(prev => ({ ...prev, [targetId]: !isFollowing }));

    try {
      const targetRef = doc(db, 'users', targetId);
      const currentRef = doc(db, 'users', currentId);

      if (isFollowing) {
        await updateDoc(targetRef, { followers: arrayRemove(currentId) });
        await updateDoc(currentRef, { following: arrayRemove(targetId) });
      } else {
        await updateDoc(targetRef, { followers: arrayUnion(currentId) });
        await updateDoc(currentRef, { following: arrayUnion(targetId) });
      }
    } catch (err) {
      console.error('Error toggling follow status in Firestore:', err);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-4 px-4 pb-20">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-purple-500" />
          Discover & Search Users
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Search real accounts stored on Cloud Firestore
        </p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
        <input
          type="text"
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder="Search by username or name..."
          className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-[#0E131F] border border-slate-200 dark:border-slate-800 rounded-2xl text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:outline-none focus:border-purple-500 transition-colors"
        />
      </div>

      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
          {queryText ? `Search Results for "${queryText}"` : 'All Registered Accounts'}
        </h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-[#0E131F] rounded-3xl border border-slate-200 dark:border-slate-800 p-8">
            <Users className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-base font-semibold text-slate-700 dark:text-slate-300">No accounts registered yet</p>
            <p className="text-xs text-slate-400 mt-1">Be the first to invite friends to join VibeSphere!</p>
          </div>
        ) : (
          filteredUsers.map((account) => {
            const isSelf = (currentUser?.uid || currentUser?.id) === (account.uid || account.id);
            const isFollowing = followingMap[account.uid || account.id];

            return (
              <div
                key={account.id}
                onClick={() => onSelectUser(account.username)}
                className="flex items-center justify-between p-4 bg-white dark:bg-[#0E131F] border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-purple-500/50 transition-all cursor-pointer shadow-sm group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <img
                    src={account.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${account.username}`}
                    alt={account.username}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-purple-500/20 group-hover:scale-105 transition-transform"
                  />
                  <div className="truncate">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors truncate">
                      {account.name || account.username}
                    </h3>
                    <p className="text-xs text-slate-400 truncate">@{account.username}</p>
                    {account.bio && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 truncate mt-0.5 max-w-xs">
                        {account.bio}
                      </p>
                    )}
                  </div>
                </div>

                {!isSelf && (
                  <button
                    onClick={(e) => handleFollowToggle(e, account)}
                    className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                      isFollowing
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10'
                        : 'bg-vibe-gradient text-white shadow-md shadow-purple-500/20 hover:opacity-95'
                    }`}
                  >
                    {isFollowing ? (
                      <>
                        <UserCheck className="w-4 h-4" />
                        <span>Following</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>Follow</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
