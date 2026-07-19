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

  // --- Seances ---
  sessions: (params) => request(`/api/workouts${qs(params)}`),
  session: (id) => request(`/api/workouts/${id}`),
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

  // --- Programmes ---
  programs: () => request('/api/programs'),
  activeProgram: () => request('/api/programs/active'),
  program: (id) => request(`/api/programs/${id}`),
  generateProgram: (body) => request('/api/programs/generate', {
    method: 'POST', body: JSON.stringify(body),
  }),
  deleteProgram: (id) => request(`/api/programs/${id}`, { method: 'DELETE' }),

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

  // --- Analytique ---
  benchmark: () => request('/api/stats/benchmark'),
  trends: (days) => request(`/api/stats/trends${qs({ days })}`),
  radar: (params) => request(`/api/stats/radar${qs(params)}`),
  bodymap: () => request('/api/stats/bodymap'),
  readiness: () => request('/api/stats/readiness'),
  summary: () => request('/api/stats/summary'),
};


