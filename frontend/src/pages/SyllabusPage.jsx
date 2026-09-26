import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';

/**
 * Le syllabus — ce qu'il y a à tenir, et ce qui est tenu.
 *
 * ┌─ POURQUOI CET ÉCRAN EXISTE ───────────────────────────────────────┐
 * │ L'API savait servir le syllabus et enregistrer ce qui est acquis  │
 * │ (`GET /coach/syllabus`, `POST /coach/progress/:key`) depuis        │
 * │ plusieurs versions. Aucun écran ne l'appelait : on ne pouvait ni  │
 * │ voir son programme de grade, ni cocher ce qu'on tenait.           │
 * │                                                                    │
 * │ Or c'est exactement ce que le coach utilise pour choisir les      │
 * │ techniques de la séance du jour : sans cet écran, il proposait    │
 * │ éternellement les mêmes.                                          │
 * └────────────────────────────────────────────────────────────────────┘
 */

export default function SyllabusPage({ navigate }) {
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(null);

  const charger = useCallback(() => api.coachSyllabus()
    .then(setData)
    .catch((e) => setErreur(e.message)), []);

  useEffect(() => { charger(); }, [charger]);

  if (erreur) return <div className="error-banner">{erreur}</div>;
  if (!data) return <p className="empty">Chargement…</p>;

  if (!data.grade) {
    return (
      <div className="card">
        <h2 className="card-title">Aucun syllabus</h2>
        <p className="card-sub">
          Le suivi de grade n’existe que pour les disciplines qui en ont un —
          le karaté pour l’instant.
        </p>
        <button
          type="button" className="btn-primary" style={{ marginTop: 14 }}
          onClick={() => navigate?.('entrainement', 'coach')}
        >
          Choisir un objectif
        </button>
      </div>
    );
  }

  const acquis = new Set(data.acquis ?? []);

  const basculer = async (cle) => {
    setEnCours(cle);
    try {
      if (acquis.has(cle)) await api.retirerProgres(cle);
      else await api.marquerProgres(cle);
      await charger();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(null);
    }
  };

  const libelle = (cle) => data.techniques?.[cle]?.label
    ?? data.kata?.find((k) => k.key === cle)?.label
    ?? data.kumite?.find((k) => k.key === cle)?.label
    ?? cle;

  const gloss = (cle) => data.techniques?.[cle]?.gloss
    ?? data.kata?.find((k) => k.key === cle)?.theme
    ?? data.kumite?.find((k) => k.key === cle)?.gloss
    ?? null;

  const Bloc = ({ titre, sous, cles }) => (
    cles.length === 0 ? null : (
      <div className="card">
        <h2 className="card-title">{titre}</h2>
        {sous && <p className="card-sub">{sous}</p>}
        <ul className="syllabus-liste">
          {cles.map((c) => {
            const tenu = acquis.has(c);
            return (
              <li key={c}>
                <button
                  type="button"
                  className={`syllabus-item${tenu ? ' syllabus-tenu' : ''}`}
                  aria-pressed={tenu}
                  disabled={enCours === c}
                  onClick={() => basculer(c)}
                >
                  <span className="syllabus-coche" aria-hidden="true">{tenu ? '✓' : ''}</span>
                  <span className="syllabus-texte">
                    <strong>{libelle(c)}</strong>
                    {gloss(c) && <span className="syllabus-gloss">{gloss(c)}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    )
  );

  const courant = data.courant ?? {};
  const suivant = data.suivant;
  const total = (courant.techniques?.length ?? 0) + (courant.kata?.length ?? 0);
  const tenus = [...(courant.techniques ?? []), ...(courant.kata ?? [])]
    .filter((c) => acquis.has(c)).length;

  return (
    <div className="grid">
      <div className="card">
        <div className="stat-label">Grade actuel</div>
        <h2 className="card-title" style={{ margin: '4px 0 0' }}>
          {data.grade}e kyu
        </h2>
        <p className="card-sub" style={{ margin: '4px 0 0' }}>
          {tenus} élément{tenus > 1 ? 's' : ''} tenu{tenus > 1 ? 's' : ''} sur {total} au programme
        </p>
        <div className="gauge" style={{ height: 10, marginTop: 12 }}>
          <div
            className="gauge-fill"
            style={{
              width: `${total ? (tenus / total) * 100 : 0}%`,
              background: tenus >= total ? 'var(--good)' : 'var(--brand)',
            }}
          />
        </div>
        {/* Ce que le coach en fait, dit explicitement : sans quoi cocher
            une case ressemble à un geste sans conséquence. */}
        <p className="syllabus-note">
          Ce que tu coches ici sort des séances que le coach te propose. C’est
          ainsi qu’il cesse de te faire retravailler ce que tu tiens déjà.
        </p>
      </div>

      {suivant && (
        <Bloc
          titre={`Pour le ${suivant.kyu}e kyu`}
          sous={`Ceinture ${suivant.ceinture} — ce que le grade suivant ajoute`}
          cles={[...(suivant.techniques ?? []), ...(suivant.kata ?? [])]}
        />
      )}

      <Bloc
        titre="Au programme de ton grade"
        sous="Tout ce qui est exigé jusqu’ici, les grades précédents compris"
        cles={courant.techniques ?? []}
      />

      <Bloc
        titre="Kata"
        sous="Dans l’ordre canonique"
        cles={courant.kata ?? []}
      />

      {courant.kumite && (
        <div className="card">
          <h2 className="card-title">Kumité</h2>
          <p className="card-sub">
            La forme travaillée à ton grade. C’est une progression, pas une liste :
            on ne travaille pas les cinq formes à la fois.
          </p>
          <p className="syllabus-kumite">
            <strong>{libelle(courant.kumite)}</strong>
            {gloss(courant.kumite) && <span>{gloss(courant.kumite)}</span>}
          </p>
        </div>
      )}

      <div className="card">
        <h2 className="card-title">D’où vient ce syllabus</h2>
        {(data.sources ?? []).map((s) => (
          <p key={s.cle} style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 8px' }}>
            {s.texte}
          </p>
        ))}
      </div>
    </div>
  );
}
