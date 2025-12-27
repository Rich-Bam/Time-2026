import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initServiceWorkerCleanup } from './utils/serviceWorkerCleanup'

// Cleanup old service workers and caches on startup (production only)
initServiceWorkerCleanup();

createRoot(document.getElementById("root")!).render(<App />);
