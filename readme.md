# binggge

API de recherche de séries + watchlist personnelle.
La recherche utilise l'API publique TVMaze, l'API renvoie une liste allégée.

## Démarrage 

Docker :

```bash
docker build -t api-binggge .
docker run -p 3000:3000 api-binggge
```

Prérequis : Node 20+, npm. Aucune clé API, aucune base requise pour la séance 1.

## Routes existantes

### GET /health

```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

Utilisée en séance 3 pour le monitoring.

### GET /shows?q=

Appelle `https://api.tvmaze.com/search/shows?q=` et renvoie une liste allégée : `id, title, year, image`.

```bash
curl "http://localhost:3000/shows?q=girls"
# [{"id":139,"title":"Girls","year":2012,"image":"https://..."}, ...]
```

Erreur si `q` absent : `400 {"error":"Le paramètre 'q' est requis"}`.

### GET /watchlist

```bash
curl http://localhost:3000/watchlist
# []
```

Stub séance 1 : renvoie toujours un tableau vide. La persistance arrive en séance 2.

## Ce qui n'existe pas encore

- Inscription / connexion (tokens).
- Persistance watchlist (POST / DELETE).
- `401` sans en-tête d'authentification.
- Validation : titre vide refusé.
- Base de données.

Voir `tests/server.test.js` : les 3 tests sont en `test.todo`, donc en attente.

## Tests

```bash
npm test
```

Affiche 3 tests en attente (squelette séance 2, échec volontaire).

## Structure

```
src/index.js        # serveur http natif, 3 routes
tests/server.test.js # squelette tests séance 2
Dockerfile          # node:20-alpine, EXPOSE 3000
```