import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// This is the file that bridges React with the HTML document.
// It finds the <div id="root"> element and injects the App component into it.

try {
    const container = document.getElementById('root');
    if (!container) {
        console.error("Error: Could not find element with ID 'root'. Please ensure index.html contains <div id=\"root\"></div>");
    } else {
        const root = ReactDOM.createRoot(container);
        root.render(
            <React.StrictMode>
                <App />
            </React.StrictMode>
        );
        console.log("React application successfully mounted to the 'root' element.");
    }
} catch (error) {
    console.error("A critical error occurred during React initialization:", error);
}
