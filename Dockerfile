FROM node:20-alpine

WORKDIR /app

# Le code de l'API vit dans api/ : on installe ses dépendances là.
COPY api/package*.json ./api/
RUN npm install --prefix api --omit=dev

COPY api/ ./api/

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "api/src/server.js"]