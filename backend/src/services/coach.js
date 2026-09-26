import { disciplineOf, prioritesPhysiques, semaineType, QUALITES } from './disciplines.js';
import { prochainGrade, programmeDuGrade, KATA, KUMITE, TECHNIQUES } from './karate-syllabus.js';

/**
 * Le coach — déterministe, et qui rend des comptes.
 *
 * ┌─ CE QU'IL EST, ET POURQUOI IL EST FAIT AINSI ─────────────────────┐
 * │ Une fonction pure : mêmes entrées, même sortie. Pas de modèle de  │
 * │ langage, pas de tirage au sort, pas d'appel réseau.               │
 * │                                                                    │
 * │ C'est un choix de fond. Une décision qui porte sur l'entraînement │
 * │ et la fatigue de quelqu'un doit pouvoir être REJOUÉE et           │
 * │ CONTESTÉE : on doit pouvoir demander « pourquoi ça, aujourd'hui » │
 * │ et obtenir la règle, le chiffre et la source. Un texte engendré   │
 * │ au fil de l'eau ne permet ni l'un ni l'autre, et se trompe avec   │
 * │ la même assurance qu'il a raison.                                 │
 * │                                                                    │
 * │ Chaque recommandation porte donc ses `raisons`, et chaque raison  │
 * │ porte sa source quand elle en a une.                              │
 * └────────────────────────────────────────────────────────────────────┘
 */

/**
 * Seuils de sécurité, repris de ce que la charge d'entraînement a de
 * mieux établi. Ils PRIMENT sur le plan : un plan qui ignore la
 * fatigue accumulée n'est plus un plan, c'est un calendrier.
 */
/**
 * Seuils de DISPONIBILITÉ, lue depuis les objets connectés.
 *
 * ┌─ POURQUOI CE CHAÎNON MANQUAIT ────────────────────────────────────┐
 * │ Le score de disponibilité — sommeil, VFC rapportée à la ligne de  │
 * │ base personnelle, fréquence au repos, hydratation — était calculé │
 * │ et affiché depuis longtemps. Aucune décision ne s'en servait.     │
 * │                                                                    │
 * │ Les données du téléphone arrivaient donc jusqu'à un chiffre, et   │
 * │ s'arrêtaient là. C'est ce chaînon qui rend l'entraînement         │
 * │ réellement adaptatif : mal dormi trois nuits, la séance change.   │
 * └────────────────────────────────────────────────────────────────────┘
 *
 * Les bornes sont volontairement larges. Un score de disponibilité est
 * une estimation bruitée : découper finement donnerait une précision
 * que la mesure n'a pas.
 */
export const DISPONIBILITE = {
  /** En dessous, le corps signale qu'il n'a pas récupéré. */
  basse: 45,
  /** Au-dessus, on peut appuyer sans réserve. */
  haute: 75,
};

export const SEUILS = {
  /** Au-delà, la charge récente dépasse trop ce à quoi le corps est préparé. */
  acwrHaut: 1.5,
  /** En deçà, on a perdu du terrain : on peut relancer. */
  acwrBas: 0.8,
  /** Monotonie : au-delà, toutes les séances se ressemblent trop. */
  monotonieHaute: 2.0,
  /** Heures de repos minimales entre deux séances explosives. */
  reposPuissanceH: 48,
};

/** Les natures de séance que le coach sait prescrire. */
export const NATURES = {
  technique: { label: 'Technique', minutes: 60 },
  physique: { label: 'Préparation physique', minutes: 45 },
  souplesse: { label: 'Souplesse et mobilité', minutes: 30 },
  recuperation: { label: 'Récupération active', minutes: 25 },
  repos: { label: 'Repos', minutes: 0 },
};

const heuresDepuis = (iso, maintenant) => (iso == null
  ? Infinity
  : (maintenant.getTime() - new Date(iso).getTime()) / 3_600_000);

/**
 * Que faire aujourd'hui.
 *
 * @param {object} p
 * @param {string} p.discipline         clé de discipline (« karate »)
 * @param {number} p.kyu                grade actuel
 * @param {number} p.seancesParSemaine  ce à quoi la personne s'engage
 * @param {object} p.charge             { acwr, monotonie } — peuvent être null
 * @param {object} p.derniere           { technique, physique, souplesse } en ISO
 * @param {object} p.faitCetteSemaine   { technique: 2, physique: 1, … }
 * @param {string[]} p.acquis           clés de techniques/kata déjà tenues
 * @param {Date} p.maintenant
 */
/**
 * Les mises en garde que la charge inspire, sans rien décider.
 *
 * Séparées de la décision : c'est ce qui permet de les attacher à une
 * séance DÉJÀ PRÉVUE sans la remplacer.
 */
export function alertesDeCharge({ acwr = null, monotonie = null, disponibilite = null } = {}) {
  const alertes = [];
  if (disponibilite != null && disponibilite < DISPONIBILITE.basse) {
    alertes.push({
      gravite: 'haute',
      texte: `Disponibilité à ${Math.round(disponibilite)}/100 — sommeil, VFC et fréquence au repos vont dans le même sens. Ton corps n’a pas fini de récupérer.`,
      source: 'readiness',
    });
  }
  if (acwr != null && acwr > SEUILS.acwrHaut) {
    alertes.push({
      gravite: 'haute',
      texte: `Ta charge récente vaut ${acwr.toFixed(2)} fois ce à quoi tu es préparé. Au-delà de ${SEUILS.acwrHaut}, le risque de blessure augmente nettement.`,
      source: 'gabbett-2016',
    });
  }
  if (monotonie != null && monotonie > SEUILS.monotonieHaute) {
    alertes.push({
      gravite: 'moyenne',
      texte: `Monotonie à ${monotonie.toFixed(2)} : tes séances se ressemblent trop. C’est la régularité SANS variation qui fatigue, pas le volume.`,
      source: 'foster-1998',
    });
  }
  return alertes;
}

export function seanceDuJour({
  discipline, kyu = 9, seancesParSemaine = 3,
  charge = {}, derniere = {}, faitCetteSemaine = {}, acquis = [],
  prevu = null,
  maintenant = new Date(),
} = {}) {
  const raisons = [];
  const { acwr = null, monotonie = null, disponibilite = null } = charge;
  const alertes = alertesDeCharge(charge);

  // ┌─ 0. CE QUI EST PRÉVU PASSE AVANT CE QUE JE PROPOSERAIS ────────┐
  // │ Si une séance est au programme aujourd'hui, c'est ELLE la      │
  // │ séance du jour. Le coach n'a pas à la remplacer par son idée : │
  // │ un programme qu'on suit vaut mieux qu'un programme parfait     │
  // │ qu'on abandonne parce qu'il change tous les jours.             │
  // │                                                                 │
  // │ La charge continue de parler, mais en AVERTISSANT : elle donne │
  // │ de quoi décider de repousser, elle ne repousse pas à la place. │
  // └─────────────────────────────────────────────────────────────────┘
  if (prevu) {
    raisons.push({
      texte: prevu.origine === 'programme'
        ? 'Cette séance est à ton programme aujourd’hui.'
        : 'Tu avais prévu cette séance aujourd’hui.',
      source: null,
    });
    return {
      nature: 'prevue',
      label: prevu.titre,
      minutes: prevu.minutes ?? null,
      source_plan: prevu.origine ?? 'programme',
      program_day_id: prevu.program_day_id ?? null,
      contenu: prevu.contenu ?? null,
      raisons,
      alertes,
      propose: false,
      prioritaire: false,
    };
  }

  const d = disciplineOf(discipline);
  if (!d) {
    // Rien de prévu, et aucun objectif de discipline : il n'y a rien à
    // proposer, et le dire vaut mieux qu'inventer une séance.
    return null;
  }

  // ── 1. Sans plan du jour, la fatigue prime ──────────────────────
  if (alertes.some((a) => a.gravite === 'haute')) {
    raisons.push(alertes.find((a) => a.gravite === 'haute'));
    return { ...NATURES.recuperation, nature: 'recuperation', contenu: contenuRecuperation(d), raisons, alertes, propose: true, prioritaire: true };
  }

  if (alertes.some((a) => a.gravite === 'moyenne')) {
    raisons.push(alertes.find((a) => a.gravite === 'moyenne'));
    return { ...NATURES.souplesse, nature: 'souplesse', contenu: contenuSouplesse(d), raisons, alertes, propose: true, prioritaire: true };
  }

  // ── 2. Ce que la semaine prévoit, et ce qu'il en reste ──────────
  const plan = semaineType(discipline, seancesParSemaine) ?? {};
  const restant = Object.fromEntries(
    Object.entries(plan).map(([k, n]) => [k, n - (faitCetteSemaine[k] ?? 0)]),
  );

  // ── 3. Le repos neuromusculaire, qui interdit certains choix ────
  const depuisPhysique = heuresDepuis(derniere.physique, maintenant);
  const physiqueInterdit = depuisPhysique < SEUILS.reposPuissanceH;
  if (physiqueInterdit && (restant.physique ?? 0) > 0) {
    raisons.push({
      texte: `Dernière séance physique il y a ${Math.round(depuisPhysique)} h. Le travail explosif demande environ ${SEUILS.reposPuissanceH} h pour que le système nerveux récupère.`,
      source: 'zehr-sale-1994',
    });
  }

  // ── 4. Le choix ─────────────────────────────────────────────────
  const candidats = Object.entries(restant)
    .filter(([nature, reste]) => reste > 0 && !(nature === 'physique' && physiqueInterdit))
    .sort((a, b) => {
      // Ce qui manque le plus passe devant ; à égalité, ce qu'on n'a
      // pas fait depuis le plus longtemps.
      if (b[1] !== a[1]) return b[1] - a[1];
      return heuresDepuis(derniere[b[0]], maintenant) - heuresDepuis(derniere[a[0]], maintenant);
    });

  if (candidats.length === 0) {
    raisons.push({
      texte: 'Tu as fait tout ce que la semaine prévoyait. Le repos fait partie du plan — c’est pendant lui que l’adaptation se produit.',
      source: null,
    });
    return { ...NATURES.repos, nature: 'repos', contenu: null, raisons, alertes, propose: true, prioritaire: false };
  }

  const [nature] = candidats[0];

  if (disponibilite != null && disponibilite >= DISPONIBILITE.haute) {
    raisons.push({
      texte: `Disponibilité à ${Math.round(disponibilite)}/100 : tu es frais, tu peux appuyer.`,
      source: 'readiness',
    });
  }

  if (acwr != null && acwr < SEUILS.acwrBas) {
    raisons.push({
      texte: `Ta charge récente est à ${acwr.toFixed(2)} de ta charge habituelle : tu as de la marge pour appuyer.`,
      source: 'gabbett-2016',
    });
  }

  raisons.push({
    texte: `La semaine prévoit ${plan[nature]} séance${plan[nature] > 1 ? 's' : ''} de ${NATURES[nature].label.toLowerCase()} ; il t’en reste ${restant[nature]}.`,
    source: null,
  });

  const contenu = nature === 'technique' ? contenuTechnique(d, kyu, acquis)
    : nature === 'physique' ? contenuPhysique(d, raisons)
      : contenuSouplesse(d);

  return { ...NATURES[nature], nature, contenu, raisons, alertes, propose: true, prioritaire: false };
}

/* ─── Le contenu des séances ──────────────────────────────────────── */

/**
 * Séance technique : ce que le grade suivant exige et qui n'est pas
 * encore tenu.
 *
 * On ne propose PAS tout ce qui reste : une séance qui liste douze
 * techniques n'en fait travailler aucune. Trois éléments, et le kata
 * du grade visé.
 */
function contenuTechnique(d, kyu, acquis) {
  if (d.syllabus !== 'karate') return null;
  const vise = prochainGrade(kyu);
  const courant = programmeDuGrade(kyu);
  const dejaVu = new Set(acquis);

  const aTravailler = (vise?.techniques ?? [])
    .concat(courant.techniques)
    .filter((t) => !dejaVu.has(t))
    .slice(0, 3);

  const kataVise = (vise?.kata ?? []).find((k) => !dejaVu.has(k))
    ?? courant.kata[courant.kata.length - 1]
    ?? null;

  const formeKumite = vise?.kumite?.[0] ?? courant.kumite;

  return {
    blocs: [
      { label: 'Échauffement', minutes: 10, detail: 'Mobilité de hanche et d’épaule, montée progressive.' },
      {
        label: 'Kihon',
        minutes: 20,
        detail: aTravailler.length
          ? aTravailler.map((t) => TECHNIQUES[t]?.label ?? t).join(' · ')
          : 'Révision libre des bases du grade.',
        cles: aTravailler.flatMap((t) => TECHNIQUES[t]?.cles ?? []),
      },
      {
        label: 'Kata',
        minutes: 20,
        detail: KATA.find((k) => k.key === kataVise)?.label ?? '—',
        note: KATA.find((k) => k.key === kataVise)?.theme ?? null,
      },
      {
        label: 'Kumité',
        minutes: 10,
        detail: KUMITE.find((k) => k.key === formeKumite)?.label ?? '—',
        note: KUMITE.find((k) => k.key === formeKumite)?.role ?? null,
      },
    ],
    // Dit une fois, à sa place : ce fichier liste ce qu'il y a à
    // travailler, il ne corrige pas un geste.
    avertissement: 'Les points d’exécution sont des repères pour t’auto-observer. Une technique se corrige avec un œil extérieur.',
  };
}

/** Séance physique : les qualités que la discipline réclame vraiment. */
function contenuPhysique(d, raisons) {
  const priorites = prioritesPhysiques(d.key);
  for (const p of priorites.slice(0, 2)) {
    raisons.push({
      texte: `${p.label} pèse ${p.poids}/10 pour cette discipline.`,
      source: d.sources[0],
    });
  }
  return {
    blocs: [
      { label: 'Échauffement', minutes: 8, detail: 'Montée en température, gammes.' },
      ...priorites.slice(0, 3).map((p) => ({
        label: p.label,
        minutes: Math.round(37 / Math.min(3, priorites.length)),
        detail: p.travail,
      })),
    ],
    avertissement: null,
  };
}

function contenuSouplesse(d) {
  return {
    blocs: [
      { label: 'Mobilité active', minutes: 15, detail: 'Amplitude sous contrôle, hanche et épaule en priorité.' },
      { label: 'Étirements tenus', minutes: 15, detail: 'Positions tenues, respiration lente.' },
    ],
    avertissement: null,
    pourquoi: QUALITES.mobilite.travail,
  };
}

function contenuRecuperation() {
  return {
    blocs: [
      { label: 'Activité très légère', minutes: 20, detail: 'Marche, vélo souple : faire circuler, pas fatiguer.' },
      { label: 'Mobilité douce', minutes: 5, detail: 'Amplitudes libres, sans forcer.' },
    ],
    avertissement: null,
  };
}

export const SOURCES_COACH = {
  readiness: 'Score de disponibilité — sommeil, variabilité de fréquence cardiaque rapportée à ta ligne de base, fréquence au repos et hydratation, lus depuis tes objets connectés.',
  'gabbett-2016': 'Gabbett T. (2016), British Journal of Sports Medicine — rapport charge aiguë / charge chronique et risque de blessure.',
  'foster-1998': 'Foster C. (1998), Medicine & Science in Sports & Exercise — monotonie et contrainte d’entraînement.',
  'zehr-sale-1994': 'Zehr & Sale (1994), Sports Medicine — récupération neuromusculaire après travail balistique.',
  'chaabene-2012': 'Chaabene H. et al. (2012), Sports Medicine — profil physiologique du karatéka.',
};
