import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '../lib/api.js';
import HealthImport from '../components/HealthImport.jsx';
import { shortDay } from '../lib/format.js';

/**
 * Suivi santé (Apple Watch, balance, capteurs).
 *
 * Petits multiples : une métrique = un graphique. Superposer sommeil,
 * VFC et pas sur un même cadre imposerait deux échelles verticales, ce
 * qui rend n'importe quelle comparaison visuelle trompeuse.
 */

/**
 * Les métriques sont groupées par QUESTION posée, pas par capteur.
 *
 * « Est-ce que je récupère ? » se lit sur le sommeil, la VFC et la FC de
 * repos ensemble ; le poids seul ne veut rien dire sans la masse maigre.
 * Un mur de seize graphiques par ordre alphabétique obligerait à faire
 * ce regroupement de tête à chaque consultation.
 *
 * `goodHigh` dit dans quel sens lire une variation : +8 % de VFC est bon,
 * +8 % de FC de repos ne l'est pas. `null` = neutre, aucun jugement.
 */
const GROUPS = [
  {
    title: 'Récupération',
    hint: 'Ce que ton corps répare pendant la nuit.',
    metrics: [
      { key: 'sleep', label: 'Sommeil', unit: 'h', decimals: 1, goodHigh: true },
      { key: 'hrv', label: 'Variabilité cardiaque', unit: 'ms', decimals: 0, goodHigh: true },
      { key: 'resting_hr', label: 'FC de repos', unit: 'bpm', decimals: 0, goodHigh: false },
      { key: 'respiratory_rate', label: 'Fréquence respiratoire', unit: '/min', decimals: 1, goodHigh: null },
    ],
  },
  {
    title: 'Activité',
    hint: 'Ce que tu as dépensé, mouvement par mouvement.',
    metrics: [
      { key: 'steps', label: 'Pas', unit: '', decimals: 0, goodHigh: true },
      { key: 'exercise_minutes', label: 'Minutes d’exercice', unit: 'min', decimals: 0, goodHigh: true },
      { key: 'calories_active', label: 'Calories actives', unit: 'kcal', decimals: 0, goodHigh: true },
      { key: 'distance', label: 'Distance', unit: 'km', decimals: 1, goodHigh: true },
      { key: 'flights', label: 'Étages montés', unit: '', decimals: 0, goodHigh: true },
    ],
  },
  {
    title: 'Composition corporelle',
    hint: 'Le poids seul ment : c’est la répartition qui compte.',
    metrics: [
      { key: 'weight', label: 'Poids', unit: 'kg', decimals: 1, goodHigh: null },
      { key: 'body_fat', label: 'Masse grasse', unit: '%', decimals: 1, goodHigh: false },
      { key: 'lean_mass', label: 'Masse maigre', unit: 'kg', decimals: 1, goodHigh: true },
      { key: 'bmi', label: 'IMC', unit: '', decimals: 1, goodHigh: null },
    ],
  },
  {
    title: 'Métabolisme & endurance',
    hint: 'Ta dépense de fond et ta capacité cardio.',
    metrics: [
      { key: 'calories_basal', label: 'Métabolisme de base', unit: 'kcal', decimals: 0, goodHigh: null },
      { key: 'vo2max', label: 'VO₂ max', unit: 'ml/kg/min', decimals: 1, goodHigh: true },
      { key: 'hydration', label: 'Hydratation', unit: 'mL', decimals: 0, goodHigh: true },
    ],
  },
];

const METRICS = GROUPS.flatMap((g) => g.metrics);

const RANGES = [
  { days: 7, label: '7 j' },
  { days: 30, label: '30 j' },
  { days: 90, label: '90 j' },
];


function MetricTooltip({ active, payload, label, meta }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '8px 12px', fontSize: 13,
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{shortDay(label)}</div>
      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
        {Number(payload[0].value).toFixed(meta.decimals)} {meta.unit}
      </strong>
    </div>
  );
}

function MetricChart({ meta, series, summary }) {
  if (!series?.points?.length) {
    return (
      <div className="card">
        <h3 className="card-title">{meta.label}</h3>
        <p className="empty">Aucune donnée sur la période.</p>
      </div>
    );
  }

  const trend = summary?.trend_pct;
  // Une hausse n'est pas bonne en soi : +8 % de FC de repos est un
  // mauvais signe, +8 % de VFC un bon. D'où `goodHigh` par métrique.
  const trendGood = meta.goodHigh === null || trend == null
    ? null
    : (trend >= 0) === meta.goodHigh;

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <h3 className="card-title" style={{ flex: 1 }}>{meta.label}</h3>
        {trend != null && (
          <span
            style={{
              fontSize: 12, fontWeight: 700,
              color: trendGood === null ? 'var(--text-muted)'
                : trendGood ? 'var(--good)' : 'var(--serious)',
            }}
          >
            {trend > 0 ? '+' : ''}{trend} %
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '2px 0 12px' }}>
        <span style={{ fontSize: 26, fontWeight: 700 }}>
          {summary?.latest?.toFixed(meta.decimals) ?? '—'}
        </span>
        <span className="stat-unit">{meta.unit}</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
          moy. {summary?.average?.toFixed(meta.decimals)} {meta.unit}
        </span>
      </div>

      <div style={{ width: '100%', height: 120 }}>
        <ResponsiveContainer>
          <LineChart data={series.points} margin={{ top: 4, right: 6, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis
              dataKey="day" tickFormatter={shortDay} minTickGap={28}
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              axisLine={{ stroke: 'var(--axis)' }} tickLine={false}
            />
            <YAxis
              domain={['auto', 'auto']} width={44}
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              axisLine={false} tickLine={false}
            />
            <Tooltip
              content={<MetricTooltip meta={meta} />}
              cursor={{ stroke: 'var(--text-muted)', strokeDasharray: '3 3' }}
            />
            <Line
              type="monotone" dataKey="value"
              stroke="var(--series-1)" strokeWidth={2}
              dot={false} activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function HealthPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [sources, setSources] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.allSettled([
      api.healthSeries({ types: METRICS.map((m) => m.key).join(','), days }),
      api.healthSources(),
    ]).then(([s, src]) => {
      if (!alive) return;
      if (s.status === 'fulfilled') setData(s.value);
      else setError(s.reason?.message ?? 'Erreur');
      if (src.status === 'fulfilled') setSources(src.value.items ?? []);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [days]);

  const seriesOf = (key) => data?.series?.find((s) => s.metric_type === key);
  const summaryOf = (key) => data?.summary?.find((s) => s.metric_type === key);
  const hasData = data?.series?.length > 0;

  return (
    <div className="grid">
      <ConnecterAppareils />

      <HealthImport />

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h2 className="card-title">Suivi santé</h2>
            <p className="card-sub" style={{ margin: 0 }}>
              Données synchronisées depuis tes capteurs
            </p>
          </div>
          <div className="tabs">
            {RANGES.map((r) => (
              <button
                key={r.days} type="button" className="tab"
                aria-selected={days === r.days} onClick={() => setDays(r.days)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {sources.length > 0 && (
          <div className="legend" style={{ marginTop: 14 }}>
            {sources.map((s) => (
              <span className="legend-item" key={s.source}>
                <span className="pill">{s.source}</span>
                {s.metrics} mesures · {s.types} types
              </span>
            ))}
          </div>
        )}
      </div>

      {loading && <p className="empty">Chargement…</p>}

      {!loading && hasData && (
        <>
          {GROUPS.map((g) => {
            // Une métrique jamais mesurée ne mérite pas un cadre vide :
            // seize « Aucune donnée » noieraient les trois qui comptent.
            const dispo = g.metrics.filter((m) => seriesOf(m.key)?.points?.length);
            if (!dispo.length) return null;
            return (
              <section key={g.title}>
                <div style={{ margin: '4px 2px 10px' }}>
                  <h2 className="card-title" style={{ margin: 0 }}>{g.title}</h2>
                  <p className="card-sub" style={{ margin: 0 }}>{g.hint}</p>
                </div>
                <div className="grid grid-2">
                  {dispo.map((m) => (
                    <MetricChart
                      key={m.key} meta={m}
                      series={seriesOf(m.key)} summary={summaryOf(m.key)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
          <MetriquesAbsentes manquantes={
            METRICS.filter((m) => !seriesOf(m.key)?.points?.length)
          } jours={days} />
        </>
      )}
    </div>
  );
}

/**
 * Ce que l'app sait suivre mais n'a pas reçu.
 *
 * Sans cette liste, une métrique absente est indistinguable d'une
 * métrique non gérée : on ne saurait pas s'il faut brancher un capteur
 * ou si l'app ne sait tout simplement pas la lire.
 */
function MetriquesAbsentes({ manquantes, jours }) {
  if (!manquantes.length) return null;
  return (
    <div className="card">
      <h3 className="card-title">Non reçu sur {jours} jours</h3>
      <p className="card-sub" style={{ marginTop: 0 }}>
        Ces mesures sont gérées par l’app mais absentes de tes données sur
        la période — élargis la fenêtre, ou vérifie que le capteur les envoie.
      </p>
      <div className="legend">
        {manquantes.map((m) => (
          <span className="pill" key={m.key}>{m.label}</span>
        ))}
      </div>
    </div>
  );
}

/**
 * Combien de JOURS DISTINCTS ont recu une synchronisation cette semaine.
 *
 * ┌─ DEUX FAUX POSITIFS, DEUX CONDITIONS ─────────────────────────────┐
 * │ Ma premiere version demandait « le dernier date de moins de 48 h »│
 * │ et elle MENTAIT : la suite de tests de bout en bout poste sur ce  │
 * │ meme webhook. Trois evenements du jour, et la carte annoncait     │
 * │ « Actif » alors que rien n'etait branche.                          │
 * │                                                                    │
 * │ J'ai cru corriger en exigeant deux jours DISTINCTS — une          │
 * │ automatisation se repete, pas un essai. Toujours faux : j'avais   │
 * │ lance les tests deux jours de suite.                              │
 * │                                                                    │
 * │ Il faut donc les deux, et chacune ecarte une chose differente :   │
 * │   — la SOURCE DECLAREE (`X-ForgeFit-Source`) ecarte le bruit de   │
 * │     test et le `curl` de verification, qui n'en annoncent aucune  │
 * │     et retombent sur « auto ». C'est pour cela que la recette     │
 * │     ci-dessous fait poser cet en-tete : il ne sert a rien au      │
 * │     traitement, le format est reconnu tout seul — il sert a ce    │
 * │     que l'envoi SIGNE d'ou il vient ;                             │
 * │   — les DEUX JOURS distincts ecartent le premier essai reussi de  │
 * │     la recette, qui declare bien sa source mais ne prouve pas     │
 * │     encore qu'une automatisation tourne derriere.                 │
 * └────────────────────────────────────────────────────────────────────┘
 */
function joursSynchronises(evenements) {
  const limite = Date.now() - 7 * 24 * 3600 * 1000;
  const jours = new Set();
  for (const e of evenements ?? []) {
    if (!e.source || e.source === 'auto') continue;
    const t = new Date(e.received_at);
    if (t.getTime() >= limite) jours.add(t.toISOString().slice(0, 10));
  }
  return jours.size;
}

/**
 * Brancher les appareils — et il n'y en a qu'un a brancher.
 *
 * ┌─ POURQUOI CETTE CARTE EST REMONTEE EN HAUT ───────────────────────┐
 * │ Elle etait DERNIERE : 3374 px sur une page de 3557, apres tous    │
 * │ les graphiques, repliee derriere un « + ». Le tutoriel de         │
 * │ l'import MANUEL, lui, s'ouvrait en grand a 287 px.                │
 * │                                                                    │
 * │ Consequence exacte : on arrivait sur cet ecran pour brancher ses  │
 * │ donnees, on lisait la seule marche a suivre visible, et on        │
 * │ repartait convaincu qu'il fallait exporter un fichier a la main   │
 * │ tous les mois. La voie automatique existait et ne se voyait pas.  │
 * │                                                                    │
 * │ Elle passe donc AVANT l'import manuel, et son etat de depart est  │
 * │ MESURE et non suppose : on interroge le journal du webhook. Tant  │
 * │ qu'aucune synchronisation n'est arrivee, la carte est ouverte.    │
 * │ Des qu'il en arrive, elle se replie — le probleme est resolu, et  │
 * │ un mode d'emploi resolu n'a plus a occuper le haut de l'ecran.    │
 * └────────────────────────────────────────────────────────────────────┘
 */
function ConnecterAppareils() {
  // `undefined` = on ne sait pas encore. La carte ne doit ni s'ouvrir ni
  // se replier avant d'avoir la reponse, sinon elle sautera sous les yeux.
  const [evenements, setEvenements] = useState(undefined);
  const [ouvertManuel, setOuvertManuel] = useState(null);
  const racine = window.location.origin;

  const [conf, setConf] = useState(null);
  const [relecture, setRelecture] = useState(0);
  const [relit, setRelit] = useState(false);

  useEffect(() => {
    let vivant = true;
    api.syncEvents()
      .then((d) => { if (vivant) setEvenements(d.items ?? []); })
      .catch(() => { if (vivant) setEvenements([]); })
      .finally(() => { if (vivant) setRelit(false); });
    return () => { vivant = false; };
  }, [relecture]);

  useEffect(() => {
    let vivant = true;
    api.syncConfig().then((d) => { if (vivant) setConf(d); }).catch(() => {});
    return () => { vivant = false; };
  }, []);

  if (evenements === undefined) return null;

  const actif = joursSynchronises(evenements) >= 2;
  const dernier = evenements[0] ?? null;
  const open = ouvertManuel ?? !actif;
  // ┌─ PREFERER LE NOM A L'ADRESSE IP ────────────────────────────────┐
  // │ Une IP de reseau local est distribuee par le routeur, et elle    │
  // │ CHANGE : d'un redemarrage a l'autre, cette machine est passee de │
  // │ .148 a .144. L'adresse figee dans le raccourci a l'import est    │
  // │ alors devenue fausse, sans que rien ne le signale — le raccourci │
  // │ echoue en silence.                                               │
  // │                                                                   │
  // │ Le nom mDNS (« quelquechose.local ») ne bouge pas, et l'iPhone   │
  // │ le resout nativement par Bonjour. On retombe sur l'hote du       │
  // │ navigateur quand l'API n'en declare pas.                         │
  // └───────────────────────────────────────────────────────────────────┘
  const hote = conf?.hote_stable || window.location.hostname;
  const adresse = conf?.token
    ? `http://${hote}:3000${conf.chemin}?token=${conf.token}`
    : null;

  return (
    <div className="card">
      <button
        type="button"
        onClick={() => setOuvertManuel(!open)}
        aria-expanded={open}
        style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10 }}
      >
        <div style={{ flex: 1, textAlign: 'left' }}>
          <h2 className="card-title">Synchroniser tous les jours</h2>
          <p className="card-sub" style={{ margin: 0 }}>
            {actif
              ? `Actif — dernière réception ${new Date(dernier.received_at).toLocaleString('fr-FR')}`
              : 'Pour ne plus jamais exporter de fichier à la main'}
          </p>
        </div>
        <span style={{ color: actif ? 'var(--good)' : 'var(--text-muted)' }}>
          {open ? '−' : '+'}
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 14, fontSize: 14, lineHeight: 1.6 }}>
          <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>
            Montre, balance à impédance, téléphone&nbsp;: tout écrit déjà dans
            l’app <strong>Santé</strong>. Il n’y a donc qu’un seul pont à
            construire, entre Santé et cette API — il rapatrie le reste avec lui.
          </p>

          <p style={{ color: 'var(--text-secondary)' }}>
            L’import manuel, plus bas, sert <strong>une fois</strong>, pour
            récupérer l’historique. Ce pont-ci l’entretient&nbsp;: il tourne
            seul, chaque matin, et tu ne retouches plus à rien.
          </p>

          <div className="sync-telecharger">
            <h3 style={{ ...sousTitre, marginTop: 0 }}>Le raccourci tout fait</h3>
            <p style={{ color: 'var(--text-secondary)', margin: '0 0 12px' }}>
              Dix-huit actions déjà montées et signées. Ouvre ce lien{' '}
              <strong>depuis l’iPhone</strong>&nbsp;: Raccourcis demande
              l’adresse à l’import, tu colles celle du dessous, et c’est fini.
            </p>

            <a
              className="btn-primary"
              href="/sante-vers-atlas.shortcut"
              download="sante-vers-atlas.shortcut"
              style={{ display: 'inline-block', textDecoration: 'none' }}
            >
              Télécharger le raccourci
            </a>

            {adresse ? (
              <>
                <p style={{ ...sousTitre, marginBottom: 4 }}>L’adresse à coller</p>
                <pre style={preStyle}>{adresse}</pre>
                {conf?.hote_stable && (
                  <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '6px 0 0' }}>
                    C’est un <strong>nom</strong>, pas une adresse IP, et c’est
                    voulu&nbsp;: l’IP de cette machine change au redémarrage, ce
                    nom non.
                  </p>
                )}
                <button
                  type="button" className="btn-ghost"
                  onClick={() => navigator.clipboard?.writeText(adresse)}
                >
                  Copier l’adresse
                </button>
              </>
            ) : (
              <p style={{ color: 'var(--warning)', fontSize: 13, marginTop: 12 }}>
                Aucun jeton configuré&nbsp;: ajoute <code style={codeStyle}>WEBHOOK_TOKEN</code>
                {' '}à ton fichier <code style={codeStyle}>.env</code>, puis relance l’API.
                Sans lui le raccourci sera refusé.
              </p>
            )}

            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              Il relève la dernière valeur de la VFC, de la fréquence au repos,
              du poids, de la masse maigre et des pas. Le <strong>sommeil</strong>{' '}
              n’y est pas&nbsp;: Santé le range en catégorie et non en quantité,
              l’action de recherche ne sait pas le lire. Il reste couvert par
              l’import manuel.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              <strong>Lance-le d’abord à la main</strong>, depuis Raccourcis, et
              autorise l’accès à Santé quand il le demande. iOS ne pose cette
              question qu’au premier lancement en avant-plan&nbsp;: une
              automatisation ne peut pas la poser, et renverrait des mesures
              vides sans la moindre erreur.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              <strong>Ensuite seulement</strong>&nbsp;: Raccourcis →{' '}
              <strong>Automatisation</strong> → <strong>Heure de la journée</strong>,
              7&nbsp;h, tous les jours, <em>Exécuter immédiatement</em>.
            </p>
          </div>

          <JournalSync
            evenements={evenements}
            relit={relit}
            onRelire={() => { setRelit(true); setRelecture((n) => n + 1); }}
          />

          <details style={{ marginTop: 18 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
              Les autres chemins, si celui-ci ne convient pas
            </summary>

          <h3 style={sousTitre}>Le plus simple — Health Auto Export</h3>
          <ol style={{ paddingLeft: 20, color: 'var(--text-secondary)' }}>
            <li>Installer <strong>Health Auto Export</strong> sur l’iPhone.</li>
            <li>
              <strong>Automations</strong> → nouvelle automatisation de type{' '}
              <strong>REST API</strong>, fréquence quotidienne.
            </li>
            <li>
              URL <code style={codeStyle}>{`${racine}/api/health-sync`}</code>,
              méthode <strong>POST</strong>, format <strong>JSON</strong>.
            </li>
            <li>
              Choisir les mesures&nbsp;: VFC, fréquence au repos, sommeil, pas,
              calories actives, poids, masse maigre, SpO₂.
            </li>
            <li>
              Ajouter l’en-tête{' '}
              <code style={codeStyle}>X-ForgeFit-Source: apple_health</code>, qui
              permet à cette carte de reconnaître tes synchronisations.
            </li>
          </ol>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            L’application connaît nativement le format d’Apple Health&nbsp;: il
            n’y a aucun corps de requête à composer. C’est une app payante, et
            c’est la seule chose qu’on lui reproche.
          </p>

          <h3 style={sousTitre}>Le gratuit — Raccourcis, livré avec l’iPhone</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>
            Rien à installer, mais il faut monter le raccourci soi-même&nbsp;:
            compte <strong>trois actions par mesure</strong>, puis deux pour
            l’envoi. Pour cinq mesures, une petite vingtaine d’actions.
          </p>
          <ol style={{ paddingLeft: 20, color: 'var(--text-secondary)' }}>
            <li>
              Raccourcis → <strong>+</strong> → créer un raccourci vide, nommé
              par exemple « Santé vers Atlas ».
            </li>
            <li>
              Pour <em>chaque</em> mesure, à la suite&nbsp;:
              <ul style={{ paddingLeft: 18, marginTop: 4 }}>
                <li>
                  <strong>Rechercher des échantillons de santé</strong> — type{' '}
                  <em>Variabilité de la fréquence cardiaque</em>, trier par{' '}
                  <em>date de début</em>, décroissant, <strong>limite 1</strong>.
                </li>
                <li>
                  <strong>Obtenir les détails de l’échantillon de santé</strong>{' '}
                  → <em>Valeur</em>.
                </li>
                <li>
                  <strong>Définir la variable</strong> → <code style={codeStyle}>vfc</code>.
                </li>
              </ul>
              Puis recommencer pour la fréquence au repos, le sommeil, le poids,
              la masse maigre.
            </li>
            <li>
              Une action <strong>Texte</strong>, contenant ceci. Tout se tape
              au clavier <em>sauf</em> ce qui est entre crochets&nbsp;: à la
              place, insère la <strong>variable</strong> du même nom, depuis la
              barre au-dessus du clavier de Raccourcis. Les crochets eux-mêmes
              ne doivent pas rester.
            </li>
          </ol>

          <pre style={preStyle}>
{`{"metrics":[
  {"type":"hrv","value":[VFC],"unit":"ms"},
  {"type":"resting_hr","value":[FC_REPOS],"unit":"bpm"},
  {"type":"sleep","value":[SOMMEIL],"unit":"h"},
  {"type":"weight","value":[POIDS],"unit":"kg"},
  {"type":"lean_mass","value":[MASSE_MAIGRE],"unit":"kg"}
]}`}
          </pre>

          <ol start={4} style={{ paddingLeft: 20, color: 'var(--text-secondary)' }}>
            <li>
              <strong>Obtenir le contenu de</strong>{' '}
              <code style={codeStyle}>{`${racine}/api/health-sync`}</code> —
              méthode <strong>POST</strong>, corps <strong>Fichier</strong> → le
              résultat de l’action Texte, et <strong>deux</strong> en-têtes&nbsp;:
              <ul style={{ paddingLeft: 18, marginTop: 4 }}>
                <li><code style={codeStyle}>Content-Type: application/json</code></li>
                <li><code style={codeStyle}>X-ForgeFit-Source: apple_health</code></li>
              </ul>
              Le second est facultatif pour le traitement — le format est
              reconnu tout seul — mais c’est lui qui permet à cette carte de
              distinguer tes vraies synchronisations d’un essai.
            </li>
            <li>
              Lancer le raccourci une fois à la main. Un{' '}
              <code style={codeStyle}>{'{"accepted":true}'}</code> en retour, et
              c’est branché.
            </li>
            <li>
              Enfin, onglet <strong>Automatisation</strong> →{' '}
              <strong>Heure de la journée</strong>, 7&nbsp;h, tous les jours,{' '}
              <em>Exécuter immédiatement</em>, et choisir ce raccourci.
            </li>
          </ol>

          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            L’envoi ne part que si le téléphone joint l’API, donc sur le Wi-Fi de
            la maison. Sans conséquence&nbsp;: la mesure d’un jour manqué
            remontera à la synchronisation suivante, et un même échantillon
            envoyé deux fois n’est jamais compté en double.
          </p>

          </details>

          <details style={{ marginTop: 10 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
              Vérifier que le pont répond, depuis un terminal
            </summary>
            <pre style={preStyle}>
{`curl -X POST ${racine}/api/health-sync \\
  -H 'Content-Type: application/json' \\
  -d '{"metrics":[{"type":"hrv","value":68,"unit":"ms"}]}'`}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

/**
 * Le journal des receptions — « est-ce que ca a marche ? »
 *
 * ┌─ CE QUI MANQUAIT, ET POURQUOI C'ETAIT GRAVE ──────────────────────┐
 * │ La carte n'annoncait « Actif » qu'apres DEUX jours distincts de   │
 * │ synchronisation. Juste apres avoir lance le raccourci pour la     │
 * │ premiere fois — le moment ou l'on a precisement besoin de savoir  │
 * │ — elle ne disait donc rien du tout. On ne pouvait ni confirmer    │
 * │ que ca marchait, ni diagnostiquer que ca ne marchait pas.         │
 * │                                                                    │
 * │ Le journal repond aux trois cas, qui ne se ressemblent pas :      │
 * │   — rien recu : le raccourci n'a pas joint l'API ;                │
 * │   — recu mais ZERO mesure : c'est la panne muette, celle ou       │
 * │     l'API repond 202 et n'enregistre rien. Elle merite d'etre     │
 * │     criee, pas rangee parmi les succes ;                          │
 * │   — recu avec N mesures : c'est gagne.                            │
 * └────────────────────────────────────────────────────────────────────┘
 */
/** Les cles de l'API, dites en francais. */
const LIBELLE = {
  hrv: 'variabilité cardiaque',
  resting_hr: 'fréquence au repos',
  weight: 'poids',
  lean_mass: 'masse maigre',
  steps: 'pas',
  sleep: 'sommeil',
};

function JournalSync({ evenements, relit, onRelire }) {
  const recents = (evenements ?? []).slice(0, 5);

  const quand = (iso) => new Date(iso).toLocaleString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h3 style={{ ...sousTitre, marginBottom: 6, flex: 1 }}>Est-ce que ça a marché&nbsp;?</h3>
        <button type="button" className="btn-ghost" disabled={relit} onClick={onRelire}>
          {relit ? 'Relecture…' : 'Revérifier'}
        </button>
      </div>

      {recents.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
          <strong>Rien reçu pour l’instant.</strong> Lance le raccourci une fois à
          la main depuis l’iPhone, puis touche <em>Revérifier</em>. S’il ne se
          passe toujours rien, c’est que le téléphone n’atteint pas l’API&nbsp;:
          vérifie qu’il est sur le même Wi-Fi, et que l’adresse collée à l’import
          est bien celle affichée ci-dessus.
        </p>
      ) : (
        <ul className="sync-journal">
          {recents.map((e) => {
            const vide = e.status === 'processed' && !e.metrics_count;
            const rate = e.status === 'failed' || Boolean(e.error);
            const etat = rate ? 'rate' : vide ? 'vide' : 'ok';
            return (
              <li key={e.id} data-etat={etat}>
                <span className="sync-journal-quand">{quand(e.received_at)}</span>
                <span className="sync-journal-dit">
                  {rate ? (
                    <>Échec — {e.error ?? 'raison inconnue'}</>
                  ) : vide ? (
                    <>
                      <strong>Reçu, mais aucune mesure enregistrée.</strong>{' '}
                      {e.vides?.length ? (
                        <>
                          Ces champs sont revenus vides&nbsp;:{' '}
                          <strong>{e.vides.map((v) => LIBELLE[v] ?? v).join(', ')}</strong>.
                          {' '}
                          {/* TOUS vides + lancé en arrière-plan : ce n'est
                              pas un type erroné, c'est l'autorisation. */}
                          {e.arriere_plan && e.vides.length >= 3 ? (
                            <>
                              Et l’envoi vient d’une <strong>automatisation</strong>,
                              pas d’un lancement à la main. C’est presque
                              sûrement la cause&nbsp;: iOS ne demande l’accès à
                              Santé qu’au <strong>premier lancement en
                              avant-plan</strong>, et une automatisation ne peut
                              pas poser la question — elle interroge, n’obtient
                              rien, et n’échoue même pas.{' '}
                              <strong>Ouvre Raccourcis, touche « Santé vers
                              Atlas » toi-même</strong>, et autorise l’accès
                              quand il le demande.
                            </>
                          ) : (
                            <>
                              Dans Raccourcis, ouvre l’action{' '}
                              <em>Rechercher des échantillons de santé</em>{' '}
                              correspondante et vérifie son <em>Type</em> et son{' '}
                              <em>Unité</em>.
                            </>
                          )}
                        </>
                      ) : (
                        <>Le corps de la requête n’avait pas la forme attendue.</>
                      )}
                    </>
                  ) : (
                    <>
                      {e.metrics_count} mesure{e.metrics_count > 1 ? 's' : ''} enregistrée
                      {e.metrics_count > 1 ? 's' : ''}
                      {e.source && e.source !== 'auto' ? ` · ${e.source}` : ''}
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const sousTitre = {
  fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em',
  color: 'var(--text-muted)', margin: '18px 0 6px',
};

const codeStyle = {
  background: 'var(--surface-3)', padding: '2px 6px',
  borderRadius: 5, fontSize: 12, wordBreak: 'break-all',
};

/* ┌─ POURQUOI `pre-wrap` ET `break-all`, ET PAS `overflow-x` ────────┐
   │ Avec `white-space: pre`, une URL sans espace ne se coupe nulle    │
   │ part : le bloc prend la largeur du texte, et comme il vit dans    │
   │ une grille qui se dimensionne sur son contenu, c'est la PAGE      │
   │ ENTIERE qui s'elargit — 649 px de document pour 390 px d'ecran.   │
   │                                                                   │
   │ `overflow-x: auto` ne sauvait rien : il fait defiler le bloc, pas │
   │ retrecir la boite qui l'a fait grandir. Et `html { overflow-x:    │
   │ clip }` ROGNAIT le debordement au lieu de le laisser defiler.     │
   │ Resultat exact : sur un telephone, le jeton etait hors ecran et   │
   │ inatteignable — ni visible, ni joignable par un glissement.       │
   │                                                                   │
   │ Une adresse qui se coupe en fin de ligne est laide ; une adresse  │
   │ qu'on ne peut pas lire ne sert a rien.                            │
   └───────────────────────────────────────────────────────────────────┘ */
const preStyle = {
  background: 'var(--surface-2)', border: '1px solid var(--border)',
  borderRadius: 10, padding: 12, fontSize: 12,
  whiteSpace: 'pre-wrap', wordBreak: 'break-all', minWidth: 0,
  color: 'var(--text-secondary)',
};
