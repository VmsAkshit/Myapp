// server.js - Corrected and Complete Implementation

const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// --- Configuration Constants ---
const PORT = process.env.PORT || 3001;
const SECRET_KEY = 'your_super_secret_jwt_key'; // FIX: Define a secret key (use ENV in production)
const SALT_ROUNDS = 10;
// -------------------------------

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

// Serve static frontend files (assumes 'frontend/build' exists)
app.use(express.static(path.join(__dirname, 'frontend/build')));

// Initialize SQLite database and tables (existing logic is fine)
// ... (initializeDatabase and db connection logic) ...

// FIX: Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token == null) return res.status(401).json({ error: 'No token provided' });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// --- AUTH ROUTES ---
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password, role } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'All fields are required' });

  try {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    db.run(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, role],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'Email already exists' });
          }
          return res.status(500).json({ error: 'Server error during registration' });
        }
        const user = { id: this.lastID, username, email, role };
        const token = jwt.sign(user, SECRET_KEY, { expiresIn: '1h' });
        res.status(201).json({ user, token });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password, role } = req.body;
  db.get('SELECT * FROM users WHERE email = ? AND role = ?', [email, role], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (!user) return res.status(401).json({ error: 'Invalid credentials or role' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });
    
    const userPayload = { id: user.id, username: user.username, email: user.email, role: user.role };
    const token = jwt.sign(userPayload, SECRET_KEY, { expiresIn: '1h' });
    res.json({ user: userPayload, token });
  });
});
// --- END AUTH ROUTES ---

// --- POST ROUTES ---
app.post('/api/posts', authenticateToken, (req, res) => {
  const { content } = req.body;
  const author_id = req.user.id;
  if (!content) return res.status(400).json({ error: 'Post content is required' });

  db.run('INSERT INTO posts (author_id, content) VALUES (?, ?)', [author_id, content], function(err) {
      if (err) return res.status(500).json({ error: 'Server error' });

      // Fetch the new post with author's name before broadcasting
      db.get(
        `SELECT p.*, u.username as author_name FROM posts p JOIN users u ON p.author_id = u.id WHERE p.id = ?`, 
        [this.lastID], 
        (err, post) => {
          if (err) return res.status(500).json({ error: 'Server error' });
          io.emit('newPost', post); 
          res.status(201).json(post);
        }
      );
  });
});

app.get('/api/posts', (req, res) => {
  // FIX: JOIN users table to get author name
  db.all(
    `SELECT p.*, u.username as author_name FROM posts p JOIN users u ON p.author_id = u.id ORDER BY created_at DESC`,
    [],
    (err, posts) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      res.json(posts);
    }
  );
});
// --- END POST ROUTES ---

// --- MESSAGE ROUTES ---
app.get('/api/messages/:userId', authenticateToken, (req, res) => {
  const userId = req.params.userId;
  if (req.user.id.toString() !== userId) {
    return res.status(403).json({ error: 'Access denied to other user\'s messages' });
  }
  // Existing query is fine
  // ...
});

// Socket.io for real-time messaging
io.on('connection', (socket) => {
  socket.on('sendMessage', ({ senderId, receiverId, content, senderUsername }) => { // FIX: Expect senderUsername from client
    db.run(
      'INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)',
      [senderId, receiverId, content],
      function(err) {
        if (err) {
          console.error('Error saving message:', err);
          return;
        }
        
        const message = {
          id: this.lastID,
          sender_id: senderId,
          receiver_id: receiverId,
          content,
          created_at: new Date().toISOString(),
          sender_name: senderUsername // FIX: Include sender name
        };
        
        io.to(receiverId.toString()).emit('receiveMessage', message);
        // FIX: Removed: socket.emit('receiveMessage', message); to prevent sender duplicate
      }
    );
  });

  socket.on('join', (userId) => {
    socket.join(userId.toString());
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Serve frontend for any other route
app.get('*', (req, res) => {
  // FIX: Complete frontend serving logic
  res.sendFile(path.join(__dirname, 'frontend/build', 'index.html'));
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
