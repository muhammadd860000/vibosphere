import React, { useState } from 'react';
import { X, Upload, Sparkles, Check, AlertCircle } from 'lucide-react';
import { db, collection, addDoc } from '../../firebase';
import { useAuth } from '../../context/AuthContext';

export default function CreatePostModal({ isOpen, onClose, onPostCreated }) {
  const { user } = useAuth();

  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState('image');
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    setMediaType(isVideo ? 'video' : 'image');

    // Read as Base64 Data URL for instant media encoding
    const reader = new FileReader();
    reader.onload = (event) => {
      setMediaUrl(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!mediaUrl) {
      setError('Please select an image or video file first');
      return;
    }

    if (!user) {
      setError('You must be logged in to create a post');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const newPostDoc = {
        userId: user.uid || user.id,
        username: user.username,
        authorName: user.name || user.username,
        authorAvatar: user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`,
        type: mediaType,
        mediaUrl,
        caption: caption.trim(),
        location: location.trim(),
        likes: [],
        comments: [],
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'posts'), newPostDoc);

      onPostCreated({ id: docRef.id, ...newPostDoc });
      onClose();
    } catch (err) {
      console.error('Failed to create post in Firestore:', err);
      setError(err.message || 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#0E131F] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 p-2 text-slate-400 hover:text-slate-100 rounded-full bg-black/40 backdrop-blur-md"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Media Preview Column */}
        <div className="w-full md:w-1/2 bg-slate-950 flex flex-col items-center justify-center min-h-[300px] p-4 relative group">
          {mediaUrl ? (
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-2xl">
              {mediaType === 'video' ? (
                <video src={mediaUrl} controls className="w-full h-full object-cover" />
              ) : (
                <img src={mediaUrl} alt="Preview" className="w-full h-full object-cover" />
              )}
              
              <button
                onClick={() => setMediaUrl('')}
                className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-red-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="text-center p-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 mx-auto">
                <Upload className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-200">Upload Image or Video</p>
                <p className="text-xs text-slate-400 mt-1">Select any photo or video file</p>
              </div>

              <label className="inline-flex items-center gap-2 px-5 py-3 bg-vibe-gradient text-white font-semibold text-xs rounded-xl shadow-lg cursor-pointer hover:opacity-95 transition-opacity">
                <span>Select File</span>
                <input type="file" accept="image/*,video/*" onChange={handleFileSelect} className="hidden" />
              </label>
            </div>
          )}
        </div>

        {/* Details Column */}
        <div className="w-full md:w-1/2 p-6 flex flex-col justify-between overflow-y-auto">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              Create Firebase Post
            </h2>
            <p className="text-xs text-slate-400 mb-4">Publish your moments directly to Cloud Firestore</p>

            {error && (
              <div className="mb-3 p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Caption
                </label>
                <textarea
                  rows={4}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Write a caption..."
                  className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Location Tag
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. San Francisco, CA"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !mediaUrl}
                className="w-full mt-2 py-3 bg-vibe-gradient text-white font-semibold text-sm rounded-xl shadow-lg shadow-purple-500/25 hover:opacity-95 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    <span>Publish Post</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
