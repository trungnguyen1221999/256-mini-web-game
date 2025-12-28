import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Register Service Worker for offline functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      
      console.log('SW registered successfully:', registration.scope);
      
      // Update available
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('New SW available, refreshing page...');
            window.location.reload();
          }
        });
      });
      
    } catch (error) {
      console.log('SW registration failed:', error);
    }
  });
}

createRoot(document.getElementById('root')).render(
    <App />
  )