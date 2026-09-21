// Service worker — coquille hors ligne.
//
// ┌─ CE QUI EST MIS EN CACHE, ET CE QUI NE L'EST JAMAIS ──────────────┐
// │ La COQUILLE (html, js, css, icône) est mise en cache : elle ne    │
// │ change qu'à chaque déploiement, et c'est ce qui permet d'ouvrir   │
// │ l'application dans une salle sans réseau.                         │
// │                                                                    │
// │ Les réponses de `/api` ne le sont JAMAIS. Un poids, une charge    │
// │ d'entraînement ou une cible nutritionnelle périmés seraient pires │
// │ qu'une erreur franche : on croirait lire ses données réelles.     │
// │ Hors ligne, l'application s'ouvre et dit que le serveur est       │
// │ injoignable — elle n'invente rien.                                │
// └────────────────────────────────────────────────────────────────────┘

// Le nom porte la version : changer de version purge tout l'ancien.
const CACHE = 'forgefit-shell-v2';
const SHELL = ['/', '/index.html', '/icon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // `addAll` échoue en bloc si une seule entrée manque : on tolère
      // les absences plutôt que de rater toute l'installation.
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting()),
  );
});

/**
 * Précharge les lots de route, une fois la page installée.
 *
 * ┌─ POURQUOI APRÈS L'ACTIVATION, ET PAS PENDANT L'INSTALLATION ──────┐
 * │ Pendant l'installation, ces requêtes disputent la bande passante  │
 * │ au premier rendu — on ralentirait la visite en cours pour         │
 * │ accélérer les suivantes.                                          │
 * │                                                                    │
 * │ Une fois la page active, le réseau est libre. Chaque écran        │
 * │ s'ouvre alors instantanément, y compris sans réseau du tout : la  │
 * │ différence est nette dans une salle de sport au sous-sol.         │
 * │                                                                    │
 * │ Les noms de lots portent une empreinte : on les lit dans le HTML  │
 * │ plutôt que de les coder en dur, sinon chaque déploiement          │
 * │ précaherait des fichiers qui n'existent plus.                     │
 * └────────────────────────────────────────────────────────────────────┘
 */
async function precacheChunks() {
  try {
    const res = await fetch('/index.html', { cache: 'no-cache' });
    const html = await res.text();
    const urls = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
    const cache = await caches.open(CACHE);

    // Le HTML ne référence que le lot d'entrée ; les autres sont
    // chargés dynamiquement. On les découvre dans le lot d'entrée
    // lui-même, où Vite inscrit leurs chemins.
    const entry = urls.find((u) => u.endsWith('.js'));
    if (entry) {
      const code = await (await fetch(entry)).text();
      for (const m of code.matchAll(/"(\/assets\/[A-Za-z0-9_.-]+\.js)"/g)) {
        urls.push(m[1]);
      }
    }

    await Promise.allSettled([...new Set(urls)].map((u) => cache.add(u)));
  } catch {
    // Le préchargement est un confort : son échec ne doit rien casser.
  }
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim())
      .then(precacheChunks),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Jamais l'API, jamais une autre origine.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Navigation : le réseau d'abord, le cache en secours. L'inverse
  // servirait une ancienne version de l'application après un
  // déploiement, ce qui est la panne la plus déroutante qui soit.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }

  // Ressources versionnées par leur nom (Vite y met une empreinte) :
  // le cache d'abord, sans risque de servir du périmé.
  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      });
    }),
  );
});
