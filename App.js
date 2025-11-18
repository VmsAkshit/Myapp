// App.js - Corrected and Complete Implementation

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import Register from './Register';
import Dashboard from './Dashboard';
import axios from 'axios';

// FIX: Set default base URL for all axios API calls
axios.defaults.baseURL = 'http://localhost:3001'; 

function App() {
  const [user, setUser] = useState(null);

  // Load user/token from localStorage on initial load
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (storedUser && token) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      } catch (e) {
        console.error('Error loading stored user data:', e);
        localStorage.clear();
      }
    }
  }, []);

  const handleSetUser = (userData) => {
    setUser(userData);
    const token = localStorage.getItem('token');
    if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.clear();
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <Router>
      <Routes>
        {/* Redirects logged-in users to Dashboard, otherwise show forms */}
        <Route path="/register" element={
          user ? <Navigate to="/dashboard" /> : <Register setUser={handleSetUser} />
        } />
        <Route path="/login" element={
          user ? <Navigate to="/dashboard" /> : <Login setUser={handleSetUser} />
        } />
        {/* Protected Dashboard Route */}
        <Route path="/dashboard" element={
          user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
        } />
        {/* Default Route */}
        <Route path="/" element={
          user ? <Navigate to="/dashboard" /> : <Navigate to="/login" />
        } />
      </Routes>
    </Router>
  );
}

export default App;
