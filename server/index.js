import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { db } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = 'vibesphere_super_secret_jwt_key_2026';
const PORT = process.env.PORT || 5000;

const app = express();
const server = http.createServer(app);

// Enable CORS for frontend Vite app
app.use(cors({
  origin: '*',
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Set up static uploads folder
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

// Configure Multer for media uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || (file.mimetype.includes('video') ? '.mp4' : '.jpg');
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Authentication token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// ==========================================
// 1. AUTHENTICATION ROUTES
// ==========================================

// Sign Up
app.post('/api/auth/signup', (req, res) => {
  const { username, name, email, password, bio, avatar } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }

  const existingUsername = db.getUserByUsername(username);
  if (existingUsername) {
    return res.status(400).json({ error: 'Username is already taken' });
  }

  const existingEmail = db.getUserByEmail(email);
  if (existingEmail) {
    return res.status(400).json({ error: 'Email is already registered' });
  }

  const newUser = db.createUser({
    username,
    name: name || username,
    email,
    password,
    bio: bio || '',
    avatar: avatar || ''
  });

  const token = jwt.sign({ id: newUser.id, username: newUser.username }, JWT_SECRET, { expiresIn: '7d' });

  res.status(201).json({
    token,
    user: sanitizeUser(newUser)
  });
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { emailOrUsername, password } = req.body;

  if (!emailOrUsername || !password) {
    return res.status(400).json({ error: 'Please enter your username/email and password' });
  }

  const user = db.getUserByUsername(emailOrUsername) || db.getUserByEmail(emailOrUsername);

  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials. Please try again.' });
  }

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

  res.json({
    token,
    user: sanitizeUser(user)
  });
});

// Get Current Logged In User
app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = db.getUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(sanitizeUser(user));
});

// Update Profile
app.put('/api/auth/profile', authenticateToken, (req, res) => {
  const { name, bio, avatar, banner } = req.body;
  const updatedUser = db.updateUser(req.user.id, {
    ...(name !== undefined && { name }),
    ...(bio !== undefined && { bio }),
    ...(avatar !== undefined && { avatar }),
    ...(banner !== undefined && { banner })
  });

  res.json(sanitizeUser(updatedUser));
});

// Helper to remove password from user response
function sanitizeUser(user) {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return {
    ...safeUser,
    followerCount: safeUser.followers?.length || 0,
    followingCount: safeUser.following?.length || 0
  };
}

// ==========================================
// 2. USER & SOCIAL GRAPH ROUTES
// ==========================================

// All Users / Demo Users list for quick-login & discovery
app.get('/api/users/all', (req, res) => {
  const users = db.getUsers().map(sanitizeUser);
  res.json(users);
});

// Search Users
app.get('/api/users/search', (req, res) => {
  const { q } = req.query;
  const matches = db.searchUsers(q || '').map(sanitizeUser);
  res.json(matches);
});

// Get User Profile by Username or ID
app.get('/api/users/:identifier', (req, res) => {
  const { identifier } = req.params;
  const user = db.getUserByUsername(identifier) || db.getUserById(identifier);
  if (!user) return res.status(404).json({ error: 'User profile not found' });
  res.json(sanitizeUser(user));
});

// Toggle Follow / Unfollow
app.post('/api/users/:id/follow', authenticateToken, (req, res) => {
  const targetId = req.params.id;
  const followerId = req.user.id;

  if (targetId === followerId) {
    return res.status(400).json({ error: 'You cannot follow yourself' });
  }

  const result = db.toggleFollow(followerId, targetId);
  if (!result) return res.status(404).json({ error: 'User not found' });

  res.json(result);
});

// ==========================================
// 3. FEED & POSTS ROUTES
// ==========================================

// Get Posts Feed
app.get('/api/posts', (req, res) => {
  const posts = db.getPosts().map(post => {
    const author = db.getUserById(post.userId);
    return {
      ...post,
      author: sanitizeUser(author),
      likeCount: post.likes.length,
      commentCount: post.comments.length
    };
  });
  res.json(posts);
});

// Create Post
app.post('/api/posts', authenticateToken, (req, res) => {
  const { mediaUrl, type, caption, location } = req.body;

  if (!mediaUrl) {
    return res.status(400).json({ error: 'Media file or URL is required' });
  }

  const newPost = db.createPost({
    userId: req.user.id,
    type: type || 'image',
    mediaUrl,
    caption: caption || '',
    location: location || ''
  });

  const author = db.getUserById(req.user.id);
  res.status(201).json({
    ...newPost,
    author: sanitizeUser(author),
    likeCount: 0,
    commentCount: 0
  });
});

// Toggle Like Post
app.post('/api/posts/:id/like', authenticateToken, (req, res) => {
  const result = db.toggleLikePost(req.params.id, req.user.id);
  if (!result) return res.status(404).json({ error: 'Post not found' });
  res.json(result);
});

// Add Comment to Post
app.post('/api/posts/:id/comments', authenticateToken, (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Comment text cannot be empty' });

  const comment = db.addComment(req.params.id, req.user.id, text.trim());
  if (!comment) return res.status(404).json({ error: 'Post not found' });

  const commentAuthor = db.getUserById(req.user.id);
  res.status(201).json({
    ...comment,
    user: sanitizeUser(commentAuthor)
  });
});

// Get Post Comments
app.get('/api/posts/:id/comments', (req, res) => {
  const post = db.getPostById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const commentsWithAuthors = post.comments.map(c => ({
    ...c,
    user: sanitizeUser(db.getUserById(c.userId))
  }));

  res.json(commentsWithAuthors);
});

// ==========================================
// 4. MESSAGES & CHAT ROUTES
// ==========================================

// Get Recent Conversations
app.get('/api/messages/conversations', authenticateToken, (req, res) => {
  const conversations = db.getRecentConversations(req.user.id).map(c => ({
    user: sanitizeUser(c.user),
    lastMessage: c.lastMessage
  }));
  res.json(conversations);
});

// Get Messages with specific user
app.get('/api/messages/:partnerId', authenticateToken, (req, res) => {
  const messages = db.getMessages(req.user.id, req.params.partnerId);
  res.json(messages);
});

// Send Message REST API
app.post('/api/messages', authenticateToken, (req, res) => {
  const { receiverId, text, mediaUrl } = req.body;
  if (!receiverId || (!text && !mediaUrl)) {
    return res.status(400).json({ error: 'Receiver ID and message content are required' });
  }

  const newMsg = db.createMessage({
    senderId: req.user.id,
    receiverId,
    text: text || '',
    mediaUrl: mediaUrl || null
  });

  // Emit WebSocket message if socket connected
  io.to(`user_${receiverId}`).emit('receive_message', newMsg);

  res.status(201).json(newMsg);
});

// ==========================================
// 5. STORIES ROUTES
// ==========================================

app.get('/api/stories', (req, res) => {
  const stories = db.getStories().map(s => ({
    ...s,
    user: sanitizeUser(db.getUserById(s.userId))
  }));
  res.json(stories);
});

app.post('/api/stories', authenticateToken, (req, res) => {
  const { mediaUrl, type, caption } = req.body;
  if (!mediaUrl) return res.status(400).json({ error: 'Media URL required' });

  const story = db.createStory({
    userId: req.user.id,
    mediaUrl,
    type: type || 'image',
    caption: caption || ''
  });

  res.status(201).json({
    ...story,
    user: sanitizeUser(db.getUserById(req.user.id))
  });
});

// ==========================================
// 6. FILE UPLOAD ENDPOINT
// ==========================================
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  const isVideo = req.file.mimetype.startsWith('video/');
  res.json({
    url: fileUrl,
    type: isVideo ? 'video' : 'image'
  });
});

// ==========================================
// REAL-TIME WEBSOCKETS (SOCKET.IO)
// ==========================================
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const activeUsers = new Map(); // userId -> socketId

io.on('connection', (socket) => {
  console.log('⚡ User connected:', socket.id);

  socket.on('join_user', (userId) => {
    socket.join(`user_${userId}`);
    activeUsers.set(userId, socket.id);
    console.log(`User ${userId} joined room user_${userId}`);
    io.emit('online_users', Array.from(activeUsers.keys()));
  });

  socket.on('send_message', (data) => {
    const { senderId, receiverId, text, mediaUrl } = data;
    const newMsg = db.createMessage({ senderId, receiverId, text, mediaUrl });
    
    // Broadcast to receiver room
    io.to(`user_${receiverId}`).emit('receive_message', newMsg);
    // Send back to sender for confirmation/sync
    socket.emit('message_sent', newMsg);
  });

  socket.on('typing_start', ({ senderId, receiverId }) => {
    io.to(`user_${receiverId}`).emit('typing_status', { userId: senderId, isTyping: true });
  });

  socket.on('typing_stop', ({ senderId, receiverId }) => {
    io.to(`user_${receiverId}`).emit('typing_status', { userId: senderId, isTyping: false });
  });

  socket.on('disconnect', () => {
    for (let [userId, socketId] of activeUsers.entries()) {
      if (socketId === socket.id) {
        activeUsers.delete(userId);
        break;
      }
    }
    io.emit('online_users', Array.from(activeUsers.keys()));
    console.log('❌ User disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 VibeSphere Backend running on http://localhost:${PORT}`);
});
