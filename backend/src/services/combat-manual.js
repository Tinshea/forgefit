/**
 * Manuel des sports de combat — données pures.
 *
 * ┌─ CE QUE CE FICHIER CONTIENT, ET CE QU'IL ÉVITE ───────────────────┐
 * │ De quoi comprendre une discipline avant de la pratiquer : à quoi  │
 * │ elle sert, ce qui la distingue, son répertoire technique, ses     │
 * │ méthodes d'entraînement, et de quoi démarrer.                     │
 * │                                                                    │
 * │ PAS d'histoire, pas de folklore : ce n'est pas ce qui a été       │
 * │ demandé, et cela noierait le reste.                               │
 * │                                                                    │
 * │ Le champ `esprit` distingue explicitement ce qui est CODIFIÉ —    │
 * │ des principes écrits, attribuables, enseignés comme tels — de ce  │
 * │ qui n'est qu'une culture d'entraînement. La boxe anglaise n'a pas │
 * │ de doctrine ; le judo en a une, signée Kano. Les confondre        │
 * │ reviendrait à inventer une philosophie à une discipline qui n'en  │
 * │ revendique aucune.                                                │
 * │                                                                    │
 * │ Les `cles` sont des repères d'auto-observation, pas un            │
 * │ enseignement : une technique de combat se corrige avec un œil     │
 * │ extérieur, et aucun texte ne remplace un professeur.              │
 * └────────────────────────────────────────────────────────────────────┘
 */

export const MANUEL = {
  /* ═══ BOXE ANGLAISE ═══════════════════════════════════════════════ */
  boxe: {
    pourquoi: 'Apprendre à toucher sans être touché, avec deux armes seulement. '
      + 'La contrainte est extrême — pas de jambes, pas de saisies — et c’est '
      + 'précisément ce qui force un travail de déplacement et de distance que '
      + 'peu de disciplines poussent aussi loin.',
    forces: [
      { titre: 'Le déplacement', texte: 'Restreindre l’arsenal à deux poings oblige à tout résoudre par les appuis et la distance. C’est le meilleur apprentissage du placement qui existe.' },
      { titre: 'La lecture de l’adversaire', texte: 'Peu d’armes, donc peu d’inconnues : on apprend à lire les intentions plutôt qu’à parer des surprises.' },
      { titre: 'Le fond', texte: 'Le format en reprises construit une endurance qui se transfère à presque tout le reste.' },
    ],
    techniques: [
      {
        famille: 'Coups directs',
        items: [
          { nom: 'Jab', gloss: 'Direct du bras avant', cles: ['Part et revient par le même chemin', 'C’est un outil de mesure autant qu’un coup'] },
          { nom: 'Direct arrière', gloss: 'Cross', cles: ['La rotation vient du pied arrière, puis de la hanche', 'L’épaule avant protège le menton'] },
        ],
      },
      {
        famille: 'Coups circulaires',
        items: [
          { nom: 'Crochet', gloss: 'Hook', cles: ['Le coude reste à la hauteur du poing', 'C’est le corps qui tourne, pas le bras qui balaie'] },
          { nom: 'Uppercut', gloss: 'Remontant', cles: ['Fléchir d’abord les jambes, remonter ensuite', 'Arme de distance courte'] },
        ],
      },
      {
        famille: 'Défense',
        items: [
          { nom: 'Esquive rotative', gloss: 'Slip', cles: ['Déplacer la tête hors de l’axe, sans reculer'] },
          { nom: 'Esquive plongeante', gloss: 'Bob and weave', cles: ['Passer sous le coup circulaire, en gardant la garde'] },
          { nom: 'Blocage', gloss: 'Parry, block', cles: ['Dévier plutôt qu’arrêter'] },
          { nom: 'Sortie latérale', gloss: 'Pivot', cles: ['Sortir de la ligne au lieu de reculer en ligne droite'] },
        ],
      },
    ],
    methodes: [
      { nom: 'Shadow boxing', gloss: 'Travail à vide, devant un miroir', role: 'Construire le geste sans cible ni fatigue de frappe.' },
      { nom: 'Sac', gloss: 'Frappe sur sac lourd', role: 'Apprendre à transmettre dans une cible qui résiste.' },
      { nom: 'Pattes d’ours', gloss: 'Travail aux paos avec un partenaire', role: 'Réagir à une cible qui bouge et se ferme.' },
      { nom: 'Corde', gloss: 'Saut à la corde', role: 'Coordination et appuis — c’est un travail de pieds, pas du cardio.' },
      { nom: 'Sparring léger', gloss: 'Opposition à intensité réduite, protections complètes', role: 'Confronter le geste à quelqu’un qui a un avis.' },
    ],
    esprit: {
      codifie: false,
      texte: 'La boxe anglaise ne revendique aucune doctrine écrite. Ce qui s’y '
        + 'transmet est une culture de salle : l’humilité devant le travail, le '
        + 'respect du partenaire de sparring, et l’idée que la technique se paie '
        + 'en heures. Lui prêter une philosophie codifiée serait lui prêter ce '
        + 'qu’elle n’a jamais prétendu avoir.',
    },
    lecons: [
      'Reculer en ligne droite est la pire des réponses — on apprend à sortir de côté.',
      'La garde n’est pas une position, c’est une habitude qui doit survivre à la fatigue.',
      'On encaisse ce qu’on n’a pas vu partir : regarder est une compétence.',
    ],
    demarrer: {
      materiel: ['Bandes de 4,5 m', 'Gants 12 à 16 oz', 'Protège-dents dès le premier sparring'],
      premiere_seance: 'Attends-toi à une heure sans frapper personne : garde, '
        + 'déplacement, jab. La frustration de la première semaine est normale et '
        + 'fait partie de la méthode.',
      reperes: [
        'Trois séances par semaine suffisent largement la première année.',
        'Le sparring n’est pas un test de courage : refuser tant qu’on n’est pas prêt est la bonne décision.',
      ],
    },
    sources: ['slimani-2017', 'davis-2015'],
  },

  /* ═══ BOXE THAÏ ═══════════════════════════════════════════════════ */
  boxe_thai: {
    pourquoi: 'Huit armes — poings, pieds, genoux, coudes — plus le corps à corps. '
      + 'C’est la percussion la plus complète en pied-poing, et celle qui exige le '
      + 'plus d’amplitude articulaire.',
    forces: [
      { titre: 'L’arsenal complet', texte: 'Toutes les distances sont couvertes, de la longue allonge au clinch. Peu de disciplines de percussion en disent autant.' },
      { titre: 'Le clinch', texte: 'Un corps à corps debout codifié, qui manque à la plupart des autres boxes.' },
      { titre: 'La robustesse', texte: 'Le travail de tibias et d’encaissement construit une tolérance physique particulière.' },
    ],
    techniques: [
      {
        famille: 'Poings (chok)',
        items: [
          { nom: 'Jab', gloss: 'Direct avant' },
          { nom: 'Direct arrière', gloss: 'Cross' },
          { nom: 'Crochet', gloss: 'Hook' },
          { nom: 'Uppercut', gloss: 'Remontant' },
        ],
      },
      {
        famille: 'Pieds (te)',
        items: [
          { nom: 'Teep', gloss: 'Pied de face, repoussant', cles: ['C’est une arme de distance, pas de puissance', 'Le genou monte avant que la jambe ne pousse'] },
          { nom: 'Te tat', gloss: 'Coup de pied circulaire au corps', cles: ['La jambe frappe tendue, comme une batte', 'Le pied d’appui pivote complètement'] },
          { nom: 'Te kot', gloss: 'Circulaire bas, sur la cuisse', cles: ['Vise au-dessus du genou'] },
        ],
      },
      {
        famille: 'Genoux (khao)',
        items: [
          { nom: 'Khao trong', gloss: 'Genou direct', cles: ['La hanche pousse vers l’avant'] },
          { nom: 'Khao khong', gloss: 'Genou circulaire' },
        ],
      },
      {
        famille: 'Coudes (sok)',
        items: [
          { nom: 'Sok ti', gloss: 'Coude descendant' },
          { nom: 'Sok tat', gloss: 'Coude horizontal', cles: ['Arme de très courte distance, souvent interdite en loisir'] },
        ],
      },
      {
        famille: 'Clinch',
        items: [
          { nom: 'Double collier', gloss: 'Contrôle de la nuque à deux mains', cles: ['Les coudes se serrent, les avant-bras contrôlent'] },
          { nom: 'Déséquilibres', gloss: 'Tirer-pousser pour ouvrir une cible' },
        ],
      },
    ],
    methodes: [
      { nom: 'Shadow', gloss: 'Travail à vide', role: 'Coordonner quatre armes au lieu de deux.' },
      { nom: 'Paos', gloss: 'Boucliers tenus par un partenaire', role: 'La méthode centrale : le pao encaisse ce qu’un sac ne rend pas.' },
      { nom: 'Sac', gloss: 'Sac lourd et sac long', role: 'Répéter, notamment les coups de pied bas.' },
      { nom: 'Clinch', gloss: 'Travail spécifique de corps à corps', role: 'Se pratique à part : c’est une discipline dans la discipline.' },
      { nom: 'Conditionnement des tibias', gloss: 'Frappe progressive', role: 'Progressif, sur des années. Toute précipitation ici se paie en blessure.' },
    ],
    esprit: {
      codifie: true,
      texte: 'Le rituel du wai kru ram muay, exécuté avant le combat, est une '
        + 'pratique codifiée et transmise : salut au professeur et à la lignée '
        + 'd’enseignement. Le respect du kru, et la hiérarchie de salle qui en '
        + 'découle, structurent la pratique bien au-delà du geste.',
      principes: [
        { nom: 'Wai kru', texte: 'Le salut au maître ouvre la pratique : on hérite d’un enseignement, on ne l’invente pas.' },
        { nom: 'Respect de l’adversaire', texte: 'Le combat est encadré par une politesse qui n’est pas décorative — elle rend la violence praticable.' },
      ],
    },
    lecons: [
      'Le teep règle la distance mieux que n’importe quel déplacement.',
      'Un coup de pied qui rate déséquilibre : on apprend à assumer le risque de frapper.',
      'Le conditionnement se construit sur des années — la patience est une compétence technique.',
    ],
    demarrer: {
      materiel: ['Bandes', 'Gants 14 à 16 oz', 'Protège-tibias', 'Protège-dents', 'Coquille'],
      premiere_seance: 'Corde, shadow, puis technique au sac. Les coups de pied '
        + 'bas arrivent vite ; les tibias, eux, mettent des mois. N’accélère pas ce '
        + 'point-là.',
      reperes: [
        'Le clinch s’apprend séparément, souvent après plusieurs mois.',
        'Un tibia douloureux plusieurs jours est un signal d’arrêt, pas un badge.',
      ],
    },
    sources: ['turner-2009', 'crisafulli-2009'],
  },

  /* ═══ MMA ═════════════════════════════════════════════════════════ */
  mma: {
    pourquoi: 'La synthèse : percussion debout, projections, combat au sol. '
      + 'On y apprend surtout les TRANSITIONS — ce qui se passe entre deux '
      + 'domaines, là où les spécialistes de chacun sont les plus vulnérables.',
    forces: [
      { titre: 'Aucun angle mort', texte: 'La discipline sanctionne immédiatement ce qu’on ne sait pas faire. C’est inconfortable et formateur.' },
      { titre: 'Les transitions', texte: 'Passer de debout au sol, et inversement, est un domaine technique à part entière que seules les disciplines mixtes travaillent.' },
      { titre: 'La lucidité', texte: 'Gérer trois registres simultanément développe une attention que la spécialisation ne demande pas.' },
    ],
    techniques: [
      {
        famille: 'Debout',
        items: [
          { nom: 'Frappes', gloss: 'Poings, pieds, genoux, coudes selon règlement', cles: ['La garde diffère de la boxe : elle doit aussi défendre la saisie de jambes'] },
          { nom: 'Défense de projection', gloss: 'Sprawl', cles: ['Les hanches tombent en arrière et vers le bas'] },
        ],
      },
      {
        famille: 'Amenée au sol',
        items: [
          { nom: 'Double leg', gloss: 'Saisie des deux jambes' },
          { nom: 'Single leg', gloss: 'Saisie d’une jambe' },
          { nom: 'Plaquage contre la cage', gloss: 'Contrôle au grillage' },
        ],
      },
      {
        famille: 'Au sol',
        items: [
          { nom: 'Garde', gloss: 'Position défensive sur le dos, jambes actives' },
          { nom: 'Passage de garde', gloss: 'Franchir les jambes adverses' },
          { nom: 'Montée', gloss: 'Position dominante à cheval' },
          { nom: 'Contrôle dorsal', gloss: 'Dans le dos, crochets posés' },
          { nom: 'Ground and pound', gloss: 'Frappe depuis une position de contrôle' },
        ],
      },
    ],
    methodes: [
      { nom: 'Drilling par domaine', gloss: 'Debout, sol et transitions séparément', role: 'Isoler avant de mélanger.' },
      { nom: 'Situationnel', gloss: 'Départ d’une position imposée', role: 'La méthode la plus efficace pour travailler les transitions.' },
      { nom: 'Sparring segmenté', gloss: 'Uniquement debout, ou uniquement au sol', role: 'Éviter que le point fort masque le point faible.' },
      { nom: 'Sparring complet', gloss: 'Toutes phases, intensité maîtrisée', role: 'Rare, et jamais le cœur de l’entraînement.' },
    ],
    esprit: {
      codifie: false,
      texte: 'Discipline récente, sans doctrine constituée. Sa culture est celle '
        + 'de la synthèse et de l’efficacité éprouvée : on garde ce qui fonctionne '
        + 'sous opposition réelle. Ce pragmatisme tient lieu de ligne — il n’y a '
        + 'pas de principes écrits à citer.',
    },
    lecons: [
      'Le point faible décide de l’issue plus souvent que le point fort.',
      'Savoir où l’on est — debout, en transition, au sol — vaut mieux que savoir beaucoup de techniques.',
      'La position précède l’attaque : chercher la finition depuis une mauvaise place est la faute la plus courante.',
    ],
    demarrer: {
      materiel: ['Gants MMA 4 oz et gants de sparring 16 oz', 'Protège-dents', 'Coquille', 'Protège-tibias', 'Rashguard et short sans poches'],
      premiere_seance: 'La plupart des salles font commencer par une base — lutte '
        + 'ou grappling — avant d’ouvrir la percussion. C’est un bon signe.',
      reperes: [
        'Une salle qui met un débutant en sparring complet dès la première semaine est à fuir.',
        'Progresser en MMA suppose souvent de pratiquer une discipline mère en parallèle.',
      ],
    },
    sources: ['james-2016', 'delvecchio-2011'],
  },

  /* ═══ JUDO ════════════════════════════════════════════════════════ */
  judo: {
    pourquoi: 'Projeter quelqu’un qui résiste, en utilisant son déséquilibre '
      + 'plutôt que sa propre force. C’est la discipline qui formalise le mieux '
      + 'l’idée d’efficacité par le placement.',
    forces: [
      { titre: 'Le déséquilibre', texte: 'Le kuzushi est enseigné comme une étape à part entière : on ne projette pas quelqu’un d’équilibré, quelle que soit la force.' },
      { titre: 'La chute', texte: 'Savoir tomber est la première compétence enseignée, et elle sert toute la vie, bien au-delà du tatami.' },
      { titre: 'La préhension', texte: 'Le combat de garde précède le combat : c’est un domaine technique entier, rare ailleurs.' },
    ],
    techniques: [
      {
        famille: 'Chutes (ukemi)',
        items: [
          { nom: 'Ushiro ukemi', gloss: 'Chute arrière', cles: ['Menton rentré, bras qui frappent le tapis'] },
          { nom: 'Yoko ukemi', gloss: 'Chute latérale' },
          { nom: 'Mae mawari ukemi', gloss: 'Chute avant roulée' },
        ],
      },
      {
        famille: 'Projections de hanche et d’épaule',
        items: [
          { nom: 'O goshi', gloss: 'Grande hanche' },
          { nom: 'Seoi nage', gloss: 'Projection d’épaule', cles: ['Passer SOUS le centre de gravité adverse'] },
          { nom: 'Harai goshi', gloss: 'Hanche fauchée' },
        ],
      },
      {
        famille: 'Projections de jambe',
        items: [
          { nom: 'O soto gari', gloss: 'Grand fauchage extérieur', cles: ['Le déséquilibre arrière précède le fauchage'] },
          { nom: 'O uchi gari', gloss: 'Grand fauchage intérieur' },
          { nom: 'De ashi barai', gloss: 'Balayage du pied avancé', cles: ['Se place sur le temps où le pied se pose'] },
        ],
      },
      {
        famille: 'Sol (ne-waza)',
        items: [
          { nom: 'Kesa gatame', gloss: 'Immobilisation en écharpe' },
          { nom: 'Yoko shiho gatame', gloss: 'Immobilisation latérale' },
          { nom: 'Juji gatame', gloss: 'Clé de bras en croix' },
        ],
      },
      {
        famille: 'Préhension',
        items: [
          { nom: 'Kumi kata', gloss: 'Le combat de garde', cles: ['Prendre sa garde avant que l’autre ne prenne la sienne décide souvent de la suite'] },
        ],
      },
    ],
    methodes: [
      { nom: 'Uchi komi', gloss: 'Répétition d’entrée sans projeter', role: 'La méthode centrale : des milliers d’entrées pour automatiser le placement.' },
      { nom: 'Nage komi', gloss: 'Répétition avec projection', role: 'Aller au bout du mouvement, avec un partenaire qui sait chuter.' },
      { nom: 'Randori', gloss: 'Combat souple', role: 'Opposition réelle mais coopérative : on cherche à faire, pas à gagner.' },
      { nom: 'Kata', gloss: 'Formes codifiées à deux', role: 'Transmettre le principe exact, hors de l’urgence du combat.' },
    ],
    esprit: {
      codifie: true,
      texte: 'Le judo possède deux principes écrits, formulés par son fondateur '
        + 'Jigoro Kano, et enseignés comme le fond de la discipline.',
      principes: [
        { nom: 'Seiryoku zen’yo', texte: 'Meilleure utilisation de l’énergie. Obtenir le maximum d’effet avec le minimum de force — ce qui est une consigne technique autant qu’une morale.' },
        { nom: 'Jita kyoei', texte: 'Entraide et prospérité mutuelle. Le partenaire n’est pas un obstacle : sans lui, personne ne progresse.' },
      ],
    },
    lecons: [
      'On ne projette pas quelqu’un d’équilibré : créer la faute précède l’action.',
      'Tomber sans se blesser s’apprend, et cela sert partout ailleurs.',
      'Le partenaire prête son corps : l’abîmer, c’est perdre son outil de travail.',
    ],
    demarrer: {
      materiel: ['Judogi', 'Ceinture blanche', 'Pieds nus, ongles courts'],
      premiere_seance: 'Tu passeras l’essentiel du temps à apprendre à tomber. '
        + 'C’est normal, et c’est ce qui rend tout le reste possible.',
      reperes: [
        'Les grades vont de la ceinture blanche à la noire, avec des kyu intermédiaires.',
        'Le randori n’est pas un combat : chercher à gagner à tout prix contre un débutant est mal vu, et à raison.',
      ],
    },
    sources: ['franchini-2011', 'franchini-2013'],
  },

  /* ═══ JIU-JITSU BRÉSILIEN ═════════════════════════════════════════ */
  bjj: {
    pourquoi: 'Contrôler puis soumettre au sol, où la différence de gabarit se '
      + 'compense par le placement mieux que dans n’importe quelle autre '
      + 'discipline. C’est aussi la plus praticable à intensité réelle sans se '
      + 'faire mal, ce qui change tout sur la durée.',
    forces: [
      { titre: 'La pratique à intensité réelle', texte: 'On peut s’opposer à fond tous les jours sans coup porté. Aucune discipline de percussion ne le permet.' },
      { titre: 'Le levier contre la force', texte: 'La position bien prise annule un écart de poids considérable — et cela se vérifie immédiatement.' },
      { titre: 'La résolution de problèmes', texte: 'Chaque position est un problème avec des solutions connues. C’est un jeu d’échecs qui transpire.' },
    ],
    techniques: [
      {
        famille: 'Positions dominantes',
        items: [
          { nom: 'Montée', gloss: 'Mount', cles: ['Les hanches basses, pas assis sur les talons'] },
          { nom: 'Contrôle latéral', gloss: 'Side control' },
          { nom: 'Contrôle dorsal', gloss: 'Back control, crochets posés', cles: ['La position la plus forte du jeu'] },
          { nom: 'Genou sur le ventre', gloss: 'Knee on belly' },
        ],
      },
      {
        famille: 'Gardes',
        items: [
          { nom: 'Garde fermée', gloss: 'Closed guard', cles: ['Les jambes verrouillées : la base défensive'] },
          { nom: 'Demi-garde', gloss: 'Half guard' },
          { nom: 'Garde ouverte', gloss: 'De la Riva, araignée, papillon…' },
        ],
      },
      {
        famille: 'Soumissions',
        items: [
          { nom: 'Étranglement arrière', gloss: 'Rear naked choke' },
          { nom: 'Clé de bras en croix', gloss: 'Armbar' },
          { nom: 'Triangle', gloss: 'Étranglement avec les jambes' },
          { nom: 'Kimura', gloss: 'Clé d’épaule' },
        ],
      },
      {
        famille: 'Déplacements',
        items: [
          { nom: 'Shrimping', gloss: 'Déplacement de hanche', cles: ['Le mouvement fondamental : presque toute défense en dépend'] },
          { nom: 'Pont', gloss: 'Bridge, upa' },
          { nom: 'Passage de garde', gloss: 'Franchir les jambes' },
        ],
      },
    ],
    methodes: [
      { nom: 'Drilling', gloss: 'Répétition d’un mouvement avec partenaire coopératif', role: 'Automatiser le détail.' },
      { nom: 'Situationnel', gloss: 'Départ d’une position imposée', role: 'Travailler une position précise sans repasser par tout le reste.' },
      { nom: 'Rolling', gloss: 'Opposition libre', role: 'Le cœur de la pratique — et ce qui la rend praticable quotidiennement.' },
      { nom: 'Flow rolling', gloss: 'Opposition souple, sans résistance maximale', role: 'Enchaîner et explorer plutôt que gagner.' },
    ],
    esprit: {
      codifie: false,
      texte: 'Pas de doctrine écrite comparable à celle du judo, mais un principe '
        + 'méthodologique enseigné partout : « position avant soumission ». '
        + 'S’y ajoute une étiquette de tapis solide — taper vite et sans orgueil, '
        + 'relâcher immédiatement — qui est une règle de sécurité avant d’être '
        + 'une politesse.',
      principes: [
        { nom: 'Position avant soumission', texte: 'Chercher la finition depuis une mauvaise place est la faute la plus fréquente, et la plus coûteuse.' },
        { nom: 'Taper est gratuit', texte: 'Abandonner une position ne coûte rien ; une articulation abîmée coûte des mois.' },
      ],
    },
    lecons: [
      'Résister avec la force à un meilleur placement ne fait que fatiguer plus vite.',
      'Perdre des centaines de fois est le mode d’apprentissage normal, pas un échec.',
      'La patience se mesure : tenir une position est un travail actif, pas une pause.',
    ],
    demarrer: {
      materiel: ['Kimono (gi) ou rashguard et short selon le cours', 'Protège-dents conseillé', 'Ongles courts, hygiène stricte'],
      premiere_seance: 'Échauffement au sol, un ou deux mouvements, puis souvent '
        + 'du rolling léger. Tu vas te faire soumettre beaucoup. C’est le '
        + 'fonctionnement normal.',
      reperes: [
        'Ceintures blanche, bleue, violette, marron, noire — la progression est lente et c’est assumé.',
        'Tape tôt. Personne ne juge quelqu’un qui tape ; tout le monde juge celui qui s’entête.',
      ],
    },
    sources: ['andreato-2017'],
  },

  /* ═══ KARATÉ ══════════════════════════════════════════════════════ */
  karate: {
    pourquoi: 'Produire un maximum d’effet en un geste unique, depuis une '
      + 'distance maîtrisée. Le karaté travaille la frappe décisive plutôt que '
      + 'l’échange prolongé, et cela oriente toute sa pédagogie.',
    forces: [
      { titre: 'La précision du geste', texte: 'Peu de disciplines décomposent autant l’exécution : chaque mouvement a une forme de référence.' },
      { titre: 'La distance', texte: 'Le maai — la bonne distance — est un objet d’étude explicite.' },
      { titre: 'La progression lisible', texte: 'Kihon, kata, kumité : trois piliers clairs, et un syllabus par grade qui dit exactement ce qu’il y a à travailler.' },
    ],
    techniques: [
      { famille: 'Voir le syllabus complet', items: [{ nom: 'Kihon, kata, kumité', gloss: 'Le karaté dispose d’un syllabus détaillé par grade, du 9e au 1er kyu' }] },
    ],
    methodes: [
      { nom: 'Kihon', gloss: 'Les bases, seul et à vide', role: 'Construire le geste juste avant de l’appliquer.' },
      { nom: 'Kata', gloss: 'Formes codifiées', role: 'Enchaîner et se déplacer en gardant la forme sous la fatigue.' },
      { nom: 'Kumité conventionnel', gloss: 'Gohon, sanbon, kihon ippon', role: 'Confronter le geste à un partenaire, sans surprise d’abord.' },
      { nom: 'Jiyu kumité', gloss: 'Combat libre', role: 'Tout ce qui précède, sans annonce.' },
    ],
    esprit: {
      codifie: true,
      texte: 'Le karaté transmet deux corpus écrits, souvent confondus. Le '
        + 'niju kun — les vingt préceptes de Gichin Funakoshi, publiés en 1938 — '
        + 'et le dojo kun, cinq principes qui en sont une forme condensée et que '
        + 'la plupart des écoles récitent à la fin de chaque séance.',
      principes: [
        { nom: 'Karate-do wa rei ni hajimari, rei ni owaru', texte: 'Le karaté commence et finit par le respect. Premier des vingt préceptes de Funakoshi dans l’ordre d’usage — étant entendu que chacun d’eux s’ouvre par « hitotsu », « un », pour marquer qu’aucun ne prime sur les autres.' },
        { nom: 'Karate ni sente nashi', texte: 'Il n’y a pas de première attaque en karaté. Deuxième précepte, et une contrainte technique autant qu’une règle morale.' },
      ],
    },
    lecons: [
      'Répéter un geste dix mille fois n’est pas de l’ennui : c’est la méthode.',
      'La forme sert la fonction — un geste juste est un geste efficace, pas un geste joli.',
      'La distance décide avant la vitesse.',
    ],
    demarrer: {
      materiel: ['Karategi', 'Ceinture blanche', 'Protections selon le club pour le kumité'],
      premiere_seance: 'Beaucoup de kihon, en ligne, sur place. C’est austère au '
        + 'début et c’est voulu : le geste se construit avant d’être appliqué.',
      reperes: [
        'Les styles diffèrent — Shotokan, Goju-ryu, Wado-ryu, Shito-ryu. Le syllabus de cette application suit le Shotokan de type JKA.',
        'Le rattachement d’une technique à un grade varie d’un dojo à l’autre : ton professeur fait autorité.',
      ],
    },
    sources: ['chaabene-2012', 'zehr-sale-1994'],
  },

  /* ═══ LUTTE ═══════════════════════════════════════════════════════ */
  lutte: {
    pourquoi: 'Amener l’autre au sol et l’y contrôler, sans frappe ni soumission. '
      + 'C’est la base de tout combat de préhension, et la qualité athlétique la '
      + 'plus transférable des sports de combat.',
    forces: [
      { titre: 'Le contrôle du corps à corps', texte: 'Décider où se passe le combat est un avantage décisif dans toutes les disciplines mixtes.' },
      { titre: 'La condition physique', texte: 'L’effort continu en opposition construit une condition que peu d’entraînements reproduisent.' },
      { titre: 'La mentalité', texte: 'Pas de distance de repli, pas de pause : la discipline est réputée pour ce qu’elle demande de ténacité.' },
    ],
    techniques: [
      {
        famille: 'Amenées au sol',
        items: [
          { nom: 'Double leg', gloss: 'Saisie des deux jambes', cles: ['Changement de niveau AVANT l’avancée', 'La tête reste haute'] },
          { nom: 'Single leg', gloss: 'Saisie d’une jambe' },
          { nom: 'Ceinture arrière', gloss: 'Contrôle du tronc par derrière' },
          { nom: 'Suplex', gloss: 'Projection arrière en lutte gréco-romaine' },
        ],
      },
      {
        famille: 'Défense',
        items: [
          { nom: 'Sprawl', gloss: 'Défense contre la saisie de jambes', cles: ['Les hanches tombent, le poids écrase'] },
          { nom: 'Whizzer', gloss: 'Contrôle par le bras au-dessus' },
        ],
      },
      {
        famille: 'Contrôle au sol',
        items: [
          { nom: 'Riding', gloss: 'Maintien du contrôle par-dessus' },
          { nom: 'Retournements', gloss: 'Amener les épaules au tapis' },
        ],
      },
      {
        famille: 'Déplacements',
        items: [
          { nom: 'Changement de niveau', gloss: 'Plier les jambes, pas le dos', cles: ['Le mouvement fondamental : presque toute attaque en dépend'] },
          { nom: 'Position de garde', gloss: 'Stance, hanches basses' },
        ],
      },
    ],
    methodes: [
      { nom: 'Drilling', gloss: 'Répétition d’entrées avec partenaire', role: 'Le volume fait la technique — les entrées se comptent par centaines.' },
      { nom: 'Situationnel', gloss: 'Départ d’une position imposée', role: 'Travailler une phase précise, notamment les défenses.' },
      { nom: 'Live wrestling', gloss: 'Opposition libre', role: 'Le test réel, très exigeant physiquement.' },
      { nom: 'Travail de corde et de cou', gloss: 'Renforcement spécifique', role: 'Le cou se renforce spécifiquement : c’est une prévention, pas de l’esthétique.' },
    ],
    esprit: {
      codifie: false,
      texte: 'Aucune doctrine écrite : la lutte est un sport, pas une école de '
        + 'pensée. Sa culture est faite d’exigence de travail et de sobriété — '
        + 'ce qui se transmet est une manière de s’entraîner plutôt qu’un corpus '
        + 'de principes.',
    },
    lecons: [
      'Le changement de niveau précède tout : on attaque de dessous, jamais de face.',
      'Il n’y a pas de repli possible — on apprend à travailler en étant fatigué.',
      'Le contrôle vaut mieux que la spectacularité : gagner la position gagne le combat.',
    ],
    demarrer: {
      materiel: ['Chaussures de lutte', 'Singlet ou tenue près du corps', 'Protège-oreilles conseillé'],
      premiere_seance: 'Déplacements, changements de niveau, chutes. La condition '
        + 'physique surprend presque tout le monde le premier jour.',
      reperes: [
        'Deux styles olympiques : libre (jambes autorisées) et gréco-romaine (haut du corps uniquement).',
        'Le cou et les oreilles se protègent dès le début, pas après le premier problème.',
      ],
    },
    sources: ['chaabene-2017', 'horswill-1992'],
  },

  /* ═══ ESCRIME ═════════════════════════════════════════════════════ */
  escrime: {
    pourquoi: 'Toucher sans être touché, à distance d’arme, dans un échange qui '
      + 'se joue en fractions de seconde. C’est la discipline de combat la plus '
      + 'intellectuelle : la décision précède le geste, et le geste est presque '
      + 'trop rapide pour être corrigé.',
    forces: [
      { titre: 'Le temps de réaction', texte: 'Aucune autre discipline de combat ne travaille aussi directement la vitesse de décision.' },
      { titre: 'La convention', texte: 'Au fleuret et au sabre, la priorité est une règle formelle : le combat devient un dialogue argumenté, où l’on doit prendre l’initiative pour marquer.' },
      { titre: 'L’asymétrie', texte: 'Un seul côté travaille, avec une amplitude et une puissance très particulières — la fente est un geste athlétique à part entière.' },
    ],
    techniques: [
      {
        famille: 'Déplacements',
        items: [
          { nom: 'Marche et retraite', gloss: 'Le déplacement de base', cles: ['La garde ne se relâche pas pendant le déplacement'] },
          { nom: 'Fente', gloss: 'Lunge', cles: ['Le bras part AVANT la jambe', 'La jambe arrière se tend complètement'] },
          { nom: 'Bond en avant-fente', gloss: 'Balestra', cles: ['Gagner de la distance avant de toucher'] },
        ],
      },
      {
        famille: 'Offensive',
        items: [
          { nom: 'Attaque directe', gloss: 'Sans changer de ligne' },
          { nom: 'Dégagement', gloss: 'Contourner la lame adverse' },
          { nom: 'Coupé', gloss: 'Passer par-dessus la pointe' },
          { nom: 'Feinte', gloss: 'Provoquer une réaction pour l’exploiter' },
        ],
      },
      {
        famille: 'Défensive',
        items: [
          { nom: 'Parade', gloss: 'Dévier la lame — parades de quarte, sixte, octave…', cles: ['Dévier, pas repousser : l’économie de geste décide'] },
          { nom: 'Riposte', gloss: 'Toucher immédiatement après la parade' },
          { nom: 'Contre-attaque', gloss: 'Toucher pendant la préparation adverse' },
        ],
      },
      {
        famille: 'Les trois armes',
        items: [
          { nom: 'Fleuret', gloss: 'Pointe, torse, avec convention de priorité' },
          { nom: 'Épée', gloss: 'Pointe, tout le corps, sans convention — le double touche compte' },
          { nom: 'Sabre', gloss: 'Pointe et tranchant, au-dessus de la taille, avec convention' },
        ],
      },
    ],
    methodes: [
      { nom: 'Leçon individuelle', gloss: 'En tête à tête avec le maître d’armes', role: 'La méthode centrale, et ce qui distingue l’escrime : la correction est immédiate et personnelle.' },
      { nom: 'Exercices à deux', gloss: 'Séquences convenues', role: 'Construire les enchaînements avec un partenaire.' },
      { nom: 'Assaut', gloss: 'Opposition libre', role: 'Appliquer, y compris la convention.' },
      { nom: 'Travail de jambes', gloss: 'Déplacements sans arme', role: 'La fente et le déplacement se travaillent séparément — c’est du travail athlétique.' },
    ],
    esprit: {
      codifie: true,
      texte: 'L’escrime conserve un formalisme explicite hérité de son passé '
        + 'd’arme : le salut avant et après l’assaut, la poignée de main, et le '
        + 'respect de l’arbitre sont des règles de compétition, pas des usages '
        + 'facultatifs. La convention de priorité, elle, est un objet écrit du '
        + 'règlement.',
      principes: [
        { nom: 'Le salut', texte: 'Obligatoire en compétition : refuser de saluer est sanctionné. La courtoisie est inscrite dans le règlement.' },
        { nom: 'La convention', texte: 'Au fleuret et au sabre, celui qui attaque correctement a la priorité. Le point ne récompense pas la vitesse seule mais la construction de l’action.' },
      ],
    },
    lecons: [
      'Décider vite compte plus que bouger vite.',
      'Une parade réussie ne sert à rien sans la riposte qui suit.',
      'La distance est la seule défense qui ne demande aucun geste.',
    ],
    demarrer: {
      materiel: ['Le club prête généralement l’arme, le masque et la veste au début', 'Gant, chaussures de salle', 'Sous-cuirasse à l’achat'],
      premiere_seance: 'Garde, marche, retraite, fente. On touche peu et on se '
        + 'déplace beaucoup. Les cuisses s’en souviennent le lendemain.',
      reperes: [
        'Choisis l’arme après avoir essayé : les trois se pratiquent très différemment.',
        'La leçon individuelle est le cœur de la progression — un club qui en propose peu ralentit tout.',
      ],
    },
    sources: ['roi-2008', 'turner-2014'],
  },
};

export const manuelDe = (key) => MANUEL[key] ?? null;

/** Les disciplines couvertes par le manuel. */
export const DISCIPLINES_DOCUMENTEES = Object.keys(MANUEL);

/**
 * Contrôles de cohérence, exécutés par les tests.
 *
 * Une fiche incomplète ne lèverait aucune erreur : elle afficherait une
 * section vide, et personne ne saurait qu'il manque quelque chose.
 */
export function manuelProblems() {
  const problems = [];
  const requis = ['pourquoi', 'forces', 'techniques', 'methodes', 'esprit', 'lecons', 'demarrer', 'sources'];

  for (const [key, m] of Object.entries(MANUEL)) {
    for (const champ of requis) {
      if (m[champ] == null) problems.push(`${key} : champ « ${champ} » manquant`);
    }
    if (m.esprit && typeof m.esprit.codifie !== 'boolean') {
      problems.push(`${key} : « esprit.codifie » doit dire OUI ou NON, sans ambiguïté`);
    }
    // Un esprit annoncé codifié DOIT citer ses principes, sinon
    // l'affirmation ne repose sur rien.
    if (m.esprit?.codifie && !(m.esprit.principes?.length > 0)) {
      problems.push(`${key} : esprit annoncé codifié mais aucun principe cité`);
    }
    // Pas de règle inverse : le JJB cite des principes MÉTHODOLOGIQUES
    // (« position avant soumission ») sans revendiquer de doctrine.
    // Interdire cela demandait une exception nommée dans le contrôle,
    // ce qui est le signe d'une règle mal posée.
    if (!(m.sources?.length > 0)) problems.push(`${key} : aucune source`);
  }
  return problems;
}
