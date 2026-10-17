# binggge

API de recherche de séries + watchlist personnelle, en Express et PostgreSQL.
La recherche s'appuie sur l'API publique TVMaze et ne renvoie qu'une liste
allégée : identifiant, titre, année, image.

Tout le code de l'API vit dans `api/`.

## Front React

L’interface vit dans `front/` : React + Vite, CSS simple et icônes Lucide.
Elle ouvre la recherche de séries et propose une sélection de six séries réelles,
avec leurs affiches TVMaze servies localement. La watchlist utilise les routes
existantes de l’API, et le pseudo choisi est conservé dans le navigateur.

### Tout lancer avec Docker Compose

Avec le fichier `.env` de la base décrit ci-dessous :

```bash
docker compose up -d --build
```

Ouvrir **http://127.0.0.1:8080**. Cette commande construit et démarre le front,
l’API et PostgreSQL. Aucun lancement de Vite ni installation Node sur la machine
n’est nécessaire. Le front est compilé dans une première étape Node, puis servi
par Nginx ; Nginx transmet `/api/*` à `api:3000` en retirant le préfixe `/api`.
Les en-têtes de profil et les corps JSON sont transmis à l’API.

Le front attend que l’API soit saine, et l’API attend PostgreSQL. Le port 8080
est lié à `127.0.0.1` ; les ports de l’API et de la base restent internes.

```bash
docker compose ps                     # état des trois services
docker compose logs -f front api      # journaux du front et de l’API
docker compose down                   # arrêt, sans supprimer la base
```

### Développer le front avec Vite

Avec le fichier `.env` de la base décrit ci-dessous :

```bash
# API et base uniquement ; le port API est publié sur 127.0.0.1.
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build api

# Installer puis lancer le front.
npm run install:front
npm run dev:front
```

Ouvrir **http://127.0.0.1:5173**. Vite transmet `/api/*` à l’API sur le port 3000.
Si l’API tourne déjà en local avec `npm run dev`, il suffit de lancer le front.
La sélection d’accueil reste visible sans API ; la recherche et les profils
nécessitent une API joignable, et la watchlist nécessite PostgreSQL.

### Configuration et build

Le fichier `front/.env.example` décrit `VITE_API_URL`, `API_PROXY_TARGET` et
`VITE_BASE_PATH`. Copier les valeurs à personnaliser dans `front/.env.local`.
Le proxy s’applique aux serveurs de développement et de preview uniquement.
Sur un hébergement statique, définir `VITE_API_URL` avant le build vers une API
joignable, ou configurer un reverse proxy pour `/api`.

```bash
npm run build        # génère front/dist/
npm run preview      # aperçu du build sur http://127.0.0.1:4173
npm run test:front   # tests des interactions React, sans base de données
```

Fonctions : recherche avec annulation des anciennes requêtes, choix ou création
d’un profil, ajout à la watchlist avec prévention des doublons depuis l’interface,
filtrage de la liste, affiches de remplacement et états de chargement/erreur/vide.
Le statut `seen` existant est affiché, sans action de modification puisque l’API
ne fournit pas encore cette route. La structure de la liste reste conservée par
l’API ; le navigateur ne mémorise que le pseudo et un petit cache de métadonnées.

Comme l’API, le front utilise une identification par pseudo, sans authentification.
Les conseils d’Impeccable et de UI UX Pro Max ont été consultés ; les décisions
visuelles retenues sont documentées dans `DESIGN.md`.

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

Le front est accessible sur **http://127.0.0.1:8080**. Seul ce port local est
publié ; l’API et PostgreSQL sont joints sur le réseau Docker. Pour vérifier
l’API en passant par le proxy du front :

```bash
curl http://127.0.0.1:8080/api/health
# {"status":"ok"}
```

Ou directement dans le conteneur :

```bash
docker compose exec api wget -qO- localhost:3000/health
# {"status":"ok"}
```

Le schéma est chargé automatiquement au premier démarrage (volume vide).

Prérequis pour l’ensemble : Docker avec Compose. Node 20+ et npm sont utiles
uniquement pour le développement hors Docker. Aucune clé API.

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

Les exemples ci-dessous supposent l'API joignable sur `localhost:3000` via le
complément de développement. Avec la stack Compose complète, remplacez cette
origine par `http://127.0.0.1:8080/api`, ou utilisez
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

`front/Dockerfile` construit React avec Node puis sert le résultat avec Nginx :

```bash
docker compose build front
```

La configuration `front/nginx.conf` sert les fichiers statiques et le proxy API.
Le fichier `front/.dockerignore` exclut les dépendances locales, le build local
et les fichiers d’environnement privés du contexte de construction.

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
| `front` | tests React, build Vite et image Docker du front | toujours |
| `test` | `npm ci`, charge `api/db/schema.sql`, `npm test` | toujours |
| `build` | `docker build -t binggge-api:$SHA ./api` | toujours |
| `deploy` | SSH sur le serveur, `git pull`, `docker compose up -d --build` | `main` seulement |

L’image API attend les tests API et le job front ; le déploiement attend ensuite
ces validations. Le routage Traefik du serveur vers le front reste à configurer
avant d’annoncer une URL publique du front.

Cible API existante : **https://iut.cafeclaudie.fr/TasTom/health** (dossier serveur
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
- Routage public du front sur le serveur (la stack Docker locale est disponible).

## Structure

```
.github/workflows/ci.yml  # pipeline : test, build, deploy
api/
  Dockerfile              # image de l'API (contexte = api/)
  src/server.js           # l'API (Express), exporte { app, user, db }
  tests/server.test.js    # les 5 tests
  db/schema.sql           # tables users + watchlist, rejouable
  package.json            # dépendances de l'API
front/
  Dockerfile              # build Node puis service Nginx
  .dockerignore           # exclut node_modules, dist et les .env privés
  nginx.conf              # statique + proxy /api vers Express
  src/                    # interface React, client API et tests
  public/posters/         # affiches de la sélection d’accueil
  .env.example            # configuration du front et du proxy local
  package.json            # dépendances et commandes Vite
docker-compose.yml        # services front + api + db ; front sur 127.0.0.1:8080
docker-compose.local.yml  # accès local à l’API pour le front (optionnel)
.env                      # DB_PASS, jamais versionné
package.json              # scripts de la racine, qui délèguent à api/
```

## Journal des séances

- Séance 1 : `/health`, `/shows`, `/watchlist` en mémoire.
- Séance 2 : Postgres, `users`, `/register`, watchlist privée par `X-User`,
  cinq tests dont un refus de titre vide.
- Séance 3 : image Docker de l'API (`api/Dockerfile`), compose avec `.env`,
  pipeline GitHub Actions (test, build, deploy), mise en ligne.
