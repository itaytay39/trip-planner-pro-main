import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // You can create this file for global styles if you want, or remove this line.
import App from './app'; // Changed to lowercase 'a' to match your file name

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);