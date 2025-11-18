npm install express cors socket.io bcryptjs jsonwebtoken sqlite3
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'frontend/build')));

// Initialize SQLite database
const db = new sqlite3.Database('./creachives.db', (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('SQLite database connected');
    initializeDatabase();
  }
});

// Create tables
function initializeDatabase() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'member'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER,
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(author_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER,
      receiver_id INTEGER,
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(sender_id) REFERENCES users(id),
      FOREIGN KEY(receiver_id) REFERENCES users(id)
    )`);
  });
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password, role } = req.body;
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, role || 'member'],
      function(err) {
        if (err) {
          return res.status(400).json({ error: 'Email already exists' });
        }
        
        const token = jwt.sign({ id: this.lastID, email, role: role || 'member' }, JWT_SECRET);
        res.json({ 
          token, 
          user: { id: this.lastID, username, email, role: role || 'member' } 
        });
      }
    );
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password, role } = req.body;
  
  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err || !user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    if (role && user.role !== role) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET);
    res.json({ 
      token, 
      user: { id: user.id, username: user.username, email: user.email, role: user.role } 
    });
  });
});

// Posts Routes
app.get('/api/posts', (req, res) => {
  db.all(
    `SELECT posts.*, users.username 
     FROM posts 
     JOIN users ON posts.author_id = users.id 
     ORDER BY created_at DESC`,
    [],
    (err, posts) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      res.json(posts);
    }
  );
});

app.post('/api/posts', (req, res) => {
  const { author_id, content } = req.body;
  
  db.run(
    'INSERT INTO posts (author_id, content) VALUES (?, ?)',
    [author_id, content],
    function(err) {
      if (err) return res.status(500).json({ error: 'Server error' });
      
      db.get(
        `SELECT posts.*, users.username 
         FROM posts 
         JOIN users ON posts.author_id = users.id 
         WHERE posts.id = ?`,
        [this.lastID],
        (err, post) => {
          if (err) return res.status(500).json({ error: 'Server error' });
          io.emit('newPost', post);
          res.json(post);
        }
      );
    }
  );
});

// Messages Routes
app.get('/api/messages/:userId', (req, res) => {
  const { userId } = req.params;
  
  db.all(
    `SELECT messages.*, 
            sender.username as sender_name,
            receiver.username as receiver_name
     FROM messages
     JOIN users sender ON messages.sender_id = sender.id
     JOIN users receiver ON messages.receiver_id = receiver.id
     WHERE sender_id = ? OR receiver_id = ?
     ORDER BY created_at ASC`,
    [userId, userId],
    (err, messages) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      res.json(messages);
    }
  );
});

// Socket.io for real-time messaging
io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('sendMessage', ({ senderId, receiverId, content }) => {
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
          created_at: new Date().toISOString()
        };
        
        io.to(receiverId.toString()).emit('receiveMessage', message);
        socket.emit('receiveMessage', message);
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
  res.sendFile(path.join(__dirname, 'frontend/build', 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, 'localhost', () => console.log(`Server running on port ${PORT}`));
