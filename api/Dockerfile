# Image de l'API, front compris.
#
# Le contexte de construction est la racine du dépôt (pas api/) : l'étape 1 a
# besoin de front/. Traefik ne route que vers ce conteneur, le front doit donc
# être servi par l'API.
#
#   docker build -f api/Dockerfile -t binggge-api .

# --- Étape 1 : construire le front ---
FROM node:20-alpine AS front
WORKDIR /front
COPY front/package*.json ./
RUN npm ci
COPY front/ ./
# Traefik expose l'application sous /TasTom et retire ce préfixe avant de
# transmettre : le front doit donc connaître ce préfixe pour ses propres URL.
ENV VITE_BASE_PATH=/TasTom/
ENV VITE_API_URL=/TasTom
RUN npm run build

# --- Étape 2 : l'API ---
FROM node:20-alpine
WORKDIR /app
COPY api/package*.json ./
RUN npm ci --omit=dev
COPY api/src ./src
# Les fichiers statiques du front, servis par express.static.
COPY --from=front /front/dist ./public
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "src/server.js"]