import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { resolvePublicEntry } from './components/prelaunch/publicPaths'
import './index.css'

const publicEntry = resolvePublicEntry(window.location);
if (publicEntry) window.history.replaceState(window.history.state, "", publicEntry);

createRoot(document.getElementById("root")!).render(<App />);
