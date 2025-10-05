import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

const socket = io();

export default function Dashboard({ user, onLogout }) {
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);

  const loadPosts = useCallback(async () => {
    try {
      const res = await axios.get('/api/posts');
      setPosts(res.data);
    } catch (err) {
      console.error('Error loading posts:', err);
    }
  }, []);

  const loadMessages = useCallback(async () => {
    try {
      const res = await axios.get(`/api/messages/${user.id}`);
      setMessages(res.data);
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  }, [user.id]);

  useEffect(() => {
    loadPosts();
    loadMessages();
    
    socket.emit('join', user.id);
    
    socket.on('newPost', (post) => {
      setPosts(prev => [post, ...prev]);
    });

    socket.on('receiveMessage', (message) => {
      setMessages(prev => [...prev, message]);
    });

    return () => {
      socket.off('newPost');
      socket.off('receiveMessage');
    };
  }, [user.id, loadPosts, loadMessages]);

  const handlePostSubmit = async (e) => {
    e.preventDefault();
    if (!newPost.trim()) return;

    try {
      await axios.post('/api/posts', {
        author_id: user.id,
        content: newPost
      });
      setNewPost('');
    } catch (err) {
      alert('Failed to create post');
    }
  };

  const handleMessageSubmit = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser) return;

    socket.emit('sendMessage', {
      senderId: user.id,
      receiverId: selectedUser,
      content: newMessage
    });
    setNewMessage('');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-md p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Creachives</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-700">Welcome, {user.username} ({user.role})</span>
            <button 
              onClick={onLogout}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Create Post</h2>
            <form onSubmit={handlePostSubmit}>
              <textarea
                value={newPost}
                onChange={e => setNewPost(e.target.value)}
                placeholder="What's on your mind?"
                className="w-full p-3 border rounded mb-3"
                rows="3"
              />
              <button 
                type="submit"
                className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
              >
                Post
              </button>
            </form>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Posts</h2>
            <div className="space-y-4">
              {posts.map(post => (
                <div key={post.id} className="border-b pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">{post.username}</span>
                    <span className="text-sm text-gray-500">
                      {new Date(post.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-gray-700">{post.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Messages</h2>
          <div className="mb-4">
            <label className="block mb-2">Send message to (User ID):</label>
            <input
              type="number"
              value={selectedUser || ''}
              onChange={e => setSelectedUser(Number(e.target.value))}
              placeholder="Enter user ID"
              className="w-full p-2 border rounded"
            />
          </div>
          
          <div className="border rounded p-4 mb-4 h-64 overflow-y-auto bg-gray-50">
            {messages.length === 0 ? (
              <p className="text-gray-400 text-center">No messages yet</p>
            ) : (
              messages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`mb-3 p-3 rounded-lg ${
                    msg.sender_id === user.id ? 'bg-blue-500 text-white ml-auto' : 'bg-white'
                  } max-w-xs shadow-sm`}
                >
                  <p className={`text-xs font-semibold mb-1 ${
                    msg.sender_id === user.id ? 'text-blue-100' : 'text-gray-600'
                  }`}>
                    {msg.sender_id === user.id ? 'You' : msg.sender_name || `User ${msg.sender_id}`}
                    {msg.sender_id !== user.id && ` → ${msg.receiver_name || `User ${msg.receiver_id}`}`}
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
      </div>
    </div>
  );
}
