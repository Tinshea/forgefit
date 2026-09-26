import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import BodyFigure from './BodyFigure.jsx';
import { bestViewFor } from '../lib/anatomy.js';

/**
 * Une illustration, avec son attribution.
 *
 * ┌─ L'ATTRIBUTION N'EST PAS DÉCORATIVE ──────────────────────────────┐
 * │ Les licences CC BY et CC BY-SA EXIGENT de citer l'auteur et la    │
 * │ licence, et de renvoyer à la source. Afficher l'image sans cela   │
 * │ serait une republication irrégulière — et le plus simple des      │
 * │ manquements à éviter.                                             │
 * └────────────────────────────────────────────────────────────────────┘
 */
function Illustration({ i, nom }) {
  return (
    <figure className="technique-figure">
      <img
        src={i.image}
        alt={`${nom} — illustration`}
        loading="lazy"
        // Une image distante peut disparaître ou changer : on ne casse
        // pas la mise en page pour autant.
        onError={(e) => { e.currentTarget.closest('figure').hidden = true; }}
      />
      <figcaption>
        {i.auteur && <span>{i.auteur}</span>}
        <a href={i.page} target="_blank" rel="noreferrer noopener">
          {i.licence} · Wikimedia Commons
        </a>
      </figcaption>
    </figure>
  );
}

/**
 * Le manuel : pourquoi, quoi, comment, et dans quel esprit.
 *
 * L'ordre n'est pas neutre. « Pourquoi » vient en premier parce que
 * c'est la question qu'on se pose avant de pousser la porte d'un club ;
 * « démarrer » vient en dernier parce que c'est celle qu'on se pose
 * une fois décidé.
 */
function Manuel({ m }) {
  return (
    <>
      <div className="card">
        <h2 className="card-title">Pourquoi cette discipline</h2>
        <p className="manuel-chapeau">{m.pourquoi}</p>
        <div className="manuel-forces">
          {m.forces.map((f) => (
            <div className="manuel-force" key={f.titre}>
              <strong>{f.titre}</strong>
              <p>{f.texte}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Le répertoire technique</h2>
        <p className="card-sub">
          Les repères d’exécution servent à s’auto-observer. Une technique de
          combat se corrige avec un œil extérieur.
        </p>
        {m.chaine && (
          <a
            className="btn-ghost" style={{ display: 'inline-block', marginBottom: 12 }}
            href={m.chaine.url} target="_blank" rel="noreferrer noopener"
          >
            {m.chaine.libelle}
          </a>
        )}
        {m.techniques.map((f) => (
          <div className="manuel-famille" key={f.famille}>
            <div className="stat-label">{f.famille}</div>
            <ul className="manuel-techniques">
              {f.items.map((t) => (
                <li key={t.nom} className={t.illustration ? 'avec-image' : undefined}>
                  {t.illustration && <Illustration i={t.illustration} nom={t.nom} />}
                  <div className="technique-texte">
                    <strong>{t.nom}</strong>
                    <span className="manuel-gloss">{t.gloss}</span>
                    {t.cles?.length > 0 && (
                      <ul className="manuel-cles">
                        {t.cles.map((c) => <li key={c}>{c}</li>)}
                      </ul>
                    )}
                    {t.video && (
                      <a
                        className="technique-video"
                        href={t.video.url}
                        target="_blank" rel="noreferrer noopener"
                      >
                        ▸ {t.video.libelle}
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="card-title">Comment on s’entraîne</h2>
        <div className="manuel-methodes">
          {m.methodes.map((me) => (
            <div className="manuel-methode" key={me.nom}>
              <div className="manuel-methode-tete">
                <strong>{me.nom}</strong>
                <span>{me.gloss}</span>
              </div>
              <p>{me.role}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">L’esprit de la discipline</h2>
        {/* Une discipline sans doctrine écrite le DIT. Lui en prêter une
            serait lui attribuer ce qu'elle n'a jamais revendiqué. */}
        <p className={m.esprit.codifie ? 'manuel-chapeau' : 'manuel-chapeau manuel-sans-doctrine'}>
          {m.esprit.texte}
        </p>
        {m.esprit.principes?.length > 0 && (
          <div className="manuel-principes">
            {m.esprit.principes.map((p) => (
              <div className="manuel-principe" key={p.nom}>
                <strong>{p.nom}</strong>
                <p>{p.texte}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="card-title">Ce que ça apprend</h2>
        <ul className="manuel-lecons">
          {m.lecons.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </div>

      <div className="card">
        <h2 className="card-title">Démarrer</h2>
        <div className="stat-label" style={{ marginBottom: 6 }}>Matériel</div>
        <ul className="manuel-liste">
          {m.demarrer.materiel.map((x) => <li key={x}>{x}</li>)}
        </ul>
        <div className="stat-label" style={{ margin: '14px 0 6px' }}>Ta première séance</div>
        <p className="manuel-chapeau">{m.demarrer.premiere_seance}</p>
        <div className="stat-label" style={{ margin: '14px 0 6px' }}>Repères</div>
        <ul className="manuel-liste">
          {m.demarrer.reperes.map((x) => <li key={x}>{x}</li>)}
        </ul>
      </div>
    </>
  );
}

/**
 * Le détail — ce qu'on relit une fois qu'on pratique.
 *
 * Placé APRÈS le résumé et le profil : quelqu'un qui découvre la
 * discipline n'a pas besoin du barème de points avant d'avoir compris
 * à quoi elle sert. Quelqu'un qui pratique, si.
 */
function Detail({ d }) {
  return (
    <>
      <div className="card">
        <h2 className="card-title">Comment on y gagne</h2>
        <p className="card-sub">{d.format.instance}</p>
        <dl className="detail-faits">
          <div><dt>Durée</dt><dd>{d.format.duree}</dd></div>
          <div><dt>Notation</dt><dd>{d.format.notation}</dd></div>
          <div><dt>Cibles</dt><dd>{d.format.cibles}</dd></div>
          <div><dt>Catégories</dt><dd>{d.format.categories}</dd></div>
        </dl>
        <div className="stat-label" style={{ margin: '14px 0 6px' }}>Manières de gagner</div>
        <ul className="manuel-liste">
          {d.format.victoire.map((v) => <li key={v}>{v}</li>)}
        </ul>
      </div>

      <div className="card">
        <h2 className="card-title">À quoi ressemble une séance</h2>
        <p className="card-sub">
          {d.seance_type.reduce((a, p) => a + p.minutes, 0)} minutes au total.
        </p>
        <div className="detail-seance">
          {d.seance_type.map((p) => (
            <div className="detail-phase" key={p.phase}>
              <div className="detail-phase-tete">
                <strong>{p.phase}</strong>
                <span>{p.minutes} min</span>
              </div>
              <p>{p.contenu}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">La progression</h2>
        <div className="detail-paliers">
          {d.progression.map((p) => (
            <div className="detail-palier" key={p.palier}>
              <div className="detail-phase-tete">
                <strong>{p.palier}</strong>
                {p.duree && <span>{p.duree}</span>}
              </div>
              <ul className="manuel-liste" style={{ marginTop: 6 }}>
                {p.reperes.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Les fautes qu’on fait tous</h2>
        <p className="card-sub">
          Chacune avec sa raison et sa correction — signaler une faute sans dire
          comment la corriger serait un reproche, pas un enseignement.
        </p>
        <div className="detail-erreurs">
          {d.erreurs.map((e) => (
            <div className="detail-erreur" key={e.faute}>
              <strong>{e.faute}</strong>
              <p className="detail-pourquoi">{e.pourquoi}</p>
              <p className="detail-correction">{e.correction}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card detail-securite">
        <h2 className="card-title">Sécurité</h2>
        {d.securite.note && <p className="manuel-chapeau">{d.securite.note}</p>}
        <div className="stat-label" style={{ margin: '14px 0 6px' }}>Blessures fréquentes</div>
        <ul className="manuel-liste">
          {d.securite.frequentes.map((x) => <li key={x}>{x}</li>)}
        </ul>
        <div className="stat-label" style={{ margin: '14px 0 6px' }}>Ce qui les évite</div>
        <ul className="manuel-liste">
          {d.securite.prevention.map((x) => <li key={x}>{x}</li>)}
        </ul>
      </div>

      <div className="card">
        <h2 className="card-title">Le vocabulaire</h2>
        <dl className="detail-faits">
          {d.glossaire.map((g) => (
            <div key={g.terme}><dt>{g.terme}</dt><dd>{g.definition}</dd></div>
          ))}
        </dl>
      </div>
    </>
  );
}

/**
 * La fiche d'une discipline.
 *
 * ┌─ CE QU'ELLE REMPLACE ─────────────────────────────────────────────┐
 * │ Choisir un sport n'ouvrait qu'un formulaire : date, durée,        │
 * │ ressenti. On enregistrait une discipline sans jamais rien         │
 * │ apprendre d'elle.                                                 │
 * │                                                                    │
 * │ Quatre choses maintenant, dans cet ordre : ce qu'elle SOLLICITE,  │
 * │ ce qu'elle EXIGE quand c'est documenté, ce que TU y as fait, et   │
 * │ seulement ensuite de quoi enregistrer. L'enregistrement est la    │
 * │ fin du parcours, pas son début.                                   │
 * └────────────────────────────────────────────────────────────────────┘
 */

const dateCourte = (iso) => (iso
  ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })
  : '—');

export default function DisciplineSheet({ sportKey, onClose, onLog }) {
  const [fiche, setFiche] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [vue, setVue] = useState(null);

  useEffect(() => {
    setFiche(null);
    api.sport(sportKey)
      .then((d) => {
        setFiche(d);
        // La vue qui montre le plus de muscles sollicités : ouvrir de
        // face sur une discipline de tirage cacherait l'essentiel.
        // Un seul argument, et le PREMIER muscle prime : les principaux
        // d'abord, les secondaires seulement pour départager.
        setVue(bestViewFor([...(d.muscles?.primary ?? []), ...(d.muscles?.secondary ?? [])]));
      })
      .catch((e) => setErreur(e.message));
  }, [sportKey]);

  if (erreur) return <div className="error-banner">{erreur}</div>;
  if (!fiche) return <p className="empty">Chargement…</p>;

  const h = fiche.historique;
  const jamais = h.seances === 0;

  return (
    <div className="grid">
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="stat-label">{fiche.category_meta?.label ?? fiche.category}</div>
            <h2 className="card-title" style={{ margin: '4px 0 0' }}>{fiche.label}</h2>
            {fiche.note && <p className="card-sub" style={{ margin: '4px 0 0' }}>{fiche.note}</p>}
          </div>
          <button type="button" className="btn-ghost" onClick={onClose}>Fermer</button>
        </div>

        <div className="stat-row" style={{ marginTop: 14 }}>
          <div className="stat">
            <div className="stat-label">Coût énergétique</div>
            <div className="stat-value">{fiche.met} <span className="stat-unit">MET</span></div>
          </div>
          <div className="stat">
            <div className="stat-label">Intensité typique</div>
            <div className="stat-value">{fiche.rpe} <span className="stat-unit">/ 10</span></div>
          </div>
          <div className="stat">
            <div className="stat-label">Ce qui se mesure</div>
            <div className="stat-value" style={{ fontSize: 15, paddingTop: 6 }}>
              {fiche.metrics?.length ? fiche.metrics.join(', ') : 'durée seule'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary" onClick={() => onLog(fiche)}>
            Enregistrer une séance
          </button>
        </div>
      </div>

      {fiche.manuel && <Manuel m={fiche.manuel} />}

      {/* ── Ce qu'elle sollicite ──────────────────────────────────── */}
      <div className="card">
        <h2 className="card-title">Ce que ça sollicite</h2>
        <p className="card-sub">
          Le rouge marque le travail principal, le rosé le travail secondaire.
        </p>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <BodyFigure
            view={vue ?? 'front'}
            maxWidth={210}
            paint={(keys) => {
              const p = fiche.muscles?.primary ?? [];
              const s = fiche.muscles?.secondary ?? [];
              if (keys.some((k) => p.includes(k))) return { fill: 'var(--muscle-deep)' };
              if (keys.some((k) => s.includes(k))) return { fill: 'var(--muscle)', opacity: 0.55 };
              return { fill: 'var(--muscle-off)' };
            }}
            ariaLabel={`Muscles sollicités par ${fiche.label}`}
          />
          <div style={{ flex: '1 1 220px' }}>
            <div className="stat-label">Principaux</div>
            <p style={{ fontSize: 13, margin: '4px 0 12px' }}>
              {(fiche.muscles?.primary ?? []).join(' · ') || '—'}
            </p>
            <div className="stat-label">Secondaires</div>
            <p style={{ fontSize: 13, margin: '4px 0 0', color: 'var(--text-secondary)' }}>
              {(fiche.muscles?.secondary ?? []).join(' · ') || '—'}
            </p>
            <div className="tabs" style={{ marginTop: 14 }}>
              <button
                type="button" className="tab" aria-selected={vue === 'front'}
                onClick={() => setVue('front')}
              >Face</button>
              <button
                type="button" className="tab" aria-selected={vue === 'back'}
                onClick={() => setVue('back')}
              >Dos</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Ce qu'elle exige ──────────────────────────────────────── */}
      {fiche.profil ? (
        <div className="card">
          <h2 className="card-title">Ce que ça exige</h2>
          <p className="card-sub">
            Les qualités qui décident vraiment dans cette discipline, et d’où ça vient.
          </p>

          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            {Object.entries(fiche.profil.exigences)
              .sort((a, b) => b[1] - a[1])
              .map(([cle, poids]) => {
                const p = fiche.profil.priorites.find((x) => x.quality === cle);
                return (
                  <div key={cle}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: 13, marginBottom: 4,
                    }}>
                      <span>{p?.label ?? cle}</span>
                      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{poids}/10</strong>
                    </div>
                    <div className="gauge" style={{ height: 8 }}>
                      <div
                        className="gauge-fill"
                        style={{
                          width: `${poids * 10}%`,
                          background: poids >= 7 ? 'var(--brand)' : 'var(--axis)',
                        }}
                      />
                    </div>
                    {p && (
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                        {p.travail}
                      </p>
                    )}
                  </div>
                );
              })}
          </div>

          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--grid)' }}>
            <div className="stat-label" style={{ marginBottom: 8 }}>D’où ça vient</div>
            {fiche.profil.sources.map((s) => (
              <p key={s.cle} style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 8px' }}>
                <strong style={{ color: 'var(--text-secondary)' }}>{s.texte}</strong>
                {s.dit && <><br />{s.dit}</>}
              </p>
            ))}
          </div>
        </div>
      ) : (
        <div className="card">
          <h2 className="card-title">Ce que ça exige</h2>
          {/* Dire qu'on ne sait pas vaut mieux qu'un profil plausible :
              une jauge inventée a exactement l'air d'une jauge sourcée. */}
          <p className="empty">
            Le profil d’exigence de cette discipline n’est pas encore documenté.
            Il le sera quand il pourra s’appuyer sur des sources, pas avant.
          </p>
        </div>
      )}

      {fiche.detail && <Detail d={fiche.detail} />}

      {/* ── Ce que tu y as fait ───────────────────────────────────── */}
      <div className="card">
        <h2 className="card-title">Ce que tu y as fait</h2>
        {jamais ? (
          <p className="empty">Aucune séance enregistrée dans cette discipline.</p>
        ) : (
          <>
            <div className="stat-row" style={{ marginTop: 10 }}>
              <div className="stat">
                <div className="stat-label">Séances</div>
                <div className="stat-value">{h.seances}</div>
              </div>
              <div className="stat">
                <div className="stat-label">Temps total</div>
                <div className="stat-value">
                  {Math.round(h.minutes / 60)} <span className="stat-unit">h</span>
                </div>
              </div>
              <div className="stat">
                <div className="stat-label">Intensité moyenne</div>
                <div className="stat-value">
                  {h.rpe_moyen ?? '—'} <span className="stat-unit">/ 10</span>
                </div>
              </div>
              <div className="stat">
                <div className="stat-label">Dernière fois</div>
                <div className="stat-value" style={{ fontSize: 15, paddingTop: 6 }}>
                  {dateCourte(h.derniere)}
                </div>
              </div>
            </div>

            {h.par_semaine?.length > 0 && (
              <>
                <div className="stat-label" style={{ marginTop: 18, marginBottom: 8 }}>
                  Charge, douze dernières semaines
                </div>
                <div className="disc-barres">
                  {(() => {
                    const max = Math.max(...h.par_semaine.map((w) => w.charge), 1);
                    return h.par_semaine.map((w) => (
                      <div className="disc-barre" key={w.semaine} title={`${w.semaine} · ${w.charge}`}>
                        <div
                          className="disc-barre-fill"
                          style={{ height: `${Math.max(4, (w.charge / max) * 100)}%` }}
                        />
                      </div>
                    ));
                  })()}
                </div>
              </>
            )}

            {h.recentes?.length > 0 && (
              <table className="data-table" style={{ marginTop: 16 }}>
                <caption className="visually-hidden">Séances récentes</caption>
                <thead>
                  <tr><th scope="col">Date</th><th scope="col">Durée</th><th scope="col">RPE</th></tr>
                </thead>
                <tbody>
                  {h.recentes.map((s) => (
                    <tr key={s.id}>
                      <th scope="row" style={{ fontWeight: 500 }}>{dateCourte(s.started_at)}</th>
                      <td>
                        {s.ended_at
                          ? `${Math.round((new Date(s.ended_at) - new Date(s.started_at)) / 60000)} min`
                          : '—'}
                      </td>
                      <td>{s.perceived_exertion ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
