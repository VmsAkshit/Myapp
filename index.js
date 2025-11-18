// index.js - Cleaned up
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// Import a global CSS file for Tailwind styles (you need to create this)
// import './index.css'; 

const rootElement = document.getElementById('root');

if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
} else {
    console.error("Error: Could not find element with ID 'root'.");
}
