# Déploiement

## Portainer

### Le point qui coince

La stack utilise `build:` pour l'API et le front. **L'éditeur web de Portainer
ne peut pas construire d'image** : il n'a aucun contexte de build sur le serveur.
Coller le `docker-compose.yml` dans l'éditeur échouera.

Il faut donc la méthode **Repository**, où Portainer clone le dépôt et construit
sur l'hôte.

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
