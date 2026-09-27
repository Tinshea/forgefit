# Déploiement

Deux fichiers, deux usages :

| Fichier | Source des images | Méthode Portainer |
|---|---|---|
| `docker-compose.yml` | construites depuis les sources | Repository |
| `docker-compose.prod.yml` | tirées de GHCR | **Éditeur web** |

**Utiliser `docker-compose.prod.yml`.** Rien à construire, et la mise à jour se
fait en un clic.

---

## Home lab — machine Linux avec Docker

Le chemin le plus court : le serveur tire les images publiées, rien ne se
construit chez lui, et une poussée sur `main` suffit à le mettre à jour.

### 0. Vérifier l'architecture du serveur

Les images publiées sont construites **pour amd64 uniquement**. Sur le serveur :

```bash
uname -m
```

- `x86_64` → tout fonctionne, passer à l'étape 1.
- `aarch64` / `armv7l` (Raspberry Pi, NAS ARM) → les images ne démarreront pas.
  Corriger dans `.github/workflows/docker.yml` :
  `platforms: linux/amd64,linux/arm64`, puis republier. La construction devient
  nettement plus lente — le front est compilé sous émulation QEMU.

### 1. Poser les fichiers

Sur le serveur, un seul fichier est nécessaire — le compose de production.
Ni les sources, ni Git :

```bash
mkdir -p ~/atlas && cd ~/atlas
curl -fsSLO https://raw.githubusercontent.com/<compte>/atlas/main/docker-compose.prod.yml
```

### 2. Écrire le `.env`

À côté du compose. **Il ne part jamais sur GitHub** — `.gitignore` l'exclut, et
c'est le seul endroit où vivent les secrets.

```bash
cat > .env <<EOF
GITHUB_OWNER=<ton-compte-en-minuscules>
POSTGRES_PASSWORD=$(openssl rand -base64 24)
WEBHOOK_SECRET=$(openssl rand -base64 24)
WEBHOOK_TOKEN=$(openssl rand -base64 24)
MDNS_HOST=$(hostname).local
CORS_ORIGINS=http://$(hostname).local:8080
EOF
chmod 600 .env
```

`MDNS_HOST` mérite un mot : c'est ce qui donne au raccourci iOS une adresse
**stable**. Une IP de réseau local est distribuée par le routeur et change au
redémarrage — l'adresse figée dans le raccourci devient alors fausse, en
silence. Le nom `.local` ne bouge pas, et l'iPhone le résout nativement.

`WEBHOOK_TOKEN` est indispensable au raccourci : Raccourcis n'a aucune action
de hachage HMAC et ne peut donc pas signer ses envois.

### 3. Démarrer

```bash
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs -f api
```

L'API **refuse de démarrer** si un secret vaut encore la valeur d'exemple du
dépôt, ou si ni `WEBHOOK_SECRET` ni `WEBHOOK_TOKEN` n'est défini. Ce dépôt étant
public, `dev-secret-change-me` n'est un secret pour personne — et le webhook
santé contourne la session, donc une instance mal configurée accepte les mesures
de n'importe qui.

Puis peupler la base : voir *Peupler la base*, plus bas.

### 4. Mise à jour automatique à chaque poussée

Avant d'activer ceci, savoir ce qui la protège : `.github/workflows/verifier.yml`
lance les 415 tests et les contrôles du paquet à chaque poussée, et
`docker.yml` en dépend (`needs: verifier`). **Aucune image n'est publiée si la
vérification échoue** — donc Watchtower n'a rien de cassé à tirer.

Sans ce préalable, une régression partirait en production sans que personne ne
la voie passer.

#### Activer Watchtower


`.github/workflows/docker.yml` publie trois images sur GHCR à chaque push sur
`main`. Reste à ce que le serveur les prenne.

```bash
docker compose -f docker-compose.prod.yml --profile auto up -d
```

Ce profil ajoute **Watchtower**, qui interroge GHCR toutes les cinq minutes et
redémarre un conteneur dès qu'une image plus récente y apparaît. À partir de là,
`git push` suffit : la construction part en CI, l'image est publiée, le serveur
la tire.

Trois décisions tenues dans ce réglage :

- **Le serveur tire, GitHub ne pousse pas.** Un webhook de GitHub vers la maison
  supposerait d'ouvrir un port depuis Internet jusqu'au home lab. Tirer ne
  demande rien : le serveur sort, personne n'entre.
- **La base est hors périmètre.** Seuls `api` et `web` portent l'étiquette que
  Watchtower surveille. On ne remplace pas une base de données dans le dos de
  son propriétaire.
- **Le profil est facultatif.** Une mise à jour qui se déclenche seule est un
  choix, pas un défaut — elle peut tomber au milieu d'une séance. Sans
  `--profile auto`, rien ne bouge sans toi.

Pour mettre à jour à la main, à l'inverse :

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

### 5. Les images sont PRIVÉES par défaut, même si le dépôt est public

C'est le piège, et il ne se devine pas : **un paquet GitHub n'hérite pas de la
visibilité de son dépôt.** Un conteneur publié pour la première fois est privé,
que le dépôt soit public ou non. Vérifié : un `docker pull` anonyme des trois
images répond 403.

Conséquence : sans rien faire, le serveur ne peut pas les tirer.

**Option A — les rendre publiques** (recommandé si le dépôt l'est déjà). Le
serveur tire sans compte, sans jeton, et rien à renouveler. Les images ne
contiennent que ce que le dépôt contient déjà : le code, le schéma, le paquet
construit. Aucun secret — ils viennent de l'environnement au démarrage.

> GitHub → onglet **Packages** du profil → un paquet → *Package settings* →
> *Danger Zone* → **Change visibility** → *Public*. À faire pour les trois :
> `atlas-api`, `atlas-web`, `atlas-db`.

**Option B — les laisser privées.** Il faut alors un jeton avec la portée
`read:packages`, sur le serveur et pour Watchtower :

```bash
echo "GHCR_USER=<ton-compte>" >> .env
echo "GHCR_TOKEN=<jeton read:packages>" >> .env
docker login ghcr.io -u <ton-compte> --password-stdin <<< "<jeton>"
```

Un jeton de plus à stocker, à renouveler quand il expire, et une panne de
déploiement silencieuse le jour où il expire.

---

## Portainer, à partir des images publiées

### 1. Publier les images

À chaque push sur `main`, `.github/workflows/docker.yml` construit et publie
trois images sur GitHub Container Registry :

```
ghcr.io/<compte>/atlas-api:latest
ghcr.io/<compte>/atlas-web:latest
ghcr.io/<compte>/atlas-db:latest
```

Étiquettes produites : `latest`, la version si le commit porte un tag `vX.Y.Z`,
et le hash court du commit — ce dernier permet de revenir en arrière
précisément.

**Rendre les paquets publics.** Le dépôt étant privé, les images le sont aussi,
et Portainer devrait s'authentifier. Plus simple : GitHub → *Packages* →
chaque paquet → *Package settings* → *Change visibility* → **Public**. Les
images ne contiennent aucun secret ; ceux-ci arrivent par variables
d'environnement au démarrage.

Sinon : Portainer → *Registries* → *Add registry* → *Custom* → `ghcr.io`, avec un
jeton d'accès personnel de portée `read:packages`.

### 2. Créer la stack

Portainer → *Stacks* → *Add stack* → **Web editor**, puis coller le contenu de
`docker-compose.prod.yml`.

### 3. Variables d'environnement

| Variable | Valeur | |
|---|---|---|
| `GITHUB_OWNER` | ton compte GitHub, en minuscules | |
| `POSTGRES_PASSWORD` | mot de passe fort | **obligatoire** |
| `WEBHOOK_SECRET` | chaîne aléatoire | **obligatoire** |
| `WEBHOOK_TOKEN` | chaîne aléatoire | sans lui, le raccourci iOS est refusé |
| `MDNS_HOST` | `serveur.local` | adresse stable pour le raccourci |
| `CORS_ORIGINS` | `http://<ip-hôte>:8080` | |
| `WEB_PORT` / `API_PORT` | `8080` / `3000` | si ces ports sont libres |
| `TAG` | `latest` | ou un hash de commit pour figer une version |

Les deux variables obligatoires utilisent la syntaxe `${VAR:?message}` : la stack
**refuse de démarrer** si elles manquent, plutôt que de tourner avec un mot de
passe par défaut ou sans vérification de signature.

### 4. Peupler la base

Le schéma s'applique tout seul au premier démarrage — il est embarqué dans
l'image `atlas-db`. Restent les données, via *Containers → atlas-api →
Console* :

```bash
npm run ingest       # 1324 exercices
npm run seed:foods   # catalogue d'aliments
```

### 5. Mettre à jour

Après un push sur `main`, attendre la fin du workflow, puis :

Portainer → *Stacks* → `atlas` → **Update the stack** → cocher
**Re-pull image** → *Update*.

Quelques secondes d'indisponibilité. Le volume `db_data` n'est pas touché : les
données survivent.

> **Mise à jour automatique.** Ajouter [Watchtower](https://containrrr.dev/watchtower/)
> à côté de la stack surveille GHCR et redéploie seul. Pratique, mais on perd la
> maîtrise du moment où l'application change — sur un service qu'on utilise
> quotidiennement, la mise à jour manuelle en un clic est souvent préférable.

### Revenir en arrière

Passer `TAG` au hash court d'un commit antérieur (visible dans les étiquettes
publiées) et redéployer. C'est la raison d'être de cette étiquette : `latest`
seul ne permet aucun retour arrière.

---

## Portainer, à partir des sources

À n'utiliser que pour déployer une branche non publiée.

### Le point qui coince

`docker-compose.yml` utilise `build:`. **L'éditeur web de Portainer ne peut pas
construire d'image** : il n'a aucun contexte de build sur le serveur.

Il faut la méthode **Repository**, où Portainer clone le dépôt et construit sur
l'hôte.

### Étapes

**1. Rendre le dépôt accessible à Portainer**

Le dépôt est privé. Deux options :

- créer un *jeton d'accès personnel* GitHub (portée `repo`) et le renseigner dans
  Portainer ;
- ou rendre le dépôt public — à ne faire qu'après avoir relu ce qui y est
  publié (l'adresse e-mail figure dans l'historique git).

**2. Créer la stack**

Portainer → *Stacks* → *Add stack* → **Repository**

| Champ | Valeur |
|---|---|
| Name | `atlas` |
| Repository URL | `https://github.com/<compte>/atlas` |
| Reference | `refs/heads/main` |
| Compose path | `docker-compose.yml` |
| Authentication | activer si le dépôt est privé |

**3. Variables d'environnement**

Dans la section *Environment variables* de la stack :

| Variable | Valeur | Pourquoi |
|---|---|---|
| `POSTGRES_PASSWORD` | *(mot de passe fort)* | la valeur par défaut est `forgefit` |
| `WEBHOOK_SECRET` | *(chaîne aléatoire)* | sinon les webhooks sont acceptés sans signature |
| `CORS_ORIGINS` | `http://<ip-hôte>:8080` | origine réelle depuis laquelle tu ouvriras l'app |
| `WEB_PORT` | `8080` | à changer si le port est déjà pris |
| `API_PORT` | `3000` | idem |

**Ne pas renseigner `VITE_API_BASE`.** Vide, le front appelle sa propre origine
et nginx relaie vers l'API. Une valeur en dur y serait *inlinée dans le bundle
au build* et casserait l'accès depuis toute machine autre que l'hôte.

**4. Déployer, puis peupler**

Le premier démarrage crée le schéma (les scripts de `db/init` s'exécutent sur un
volume vide). Il reste à charger les données :

```bash
docker exec atlas-api npm run ingest      # 1324 exercices
docker exec atlas-api npm run seed:foods  # catalogue d'aliments
```

Depuis Portainer sans shell : *Containers → atlas-api → Console → Connect*.

**5. Vérifier**

```
http://<ip-hôte>:3000/api/health   → {"status":"ok","database":"up"}
http://<ip-hôte>:8080              → l'application
```

---

## Avant d'exposer sur Internet

> ### L'API n'a aucune authentification
>
> L'identité vient de l'en-tête `X-User-Id`, **sans aucune vérification**.
> Quiconque atteint l'API lit et écrit les données de n'importe qui.
>
> Sur un réseau domestique fermé, c'est un risque théorique. Derrière une
> redirection de port ou un reverse proxy public, c'en est un réel — et les
> données concernées (poids, masse grasse, sommeil, fréquence cardiaque) sont
> une **catégorie particulière au sens du RGPD**.
>
> Tant que l'authentification n'existe pas : garder la stack sur le réseau
> local, ou derrière un VPN (WireGuard, Tailscale).

Autres points avant une exposition durable :

- **Sauvegardes.** Le volume `db_data` contient tout. `docker exec atlas-db
  pg_dump -U forgefit forgefit > sauvegarde.sql`, planifié.
- **HTTPS.** Un reverse proxy (Traefik, Caddy, Nginx Proxy Manager) devant le
  service `web`. Les webhooks transportant des données de santé, le clair n'est
  pas acceptable hors réseau local.
- **`WEBHOOK_SECRET`.** Non renseigné, la vérification de signature est
  *désactivée* : n'importe qui peut injecter de fausses mesures.

---

## Vérification hors Docker

```bash
cd scripts && npm install
npm run check:compose
```

Contrôle la syntaxe, les références croisées (réseaux, volumes, dépendances) et
les pièges Portainer connus — réseau externe manquant, `build:` incompatible avec
l'éditeur web, `VITE_API_BASE` figé.

> Ce contrôle a servi dès son écriture : `VITE_API_BASE` valait
> `http://localhost:3000`, ce qui aurait fait appeler au navigateur **sa propre
> machine** et cassé l'app depuis n'importe quel autre appareil. Un défaut
> invisible en développement, où le navigateur *est* sur l'hôte.

---

## Réserve

**Cette stack n'a jamais été exécutée.** Elle est validée statiquement — syntaxe,
cohérence, chemins de configuration — mais aucun `docker compose up` ne l'a
confirmée, faute de Docker sur la machine de développement.

Points les plus susceptibles de demander un ajustement au premier lancement :

- la construction du front (`npm install` + `vite build` dans le conteneur) ;
- l'ordre d'exécution des scripts `db/init` sur un volume vierge ;
- les permissions du volume `db_data` selon l'hôte.
