/**
 * Manuel des sports de combat — la partie détaillée.
 *
 * ┌─ POURQUOI UN SECOND FICHIER ──────────────────────────────────────┐
 * │ `combat-manual.js` répond à « est-ce pour moi » : pourquoi cette  │
 * │ discipline, son répertoire, ses méthodes, son esprit. On le lit   │
 * │ debout, avant de s'inscrire.                                      │
 * │                                                                    │
 * │ Ici commence ce qu'on relit ASSIS, une fois qu'on pratique : le   │
 * │ format de compétition, la structure d'une séance, la progression  │
 * │ réelle, les fautes qu'on fait tous, les blessures fréquentes et   │
 * │ le vocabulaire. Deux usages, deux fichiers.                       │
 * └────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ Les FORMATS DE COMPÉTITION varient selon la fédération, le niveau
 * et l'âge. Ceux décrits ici sont ceux des fédérations internationales
 * pour les catégories seniors ; un club ou une compétition régionale
 * peut légitimement faire autrement.
 */

export const DETAIL = {
  /* ═══ BOXE ANGLAISE ═══════════════════════════════════════════════ */
  boxe: {
    format: {
      instance: 'World Boxing / IBA (amateur), commissions athlétiques (professionnel)',
      duree: 'Amateur seniors : 3 reprises de 3 min, 1 min de repos. Professionnel : 4 à 12 reprises de 3 min.',
      victoire: ['Décision des juges', 'Hors-combat (KO)', 'Arrêt de l’arbitre (TKO)', 'Abandon', 'Disqualification'],
      notation: 'Système des dix points : le vainqueur de la reprise reçoit 10, l’autre 9 ou moins. Trois à cinq juges.',
      cibles: 'Devant et côtés de la tête et du tronc, au-dessus de la ceinture. Le dos, la nuque et les reins sont interdits.',
      categories: 'Catégories de poids, de mouche à super-lourds selon les instances.',
    },
    seance_type: [
      { phase: 'Corde et échauffement', minutes: 15, contenu: 'Corde, mobilité des épaules, rotations du tronc. La corde n’est pas du cardio : c’est le travail d’appuis.' },
      { phase: 'Shadow', minutes: 10, contenu: 'Trois reprises devant le miroir. Garde, déplacement, enchaînements simples.' },
      { phase: 'Technique', minutes: 20, contenu: 'Un ou deux points précis, au sac ou à deux.' },
      { phase: 'Paos', minutes: 15, contenu: 'Réagir à une cible qui bouge. C’est là que la technique devient utilisable.' },
      { phase: 'Sac', minutes: 10, contenu: 'Puissance et volume, quand la forme tient encore.' },
      { phase: 'Gainage et retour au calme', minutes: 10, contenu: 'Tronc, cou, étirements légers.' },
    ],
    progression: [
      { palier: 'Mois 1 à 3', reperes: ['Garde qui tient sans y penser', 'Marche avant, arrière, latérale sans croiser les pieds', 'Jab et direct arrière propres'] },
      { palier: 'Mois 3 à 9', reperes: ['Enchaînements à trois coups', 'Esquives rotatives sur jab', 'Premiers sparrings très légers'] },
      { palier: 'Année 1 à 2', reperes: ['Sparring régulier maîtrisé', 'Travail au corps', 'Capacité à tenir trois reprises sans s’effondrer techniquement'] },
      { palier: 'Au-delà', reperes: ['Style personnel assumé', 'Première compétition amateur si envie'] },
    ],
    erreurs: [
      { faute: 'Reculer en ligne droite', pourquoi: 'On reste dans l’axe de frappe et on arrive au bout du ring sans solution.', correction: 'Sortir de côté, par un pas ou un pivot.' },
      { faute: 'Baisser la main qui frappe en revenant', pourquoi: 'Le contre arrive précisément sur ce trajet.', correction: 'Le poing revient par le même chemin, au menton.' },
      { faute: 'Retenir sa respiration', pourquoi: 'On se fatigue en trente secondes et on encaisse plus mal.', correction: 'Expirer à chaque coup, brièvement.' },
      { faute: 'Frapper avec le bras seul', pourquoi: 'Aucune puissance, et l’épaule prend tout.', correction: 'La force part du sol, passe par la hanche, finit au poing.' },
      { faute: 'Fermer les yeux', pourquoi: 'On ne voit pas venir le second coup, qui est celui qui touche.', correction: 'Travail aux paos à intensité basse, jusqu’à ce que le réflexe cède.' },
    ],
    securite: {
      frequentes: ['Entorses et fractures de la main (métacarpes)', 'Épaules', 'Commotions cérébrales'],
      prevention: [
        'Bander correctement : la majorité des blessures de main viennent d’un bandage bâclé.',
        'Le protège-dents réduit aussi le risque de commotion, pas seulement les dents cassées.',
        'Une sonnerie d’oreille, une nausée ou un trou de mémoire après un coup imposent l’arrêt et un avis médical. Reprendre le lendemain est la faute la plus grave du sport.',
      ],
      note: 'La commotion est la blessure sérieuse de la boxe. Elle ne se voit pas et ne fait pas mal sur le moment.',
    },
    glossaire: [
      { terme: 'Jab', definition: 'Direct du bras avant.' },
      { terme: 'Cross', definition: 'Direct du bras arrière.' },
      { terme: 'Slip', definition: 'Esquive par rotation du buste.' },
      { terme: 'Clinch', definition: 'Corps à corps, ici pour neutraliser.' },
      { terme: 'Paos / pattes d’ours', definition: 'Cibles tenues par un partenaire.' },
      { terme: 'Reprise', definition: 'Un round.' },
    ],
  },

  /* ═══ BOXE THAÏ ═══════════════════════════════════════════════════ */
  boxe_thai: {
    format: {
      instance: 'IFMA (amateur), stades et promotions (professionnel)',
      duree: '5 reprises de 3 min, 2 min de repos. En amateur, protections complètes et coudes souvent interdits.',
      victoire: ['Décision', 'Hors-combat', 'Arrêt de l’arbitre', 'Abandon'],
      notation: 'Notation par reprise, trois juges. La tradition thaïe valorise les coups qui déséquilibrent et les techniques de jambe plus que le volume de poings.',
      cibles: 'Tout le corps sauf les parties génitales, avec poings, pieds, genoux et coudes selon le règlement appliqué.',
      categories: 'Catégories de poids, souvent plus resserrées qu’en boxe anglaise.',
    },
    seance_type: [
      { phase: 'Corde', minutes: 15, contenu: 'Traditionnellement long. Appuis et fond.' },
      { phase: 'Shadow', minutes: 10, contenu: 'Quatre armes, déplacements, changements de niveau.' },
      { phase: 'Sac', minutes: 20, contenu: 'Coups de pied bas et moyens surtout, par séries.' },
      { phase: 'Paos', minutes: 20, contenu: 'Le cœur de la séance : enchaînements complets avec un partenaire.' },
      { phase: 'Clinch', minutes: 15, contenu: 'Travail à part, souvent en fin de séance.' },
      { phase: 'Renforcement', minutes: 10, contenu: 'Tronc, cou, et abdominaux frappés légèrement dans certaines salles.' },
    ],
    progression: [
      { palier: 'Mois 1 à 3', reperes: ['Garde haute maintenue', 'Teep et coup de pied circulaire au sac', 'Pied d’appui qui pivote sans réfléchir'] },
      { palier: 'Mois 3 à 12', reperes: ['Enchaînements poing-pied', 'Premières défenses de coup de pied bas', 'Découverte du clinch'] },
      { palier: 'Année 1 à 3', reperes: ['Clinch fonctionnel', 'Sparring complet', 'Tibias conditionnés progressivement'] },
    ],
    erreurs: [
      { faute: 'Ne pas pivoter le pied d’appui', pourquoi: 'Le genou encaisse la torsion et la hanche ne peut pas suivre.', correction: 'Le talon d’appui tourne vers la cible avant l’impact.' },
      { faute: 'Frapper le coup de pied circulaire genou plié', pourquoi: 'On tape avec le pied au lieu du tibia, et ça casse.', correction: 'La jambe frappe tendue, comme une batte.' },
      { faute: 'Baisser la garde en donnant un coup de pied', pourquoi: 'C’est exactement le moment où le contre arrive.', correction: 'La main opposée reste au menton.' },
      { faute: 'Vouloir conditionner ses tibias trop vite', pourquoi: 'Périostite, voire fracture de fatigue.', correction: 'Le conditionnement se compte en années, pas en semaines.' },
      { faute: 'Tirer sur la nuque avec les bras en clinch', pourquoi: 'On se fatigue et on se fait retourner.', correction: 'Les coudes serrés font le travail, pas les biceps.' },
    ],
    securite: {
      frequentes: ['Contusions et périostites tibiales', 'Entorses de cheville', 'Commotions'],
      prevention: [
        'Protège-tibias obligatoires à l’entraînement, sans exception au début.',
        'Un tibia douloureux plus de 48 h impose l’arrêt du travail de jambe.',
        'Le clinch se travaille sans frappe tant que la technique n’est pas sûre.',
      ],
      note: 'La périostite est la blessure typique du débutant pressé.',
    },
    glossaire: [
      { terme: 'Teep', definition: 'Coup de pied de face, repoussant.' },
      { terme: 'Te', definition: 'Coup de pied.' },
      { terme: 'Khao', definition: 'Genou.' },
      { terme: 'Sok', definition: 'Coude.' },
      { terme: 'Kru', definition: 'Le professeur.' },
      { terme: 'Wai kru', definition: 'Rituel de salut avant le combat.' },
    ],
  },

  /* ═══ MMA ═════════════════════════════════════════════════════════ */
  mma: {
    format: {
      instance: 'Règles unifiées du MMA (Unified Rules), IMMAF en amateur',
      duree: '3 reprises de 5 min ; 5 reprises pour un combat de titre. 1 min de repos.',
      victoire: ['Soumission', 'Hors-combat ou arrêt', 'Décision des juges', 'Disqualification'],
      notation: 'Système des dix points, avec priorité donnée à l’efficacité du combat plutôt qu’au volume.',
      cibles: 'Interdits : coups à l’arrière du crâne et à la colonne, doigts dans les yeux, coups de pied à la tête d’un adversaire au sol selon les règlements.',
      categories: 'Catégories de poids strictes, avec pesée la veille.',
    },
    seance_type: [
      { phase: 'Échauffement spécifique', minutes: 15, contenu: 'Déplacements, chutes, mouvements de hanche au sol.' },
      { phase: 'Bloc d’un domaine', minutes: 30, contenu: 'Debout, lutte ou sol — un seul par séance, sinon rien ne se fixe.' },
      { phase: 'Transitions', minutes: 15, contenu: 'Le vrai sujet du MMA : ce qui se passe entre deux domaines.' },
      { phase: 'Situationnel', minutes: 15, contenu: 'Départ imposé : dos à la cage, en garde, en défense de projection.' },
      { phase: 'Condition physique', minutes: 10, contenu: 'Court et intense, en fin de séance.' },
    ],
    progression: [
      { palier: 'Année 1', reperes: ['Une base choisie — lutte ou grappling', 'Chutes sûres', 'Sprawl fiable'] },
      { palier: 'Année 1 à 3', reperes: ['Second domaine construit', 'Transitions conscientes', 'Sparring segmenté régulier'] },
      { palier: 'Au-delà', reperes: ['Jeu personnel cohérent', 'Sparring complet maîtrisé', 'Compétition amateur si envie'] },
    ],
    erreurs: [
      { faute: 'Garder une garde de boxe', pourquoi: 'Elle ne défend pas la saisie de jambes.', correction: 'Garde plus basse, hanches prêtes à reculer.' },
      { faute: 'Chercher la soumission depuis une mauvaise position', pourquoi: 'On perd la position et on se fait retourner.', correction: 'Position d’abord, finition ensuite.' },
      { faute: 'Tout mélanger dès le début', pourquoi: 'On devient médiocre partout au lieu de solide quelque part.', correction: 'Construire une base, puis l’élargir.' },
      { faute: 'Se relever sans contrôler', pourquoi: 'On se fait reprendre pendant la remontée, souvent dans le dos.', correction: 'Technical stand-up, une main au sol, l’adversaire contrôlé.' },
    ],
    securite: {
      frequentes: ['Commotions', 'Épaules et genoux', 'Coupures', 'Infections cutanées'],
      prevention: [
        'Sparring segmenté plutôt que complet : la majorité du volume doit être sans frappe à la tête.',
        'Hygiène stricte du tapis et de la peau — les infections sont fréquentes en grappling.',
        'Refuser un sparring qu’on ne sent pas est une décision technique, pas un renoncement.',
      ],
      note: 'Le cumul des domaines multiplie les expositions : la gestion du volume de sparring est le premier facteur de longévité.',
    },
    glossaire: [
      { terme: 'Sprawl', definition: 'Défense contre la saisie de jambes.' },
      { terme: 'Takedown', definition: 'Amenée au sol.' },
      { terme: 'Ground and pound', definition: 'Frappe depuis une position de contrôle au sol.' },
      { terme: 'Cage wrestling', definition: 'Lutte contre le grillage.' },
      { terme: 'Technical stand-up', definition: 'Manière sûre de se relever.' },
    ],
  },

  /* ═══ JUDO ════════════════════════════════════════════════════════ */
  judo: {
    format: {
      instance: 'Fédération Internationale de Judo (IJF)',
      duree: '4 min en seniors, prolongation en « golden score » sans limite jusqu’au premier point ou à la troisième pénalité.',
      victoire: ['Ippon — fin immédiate', 'Deux waza-ari, qui valent ippon', 'Trois shido (pénalités) infligés à l’adversaire', 'Abandon sur immobilisation, clé ou étranglement'],
      notation: 'Ippon : projection sur le dos avec force, vitesse et contrôle, ou immobilisation de 20 s, ou abandon. Waza-ari : projection incomplète, ou immobilisation de 10 à 19 s.',
      cibles: 'Clés de coude et étranglements uniquement, en seniors. Aucune frappe.',
      categories: 'Sept catégories de poids par sexe en seniors.',
    },
    seance_type: [
      { phase: 'Échauffement et ukemi', minutes: 15, contenu: 'Chutes, déplacements, mobilité. Les chutes sont dans chaque séance, à tous les niveaux.' },
      { phase: 'Uchi komi', minutes: 15, contenu: 'Répétition d’entrées sans projeter. Par séries de dix à vingt.' },
      { phase: 'Nage komi', minutes: 15, contenu: 'Entrées menées jusqu’à la projection.' },
      { phase: 'Ne-waza', minutes: 15, contenu: 'Travail au sol : immobilisations, retournements, sorties.' },
      { phase: 'Randori', minutes: 25, contenu: 'Combats souples, par périodes de 3 à 5 min.' },
      { phase: 'Salut et étirements', minutes: 5, contenu: 'Le salut ferme la séance, comme il l’a ouverte.' },
    ],
    progression: [
      { palier: 'Ceinture blanche à jaune', reperes: ['Toutes les chutes de base', 'Deux ou trois projections propres', 'Deux immobilisations'] },
      { palier: 'Orange à verte', reperes: ['Élargissement du répertoire', 'Enchaînements debout-sol', 'Kumi-kata conscient'] },
      { palier: 'Bleue à marron', reperes: ['Technique de prédilection identifiée', 'Combinaisons et contre-prises', 'Kata au programme'] },
      { palier: 'Noire (shodan)', reperes: ['Nage no kata', 'Compétition ou équivalence selon les fédérations', 'Plusieurs années de pratique régulière'] },
    ],
    erreurs: [
      { faute: 'Tirer avec les bras', pourquoi: 'On fatigue les avant-bras et on ne déséquilibre personne.', correction: 'Le déséquilibre vient du déplacement, les bras ne font que transmettre.' },
      { faute: 'Oublier le kuzushi', pourquoi: 'Projeter quelqu’un d’équilibré est impossible, quelle que soit la force.', correction: 'Créer la faute d’appui avant d’entrer.' },
      { faute: 'Entrer sans baisser le centre de gravité', pourquoi: 'On reste au-dessus de l’adversaire au lieu de passer dessous.', correction: 'Genoux fléchis, hanches sous les siennes.' },
      { faute: 'Se rattraper avec le bras en chutant', pourquoi: 'C’est la fracture classique du judo.', correction: 'Le bras frappe le tapis à plat, il ne s’appuie pas.' },
      { faute: 'Vouloir gagner le randori', pourquoi: 'On se crispe et on n’essaie plus rien de nouveau.', correction: 'Le randori sert à faire, pas à gagner.' },
    ],
    securite: {
      frequentes: ['Épaules et coudes', 'Doigts (préhension du kimono)', 'Genoux', 'Cervicales en chute mal faite'],
      prevention: [
        'Les ukemi ne sont pas un échauffement : ce sont la compétence de sécurité fondamentale.',
        'Taper immédiatement sur une clé. L’orgueil coûte des mois de coude.',
        'Les doigts se tapent ou se protègent dès les premières douleurs.',
      ],
      note: 'La chute mal faite est la cause la plus fréquente de blessure sérieuse chez le débutant.',
    },
    glossaire: [
      { terme: 'Ukemi', definition: 'Technique de chute.' },
      { terme: 'Kuzushi', definition: 'Déséquilibre préalable.' },
      { terme: 'Tsukuri', definition: 'Placement, l’entrée dans la technique.' },
      { terme: 'Kake', definition: 'L’exécution finale.' },
      { terme: 'Kumi kata', definition: 'Le combat de garde.' },
      { terme: 'Randori', definition: 'Combat souple d’entraînement.' },
      { terme: 'Uke / Tori', definition: 'Celui qui subit / celui qui exécute.' },
    ],
  },

  /* ═══ JIU-JITSU BRÉSILIEN ═════════════════════════════════════════ */
  bjj: {
    format: {
      instance: 'IBJJF principalement ; d’autres règlements existent (ADCC, sous-soumission uniquement)',
      duree: 'De 5 min (ceinture blanche) à 10 min (ceinture noire adulte).',
      victoire: ['Soumission — fin immédiate', 'Points', 'Avantages si égalité', 'Décision arbitrale'],
      notation: 'Passage de garde 3 · Renversement 2 · Amenée au sol 2 · Genou sur le ventre 2 · Montée 4 · Contrôle dorsal 4.',
      cibles: 'Clés et étranglements selon la ceinture : les clés de jambe torsives sont progressivement autorisées avec le grade.',
      categories: 'Par ceinture, âge et poids. Kimono (gi) et sans kimono (no-gi) sont séparés.',
    },
    seance_type: [
      { phase: 'Échauffement spécifique', minutes: 15, contenu: 'Déplacements de hanche, ponts, roulades. Ce sont déjà des techniques.' },
      { phase: 'Technique du jour', minutes: 20, contenu: 'Une position, deux ou trois options. Démonstration puis répétition.' },
      { phase: 'Drilling', minutes: 15, contenu: 'Répétition avec partenaire coopératif, puis résistance progressive.' },
      { phase: 'Situationnel', minutes: 10, contenu: 'Départ imposé sur la position travaillée.' },
      { phase: 'Rolling', minutes: 30, contenu: 'Cinq à six combats de 5 min. Le cœur de la pratique.' },
    ],
    progression: [
      { palier: 'Blanche', reperes: ['Survivre', 'Déplacements de hanche', 'Défenses de base', 'Une ou deux soumissions'], duree: '1 à 2 ans' },
      { palier: 'Bleue', reperes: ['Jeu de garde qui se dessine', 'Passages fiables', 'Échapper aux mauvaises positions'], duree: '2 à 3 ans' },
      { palier: 'Violette', reperes: ['Jeu personnel', 'Enchaînements', 'Capacité à enseigner les bases'], duree: '1,5 à 3 ans' },
      { palier: 'Marron puis noire', reperes: ['Précision et économie', 'Jeu difficile à lire'], duree: 'souvent 10 ans au total' },
    ],
    erreurs: [
      { faute: 'Forcer avec les bras', pourquoi: 'Les bras sont le maillon faible et s’épuisent en une minute.', correction: 'Utiliser les hanches et le poids du corps.' },
      { faute: 'Rester à plat sur le dos', pourquoi: 'C’est la position d’où l’on ne peut rien faire.', correction: 'Toujours sur le côté, une hanche dégagée.' },
      { faute: 'Taper trop tard', pourquoi: 'La blessure arrive avant la douleur sur certaines clés.', correction: 'Taper tôt : ça ne coûte rien.' },
      { faute: 'Retenir sa respiration sous pression', pourquoi: 'La panique vient de là, pas du poids de l’adversaire.', correction: 'Respirer lentement, même écrasé.' },
      { faute: 'Vouloir gagner chaque rolling', pourquoi: 'On ne joue que ce qu’on sait déjà faire, et on cesse de progresser.', correction: 'Se mettre volontairement dans les mauvaises positions.' },
    ],
    securite: {
      frequentes: ['Coudes et épaules', 'Genoux (clés de jambe, gardes)', 'Doigts et orteils', 'Infections cutanées'],
      prevention: [
        'Douche immédiate, kimono lavé après chaque séance : les infections cutanées sont le risque le plus banal et le plus évitable.',
        'Taper tôt et sans orgueil. C’est la règle de sécurité principale.',
        'Refuser une clé de jambe qu’on ne connaît pas est une décision raisonnable.',
      ],
      note: 'Le JJB est la discipline de combat la plus praticable à intensité réelle, à condition de respecter le tapotement.',
    },
    glossaire: [
      { terme: 'Rolling', definition: 'Combat d’entraînement.' },
      { terme: 'Garde', definition: 'Position défensive, jambes entre soi et l’adversaire.' },
      { terme: 'Sweep', definition: 'Renversement depuis la garde.' },
      { terme: 'Shrimping', definition: 'Déplacement de hanche fondamental.' },
      { terme: 'Tap', definition: 'Taper pour abandonner.' },
      { terme: 'Gi / No-gi', definition: 'Avec ou sans kimono.' },
      { terme: 'Oss', definition: 'Salutation d’usage, au sens très variable.' },
    ],
  },

  /* ═══ KARATÉ ══════════════════════════════════════════════════════ */
  karate: {
    format: {
      instance: 'World Karate Federation (WKF) pour la compétition',
      duree: 'Kumité seniors : 3 min. Kata : exécution jugée, sans limite de temps stricte.',
      victoire: ['Écart de 8 points', 'Meilleur score à la fin du temps', 'Disqualification de l’adversaire'],
      notation: 'Yuko 1 point (poing) · Waza-ari 2 points (coup de pied au corps) · Ippon 3 points (coup de pied à la tête, ou projection suivie d’une technique).',
      cibles: 'Tête, cou, tronc, dos, en contrôle. Le contact excessif est pénalisé : c’est un karaté de touche, pas de percussion.',
      categories: 'Kumité par poids, kata en individuel et par équipe.',
    },
    seance_type: [
      { phase: 'Échauffement', minutes: 15, contenu: 'Mobilité de hanche et d’épaule, déplacements en position.' },
      { phase: 'Kihon', minutes: 25, contenu: 'Techniques en ligne, sur place puis en déplacement. La partie la plus austère, et la plus déterminante.' },
      { phase: 'Kata', minutes: 20, contenu: 'Le kata du grade, décomposé puis enchaîné.' },
      { phase: 'Kumité', minutes: 20, contenu: 'Forme conventionnelle correspondant au grade, puis libre selon le niveau.' },
      { phase: 'Retour au calme', minutes: 10, contenu: 'Étirements, salut.' },
    ],
    progression: [
      { palier: '9e à 7e kyu', reperes: ['Positions de base', 'Techniques fondamentales', 'Premiers kata Heian'] },
      { palier: '6e à 4e kyu', reperes: ['Coups de pied circulaires et latéraux', 'Kumité conventionnel', 'Heian complets'] },
      { palier: '3e à 1er kyu', reperes: ['Tekki et Bassai Dai', 'Jiyu ippon puis jiyu kumité', 'Précision sous fatigue'] },
      { palier: 'Shodan', reperes: ['Kanku Dai ou équivalent', 'Trois à cinq ans de pratique régulière selon les fédérations'] },
    ],
    erreurs: [
      { faute: 'Oublier le hikite', pourquoi: 'La main arrière au repos coûte la moitié de la puissance et laisse une ouverture.', correction: 'Le poing arrière revient à la hanche au moment exact de l’impact.' },
      { faute: 'Se redresser en se déplaçant', pourquoi: 'On perd la stabilité et l’adversaire lit le déplacement.', correction: 'La tête reste à la même hauteur pendant tout le déplacement.' },
      { faute: 'Frapper avant que la hanche ne tourne', pourquoi: 'Le bras part seul : aucune transmission.', correction: 'Hanche d’abord, bras ensuite — mais l’impact est simultané.' },
      { faute: 'Rester raide en permanence', pourquoi: 'La contraction permanente ralentit tout.', correction: 'Relâché pendant le trajet, contracté au seul moment de l’impact (kime).' },
      { faute: 'Apprendre le kata par cœur sans le comprendre', pourquoi: 'On enchaîne des formes vides.', correction: 'Demander le bunkai — l’application — des séquences.' },
    ],
    securite: {
      frequentes: ['Doigts de pied', 'Genoux (rotation en position)', 'Contacts non contrôlés en kumité'],
      prevention: [
        'Le contrôle est une compétence technique : frapper fort en kumité d’entraînement est une faute, pas une preuve.',
        'Les positions basses se construisent progressivement : forcer le kiba-dachi abîme les genoux.',
        'Protections complètes en kumité tant que le contrôle n’est pas acquis.',
      ],
      note: 'Le karaté de compétition WKF est un sport de contrôle : la puissance non maîtrisée y est sanctionnée.',
    },
    glossaire: [
      { terme: 'Kihon', definition: 'Les bases, travaillées seul.' },
      { terme: 'Kata', definition: 'Forme codifiée.' },
      { terme: 'Kumité', definition: 'Le travail à deux.' },
      { terme: 'Hikite', definition: 'Le rappel de la main arrière.' },
      { terme: 'Kime', definition: 'La contraction brève au moment de l’impact.' },
      { terme: 'Maai', definition: 'La distance de combat.' },
      { terme: 'Bunkai', definition: 'L’application d’une séquence de kata.' },
      { terme: 'Dojo kun', definition: 'Les préceptes récités en fin de séance.' },
    ],
  },

  /* ═══ LUTTE ═══════════════════════════════════════════════════════ */
  lutte: {
    format: {
      instance: 'United World Wrestling (UWW)',
      duree: '2 périodes de 3 min, 30 s de pause.',
      victoire: ['Tombé (les deux épaules au tapis)', 'Supériorité technique (10 points d’écart en libre, 8 en gréco-romaine)', 'Points à la fin du temps', 'Disqualification'],
      notation: 'Amenée au sol 2 · Projection de grande amplitude 4 ou 5 · Retournement 2 · Mise en danger 2. La passivité est pénalisée.',
      cibles: 'Lutte libre : tout le corps, jambes comprises. Gréco-romaine : au-dessus de la ceinture uniquement.',
      categories: 'Dix catégories de poids par style et par sexe.',
    },
    seance_type: [
      { phase: 'Échauffement', minutes: 20, contenu: 'Déplacements, ponts de cou, roulades. Long, et spécifique.' },
      { phase: 'Drilling', minutes: 25, contenu: 'Entrées répétées, par séries. Le volume fait la technique.' },
      { phase: 'Situationnel', minutes: 20, contenu: 'Défense de jambes, sortie de dessous, contrôle au sol.' },
      { phase: 'Live wrestling', minutes: 20, contenu: 'Opposition libre, par périodes courtes. Très exigeant.' },
      { phase: 'Renforcement', minutes: 15, contenu: 'Cou, préhension, corde à grimper.' },
    ],
    progression: [
      { palier: 'Mois 1 à 6', reperes: ['Position de garde stable', 'Changement de niveau', 'Sprawl', 'Pont de cou'] },
      { palier: 'Année 1', reperes: ['Double et single leg fonctionnels', 'Défenses de base', 'Condition physique spécifique'] },
      { palier: 'Au-delà', reperes: ['Enchaînements d’attaques', 'Travail de contrôle au sol', 'Style adapté à son gabarit'] },
    ],
    erreurs: [
      { faute: 'Se pencher en avant au lieu de plier les jambes', pourquoi: 'On se fait prendre la tête et le dos encaisse tout.', correction: 'Changement de niveau : les genoux descendent, le dos reste droit.' },
      { faute: 'Rester debout trop haut', pourquoi: 'On offre les jambes.', correction: 'Hanches basses, appuis larges.' },
      { faute: 'Attaquer de trop loin', pourquoi: 'L’adversaire a le temps de reculer les hanches.', correction: 'Combler la distance avant de changer de niveau.' },
      { faute: 'Négliger le cou', pourquoi: 'C’est l’articulation la plus sollicitée et la plus exposée.', correction: 'Renforcement spécifique dès le début, pas après la première alerte.' },
    ],
    securite: {
      frequentes: ['Oreilles en chou-fleur', 'Cou et cervicales', 'Genoux', 'Infections cutanées'],
      prevention: [
        'Le protège-oreilles évite une déformation définitive et indolore à prévenir, douloureuse à traiter.',
        'Renforcement du cou dès les premières semaines.',
        'Hygiène stricte : la lutte partage les mêmes risques cutanés que le grappling.',
      ],
      note: 'L’intensité continue rend la gestion de la récupération plus décisive qu’ailleurs.',
    },
    glossaire: [
      { terme: 'Double leg', definition: 'Saisie des deux jambes.' },
      { terme: 'Single leg', definition: 'Saisie d’une jambe.' },
      { terme: 'Sprawl', definition: 'Défense par projection des hanches en arrière.' },
      { terme: 'Tombé', definition: 'Les deux épaules au tapis : victoire immédiate.' },
      { terme: 'Gréco-romaine', definition: 'Style sans utilisation des jambes.' },
    ],
  },

  /* ═══ ESCRIME ═════════════════════════════════════════════════════ */
  escrime: {
    format: {
      instance: 'Fédération Internationale d’Escrime (FIE)',
      duree: 'Poules : 3 min ou 5 touches. Élimination directe : 3 périodes de 3 min ou 15 touches, avec 1 min de pause.',
      victoire: ['Atteindre le nombre de touches', 'Mener à la fin du temps', 'Mort subite après tirage au sort de priorité en cas d’égalité'],
      notation: 'Une touche valable donne un point. Au fleuret et au sabre, la convention de priorité décide qui marque en cas de touches simultanées.',
      cibles: 'Fleuret : le tronc. Épée : tout le corps. Sabre : au-dessus de la taille, pointe et tranchant.',
      categories: 'Par arme, sexe et catégorie d’âge.',
    },
    seance_type: [
      { phase: 'Échauffement et jambes', minutes: 20, contenu: 'Marche, retraite, fentes. Le travail de jambes se fait sans arme.' },
      { phase: 'Exercices à deux', minutes: 20, contenu: 'Séquences convenues : attaque, parade, riposte.' },
      { phase: 'Leçon individuelle', minutes: 15, contenu: 'En tête à tête avec le maître d’armes. Le moment le plus formateur de la semaine.' },
      { phase: 'Assauts', minutes: 30, contenu: 'Opposition libre, souvent à 5 touches.' },
      { phase: 'Retour au calme', minutes: 10, contenu: 'Étirements, en insistant sur la jambe avant.' },
    ],
    progression: [
      { palier: 'Mois 1 à 6', reperes: ['Garde correcte', 'Marche et retraite sans se croiser', 'Fente propre', 'Choix de l’arme'] },
      { palier: 'Année 1', reperes: ['Parades de base et ripostes', 'Notion de priorité au fleuret ou sabre', 'Premiers assauts'] },
      { palier: 'Au-delà', reperes: ['Actions préparées', 'Lecture du jeu adverse', 'Compétition régionale'] },
    ],
    erreurs: [
      { faute: 'Partir de la jambe avant la main', pourquoi: 'On annonce l’attaque et on perd la priorité.', correction: 'Le bras s’allonge D’ABORD, la jambe suit.' },
      { faute: 'Parer en repoussant fort', pourquoi: 'On ouvre une ligne et la riposte arrive trop tard.', correction: 'Dévier avec le minimum de mouvement.' },
      { faute: 'Se redresser en garde', pourquoi: 'On perd la mobilité et l’allonge.', correction: 'Genoux fléchis, dos droit, poids réparti.' },
      { faute: 'Ne regarder que la lame', pourquoi: 'On rate la préparation du corps, qui annonce tout.', correction: 'Regard large, sur l’ensemble de l’adversaire.' },
      { faute: 'Négliger la distance', pourquoi: 'La plupart des touches encaissées viennent d’une mauvaise distance, pas d’une mauvaise parade.', correction: 'Travailler la retraite autant que l’attaque.' },
    ],
    securite: {
      frequentes: ['Jambe avant : genou et adducteurs', 'Bas du dos', 'Épaule du bras armé'],
      prevention: [
        'L’asymétrie de la pratique impose un travail compensatoire de l’autre côté.',
        'La fente se construit progressivement : c’est un mouvement très exigeant pour l’adducteur.',
        'Matériel homologué et masque en bon état, sans exception.',
      ],
      note: 'L’escrime est l’un des sports de combat les moins traumatisants, mais son asymétrie se paie sur le long terme si elle n’est pas compensée.',
    },
    glossaire: [
      { terme: 'Garde', definition: 'Position de base.' },
      { terme: 'Fente', definition: 'Le déplacement offensif fondamental.' },
      { terme: 'Priorité', definition: 'La convention qui décide qui marque au fleuret et au sabre.' },
      { terme: 'Riposte', definition: 'L’attaque qui suit immédiatement une parade.' },
      { terme: 'Phrase d’armes', definition: 'La séquence d’actions d’un échange.' },
      { terme: 'Maître d’armes', definition: 'L’enseignant.' },
    ],
  },
};

export const detailDe = (key) => DETAIL[key] ?? null;

/** Contrôles de complétude — une section vide ne lève aucune erreur. */
export function detailProblems() {
  const problems = [];
  const requis = ['format', 'seance_type', 'progression', 'erreurs', 'securite', 'glossaire'];

  for (const [key, d] of Object.entries(DETAIL)) {
    for (const champ of requis) {
      if (d[champ] == null) problems.push(`${key} : « ${champ} » manquant`);
    }
    for (const e of d.erreurs ?? []) {
      // Une faute sans correction est un reproche, pas un enseignement.
      if (!e.faute || !e.pourquoi || !e.correction) {
        problems.push(`${key} : erreur incomplète — « ${e.faute ?? '?'} »`);
      }
    }
    for (const p of d.seance_type ?? []) {
      if (!p.phase || !(p.minutes > 0) || !p.contenu) {
        problems.push(`${key} : phase de séance incomplète`);
      }
    }
    if (!(d.securite?.prevention?.length > 0)) {
      problems.push(`${key} : aucune prévention listée`);
    }
  }
  return problems;
}
