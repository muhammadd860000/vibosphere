import React, { useState, useEffect } from 'react';
import { 
  Grid, 
  Heart, 
  Edit3, 
  UserPlus, 
  UserCheck, 
  MessageSquare, 
  X
} from 'lucide-react';
import { db, collection, getDocs, doc, getDoc, updateDoc, arrayUnion, arrayRemove, query, where } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import PostCard from '../Feed/PostCard';

export default function ProfileView({ username, onOpenChat, openAuthModal, openEditProfile }) {
  const { user: currentUser } = useAuth();
  const targetUsername = username || currentUser?.username;

  const [profileUser, setProfileUser] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [selectedPost, setSelectedPost] = useState(null);

  useEffect(() => {
    if (targetUsername) {
      fetchProfileData();
    }
  }, [targetUsername, currentUser]);

  const fetchProfileData = async () => {
    setLoading(true);
    try {
      // Query users collection by username
      const q = query(collection(db, 'users'), where('username', '==', targetUsername.toLowerCase().trim()));
      const snap = await getDocs(q);

      if (snap.empty) {
        // Fallback: try checking if current logged in user
        if (currentUser && currentUser.username === targetUsername) {
          setProfileUser(currentUser);
          setFollowerCount(currentUser.followers?.length || 0);
          fetchPostsForUser(currentUser.uid || currentUser.id);
        } else {
          setProfileUser(null);
        }
        setLoading(false);
        return;
      }

      const userDoc = snap.docs[0];
      const uData = { id: userDoc.id, uid: userDoc.id, ...userDoc.data() };
      setProfileUser(uData);

      const fCount = uData.followers?.length || 0;
      setFollowerCount(fCount);

      const currentId = currentUser?.uid || currentUser?.id;
      setIsFollowing(!!(currentId && uData.followers?.includes(currentId)));

      await fetchPostsForUser(uData.uid || uData.id);
    } catch (err) {
      console.error('Failed to load Firestore profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPostsForUser = async (targetUid) => {
    try {
      const q = query(collection(db, 'posts'));
      const postsSnap = await getDocs(q);
      const postsList = [];
      postsSnap.forEach(docSnap => {
        const pData = docSnap.data();
        if (pData.userId === targetUid || pData.username === targetUsername) {
          postsList.push({ id: docSnap.id, ...pData });
        }
      });
      setUserPosts(postsList);
    } catch (err) {
      console.error('Error fetching user posts from Firestore:', err);
    }
  };

  const handleFollowToggle = async () => {
    if (!currentUser) {
      openAuthModal('login');
      return;
    }

    const currentId = currentUser.uid || currentUser.id;
    const targetId = profileUser.uid || profileUser.id;

    const nextFollowing = !isFollowing;
    setIsFollowing(nextFollowing);
    setFollowerCount(prev => (nextFollowing ? prev + 1 : prev - 1));

    try {
      const targetRef = doc(db, 'users', targetId);
      const currentRef = doc(db, 'users', currentId);

      if (nextFollowing) {
        await updateDoc(targetRef, { followers: arrayUnion(currentId) });
        await updateDoc(currentRef, { following: arrayUnion(targetId) });
      } else {
        await updateDoc(targetRef, { followers: arrayRemove(currentId) });
        await updateDoc(currentRef, { following: arrayRemove(targetId) });
      }
    } catch (err) {
      console.error('Firestore follow toggle error:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="text-center py-20">
        <p className="text-lg font-bold text-slate-700 dark:text-slate-300">Profile Not Found</p>
        <p className="text-xs text-slate-400 mt-1">No user registered with @{targetUsername}</p>
      </div>
    );
  }

  const isOwnProfile = (currentUser?.uid || currentUser?.id) === (profileUser.uid || profileUser.id);

  return (
    <div className="max-w-4xl mx-auto pb-24">
      {/* Banner */}
      <div className="h-44 md:h-56 w-full relative overflow-hidden rounded-b-3xl bg-slate-800">
        <img
          src={profileUser.banner || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80'}
          alt="Profile Banner"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
      </div>

      {/* Profile Header Info */}
      <div className="px-4 md:px-8 relative -mt-16 md:-mt-20">
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 mb-6">
          <div className="relative">
            <img
              src={profileUser.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profileUser.username}`}
              alt={profileUser.username}
              className="w-28 h-28 md:w-36 md:h-36 rounded-full object-cover ring-4 ring-white dark:ring-[#0E131F] shadow-2xl"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {isOwnProfile ? (
              <button
                onClick={openEditProfile}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold text-sm rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit Profile</span>
              </button>
            ) : (
              <>
                <button
                  onClick={handleFollowToggle}
                  className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                    isFollowing
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10'
                      : 'bg-vibe-gradient text-white shadow-lg shadow-purple-500/25 hover:opacity-95'
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

                <button
                  onClick={() => onOpenChat(profileUser)}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold text-sm rounded-xl hover:bg-purple-500/20 transition-colors border border-purple-500/20"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Message</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="space-y-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {profileUser.name || profileUser.username}
            </h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              @{profileUser.username}
            </p>
          </div>

          {profileUser.bio && (
            <p className="text-sm text-slate-800 dark:text-slate-200 max-w-2xl leading-relaxed">
              {profileUser.bio}
            </p>
          )}

          {/* Stats Bar */}
          <div className="flex items-center gap-6 pt-2 border-t border-slate-200 dark:border-slate-800/80">
            <div>
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100 mr-1.5">
                {userPosts.length}
              </span>
              <span className="text-xs text-slate-400 font-medium">Posts</span>
            </div>
            <div>
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100 mr-1.5">
                {followerCount}
              </span>
              <span className="text-xs text-slate-400 font-medium">Followers</span>
            </div>
            <div>
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100 mr-1.5">
                {profileUser.following?.length || 0}
              </span>
              <span className="text-xs text-slate-400 font-medium">Following</span>
            </div>
          </div>
        </div>

        {/* Post Grid Navigation Tabs */}
        <div className="flex items-center justify-center gap-8 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('posts')}
            className={`flex items-center gap-2 py-3 border-b-2 text-xs font-bold uppercase tracking-wider transition-colors ${
              activeTab === 'posts'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <Grid className="w-4 h-4" />
            <span>Posts ({userPosts.length})</span>
          </button>
        </div>

        {/* Media Grid */}
        <div className="mt-4 grid grid-cols-3 gap-1.5 md:gap-3">
          {userPosts.map((post) => (
            <div
              key={post.id}
              onClick={() => setSelectedPost(post)}
              className="relative aspect-square bg-slate-900 rounded-xl overflow-hidden cursor-pointer group"
            >
              {post.type === 'video' ? (
                <video src={post.mediaUrl} className="w-full h-full object-cover" />
              ) : (
                <img src={post.mediaUrl} alt="Post" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              )}

              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-4 text-white font-bold transition-opacity">
                <div className="flex items-center gap-1">
                  <Heart className="w-5 h-5 fill-white" />
                  <span>{post.likes?.length || 0}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MessageSquare className="w-5 h-5 fill-white" />
                  <span>{post.comments?.length || 0}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Post View Modal */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedPost(null)}
              className="absolute top-2 right-2 z-10 p-2 text-white bg-black/60 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
            <PostCard post={selectedPost} onUserClick={() => setSelectedPost(null)} openAuthModal={openAuthModal} />
          </div>
        </div>
      )}
    </div>
  );
}
