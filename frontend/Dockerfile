# --- Etape de build -------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install && npm cache clean --force

# Vite inline les variables VITE_* dans le bundle : elles doivent donc
# etre presentes AVANT le build, pas au demarrage du conteneur.
#
# ┌─ LE DEFAUT EST VIDE, ET C'EST ESSENTIEL ─────────────────────────┐
# │ Il valait « http://localhost:3000 », et comme le workflow de     │
# │ publication ne passe aucun build-arg, CHAQUE image poussee sur   │
# │ GHCR portait cette valeur figee dans son JavaScript.             │
# │                                                                   │
# │ Une instance deployee depuis ces images ne fonctionnait donc que │
# │ pour un navigateur tournant SUR LE SERVEUR : partout ailleurs,   │
# │ « localhost » designe la machine du visiteur, et toutes les      │
# │ requetes echouaient. C'est ce qui a casse l'acces telephone.     │
# │                                                                   │
# │ Vide, les requetes partent en relatif et nginx les relaie vers   │
# │ l'API (cf. nginx.conf).                                          │
# └───────────────────────────────────────────────────────────────────┘
ARG VITE_API_BASE=
ENV VITE_API_BASE=$VITE_API_BASE

COPY . .
RUN npm run build

# ┌─ LE GARDE-FOU EST DANS LA CONSTRUCTION, PAS DANS L'INTEGRATION ──┐
# │ Une image fautive ne doit pas pouvoir EXISTER, encore moins etre │
# │ publiee. Echouer ici coute une construction ; s'en apercevoir    │
# │ apres publication coute une instance cassee pour tous ceux qui   │
# │ ne sont pas sur le serveur.                                      │
# └───────────────────────────────────────────────────────────────────┘
RUN node scripts/check-origin.mjs

# --- Etape de service -----------------------------------------------
FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
