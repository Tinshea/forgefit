# Déploiement

Deux fichiers, deux usages :

| Fichier | Source des images | Méthode Portainer |
|---|---|---|
| `docker-compose.yml` | construites depuis les sources | Repository |
| `docker-compose.prod.yml` | tirées de GHCR | **Éditeur web** |

**Utiliser `docker-compose.prod.yml`.** Rien à construire, et la mise à jour se
fait en un clic.

---

## Portainer, à partir des images publiées

### 1. Publier les images

À chaque push sur `main`, `.github/workflows/docker.yml` construit et publie
trois images sur GitHub Container Registry :

```
ghcr.io/<compte>/forgefit-api:latest
ghcr.io/<compte>/forgefit-web:latest
ghcr.io/<compte>/forgefit-db:latest
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
| `CORS_ORIGINS` | `http://<ip-hôte>:8080` | |
| `WEB_PORT` / `API_PORT` | `8080` / `3000` | si ces ports sont libres |
| `TAG` | `latest` | ou un hash de commit pour figer une version |

Les deux variables obligatoires utilisent la syntaxe `${VAR:?message}` : la stack
**refuse de démarrer** si elles manquent, plutôt que de tourner avec un mot de
passe par défaut ou sans vérification de signature.

### 4. Peupler la base

Le schéma s'applique tout seul au premier démarrage — il est embarqué dans
l'image `forgefit-db`. Restent les données, via *Containers → forgefit-api →
Console* :

```bash
npm run ingest       # 1324 exercices
npm run seed:foods   # catalogue d'aliments
```

### 5. Mettre à jour

Après un push sur `main`, attendre la fin du workflow, puis :

Portainer → *Stacks* → `forgefit` → **Update the stack** → cocher
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
| Name | `forgefit` |
| Repository URL | `https://github.com/<compte>/forgefit` |
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
docker exec forgefit-api npm run ingest      # 1324 exercices
docker exec forgefit-api npm run seed:foods  # catalogue d'aliments
```

Depuis Portainer sans shell : *Containers → forgefit-api → Console → Connect*.

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

- **Sauvegardes.** Le volume `db_data` contient tout. `docker exec forgefit-db
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
