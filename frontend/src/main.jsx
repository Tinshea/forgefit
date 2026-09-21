import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// ┌─ INSTALLATION DE LA COQUILLE HORS LIGNE ──────────────────────────┐
// │ Enregistré après le chargement, jamais avant : le service worker │
// │ n'est utile qu'aux visites SUIVANTES, et le mettre en place       │
// │ pendant le premier rendu lui disputerait la bande passante.       │
// │                                                                    │
// │ En développement, on ne l'enregistre pas : il servirait des        │
// │ modules en cache et masquerait les modifications en cours.        │
// └────────────────────────────────────────────────────────────────────┘
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Sans lui, l'application fonctionne : elle exige simplement le
      // réseau. Ce n'est pas une erreur à remonter à l'utilisateur.
    });
  });
}
