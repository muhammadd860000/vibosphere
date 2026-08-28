import React, { useState } from 'react';
import { 
  Heart, 
  MessageCircle, 
  Send, 
  Bookmark, 
  MoreHorizontal, 
  MapPin, 
  Volume2, 
  VolumeX
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { db, doc, updateDoc, arrayUnion, arrayRemove } from '../../firebase';
import { useAuth } from '../../context/AuthContext';

export default function PostCard({ post, onUserClick, openAuthModal }) {
  const { user } = useAuth();
  
  const currentUserId = user?.uid || user?.id;
  const [liked, setLiked] = useState(() => post.likes?.includes(currentUserId) || false);
  const [likeCount, setLikeCount] = useState(post.likes?.length || 0);
  const [bookmarked, setBookmarked] = useState(false);
  const [showHeartAnim, setShowHeartAnim] = useState(false);

  // Comments state
  const [comments, setComments] = useState(post.comments || []);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Video state
  const [isMuted, setIsMuted] = useState(true);

  const handleLikeToggle = async () => {
    if (!user) {
      openAuthModal('login');
      return;
    }

    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount(prev => (nextLiked ? prev + 1 : prev - 1));

    if (nextLiked) {
      confetti({
        particleCount: 25,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#EC4899', '#8B5CF6', '#F43F5E']
      });
    }

    try {
      const postRef = doc(db, 'posts', post.id);
      await updateDoc(postRef, {
        likes: nextLiked ? arrayUnion(currentUserId) : arrayRemove(currentUserId)
      });
    } catch (err) {
      console.error('Firestore like update error:', err);
    }
  };

  const handleDoubleTap = () => {
    if (!liked) {
      handleLikeToggle();
    }
    setShowHeartAnim(true);
    setTimeout(() => setShowHeartAnim(false), 800);
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || !user) {
      if (!user) openAuthModal('login');
      return;
    }

    setSubmittingComment(true);
    const newCommentObj = {
      id: 'c_' + Date.now(),
      userId: currentUserId,
      username: user.username,
      userAvatar: user.avatar,
      text: commentText.trim(),
      createdAt: new Date().toISOString()
    };

    try {
      const postRef = doc(db, 'posts', post.id);
      await updateDoc(postRef, {
        comments: arrayUnion(newCommentObj)
      });

      setComments(prev => [...prev, newCommentObj]);
      setCommentText('');
    } catch (err) {
      console.error('Failed to save comment to Firestore:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const formatTimeAgo = (isoString) => {
    if (!isoString) return 'Just now';
    const diff = Math.floor((new Date() - new Date(isoString)) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const authorName = post.authorName || post.author?.name || post.username || 'Creator';
  const authorUsername = post.username || post.author?.username || 'user';
  const authorAvatar = post.authorAvatar || post.author?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${authorUsername}`;

  return (
    <article className="bg-white dark:bg-[#0E131F] rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-md shadow-slate-200/50 dark:shadow-none overflow-hidden transition-all duration-200 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800/50">
        <div 
          onClick={() => onUserClick(authorUsername)}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <img
            src={authorAvatar}
            alt={authorUsername}
            className="w-10 h-10 rounded-full object-cover ring-2 ring-purple-500/30 group-hover:scale-105 transition-transform"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                {authorName}
              </h3>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>@{authorUsername}</span>
              {post.location && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-0.5 text-purple-500">
                    <MapPin className="w-3 h-3" />
                    {post.location}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-400">{formatTimeAgo(post.createdAt)}</span>
          <button className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Media Container with Double Tap Heart */}
      <div 
        onDoubleClick={handleDoubleTap}
        className="relative aspect-square md:aspect-[4/3] w-full bg-slate-900 overflow-hidden flex items-center justify-center cursor-pointer select-none group"
      >
        {post.type === 'video' ? (
          <div className="relative w-full h-full">
            <video
              src={post.mediaUrl}
              autoPlay
              loop
              muted={isMuted}
              playsInline
              className="w-full h-full object-cover"
            />
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="absolute bottom-3 right-3 p-2 rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80 transition-colors z-10"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        ) : (
          <img
            src={post.mediaUrl}
            alt="Post media"
            className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-300"
          />
        )}

        {showHeartAnim && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <Heart className="w-24 h-24 text-pink-500 fill-pink-500 animate-bounce shadow-2xl" />
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleLikeToggle}
              className="flex items-center gap-1.5 transition-transform active:scale-125"
            >
              <Heart
                className={`w-6 h-6 transition-colors ${
                  liked
                    ? 'text-pink-500 fill-pink-500'
                    : 'text-slate-700 dark:text-slate-300 hover:text-pink-500'
                }`}
              />
            </button>

            <button
              onClick={() => setShowComments(!showComments)}
              className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 hover:text-purple-500 transition-colors"
            >
              <MessageCircle className="w-6 h-6" />
            </button>

            <button
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href);
                alert('Post link copied!');
              }}
              className="text-slate-700 dark:text-slate-300 hover:text-purple-500 transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={() => setBookmarked(!bookmarked)}
            className="text-slate-700 dark:text-slate-300 hover:text-amber-500 transition-colors"
          >
            <Bookmark className={`w-6 h-6 ${bookmarked ? 'text-amber-500 fill-amber-500' : ''}`} />
          </button>
        </div>

        {/* Likes Count */}
        <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
          {likeCount} {likeCount === 1 ? 'like' : 'likes'}
        </div>

        {/* Caption */}
        {post.caption && (
          <div className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
            <span 
              onClick={() => onUserClick(authorUsername)}
              className="font-bold text-slate-900 dark:text-slate-100 mr-2 cursor-pointer hover:underline"
            >
              {authorUsername}
            </span>
            <span>{post.caption}</span>
          </div>
        )}

        {/* Comments Toggle */}
        {comments.length > 0 && !showComments && (
          <button
            onClick={() => setShowComments(true)}
            className="text-xs font-semibold text-slate-400 hover:text-purple-500 transition-colors"
          >
            View all {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
          </button>
        )}

        {/* Comments List */}
        {showComments && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 space-y-2.5 max-h-48 overflow-y-auto pr-1">
            {comments.map((comment) => (
              <div key={comment.id || Math.random()} className="flex items-start gap-2.5 text-xs">
                <img
                  src={comment.userAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.username}`}
                  alt={comment.username}
                  className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5"
                />
                <div className="flex-1 bg-slate-50 dark:bg-slate-900/80 p-2 rounded-xl">
                  <div className="flex items-center justify-between mb-0.5">
                    <span 
                      onClick={() => onUserClick(comment.username)}
                      className="font-bold text-slate-900 dark:text-slate-100 cursor-pointer hover:underline"
                    >
                      @{comment.username || 'user'}
                    </span>
                    <span className="text-[10px] text-slate-400">{formatTimeAgo(comment.createdAt)}</span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300">{comment.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Comment Input */}
        <form onSubmit={handleAddComment} className="pt-2 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800/60">
          <input
            type="text"
            placeholder="Add a vibe comment..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none py-1"
          />
          <button
            type="submit"
            disabled={!commentText.trim() || submittingComment}
            className="text-xs font-bold text-purple-600 dark:text-purple-400 disabled:opacity-40 hover:underline"
          >
            Post
          </button>
        </form>
      </div>
    </article>
  );
}
