import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import MuscleDiagram from './MuscleDiagram.jsx';
import EvidenceBadge from './EvidenceBadge.jsx';

/**
 * Fiche d'exercice — le contenu, sans le contenant.
 *
 * ┌─ POURQUOI UN COMPOSANT PARTAGÉ ───────────────────────────────────┐
 * │ Le schéma anatomique et les consignes d'exécution n'existaient    │
 * │ que dans la bibliothèque. Or c'est en SÉANCE qu'on se demande     │
 * │ « je sens ça dans l'épaule, c'est normal ? », et devant un        │
 * │ PROGRAMME qu'on veut savoir ce qu'on va travailler. L'information │
 * │ manquait précisément là où elle sert.                             │
 * │                                                                    │
 * │ D'où une fiche unique, que chaque écran habille à sa façon : la   │
 * │ bibliothèque en pleine page, la séance en panneau dépliable, le   │
 * │ programme en aperçu. Trois copies auraient divergé au premier     │
 * │ changement.                                                        │
 * └────────────────────────────────────────────────────────────────────┘
 */

export const DISCIPLINE_LABELS = {
  musculation: 'Musculation',
  callisthenie: 'Callisthénie',
  mobilite: 'Mobilité',
  souplesse: 'Souplesse',
  cardio: 'Cardio',
};

export const AXIS_LABELS = {
  push: 'Force Poussée', pull: 'Force Tirage', legs: 'Jambes',
  endurance: 'Endurance', mobility: 'Mobilité', flexibility: 'Souplesse',
  explosive: 'Explosivité', core: 'Gainage',
};

/**
 * Conseils d'exécution par discipline — le dataset n'en fournit pas.
 *
 * Les consignes du dataset décrivent le GESTE. Celles-ci décrivent le
 * DOSAGE, qui dépend de la discipline et pas de l'exercice : tenir 30 s
 * vaut pour tous les étirements, pas seulement pour celui qu'on regarde.
 */
export const HOW_TO = {
  souplesse: {
    title: 'Comment le travailler',
    points: [
      'Tenir 30 à 60 s par position, sans à-coups.',
      'Aller jusqu’à la tension, jamais jusqu’à la douleur.',
      'Respirer lentement : bloquer la respiration crispe le muscle.',
      'Plutôt après la séance ou à distance : un étirement long avant réduit la force disponible.',
    ],
  },
  mobilite: {
    title: 'Comment le travailler',
    points: [
      '8 à 12 répétitions lentes et contrôlées, amplitude maximale.',
      'Idéal à l’échauffement : prépare l’articulation sans fatiguer.',
      'Chercher l’amplitude que tu contrôles, pas celle que tu subis.',
      'Quotidien de préférence : la fréquence prime sur la durée.',
    ],
  },
  musculation: {
    title: 'Comment le travailler',
    points: [
      'Force : 3–5 séries de 3–6 reps à 80–90 % du 1RM, 3 min de repos.',
      'Hypertrophie : 3–4 séries de 8–12 reps à 65–75 %, 90 s de repos.',
      'Descente contrôlée (2–3 s) : c’est là que se fait l’essentiel du travail.',
      'Garder 1 à 2 reps en réserve, sauf séance de test.',
    ],
  },
  callisthenie: {
    title: 'Comment le travailler',
    points: [
      'Progresser par la difficulté du mouvement avant d’ajouter du lest.',
      'Amplitude complète : une demi-traction ne compte qu’à moitié.',
      'Si moins de 5 reps possibles, passer à une variante assistée.',
      'Au-delà de 15 reps, lester ou complexifier.',
    ],
  },
  cardio: {
    title: 'Comment le travailler',
    points: [
      'Endurance de base : 30–60 min en aisance respiratoire.',
      'Fractionné : 6–10 × 1 min intense / 1 min récupération.',
      'Viser 150 min hebdomadaires minimum, réparties sur la semaine.',
    ],
  },
};

/** Résolution native des médias du dataset. Il n'existe pas mieux. */
const MEDIA_NATIVE_PX = 180;

/**
 * Média de démonstration.
 *
 * Les GIF du dataset font 180×180 — c'est la seule résolution publiée,
 * il n'existe pas de variante HD dans le dépôt. Les étirer sur toute la
 * largeur de colonne (≈ 2,2×) produisait un flou d'interpolation qu'on
 * peut simplement éviter : on plafonne à 1,2× et on centre.
 */
export function ExerciseMedia({ data, zoomable = true }) {
  const [zoomed, setZoomed] = useState(false);
  const [failed, setFailed] = useState(false);
  const width = zoomed ? MEDIA_NATIVE_PX * 2 : Math.round(MEDIA_NATIVE_PX * 1.2);

  if (!data.gif_url && !data.image_url) return null;

  return (
    <div>
      <div className="media-frame">
        {failed ? (
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Démonstration indisponible
          </span>
        ) : (
          <img
            // Média servi depuis le dépôt source, jamais rapatrié.
            src={data.gif_url ?? data.image_url}
            alt={`Démonstration animée : ${data.name_fr}`}
            loading="lazy" decoding="async"
            width={MEDIA_NATIVE_PX}
            height={MEDIA_NATIVE_PX}
            style={{
              width, height: width, maxWidth: '100%',
              borderRadius: 8, display: 'block',
              transition: 'width 220ms var(--ease-out), height 220ms var(--ease-out)',
              imageRendering: 'auto',
            }}
            onError={() => setFailed(true)}
          />
        )}
      </div>

      {!failed && zoomable && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginTop: 8,
          flexWrap: 'wrap',
        }}>
          <button
            type="button" className="btn-ghost" onClick={() => setZoomed((v) => !v)}
            aria-pressed={zoomed}
          >
            {zoomed ? 'Taille native' : 'Agrandir ×2'}
          </button>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Source en {MEDIA_NATIVE_PX}×{MEDIA_NATIVE_PX}
            {zoomed ? ' — agrandi, donc adouci' : ''}
          </span>
        </div>
      )}

      {data.attribution && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
          {data.attribution}
        </p>
      )}
    </div>
  );
}

/**
 * Ce que dit la littérature sur cet exercice.
 *
 * Affiché avec ses références complètes. Un classement dont on ne peut
 * pas remonter à la source ne vaut pas mieux qu'une opinion, et
 * l'absence de classement doit être expliquée plutôt que laissée vide :
 * ne pas figurer dans le noyau curé n'est pas un jugement de qualité.
 */
export function EvidencePanel({ data }) {
  const sources = data.evidence_sources ?? [];

  if (!data.evidence_tier) {
    return (
      <p style={{
        fontSize: 12, color: 'var(--text-muted)', marginTop: 12,
        marginBottom: 0, lineHeight: 1.6,
      }}>
        Exercice non classé : redondant avec un mouvement mieux documenté, ou trop
        spécifique pour être recommandé par défaut. Ce n’est pas un jugement de
        qualité — rien n’empêche de l’utiliser.
      </p>
    );
  }

  return (
    <div className="evidence-panel">
      <div className="stat-label" style={{ marginBottom: 6 }}>
        Ce que dit la littérature
      </div>
      {data.evidence_note && (
        <p style={{
          fontSize: 13, margin: 0, lineHeight: 1.6, color: 'var(--text-secondary)',
        }}>
          {data.evidence_note}
        </p>
      )}
      {sources.length > 0 && (
        <ul style={{
          paddingLeft: 16, margin: '10px 0 0', fontSize: 11,
          color: 'var(--text-muted)', lineHeight: 1.6,
        }}>
          {sources.map((src) => (
            <li key={src.key} style={{ marginBottom: 6 }}>
              {src.claim && (
                <span style={{ color: 'var(--text-secondary)' }}>{src.claim}<br /></span>
              )}
              {src.url
                ? <a href={src.url} target="_blank" rel="noreferrer">{src.citation}</a>
                : src.citation}
            </li>
          ))}
        </ul>
      )}
      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '10px 0 0', lineHeight: 1.5 }}>
        Classement établi sur la littérature publiée. Aucun exercice n’est validé
        par un professionnel de santé : en cas de douleur ou de reprise après
        blessure, un avis médical prime.
      </p>
    </div>
  );
}

/**
 * Charge la fiche complète d'un exercice.
 *
 * Les listes ne renvoient pas les consignes d'exécution — elles pèsent
 * lourd multipliées par soixante lignes. On les va chercher à
 * l'ouverture, en gardant l'aperçu déjà connu comme fond d'écran : la
 * fiche s'affiche pleine dès le premier instant, puis se complète.
 */
export function useExercise(exercise) {
  const [full, setFull] = useState(null);
  const [error, setError] = useState(null);
  const id = exercise?.id;

  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    setFull(null);
    setError(null);
    api.exercise(id)
      .then((d) => { if (alive) setFull(d); })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [id]);

  return { data: full ?? exercise ?? null, full, error, loading: !full && !error };
}

/**
 * Corps de la fiche : muscles, exécution, dosage, littérature.
 *
 * `compact` retire le média et resserre la mise en page — en séance, on
 * veut vérifier une consigne, pas contempler une planche anatomique.
 */
export default function ExerciseSheet({ exercise, compact = false, showEvidence = true }) {
  const { data, full, error, loading } = useExercise(exercise);
  if (!data) return null;

  const steps = full?.steps ?? [];
  const secondary = (data.secondary_muscles ?? []).filter((m) => m !== data.target);
  const howTo = HOW_TO[data.discipline];

  return (
    <div>
      {error && <div className="error-banner" style={{ marginTop: 12 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: compact ? 0 : 12 }}>
        <EvidenceBadge tier={data.evidence_tier} />
        <span className="pill">{DISCIPLINE_LABELS[data.discipline] ?? data.discipline}</span>
        {data.equipment && <span className="pill">{data.equipment}</span>}
        {data.axis && <span className="pill">{AXIS_LABELS[data.axis] ?? data.axis}</span>}
      </div>

      {showEvidence && <EvidencePanel data={data} />}

      <div className={compact ? '' : 'grid grid-2'} style={{ marginTop: 16 }}>
        {!compact && <ExerciseMedia data={data} />}

        <div>
          <div className="stat-label" style={{ marginBottom: 8 }}>Muscles sollicités</div>
          <MuscleDiagram
            primary={data.target}
            secondary={secondary}
            maxWidth={compact ? 170 : 210}
          />
        </div>
      </div>

      {steps.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div className="stat-label" style={{ marginBottom: 8 }}>Exécution</div>
          <ol className="steps-list">
            {steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </div>
      )}

      {loading && (
        <p className="empty" style={{ marginTop: 12 }}>Chargement des consignes…</p>
      )}

      {howTo && (
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--grid)' }}>
          <div className="stat-label" style={{ marginBottom: 8 }}>{howTo.title}</div>
          <ul style={{ paddingLeft: 20, margin: 0, fontSize: 14, lineHeight: 1.65 }}>
            {howTo.points.map((p, i) => (
              <li key={i} style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>{p}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
