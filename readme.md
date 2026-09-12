# binggge

API de recherche de séries + watchlist personnelle, en Express et PostgreSQL.
La recherche s'appuie sur l'API publique TVMaze et ne renvoie qu'une liste
allégée : identifiant, titre, année, image.

Tout le code de l'API vit dans `api/`.

## Démarrage en deux commandes

Tout en Docker (API + base, le plus simple) :

```bash
docker compose up -d --build
```

L'API répond sur http://localhost:3000. Le schéma est chargé automatiquement
au premier démarrage.

Ou à la main, pour développer avec rechargement :

```bash
npm run install:api   # installe les dépendances de api/
docker compose up -d db
npm start             # démarre l'API sur http://localhost:3000
```

Sans base, `/health` et `/shows` répondent quand même ; les routes watchlist
renvoient une erreur 500.

Prérequis : Node 20+, npm, Docker. Aucune clé API.

## Base de données

```bash
docker compose up -d db
```

Postgres 16, base `binggge`, mot de passe `binggge`, exposé sur `localhost:5432`.
Le volume `pgdata` conserve les données entre les redémarrages.

Au **tout premier** démarrage (volume vide), `api/db/schema.sql` est joué
automatiquement via `/docker-entrypoint-initdb.d`. Si le volume existe déjà,
ce mécanisme ne se déclenche pas : créez les tables à la main.

```powershell
# PowerShell (l'opérateur < n'existe pas)
Get-Content api/db/schema.sql | docker compose exec -T db psql -U postgres binggge
```

```bash
# bash / cmd
docker compose exec -T db psql -U postgres binggge < api/db/schema.sql
```

`schema.sql` est rejouable : il supprime puis recrée les tables — **il efface
donc les données**. Tables : `users(id, login)`, `watchlist(id, user_id,
show_id, title, seen)`.

L'API lit `DATABASE_URL`. En conteneur, compose la fixe à
`postgres://postgres:binggge@db:5432/binggge` — `db` est le nom du service, pas
`localhost`. Hors conteneur, la valeur par défaut est
`postgres://postgres:binggge@localhost:5432/binggge`.

Pour repartir d'une base vide : `docker compose down -v` (supprime le volume,
donc les données, et rejoue le schéma au démarrage suivant).

## Routes existantes

| Méthode | Route | Accès | Réponse |
|---|---|---|---|
| GET | `/health` | public | `200 {"status":"ok"}` |
| GET | `/shows?q=` | public | `200 [{id, title, year, image}]` |
| POST | `/register` | public | `201 {login}` |
| GET | `/watchlist` | privé | `200 [{id, showId, title, seen}]` |
| POST | `/watchlist` | privé | `201 {id, showId, title, seen}` |

Une route privée exige l'en-tête `X-User: <login>`. Sans en-tête — ou avec un
login inconnu — elle répond `401`. Attention : c'est une identification, pas une
authentification. Voir la section [Authentification](#authentification-inexistante)
plus bas.

### GET /health

```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

Sonde de disponibilité, appelée par le pipeline en séance 3.

### GET /shows?q=

```bash
curl "http://localhost:3000/shows?q=severance"
# [{"id":44933,"title":"Severance","year":2022,"image":"https://..."}, ...]
```

Répond `400` si `q` est absent.

### POST /register

```bash
curl -X POST localhost:3000/register \
  -H 'content-type: application/json' -d '{"login":"olivia"}'
# 201 {"login":"olivia"}
```

Répond `400` si `login` est vide, `409` s'il est déjà pris.

### GET /watchlist

```bash
curl localhost:3000/watchlist                              # 401
curl localhost:3000/watchlist -H 'X-User: olivia'          # []
```

### POST /watchlist

```bash
curl -X POST localhost:3000/watchlist -H 'X-User: olivia' \
  -H 'content-type: application/json' \
  -d '{"show_id":44778,"title":"Severance"}'
# 201 {"id":1,"showId":44778,"title":"Severance","seen":false}
```

Répond `400` si `show_id` n'est pas un entier ou si `title` est vide.

Toute route inconnue répond `404 {"error":"Route introuvable"}`.

## Authentification inexistante

**Cette API n'a aucune authentification.** Aucun mot de passe, aucun token,
aucune session. Rien ne prouve à l'API que celui qui envoie une requête est bien
celui qu'il prétend être.

L'en-tête `X-User: tom` est une **déclaration** : le client annonce un nom, le
serveur le croit sur parole. N'importe qui peut lire ou modifier la watchlist de
n'importe qui en changeant une chaîne de caractères :

```bash
# la watchlist d'olivia, sans son accord
curl localhost:3000/watchlist -H 'X-User: tom'
```

C'est une **identification** (nommer un utilisateur) et non une
**authentification** (prouver son identité). Ce sont deux problèmes distincts, et
ici seul le premier est traité.

### Pourquoi ce choix

C'est volontaire et pédagogique. En séance 2, le sujet est la base de données :
tables, relations, clé étrangère `watchlist.user_id → users.id`, et le réflexe
« une route privée doit refuser un anonyme ». Une vraie authentification
(hachage de mot de passe, émission de token, expiration, renouvellement, stockage
côté client) aurait représenté beaucoup plus de code que le reste de l'exercice
réuni, et aurait noyé le sujet du jour.

Le garde `user` existe donc surtout pour être **le bon endroit** : sa signature
`(req, res, next)` est déjà celle d'un middleware Express, et c'est là que la
vérification d'un token viendra se brancher sans toucher aux routes.

### Ce qu'il faudrait pour la rendre réelle

1. `POST /register` accepterait un mot de passe, stocké **haché** (`argon2`,
   `bcrypt`) et jamais en clair, dans une colonne séparée ; aucune réponse ne
   renverrait ce hash.
2. `POST /login` vérifierait ce mot de passe et émettrait un token signé (JWT) ou
   ouvrirait une session.
3. Le garde remplacerait la lecture de `X-User` par la vérification du token :
   signature valide, date d'expiration non dépassée.
4. Le transport devrait être chiffré (HTTPS) : sans lui, le mot de passe
   circulerait en clair sur le réseau, quelle que soit la qualité du hachage.

### Conséquence à assumer

En l'état, **l'API ne doit pas être exposée publiquement** : ses routes privées
sont ouvertes à qui connaît le nom d'un utilisateur, et ces noms sont devinables.

## Tests

```bash
npm test                    # depuis la racine
cd api && npm test          # équivalent
```

Cinq tests (`node:test` + `supertest`) : `/health` répond 200, une inscription
crée bien l'utilisateur, ajouter une série la fait apparaître dans `/watchlist`,
`/watchlist` sans en-tête renvoie 401, un titre vide est refusé (400).

Ils interrogent la vraie base : lancez `docker compose up -d db` et chargez le
schéma avant. Ils créent des logins uniques (`test-...`) et suppriment leurs
lignes à la fin.

## Déploiement

L'image ne contient que l'API (pas de base) :

```bash
docker build -t api-binggge .
docker run -p 3000:3000 \
  -e DATABASE_URL=postgres://postgres:binggge@un-hote:5432/binggge \
  api-binggge
```

Sans `DATABASE_URL`, l'API cherche la base sur `localhost:5432` — depuis un
conteneur, c'est le conteneur lui-même. En local, `docker compose up -d --build`
s'en charge pour vous.

## Ce qui n'existe pas encore

- Authentification : voir [Authentification inexistante](#authentification-inexistante).
- `DELETE /watchlist/:id` et la case `seen` (cochée/décochée).
- Migrations : `schema.sql` recrée tout au lieu de faire évoluer le schéma.
- Pipeline CI.

## Structure

```
api/
  src/server.js         # l'API (Express), exporte { app, user, db }
  tests/server.test.js  # les 5 tests
  db/schema.sql         # tables users + watchlist, rejouable
  package.json          # dépendances de l'API
docker-compose.yml      # services db (Postgres) + api
Dockerfile              # image de l'API (contexte = racine du dépôt)
package.json            # scripts de la racine, qui délèguent à api/
```

## Journal des séances

- Séance 1 : `/health`, `/shows`, `/watchlist` en mémoire.
- Séance 2 : Postgres, `users`, `/register`, watchlist privée par `X-User`,
  cinq tests dont un refus de titre vide.
- Séance 3 : Docker, le pipeline, et mise en ligne