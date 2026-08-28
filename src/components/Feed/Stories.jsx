import React, { useState, useEffect } from 'react';
import { Plus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { db, collection, getDocs, query, orderBy, onSnapshot } from '../../firebase';
import { useAuth } from '../../context/AuthContext';

export default function Stories({ openCreatePost }) {
  const { user } = useAuth();
  const [stories, setStories] = useState([]);
  const [activeStoryIndex, setActiveStoryIndex] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'stories'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const storyList = [];
      snapshot.forEach(doc => storyList.push({ id: doc.id, ...doc.data() }));
      setStories(storyList);
    }, (err) => {
      console.warn('Stories snapshot warning:', err);
    });

    return () => unsubscribe();
  }, []);

  const handleNextStory = () => {
    if (activeStoryIndex !== null && activeStoryIndex < stories.length - 1) {
      setActiveStoryIndex(activeStoryIndex + 1);
    } else {
      setActiveStoryIndex(null);
    }
  };

  const handlePrevStory = () => {
    if (activeStoryIndex !== null && activeStoryIndex > 0) {
      setActiveStoryIndex(activeStoryIndex - 1);
    }
  };

  return (
    <div className="mb-6">
      {/* Horizontal Scroll Story List */}
      <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-none">
        {/* Create Story Bubble */}
        <div className="flex flex-col items-center shrink-0">
          <button
            onClick={openCreatePost}
            className="relative w-16 h-16 rounded-full p-[2px] bg-slate-200 dark:bg-slate-800 flex items-center justify-center group hover:scale-105 transition-transform"
          >
            {user ? (
              <img src={user.avatar} alt="You" className="w-full h-full rounded-full object-cover" />
            ) : (
              <div className="w-full h-full rounded-full bg-purple-500/20 flex items-center justify-center">
                <Plus className="w-6 h-6 text-purple-500" />
              </div>
            )}
            <div className="absolute bottom-0 right-0 w-5 h-5 bg-purple-600 border-2 border-white dark:border-[#0E131F] rounded-full flex items-center justify-center text-white">
              <Plus className="w-3.5 h-3.5" />
            </div>
          </button>
          <span className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 font-medium truncate max-w-[64px]">
            Your Vibe
          </span>
        </div>

        {/* Real-time Stories from Cloud Firestore */}
        {stories.map((story, idx) => (
          <div key={story.id} className="flex flex-col items-center shrink-0">
            <button
              onClick={() => setActiveStoryIndex(idx)}
              className="w-16 h-16 rounded-full p-[2.5px] bg-vibe-gradient hover:scale-105 transition-transform shadow-md shadow-purple-500/10"
            >
              <div className="w-full h-full rounded-full p-[2px] bg-white dark:bg-[#0E131F]">
                <img
                  src={story.userAvatar || story.author?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=story'}
                  alt={story.username}
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
            </button>
            <span className="text-xs text-slate-700 dark:text-slate-300 mt-1.5 font-medium truncate max-w-[64px]">
              {story.username || 'user'}
            </span>
          </div>
        ))}
      </div>

      {/* Fullscreen Story Viewer Modal */}
      {activeStoryIndex !== null && stories[activeStoryIndex] && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
          <button
            onClick={() => setActiveStoryIndex(null)}
            className="absolute top-4 right-4 z-10 p-2 text-white/80 hover:text-white rounded-full bg-white/10 backdrop-blur-md"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="relative w-full max-w-sm h-[80vh] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between">
            {/* Top Author Bar */}
            <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-10 flex items-center gap-3">
              <img
                src={stories[activeStoryIndex].userAvatar}
                alt={stories[activeStoryIndex].username}
                className="w-9 h-9 rounded-full object-cover border border-white/50"
              />
              <div>
                <p className="text-sm font-bold text-white leading-none">
                  {stories[activeStoryIndex].name || stories[activeStoryIndex].username}
                </p>
                <p className="text-xs text-white/70">@{stories[activeStoryIndex].username}</p>
              </div>
            </div>

            {/* Media Content */}
            <div className="w-full h-full flex items-center justify-center bg-black">
              <img
                src={stories[activeStoryIndex].mediaUrl}
                alt="Story"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Caption */}
            {stories[activeStoryIndex].caption && (
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent z-10">
                <p className="text-sm text-white font-medium text-center">
                  {stories[activeStoryIndex].caption}
                </p>
              </div>
            )}

            {/* Nav Arrows */}
            {activeStoryIndex > 0 && (
              <button
                onClick={handlePrevStory}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/40 text-white rounded-full backdrop-blur-sm"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {activeStoryIndex < stories.length - 1 && (
              <button
                onClick={handleNextStory}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/40 text-white rounded-full backdrop-blur-sm"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
