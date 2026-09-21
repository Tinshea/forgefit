# ForgeFit

Suivi d'entraînement et hub santé. Microservice conteneurisé : API Node/Express,
front React/Vite, PostgreSQL avec modèle santé dynamique (JSONB).

## Démarrage (Docker)

```bash
cp .env.example .env          # ajuster POSTGRES_PASSWORD et WEBHOOK_SECRET
docker network create forgefit-mesh   # réseau partagé du pipeline de données
docker compose up -d --build
docker compose exec api npm run ingest   # charge les 1324 exercices et les classe
```

- Front : http://localhost:8080
- API : http://localhost:3000/api/health

`db` n'expose aucun port sur l'hôte : il n'est joignable que depuis le réseau
interne `forgefit-internal`. `api` est en plus attaché à `forgefit-mesh`, où les
services voisins l'atteignent à `http://forgefit-api:3000`.

## Démarrage (sans Docker)

Nécessite Node ≥ 20 et un PostgreSQL 16 accessible.

```bash
psql -d forgefit -f db/init/001_schema.sql
psql -d forgefit -f db/init/002_seed.sql

cd backend && npm install
DATABASE_URL=postgres://forgefit:forgefit@127.0.0.1:5432/forgefit npm run ingest
DATABASE_URL=postgres://forgefit:forgefit@127.0.0.1:5432/forgefit npm start

cd ../frontend && npm install
VITE_DEV_API=http://127.0.0.1:3000 npm run dev
```

## Architecture

```
navigateur ──► web (nginx, /api relayé) ──► api (Express) ──► db (PostgreSQL)
                                             ▲
sources externes ──── POST /api/health-sync ─┘
(Apple Health, IoT, montres, balances)
```

### Modèle de données

Deux régimes assumés :

- **Entraînement — relationnel et typé.** `workout_sessions` / `workout_sets`.
  Le volume (`weight × reps`) est une colonne générée : le backend et les
  requêtes analytiques ne peuvent pas diverger.
- **Santé — dynamique.** `health_metrics` ne possède aucune colonne par type de
  métrique. Sommeil, hydratation, VFC, SpO2, glycémie entrent dans un `value`
  JSONB qui conserve la charge utile native. La colonne générée `magnitude` en
  extrait un scalaire indexable pour les agrégations. **Une nouvelle source
  n'exige aucune migration.**

### Ingestion asynchrone

`POST /api/health-sync` accepte n'importe quel format, journalise le payload
brut dans `webhook_events` et répond **202** immédiatement. Un worker
(LISTEN/NOTIFY + balayage de secours) normalise ensuite hors du cycle HTTP —
un export Apple Health de 30 000 échantillons ne tient pas la connexion ouverte.

Le brut est conservé : un adaptateur corrigé permet de rejouer. L'idempotence
est garantie par un index unique partiel sur `(user_id, source, external_id)`,
donc une montre qui resynchronise 7 jours d'historique ne crée pas de doublon.

Réservation des événements par `UPDATE … RETURNING` atomique avec
`FOR UPDATE SKIP LOCKED` : plusieurs instances de l'API peuvent consommer la
même file sans traiter deux fois le même événement.

## Dataset

Source : [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset)
(1324 exercices, © Gym visual).

⚠️ **Les champs `image` / `gif_url` sont relatifs et se résolvent à la RACINE du
dépôt, pas sous `/data/` où réside le JSON.** Le préfixe intuitif
`…/main/data/` renvoie 404 sur la totalité des entrées. Voir
`EXERCISES_MEDIA_BASE`. Les médias ne sont jamais téléchargés — seules les URLs
sont stockées.

**Priorité au français.** Les instructions existent en 10 langues dans le
dataset (FR inclus, 1324/1324) et l'API les sert avec repli sur l'anglais. Les
*noms*, eux, sont anglais uniquement : ils sont traduits à l'ingestion par un
lexique de ~230 tokens, avec remise en ordre française (le matériel passe en
complément : « Développé couché à la barre », pas « Barre développé couché »).

**Deux vocabulaires de muscles à réconcilier.** Le dataset emploie des termes
différents selon le champ : `target` dit `delts` / `pectorals` / `quads`, alors
que `secondary_muscles` dit `shoulders` / `chest` / `quadriceps` pour les mêmes
muscles. Sans normalisation à l'ingestion, la vue de fatigue agrège
`shoulders` et `delts` comme deux muscles distincts et **sous-compte tout le
travail secondaire** — 400 occurrences de `shoulders` à elles seules. Les
libellés sont alignés sur le vocabulaire de `target`, qui sert aussi de clé aux
régions SVG : 40 valeurs distinctes se réduisent à 17.

**Classification dérivée.** Le dataset ne porte aucune notion de discipline —
`category` est une région anatomique. Elle est déduite du matériel et du libellé :

| Discipline | Exercices |
|---|---|
| musculation | 936 |
| callisthénie | 299 |
| souplesse | 50 |
| cardio | 29 |
| mobilité | 10 |

### Mobilité ≠ souplesse

Ce sont deux qualités distinctes, et les confondre masque le déséquilibre
qu'on cherche justement à révéler :

- **Mobilité** — amplitude **active**, sous contrôle musculaire : cercles
  articulaires, travail dynamique, auto-massage.
- **Souplesse** — amplitude **passive** : étirement tenu, sans production de
  force.

On peut être très souple et peu mobile. Le radar reste un hexagone (les 6 axes
spécifiés) et fusionne les deux sur sa branche « Mobilité » — pondérée 60/40 en
faveur de la mobilité, une amplitude qu'on contrôle protégeant mieux qu'une
amplitude subie. Les deux scores restent calculés et affichés séparément, avec
un avertissement quand l'écart dépasse 25 points.

Les dosages diffèrent : la mobilité se juge surtout sur la **fréquence** (4
séances/semaine), la souplesse sur le **temps cumulé sous tension** (90
min/semaine) — c'est lui qui produit l'adaptation du tissu.

⚠️ Le dataset ne contient que 10 exercices d'amplitude active : c'est une limite
de la source, pas du classement.

## Mathématiques

`backend/src/services/strength-standards.js`

> ### Ce que les percentiles ne sont pas
>
> **Ce ne sont pas des percentiles mondiaux.** Personne ne dispose de la
> distribution de force de la population mondiale : il faudrait le 1RM d'un
> échantillon représentatif de l'humanité, qui n'existe pas.
>
> Les tables de référence publiques sont calculées sur les charges déclarées par
> les utilisateurs d'applications de suivi. Cette population est
> auto-sélectionnée (on n'y entre qu'en décidant de logger), déjà entraînée,
> majoritairement masculine et jeune, et ses charges ne sont pas vérifiées.
>
> Un « 50ᵉ percentile » signifie donc : *médiane des pratiquants qui suivent
> leurs charges*. Rapporté à la population générale, ce niveau se situerait bien
> plus haut — la plupart des adultes n'ont jamais réalisé de 1RM.
>
> Le classement reste utile pour se situer entre pratiquants, repérer un
> déséquilibre et mesurer sa progression. L'API expose cette base avec chaque
> score (`reference`), et l'interface l'affiche : un percentile sans sa
> population de référence est ininterprétable.

Le ratio charge/poids de corps suit une loi **log-normale** dans la population
entraînée (bornée à gauche, étalée à droite — une gaussienne simple modélise mal
cette forme). Le modèle est calibré sur deux ancres des tables type
StrengthLevel :

```
mu    = ln(ratio intermédiaire)        → 50ᵉ percentile
sigma = (ln(ratio avancé) − mu) / z(0.80)
```

Le percentile est alors continu et extrapolable, là où une interpolation par
paliers saturerait aux extrémités. Standards différenciés par sexe et par
mouvement (l'écart femme/homme est bien plus marqué sur le haut du corps).

Les six axes du radar : force objective pour poussée / tirage / jambes
(percentile mondial), assiduité et volume pour endurance / mobilité /
explosivité — aucun 1RM ne résume ces trois-là.

Rang global : S ≥ 90, A ≥ 80, B ≥ 70, C ≥ 60, D ≥ 50, E ≥ 40, F < 40.

## Curation du catalogue

`backend/src/services/exercise-evidence.js`

Le dataset met ses 1324 entrées sur le même plan : le squat barre y pèse autant
que le « dumbbell biceps curl v sit on bosu ball ». Sans hiérarchie, le
catalogue est un annuaire, pas un outil de choix — et un générateur qui y pioche
au hasard produit des séances absurdes.

**144 exercices sont classés à la main**, chacun rattaché à un **patron de
mouvement** et à un **palier**, avec sa justification et ses références.

| Palier | Nombre | Critère |
|---|---|---|
| Fondamental | 22 | Polyarticulaire, charge une grande masse musculaire, se surcharge sur des années. Le seul type de mouvement pour lequel une table de force permet de se situer. |
| Complément ciblé | 79 | Couvre ce que les fondamentaux laissent de côté, ou fait mieux qu'une variante répandue selon un essai contrôlé. |
| Accessoire | 43 | Redondant avec un mouvement mieux classé, ou soutenu par peu de données directes. |

> ⚠️ **Aucun exercice n'est validé par un professionnel de santé**, et l'app le
> dit à chaque endroit où le classement apparaît. Le rang s'appuie sur la
> littérature publiée, citée ligne à ligne : c'est vérifiable et contestable,
> ce qu'une « certification » maison ne serait pas.

Ne pas figurer dans le noyau n'est pas un jugement de qualité : les 1180 autres
restent consultables et utilisables. L'interface l'écrit plutôt que de laisser
un badge absent parler à sa place.

### Ce que le classement dit, exemples

Le palier ne récompense pas la popularité d'un exercice mais ce que les essais
en mesurent. Trois cas où la littérature contredit l'usage courant :

- **Extension de triceps au-dessus de la tête** (complément, rang 1) plutôt que
  la poulie haute bras le long du corps (accessoire, rang 5). Le chef long du
  triceps croise l'épaule : il n'est étiré que bras levé. À charge et volume
  identiques, la position haute produit une croissance nettement supérieure —
  Maeo et al. (2023).
- **Leg curl assis** (rang 1) plutôt qu'allongé (rang 2). Hanche fléchie, donc
  ischio-jambiers plus allongés : +14,1 % de section contre +9,3 % sur douze
  semaines à volume identique — Maeo et al. (2021).
- **Leg extension** retenu malgré le squat. Le droit fémoral est le seul chef
  biarticulaire du quadriceps, et le squat le sollicite peu : +2,0 % en portion
  proximale contre +11,4 % au leg extension — Kassiano et al. (2026).

### Patrons de mouvement

Vingt-sept patrons — squat, charnière de hanche, tirage vertical, extension de
coude, endurance continue, fractionné… Chacun porte les **groupes musculaires** qu'il charge, en principal et en
secondaire. C'est l'unité qui permet de raisonner un programme : « un tirage
vertical » survit à un changement de salle, « traction à la barre fixe » non.

La pondération du travail secondaire est de **0,4**, la même que la vue
`muscle_load_recent` du schéma. Sans cette égalité, le volume annoncé par un
programme contredirait la carte de fatigue de la même personne.

La curation vit en JS, pas en base : c'est un jugement éditorial qui se relit et
se versionne dans git. La base n'en garde qu'une projection, reconstruite à
chaque `npm run curate` — donc jamais divergente de sa source. Le script
signale tout identifiant classé que le dataset ne fournirait plus, au lieu
d'échouer en silence.

## Modèles de programme

`backend/src/services/templates.js` · onglet **Programme → Modèles**

Quinze modèles, répartis en sept catégories, couvrant les cinq disciplines du
catalogue — musculation, callisthénie, mobilité, souplesse et endurance.

| Catégorie | Modèle | Jours | Niveau | Matériel |
|---|---|---|---|---|
| Démarrage | Corps entier | 3 | Débutant | Salle complète |
| Démarrage | Reprise | 3 | Débutant | Deux haltères |
| Prise de muscle | Haut / Bas | 4 | Intermédiaire | Salle complète |
| Prise de muscle | Poussée / Tirage / Jambes | 6 | Avancé | Salle complète |
| Force maximale | Force | 3 | Intermédiaire | Barre et rack |
| Endurance | Endurance | 3 | Intermédiaire | Salle complète |
| Endurance | Fractionné court | 3 | Intermédiaire | Poids du corps |
| Force et endurance | Force et endurance | 4 | Intermédiaire | Salle complète |
| Sans salle | Poids du corps | 3 | Débutant | Aucun matériel |
| Sans salle | Callisthénie | 4 | Intermédiaire | Aucun matériel |
| Sans salle | Deux haltères | 3 | Débutant | Deux haltères |
| Santé & mobilité | Minimaliste | 2 | Débutant | Deux haltères |
| Santé & mobilité | Mobilité & santé | 3 | Tous niveaux | Aucun matériel |
| Santé & mobilité | Souplesse | 5 | Tous niveaux | Aucun matériel |
| Santé & mobilité | Recommandations OMS | 5 | Tous niveaux | Deux haltères |

### Ce que l'endurance change au dosage

Une séance d'endurance ne se compte pas en séries. Le dosage y est en **minutes
hebdomadaires**, confronté au plancher de santé de 150 minutes d'activité
modérée — une minute vigoureuse en valant deux.

L'ordre des exercices d'endurance n'est pas neutre non plus : l'interférence de
l'endurance sur la force dépend de la **modalité**. Le vélo n'a pas montré de
pénalité mesurable sur l'hypertrophie et la force, la course si. Le catalogue
curé classe donc le vélo et l'elliptique devant la course, et le modèle hybride
s'appuie dessus plutôt que de demander de choisir entre les deux objectifs.

> Le modèle « Force et endurance » reste volontairement **sous** le plancher de
> 150 minutes, et l'écrit dans sa justification : plus la durée d'endurance
> accumulée est longue, plus elle pénalise la force. C'est un arbitrage, pas un
> oubli — la marche quotidienne comble l'écart.

La souplesse suit le même principe : ≈ **10 minutes par groupe musculaire et par
semaine**, sans bénéfice au-delà de 4 minutes par séance. Le modèle « Souplesse »
en fait cinq séances courtes plutôt que deux longues — à volume égal le résultat
est comparable, mais dix minutes se trouvent là où quarante ne se trouvent pas.

### Un modèle est une structure, pas une liste d'exercices

Un modèle décrit des **patrons**, jamais des exercices nommés. Le matériel
n'intervient qu'à la résolution : le même modèle « Haut / Bas 4 jours » donne un
développé couché à la barre en salle, et aux haltères à la maison. La structure
et le dosage ne bougent pas.

Quand aucun exercice du patron n'est réalisable avec le matériel choisi, la
résolution sort du profil **et le signale** (`substitutions`), au lieu de
proposer en silence un mouvement irréalisable. Si le catalogue ne couvre pas du
tout le patron, le créneau est laissé vide et annoncé comme tel
(`unresolved`) — un programme qui prétendrait couvrir un patron sans le faire
serait pire que le trou.

### Le dosage est calculé, pas déclaré

Un programme qui annonce « prise de masse » demande de croire sur parole.
`templateVolume()` calcule le volume hebdomadaire **par groupe musculaire** et le
confronte aux repères d'`evidence.js`. L'écart est affiché, pas corrigé en
douce :

```
Haut / Bas — 4 jours
  Dos 15,6 (2×/sem.) · Fessiers 14 · Deltoïdes 13,2 · Biceps 11,6 …
```

> L'agrégation par **muscle** et non par axe n'est pas un détail. « Poussée »
> mélange pectoraux, deltoïdes et triceps : comparer son total au plafond de 22
> séries par muscle déclencherait une alerte sur tout programme un peu fourni.
> La première version faisait cette erreur, et signalait trois faux dépassements
> sur quatre modèles.

Les avertissements sont **regroupés par nature** : un message par muscle
sous-dosé noierait le seul qui compte. Et un muscle travaillé uniquement en
second n'est jamais jugé contre les repères — les trapèzes d'un programme qui ne
les cible pas n'ont pas à déclencher d'alerte.

Le travail chronométré (mobilité, souplesse, endurance) est compté en **minutes
hebdomadaires**, jamais en séries : il ne relève pas de la même dose-réponse.

## Construire son propre programme

Tout programme est modifiable, quelle que soit sa provenance — généré depuis le
radar, issu d'un modèle, ou composé de zéro. La colonne `origin` le conserve :
trois programmes identiques en structure n'ont pas la même autorité selon leur
origine, et l'interface doit pouvoir le dire.

- **Séances** : ajouter, renommer, changer la dominante, supprimer. Sept au
  maximum — `day_index` est unique et borné, et le premier indice libre est
  réattribué plutôt qu'incrémenté, sinon un trou deviendrait impossible à combler.
- **Lignes** : ajouter depuis le sélecteur (noyau curé d'abord), modifier séries,
  fourchette de répétitions, charge et repos, réordonner, supprimer.
- **Duplication** : partir d'un modèle sans perdre l'original. La copie devient
  `manual` — elle n'est plus le reflet du générateur dès qu'elle est modifiable.

La **fourchette de répétitions** (`target_reps_max`) sert la double progression :
monter les répétitions jusqu'au haut de la fourchette, puis augmenter la charge
et repartir en bas. Progresser en répétitions ou en charge donne des adaptations
comparables — ce qui compte est qu'il y ait progression.

> **Réordonner sans casser l'unicité.** Les positions sont uniques par séance :
> permuter deux lignes par écriture directe passerait forcément par un état où
> elles partagent la même position. Le réordonnancement passe donc par des
> positions **négatives**, qui ne peuvent entrer en collision avec aucune
> position valide.

Le raisonnement d'origine reste affiché **tel quel** après modification : il dit
pourquoi le programme était ainsi au départ, pas ce qu'il est devenu. L'interface
l'écrit, plutôt que de laisser croire que le tableau de volume décrit encore le
contenu courant.

### Évolutions de schéma

`backend/src/db/schema-updates.js`

Les fichiers de `db/init` ne s'exécutent qu'au **premier** boot d'un volume
Postgres vide, et l'image de l'API ne copie que `src/`. Les colonnes ajoutées
ici (paliers, patrons, provenance des programmes) vivent donc en JS, sont
idempotentes, et sont rejouées à chaque démarrage sous **verrou consultatif** —
plusieurs instances d'API peuvent démarrer ensemble sans se marcher dessus sur
du DDL.

## Calendrier

`backend/src/services/scheduling.js` · onglet **Entraînement → Calendrier**

Le calendrier croise le **plan** et le **fait**. Les deux sont nécessaires : un
calendrier qui n'affiche que le programme ne dit pas si on l'a suivi, et un
historique seul ne dit pas ce qui était prévu.

### `day_index` n'est pas un jour de la semaine

`day_index` dit l'ORDRE des séances. Coller un programme de quatre jours sur
lundi-mardi-mercredi-jeudi concentrerait toute la charge sur la première moitié
de semaine — or c'est la récupération qui limite, et à volume égal la
répartition fait la différence. D'où une colonne `weekday` distincte, et des
répartitions par défaut qui placent les jours de repos là où ils servent :

| Séances | Placement |
|---|---|
| 2 | lundi, jeudi |
| 3 | lundi, mercredi, vendredi |
| 4 | lundi, mardi, jeudi, vendredi |
| 5 | lundi, mardi, mercredi, vendredi, samedi |

C'est un point de départ : chaque séance se déplace à la main. Déplacer une
séance sur un jour occupé **échange** les deux — c'est ce qu'un déplacement
laisse attendre, et l'index unique refuserait l'écriture directe. L'échange
passe par `NULL` : donner d'abord son ancien jour à l'autre séance ferait
cohabiter deux lignes sur la même valeur le temps d'une requête.

### Le cycle démarre un lundi

`programs.starts_on` est calé sur le **lundi** de la semaine en cours. Un
programme démarré un jeudi ferait chevaucher ses semaines sur deux semaines de
calendrier : « semaine 2 du programme » tomberait au milieu d'une ligne, et le
volume hebdomadaire — l'unité de dosage — ne se lirait plus d'une traite.

> **Le fuseau vient du navigateur.** Sans lui, une séance commencée à 00 h 30 à
> Paris serait datée de la veille : Postgres tronque un `timestamptz` en UTC.
> Le paramètre `tz` est validé avant d'atteindre la base.

## Abonnement au calendrier externe

`backend/src/services/icalendar.js` · onglet **Calendrier → Ajouter à mon agenda**

Un **flux iCalendar** (RFC 5545) plutôt que l'API Google Calendar. Le choix n'est
pas un pis-aller : une URL `.ics` s'abonne depuis Google, Apple, Outlook et à peu
près tout le reste, sans compte développeur, sans OAuth et sans jeton à
renouveler. C'est aussi la seule voie utilisable sur un serveur personnel.

```
Calendrier → Ajouter à mon agenda → copier le lien
Google Agenda → Autres agendas → + → À partir de l'URL
```

### Ce que le format impose, et qui se voit rarement

- **Un évènement par séance, répété par `RRULE`**, pas une occurrence par
  semaine : émettre 32 évènements pour un programme de 8 semaines gonflerait le
  fichier et, surtout, empêcherait l'agenda de reconnaître une série.
- **`UID` stable** (`<id du jour>@forgefit`). Sans lui, chaque
  resynchronisation créerait des doublons au lieu de mettre à jour.
- **Pliage des lignes à 75 octets**, sur les OCTETS et non les caractères : « é »
  en compte deux, et couper au milieu produirait un fichier invalide.
- **Échappement de `\`, `;`, `,` et des retours à la ligne.** Une virgule non
  échappée coupe la valeur en deux listes de paramètres — le titre d'une séance
  suffirait à casser tout le fichier.
- **CRLF partout**, imposé par la norme ; certains clients refusent un fichier en
  LF seul.

### Le fuseau horaire est défini dans le fichier

`DTSTART;TZID=Europe/Paris` sans composant `VTIMEZONE` n'est pas conforme :
Google et Apple résolvent les noms IANA malgré tout, mais un fichier valide ne
doit pas dépendre de leur tolérance.

Les décalages ne sont pas codés en dur — une table de fuseaux recopiée à la main
serait périmée à la première réforme d'heure d'été. Ils sont lus dans le moteur
d'internationalisation, et les deux transitions annuelles sont trouvées par
balayage journalier puis dichotomie à la minute. La règle annuelle en est
déduite sous la forme attendue (« dernier dimanche de mars »), et non comme une
date fixe qui serait fausse dès l'année suivante.

> **Pourquoi pas des horodatages UTC ?** Un évènement hebdomadaire ancré en UTC
> dériverait d'une heure au passage à l'heure d'été. Une séance à 18 h 30 doit
> rester à 18 h 30.

### Le lien est un secret révocable

Une application d'agenda sonde une URL toutes les quelques heures ; elle ne sait
pas envoyer d'en-tête d'authentification. Le secret tient donc dans l'URL, sous
forme d'un jeton dédié (`users.calendar_token`) — jamais l'identifiant
d'utilisateur, qui sert ailleurs et ne se révoque pas.

Un jeton inconnu renvoie **404, pas 401** : l'abonnement n'a aucune identité à
présenter, et un 401 ferait redemander un mot de passe à une application qui n'en
a pas. Régénérer le jeton coupe les abonnements existants — c'est le seul moyen
de reprendre un lien partagé par erreur.

Sans programme actif, le flux reste un fichier **valide et vide**. Renvoyer une
erreur ferait afficher un abonnement en échec, alors que la situation est
normale.

## Séance guidée et chronomètres

Onglet **Entraînement → Séance**

Démarrer une séance depuis le calendrier la rattache au jour de programme
(`workout_sessions.program_day_id`). Le mode Terrain charge alors le plan :
exercices, séries visées, fourchette de répétitions, charge conseillée et temps
de repos. La progression s'affiche par exercice (`2/4 séries`) et pour la séance
entière.

Une séance libre reste possible, et les deux coexistent : ajouter un exercice
hors programme ne doit pas obliger à ouvrir une seconde séance. Le catalogue
**entier** y est accessible — 1324 exercices, les classés en tête.

### « Je fais quoi, là ? »

C'est la première question à l'ouverture de l'app, et elle doit trouver sa
réponse sur le premier écran. La carte **Aujourd'hui** affiche la séance du jour
et la démarre d'un geste ; à défaut, elle dit qu'il s'agit d'un jour de repos —
la récupération fait partie du programme, ce n'est pas un trou à combler.

Elle disparaît dès qu'une séance est ouverte : pendant la séance, c'est le
journal qui compte. Et si le calendrier n'est pas joignable, elle ne s'affiche
simplement pas — le mode Terrain reste utilisable sans programme, et une carte
absente vaut mieux qu'un bandeau d'erreur en haut d'un écran de saisie.

### Le calendrier change de forme, pas de contenu

Sept colonnes ne tiennent pas sur un téléphone. Sous 760 px, la semaine devient
une **liste verticale** : plus longue, mais lisible d'un pouce. Un défilement
horizontal obligerait à balayer pour savoir ce qu'il y a jeudi.

En liste, la semaine précédente n'est plus affichée par défaut — elle imposerait
de défiler sept lignes avant d'atteindre la semaine en cours. Le bouton
« Semaine précédente » suffit alors.

### Les chronomètres comptent depuis un instant, jamais à rebours

C'est la seule forme qui survit au terrain. L'écran se verrouille, l'onglet
passe en arrière-plan, et le navigateur bride alors `setInterval` à une fois par
minute : un compteur décrémenté perdrait le temps écoulé. Les deux chronomètres
— temps de séance et minuteur de repos — calculent à partir d'une date, et se
remettent à l'heure au retour au premier plan.

Le minuteur de repos est amorcé par le `rest_seconds` de la ligne de programme —
les repos courts amputent les séries suivantes, c'est un paramètre
d'entraînement, pas un confort. Il reste ajustable à la volée (± 30 s), survit à
un rechargement de page (`localStorage`), et signale la fin par **vibration et
bip court** : le téléphone est dans une poche, un changement visuel seul ne se
remarque pas.

### Reprendre plutôt que recommencer

`GET /api/workouts/open` rend la séance en cours. Sans elle, revenir sur
l'onglet après un verrouillage d'écran ouvrirait une **seconde** séance et
couperait l'historique en deux.

## Programme généré depuis le radar

Troisième voie, à côté des modèles et de la construction manuelle.
`POST /api/programs/generate` construit un programme à partir du **radar**, pas
d'un modèle figé : là où un modèle applique une structure éprouvée, le
générateur part de ce qui est mesuré chez la personne. Il lui faut donc des
séances déjà enregistrées pour être utile — sur un compte neuf, un modèle
donnera un meilleur point de départ.

### L'unité de dosage : la série hebdomadaire par muscle

`backend/src/services/evidence.js` regroupe les paramètres d'entraînement, **chacun
avec sa source**. Un générateur qui sort des chiffres sans référence n'est qu'une
opinion déguisée en algorithme.

| Repère | Valeur | Fondement |
|---|---|---|
| Entretien | 6 séries/muscle/sem. | conserve les acquis |
| Minimum efficace | 10 | seuil de progression |
| Fenêtre d'adaptation | 12–20 | zone visée pour un point faible |
| Plafond récupérable | 22 | au-delà, la récupération limite |
| Fréquence | ≥ 2×/muscle/sem. | à volume égal, répartir > concentrer |
| Proximité de l'échec | 1–3 reps en réserve | l'échec ne rend pas plus, il coûte plus |
| Repos | 2–3 min (hypertrophie), 3–5 (force) | les repos courts amputent les séries suivantes |

Le raisonnement va donc : *score radar → volume hebdomadaire visé → réparti sur
les séances → converti en exercices → dosé en séries/reps/charge*. Un score bas
pousse le volume vers le plafond récupérable, un score élevé le ramène vers
l'entretien — **jamais en dehors de ces bornes**.

> **Contrainte rendue explicite.** Un axe vu une seule fois par semaine ne peut
> pas absorber 22 séries. Le générateur plafonne alors le volume à ce qui est
> réellement livrable et **le signale** (`capped_by_frequency`), au lieu de
> promettre une dose qu'il ne programme pas. C'est un test qui a révélé l'écart :
> `core` visait 22 séries et n'en recevait que 12.

Sources principales : Schoenfeld, Ogborn & Krieger (2017) pour la dose-réponse
du volume ; Schoenfeld et al. (2016) pour la fréquence et les repos ; travaux sur
la proximité de l'échec mesurée en RIR. Les références sont affichées dans
l'interface, sous le programme.

Le choix des exercices privilégie les mouvements **fondamentaux** (ceux qui ont
un standard de force, donc une charge calculable), puis la charge libre. Un
`ROW_NUMBER() OVER (PARTITION BY target)` prend le meilleur mouvement de chaque
muscle avant d'en reprendre un second sur les mêmes muscles : la séance se
remplit sans concentrer tout le volume sur un seul groupe.

**Tout est justifié jusqu'à l'exercice.** `programs.rationale` conserve les
scores, la règle appliquée et la table d'allocation ; `program_items.rationale`
porte, pour chaque ligne, l'axe visé, le score correspondant, la règle
déclenchée et la base de calcul de la charge. L'interface affiche cette chaîne
— sinon l'utilisateur subit une liste d'exercices sans savoir pourquoi ceux-là.

Les charges conseillées découlent du 1RM estimé × l'intensité de l'objectif,
arrondies au pas de 2,5 kg (l'incrément réel des disques). Les étirements sont
dosés en secondes, jamais en répétitions.

Un seul programme actif par utilisateur, garanti par un index unique partiel
(`WHERE is_active`) plutôt que par du code applicatif.

## Profil et mesures corporelles

`backend/src/services/anthropometry.js` · onglet **Profil**

Point d'entrée unique pour le sexe, la date de naissance, la taille, le poids, le
taux de masse grasse, l'objectif et le niveau d'activité. Tout ce que l'app
calcule en découle.

### La taille n'est pas décorative

Les formules assises sur la masse maigre exigent de connaître son taux de masse
grasse — ce que la plupart des gens ignorent, et sans quoi elles ne peuvent pas
s'appliquer du tout. **Mifflin-St Jeor** et **Harris-Benedict** prennent en entrée
taille, poids, âge et sexe, des données que tout le monde possède : ce sont les
replis, et c'est là que la taille devient indispensable.

### Cinq formules, pas une

Aucune équation prédictive n'est « la bonne ». Validées contre calorimétrie
indirecte, les meilleures placent environ deux tiers des sujets à ±10 % de leur
dépense réelle — et se trompent de plus de 10 % pour le tiers restant. Sur
1 700 kcal, ±10 % font ±170 kcal : de quoi transformer un déficit visé en
maintien.

Imposer une formule reviendrait à masquer cette incertitude. L'application
expose les cinq, **calculées sur le profil courant**, et laisse choisir :

| Formule | Entrées | Précision | Source |
|---|---|---|---|
| Katch-McArdle | masse maigre | haute | Katch & McArdle (1996) |
| Cunningham | masse maigre | haute | Cunningham (1980), *Am J Clin Nutr* |
| Mifflin-St Jeor | taille, poids, âge | moyenne | Mifflin et al. (1990) |
| Harris-Benedict révisée | taille, poids, âge | moyenne | Roza & Shizgal (1984) |
| Owen | poids | basse | Owen et al. (1986) |

Sur un profil réel (63,5 kg de masse maigre, 75 kg, 178 cm, 30 ans), elles
s'étalent de 1 675 à 1 897 kcal — **222 kcal d'écart**. Ce nombre est affiché
tel quel : c'est l'ordre de grandeur de ce qu'on ne sait pas.

`bmr_method` vaut `auto` par défaut — la mieux informée des formules applicables.
Un choix explicite est respecté tant que ses entrées existent ; sinon l'API
retombe **et le signale** (`fell_back: true`), plutôt que de laisser croire que la
méthode demandée a servi. En mode automatique, la réponse nomme la mesure qui
débloquerait la formule du rang au-dessus.

### La calibration bat toutes les formules

`backend/src/services/tdee-calibration.js` · `GET /api/nutrition/calibration`

Le bilan énergétique n'est pas une corrélation de population, c'est une identité
comptable :

```
dépense = apport moyen − (Δ poids × 7 700 / nombre de jours)
```

Avec assez de journal et de pesées, elle dit ta dépense **réelle**, pas celle
d'une personne moyenne te ressemblant. Quatre garde-fous, sans lesquels le
chiffre serait pire qu'aucun chiffre :

- **Régression linéaire** sur toutes les pesées, jamais « dernier moins premier » :
  une seule mesure un jour de rétention d'eau suffirait à inverser la pente.
- **14 jours minimum** et 6 pesées : en dessous, le bruit hydrique dépasse le
  signal.
- **Les jours non journalisés sont exclus**, pas comptés à zéro. Au-delà de 20 %
  de jours manquants, le calcul est refusé — ce sont rarement les petites
  journées qu'on oublie de noter.
- **Fenêtre commune** aux apports et aux pesées : moyenner des repas antérieurs
  à la période pesée mélangerait deux régimes.

La réponse compare la mesure à la prédiction (`prediction_error_kcal`) et déduit
le **multiplicateur d'activité réel**, à confronter à celui qui a été déclaré.
Adopter la mesure bascule `bmr_method` sur `mesure` : plus aucune formule n'est
utilisée.

> 7 700 kcal/kg (Wishnofsky, 1958) vaut pour une variation surtout adipeuse.
> C'est la principale approximation de la méthode, et la raison d'exiger une
> fenêtre longue : le glycogène et l'eau oscillent, la graisse dérive.

La taille sert aussi à l'**IMC** et au **FFMI** — l'équivalent musculaire de l'IMC,
normalisé à 1,80 m, qui permet de comparer des gabarits différents.

> L'IMC ne distingue pas muscle et graisse. Chez un pratiquant entraîné il sort
> régulièrement en « surpoids » sans excès d'adiposité : la fiche le signale
> quand le FFMI indique une masse maigre élevée, plutôt que de laisser lire un
> contresens.

### Faire entrer les données de l'iPhone

Deux voies, **toutes deux gratuites** :

**1. Import de l'historique complet** — le plus simple pour démarrer.

Sur l'iPhone : *Santé → photo de profil → Exporter toutes les données de santé*.
Un `export.zip` en sort ; le dézipper donne `apple_health_export/export.xml`.

```bash
cd backend
npm run import:health -- --file "chemin/export.xml" --dry-run   # simulation
npm run import:health -- --file "chemin/export.xml"
```

Récupère **des années d'historique en une fois**. Idempotent : réimporter un
export plus récent ne duplique rien, grâce à une clé déterministe dérivée du
type, de la date et de la source — l'export d'Apple ne porte aucun identifiant
unique.

> Ce fichier atteint couramment plusieurs centaines de mégaoctets : l'app Santé
> enregistre les pas toutes les quelques minutes depuis des années. L'importeur
> le lit **en flux, ligne à ligne**, sans jamais le charger en mémoire. Les
> métriques cumulatives (pas, calories) sont agrégées par jour — les importer
> fragmentées créerait des centaines de milliers de lignes pour une information
> qui ne se lit qu'au jour.

**2. Synchronisation continue par Raccourcis** — l'app native d'Apple, gratuite.

Un raccourci qui lit les échantillons Santé et fait un `POST` sur
`/api/health-sync`, déclenché par automatisation quotidienne. Le webhook accepte
les formes simples que Raccourcis produit naturellement :

```json
{"type": "weight", "value": 76.3, "unit": "kg"}
{"metrics": [{"type": "weight", "value": 76.3}, {"type": "sleep", "value": 7.4}]}
```

> *Health Auto Export* fait la même chose de façon plus confortable, mais son
> automatisation REST API est **payante**. Les deux voies ci-dessus ne coûtent
> rien.

### La balance connectée remplit le profil

Une balance à impédance (Renpho, Withings…) publie dans Santé bien plus que le
poids : **taux de masse grasse, masse maigre, masse musculaire, eau corporelle,
graisse viscérale, et parfois la taille**. Le webhook les reprend, le profil s'en
sert.

Conséquence directe : le taux de masse grasse arrivant automatiquement, l'app
**bascule seule de Mifflin-St Jeor à Katch-McArdle**. Et la masse maigre étant
mesurée, elle n'est même plus déduite du taux de masse grasse.

| Mesure | Rôle |
|---|---|
| poids, taille, masse grasse, masse maigre | entrent dans tous les calculs |
| masse musculaire, eau, os, graisse viscérale | suivies pour la tendance uniquement |

Les secondaires ne servent à aucun calcul : la bioimpédance les estime avec une
fiabilité trop faible pour asseoir un objectif dessus. Elles restent utiles pour
lire une évolution.

> **Un seul résolveur d'état corporel.** `services/body-profile.js` arbitre entre
> mesure d'appareil, valeur saisie et déduction. Chaque route qui refaisait cet
> arbitrage produisait un résultat différent : la page Profil affichait 1776 kcal
> de métabolisme de base pendant que la page Nutrition affichait 1742 — deux
> chiffres pour la même grandeur. Un test d'intégration verrouille désormais leur
> égalité.

### Le poids mesuré prime sur le poids saisi

Une balance connectée écrit dans `health_metrics`. La mesure la plus récente
l'emporte sur la valeur du profil — un poids saisi une fois puis jamais corrigé
fausserait durablement la dépense énergétique, les standards de force et
l'objectif d'hydratation. Symétriquement, un poids saisi dans le profil est
enregistré **comme une mesure**, pour qu'il alimente la courbe.

### Hydratation proportionnelle

L'objectif était figé à 2500 ml. Il vaut désormais **35 ml/kg**, plus 600 ml par
heure d'entraînement du jour : la même quantité d'eau ne représente pas le même
effort à 60 kg et à 95 kg.

### Ce que chaque mesure débloque

L'écran liste les champs vides **avec ce qu'ils permettent** (`gaps`) plutôt
qu'une simple liste de trous — remplir un formulaire sans savoir pourquoi n'a
aucun intérêt.

## Nutrition

Modèle repris d'un tableur personnel, dont les formules ont été **recalculées et
confirmées à la décimale** avant d'être transcrites (`test/nutrition.test.js`
verrouille la correspondance).

Tout est assis sur la **masse maigre**, pas sur le poids total :

```
BMR    = 370 + 21,6 × masse maigre        (Katch-McArdle)
TDEE   = BMR × multiplicateur d'activité   (1,2 → 1,725)
Cible  = TDEE × facteur d'objectif         (0,85 / 1,0 / 1,1)

Protéines = 2,2 g/kg de masse maigre (perte) · 1,8 (maintien, prise)
Lipides   = 0,8 g/kg (perte) · 1,0 (maintien) · 1,1 (prise)
Glucides  = reliquat calorique ÷ 4
```

Sans taux de masse grasse, la dépense bascule sur Mifflin-St Jeor et les macros
sur le poids total minoré de 15 % — appliquer 2,2 g/kg au poids total
surestimerait nettement les besoins de quelqu'un ayant beaucoup de masse grasse.

Deux personnes de 80 kg à 12 % et 30 % de masse grasse n'ont ni le même
métabolisme de base ni les mêmes besoins protéiques ; rapporter les g/kg au poids
total surestimerait nettement la seconde.

### Le journal compte, le coach propose

`backend/src/services/nutrition-evidence.js` · `meal-planner.js` · `recipe-catalogue.js`

Un journal alimentaire sait dire ce qui a été mangé et ce qu'il reste. Il ne
sait rien **proposer** — et c'est précisément la question qu'on se pose à midi.

**25 recettes** composées d'aliments du catalogue. Leurs macros ne sont jamais
saisies : la vue `recipe_macros` les recalcule depuis les ingrédients. Deux
sources de vérité pour les mêmes calories divergeraient à la première correction
de fiche.

> Les quantités sont **toujours en grammes**, y compris pour ce qui se compte à
> la pièce : deux œufs valent 100 g, une dose de whey 30 g. Un test vérifie que
> chaque ingrédient à l'unité est un multiple entier de sa pièce — écrire « 2 »
> pour deux œufs diviserait leur apport par cinquante.

### La suggestion part du jour, pas du catalogue

`GET /api/nutrition/suggestions` calcule le budget du repas à partir de ce qu'il
reste **divisé par les repas encore à prendre**. Sans ce partage, un déjeuner
consomme tout le budget et il reste 200 kcal pour le dîner.

Le macronutriment contraignant est la **protéine** : les glucides absorbent
l'ajustement calorique, les lipides ont une fourchette large, la protéine a un
plancher qu'on rate ou qu'on atteint. Le classement pèse donc la couverture
protéique à 45 %, l'ajustement calorique à 25 %, la densité protéique à 15 % et
les fibres à 10 %, avec une pénalité sur le dépassement du budget du jour.

Les portions proposées sont des fractions servables — ×0,5 à ×2 — et non
×1,37. Et **chaque suggestion affiche la raison de son rang** : un classement
qu'on ne peut pas contredire ne vaut pas mieux qu'un tirage au sort.

Enregistrer une recette écrit ses **ingrédients**, pas la recette : le journal
reste une liste d'aliments modifiable ligne à ligne, et supprimer une recette du
catalogue n'efface pas ce qui a été mangé.

### Tes cibles face à la littérature

Le journal confronte les cibles calculées aux repères publiés, et affiche des
**constats, pas des corrections**. Les ajuster en douce rendrait le calcul
invérifiable — or c'est la vérifiabilité qui distingue un repère d'une opinion.

| Repère | Valeur | Source |
|---|---|---|
| Protéines, entretien ou surplus | 1,6–2,2 g/kg de poids | Morton et al. (2018), *Br J Sports Med* |
| Protéines, en déficit | 2,3–3,1 g/kg de **masse maigre** | Helms et al. (2014), *IJSNEM* |
| Protéines par repas | ≈ 0,4 g/kg, sur ≥ 4 repas | Schoenfeld & Aragon (2018), *JISSN* |
| Fibres | ≥ 25 g/jour | EFSA (2010) |

Deux régimes distincts pour les protéines, et c'est la distinction qui compte :
à l'entretien la cible se rapporte au **poids de corps**, en déficit à la **masse
maigre** et elle monte nettement — l'enjeu n'est plus de construire mais de ne
pas perdre.

> ⚠️ Ces repères valent pour un adulte en bonne santé qui s'entraîne. Ils ne
> remplacent pas un avis médical, et ne conviennent pas en cas de pathologie
> rénale, de grossesse, de trouble du comportement alimentaire ou de traitement
> en cours. L'interface l'affiche avec la revue.

### Sources d'aliments

| Source | Rôle |
|---|---|
| Catalogue local (83 aliments) | Source primaire — repris du tableur, **avec les prix** |
| [Open Food Facts](https://world.openfoodfacts.org/) | Complément pour les produits emballés, par code-barres |

Le local passe toujours en premier. Open Food Facts est libre et sans clé, mais
sa recherche plein texte renvoie régulièrement des 503 et ses valeurs sont
saisies par des contributeurs, sans vérification. Un journal alimentaire ne doit
pas cesser de fonctionner parce qu'un tiers est en panne : l'indisponibilité
renvoie un 503 explicite avec une consigne de repli, jamais une erreur applicative.

Tout produit importé passe par un **contrôle de cohérence** : les calories
déclarées doivent correspondre aux macronutriments à ±15 %. C'est le garde-fou
contre les erreurs de facteur 10 ou d'unité, fréquentes sur les données
collaboratives.

> **Les fibres sont comptées dans les glucides**, et valorisées à 2 kcal/g
> (règlement UE 1169/2011) et non 4. Les facturer comme des glucides
> assimilables surestimait l'énergie de tous les légumes et légumineuses — le
> contrôle de cohérence signalait à tort brocolis, épinards et champignons.

### Catalogue visuel

L'onglet **Aliments** affiche chaque produit avec ses macros, son prix et une
barre montrant la part calorique de chaque macronutriment — la nature de
l'aliment se lit d'un coup d'œil.

Le tri par **€ / 10 g de protéines** répond à la question qu'on se pose vraiment
en faisant ses courses. Sur ce catalogue il place les pâtes complètes et le pain
devant le blanc de poulet : les féculents complets sont une source de protéines
bien meilleur marché qu'on ne le croit, même si leur densité protéique est plus
faible.

> **Images.** Les produits scannés portent leur photo Open Food Facts. Les
> aliments génériques n'en ont pas : il n'existe pas de base d'images libres
> couvrant « blanc de poulet » ou « riz complet cuit » de façon fiable, et en
> constituer une serait un projet à part. Un pictogramme de catégorie remplit ce
> rôle sans dépendance réseau.

### Le prix est suivi comme un macronutriment

Chaque aliment porte un prix, chaque entrée du journal son coût au prorata, et
chaque journée son total. C'est ce qui distingue ce catalogue des bases
publiques : le prix est une donnée personnelle, liée à ses propres magasins. Un
plan alimentaire qu'on ne peut pas se payer n'est pas un plan.

### Le journal est un fait historique

Les valeurs sont **figées à la saisie**, pas recalculées à la lecture. Corriger
la fiche d'un aliment ne réécrit pas ce qui a déjà été mangé, et supprimer un
aliment du catalogue ne troue pas l'historique.

## Entraînement et assiette

`backend/src/services/training-load.js` · onglet **Nutrition → Journal**

> **Le piège que ce service évite.** Le multiplicateur d'activité
> (× 1,375 « léger », × 1,55 « modéré ») **inclut déjà l'entraînement**. Ajouter
> les calories d'une séance par-dessus les compterait deux fois et gonflerait
> l'objectif de plusieurs centaines de kilocalories par jour. Aucune calorie
> n'est donc créée ici.

Deux choses sont faites, toutes deux à énergie constante :

**1. L'activité déclarée est confrontée à l'enregistrée.** Le multiplicateur est
l'entrée la plus lourde du calcul de dépense, et la seule qu'on choisit une fois
sans jamais la revoir. Un cran d'écart vaut ≈ 300 kcal par jour — le chiffre est
affiché, parce que « ×1,375 au lieu de ×1,55 » ne dit rien à personne.

**2. Le total hebdomadaire se répartit** entre jours d'entraînement et jours de
repos. Ce qui est ajouté d'un côté est retiré de l'autre, exactement : un test
vérifie pour chaque combinaison que la somme des sept jours reste égale à sept
fois l'objectif de base. Sans jour de repos dans la semaine, la répartition est
refusée et expliquée — on ne retire rien d'un ensemble vide.

Les **protéines ne varient pas** selon le jour : la littérature donne une cible
quotidienne, pas une cible par séance. Et à apport hebdomadaire égal, aucun essai
ne montre d'avantage clair de la répartition sur la composition corporelle — son
intérêt est pratique, l'interface le dit.

> **Défaut corrigé au passage.** Les minutes d'entraînement étaient mesurées sur
> la somme des durées de SÉRIES. Or seules les séries chronométrées en portent
> une : une séance de musculation de 75 minutes comptait pour zéro, ce qui
> annulait le supplément d'hydratation les jours où il était justement
> nécessaire. La durée vient désormais de la séance, et la même expression est
> utilisée des deux côtés — deux définitions produisaient deux objectifs
> d'hydratation différents dans la même application.

## Adhérence

`backend/src/services/adherence.js` · onglet **Progression → Aperçu**

L'application savait dire ce qui avait été fait. Elle ne savait pas dire ce qui
avait été **raté** — or c'est la seule information qui explique une progression
qui stagne. Un programme parfait suivi une fois sur deux vaut moins qu'un
programme moyen suivi.

Le bilan croise les jours de programme placés et les séances rattachées, semaine
par semaine, avec trois compteurs distincts :

| Compteur | Ce qu'il mesure |
|---|---|
| **Prévu / fait** | Les séances du plan effectivement exécutées |
| **Hors plan** | Les entraînements libres — ils comptent dans le volume réel, pas dans le suivi |
| **Série** | Semaines complètes consécutives |

Deux règles évitent des chiffres faux :

- **L'avenir n'est pas un manquement.** Une séance prévue demain n'est pas ratée ;
  la compter ferait chuter le taux à mesure qu'on regarde loin devant.
- **Les jours hors cycle ne comptent nulle part** — ni au numérateur, ni au
  dénominateur.

Les seuils du verdict (90 %, 70 %, 40 %) ne sortent d'aucune étude : ce sont des
repères de lecture, et le code le dit plutôt que de les faire passer pour des
données.

## Ce qu'un programme travaille vraiment

`backend/src/services/program-volume.js` · onglet **Entraînement › Programme**

Une liste d'exercices ne dit pas ce qu'elle dose. « Jambes trois fois par
semaine » peut laisser les ischio-jambiers sous le seuil d'entretien pendant que
les fessiers dépassent le plafond de récupération, et rien dans la liste ne le
montre.

Le programme est donc agrégé **par muscle**, à la lecture et jamais stocké :
retirer un exercice à la main doit faire baisser le chiffre immédiatement.

- Une série compte **1** pour le muscle principal et **0,4** pour chaque muscle
  secondaire — même pondération que la vue `muscle_load_recent`, faute de quoi
  la carte de charge et le tableau de volume se contrediraient.
- La **fréquence se compte en jours distincts**, pas en exercices : trois
  mouvements de pectoraux le même jour font une séance, pas trois.
- Le **cardio se compte en minutes**, et le travail chronométré sans séries ne
  gonfle pas le volume d'un programme de mobilité.
- La part obtenue **uniquement en accompagnement** est affichée séparément : un
  muscle qui n'atteint son volume qu'en secondaire n'est pas entraîné, il est
  sollicité.

Le verdict par muscle reprend les seuils de `evidence.js` (entretien à 6 séries,
effet net à 10, plafond de récupération vers 22 — Schoenfeld, Ogborn & Krieger,
2017). Trois avertissements en découlent : muscle visé mais sous l'entretien,
muscle au-dessus du plafond, et volume entier concentré sur une seule séance.

### Le mannequin sort de la bibliothèque

Le schéma anatomique n'existait que dans le catalogue. Or c'est **en séance**
qu'on se demande « je le sens dans l'épaule, c'est normal ? », et **devant un
programme** qu'on veut savoir ce qu'on va travailler. `ExerciseSheet` est donc
partagé par les trois écrans, chacun l'habillant à sa façon.

La vue affichée est choisie par le **muscle principal**, jamais par un décompte :
une traction compte trois muscles visibles de face (biceps, avant-bras) contre un
seul de dos, si bien qu'un simple vote affichait la face — où les dorsaux, muscle
principal du mouvement, n'apparaissent pas du tout. Une figure qui n'allume pas
le muscle travaillé est pire qu'aucune figure.

## Tous les sports, pas seulement la salle

`backend/src/services/sports.js` · onglet **Entraînement › Sports**

L'application savait doser la musculation : séries, répétitions, volume par
muscle. Elle ne savait rien faire d'une sortie vélo, d'un entraînement de judo
ou d'une séance de bloc — or ces sports ne se dosent **pas** en séries.

### L'unité commune : la charge de séance

```
charge = RPE (échelle 0-10) × durée en minutes
```

Proposée par Foster et al. (2001) et validée contre la fréquence cardiaque et le
lactate dans des sports aussi différents que le cyclisme, le basket et le judo.
Une seule question posée après la séance, multipliée par une durée. C'est ce qui
rend comparables 90 minutes de football (RPE 7 → 630) et trois heures de vélo
tranquille (RPE 4 → 720).

L'unité est arbitraire — « AU ». Elle ne vaut que **comparée à soi-même dans le
temps**, jamais entre deux personnes.

> **La charge est un produit, et l'ordre n'y change rien.** 3 × 60 et 9 × 20 font
> tous deux 180 : la méthode ne distingue pas une heure tranquille de vingt
> minutes très dures. C'est une limite connue et assumée, figée par un test pour
> qu'un « correctif » bien intentionné ne la casse pas en croyant réparer un bug.

### Neuf catégories, 53 sports

Le découpage suit la **qualité physique dominante**, pas la popularité ni le
matériel. C'est ce qui le rend utile : deux sports d'une même catégorie se
substituent sans déséquilibrer la semaine, deux sports de catégories différentes
se complètent.

| Catégorie | Qualité | Se dose en |
|---|---|---|
| Force et haltérophilie | Force maximale, hypertrophie | séries hebdomadaires par muscle |
| Endurance | Capacité aérobie | minutes, réparties 80 / 20 |
| Sports collectifs | Intermittent, changements de direction | séances et charge cumulée |
| Sports de combat | Puissance, endurance anaérobie | reprises et charge cumulée |
| Sports de raquette | Intermittent, latéralisé | séances hebdomadaires |
| Escalade et grimpe | Force de préhension, force relative | voies, blocs, temps suspendu |
| Glisse et plein air | Proprioception, endurance de force | durée de pratique |
| Arts du mouvement | Coordination, amplitude, contrôle | durée et régularité |
| Mobilité et souplesse | Amplitude articulaire | minutes sous étirement |

Chaque sport porte un **MET** (Compendium of Physical Activities, Ainsworth 2011)
et un **profil musculaire**, pour que la silhouette reste juste quand
l'entraînement n'a pas de tonnage.

> Ces deux données sont des approximations, et le code le dit. Le MET est une
> moyenne de population : deux personnes courant à 10 km/h ne dépensent pas la
> même chose. Les profils musculaires sont des attributions qualitatives tirées
> de la biomécanique du geste, pas des mesures électromyographiques — ils
> répondent à « haut ou bas du corps », pas à « combien de pour cent pour le
> vaste médial ».

### Une séance de sport se saisit après coup

Le module Séance chronomètre en direct, série après série : c'est ce qu'il faut
en salle. On ne sort pas son téléphone entre deux rounds ni suspendu à une
prise. Ces séances sont donc créées **déjà closes**, en une seule requête —
sinon un réseau capricieux laisserait des séances ouvertes en travers du
calendrier.

### Pourquoi étendre `workout_sessions` plutôt que créer une table

Une table parallèle aurait forcé à dupliquer le calendrier, l'adhérence, la
série de régularité, l'hydratation et l'export — et à les faire diverger au
premier oubli. Une séance est une séance. `perceived_exertion` existait déjà :
c'est le RPE de Foster.

### Monotonie, contrainte et vitesse de progression

- **Monotonie** (Foster, 1998) : charge quotidienne moyenne ÷ son écart-type,
  jours de repos compris — les retirer la ferait chuter artificiellement.
  Elle mesure l'**uniformité**, et c'est elle, autant que le volume, que Foster
  associait aux pépins. Au-delà de 2,0, il recommandait de varier.
- **Contrainte** = charge hebdomadaire × monotonie. Calculée sur la monotonie
  *affichée* : qui multiplie les deux chiffres à l'écran doit retrouver le
  troisième, sinon il doute des trois.
- **Rapport aigu / chronique**, version **découplée** : les 7 derniers jours sont
  exclus de la base de comparaison.

> L'ACWR est **contesté**. Impellizzeri et al. (2020) ont montré que la formule
> usuelle souffre d'un couplage mathématique et que ses seuils ronds n'ont pas de
> fondement empirique solide. D'où deux décisions : la version découplée, et
> jamais le mot « danger ». Le rapport décrit une **vitesse de progression**, pas
> un pronostic de blessure.
>
> Il refuse aussi de conclure sous trois journées actives dans les 21 jours de
> référence : deux séances isolées produisaient un rapport de 15 — exact, et
> parfaitement inutile. Il ne décrivait pas une progression rapide, il décrivait
> une absence de base.

### La silhouette absorbe les autres sports

Musculation et sports n'ont pas la même unité — tonnage d'un côté, RPE × durée de
l'autre. Les additionner reviendrait à additionner des kilomètres et des litres.
Chaque source est donc normalisée **séparément** sur son propre maximum (ce sont
déjà des cartes relatives), puis la plus forte est retenue, en disant d'où elle
vient. La carte répond à « quel muscle a le plus travaillé, et à cause de quoi »,
pas à « combien ».

## Niveau et distinctions

`backend/src/services/gamification.js` · onglet **Progression › Niveau**

Deux ans d'entraînement régulier ne laissent qu'une liste de séances. Un niveau
qui monte lentement rend ce cumul visible. Mais une gamification qui invente des
points ne vaut rien, et une gamification qui récompense le surentraînement est
nuisible. Quatre règles :

1. **Chaque XP est une charge réellement enregistrée.** Rien n'est attribué pour
   avoir ouvert l'application, complété un profil ou consulté un écran.
2. **Rendements décroissants** au-delà de 600 de charge sur une journée. Passé ce
   point, le volume supplémentaire est de la dette de récupération.
3. **Aucune distinction pour s'entraîner tous les jours**, ni pour une séance
   interminable — ce serait payer quelqu'un pour se blesser. Un test le vérifie
   sur le texte des distinctions, plutôt que de s'en remettre à la bonne volonté.
4. **Rien ne se perd.** Aucun niveau ne redescend, aucune distinction ne se
   retire : une blessure ou six mois de travail n'effacent pas ce qui a été fait.

### La courbe de plafond a une forme précise

```
au-delà du plafond C :  XP = C + 2C × (√(1 + excès/C) − 1)
```

Choisie pour deux propriétés que la racine carrée naïve (`C + √(excès × C)`) n'a
pas : elle vaut exactement C au plafond, **et sa pente y vaut 1 avant de
décroître**. La version naïve avait une pente *infinie* juste après le plafond —
les premières unités au-dessus rapportaient **plus** que celles d'en dessous,
soit l'inverse exact de l'effet recherché, et 1 200 de charge rendaient 1 200 XP.

L'XP se compte **par journée**, pas par séance : trois séances de 400 doivent
subir le même plafond que 1 200 d'un seul tenant.

### Ce que le niveau ne dit pas

Il mesure le **travail accumulé** sur douze mois glissants, pas la condition
physique. L'application ne connaît ni la VO₂max ni la force relative. Les titres
de palier nomment un niveau d'**engagement**, jamais de performance.

## Régularité

`backend/src/services/streak.js` · `GET /api/stats/streak`

La série se compte **en semaines, pas en jours**. À quatre séances par semaine,
trois jours de repos sont prévus : les afficher comme des ruptures pousserait à
s'entraîner contre son propre plan.

Le seuil n'est pas inventé non plus — c'est le nombre de jours par semaine du
programme actif. Sans programme, il n'y a pas de série, et le composant se tait
plutôt que d'afficher un zéro accusateur. La semaine en cours **ne peut que
prolonger** la série, jamais l'interrompre : elle n'est pas finie.

## Direction artistique

`frontend/src/styles.css`, sections *DIRECTION ARTISTIQUE* et *MOUVEMENT*

Noir, blanc, écarlate. Diagonales, angles tranchés, trames de demi-teinte,
typographie lourde et penchée, mouvement qui frappe plutôt qu'il ne glisse —
l'identité visuelle de *Persona 5*. Deux conflits ont dû être tranchés avant
d'écrire une ligne.

### Ce qui ne suffisait pas

Palette, biseaux, lame de transition, étincelles, sons : tout cela avait été posé
**sur** une structure qui, elle, n'avait pas bougé. Or une pile verticale de
cartes de largeur égale reste une pile verticale de cartes de largeur égale, même
avec un coin coupé. C'était la **grille** qui faisait « application de sport
quelconque », pas les couleurs.

Ce que fait réellement la direction artistique d'Atlus tient en quatre points,
et aucun n'est une question de teinte :

1. **La grille est brisée.** Rien n'est aligné, rien n'a la même largeur, tout est
   légèrement pivoté et décalé.
2. **Contraste d'échelle extrême.** Des chiffres énormes à côté de libellés
   minuscules.
3. **Le rouge est une forme**, pas un liseré. De grands aplats pleins qui
   débordent, pas des bordures sur du gris.
4. **Tout est superposé**, avec des ombres **dures** — du papier découpé, pas du
   matériau qui flotte.

Concrètement : rotations de 0,3 à 0,55° alternées (au-delà le texte crénèle, en
deçà l'œil ne voit rien), décalages latéraux alternés pour que deux panneaux
voisins ne partagent jamais le même bord, découpe en papier déchiré sur deux
angles opposés, titres en aplat écarlate penché qui sort de la carte par la
gauche, chiffres à 38 px contre des libellés à 10 px, et un titre d'écran à 58 px
avec une double ombre décalée — écarlate puis noire, comme un lettrage imprimé en
trois passes.

> **Sur téléphone, la grille se redresse.** Les décalages latéraux mangeraient la
> largeur utile et les rotations feraient déborder les panneaux. La découpe et les
> ombres restent, l'inclinaison disparaît. Vérifié : zéro débordement horizontal à
> 390, 820 et 1680 px.

> **La colonne est bornée à 1180 px.** À 1400, le collage se dilue : les panneaux
> deviennent des bandes et les décalages ne se voient plus.

> **Le titre d'écran est un `h1`.** L'application n'en avait aucun — un lecteur
> d'écran ne pouvait pas dire sur quelle page il se trouvait. La pièce la plus
> graphique de l'écran est aussi celle qui corrige ce défaut.

## Performance

Toutes les mesures viennent d'un vrai navigateur. Sauf mention contraire :
**CPU bridé ×6** — un téléphone d'entrée de gamme — et un écran de 390 × 844.

### Ce que les mesures ont dit

La première surprise : **au repos, l'application ne coûte rien**. 0,012 s de CPU
sur dix secondes sans interaction, aucun recalcul de style, 60 images par
seconde. Les cinq couches de fond animées en boucle tournent sur le compositeur
et ne déclenchent aucune repeinture — la règle « uniquement `transform` et
`opacity` dans les boucles » n'était pas une précaution de principe.

Le vrai problème était ailleurs : **le blocage du fil principal au chargement**.

| Écran | Départ | Après | Gain |
|---|---|---|---|
| Séance | 637 ms (8 tâches) | **128 ms** (1 tâche) | −80 % |
| Exercices | 218 ms | **155 ms** | −29 % |
| Aperçu | 268 ms | **161 ms** | −40 % |
| Tendances | 375 ms | **287 ms** | −23 % |

Total de blocage sur Séance : 1257 ms → **128 ms**.

### Ce qui a produit ces gains

**1. Le rendu du hors-champ est différé.** Sur Séance, la cause n'était pas le
calcul mais la mise en page de soixante entrées de catalogue, dont cinquante-cinq
sous la ligne de flottaison. `content-visibility: auto` dit au navigateur de
sauter ce travail tant que l'élément n'approche pas de l'écran.

> `contain-intrinsic-size` est **indispensable** avec : sans hauteur présumée, un
> élément saute à zéro, la barre de défilement se rétracte et la page tressaute à
> chaque apparition. Les valeurs sont les hauteurs réelles mesurées.
>
> Ce qui ne le reçoit **pas** : les cartes de premier niveau, visibles d'emblée ;
> les tuiles de carte, qui doivent être peintes avant d'entrer dans le cadre ;
> tout ce qui est animé.

**2. React remplacé par Preact.** `preact/compat` expose la même interface pour
un tiers du poids. Sur un téléphone lent, ce n'est pas le téléchargement qui
compte — quelques dizaines de kilo-octets — mais l'**analyse et l'exécution** du
script.

| Lot principal | Avant | Après |
|---|---|---|
| Compressé | 93,3 Ko | **58,5 Ko** |
| Brut, à analyser | 283 Ko | **159 Ko** |

> La substitution n'était acceptable que **vérifiée**. `check:screens` ouvre les
> quatorze écrans et refuse la moindre erreur console — mais l'absence d'erreur
> ne prouve pas qu'un graphique *dessine*. Un second contrôle compte les
> éléments réellement rendus : 5 SVG et 37 graduations sur Tendances, 7 SVG sur
> Santé, 6 polygones de radar, 148 tracés d'anatomie, 4 tuiles de carte. C'est ce
> qui permet d'assumer le changement malgré `recharts`.

**3. Précompression au build.** `gzip_static` sert un `.gz` compressé au **niveau
9**, une fois pour toutes. La compression à la volée coûte du processeur à chaque
requête et s'arrête au niveau 5 ou 6 pour cette raison. Résultat : 768 Ko → 231 Ko,
sans aucun calcul au service.

**4. Les lots de route sont préchargés** par le service worker, *après*
l'activation et non pendant l'installation : pendant, ces requêtes disputeraient
la bande passante au premier rendu. Chaque écran s'ouvre ensuite instantanément,
y compris sans réseau — la différence est nette dans une salle en sous-sol.

**5. Les en-têtes de cache ont été corrigés.** `expires` et `add_header
Cache-Control` émettaient deux en-têtes concurrents. Et `sw.js` n'est désormais
**jamais** mis en cache : c'est lui qui décide de la durée de vie de tout le
reste, et un service worker périmé fige l'application sur une ancienne version.

### Sur les fils d'exécution

Il n'y a **pas** de *web worker* dans cette application, et c'est un choix mesuré.
Un worker déporte du calcul ; or le coût mesuré ici est de la **mise en page et
de la peinture**, qui ne peuvent pas quitter le fil principal. En ajouter un
aurait ajouté de la complexité et de la latence de messages pour aucun gain.

Le seul travail réellement déporté l'est déjà : le service worker pour le cache,
et le décodage des images via `decoding="async"`.

### Le bandeau « où j'en suis »

`components/DateHud.jsx`

Les jeux Persona affichent la date en permanence, dans un coin. Ce n'est pas
décoratif : c'est ce qui donne le sentiment d'une progression qui avance pendant
qu'on joue.

Une page « calendrier » répond à « quand est ma prochaine séance ». Elle ne
répond pas à « **où j'en suis** », parce qu'il faut y aller pour le savoir — et
on n'y va pas.

```
┌─────┐ 21 SEPT      ┌──────────────────┐
│ LUN │ SEMAINE 3/4  │ HAUT DU CORPS A  │
└─────┘ ▰▰▰▰▰▰░░     └──────────────────┘
```

Trois informations, dans cet ordre de lisibilité : le **jour** (énorme, sur son
aplat penché), la **date**, puis la position dans le **cycle du programme** — avec
une barre d'avancement du cycle entier, pas de la semaine. C'est la question
« où j'en suis », pas « qu'est-ce que je fais aujourd'hui ».

La phase du jour (séance prévue, repos, hors cycle, déjà faite) est à droite.
L'état passe par la couleur **et** par le mot : écarlate pour une séance prévue,
vert pour une séance faite, et le texte le nomme dans les deux cas.

Il vit **dans la barre du haut**, donc il ne coûte aucune hauteur et ne disparaît
jamais au défilement — vérifié après 1 400 px de scroll, il reste à 14 px du haut.
Un clic dessus ouvre le calendrier : c'est la porte naturelle quand on veut en
savoir plus.

Il se réduit progressivement : la phase disparaît sous 1 100 px, la semaine et sa
barre sous 1 000 px, et il ne reste que le jour et la date sur téléphone — ce qui
suffit à répondre à « on est quand ».

> **Le décalage de la sous-navigation.** Elle était calée sur un `top: 57px`
> figé, hérité d'une époque où la barre du haut faisait cette hauteur. Depuis
> qu'elle porte un bord incliné et ce bandeau, elle varie de 62 à 81 px selon la
> largeur : il y avait un trou ici et un recouvrement là. Sa hauteur est
> désormais **mesurée** et publiée en variable CSS, moins les 14 px de la
> diagonale. Vérifié à six largeurs : l'écart vaut −14 px partout, la
> sous-navigation se glisse sous l'angle de façon identique.

### Ce qui a été retiré

Une silhouette anatomique en fond d'écran, censée jouer le rôle du personnage des
menus Atlus. Elle ne fonctionnait pas : trop discrète pour porter une ambiance,
trop présente pour être ignorée, et elle occupait la place sans rien apporter à
la lecture. Supprimée plutôt que rafistolée.

### Le rouge était déjà la couleur d'alarme

En faire la couleur de marque la rendrait invisible : quand tout est rouge, plus
rien n'alerte.

**La zone tranche, pas la teinte.** Le rouge habille le *châssis* — navigation,
titres, boutons, onglets, surfaces de jeu. Il n'apparaît jamais comme couleur de
texte *à l'intérieur* d'une zone de données. Dans un tableau ou une fiche, du
rouge ne peut donc vouloir dire qu'une chose : une alerte.

Et l'alarme ne repose pas sur la teinte seule. Elle est toujours doublée d'un
**aplat inversé** — blanc sur rouge — ou d'un libellé : un daltonien lit
l'inversion, pas la couleur.

### Cette direction est faite pour crier

Appliquée partout, elle détruirait la lisibilité d'un tableau de volume ou d'une
liste d'ingrédients. **Châssis bruyant, données calmes** — c'est ainsi que
fonctionne le jeu d'origine : ses menus sont déchaînés, ses chiffres de combat
parfaitement lisibles.

Les écrans **Niveau** et **Sports** jouent le jeu à fond. Les tableaux de volume,
le journal alimentaire et les graphiques gardent leur casse normale, leur
interlettrage normal et leur série bleue. Un bloc CSS *défait* explicitement la
direction artistique sur ces surfaces.

| Jeton | Usage | Contraste |
|---|---|---|
| `--brand` `#ff2d46` | encre sur fond sombre | 5,3:1 — AA texte normal |
| `--brand-deep` `#e4002b` | aplat sous du blanc | 4,9:1 — AA texte normal |
| `--gold` `#ffd028` | distinction obtenue | — |
| `--muscle` `#ff8a6e` | tissu musculaire | — |

Deux valeurs de rouge, et ce n'est pas un détail : une seule aurait fait tomber
l'un des deux cas sous le seuil de lisibilité.

### Le muscle est saumon, pas bleu ni écarlate

Ce n'est pas un choix décoratif : c'est la couleur du tissu, et une planche
d'anatomie à sa teinte réelle se lit plus vite qu'une planche en bleu.

Mais le saumon devait rester **distinct de l'écarlate de marque**, faute de quoi
un muscle sollicité se confondrait avec une alerte. Il est nettement plus clair
et plus orangé : les deux ne se confondent pas, même côte à côte.

Sur la carte de volume d'un programme, la dose normale se lit donc sur une rampe
de tissu — du saumon éteint au saumon plein — et seuls le **volume haut** et le
**dépassement du plafond** basculent sur des teintes de statut. Au-delà, ce n'est
plus « plus de saumon », c'est un autre régime.

### Typographie condensée, sans fichier

`--font-display` va chercher les condensées **déjà installées** : Arial Narrow sur
macOS et iOS, Roboto Condensed sur Android, Liberation Sans Narrow sur les
distributions libres — et retombe sur la fonte système partout ailleurs. Gain
gratuit là où elle existe, aucune régression là où elle manque, et toujours zéro
appel réseau.

Réservée aux **titres, onglets, boutons et grands chiffres**. Jamais au corps de
texte : une condensée se lit très bien sur trois mots en capitales et fatigue sur
un paragraphe de consignes d'exécution.

### Le fond n'est pas un vide

Un aplat noir ne fait pas une direction artistique. Trois couches fixes,
décoratives, derrière le contenu : un halo écarlate en haut à gauche, un
contre-halo froid en bas à droite pour que l'écran ne vire pas au monochrome, et
des rayures diagonales fines. Plus un vignettage.

Elles sont attachées à `body::before` en `position: fixed` : une texture répétée
sur un élément de plusieurs milliers de pixels de haut coûterait à chaque
défilement, alors qu'une couche fixe de la taille de l'écran ne se repeint
jamais.

### Pas de fonte distante

L'application est auto-hébergée et doit fonctionner hors ligne. Charger une fonte
depuis un CDN ajouterait un appel tiers et casserait ce principe. Le caractère
penché vient donc d'une transformation `skewX(-8deg)` et de graisses système
poussées, pas d'un fichier. Un angle **unique** pour toute l'interface : deux
inclinaisons sur un même écran se lisent comme un défaut d'alignement, pas comme
un parti pris.

### Mouvement

1. **Le mouvement doit dire quelque chose.** Une carte qui arrive de côté indique
   d'où vient le contenu ; une barre qui se remplit montre une progression.
2. **Rien au-dessus de 400 ms** — hors la lame de transition, à 560 ms, qui est
   décorative et n'attend rien.
3. **Uniquement `transform` et `opacity`.** Le balayage de page fut d'abord écrit
   en `clip-path` animé sur la page entière : découper à chaque image une surface
   de plusieurs milliers de pixels fait décrocher un téléphone. La lame *traverse*
   l'écran en `translate`, ce qui reste sur le compositeur.
4. **Tout est désactivable.** Les vestibulopathies et certaines épilepsies
   photosensibles rendent ce réglage médical, pas décoratif.

### La météo — le seul appel à un tiers

`backend/src/services/weather.js`, `backend/src/routes/weather.js`,
`components/WeatherHud.jsx` · `GET /api/weather?lat=&lon=`

Jusqu'ici l'application ne sortait **jamais** du réseau local. La météo introduit
un appel à un tiers, et c'est un vrai compromis — assumé ici plutôt que caché.

Quatre décisions en découlent :

1. **C'est le serveur qui appelle, pas le navigateur.** Si le navigateur
   interrogeait Open-Meteo directement, le service verrait l'adresse IP réelle,
   l'agent utilisateur, et pourrait rapprocher les requêtes entre elles. En
   passant par le serveur — qu'on héberge soi-même — il ne voit que celui-ci.
2. **Les coordonnées sont arrondies à deux décimales**, soit environ un
   kilomètre. Amplement suffisant pour une température, et cela évite de
   transmettre une position de porte d'entrée. L'arrondi est fait deux fois : au
   stockage local, puis au relais.
3. **Cache de quinze minutes.** La météo ne change pas d'une minute à l'autre, et
   chaque requête épargnée est une trace de moins.
4. **Rien ne se déclenche seul.** Bouton explicite, ce qui se passe écrit en
   clair avant de cliquer, et un moyen de tout oublier ensuite.

Open-Meteo est retenu parce qu'il ne demande **ni compte ni clé** : il n'y a donc
pas d'identifiant à rattacher aux requêtes. Licence CC BY 4.0, citée dans
l'interface.

#### Le panneau est rendu hors de la barre du haut

La barre du haut porte `overflow: hidden` **et** un `clip-path` pour son bord
incliné. Ces deux propriétés **rognent leurs descendants** : le panneau météo,
positionné en absolu sous la pastille, était coupé net — seuls quatorze pixels
dépassaient.

Aucun `z-index` ne corrige cela : la découpe n'est pas une question d'ordre
d'empilement. La seule issue est de sortir le panneau de l'ancêtre qui le rogne,
donc un **portail** vers le corps du document, avec une position calculée depuis
la pastille et recalculée au défilement et au redimensionnement.

> **Borner des deux côtés, pas d'un seul.** Le panneau s'aligne à droite sur la
> pastille — mais celle-ci n'est pas au bord de l'écran, le bouton de son la suit.
> Sur un téléphone, un alignement strict projetait le panneau 53 px hors du bord
> **gauche**. Le décalage droit est donc borné par le haut aussi. Vérifié à 360,
> 390, 820 et 1 400 px : le panneau tient entièrement dans l'écran partout.
>
> Sa hauteur est bornée de la même façon, avec défilement interne : un panneau
> plus haut que l'écran rendrait son bouton « désactiver » inatteignable.

Un balayage des treize écrans cherche désormais tout élément positionné qui
déborde d'un ancêtre rogné. Il n'en reste aucun.

#### Ce n'est pas décoratif

La chaleur, le vent et la pluie changent réellement ce qu'on peut faire d'une
séance. Les repères portent leur source, comme partout ailleurs :

| Condition | Ce qui est dit | Source |
|---|---|---|
| ≥ 30 °C ressentis | endurance en chute, décaler tôt ou tard, rallonger les récupérations | Racinais et al. (2015) |
| ≥ 25 °C ressentis | boire davantage, sans attendre la soif | ACSM, Sawka et al. (2007) |
| ≤ 0 °C ressentis | échauffement plus long, force et coordination réduites | Castellani & Tipton (2016) |
| vent ≥ 30 km/h | juger à l'effort, pas à la vitesse | — |
| orage | aucune séance dehors, abri léger compris | — |

> **La température ressentie prime sur la brute.** À l'effort, ce sont l'humidité
> et le vent qui décident si le corps arrive à évacuer sa chaleur. Un test fige
> les deux sens : 24 °C au thermomètre mais 31 ressentis lèvent l'alerte,
> 31 au thermomètre et 24 ressentis ne la lèvent pas.

> **On signale, on ne décide pas.** Aucun objectif n'est modifié en silence —
> surtout pas la cible d'hydratation, calculée ailleurs sur le poids et la durée.
> Changer un chiffre sans le dire serait pire qu'utile : on ne saurait plus d'où
> il vient.

> **Et on ne dit rien quand il n'y a rien à dire.** Un temps tempéré et dégagé ne
> produit aucune note : une note permanente devient un bruit qu'on cesse de lire.

### Un fond qui répond à l'heure et au temps

Les premières versions empilaient des **dégradés radiaux** : un halo chaud, un
contre-halo froid, une trame qui dérivait. Correct, et complètement à côté —
*Persona 5 ne fait aucun dégradé doux*. Il fait des aplats, des bords francs et
des formes découpées. Un halo radial adoucit tout ; ici, tout doit trancher.

Cinq couches, toutes fixes, toutes derrière le contenu, toutes en `transform` ou
en opacité :

1. **L'aplat** — une couleur pleine qui suit l'heure. Quatre ambiances, bascule
   en trois secondes. Calculée sur l'horloge locale, donc **sans réseau ni
   permission**.
2. **Les rayons** — des triangles qui partent d'un point hors champ, en rotation
   sur quatre minutes. C'est le motif le plus reconnaissable des fonds du jeu, et
   il n'existe qu'une façon de l'obtenir proprement : un
   `repeating-conic-gradient` à **arrêts durs**. Un dégradé adoucirait le bord des
   rayons et l'effet tomberait à plat.
3. **Les bandes** — trois aplats penchés qui glissent à des vitesses différentes.
4. **La déchirure** — une bande de papier déchiré en haut de page, à dents
   **inégales** : des dents régulières se liraient comme un motif, pas comme une
   déchirure.
5. **Le temps** — pluie, neige ou brume quand la météo est active. Vide par
   défaut, donc gratuit.

> **La boucle doit tomber juste.** Un motif répété qu'on translate ne boucle sans
> couture que si le déplacement vaut un multiple **exact** de sa période. Pour la
> pluie, la géométrie donne la valeur : traits à 100°, période de 7 px, donc
> `Δy × sin(10°) = n × 7` → **403,2 px par cycle**. La pluie tombe droit pendant
> que les traits restent inclinés.

### Des pictogrammes dessinés, pas des émoji

`components/Glyph.jsx`, `lib/icons.js` *(généré)*

Un émoji est rendu par la police du système : arrondi, coloré, dégradé, et
différent sur chaque appareil. Il ne peut **par construction** appartenir à
aucune direction artistique.

Les premiers pictogrammes étaient tracés à la main — cohérents avec la direction
artistique, mais franchement grossiers : un nuage en polygone à huit côtés reste
un polygone à huit côtés. Ils viennent désormais de **Phosphor Icons** (MIT),
graisse `fill` : pleine et massive, donc du même registre que le reste, là où un
jeu en traits fins jurerait.

> **La bibliothèque n'est pas importée.** Phosphor compte 1 512 icônes par
> graisse ; en dépendre ferait reposer l'interface sur un paquet dont la
> prochaine version majeure peut redessiner ce qu'on affiche.
>
> `npm run generate:icons` lit les fichiers SVG et écrit **uniquement les
> vingt-neuf tracés employés** dans un module généré — 10,7 Ko, soit 3,6 Ko une
> fois compressés. Le paquet reste une dépendance de développement : il n'entre
> ni dans le lot, ni dans l'image de production.

> Les noms internes sont en français et décrivent l'**usage**, pas le dessin :
> changer l'icône de « salle » ne touche que le générateur.

### Installable sur le téléphone

`frontend/public/manifest.webmanifest`, `frontend/public/sw.js`

Une fois installée, l'application occupe l'écran **entier** — plus de barre
d'adresse, plus de boutons de navigateur. Quatre choses la rendent possible :

- un **manifeste** en `display: standalone`, avec `display_override` qui tente
  d'abord le plein écran ;
- une **icône tracée** en SVG, aplats et angles francs comme le reste ;
- les balises `apple-mobile-web-app-*` — iOS ignore le manifeste pour le plein
  écran et exige encore ces balises héritées ;
- un **service worker** qui met la coquille en cache.

> **Les réponses de `/api` ne sont jamais mises en cache.** Un poids, une charge
> d'entraînement ou une cible nutritionnelle périmés seraient pires qu'une erreur
> franche : on croirait lire ses données réelles. Hors ligne, l'application
> s'ouvre et dit que le serveur est injoignable — elle n'invente rien.

> La navigation va au **réseau d'abord**, cache en secours. L'inverse servirait
> une ancienne version après un déploiement, ce qui est la panne la plus
> déroutante qui soit.

En mode installé, les marges que le navigateur offrait doivent être reprises à la
main : la barre du haut passe sous l'encoche, la barre basse laisse libre la zone
de l'indicateur d'accueil, et l'appui long fait défiler au lieu de surligner.

### Sur téléphone, l'écran est le budget

`frontend/src/styles.css` (bloc `@media (max-width: 700px)`)

Sur un 390 × 844, **335 pixels sur 844 — 40 % de l'écran** partaient en chrome
avant le premier contenu. Le titre de page y répétait mot pour mot l'onglet actif
juste au-dessus : deux fois la même information, pour le prix d'une bande entière.

Le titre est donc **masqué visuellement** sur téléphone, sans quitter le DOM :
c'est le seul `h1` de la page et un lecteur d'écran doit continuer à l'annoncer.
Le chrome tombe à **157 px** — barre haute jusqu'à 63, onglets jusqu'à 116,
première carte à 157.

**Les cibles tactiles** mesuraient 28 à 33 px ; le seuil confortable est 44. Les
onglets passent à 44, les boutons à 42, les puces et outils de carte à 38-40. Le
décompte des cibles sous 40 px tombe de 14-68 par écran à 3.

**Sauf sur l'Aperçu, et c'est assumé :** la silhouette de charge musculaire y
compte 56 régions, dont certaines de 6 × 14 px. On ne peut pas grossir un biceps
sans mentir sur l'anatomie. Deux corrections, donc, plutôt qu'un agrandissement :

- ces régions ne répondaient qu'au **survol**, que nul écran tactile ne produit —
  la carte invitait pourtant à « sélectionner un muscle ». Elles acceptent
  maintenant l'**appui**, qui bascule le détail, et la touche Entrée ;
- chaque tracé reçoit une **bordure transparente de 14 px**, posée sous la couche
  visible. Le muscle reste prioritaire, mais un doigt qui vise mal tombe sur un
  voisin plausible au lieu de ne rien toucher.

> **Le survol est une notion de souris.** Après un toucher, le navigateur émet un
> `mouseenter` de compatibilité : il resélectionnait aussitôt le muscle que
> l'appui venait de refermer, et la bascule ne fonctionnait jamais. Les
> gestionnaires passent donc par les événements de *pointeur*, qui déclarent leur
> nature, et ignorent le survol tactile.

**Le texte sous 11 px** — 45 occurrences sur Séance, 64 sur Exercices — tombe à 4 :
les libellés de la barre basse, délibérément à 9 px parce qu'ils doublent une
icône. Cela a demandé de sortir le `fontSize` en ligne de `EvidenceBadge` dans une
classe `.pill-compact`, faute de quoi aucune requête média ne pouvait le reprendre.

**Le bouton du téléphone** recouvrait le champ de recherche. Il rejoint la barre
basse comme cinquième entrée « Apps ». Les deux accès s'excluent exactement, sur la
**même largeur de bascule que la barre** : sous 700 px la barre porte l'entrée,
au-dessus le bouton flottant reprend la main. Une condition en JavaScript sur
« quelqu'un pilote-t-il ce composant » avait l'air de marcher et rendait le
téléphone **inatteignable sur ordinateur**, où la barre basse n'existe pas.

Les onze catégories d'Aliments occupaient **800 px** repliées en six lignes — tout
le premier écran avant le moindre aliment. Elles défilent maintenant
horizontalement : **287 px**.

> `html { overflow-x: clip }`, et non `hidden` : `hidden` crée un conteneur de
> défilement qui casse `position: sticky`, donc les deux barres du haut. Vérifié
> après coup — barre haute à 0, onglets à 49/67 une fois la page défilée.

**Régression introduite ici même :** la cinquième entrée portait la barre basse à
401 px sur un écran de 390. Un élément flex refuse de rétrécir sous la largeur de
son contenu ; `min-width: 0` plus une élision sur le libellé.

> **Correction de mesure.** J'ai d'abord relevé 9 à 11 px de débordement
> horizontal, puis 987 px sur Aliments. Les deux étaient des artefacts : pour les
> premiers, mon émulation n'appliquait pas les largeurs demandées (`innerWidth` à
> 392 quand j'en demandais 320) et `clientWidth` exclut la barre de défilement ;
> pour le second, `scrollWidth` compte les **couches décoratives du fond**
> (`sky`, `rays`, `bands`), plus larges que l'écran par construction et rognées
> par `overflow-x: clip`. Tranché en mesurant ce qui compte pour la main qui
> tient l'appareil — `window.scrollTo(200, 0)` puis `scrollX` vaut **0 à 320,
> 360, 390 et 430 px**, page d'Aliments comprise.

### Une coquille, des modules

`frontend/src/lib/modules.js`

ForgeFit n'est pas l'application : c'est le **premier module** d'une coquille qui
peut en héberger plusieurs. Une bibliothèque, un carnet — chacun apporte ses
propres sections, et le téléphone sert à passer de l'un à l'autre.

La barre du haut n'affiche que les sections du module **courant**. Avec un seul
module, c'est exactement l'interface actuelle ; avec deux, elle se recompose en
changeant de module — et c'est ce qui donne la sensation de changer
d'application sans quitter la coquille.

**Ajouter un module** tient en trois pas : décrire ses sections dans
`modules.js`, câbler ses pages dans `PAGES` côté `App.jsx`, c'est tout. La
navigation, le téléphone et le contrôle d'écrans se mettent à jour d'eux-mêmes.

> **L'URL reste `#/section/page` et ne porte pas le module.** C'est ce qui permet
> d'en ajouter un sans casser un seul lien existant — mais cela impose que les
> clés de section et de page soient uniques dans *toute* l'application : deux
> homonymes produiraient la même adresse et l'une deviendrait inatteignable.
> `npm run check:nav` refuse désormais toute collision.

> **Aucun module fictif n'est déclaré.** Une tuile qui n'ouvre rien serait une
> promesse, pas une fonctionnalité.

### Le téléphone

`components/PhoneMenu.jsx` · `GET/POST/DELETE /api/apps`

Un lanceur qui sort de l'écran en se redressant, comme un téléphone qu'on dégaine.
ForgeFit n'est qu'une pièce d'une suite personnelle à venir ; il donne un point
d'entrée unique vers ses sections et vers les autres applications auto-hébergées.

> **Aucune tuile factice.** Pas de « bientôt disponible » : les seules
> applications listées sont celles qui existent — les sections de ForgeFit, et les
> liens que l'utilisateur ajoute lui-même.

Les liens sont stockés **en base**, pas dans le navigateur : un lanceur sert
précisément à retrouver ses outils depuis n'importe quel appareil, et rangé en
local il serait vide sur le téléphone après avoir été rempli sur l'ordinateur.

Seuls `http:` et `https:` sont acceptés. `javascript:` et `data:` sont refusés —
ce sont les deux vecteurs classiques d'exécution de code par un lien, et même sur
une application personnelle rien ne justifie de les accepter : un jour on colle
une URL sans la relire. Les liens s'ouvrent avec `noopener noreferrer` : la page
ouverte n'a besoin ni de piloter celle-ci, ni de savoir d'où elle vient.

### La carte

`components/MapBoard.jsx`, `lib/mercator.js` · `GET /api/tiles/:z/:x/:y.png`

Une vraie carte, en tuiles **OpenStreetMap**, sur laquelle on pose ses lieux :
sa salle, son bureau, le parc. Elle se déplace au doigt, se zoome, et sait se
centrer sur sa position.

> **Deux notions de « lieu », à ne pas confondre.** Les `LOCATIONS` du catalogue
> sportif sont des *types* — « salle de musculation », « dehors » — et portent les
> sports praticables. Les `user_places` sont les tiens, nommés et posés par toi —
> « ma salle » — et héritent des sports de leur type. Rien d'inventé : chaque clé
> renvoie au catalogue, et un test vérifie qu'aucune ne pointe dans le vide, une
> clé morte ne levant aucune erreur.

> **Glisser et poser partagent le même geste.** On ne pose un lieu que si le doigt
> **n'a pas** bougé de plus de trois pixels ; sans ce seuil, chaque déplacement de
> carte créerait un lieu.

#### Les tuiles passent par ton serveur

C'est le deuxième et dernier appel externe de l'application, après la météo.
Trois raisons de le relayer plutôt que de laisser le navigateur appeler :

1. **Vie privée.** Chaque tuile demandée révèle la zone qu'on regarde. Appelées
   depuis le navigateur, ces requêtes portent l'adresse IP réelle et se
   recoupent. Relayées, le fournisseur ne voit que ton serveur.
2. **Politique d'usage.** OpenStreetMap **exige** un `User-Agent` identifiant
   l'application ; un navigateur envoie le sien, anonyme parmi des millions.
3. **Charge.** Les tuiles sont mises en cache — la fondation le recommande
   explicitement, ses serveurs étant financés par des dons. Cache de 1 500 tuiles
   (≈ 22 Mo) avec éviction du moins récemment utilisé, TTL de sept jours.

> L'attribution « © OpenStreetMap contributors » est affichée **en permanence**
> sur la carte. Ce n'est pas une politesse : c'est la condition de la licence ODbL.

#### Quatre rendus, zéro fournisseur de plus

Les fonds sombres tout prêts — Carto Dark Matter, Stamen Toner — sont beaux, mais
ce serait un **service tiers de plus**, avec sa politique d'usage, parfois sa clé
d'API, et une adresse de plus à qui l'on révèle ce qu'on regarde.

Les mêmes tuiles OpenStreetMap, retravaillées par un **filtre CSS**, donnent
quatre rendus très différents pour zéro requête supplémentaire et zéro
dépendance. Le filtre s'applique sur le compositeur : il ne coûte rien.

| Rendu | Effet |
|---|---|
| **Encre** *(défaut)* | inversé et contrasté — plan clair sur noir |
| **Braise** | inversé puis viré à l'écarlate |
| **Plan** | assombri, désaturé |
| **Brut** | les tuiles telles qu'OSM les publie |

> Encre est le rendu par défaut malgré Braise, plus spectaculaire : une carte sert
> d'abord à être **lue**. Le rendu brut reste offert — personne ne doit être
> enfermé dans un parti pris.

La carte s'ouvre aussi en **plein écran**, hors du téléphone. Sa hauteur y est
portée par une colonne flexible et non par une grille à rangées fixes : les
enfants sont conditionnels — bandeau d'erreur, formulaire, fiche de lieu — et une
grille supposant la carte en troisième position la laissait à sa hauteur de
320 px au milieu d'un écran de 900.

#### Écrite à la main, sans bibliothèque

Leaflet est excellent, et c'est le problème : il apporte son DOM, sa feuille de
style et son vocabulaire visuel, qu'il faudrait ensuite défaire pièce par pièce
pour le faire entrer dans cette direction artistique.

Or tout ce qu'il faut tient en quatre fonctions de projection de Mercator
sphérique — `lib/mercator.js`, une soixantaine de lignes. Les écrire coûte moins
que de dompter une bibliothèque, se teste **sans navigateur**, et n'ajoute aucune
dépendance.

`npm run check:map` vérifie ce qu'une erreur de projection ne montrerait pas :
la carte s'afficherait, les tuiles se chargeraient, et les pions seraient
simplement **au mauvais endroit**.

- Paris tombe bien sur la tuile 2074/1409 au zoom 12 ;
- l'aller-retour latitude → pixel → latitude est exact à 10⁻⁹ près, à tous les
  zooms — une projection non réversible décale les pions d'autant plus qu'on
  zoome, et le défaut passe inaperçu aux faibles zooms ;
- la latitude est bornée à ±85,0511°, celle où Mercator diverge ;
- la longitude **s'enroule** : en défilant vers l'est depuis le 180ᵉ méridien on
  retombe sur le premier, pas sur du vide.

> Le glisser de la carte et la pose d'un pion partagent le même geste : on ne
> pose un lieu que si le doigt **n'a pas** bougé de plus de trois pixels.

> Les tuiles sont positionnées en `translate`, pas en `left`/`top` : ces
> dernières déclencheraient un recalcul de mise en page à chaque image.

Deux notions à ne pas confondre : les **types** de lieu (`LOCATIONS` dans
`sports.js`) disent ce qu'on peut y pratiquer — « une salle permet la
musculation ». Les **lieux** (`user_places`) sont les tiens — « ma salle » — et
héritent des sports de leur type.

| Type | Fenêtre | Sports |
|---|---|---|
| Maison | 15–45 min | 8 |
| Dehors | 30–180 min | 10 |
| Salle | 45–90 min | 8 |
| Travail | 5–15 min | 3 |
| Transport | 5–25 min | 2 |
| Piscine | 30–60 min | 1 |

### La carte des lieux

`LOCATIONS` dans `backend/src/services/sports.js` · onglet **Carte** du téléphone

La question qu'on se pose vraiment n'est pas « quel sport ai-je envie de faire »,
c'est « **qu'est-ce que je peux faire là où je suis, maintenant** ». Un catalogue
de 53 sports n'y répond pas.

Six lieux — Maison, Dehors, Salle, Travail, Transport, Piscine — portant chacun
ses sports **réellement** praticables, son matériel disponible et sa fenêtre de
temps typique :

| Lieu | Fenêtre | Sports |
|---|---|---|
| Maison | 15–45 min | 8 |
| Dehors | 30–180 min | 10 |
| Salle | 45–90 min | 8 |
| Travail | 5–15 min | 3 |
| Transport | 5–25 min | 2 |
| Piscine | 30–60 min | 1 |

Rien d'inventé : les clés renvoient au catalogue, et un test vérifie qu'aucune ne
pointe dans le vide — une clé morte ne provoquerait aucune erreur, le sport
disparaîtrait simplement de la liste.

> `/api/sports/locations` est déclarée **avant** `/api/sports/:key`, sinon
> « locations » serait interprété comme une clé de sport et renverrait 404.

### Le calendrier

Sept cartes identiques portant chacune une date en petit : il fallait **lire**
pour se repérer. Le jour passe en grand sur son bandeau, et c'est le rapport
d'échelle — pas la couleur — qui fait la lecture. Aujourd'hui reçoit un aplat
plein, et un badge qui le **nomme** pour qui ne distingue pas les couleurs.

### Les trois gestes

`components/RouteFx.jsx`, `components/ClickBurst.jsx`

| Geste | Quand | Ce qu'il fait |
|---|---|---|
| **Lame** | changement d'écran | une bande écarlate penchée traverse l'écran |
| **Étincelles** | changement d'écran | huit scintillements quatre branches, positions figées |
| **Plongée** | changement d'écran | le contenu arrive de loin, dépasse à peine, se pose |
| **Salve** | tout clic actionnable | sept étincelles projetées en éventail + un anneau |
| **Curseur** | changement d'onglet | un bloc écarlate *voyage* d'un onglet à l'autre |
| **Reflet** | survol d'un exercice | une bande claire traverse le panneau |

> **Le curseur de la sous-navigation est mesuré, pas coloré.** Un fond appliqué à
> l'onglet actif *apparaît* à un endroit et *disparaît* à un autre : aucun
> mouvement ne relie les deux, et le changement se lit comme un saut. Un bloc
> unique positionné par mesure voyage — l'œil suit le déplacement, ce qui dit d'où
> l'on vient.
>
> `useLayoutEffect` et non `useEffect` : la mesure doit précéder la peinture,
> sinon le curseur apparaît d'abord à sa position précédente et se corrige après
> coup. La largeur s'anime aussi : passer d'un onglet court à un onglet long sans
> l'animer donnerait un étirement sec.

> **Le bug de la lame qui se garait au milieu de l'écran.** La première version
> vivait dans un pseudo-élément : une bande de 38 % de large, translatée de
> 140 %. Or `translateX` en pourcentage se calcule sur la largeur de **l'élément**,
> pas de l'écran : 140 % de 38 % font 53 % de l'écran. La lame s'arrêtait donc en
> plein milieu — et le remplissage `forwards` l'y figeait définitivement.
>
> Les distances sont désormais en `vw`, où il n'y a rien à interpréter, et
> l'effet **se démonte tout seul** après 700 ms : plus rien ne peut rester à
> l'écran, même si une animation échoue. Vérifié image par image dans un vrai
> navigateur — la lame quitte l'écran à 350 ms, le composant disparaît du DOM à
> 900 ms.

La salve au clic porte quatre contraintes, toutes vérifiées :
elle **ne retarde jamais l'action** (peinte après traitement du clic),
**n'intercepte pas le pointeur** (couche fixe en `pointer-events: none`),
**se nettoie** (chaque salve se retire ; une heure de session ne doit pas laisser
des milliers de nœuds morts), et **plafonne à six salves simultanées** — un clic
frénétique ne doit rien coûter.

`prefers-reduced-motion` est relu **à chaque clic**, pas une fois au montage : le
réglage système peut changer pendant que l'application tourne.

> La transition est **clé par route**. Sans cela, une seconde navigation
> survenant pendant que la lame passe réutiliserait les mêmes nœuds du DOM et
> l'animation ne rejouerait pas — or enchaîner deux onglets voisins est le cas le
> plus fréquent.

> **Le bloc `prefers-reduced-motion` annule aussi les DÉLAIS**, pas seulement les
> durées. Les cartes entrent en cascade via `animation-delay` (jusqu'à 210 ms)
> avec un remplissage `backwards` : pendant la phase de délai, l'élément est
> maintenu à son état de départ, donc à `opacity: 0`. Sans cette ligne, quelqu'un
> ayant demandé *moins* d'animations voyait des cartes **invisibles** pendant deux
> dixièmes de seconde — exactement le clignotement qu'il cherchait à éviter.
>
> Vérifié en émulant la préférence dans un vrai navigateur : **0 animation en
> cours, 0 carte invisible, 0 salve au clic** — contre 9 animations et une salve
> de sept étincelles sans la préférence.

Le bloc est **le dernier du fichier** : une animation ajoutée après lui y
échapperait.

## Exporter ses données

`backend/src/routes/export.js` · onglet **Profil**

Tout vit dans un Postgres qu'on héberge soi-même — ce qui ne suffit pas : des
données qu'on ne peut pas **sortir** sont des données captives, et le seul moyen
de les relire était d'ouvrir psql.

Trois CSV (séances, journal alimentaire, mesures de santé) et un JSON complet.
Les CSV portent une **marque d'ordre d'octets UTF-8** : sans elle, un tableur
affiche « Développé » comme « DÃ©veloppÃ© ». Les champs contenant une virgule
sont cités et leurs guillemets doublés — un nom d'exercice mal cité décalerait
toutes les colonnes suivantes, et un test vérifie l'alignement ligne à ligne.

**Aucun secret d'accès n'est exporté** : le jeton d'abonnement au calendrier est
délibérément exclu d'un fichier destiné à être transmis.

## Tendances

Onglet **Tendances** — composition corporelle empilée (masse maigre / masse
grasse), poids, calories contre cible, macronutriments, volume d'entraînement,
budget hebdomadaire. Chaque série indique sa variation entre la première et la
seconde moitié de la fenêtre.

> **Jamais deux échelles verticales sur un même cadre.** Superposer un poids en
> kg et des calories rendrait la comparaison visuelle purement décorative :
> l'écart apparent dépendrait du choix arbitraire des deux échelles, pas des
> données. Quand deux grandeurs partagent une unité — masse maigre et masse
> grasse, toutes deux en kg — elles vont dans le même cadre et sont empilées ;
> sinon elles ont chacune le leur.

La cible calorique est tracée en **ligne de référence discontinue**, pas comme
une seconde série : ce n'est pas une mesure.

## Tests

```bash
cd backend
npm test          # 290 tests unitaires : maths, percentiles, adaptateurs, nutrition,
                  #   anthropométrie, formules de métabolisme, calibration de la
                  #   dépense, curation, modèles, planification, iCalendar,
                  #   repères nutritionnels, suggestions de repas, catalogue des
                  #   sports, charge de Foster, gamification, volume par muscle,
                  #   adhérence, régularité
WEBHOOK_SECRET=… npm run test:e2e   # 307 tests contre une API + base réelles
```

> Le secret est **obligatoire** : sans lui, les sections webhook et balance
> échouent en bloc — quatorze faux négatifs qui masqueraient de vrais problèmes.
> `set -a && . ./.env && set +a` depuis la racine suffit.

Les tests d'intégration sont conçus pour tourner sur une base **déjà peuplée** :
ils mesurent des deltas et isolent leurs écritures derrière des identifiants
uniques. Ils sont rejouables sans réinitialisation, et **rendent l'état qu'ils
ont emprunté** : les séances qu'ils ouvrent sont supprimées, et le programme
actif de l'utilisateur est réactivé en fin de course. Plusieurs sections activent
leurs propres programmes de test, et l'index unique partiel `uq_programs_active`
désactive l'ancien au passage — sans restauration, la suite laissait
l'utilisateur sans séance du jour, sans calendrier et sans série.

### Vérifier les écrans

```bash
cd frontend
npm run check         # géométrie anatomique + cohérence de la navigation
npm run check:screens # ouvre CHAQUE écran dans un navigateur réel
```

`check:screens` existe à cause d'un bug précis : la page **Aliments** est restée
entièrement blanche sans que rien ne le signale, parce que `FoodCard.jsx`
appelait `round1` sans l'importer. Aucun garde-fou existant ne pouvait
l'attraper — le build réussit (un identifiant libre est une variable globale
légitime jusqu'à l'exécution), `check:nav` vérifie les routes et non ce qu'elles
rendent, et les tests backend ne chargent aucun composant.

Le seul juge fiable est le navigateur. Le script ouvre les treize routes, refuse
toute erreur console, toute exception, et tout écran rendu quasi vide.

```bash
chromium --headless=new --remote-debugging-port=9222 about:blank &
npm run check:screens
```

```bash
npm run seed:demo    # historique de démonstration (⚠️ TRUNCATE les séances)
npm run seed:foods   # catalogue d'aliments
npm run curate       # rejoue le classement des exercices, sans retélécharger le dataset
npm run seed:recipes # catalogue de recettes (exige seed:foods au préalable)
npm run seed:recipes -- --check   # vérifie que chaque ingrédient existe, sans écrire
npm run seed:foods -- --check   # contrôle de cohérence seul, sans écriture
```

Vérifient notamment qu'un pratiquant « intermédiaire » tombe bien au 50ᵉ
percentile, qu'un « avancé » au 80ᵉ, que la progression est monotone et que
`loadForPercentile` est bien la réciproque de `percentileFor`.

## Webhooks

```bash
curl -X POST http://localhost:3000/api/health-sync \
  -H 'Content-Type: application/json' \
  -H 'X-ForgeFit-Source: apple_health' \
  -d '{"data":{"metrics":[{"name":"HKQuantityTypeIdentifierHeartRateVariabilitySDNN",
       "units":"ms","data":[{"date":"2026-07-19T06:00:00Z","qty":68,"uuid":"hrv-1"}]}]}}'
```

Signature HMAC-SHA256 du corps brut dans `X-ForgeFit-Signature` quand
`WEBHOOK_SECRET` est défini. La source peut être omise : elle est alors déduite
de la forme du payload.

Suivi de l'ingestion : `GET /api/health-sync/events`.

## Endpoints

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/health` | Sonde (API + base) |
| GET | `/api/exercises` | Catalogue — filtres `discipline`, `target`, `equipment`, `axis`, `q`, `tier`, `pattern`, `curated` |
| GET | `/api/exercises/facets` | Valeurs disponibles pour les filtres, paliers compris |
| GET | `/api/exercises/evidence` | Règles de classement, patrons et références |
| GET | `/api/exercises/:idOrSlug` | Détail + instructions FR + palier et sources |
| GET/POST | `/api/workouts` | Séances — `program_day_id` rattache au programme |
| GET | `/api/workouts/open` | Séance en cours, pour reprendre après un verrouillage |
| GET | `/api/workouts/:id` | Détail + `plan` du jour de programme exécuté |
| DELETE | `/api/workouts/:id` | Supprime une séance ouverte par erreur |
| POST | `/api/workouts/:id/sets` | Enregistre une série |
| GET | `/api/workouts/last/:exerciseId` | Dernière perf (préremplissage) |
| POST | `/api/health-sync` | **Webhook universel** (202, async) |
| POST/GET | `/api/health/metrics` | Métriques dynamiques |
| POST/GET | `/api/health/hydration` | Quick Add + jauge |
| GET | `/api/nutrition/recipes` | Recettes — filtres `meal`, `q`, `tag`, `max_kcal` |
| GET | `/api/nutrition/recipes/:id` | Fiche complète avec ingrédients |
| GET | `/api/nutrition/suggestions` | Repas classés selon ce qu'il **reste** à manger |
| GET | `/api/nutrition/calibration` | Dépense **mesurée** sur le journal et les pesées |
| POST | `/api/nutrition/entries/recipe` | Enregistre une recette, ingrédient par ingrédient |
| GET | `/api/health/series` | Séries journalières (courbes Apple Watch) |
| GET | `/api/health/sources` | État des intégrations |
| GET | `/api/stats/radar` | 6 axes + rang + décomposition mobilité/souplesse |
| GET | `/api/stats/bodymap` | Fatigue par muscle |
| GET | `/api/stats/readiness` | Score de disponibilité |
| GET | `/api/stats/benchmark` | Paliers de force + charge du palier suivant |
| GET | `/api/stats/adherence` | Ce qui était **prévu** face à ce qui a été fait |
| GET | `/api/stats/streak` | Semaines consécutives à l'objectif du programme |
| GET | `/api/stats/load` | Charge, monotonie et vitesse de progression, tous sports |
| GET | `/api/stats/progression` | Niveau, XP par catégorie et distinctions |
| GET | `/api/sports` | Catalogue des 53 sports, groupés par catégorie |
| GET | `/api/sports/:key` | Fiche d'un sport : MET, profil musculaire, dosage |
| GET | `/api/export` | Ce qui est exportable, et sous quelle forme |
| GET | `/api/export/:dataset.csv` | Séances, nutrition ou santé, en CSV |
| GET | `/api/export/data.json` | Tout, format brut |
| POST | `/api/programs/generate` | Génère un programme depuis le radar |
| GET | `/api/programs/active` | Programme en cours, détaillé |
| GET | `/api/programs/templates` | Catalogue de modèles, par catégorie |
| GET | `/api/programs/templates/:key` | Fiche détaillée — `?equipment=` résout les exercices |
| POST | `/api/programs/from-template` | Instancie un modèle en programme modifiable |
| POST/PATCH | `/api/programs` · `/api/programs/:id` | Crée / modifie un programme à la main |
| POST | `/api/programs/:id/duplicate` | Copie modifiable, l'original intact |
| POST/PATCH/DELETE | `/api/programs/:id/days[/:dayId]` | Séances |
| POST/PATCH/DELETE | `/api/programs/:id/days/:dayId/items` · `/items/:itemId` | Lignes d'exercice |
| PUT | `/api/programs/:id/days/:dayId/order` | Réordonne les lignes d'une séance |
| GET | `/api/programs/calendar` | Plan et séances faites — `from`, `to`, `tz` |
| GET | `/api/calendar/subscribe.ics` | **Flux iCalendar** à abonner (Google, Apple, Outlook) |
| GET | `/api/calendar/subscription` | Le lien d'abonnement et ses limites |
| POST | `/api/calendar/subscription/rotate` | Révoque le lien et en génère un nouveau |

Toutes les routes acceptent `X-User-Id` ; à défaut, l'utilisateur de
démonstration est utilisé.

## Navigation

Dix onglets au même rang, c'est une liste, pas une architecture. Ils sont
regroupés en **quatre sections, par intention** :

| Section | Pages | Nature |
|---|---|---|
| 🏋️ Entraînement | Séance · Programme · Exercices | outil de terrain |
| 🍽️ Nutrition | Journal · Aliments | outil de terrain |
| 📈 Progression | Aperçu · Tendances · Benchmark · Santé | salle de contrôle |
| ⚙️ Profil | Profil | réglages |

Les deux premières servent à **agir**, la troisième à **lire**. Les mélanger
obligeait à traverser des écrans d'analyse pour atteindre un bouton de saisie.

- **Mobile** — sections dans une **barre basse**, atteignable au pouce ; une
  barre haute est hors de portée sur un grand téléphone. Ouvre par défaut sur
  *Entraînement › Séance* : on vient saisir.
- **Desktop** — sections en barre haute, ouvre sur *Progression › Aperçu* : on
  vient lire.
- Les pages d'une section sont en **sous-navigation collante**, qui reste
  accessible pendant le défilement d'une longue page d'analyse.

La route vit dans le **fragment d'URL** (`#/nutrition/journal`) : le bouton
retour fonctionne, un rechargement ne ramène pas à l'accueil, et un écran précis
peut être mis en favori. Une URL tronquée (`#/nutrition`) retombe sur la première
page de la section plutôt que sur un écran blanc.

```bash
cd frontend && npm run check    # anatomie + navigation
```

> `check:nav` compare la structure déclarée au câblage réel de `App.jsx`. Une
> page déclarée sans composant — ou l'inverse — ne casse aucun build : elle
> produit un onglet qui ouvre du vide. C'est aussi pour cela que
> `lib/navigation.js` ne contient que des **données pures**, sans import JSX :
> le module reste analysable par Node, donc vérifiable hors navigateur.

## Front

- **Terrain (mobile-first)** — recherche debouncée, cibles tactiles ≥ 60 px,
  steppers ±, préremplissage par la dernière performance, Quick Add hydratation
  en mise à jour optimiste (le bouton répond avant le réseau).
- **Analyse (desktop)** — radar Recharts à 6 axes avec médiane de référence,
  carte corporelle SVG (face/dos) en heatmap de fatigue, Readiness décomposé
  signal par signal, standards de force.
- **Programme** — génération guidée par les points faibles, avec le raisonnement
  affiché.
- **Benchmark** — position sur l'échelle des paliers et charge exacte du palier
  suivant.
- **Santé** — petits multiples (une métrique = un graphique, jamais deux
  échelles verticales sur un même cadre) et guide de connexion Apple Watch.
- **Exercices** — catalogue filtrable (discipline, muscle, recherche FR) et
  fiche détaillée : démonstration animée, schéma anatomique des muscles
  sollicités (principal plein / secondaires translucides), consignes numérotées
  en français, et repères de dosage propres à la discipline.

La géométrie anatomique vit dans `src/lib/anatomy.js`, partagée entre la heatmap
de fatigue et le schéma des fiches — les tracés SVG ne sont écrits qu'une fois.

Ces tracés sont **adaptés de [react-muscle-highlighter](https://github.com/soroojshehryar/react-muscle-highlighter)**
(MIT, cf. `THIRD_PARTY_NOTICES.md`), retenus après comparaison : les autres
bibliothèques libres examinées ([body-highlighter](https://github.com/lahaxearnaud/body-highlighter))
n'emploient que des **polygones à segments droits**, donc un rendu facetté.
Celle-ci est tracée en courbes de Bézier, ce qui donne des galbes crédibles.

Une région peut porter **plusieurs muscles** de notre catalogue quand le modèle
source ne les sépare pas (les dorsaux sont fondus dans le haut du dos). La
heatmap affiche alors la fatigue **la plus élevée** de la région : sous-estimer
une charge serait plus trompeur que l'inverse sur une carte de récupération.

`anatomy.js` est **généré**, pas écrit à la main :

```bash
cd frontend
npm run generate:anatomy   # depuis scripts/anatomy-source.json
npm run check:anatomy      # cadrage, symétrie, couverture, intégrité
```

Les deux figures sont côte à côte dans le canevas source. **Les tracés ne sont
jamais modifiés** : chaque vue a son propre `viewBox`, qui vise simplement la
zone où sa figure est dessinée. Les dimensions des deux cadres sont identiques,
pour que la figure ne change pas de taille au basculement face/dos.

> ### Pourquoi aucune arithmétique sur la géométrie
>
> La tentation est de translater le dos pour ramener les deux vues à une origine
> commune. C'est un piège : ces tracés emploient des **arcs relatifs** dont les
> drapeaux s'écrivent en notation compacte. Dans `a1.5 1.5 0 0114.6 3.5`, la
> séquence `0114.6` vaut drapeaux `0` et `1` puis abscisse `14.6`. Un découpage
> par expression régulière y lit *un* nombre, se retrouve avec 5 arguments au
> lieu de 7, et **tronque le tracé** — silencieusement, en produisant du SVG
> syntaxiquement valide.
>
> Le résultat : la moitié des muscles du dos amputés, figure asymétrique. Rien
> ne le signalait, ni le build, ni les tests, ni un contrôle de boîte englobante
> écrit avec le même analyseur défaillant (les deux erreurs s'annulaient).
>
> `scripts/svg-path.mjs` contient désormais un analyseur correct — les drapeaux
> d'arc s'y lisent caractère par caractère, comme l'exige la grammaire SVG — et
> `check:anatomy` contrôle la **symétrie gauche/droite** de chaque groupe
> musculaire, précisément le symptôme qu'une troncature produit.

Les étirements se saisissent en **secondes** dans le mode Terrain : envoyer des
répétitions fausserait à la fois le volume et le score de souplesse, qui se
calcule sur le temps cumulé.

La palette est validée par script (bande de luminance, plancher de chroma,
séparation daltonienne, contraste). La rampe de fatigue est séquentielle à
teinte unique et monotone en luminance. Chaque graphique a une vue tableau
équivalente, et la couleur n'est jamais le seul porteur d'information.

## Notes

- Le bundle front pèse ~523 kB (153 kB gzip), dominé par Recharts. Un
  `manualChunks` ou un passage à un rendu SVG maison le réduirait nettement.
- L'authentification n'est pas implémentée : `X-User-Id` tient lieu d'identité.
  C'est le premier chantier avant toute exposition publique.
