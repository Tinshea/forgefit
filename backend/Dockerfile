FROM node:22-alpine

WORKDIR /app

# Couche de dépendances séparée: le cache survit aux changements de code.
COPY package.json package-lock.json* ./
# ┌─ `npm ci` ET NON `npm install` ──────────────────────────────────┐
# │ `npm install` peut RESOUDRE AUTREMENT que le fichier de           │
# │ verrouillage, et le reecrire au passage. L'image ne contenait     │
# │ donc pas forcement ce qui tournait sur le poste de travail —      │
# │ exactement la promesse que Docker est cense tenir.                │
# │                                                                     │
# │ Cas reel : une montee de vite en 8 a fait echouer la construction │
# │ de l'image alors que tout passait en local, ou un `node_modules`  │
# │ plus ancien survivait. `npm ci` part d'une arborescence VIDE et   │
# │ installe exactement le verrou : il echoue tot, et partout pareil. │
# └───────────────────────────────────────────────────────────────────┘
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Ne pas tourner en root.
USER node

# Healthcheck applicatif: vérifie aussi la connexion Postgres.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
