// Normalisation des donnees de sante entrantes.
//
// Chaque source parle son propre dialecte : Apple Health exporte des
// `samples` avec `startDate`, Withings des `measuregrps` en notation
// scientifique, un capteur MQTT un objet plat. On ramene tout a la meme
// forme sans jamais figer la charge utile : `value` conserve l'objet
// natif, seule sa CLE de lecture est normalisee.
//
// Ajouter une source = ajouter un adaptateur ici. Aucune migration SQL.

/** Forme cible : une metrique prete pour la table health_metrics. */
const metric = ({ metricType, recordedAt, value, unit = null, externalId = null, meta = {} }) => ({
  metricType,
  recordedAt: toIsoOrNow(recordedAt),
  value,
  unit,
  externalId,
  meta,
});

function toIsoOrNow(input) {
  if (!input) return new Date().toISOString();
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/** Vocabulaire Apple Health / HealthKit -> nos cles internes. */
const APPLE_TYPE_MAP = {
  HKQuantityTypeIdentifierDietaryWater: 'hydration',
  HKQuantityTypeIdentifierStepCount: 'steps',
  HKQuantityTypeIdentifierActiveEnergyBurned: 'calories_active',
  HKQuantityTypeIdentifierBasalEnergyBurned: 'calories_basal',
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: 'hrv',
  HKQuantityTypeIdentifierRestingHeartRate: 'resting_hr',
  HKQuantityTypeIdentifierBodyMass: 'weight',
  HKQuantityTypeIdentifierBodyFatPercentage: 'body_fat',
  // Composition corporelle : une balance à impédance (Renpho, Withings…)
  // publie tout ceci dans Santé. La masse maigre en particulier est
  // mesurée directement — inutile de la déduire du taux de masse grasse.
  HKQuantityTypeIdentifierLeanBodyMass: 'lean_mass',
  HKQuantityTypeIdentifierBodyMassIndex: 'bmi',
  HKQuantityTypeIdentifierHeight: 'height',
  HKQuantityTypeIdentifierWaistCircumference: 'waist',
  HKQuantityTypeIdentifierAppleExerciseTime: 'exercise_minutes',
  HKQuantityTypeIdentifierDistanceWalkingRunning: 'distance',
  HKQuantityTypeIdentifierRespiratoryRate: 'respiratory_rate',
  HKQuantityTypeIdentifierFlightsClimbed: 'flights',
  HKQuantityTypeIdentifierHeartRate: 'heart_rate',
  HKQuantityTypeIdentifierVO2Max: 'vo2max',
  HKQuantityTypeIdentifierOxygenSaturation: 'spo2',
  HKCategoryTypeIdentifierSleepAnalysis: 'sleep',
  // Alias courts utilises par les exports tiers (Health Auto Export...)
  dietary_water: 'hydration',
  step_count: 'steps',
  active_energy: 'calories_active',
  heart_rate_variability: 'hrv',
  resting_heart_rate: 'resting_hr',
  body_mass: 'weight',
  sleep_analysis: 'sleep',
  lean_body_mass: 'lean_mass',
  body_mass_index: 'bmi',
  body_fat_percentage: 'body_fat',
  // Les exportateurs tiers renomment souvent les mesures de balance.
  muscle_mass: 'muscle_mass',
  bone_mass: 'bone_mass',
  body_water: 'body_water',
  visceral_fat: 'visceral_fat',
};

/** Cles reconnues quel que soit l'emetteur. */
const CANONICAL_TYPES = new Set([
  'hydration', 'sleep', 'steps', 'calories_active', 'calories_basal',
  'hrv', 'resting_hr', 'weight', 'body_fat', 'vo2max', 'spo2',
  'blood_glucose', 'temperature', 'mood', 'stress',
  // Composition corporelle (balance à impédance)
  'lean_mass', 'muscle_mass', 'bone_mass', 'body_water', 'visceral_fat',
  'bmi', 'height', 'waist',
  // Activité
  'exercise_minutes', 'distance', 'respiratory_rate', 'flights', 'heart_rate',
]);

/**
 * Métriques qui S'ADDITIONNENT sur une journée.
 *
 * Deux mille pas le matin et trois mille l'après-midi font cinq mille
 * pas ; deux mesures de VFC à 60 et 80 ms ne font pas 140. La
 * distinction décide de l'agrégation à l'import comme à la lecture —
 * d'où sa place ici, dans le vocabulaire partagé, plutôt que recopiée
 * dans chaque module qui en a besoin.
 */
export const CUMULATIVE_TYPES = new Set([
  'steps', 'calories_active', 'calories_basal', 'hydration',
  'exercise_minutes', 'distance', 'flights',
]);

/** Grandeurs instantanées : on en fait une moyenne, jamais une somme. */
export const AVERAGED_TYPES = new Set(['respiratory_rate', 'heart_rate']);

/**
 * Métriques qu'Apple exprime en FRACTION malgré une unité « % ».
 *
 * HealthKit stocke les pourcentages entre 0 et 1 : un taux de masse
 * grasse de 17,5 % arrive en `0.175`, une saturation de 98 % en `0.98`.
 * Repris tel quel, un taux de masse grasse de 0,175 rendrait la masse
 * maigre déduite quasi égale au poids total — et toute la dépense
 * énergétique avec.
 *
 * Le seuil est sûr : aucune de ces grandeurs n'est physiologiquement
 * inférieure à 1 %. Une valeur ≤ 1 est donc forcément une fraction.
 */
const FRACTION_TYPES = new Set(['body_fat', 'spo2', 'body_water']);

export function normalizePercent(type, value) {
  if (!FRACTION_TYPES.has(type)) return value;
  // `Number(null)` vaut 0 : sans cette garde, une valeur absente
  // ressortirait en 0 % au lieu de rester absente.
  if (value === null || value === undefined || value === '') return value;
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n > 0 && n <= 1 ? Math.round(n * 1000) / 10 : n;
}

export function canonicalType(raw) {
  if (!raw) return 'unknown';
  const key = String(raw);
  if (APPLE_TYPE_MAP[key]) return APPLE_TYPE_MAP[key];
  const lower = key.toLowerCase().replace(/[\s-]+/g, '_');
  if (APPLE_TYPE_MAP[lower]) return APPLE_TYPE_MAP[lower];
  if (CANONICAL_TYPES.has(lower)) return lower;
  // Type inconnu conserve tel quel : le modele JSONB l'accepte, et il
  // restera interrogeable meme sans adaptateur dedie.
  return lower;
}

/** Apple Health : { data: { metrics: [{ name, units, data: [...] }] } } */
function adaptAppleHealth(payload) {
  const out = [];
  const metrics = payload?.data?.metrics ?? payload?.metrics ?? [];

  for (const m of metrics) {
    const metricType = canonicalType(m.name ?? m.type);
    const unit = m.units ?? m.unit ?? null;
    for (const sample of m.data ?? []) {
      const recordedAt = sample.date ?? sample.startDate ?? sample.timestamp;
      // Le sommeil arrive en phases, pas en scalaire.
      const value = sample.qty !== undefined
        ? { value: normalizePercent(metricType, Number(sample.qty)) }
        : sample;
      out.push(metric({
        metricType,
        recordedAt,
        value,
        unit,
        externalId: sample.uuid ?? sample.id ?? `${metricType}:${recordedAt}`,
        meta: { source_name: sample.source ?? m.source ?? null },
      }));
    }
  }
  return out;
}

/** Balance connectee / objet IoT : { device, readings: [...] } */
function adaptIot(payload) {
  const out = [];
  const device = payload.device ?? payload.device_id ?? 'iot';
  const readings = payload.readings ?? payload.measures ?? [];

  for (const r of readings) {
    const metricType = canonicalType(r.type ?? r.metric ?? r.name);
    out.push(metric({
      metricType,
      recordedAt: r.timestamp ?? r.at ?? payload.timestamp,
      value: r.value !== undefined && typeof r.value !== 'object'
        ? { value: Number(r.value) }
        : (r.value ?? r),
      unit: r.unit ?? null,
      externalId: r.id ? `${device}:${r.id}` : null,
      meta: { device },
    }));
  }
  return out;
}

/** Forme generique : { metrics: [{ type, value, recorded_at, unit }] } */
function adaptGeneric(payload) {
  // Chaque candidat doit etre verifie comme TABLEAU : `payload.data` est
  // un objet chez Apple Health, et un `.filter` dessus faisait tomber
  // l'ingestion entiere.
  const candidates = [
    payload,
    payload?.metrics,
    payload?.data,
    payload?.data?.metrics,
    payload?.readings,
  ];
  const items = candidates.find(Array.isArray) ?? [payload];

  return items
    .filter((i) => i && typeof i === 'object')
    .map((i) => {
      const rawValue = i.value ?? i.qty ?? i.amount;
      return metric({
        metricType: canonicalType(i.type ?? i.metric_type ?? i.name),
        recordedAt: i.recorded_at ?? i.recordedAt ?? i.timestamp ?? i.date,
        value: rawValue !== undefined && typeof rawValue !== 'object'
          ? { value: Number(rawValue) }
          : (rawValue ?? i),
        unit: i.unit ?? i.units ?? null,
        externalId: i.external_id ?? i.id ?? null,
        meta: i.meta ?? {},
      });
    });
}

const ADAPTERS = {
  apple_health: adaptAppleHealth,
  apple: adaptAppleHealth,
  healthkit: adaptAppleHealth,
  iot: adaptIot,
  device: adaptIot,
  withings: adaptIot,
  generic: adaptGeneric,
};

/**
 * Detecte la source quand elle n'est pas declaree, par la forme du
 * payload. Faute de signature reconnue, l'adaptateur generique prend le
 * relais : mieux vaut ingerer une donnee imparfaitement typee que la
 * perdre.
 */
export function detectSource(payload) {
  if (payload?.data?.metrics || payload?.metrics?.[0]?.units) return 'apple_health';
  if (payload?.readings || payload?.device || payload?.device_id) return 'iot';
  return 'generic';
}

/**
 * Normalise un payload en liste de metriques.
 * @returns {{source:string, metrics:Array}}
 */
export function normalizePayload(payload, declaredSource) {
  const declared = String(declaredSource ?? '').toLowerCase().trim();

  // Une etiquette qui ne correspond a aucun adaptateur ne doit pas nous
  // faire tomber sur le generique par defaut : l'endpoint universel
  // enregistre 'auto' quand l'emetteur n'a rien declare, et un capteur
  // tiers peut s'annoncer 'garmin'. Dans les deux cas la FORME du
  // payload est un signal plus fiable que l'etiquette.
  const adapterKey = ADAPTERS[declared] ? declared : detectSource(payload);
  const adapter = ADAPTERS[adapterKey] ?? adaptGeneric;

  let metrics = [];
  try {
    metrics = adapter(payload) ?? [];
  } catch {
    // Un payload malforme ne doit pas faire tomber l'ingestion.
    try {
      metrics = adaptGeneric(payload) ?? [];
    } catch {
      metrics = [];
    }
  }

  if (!Array.isArray(metrics)) metrics = [];

  return {
    // On conserve l'etiquette declaree pour la tracabilite, sauf le
    // marqueur interne 'auto' qui n'apprend rien.
    source: declared && declared !== 'auto' ? declared : adapterKey,
    metrics: metrics.filter(
      (m) => m?.metricType && m.metricType !== 'unknown' && m.value !== undefined,
    ),
  };
}
