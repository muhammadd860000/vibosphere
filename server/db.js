import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'data.json');

// Default initial database seed
const initialData = {
  users: [
    {
      id: 'u1',
      username: 'alex_vibe',
      name: 'Alex Rivers',
      email: 'alex@vibesphere.com',
      password: 'password123',
      bio: '📸 Visual Storyteller & Tech Enthusiast | Exploring Japan 🇯🇵 | Founder @VibeLab',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
      banner: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80',
      followers: ['u2', 'u3', 'u4'],
      following: ['u2', 'u3'],
      verified: true,
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString()
    },
    {
      id: 'u2',
      username: 'sarah_art',
      name: 'Sarah Chen',
      email: 'sarah@vibesphere.com',
      password: 'password123',
      bio: '🎨 Digital Artist & UI/UX Designer | Creating colorful worlds ✨ | Open for commissions',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80',
      banner: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=1200&auto=format&fit=crop&q=80',
      followers: ['u1', 'u3'],
      following: ['u1', 'u4'],
      verified: true,
      createdAt: new Date(Date.now() - 25 * 86400000).toISOString()
    },
    {
      id: 'u3',
      username: 'cyber_sam',
      name: 'Sam Brooks',
      email: 'sam@vibesphere.com',
      password: 'password123',
      bio: '💻 Full-Stack Dev | Cyberpunk Aesthetics 🌆 | Coffee & Code ☕️',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
      banner: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200&auto=format&fit=crop&q=80',
      followers: ['u1', 'u2'],
      following: ['u1', 'u2', 'u4'],
      verified: false,
      createdAt: new Date(Date.now() - 20 * 86400000).toISOString()
    },
    {
      id: 'u4',
      username: 'elena_design',
      name: 'Elena Rostova',
      email: 'elena@vibesphere.com',
      password: 'password123',
      bio: '🌿 Minimalist Living & Architecture | Paris 🇫🇷 | Curating peaceful spaces',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80',
      banner: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&auto=format&fit=crop&q=80',
      followers: ['u2', 'u3'],
      following: ['u1'],
      verified: true,
      createdAt: new Date(Date.now() - 15 * 86400000).toISOString()
    }
  ],
  posts: [
    {
      id: 'p1',
      userId: 'u1',
      type: 'image',
      mediaUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=1000&auto=format&fit=crop&q=80',
      caption: 'Tokyo at night hitting differently 🌃✨ The neon reflections in Shibuya after rainy hours. Which city is your favorite night walk?',
      location: 'Shibuya Crossing, Tokyo',
      likes: ['u2', 'u3', 'u4'],
      comments: [
        {
          id: 'c1',
          userId: 'u2',
          text: 'Incredible mood and color grading! 🔥',
          createdAt: new Date(Date.now() - 3600000 * 4).toISOString()
        },
        {
          id: 'c2',
          userId: 'u3',
          text: 'Cyberpunk vibes for real 🤖⚡️',
          createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
        }
      ],
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
    },
    {
      id: 'p2',
      userId: 'u2',
      type: 'image',
      mediaUrl: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=1000&auto=format&fit=crop&q=80',
      caption: 'Fresh abstract fluid art piece finished today! 🎨 Liquid acrylics on 36x48 canvas. What emotion does this color palette bring out in you?',
      location: 'Studio 404, San Francisco',
      likes: ['u1', 'u3'],
      comments: [
        {
          id: 'c3',
          userId: 'u1',
          text: 'The gradient blend is hypnotic! Absolutely stunning work Sarah ❤️',
          createdAt: new Date(Date.now() - 3600000 * 8).toISOString()
        }
      ],
      createdAt: new Date(Date.now() - 3600000 * 12).toISOString()
    },
    {
      id: 'p3',
      userId: 'u3',
      type: 'video',
      mediaUrl: 'https://assets.mixkit.co/videos/preview/mixkit-code-animation-on-a-screen-41551-large.mp4',
      caption: 'Late night coding session building the future of social apps 🚀 VibeSphere is coming along nicely! Clean tech stack, fast UI.',
      location: 'Silicon Valley, CA',
      likes: ['u1', 'u2', 'u4'],
      comments: [
        {
          id: 'c4',
          userId: 'u4',
          text: 'Love the dark aesthetic! Keep pushing Sam 💻👏',
          createdAt: new Date(Date.now() - 3600000 * 15).toISOString()
        }
      ],
      createdAt: new Date(Date.now() - 3600000 * 18).toISOString()
    },
    {
      id: 'p4',
      userId: 'u4',
      type: 'image',
      mediaUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1000&auto=format&fit=crop&q=80',
      caption: 'Morning light filtered through minimalist oak blinds. Peace begins in simple architecture 🌿☀️',
      location: 'Le Marais, Paris',
      likes: ['u1', 'u2'],
      comments: [],
      createdAt: new Date(Date.now() - 3600000 * 24).toISOString()
    }
  ],
  stories: [
    {
      id: 's1',
      userId: 'u1',
      mediaUrl: 'https://images.unsplash.com/photo-1528164344705-47542687990d?w=600&auto=format&fit=crop&q=80',
      type: 'image',
      caption: 'Morning coffee in Kyoto ☕️',
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
    },
    {
      id: 's2',
      userId: 'u2',
      mediaUrl: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&auto=format&fit=crop&q=80',
      type: 'image',
      caption: 'Painting progress 🎨',
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
    },
    {
      id: 's3',
      userId: 'u3',
      mediaUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=80',
      type: 'image',
      caption: 'Cyberpunk setup complete 💻',
      createdAt: new Date(Date.now() - 3600000 * 8).toISOString()
    }
  ],
  messages: [
    {
      id: 'm1',
      senderId: 'u2',
      receiverId: 'u1',
      text: 'Hey Alex! Loved your night photos from Shibuya! 🌃',
      createdAt: new Date(Date.now() - 3600000 * 3).toISOString()
    },
    {
      id: 'm2',
      senderId: 'u1',
      receiverId: 'u2',
      text: 'Thanks Sarah! Tokyo was surreal. How is the new artwork coming along?',
      createdAt: new Date(Date.now() - 3600000 * 2.5).toISOString()
    },
    {
      id: 'm3',
      senderId: 'u2',
      receiverId: 'u1',
      text: 'Just finished it! Posted on my profile 🎨 Check it out when you get a chance!',
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
    },
    {
      id: 'm4',
      senderId: 'u3',
      receiverId: 'u1',
      text: 'Yo Alex, let us catch up on VibeSphere tech stack performance soon!',
      createdAt: new Date(Date.now() - 3600000 * 1).toISOString()
    }
  ]
};

class JSONDatabase {
  constructor() {
    this.ensureDataFile();
  }

  ensureDataFile() {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
    }
  }

  read() {
    try {
      this.ensureDataFile();
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(content);
    } catch (err) {
      console.error('Error reading database file, resetting to initial seed:', err);
      this.write(initialData);
      return initialData;
    }
  }

  write(data) {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error writing database file:', err);
    }
  }

  // User Operations
  getUsers() {
    return this.read().users;
  }

  getUserById(id) {
    return this.getUsers().find(u => u.id === id);
  }

  getUserByUsername(username) {
    return this.getUsers().find(u => u.username.toLowerCase() === username.toLowerCase());
  }

  getUserByEmail(email) {
    return this.getUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  createUser(userData) {
    const db = this.read();
    const newUser = {
      id: 'u_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      username: userData.username,
      name: userData.name || userData.username,
      email: userData.email,
      password: userData.password, // plain or hashed
      bio: userData.bio || '',
      avatar: userData.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData.username}`,
      banner: userData.banner || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80',
      followers: [],
      following: [],
      verified: false,
      createdAt: new Date().toISOString()
    };
    db.users.push(newUser);
    this.write(db);
    return newUser;
  }

  updateUser(id, updates) {
    const db = this.read();
    const idx = db.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      db.users[idx] = { ...db.users[idx], ...updates };
      this.write(db);
      return db.users[idx];
    }
    return null;
  }

  toggleFollow(followerId, targetId) {
    const db = this.read();
    const follower = db.users.find(u => u.id === followerId);
    const target = db.users.find(u => u.id === targetId);

    if (!follower || !target) return false;

    const isFollowing = follower.following.includes(targetId);

    if (isFollowing) {
      follower.following = follower.following.filter(id => id !== targetId);
      target.followers = target.followers.filter(id => id !== followerId);
    } else {
      follower.following.push(targetId);
      target.followers.push(followerId);
    }

    this.write(db);
    return {
      isFollowing: !isFollowing,
      followerCount: target.followers.length,
      followingCount: follower.following.length
    };
  }

  searchUsers(query) {
    if (!query) return [];
    const q = query.toLowerCase();
    return this.getUsers().filter(u => 
      u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)
    );
  }

  // Post Operations
  getPosts() {
    const db = this.read();
    return db.posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getPostById(id) {
    return this.getPosts().find(p => p.id === id);
  }

  createPost(postData) {
    const db = this.read();
    const newPost = {
      id: 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      userId: postData.userId,
      type: postData.type || 'image',
      mediaUrl: postData.mediaUrl,
      caption: postData.caption || '',
      location: postData.location || '',
      likes: [],
      comments: [],
      createdAt: new Date().toISOString()
    };
    db.posts.unshift(newPost);
    this.write(db);
    return newPost;
  }

  toggleLikePost(postId, userId) {
    const db = this.read();
    const post = db.posts.find(p => p.id === postId);
    if (!post) return null;

    const likedIndex = post.likes.indexOf(userId);
    let liked = false;
    if (likedIndex > -1) {
      post.likes.splice(likedIndex, 1);
    } else {
      post.likes.push(userId);
      liked = true;
    }

    this.write(db);
    return { liked, count: post.likes.length };
  }

  addComment(postId, userId, text) {
    const db = this.read();
    const post = db.posts.find(p => p.id === postId);
    if (!post) return null;

    const newComment = {
      id: 'c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      userId,
      text,
      createdAt: new Date().toISOString()
    };

    post.comments.push(newComment);
    this.write(db);
    return newComment;
  }

  // Message Operations
  getMessages(user1Id, user2Id) {
    const db = this.read();
    return db.messages
      .filter(m => (m.senderId === user1Id && m.receiverId === user2Id) || (m.senderId === user2Id && m.receiverId === user1Id))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }

  createMessage(msgData) {
    const db = this.read();
    const newMsg = {
      id: 'm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      senderId: msgData.senderId,
      receiverId: msgData.receiverId,
      text: msgData.text,
      mediaUrl: msgData.mediaUrl || null,
      createdAt: new Date().toISOString()
    };
    db.messages.push(newMsg);
    this.write(db);
    return newMsg;
  }

  getRecentConversations(userId) {
    const db = this.read();
    const userMsgs = db.messages.filter(m => m.senderId === userId || m.receiverId === userId);
    
    const partnerIds = new Set();
    userMsgs.forEach(m => {
      partnerIds.add(m.senderId === userId ? m.receiverId : m.senderId);
    });

    const conversations = Array.from(partnerIds).map(partnerId => {
      const partner = db.users.find(u => u.id === partnerId);
      const thread = userMsgs.filter(m => (m.senderId === userId && m.receiverId === partnerId) || (m.senderId === partnerId && m.receiverId === userId));
      const lastMsg = thread[thread.length - 1];
      return {
        user: partner,
        lastMessage: lastMsg
      };
    }).filter(c => c.user != null);

    return conversations.sort((a, b) => new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0));
  }

  // Story Operations
  getStories() {
    const db = this.read();
    return db.stories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  createStory(storyData) {
    const db = this.read();
    const newStory = {
      id: 's_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      userId: storyData.userId,
      mediaUrl: storyData.mediaUrl,
      type: storyData.type || 'image',
      caption: storyData.caption || '',
      createdAt: new Date().toISOString()
    };
    db.stories.unshift(newStory);
    this.write(db);
    return newStory;
  }
}

export const db = new JSONDatabase();
