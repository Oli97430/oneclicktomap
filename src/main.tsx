import { createRoot } from 'react-dom/client';
import App from './App';
import { OutputView } from './ui/components/OutputView';
import './ui/styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Élément racine #root introuvable');

// Routage par fenêtre : ?mode=output => vue projecteur, sinon éditeur.
// Même bundle pour les deux fenêtres (chargé via une query par le main).
const mode = new URLSearchParams(window.location.search).get('mode');
if (mode === 'output') document.body.classList.add('output-mode');

// Pas de StrictMode en Phase 1 : le double-montage des effects en dev
// recréerait le contexte WebGL. À réévaluer une fois le cycle de vie du
// moteur durci.
createRoot(container).render(mode === 'output' ? <OutputView /> : <App />);
