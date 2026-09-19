# binggge

API de recherche de séries + watchlist personnelle, en Express et PostgreSQL.
La recherche s'appuie sur l'API publique TVMaze et ne renvoie qu'une liste
allégée : identifiant, titre, année, image.

Tout le code de l'API vit dans `api/`.

## Démarrage

Le mot de passe de la base vient d'un fichier `.env`, jamais versionné. À créer
une fois à la racine :

```
DB_PASS=quelque-chose-de-long
```

Puis :

```bash
docker compose up -d --build
```

**Aucun port n'est publié** : c'est voulu, en production Traefik joint le
conteneur directement sur le réseau Docker. Pour vérifier en local, passez par le
conteneur :

```bash
docker compose exec api wget -qO- localhost:3000/health
# {"status":"ok"}
```

Le schéma est chargé automatiquement au premier démarrage (volume vide).

Prérequis : Node 20+, npm, Docker. Aucune clé API.

## Base de données

```bash
docker compose up -d db
```

Postgres 16, base `binggge`, mot de passe lu dans `.env` (`DB_PASS`). Aucun port
publié. Le volume `pgdata` conserve les données entre les redémarrages.

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

L'API lit `DATABASE_URL`. Compose la construit à partir de `.env` :
`postgres://postgres:${DB_PASS}@db:5432/binggge` — `db` est le nom du service,
pas `localhost`. C'est l'erreur la plus fréquente.

Le mot de passe n'est appliqué qu'à la **création** du volume. Sur une base
existante, il faut l'aligner à la main :

```bash
docker compose exec -T db psql -U postgres -d binggge \
  -c "ALTER USER postgres WITH PASSWORD 'la-valeur-de-DB_PASS';"
```

Sinon `docker compose down -v` (supprime le volume, donc les données).

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

Les exemples ci-dessous supposent l'API joignable sur `localhost:3000`. Sans port
publié, remplacez `curl http://localhost:3000/x` par
`docker compose exec api wget -qO- localhost:3000/x`.

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

Cinq tests (`node:test` + `supertest`) : `/health` répond 200, une inscription
crée bien l'utilisateur, ajouter une série la fait apparaître dans `/watchlist`,
`/watchlist` sans en-tête renvoie 401, un titre vide est refusé (400).

**Ils tournent dans le pipeline** (job `test`), avec un Postgres de service :
c'est la référence. En local, il faut une base joignable sur `localhost:5432` —
par exemple une base jetable :

```bash
docker run -d --name pg-test -p 5432:5432 \
  -e POSTGRES_PASSWORD=test -e POSTGRES_DB=binggge postgres:16-alpine
docker exec -i pg-test psql -U postgres -d binggge < api/db/schema.sql
```

Puis avec `DATABASE_URL=postgres://postgres:test@localhost:5432/binggge` dans
l'environnement : `npm test --prefix api`.

Les tests créent des logins uniques (`test-...`) et suppriment leurs lignes à la
fin.

## Image Docker

`api/Dockerfile` emballe l'API (pas de base) :

```bash
docker build -t binggge-api ./api
docker run -p 3000:3000 \
  -e DATABASE_URL=postgres://postgres:motdepasse@un-hote:5432/binggge \
  binggge-api
```

Sans `DATABASE_URL`, l'API cherche la base sur `localhost:5432` — depuis un
conteneur, c'est le conteneur lui-même.

## Mise en ligne

Le pipeline (`.github/workflows/ci.yml`) part à chaque push et à chaque pull
request :

| Job | Ce qu'il fait | Quand |
|---|---|---|
| `test` | `npm ci`, charge `api/db/schema.sql`, `npm test` | toujours |
| `build` | `docker build -t binggge-api:$SHA ./api` | toujours |
| `deploy` | SSH sur le serveur, `git pull`, `docker compose up -d --build` | `main` seulement |

Cible : **https://iut.cafeclaudie.fr/TasTom/health** (dossier serveur
`/srv/binggge/TasTom`). Si votre login serveur diffère, ajustez l'URL.

Deux réglages à faire une fois dans les *Settings* du dépôt GitHub :

1. Secret `SSH_DEPLOY_KEY` (clé privée) et variable `LOGIN` (login serveur).
2. Protection de `main` avec « Require status checks to pass » : une PR au
   pipeline rouge devient impossible à merger.

Sur le serveur, `.env` n'est pas versionné : créez-le une fois dans
`/srv/binggge/TasTom` avec la même valeur `DB_PASS`, sinon le `docker compose up`
du déploiement échoue.

## Définition de fini

Écrite ici, elle vaut pour tous les tickets restants :

1. Le pipeline est vert.
2. L'URL répond depuis une autre machine.
3. Le README dit comment la joindre.
4. Le ticket est fermé par une MR.
5. Aucun secret dans le dépôt (ni clé, ni mot de passe, ni `.env`).

## Ce qui n'existe pas encore

- Authentification : voir [Authentification inexistante](#authentification-inexistante).
- `DELETE /watchlist/:id` et la case `seen` (cochée/décochée).
- Migrations : `schema.sql` recrée tout au lieu de faire évoluer le schéma.
- Séance 4 : le front, et la mise en ligne de bout en bout.

## Structure

```
.github/workflows/ci.yml  # pipeline : test, build, deploy
api/
  Dockerfile              # image de l'API (contexte = api/)
  src/server.js           # l'API (Express), exporte { app, user, db }
  tests/server.test.js    # les 5 tests
  db/schema.sql           # tables users + watchlist, rejouable
  package.json            # dépendances de l'API
docker-compose.yml        # services api + db
.env                      # DB_PASS, jamais versionné
package.json              # scripts de la racine, qui délèguent à api/
```

## Journal des séances

- Séance 1 : `/health`, `/shows`, `/watchlist` en mémoire.
- Séance 2 : Postgres, `users`, `/register`, watchlist privée par `X-User`,
  cinq tests dont un refus de titre vide.
- Séance 3 : image Docker de l'API (`api/Dockerfile`), compose avec `.env`,
  pipeline GitHub Actions (test, build, deploy), mise en ligne.