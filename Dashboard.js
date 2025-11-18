// Dashboard.js - Key Corrected Functions

// FIX: Explicitly connect to the backend server's port 3001
const SOCKET_SERVER_URL = 'http://localhost:3001';
const socket = io(SOCKET_SERVER_URL);

// ... (inside the Dashboard component)

  // FIX: Added Post Submission Logic
  const handlePostSubmit = async (e) => {
    e.preventDefault();
    if (!newPost.trim()) return;

    try {
      // Token is included automatically via axios.defaults.headers.common set in App.js
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
    const senderUsername = user.username; // Get username from user prop
    
    // 1. Locally update the state immediately for smooth UI
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

// ... (rest of the component)
