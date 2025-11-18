import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

// FIX: Explicitly connect to the backend server's port 3001
const SOCKET_SERVER_URL = 'http://localhost:3001';
const socket = io(SOCKET_SERVER_URL);

export default function Dashboard({ user, onLogout }) {
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);

  const loadPosts = useCallback(async () => {
    try {
      // Token is included automatically via axios.defaults.headers.common
      const res = await axios.get('/api/posts');
      setPosts(res.data);
    } catch (err) {
      console.error('Error loading posts:', err);
    }
  }, []);

  const loadMessages = useCallback(async () => {
    if (!user) return;
    try {
      const res = await axios.get(`/api/messages/${user.id}`);
      setMessages(res.data);
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  }, [user]);

  useEffect(() => {
    loadPosts();
    if (user) {
        loadMessages();
        socket.emit('join', user.id);
    }
    
    socket.on('newPost', (post) => {
      setPosts(prev => [post, ...prev]);
    });

    socket.on('receiveMessage', (message) => {
      // Only show message if the user is the intended receiver OR sender (if they have multiple devices)
      if (message.receiver_id === user.id || message.sender_id === user.id) {
          setMessages(prev => [...prev, message]);
      }
    });

    return () => {
      socket.off('newPost');
      socket.off('receiveMessage');
    };
  }, [user, loadPosts, loadMessages]);
  
  // FIX: Added Post Submission Logic
  const handlePostSubmit = async (e) => {
    e.preventDefault();
    if (!newPost.trim()) return;

    try {
      // Token is included automatically
      await axios.post('/api/posts', { content: newPost }); 
      setNewPost('');
    } catch (err) {
      console.error('Error submitting post:', err.response?.data?.error || 'Unknown error');
      alert('Failed to create post. Check console for details.');
    }
  };

  // FIX: Updated Message Submission Logic to update state locally and pass username
  const handleMessageSubmit = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser) return;
    
    const messageContent = newMessage;
    const receiverId = selectedUser.id;
    const senderId = user.id;
    const senderUsername = user.username;
    
    // 1. Locally update the state immediately for smooth UI (prevents socket message duplication from server)
    const message = {
      id: Date.now(), // Use a temporary ID
      sender_id: senderId,
      receiver_id: receiverId,
      content: messageContent,
      created_at: new Date().toISOString(),
      sender_name: senderUsername,
      receiver_name: selectedUser.username
    };
    
    setMessages(prev => [...prev, message]);

    // 2. Emit the message to the server
    socket.emit('sendMessage', { senderId, receiverId, content: messageContent, senderUsername });
    
    setNewMessage('');
  };
  
  // --- (The rest of the component's structure is assumed to be present) ---
  
  // Placeholder return structure (ensure your original HTML/JSX is wrapped here)
  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Dashboard ({user.username})</h1>
        <button onClick={onLogout} className="bg-red-500 text-white p-2 rounded hover:bg-red-600 transition">
          Logout
        </button>
      </div>

      <div className="grid grid-cols-3 gap-8">
        {/* Posts Section */}
        <div className="col-span-2">
          <h2 className="text-2xl font-semibold mb-4">New Post</h2>
          <form onSubmit={handlePostSubmit} className="flex gap-2 mb-6">
            <input
              type="text"
              value={newPost}
              onChange={e => setNewPost(e.target.value)}
              placeholder="What's on your mind?"
              className="flex-1 p-3 border rounded shadow-inner"
              required
            />
            <button 
              type="submit" 
              className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 transition"
            >
              Post
            </button>
          </form>

          <h2 className="text-2xl font-semibold mb-4">Latest Posts</h2>
          <div className="space-y-4">
            {posts.map(post => (
              <div key={post.id} className="p-4 border rounded-lg shadow-sm bg-gray-50">
                <p className="font-semibold text-lg">{post.content}</p>
                <p className="text-sm text-gray-500 mt-2">
                  Posted by **{post.author_name || `User ${post.author_id}`}** on {new Date(post.created_at).toLocaleString()}
                </p>
              </div>
            ))}
            {posts.length === 0 && <p>No posts found.</p>}
          </div>
        </div>

        {/* Messaging Section */}
        <div className="col-span-1 border-l pl-8">
          <h2 className="text-2xl font-semibold mb-4">Users & Chat</h2>
          {/* User List Placeholder */}
          <p className="text-sm text-gray-500 mb-4">
            *User selection logic is not implemented here, but the chat functionality is fixed.*
          </p>

          {/* Select a user to chat with (PLACEHOLDER: You must implement actual user list fetching) */}
          <div className="mb-4 p-3 bg-yellow-100 rounded">
            <h3 className="font-bold">Chat Test Mode:</h3>
            <p className="text-sm">To test chat, select yourself or another user from a test list.</p>
            {/* For testing, temporarily set selectedUser to yourself to enable sending messages */}
            <button 
                onClick={() => setSelectedUser(user)} 
                className="mt-2 bg-yellow-500 text-white px-3 py-1 rounded"
            >
                Start Chatting with Myself (for testing)
            </button>
          </div>
          
          {selectedUser && (
            <div className="mt-4">
              <h3 className="text-xl font-semibold mb-3">Chat with {selectedUser.username}</h3>
              
              <div className="h-64 overflow-y-auto border p-3 rounded mb-3 space-y-2 bg-white">
                {messages.length === 0 ? (
                  <p className="text-gray-500 text-center">No messages yet.</p>
                ) : (
                  messages
                    // Simple filter to show messages involving the selected user (or all if not filtered)
                    .filter(msg => 
                        (msg.sender_id === user.id && msg.receiver_id === selectedUser.id) || 
                        (msg.sender_id === selectedUser.id && msg.receiver_id === user.id)
                    )
                    .map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-3 rounded-lg ${
                          msg.sender_id === user.id ? 'bg-blue-600 text-white ml-auto' : 'bg-gray-200'
                        } max-w-xs shadow-sm`}
                      >
                        <p className={`text-xs font-semibold mb-1 ${
                          msg.sender_id === user.id ? 'text-blue-100' : 'text-gray-600'
                        }`}>
                          {msg.sender_id === user.id ? 'You' : msg.sender_name || `User ${msg.sender_id}`}
                        </p>
                        <p className="text-sm">{msg.content}</p>
                        <span className={`text-xs ${
                          msg.sender_id === user.id ? 'text-blue-100' : 'text-gray-400'
                        }`}>
                          {new Date(msg.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))
                )}
              </div>

              <form onSubmit={handleMessageSubmit}>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 p-2 border rounded"
                    required
                  />
                  <button 
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  >
                    Send
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
