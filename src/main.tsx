// Safely intercept and suppress benign Firestore SDK log errors for idle socket closures.
// These are standard, harmless warnings during periods of inactivity that Firestore handles by automatic reconnection.
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  const argString = args.map(arg => {
    try {
      if (arg instanceof Error) {
        return `${arg.name}: ${arg.message}\n${arg.stack}`;
      }
      if (arg && typeof arg === 'object') {
        const msg = arg.message || arg.description || '';
        const code = arg.code || '';
        return `${msg} ${code} ${JSON.stringify(arg)}`;
      }
      return String(arg);
    } catch {
      return '';
    }
  }).join(' ');

  if (
    argString.includes('Disconnecting idle stream') ||
    argString.includes('Timed out waiting for new targets') ||
    argString.includes("GrpcConnection RPC 'Listen'") ||
    argString.includes('CANCELLED:')
  ) {
    // Treat as warning since the Firebase SDK handles reconnection seamlessly
    console.warn('[Firebase Stream] Note: Idle stream disconnected (handled gracefully by SDK auto-reconnection).');
    return;
  }
  originalConsoleError(...args);
};

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register standard Service Worker to enable PWA installability & iOS popup alerts
if ('serviceWorker' in navigator && !window.location.host.includes('stackblitz')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => {
        console.log('[PWA] Service Worker registered successfully with scope:', reg.scope);
      })
      .catch(err => {
        console.error('[PWA] Service Worker registration failed:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
