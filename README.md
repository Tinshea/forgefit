# ForgeFit

Suivi d'entraînement et hub santé. Microservice conteneurisé : API Node/Express,
front React/Vite, PostgreSQL avec modèle santé dynamique (JSONB).

## Démarrage (Docker)

```bash
cp .env.example .env          # ajuster POSTGRES_PASSWORD et WEBHOOK_SECRET
docker network create forgefit-mesh   # réseau partagé du pipeline de données
docker compose up -d --build
docker compose exec api npm run ingest   # charge les 1324 exercices
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

## Programme

`POST /api/programs/generate` construit un programme à partir du **radar**, pas
d'un template figé.

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

Katch-McArdle est la formule la plus juste, mais elle exige de connaître son taux
de masse grasse — ce que la plupart des gens ignorent, et sans quoi elle ne peut
pas s'appliquer du tout. **Mifflin-St Jeor** prend en entrée taille, poids, âge et
sexe, des données que tout le monde possède : c'est le repli, et c'est là que la
taille devient indispensable.

| Formule | Condition | Précision |
|---|---|---|
| Katch-McArdle | masse grasse connue | haute |
| Mifflin-St Jeor | taille + poids + âge | moyenne |

L'API dit toujours **quelle formule a servi** (`bmr_method`) : un chiffre sans sa
méthode n'est pas vérifiable.

La taille sert aussi à l'**IMC** et au **FFMI** — l'équivalent musculaire de l'IMC,
normalisé à 1,80 m, qui permet de comparer des gabarits différents.

> L'IMC ne distingue pas muscle et graisse. Chez un pratiquant entraîné il sort
> régulièrement en « surpoids » sans excès d'adiposité : la fiche le signale
> quand le FFMI indique une masse maigre élevée, plutôt que de laisser lire un
> contresens.

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
npm test          # 82 tests unitaires : maths, percentiles, adaptateurs, nutrition, anthropométrie
npm run test:e2e  # 84 tests d'intégration contre une API + base réelles
```

Les tests d'intégration sont conçus pour tourner sur une base **déjà peuplée** :
ils mesurent des deltas et isolent leurs écritures derrière des identifiants
uniques. Ils sont rejouables sans réinitialisation.

```bash
npm run seed:demo    # historique de démonstration (⚠️ TRUNCATE les séances)
npm run seed:foods   # catalogue d'aliments
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
| GET | `/api/exercises` | Catalogue — filtres `discipline`, `target`, `equipment`, `axis`, `q` |
| GET | `/api/exercises/facets` | Valeurs disponibles pour les filtres |
| GET | `/api/exercises/:idOrSlug` | Détail + instructions FR |
| GET/POST | `/api/workouts` | Séances |
| POST | `/api/workouts/:id/sets` | Enregistre une série |
| GET | `/api/workouts/last/:exerciseId` | Dernière perf (préremplissage) |
| POST | `/api/health-sync` | **Webhook universel** (202, async) |
| POST/GET | `/api/health/metrics` | Métriques dynamiques |
| POST/GET | `/api/health/hydration` | Quick Add + jauge |
| GET | `/api/health/series` | Séries journalières (courbes Apple Watch) |
| GET | `/api/health/sources` | État des intégrations |
| GET | `/api/stats/radar` | 6 axes + rang + décomposition mobilité/souplesse |
| GET | `/api/stats/bodymap` | Fatigue par muscle |
| GET | `/api/stats/readiness` | Score de disponibilité |
| GET | `/api/stats/benchmark` | Paliers de force + charge du palier suivant |
| POST | `/api/programs/generate` | Génère un programme depuis le radar |
| GET | `/api/programs/active` | Programme en cours, détaillé |

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
