// Client API.
//
// En production nginx relaie /api vers le conteneur API : une base vide
// suffit et le navigateur reste sur une seule origine. VITE_API_BASE ne
// sert qu'au developpement hors conteneur.
const BASE = import.meta.env.VITE_API_BASE ?? '';

class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    ...options,
  });

  if (res.status === 204) return null;

  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // Une erreur de passerelle renvoie du HTML : ne pas masquer le
    // statut derriere une erreur de parsing.
    if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}`, text.slice(0, 200));
    throw new ApiError(res.status, 'Réponse illisible du serveur');
  }

  if (!res.ok) throw new ApiError(res.status, body?.error ?? `HTTP ${res.status}`, body?.details);
  return body;
}

const qs = (params) => {
  const clean = Object.entries(params ?? {}).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  return clean.length ? `?${new URLSearchParams(clean)}` : '';
};

export const api = {
  // --- Exercices ---
  exercises: (params) => request(`/api/exercises${qs(params)}`),
  exercise: (idOrSlug) => request(`/api/exercises/${idOrSlug}`),
  facets: () => request('/api/exercises/facets'),
  // Méthode de curation : paliers, patrons et références.
  evidence: () => request('/api/exercises/evidence'),

  // --- Seances ---
  sessions: (params) => request(`/api/workouts${qs(params)}`),
  session: (id) => request(`/api/workouts/${id}`),
  // Seance en cours : le telephone se verrouille entre deux series, il
  // faut pouvoir reprendre au lieu d'en ouvrir une seconde.
  openSession: () => request('/api/workouts/open'),
  createSession: (body) => request('/api/workouts', {
    method: 'POST', body: JSON.stringify(body ?? {}),
  }),
  updateSession: (id, body) => request(`/api/workouts/${id}`, {
    method: 'PATCH', body: JSON.stringify(body),
  }),
  logSet: (sessionId, body) => request(`/api/workouts/${sessionId}/sets`, {
    method: 'POST', body: JSON.stringify(body),
  }),
  deleteSet: (sessionId, setId) => request(`/api/workouts/${sessionId}/sets/${setId}`, {
    method: 'DELETE',
  }),
  deleteSession: (id) => request(`/api/workouts/${id}`, { method: 'DELETE' }),
  lastPerformance: (exerciseId) => request(`/api/workouts/last/${exerciseId}`),

  // --- Sante ---
  hydrationToday: () => request('/api/health/hydration/today'),
  addHydration: (amountMl) => request('/api/health/hydration', {
    method: 'POST', body: JSON.stringify({ amount_ml: amountMl }),
  }),
  metrics: (params) => request(`/api/health/metrics${qs(params)}`),
  addMetric: (body) => request('/api/health/metrics', {
    method: 'POST', body: JSON.stringify(body),
  }),
  syncEvents: () => request('/api/health-sync/events'),

  healthSeries: (params) => request(`/api/health/series${qs(params)}`),
  healthSources: () => request('/api/health/sources'),

  // --- Sports (toutes disciplines) ---
  sports: () => request('/api/sports'),
  sport: (key) => request(`/api/sports/${key}`),
  // Ce qu'on peut faire, la ou l'on est.
  locations: () => request('/api/sports/locations'),

  // --- Lanceur d'applications ---
  apps: () => request('/api/apps'),
  addApp: (body) => request('/api/apps', {
    method: 'POST', body: JSON.stringify(body),
  }),
  deleteApp: (id) => request(`/api/apps/${id}`, { method: 'DELETE' }),

  // --- Carte personnelle ---
  places: () => request('/api/places'),
  // Attribution, bornes de zoom et etat du cache de tuiles.
  tileInfo: () => request('/api/tiles'),
  addPlace: (body) => request('/api/places', {
    method: 'POST', body: JSON.stringify(body),
  }),
  movePlace: (id, body) => request(`/api/places/${id}`, {
    method: 'PATCH', body: JSON.stringify(body),
  }),
  deletePlace: (id) => request(`/api/places/${id}`, { method: 'DELETE' }),

  // --- Module Carnet (banc d'essai de la coquille) ---
  notes: () => request('/api/notes'),
  addNote: (body) => request('/api/notes', {
    method: 'POST', body: JSON.stringify({ body }),
  }),
  updateNote: (id, patch) => request(`/api/notes/${id}`, {
    method: 'PATCH', body: JSON.stringify(patch),
  }),
  deleteNote: (id) => request(`/api/notes/${id}`, { method: 'DELETE' }),

  // --- Charge et progression ---
  // Charge de Foster : RPE x duree, seule unite commune a tous les sports.
  trainingLoad: (days) => request(`/api/stats/load${qs({
    days, tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })}`),
  gameProgression: () => request(`/api/stats/progression${qs({
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })}`),

  // --- Programmes ---
  programs: () => request('/api/programs'),
  activeProgram: () => request('/api/programs/active'),
  program: (id) => request(`/api/programs/${id}`),
  generateProgram: (body) => request('/api/programs/generate', {
    method: 'POST', body: JSON.stringify(body),
  }),
  deleteProgram: (id) => request(`/api/programs/${id}`, { method: 'DELETE' }),

  // --- Modeles de programme ---
  programTemplates: (params) => request(`/api/programs/templates${qs(params)}`),
  programTemplate: (key, params) => request(`/api/programs/templates/${key}${qs(params)}`),
  useTemplate: (body) => request('/api/programs/from-template', {
    method: 'POST', body: JSON.stringify(body),
  }),

  // --- Edition manuelle ---
  createProgram: (body) => request('/api/programs', {
    method: 'POST', body: JSON.stringify(body),
  }),
  updateProgram: (id, body) => request(`/api/programs/${id}`, {
    method: 'PATCH', body: JSON.stringify(body),
  }),
  duplicateProgram: (id, body) => request(`/api/programs/${id}/duplicate`, {
    method: 'POST', body: JSON.stringify(body ?? {}),
  }),
  addProgramDay: (id, body) => request(`/api/programs/${id}/days`, {
    method: 'POST', body: JSON.stringify(body),
  }),
  updateProgramDay: (id, dayId, body) => request(`/api/programs/${id}/days/${dayId}`, {
    method: 'PATCH', body: JSON.stringify(body),
  }),
  deleteProgramDay: (id, dayId) => request(`/api/programs/${id}/days/${dayId}`, {
    method: 'DELETE',
  }),
  addProgramItem: (id, dayId, body) => request(`/api/programs/${id}/days/${dayId}/items`, {
    method: 'POST', body: JSON.stringify(body),
  }),
  updateProgramItem: (id, itemId, body) => request(`/api/programs/${id}/items/${itemId}`, {
    method: 'PATCH', body: JSON.stringify(body),
  }),
  deleteProgramItem: (id, itemId) => request(`/api/programs/${id}/items/${itemId}`, {
    method: 'DELETE',
  }),
  reorderProgramItems: (id, dayId, itemIds) => request(
    `/api/programs/${id}/days/${dayId}/order`,
    { method: 'PUT', body: JSON.stringify({ item_ids: itemIds }) },
  ),

  // --- Calendrier ---
  // Le fuseau du navigateur est transmis : sans lui, une seance commencee
  // apres minuit serait datee de la veille.
  programCalendar: (params) => request(`/api/programs/calendar${qs({
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    ...params,
  })}`),

  // --- Abonnement iCalendar (Google, Apple, Outlook) ---
  calendarSubscription: () => request('/api/calendar/subscription'),
  rotateCalendarToken: () => request('/api/calendar/subscription/rotate', { method: 'POST' }),
  // L'URL absolue se construit ICI : derriere un proxy, l'hote vu par
  // l'API n'est pas celui que voit le navigateur.
  calendarUrl: (path) => new URL(
    `${path}&tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`,
    window.location.origin,
  ).toString(),

  // --- Profil ---
  profile: () => request('/api/profile'),
  saveProfile: (body) => request('/api/profile', {
    method: 'PUT', body: JSON.stringify(body),
  }),

  // --- Nutrition ---
  nutritionProfile: () => request('/api/nutrition/profile'),
  saveNutritionProfile: (body) => request('/api/nutrition/profile', {
    method: 'PUT', body: JSON.stringify(body),
  }),
  nutritionDay: (date) => request(`/api/nutrition/day${qs({ date })}`),
  foods: (params) => request(`/api/nutrition/foods${qs(params)}`),
  foodByBarcode: (code) => request(`/api/nutrition/foods/barcode/${code}`),
  createFood: (body) => request('/api/nutrition/foods', {
    method: 'POST', body: JSON.stringify(body),
  }),
  logFood: (body) => request('/api/nutrition/entries', {
    method: 'POST', body: JSON.stringify(body),
  }),
  deleteFoodEntry: (id) => request(`/api/nutrition/entries/${id}`, { method: 'DELETE' }),
  copyDay: (body) => request('/api/nutrition/entries/copy', {
    method: 'POST', body: JSON.stringify(body),
  }),
  nutritionHistory: (days) => request(`/api/nutrition/history${qs({ days })}`),
  // Depense reelle, deduite du journal et des pesees. Aucune formule.
  calibration: (days) => request(`/api/nutrition/calibration${qs({ days })}`),

  // --- Recettes et suggestions ---
  recipes: (params) => request(`/api/nutrition/recipes${qs(params)}`),
  recipe: (id) => request(`/api/nutrition/recipes/${id}`),
  // Classees selon ce qu'il RESTE a manger dans la journee.
  mealSuggestions: (params) => request(`/api/nutrition/suggestions${qs(params)}`),
  logRecipe: (body) => request('/api/nutrition/entries/recipe', {
    method: 'POST', body: JSON.stringify(body),
  }),

  // --- Analytique ---
  benchmark: () => request('/api/stats/benchmark'),
  trends: (days) => request(`/api/stats/trends${qs({ days })}`),
  radar: (params) => request(`/api/stats/radar${qs(params)}`),
  bodymap: () => request('/api/stats/bodymap'),
  readiness: () => request('/api/stats/readiness'),
  summary: () => request('/api/stats/summary'),
  // Regularite tenue, en semaines : le programme actif fixe le seuil.
  streak: () => request(`/api/stats/streak${qs({
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })}`),
  // Ce qui etait prevu face a ce qui a ete fait.
  adherence: (weeks) => request(`/api/stats/adherence${qs({
    weeks, tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })}`),

  // --- Meteo ---
  // Relayee par le serveur, jamais appelee depuis le navigateur : voir
  // routes/weather.js pour la raison, qui tient a la vie privee.
  weather: (lat, lon) => request(`/api/weather${qs({ lat, lon })}`),

  // --- Export ---
  exportManifest: () => request('/api/export'),
};


