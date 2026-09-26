/**
 * Karaté Shotokan — le syllabus, en données pures.
 *
 * ┌─ D'OÙ VIENT CE CONTENU, ET CE QU'IL N'EST PAS ────────────────────┐
 * │ Rien ici n'est inventé. Trois choses sont publiques et stables :  │
 * │                                                                    │
 * │  · la NOMENCLATURE des techniques (oi-zuki, mae-geri, age-uke…),  │
 * │    normalisée et identique dans tout le Shotokan ;                │
 * │  · la progression du KUMITÉ — gohon, sanbon, kihon ippon, jiyu    │
 * │    ippon, jiyu — qui est l'ossature pédagogique de la JKA ;       │
 * │  · l'ordre des KATA, canonique : les cinq Heian, puis Tekki       │
 * │    Shodan, Bassai Dai, Kanku Dai.                                 │
 * │                                                                    │
 * │ CE QUI VARIE : le grade exact auquel chaque élément est exigé     │
 * │ change d'une fédération et même d'un dojo à l'autre. Le découpage │
 * │ ci-dessous suit un syllabus de type JKA ; il est DÉCLARATIF et se │
 * │ corrige, parce qu'un dojo réel fait autorité contre ce fichier.   │
 * │                                                                    │
 * │ CE QUE CE FICHIER N'EST PAS : un professeur. Il liste ce qu'il y  │
 * │ a à travailler et permet d'en suivre l'état. Les points           │
 * │ d'exécution sont des repères pour s'auto-observer, pas une        │
 * │ méthode d'apprentissage — une technique de combat se corrige par  │
 * │ un œil extérieur, et aucun texte ne remplace cela.                │
 * └────────────────────────────────────────────────────────────────────┘
 */

/** Les trois piliers. Ce découpage est celui de toutes les écoles. */
export const PILIERS = {
  kihon: {
    label: 'Kihon',
    gloss: 'Les bases, exécutées seul et à vide',
    role: 'Construire le geste juste avant de l’appliquer.',
  },
  kata: {
    label: 'Kata',
    gloss: 'Formes codifiées contre des adversaires imaginaires',
    role: 'Enchaîner, se déplacer, et garder la forme sous la fatigue.',
  },
  kumite: {
    label: 'Kumité',
    gloss: 'Le travail à deux, du plus conventionnel au libre',
    role: 'Confronter le geste à la distance et au temps d’un autre.',
  },
};

/**
 * Techniques, par famille.
 *
 * `cles` : des points d'observation, pas un enseignement. Ils viennent
 * de ce que la biomécanique du karaté a de documenté — le rôle du
 * hikite et de la rotation du bassin dans la production de force
 * (VencesBrito et al. 2011, EMG du choku-zuki), l'appui au sol comme
 * origine de la chaîne (Zehr & Sale 1994).
 */
export const TECHNIQUES = {
  // ── Zuki : les poings ────────────────────────────────────────────
  'choku-zuki': {
    famille: 'zuki', label: 'Choku-zuki', gloss: 'Coup de poing direct, sur place',
    cles: ['Hikite : le poing arrière revient à la hanche au même instant',
           'Rotation de l’avant-bras en fin de course, pas au départ'],
  },
  'oi-zuki': {
    famille: 'zuki', label: 'Oi-zuki', gloss: 'Poing direct en avançant',
    cles: ['Le poing arrive AVEC le pied, ni avant ni après',
           'Le bassin finit de face (shomen)'],
  },
  'gyaku-zuki': {
    famille: 'zuki', label: 'Gyaku-zuki', gloss: 'Poing inversé, bras opposé à la jambe avant',
    cles: ['La rotation du bassin précède le bras',
           'Appui du pied arrière au sol : c’est là que naît la force'],
  },
  'kizami-zuki': {
    famille: 'zuki', label: 'Kizami-zuki', gloss: 'Poing avant, direct et court',
    cles: ['Vitesse plutôt que masse : c’est une prise d’initiative',
           'Épaule avant qui ne se soulève pas'],
  },
  'ura-zuki': {
    famille: 'zuki', label: 'Ura-zuki', gloss: 'Poing court, paume vers le haut',
    cles: ['Distance courte assumée : le coude reste près du corps'],
  },

  // ── Uchi : les frappes ───────────────────────────────────────────
  'uraken-uchi': {
    famille: 'uchi', label: 'Uraken-uchi', gloss: 'Frappe du revers du poing',
    cles: ['Le coude est le pivot : l’avant-bras fouette'],
  },
  'shuto-uchi': {
    famille: 'uchi', label: 'Shuto-uchi', gloss: 'Frappe du tranchant de la main',
    cles: ['Main ferme, doigts serrés : le tranchant est une arme, pas une claque'],
  },
  'empi-uchi': {
    famille: 'uchi', label: 'Empi-uchi', gloss: 'Frappe du coude',
    cles: ['Arme de distance courte : la hanche fait le travail'],
  },

  // ── Uke : les parades ────────────────────────────────────────────
  'age-uke': {
    famille: 'uke', label: 'Age-uke', gloss: 'Parade montante',
    cles: ['L’avant-bras dévie, il ne bloque pas de face',
           'Le front reste dégagé : la parade finit au-dessus, pas devant'],
  },
  'soto-uke': {
    famille: 'uke', label: 'Soto-uke', gloss: 'Parade de l’extérieur vers l’intérieur',
    cles: ['Le coude reste plié à angle droit'],
  },
  'uchi-uke': {
    famille: 'uke', label: 'Uchi-uke', gloss: 'Parade de l’intérieur vers l’extérieur',
    cles: ['Part du côté opposé : le trajet fait la déviation'],
  },
  'gedan-barai': {
    famille: 'uke', label: 'Gedan-barai', gloss: 'Balayage bas',
    cles: ['Balaye vers le bas et le dehors, sans se pencher'],
  },
  'shuto-uke': {
    famille: 'uke', label: 'Shuto-uke', gloss: 'Parade du tranchant de la main',
    cles: ['S’exécute en kokutsu-dachi : le poids part en arrière'],
  },

  // ── Geri : les pieds ─────────────────────────────────────────────
  'mae-geri': {
    famille: 'geri', label: 'Mae-geri', gloss: 'Coup de pied de face',
    cles: ['Genou haut d’abord, extension ensuite, et on REVIENT par le genou',
           'Frappe du hiza ou du koshi selon la cible'],
  },
  'mawashi-geri': {
    famille: 'geri', label: 'Mawashi-geri', gloss: 'Coup de pied circulaire',
    cles: ['La hanche pivote : sans elle, le pied arrive sans rien derrière',
           'Le pied d’appui tourne, sinon le genou encaisse la torsion'],
  },
  'yoko-geri-keage': {
    famille: 'geri', label: 'Yoko-geri keage', gloss: 'Coup de pied latéral fouetté',
    cles: ['Fouetté, donc rapide et rappelé'],
  },
  'yoko-geri-kekomi': {
    famille: 'geri', label: 'Yoko-geri kekomi', gloss: 'Coup de pied latéral pénétrant',
    cles: ['Poussé, donc appuyé : le tranchant du pied entre'],
  },
  'ushiro-geri': {
    famille: 'geri', label: 'Ushiro-geri', gloss: 'Coup de pied arrière',
    cles: ['Le regard cherche la cible avant que le pied parte'],
  },
  'ashi-barai': {
    famille: 'geri', label: 'Ashi-barai', gloss: 'Balayage de jambe',
    cles: ['Se place sur le temps où l’appui adverse se charge'],
  },
};

/**
 * Les kata, dans l'ordre canonique du Shotokan.
 *
 * ┌─ CE QUI A ÉTÉ RETIRÉ, ET POURQUOI ────────────────────────────────┐
 * │ Chaque kata portait un nombre de mouvements — « Heian Shodan, 21 »│
 * │ — présenté comme une donnée factuelle. Vérification faite, ces    │
 * │ décomptes ne sont pas attestés par une source fiable, et pour une │
 * │ raison de fond : ils dépendent de la CONVENTION DE COMPTAGE, qui  │
 * │ varie d'une école à l'autre (deux gestes liés comptent pour un    │
 * │ chez les uns, deux chez les autres).                              │
 * │                                                                    │
 * │ Un nombre faux a l'air exactement aussi sérieux qu'un nombre      │
 * │ juste. Il est parti.                                              │
 * └────────────────────────────────────────────────────────────────────┘
 */
export const KATA = [
  { key: 'taikyoku-shodan', label: 'Taikyoku Shodan', theme: 'Le déplacement en H, gedan-barai et oi-zuki' },
  { key: 'heian-shodan', label: 'Heian Shodan', theme: 'Parades basses et montantes, premier shuto-uke' },
  { key: 'heian-nidan', label: 'Heian Nidan', theme: 'Kokutsu-dachi, yoko-geri keage' },
  { key: 'heian-sandan', label: 'Heian Sandan', theme: 'Kiba-dachi, travail de coude, changement de niveau' },
  { key: 'heian-yondan', label: 'Heian Yondan', theme: 'Enchaînements longs, mawashi-geri, saut' },
  { key: 'heian-godan', label: 'Heian Godan', theme: 'Saut, mikazuki-geri, changements de rythme' },
  { key: 'tekki-shodan', label: 'Tekki Shodan', theme: 'Entièrement en kiba-dachi : le travail de hanche latéral' },
  { key: 'bassai-dai', label: 'Bassai Dai', theme: 'Puissance et renversement de situation' },
  { key: 'kanku-dai', label: 'Kanku Dai', theme: 'Le plus long des kata fondamentaux' },
];

/**
 * Le kumité, du plus conventionnel au libre.
 *
 * C'est l'ossature pédagogique de la JKA : on ne passe au suivant que
 * lorsque le précédent est fluide. L'ordre n'est pas négociable — le
 * jiyu kumite sans les étapes conventionnelles produit de l'agitation,
 * pas de la technique.
 */
export const KUMITE = [
  { key: 'gohon', label: 'Gohon kumite', gloss: 'Cinq attaques annoncées, cinq parades, contre-attaque finale',
    role: 'Apprendre la distance et le timing sans surprise.' },
  { key: 'sanbon', label: 'Sanbon kumite', gloss: 'Trois attaques annoncées',
    role: 'Même travail, resserré.' },
  { key: 'kihon-ippon', label: 'Kihon ippon kumite', gloss: 'Une attaque annoncée, niveau et technique désignés',
    role: 'Le contre devient immédiat.' },
  { key: 'jiyu-ippon', label: 'Jiyu ippon kumite', gloss: 'Une attaque annoncée, mais en garde libre et en déplacement',
    role: 'Introduire le mouvement et la garde réelle.' },
  { key: 'jiyu', label: 'Jiyu kumite', gloss: 'Combat libre',
    role: 'Tout ce qui précède, sans annonce.' },
];

/**
 * Les grades, du 9e kyu au 1er kyu.
 *
 * ⚠ Le rattachement d'un élément à un grade VARIE selon la fédération
 * et le dojo. Ce découpage suit un syllabus de type JKA et sert de
 * point de départ : il est fait pour être corrigé par ce que demande
 * réellement ton professeur.
 */
export const GRADES = [
  { kyu: 9, ceinture: 'blanche', techniques: ['choku-zuki', 'oi-zuki', 'gedan-barai', 'age-uke', 'mae-geri'],
    kata: ['taikyoku-shodan'], kumite: [] },
  { kyu: 8, ceinture: 'jaune', techniques: ['gyaku-zuki', 'soto-uke'],
    kata: ['heian-shodan'], kumite: ['gohon'] },
  { kyu: 7, ceinture: 'orange', techniques: ['uchi-uke', 'shuto-uke', 'yoko-geri-keage'],
    kata: ['heian-nidan'], kumite: ['gohon'] },
  { kyu: 6, ceinture: 'verte', techniques: ['yoko-geri-kekomi', 'empi-uchi'],
    kata: ['heian-sandan'], kumite: ['sanbon'] },
  { kyu: 5, ceinture: 'bleue', techniques: ['mawashi-geri', 'kizami-zuki'],
    kata: ['heian-yondan'], kumite: ['kihon-ippon'] },
  { kyu: 4, ceinture: 'violette', techniques: ['uraken-uchi', 'ashi-barai'],
    kata: ['heian-godan'], kumite: ['kihon-ippon'] },
  { kyu: 3, ceinture: 'marron', techniques: ['ushiro-geri'],
    kata: ['tekki-shodan'], kumite: ['jiyu-ippon'] },
  { kyu: 2, ceinture: 'marron', techniques: ['shuto-uchi', 'ura-zuki'],
    kata: ['bassai-dai'], kumite: ['jiyu-ippon'] },
  { kyu: 1, ceinture: 'marron', techniques: [],
    kata: ['kanku-dai'], kumite: ['jiyu'] },
];

/** Tout ce qu'un grade exige, ses prédécesseurs compris. */
export function programmeDuGrade(kyu) {
  const concernes = GRADES.filter((g) => g.kyu >= kyu);
  const unique = (xs) => [...new Set(xs)];
  return {
    kyu,
    ceinture: GRADES.find((g) => g.kyu === kyu)?.ceinture ?? null,
    techniques: unique(concernes.flatMap((g) => g.techniques)),
    kata: unique(concernes.flatMap((g) => g.kata)),
    // Le kumité ne s'empile pas : on travaille la forme du grade, pas
    // les cinq à la fois. On garde donc la PLUS AVANCÉE atteinte.
    kumite: (() => {
      const ordre = KUMITE.map((k) => k.key);
      const atteints = unique(concernes.flatMap((g) => g.kumite));
      return atteints.sort((a, b) => ordre.indexOf(b) - ordre.indexOf(a))[0] ?? null;
    })(),
  };
}

/** Ce que le grade SUIVANT ajoute — la seule chose qui reste à apprendre. */
export function prochainGrade(kyu) {
  const suivant = GRADES.find((g) => g.kyu === kyu - 1);
  if (!suivant) return null;
  return {
    kyu: suivant.kyu,
    ceinture: suivant.ceinture,
    techniques: suivant.techniques,
    kata: suivant.kata,
    kumite: suivant.kumite,
  };
}

/** Les références sur lesquelles ce fichier s'appuie. */
export const SOURCES = [
  { cle: 'jka-syllabus', texte: 'Progression kihon / kata / kumité de type JKA (syllabus publiés par les fédérations). Le rattachement d’un élément à un grade varie selon le dojo.' },
  { cle: 'vencesbrito-2011', texte: 'VencesBrito et al. (2011), activité EMG et cinématique du choku-zuki — rôle du hikite et de la rotation segmentaire.' },
  { cle: 'zehr-sale-1994', texte: 'Zehr & Sale (1994), Sports Medicine — production de force en arts martiaux : la chaîne part de l’appui au sol.' },
  { cle: 'wkf-rules', texte: 'Règlement de compétition WKF — durées de combat, catégories, techniques marquantes.' },
];
