# binggge — Recherche de séries et watchlist

binggge est une application web permettant de rechercher des séries et de conserver celles que l’on souhaite regarder dans une liste personnelle, appelée **watchlist**.

Le projet réunit une **API Express** qui traite les requêtes, une **base PostgreSQL** qui conserve les profils et leurs listes, et une **interface React** qui présente les séries. **Docker Compose** assemble ces parties. En local, un service **Nginx** sert le front et transmet ses appels à l’API. L’image API embarque aussi une version du front servie directement par Express, pour le routage du serveur sous `/TasTom/`.

Ce README décrit le code présent dans le dépôt, son fonctionnement, son lancement et ses limites. Le système visuel est documenté dans [DESIGN.md](DESIGN.md) et les contraintes produit dans [PRODUCT.md](PRODUCT.md).

## Sommaire

- [1. Fonctionnalités](#1-fonctionnalités)
- [2. Technologies](#2-technologies)
- [3. Architecture et circulation des données](#3-architecture-et-circulation-des-données)
- [4. Organisation du dépôt](#4-organisation-du-dépôt)
- [5. Démarrage complet avec Docker](#5-démarrage-complet-avec-docker)
- [6. Implémentation de l’API](#6-implémentation-de-lapi)
- [7. Contrat HTTP et exemples](#7-contrat-http-et-exemples)
- [8. Base de données PostgreSQL](#8-base-de-données-postgresql)
- [9. Implémentation du front React](#9-implémentation-du-front-react)
- [10. Docker et Nginx](#10-docker-et-nginx)
- [11. Développement avec Vite](#11-développement-avec-vite)
- [12. Configuration et commandes](#12-configuration-et-commandes)
- [13. Tests et validations](#13-tests-et-validations)
- [14. CI et déploiement](#14-ci-et-déploiement)
- [15. Dépannage](#15-dépannage)
- [16. Limites et améliorations](#16-limites-et-améliorations)
- [17. Progression de l’implémentation](#17-progression-de-limplémentation)

## 1. Fonctionnalités

L’application permet de :

- consulter une sélection d’accueil de six séries avec des affiches locales ;
- rechercher une série par son titre grâce à TVMaze ;
- créer un profil à partir d’un pseudo ou retrouver un profil existant ;
- ajouter une série à sa watchlist et retrouver cette liste après un rechargement ;
- filtrer la watchlist par titre, sans nouvelle requête au serveur ;
- quitter le profil courant sans supprimer les données enregistrées dans PostgreSQL.

Le front gère les chargements, les résultats vides, les erreurs de requête, les affiches absentes et les confirmations d’ajout. Des traitements sont prévus pour l’utilisation au clavier et l’annonce des messages aux lecteurs d’écran.

**Le choix d’un pseudo est une identification, pas une authentification.** Il n’existe ni mot de passe, ni jeton, ni session sécurisée. Une personne qui connaît un pseudo peut accéder à sa liste. C’est une limite du projet pédagogique, pas un mécanisme de protection des données privées.

## 2. Technologies

| Partie | Technologies | Responsabilité |
| --- | --- | --- |
| Interface | React 19, JavaScript, CSS | Afficher les séries et gérer les interactions |
| Outils front | Vite 6, plugin React | Rechargement en développement et compilation du front |
| Identité visuelle | DM Sans Variable locale, Lucide React | Typographie et pictogrammes SVG |
| API | Node.js, Express 5 | Routes HTTP, validation, accès SQL et service du front embarqué |
| Accès SQL | `pg`, avec un `Pool` | Exécuter les requêtes PostgreSQL |
| Données | PostgreSQL 16 | Conserver les utilisateurs et leurs watchlists |
| Catalogue externe | API publique TVMaze | Fournir les résultats de recherche et leurs affiches |
| Serveur du front | Nginx | Servir le build React et transmettre les appels API |
| Exécution | Docker, Docker Compose | Construire les images, relier et démarrer les services |
| Tests API | `node:test`, `node:assert`, Supertest | Vérifier les routes avec une vraie base de test |
| Tests front | Vitest, Testing Library, user-event, jsdom | Vérifier les parcours React avec des réponses HTTP simulées |
| Automatisation | GitHub Actions | Tester, construire les images et déclencher le déploiement |

Les versions installées sont verrouillées dans [api/package-lock.json](api/package-lock.json) et [front/package-lock.json](front/package-lock.json). L’image API utilise Node 20 pour sa compilation du front et son serveur. L’image front autonome utilise Node 22 pour compiler React, puis Nginx pour le servir.

## 3. Architecture et circulation des données

### Vue d’ensemble en Docker

```mermaid
flowchart LR
    B["Navigateur — React"] -->|"HTTP : 127.0.0.1:8080"| N["front — Nginx :80"]
    N -->|"HTML, CSS, JS, affiches locales"| B
    N -->|"/api/* devient /*"| A["api — Express :3000"]
    A -->|"SQL via pg"| D["db — PostgreSQL :5432"]
    A -->|"Recherche HTTP"| T["API publique TVMaze"]
    D --- V["Volume persistant pgdata"]
```

Le navigateur charge d’abord les fichiers React depuis Nginx. Le JavaScript exécuté dans le navigateur appelle ensuite `/api/shows` ou `/api/watchlist`. Nginx retire le préfixe `/api` et transmet la requête à Express.

Le navigateur ne contacte jamais directement PostgreSQL. Les noms Docker `api` et `db` servent uniquement aux communications entre conteneurs.

### Deux modes de service du front

| Contexte | Qui sert React ? | Base des appels du navigateur | Réécriture |
| --- | --- | --- | --- |
| Service `front`, sur 8080 | Nginx | `/api` | Nginx retire `/api/` avant Express |
| Front embarqué dans l’image `api` | Express, dossier `public/` | `/TasTom` | Traefik retire le préfixe sur le serveur ; Express sait aussi le retirer en local |
| Développement Vite, sur 5173 | Vite | `/api` par défaut | Le proxy Vite retire `/api` |

L’image API contient un build compilé avec `VITE_BASE_PATH=/TasTom/` et `VITE_API_URL=/TasTom`. Ses fichiers statiques et ses appels API sont donc cohérents avec ce chemin public. Ce build est distinct de celui du service Nginx, configuré pour `/` et `/api`.

La présence du front dans les deux images répond aux deux parcours : le service local autonome et le serveur dont le reverse proxy route vers le conteneur API. Le dépôt conserve les deux ; le chemin utilisé doit être identifié avant de modifier le routage.

### Rechercher une série

1. La personne saisit `Severance` et lance la recherche.
2. React appelle `GET /api/shows?q=Severance` sur la même origine que la page.
3. Nginx transmet `GET /shows?q=Severance` à `api:3000`.
4. Express valide le paramètre et interroge TVMaze.
5. L’API transforme la réponse externe en une liste de petits objets JSON.
6. React affiche les résultats. Cette recherche n’écrit rien dans PostgreSQL.

Les affiches d’accueil sont locales. Celles des résultats de recherche peuvent être chargées directement par le navigateur depuis les URL d’images TVMaze renvoyées par l’API.

### Ajouter une série à la watchlist

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant R as React
    participant N as Nginx
    participant A as Express
    participant P as PostgreSQL
    U->>R: Ajouter Severance
    R->>N: POST /api/watchlist, X-User et JSON
    N->>A: POST /watchlist, mêmes données
    A->>P: SELECT utilisateur par login
    P-->>A: id et login
    A->>A: Valider show_id et title
    A->>P: INSERT watchlist avec user_id
    P-->>A: Ligne créée
    A-->>N: 201 et objet JSON
    N-->>R: 201 et objet JSON
    R-->>U: Confirmation et compteur actualisé
```

### Adresses et ports

| Élément | Adresse dans la stack | Adresse depuis la machine |
| --- | --- | --- |
| Front Nginx | `front:80` | `http://127.0.0.1:8080` |
| API Express | `api:3000` | Via `http://127.0.0.1:8080/api` |
| PostgreSQL | `db:5432` | Aucun port publié dans le Compose principal |
| Front Vite en développement | Hors conteneur | `http://127.0.0.1:5173` |
| API avec le complément local | `api:3000` | `http://127.0.0.1:3000`, front embarqué sous `/TasTom/` |

Dans un conteneur, `localhost` désigne ce conteneur. L’API utilise donc `db:5432` pour atteindre PostgreSQL, et Nginx utilise `api:3000` pour atteindre Express.

## 4. Organisation du dépôt

```text
api/
├── src/server.js             # routes, garde, SQL, préfixe /TasTom et statique
├── db/schema.sql             # création des tables ; destructif si rejoué
├── tests/server.test.js      # six tests API
├── Dockerfile               # build React puis API avec fichiers statiques
├── package.json
└── package-lock.json
front/
├── src/
│   ├── main.jsx              # montage de React, styles et police
│   ├── App.jsx               # écrans, composants et logique des parcours
│   ├── api.js                # client HTTP commun
│   ├── storage.js            # accès protégé au localStorage
│   ├── styles.css            # styles, responsive et états visuels
│   ├── data/selection.json   # sélection fixe et provenance des affiches
│   ├── App.test.jsx          # onze tests d’interaction
│   └── test/setup.js         # nettoyage et configuration des tests
├── public/
│   ├── posters/              # six affiches locales
│   └── favicon.svg
├── index.html
├── vite.config.js            # React, proxy local, base publique et Vitest
├── .env.example              # exemple de configuration locale du front
├── Dockerfile                # build Node puis service Nginx
├── .dockerignore             # exclusions du build front
├── nginx.conf                # statique et proxy /api
├── package.json
└── package-lock.json
.github/workflows/ci.yml      # tests, builds et déploiement
.dockerignore                # exclusions du contexte racine de l’image API
.impeccable/                  # contrat de surface et documentation du design
.design-skills/               # sources locales des skills, ignorées par Git
docs/                        # captures et éléments pédagogiques existants
DESIGN.md                    # palette, typographie et composants
PRODUCT.md                   # fonctionnalités et contraintes produit
docker-compose.yml           # services front, api et db
docker-compose.local.yml     # publication du port API pour Vite
package.json                 # raccourcis npm de la racine
.env                         # mot de passe de base ; non versionné
readme.md                    # documentation principale
```

`front/dist/` est généré par Vite et n’est pas versionné. Les `node_modules/`, les fichiers d’environnement privés et les fichiers temporaires des skills sont également ignorés.

## 5. Démarrage complet avec Docker

### Prérequis

Il faut Docker avec Docker Compose et un moteur Docker démarré. Sur Windows, Docker Desktop doit utiliser les conteneurs Linux. Node et npm sur la machine ne sont pas nécessaires pour ce mode.

Internet est nécessaire au premier build pour récupérer les images et dépendances, puis pour les recherches TVMaze.

### Préparer l’environnement

Créer `.env` à la racine, à côté de `docker-compose.yml` :

```dotenv
DB_PASS=remplacer-par-un-mot-de-passe-long
```

Ne pas ajouter ce fichier à Git. Compose réutilise cette valeur pour `POSTGRES_PASSWORD` et pour construire `DATABASE_URL`. Le mot de passe est actuellement inséré directement dans une URL PostgreSQL : éviter les caractères réservés d’URL comme `@`, `:`, `/`, `#` ou `%`, sans adapter cette construction.

### Préparer la base au premier démarrage

La configuration actuelle n’utilise pas de montage du schéma SQL depuis l’hôte : le serveur de déploiement interdit les montages de dossiers hôtes. Le volume PostgreSQL est créé par Docker, mais les tables doivent être initialisées explicitement une seule fois.

```bash
docker compose up -d db
docker compose exec db pg_isready -U postgres -d binggge
docker compose exec db psql -U postgres -d binggge -c '\dt'
```

Attendre que PostgreSQL soit disponible. Si la base est neuve et ne contient aucune table applicative, charger le schéma.

**Le script suivant supprime les tables avant de les recréer. Ne pas l’exécuter sur une base contenant des données à conserver.**

PowerShell :

```powershell
Get-Content -Encoding UTF8 api/db/schema.sql | docker compose exec -T db psql -U postgres -d binggge -v ON_ERROR_STOP=1
```

Bash :

```bash
docker compose exec -T db psql -U postgres -d binggge -v ON_ERROR_STOP=1 < api/db/schema.sql
```

Une base déjà initialisée est réutilisée : ne pas rejouer ce schéma à chaque lancement.

### Construire et démarrer l’ensemble

Depuis la racine :

```bash
docker compose up -d --build
```

Une fois les tables prêtes, Compose construit les images front et API, prépare leur réseau et démarre les trois services. Le premier build peut prendre plus de temps à cause des téléchargements et des compilations React.

Pour attendre explicitement les contrôles de santé :

```bash
docker compose up -d --build --wait --wait-timeout 120
```

### Ouvrir et vérifier

Ouvrir **http://127.0.0.1:8080**.

```bash
docker compose ps
curl http://127.0.0.1:8080/api/health
```

La sonde doit répondre :

```json
{"status":"ok"}
```

Sur PowerShell, utiliser aussi `Invoke-RestMethod http://127.0.0.1:8080/api/health`.

### Commandes courantes

| Action | Commande |
| --- | --- |
| État des services | `docker compose ps` |
| Suivre les journaux | `docker compose logs -f front api db` |
| Reconstruire après modification | `docker compose up -d --build` |
| Arrêter les conteneurs en conservant la base | `docker compose down` |
| Redémarrer une stack arrêtée | `docker compose up -d` |
| Valider Compose sans afficher les variables résolues | `docker compose config --quiet` |
| Valider Nginx | `docker compose exec front nginx -t` |

**`docker compose down -v` supprime les volumes, donc les profils et watchlists.** Cette variante est réservée à une remise à zéro volontaire.

## 6. Implémentation de l’API

L’API est regroupée dans [api/src/server.js](api/src/server.js). Sa taille permet de suivre le parcours complet d’une requête sans multiplier les fichiers.

### Initialisation et ordre des traitements

`express()` crée l’application. `express.json()` transforme les corps JSON reçus en objets accessibles dans `req.body`.

Le fichier configure ensuite CORS et la gestion du préfixe `/TasTom`, crée le pool PostgreSQL, déclare les routes, sert les fichiers statiques, puis termine par le traitement des routes inconnues et des erreurs. L’ordre compte : une requête doit atteindre les routes et fichiers avant d’être considérée comme inconnue.

### Préfixe public et front servi par Express

Le serveur de déploiement route l’application sous `/TasTom`. Un middleware retire ce préfixe de `req.url` s’il est encore présent : `/TasTom/health` est traité comme `/health`. Si Traefik l’a déjà retiré, le chemin est utilisé directement.

Après les routes API, `express.static(path.join(__dirname, '..', 'public'))` sert le build React embarqué par Docker. En développement Node, ce dossier peut être absent ; le middleware laisse alors passer la requête. Le routage applicatif React utilise le fragment `#`, donc ses deux écrans n’exigent pas deux routes HTML côté Express.

### CORS

Le middleware autorise les origines avec `Access-Control-Allow-Origin: *`, les méthodes `GET`, `POST`, `OPTIONS` et les en-têtes `Content-Type` et `X-User`. Une requête préparatoire `OPTIONS` reçoit `204`.

Avec Nginx ou le proxy Vite, le navigateur appelle normalement l’API sur la même origine que le front. CORS reste utile pour les appels directs depuis une autre origine, mais ne vérifie pas l’identité des personnes.

### Connexion à PostgreSQL et requêtes paramétrées

Le module `pg` fournit un `Pool` partagé :

```js
const db = new Pool({
  connectionString: process.env.DATABASE_URL
    || 'postgres://postgres:binggge@localhost:5432/binggge',
})
```

Le pool gère les connexions utilisées par `db.query(...)`. Docker fournit `DATABASE_URL` ; la chaîne de repli du code ne lit pas automatiquement le mot de passe du fichier `.env`.

Les valeurs utilisateur sont passées comme paramètres SQL :

```js
await db.query(
  'INSERT INTO users(login) VALUES($1)',
  [login.trim()],
)
```

La requête et les valeurs sont séparées : le pseudo n’est pas concaténé dans le texte SQL.

### Recherche TVMaze

`GET /shows` contrôle que `q` est une chaîne non vide après nettoyage des espaces pour ce contrôle. Le terme est encodé avec `encodeURIComponent` dans l’URL envoyée à TVMaze.

Le serveur utilise le `fetch` natif de Node pour appeler `https://api.tvmaze.com/search/shows?q=...`. Il transforme chaque résultat externe en quatre champs : `id`, `title`, `year` et `image`. L’année provient de `premiered` ; une date ou une image absente devient `null`.

Une réponse externe en erreur ou un échec de traitement produit un `500` avec un message JSON. L’API n’a actuellement ni cache de recherche ni délai d’expiration explicite pour cet appel externe.

### Création d’un profil

`POST /register` exige un `login` textuel non vide et stocke sa version `trim()` dans `users`. La contrainte SQL `UNIQUE` empêche la réutilisation exacte d’un pseudo.

Si PostgreSQL renvoie le code `23505`, l’API le traduit en `409 Conflict`. Il n’y a ni normalisation de casse ni mot de passe : `Camille` et `camille` restent deux valeurs distinctes dans le schéma actuel.

### Garde des routes de watchlist

Le middleware `user` précède les deux traitements de `/watchlist` :

1. lire et nettoyer l’en-tête `X-User` ;
2. renvoyer `401` si cet en-tête manque ;
3. chercher `id` et `login` dans `users` ;
4. renvoyer `401` si aucun profil ne correspond ;
5. placer la ligne trouvée dans `req.user`, puis appeler `next()`.

Les routes utilisent `req.user.id` pour lire ou écrire les lignes associées à ce profil déclaré. Ce filtrage sépare les listes, mais ne prouve pas que la personne est propriétaire du pseudo fourni.

### Lecture et ajout de séries

La lecture sélectionne les lignes avec `WHERE user_id = $1` et les trie par `id`. Le champ SQL `show_id` est exposé sous le nom JSON `showId` grâce à `AS "showId"`.

L’ajout exige un `show_id` entier et un titre textuel non vide. `INSERT ... RETURNING` enregistre la ligne et renvoie l’objet créé sans seconde requête de lecture.

La validation actuelle n’exige pas un identifiant positif et ne vérifie pas auprès de TVMaze que l’identifiant et le titre correspondent réellement à une série.

### Erreurs et export pour les tests

Une route inconnue renvoie `404 {"error":"Route introuvable"}`. Les erreurs transmises à `next(err)` arrivent dans le gestionnaire final, qui journalise l’erreur et renvoie un message générique avec son statut, ou `500`.

Le serveur écoute sur `process.env.PORT || 3000` uniquement lorsque le fichier est exécuté directement. L’export `{ app, user, db }` permet à Supertest d’importer l’application et aux tests de fermer le pool à la fin.

## 7. Contrat HTTP et exemples

### Routes disponibles

| Méthode | Route Express | URL via Nginx | Accès déclaré | Succès |
| --- | --- | --- | --- | --- |
| `GET` | `/health` | `/api/health` | Public | `200`, état du processus API |
| `GET` | `/shows?q=...` | `/api/shows?q=...` | Public | `200`, tableau de séries |
| `POST` | `/register` | `/api/register` | Public | `201`, pseudo créé |
| `GET` | `/watchlist` | `/api/watchlist` | `X-User` reconnu | `200`, tableau de lignes |
| `POST` | `/watchlist` | `/api/watchlist` | `X-User` reconnu | `201`, ligne créée |

Les exemples `curl` ci-dessous utilisent la syntaxe Bash. Les identifiants de lignes sont illustratifs : ils dépendent du contenu de la base.

Ce tableau et les exemples utilisent le service Nginx local. Avec le front servi directement par Express, utiliser `/TasTom/health`, `/TasTom/shows`, `/TasTom/register` et `/TasTom/watchlist`, sans ajouter `/api`. Avec le port API local publié, la sonde est par exemple `http://127.0.0.1:3000/TasTom/health`.

### Rechercher

```bash
curl "http://127.0.0.1:8080/api/shows?q=Severance"
```

Exemple d’un élément du tableau de réponse :

```json
{
  "id": 44933,
  "title": "Severance",
  "year": 2022,
  "image": "https://static.tvmaze.com/uploads/images/medium_portrait/548/1371406.jpg"
}
```

Les résultats et URL d’images peuvent évoluer chez TVMaze. Un tableau vide signifie qu’aucun résultat n’a été trouvé ; ce n’est pas une erreur HTTP.

### Créer un profil

```bash
curl -i -X POST http://127.0.0.1:8080/api/register -H 'Content-Type: application/json' -d '{"login":"demo"}'
```

Réponse au premier enregistrement : `201 {"login":"demo"}`. Une seconde création avec le même pseudo renvoie `409`. Pour réutiliser ce profil, il suffit d’envoyer son pseudo dans `X-User`.

### Ajouter puis lire une série

```bash
curl -i -X POST http://127.0.0.1:8080/api/watchlist -H 'Content-Type: application/json' -H 'X-User: demo' -d '{"show_id":44933,"title":"Severance"}'
curl http://127.0.0.1:8080/api/watchlist -H 'X-User: demo'
```

Exemple de réponse de lecture :

```json
[
  {"id":1,"showId":44933,"title":"Severance","seen":false}
]
```

Le corps envoyé utilise `show_id`, tandis que la réponse utilise `showId`. Le client React réalise cette conversion dans [front/src/api.js](front/src/api.js).

### Équivalent PowerShell

```powershell
$apiBase = 'http://127.0.0.1:8080/api'
Invoke-RestMethod -Uri "$apiBase/shows?q=Severance"
Invoke-RestMethod -Method Post -Uri "$apiBase/register" -ContentType 'application/json' -Body (@{ login = 'demo' } | ConvertTo-Json)
Invoke-RestMethod -Method Post -Uri "$apiBase/watchlist" -Headers @{ 'X-User' = 'demo' } -ContentType 'application/json' -Body (@{ show_id = 44933; title = 'Severance' } | ConvertTo-Json)
Invoke-RestMethod -Uri "$apiBase/watchlist" -Headers @{ 'X-User' = 'demo' }
```

Ces exemples créent de vraies données dans la base utilisée par l’application.

### Principaux refus

| Statut | Déclencheur |
| --- | --- |
| `400` | Recherche sans `q`, pseudo vide, `show_id` non entier ou titre vide |
| `401` | `X-User` absent ou pseudo inconnu sur une route de watchlist |
| `404` | Route inconnue |
| `409` | Pseudo déjà enregistré |
| `500` | Échec d’accès aux données ou de recherche externe |

`/health` renvoie seulement `{"status":"ok"}` : cette route ne teste ni une requête SQL ni l’accès à TVMaze.

## 8. Base de données PostgreSQL

Le schéma est défini dans [api/db/schema.sql](api/db/schema.sql). Il contient deux tables et aucune copie complète du catalogue TVMaze.

```mermaid
erDiagram
    USERS ||--o{ WATCHLIST : "possède dans le parcours applicatif"
    USERS {
        int id PK
        text login UK
    }
    WATCHLIST {
        int id PK
        int user_id FK
        int show_id
        text title
        boolean seen
    }
```

Dans le parcours API, chaque ligne ajoutée appartient à un profil reconnu. Au niveau SQL, `user_id` est toutefois nullable : le schéma permet une ligne sans utilisateur si elle est insérée directement.

### Table `users`

| Colonne | Définition | Rôle |
| --- | --- | --- |
| `id` | `SERIAL PRIMARY KEY` | Identifiant interne auto-incrémenté |
| `login` | `TEXT UNIQUE NOT NULL` | Pseudo unique du profil |

### Table `watchlist`

| Colonne | Définition | Rôle |
| --- | --- | --- |
| `id` | `SERIAL PRIMARY KEY` | Identifiant de la ligne enregistrée |
| `user_id` | `INT REFERENCES users(id)` | Référence vers le profil |
| `show_id` | `INT NOT NULL` | Identifiant TVMaze de la série |
| `title` | `TEXT NOT NULL` | Titre conservé au moment de l’ajout |
| `seen` | `BOOLEAN DEFAULT false` | Statut affiché par le front |

`watchlist.id` identifie une ligne locale ; `watchlist.show_id` identifie une série externe. Il ne faut pas les confondre.

La clé étrangère exige qu’un `user_id` non nul corresponde à un utilisateur existant. Elle ne déclare pas de suppression en cascade des lignes lors d’un `DELETE` d’utilisateur. `seen` a une valeur par défaut, mais pas de contrainte `NOT NULL`.

### Répartition des informations

La liste conserve série, titre et statut. Les affiches, années et genres de la sélection viennent du front ; les métadonnées des recherches sont mémorisées dans un petit cache du navigateur.

Un autre navigateur peut retrouver la watchlist avec le même pseudo sans posséder les affiches des séries hors sélection. Le front affiche alors le titre et son visuel de remplacement. Le cache de métadonnées n’est pas une donnée partagée dans PostgreSQL.

### Doublons

Il n’existe pas de contrainte `UNIQUE(user_id, show_id)`. Le front évite un second ajout d’une série déjà présente dans la liste chargée, mais un appel direct à l’API ou deux clients peuvent encore créer des doublons.

### Initialisation et persistance

Compose utilise le volume nommé `pgdata` pour conserver la base lorsque les conteneurs sont recréés. La configuration actuelle ne monte plus `schema.sql` dans `/docker-entrypoint-initdb.d/` : les tables sont chargées manuellement au premier démarrage, avec les commandes de la section 5.

Modifier `schema.sql` ou reconstruire l’image ne met pas automatiquement à jour un volume existant. Il n’y a pas encore de système de migrations.

**`schema.sql` commence par supprimer les tables avec `DROP TABLE`, puis les recrée. Le rejouer efface les utilisateurs et les watchlists.** Pour une base à conserver, écrire une évolution SQL adaptée plutôt que rejouer ce fichier.

### Inspecter sans réinitialiser

```bash
docker compose exec db psql -U postgres -d binggge
```

Dans `psql` :

```sql
\dt
SELECT id, login FROM users ORDER BY id;
SELECT id, user_id, show_id, title, seen FROM watchlist ORDER BY id;
\q
```

Ces commandes utilisent la connexion locale dans le conteneur. Elles ne nécessitent pas d’ouvrir le port 5432 sur la machine.

## 9. Implémentation du front React

### Entrée et composants

[main.jsx](front/src/main.jsx) monte `<App />` avec `createRoot`, active `React.StrictMode` et importe le CSS ainsi que la police locale. En développement, StrictMode peut relancer certains effets pour aider à repérer les nettoyages manquants.

Les composants sont regroupés dans [App.jsx](front/src/App.jsx) :

| Composant | Rôle |
| --- | --- |
| `App` | Navigation, recherche, profil, watchlist, cache et notifications |
| `ShowCard` | Affiche, titre, métadonnées et bouton d’ajout ou statut |
| `ProfilePanel` | Formulaire pour créer ou retrouver un pseudo |
| `EmptyState` | Liste vide, absence de résultat ou erreur, avec une action |
| `LoadingGrid` | Squelettes réservant la place des cartes pendant l’attente |

Il n’y a pas de bibliothèque de routage ni de gestion globale d’état supplémentaire. Les états locaux utilisent `useState`, les effets et leur nettoyage `useEffect`, et les références stables `useRef`.

### Navigation et accueil

La navigation utilise `#explorer` et `#watchlist` dans l’URL. Un écouteur `hashchange` actualise la vue, ce qui permet aussi de revenir à un écran avec l’historique du navigateur.

[selection.json](front/src/data/selection.json) présente Severance, The Bear, Breaking Bad, Dark, Fleabag et The Last of Us. C’est une sélection fixe de vraies séries, pas un classement de tendances calculé en direct.

Les six affiches sont dans `front/public/posters/`, avec leur provenance décrite dans le JSON et intégrée aux JPEG. L’accueil n’attend donc pas une recherche API pour apparaître. Cela ne constitue pas un mode hors ligne complet : il n’y a pas de service worker, et les actions réseau nécessitent leurs serveurs.

### Recherche et états

`runSearch()` nettoie le terme, refuse une saisie vide, passe l’état en `loading`, puis appelle `api.search()`. La réponse devient `ready` ou `error`. Un résultat vide est une réussite HTTP, présentée avec une invitation à modifier le titre.

La recherche est envoyée à la soumission ou au clic sur une suggestion, pas à chaque caractère saisi.

Un `AbortController` annule la recherche précédente lorsqu’une nouvelle démarre. Le code vérifie aussi qu’une requête n’est pas annulée avant d’appliquer sa réponse : une ancienne réponse ne doit pas écraser la plus récente.

### Client HTTP commun

[api.js](front/src/api.js) centralise les appels :

- déterminer la base API depuis `VITE_API_URL`, avec `/api` par défaut ;
- ajouter `Content-Type: application/json` quand un corps est envoyé ;
- ajouter `X-User` quand un pseudo est fourni ;
- combiner le signal d’annulation éventuel avec un délai de 12 secondes ;
- vérifier le statut HTTP et décoder le JSON ;
- convertir les erreurs en messages compréhensibles avec `ApiError`.

Les méthodes exposées sont `search`, `watchlist`, `register` et `add`. Elles distinguent notamment les profils inconnus, les pseudos déjà pris, les saisies invalides et le serveur injoignable. Les API d’annulation utilisées supposent un navigateur moderne.

### Choix de profil et ajout différé

Pour retrouver un profil, le front demande sa watchlist avec `X-User`. Pour le créer, il appelle d’abord `/register`, puis charge la liste.

Un clic sur l’ajout avant le choix d’un profil place la série dans `pendingShow` et ouvre le panneau de profil. Après validation, l’ajout prévu est effectué si la série ne figure pas déjà dans la liste chargée.

Pendant l’ajout, `adding` identifie la série en cours et les boutons sont temporairement désactivés. La réponse du serveur est ensuite ajoutée à l’état local ; une confirmation apparaît et le compteur de watchlist est actualisé.

### Réponses devenues obsolètes

Une requête peut terminer après un changement de profil. Deux compteurs évitent qu’elle mette alors à jour le mauvais état :

- `sessionVersion` protège les chargements et ajouts associés au profil courant ;
- `connectionVersion` protège les tentatives de choix de profil après fermeture du panneau, déconnexion ou nouvelle tentative.

Le code capture la version au départ et la compare après les opérations asynchrones. Si elle a changé, les mises à jour obsolètes sont ignorées. Changer de profil réinitialise aussi `adding`, pour éviter de laisser les boutons bloqués.

Ces protections concernent l’interface. Elles ne peuvent pas annuler une écriture déjà exécutée par le serveur.

### Stockage du navigateur

[storage.js](front/src/storage.js) lit et écrit du JSON avec gestion des exceptions, afin que l’application reste utilisable si le stockage est indisponible.

| Clé | Contenu |
| --- | --- |
| `binggge:profile` | Pseudo à recharger au prochain passage |
| `binggge:shows` | Métadonnées connues pour compléter les cartes de watchlist |

À l’ouverture, la watchlist est rechargée depuis l’API : le `localStorage` n’est pas la source de vérité de la liste. Avant un ajout au cache, le code reprend jusqu’à 150 entrées précédentes, puis ajoute les métadonnées reçues. Ce n’est ni un cache partagé ni un mécanisme strict d’expiration.

Quitter un profil vide le pseudo mémorisé et l’état de session, sans supprimer les séries ni le profil en base. Le cache de métadonnées reste disponible.

### Design, responsive et accessibilité

Le front utilise un fond clair, un accent vert forêt, une seule famille de police et des SVG. Impeccable et UI UX Pro Max ont servi à travailler la hiérarchie, la sobriété, les états et les interactions. Ces skills ne sont pas des dépendances nécessaires au fonctionnement de l’application.

La grille a six colonnes sur grand écran, trois à 1100 px et moins, puis deux à 760 px et moins. Le panneau de profil devient une colonne sur mobile. Les images ont des dimensions réservées et un chargement différé ; une affiche inaccessible a un remplacement textuel.

Les traitements d’accessibilité comprennent les labels, les noms des boutons icônes, la page courante, les régions `status`/`alert`, `aria-busy`, le focus visible et son retour après le panneau de profil. Le lien « Aller au contenu » conserve l’écran courant. Le CSS respecte `prefers-reduced-motion`.

Ces dispositions ont été examinées dans les sources et certaines interactions sont testées. La validation visuelle multi-écrans et l’audit complet d’accessibilité restent distincts de ces vérifications.

## 10. Docker et Nginx

### Image API avec front embarqué

[api/Dockerfile](api/Dockerfile) a deux étapes, toutes deux basées sur Node 20 :

1. installer le front et le compiler pour `/TasTom/`, avec les appels API basés sur `/TasTom` ;
2. installer les dépendances API avec `npm ci --omit=dev`, copier `api/src/`, puis copier le build React dans `/app/public/`.

L’image définit `NODE_ENV=production` et `PORT=3000`, puis lance `node src/server.js`. Express sert les routes JSON et les fichiers statiques dans le même processus.

Le contexte de build est **la racine du dépôt**, car le Dockerfile lit `front/` et `api/` :

```bash
docker build -f api/Dockerfile -t binggge-api .
```

La commande historique `docker build ./api` ne correspond plus à ce Dockerfile. Compose et la CI utilisent désormais le contexte racine et le chemin `api/Dockerfile`.

Les dépendances de test sont absentes de cette image. Exécuter les tests dans le conteneur de production n’est donc pas le parcours prévu.

### Image front autonome en deux étapes

[front/Dockerfile](front/Dockerfile) comporte deux étapes :

1. **Compilation :** Node 22 installe avec `npm ci`, copie le projet et produit `dist/` avec Vite.
2. **Service web :** Nginx reçoit la configuration web et le résultat de `dist/`.

Le conteneur final n’exécute ni Vite ni un serveur React Node : il sert les fichiers compilés. Les outils de compilation restent dans la première étape.

[front/.dockerignore](front/.dockerignore) exclut les dépendances locales, `dist`, les fichiers d’environnement privés et les tests de ce build autonome. Le Dockerfile fixe `VITE_API_URL=/api` et `VITE_BASE_PATH=/`.

Pour l’image API, dont le contexte est la racine, c’est le `.dockerignore` racine qui s’applique : ne pas supposer que les exclusions de `front/.dockerignore` protègent aussi ce second build. Les fichiers privés doivent rester hors des copies et contextes inutiles.

### Routage Nginx

[front/nginx.conf](front/nginx.conf) définit les comportements suivants :

| Chemin | Traitement |
| --- | --- |
| `/api/…` | Transmettre à `http://api:3000/…`, avec le corps et les en-têtes |
| `/assets/…` | Servir les fichiers compilés avec cache long ; 404 si absents |
| `/index.html` | Demander une revalidation avec `Cache-Control: no-cache` |
| Autres chemins | Chercher le fichier, puis revenir à `index.html` pour l’application |

Le slash final de `proxy_pass http://api:3000/;` retire `/api/`. Ainsi `/api/watchlist` atteint `/watchlist`. La route exacte `/api` est redirigée vers `/api/` avec `308`.

Les erreurs API comme `401` ou `404` ne sont pas remplacées par la page React. Le proxy fixe un délai de connexion de 5 secondes et un délai de lecture de 30 secondes ; React a son propre délai de 12 secondes.

### Ordre de démarrage et santé

```text
db saine → api démarrée et saine → front démarré et sain
```

| Service | Sonde | Ce qu’elle vérifie |
| --- | --- | --- |
| `db` | `pg_isready` | PostgreSQL accepte les connexions |
| `api` | Requête Node sur `/health` | Express répond avec un succès HTTP |
| `front` | `wget --spider` sur `/` | Nginx sert la page d’accueil |

Ces sondes ne sont pas des tests de bout en bout : une API avec un mauvais mot de passe SQL peut répondre à `/health`. La recherche et l’ajout doivent être testés séparément.

`front` et `api` utilisent `restart: unless-stopped`. La dépendance du front déclare aussi `restart: true` pour suivre les mises à jour ou redémarrages de l’API orchestrés par Compose. `db` n’a pas de politique de redémarrage explicite dans ce fichier.

## 11. Développement avec Vite

Ce mode permet de modifier React et de voir les changements sans reconstruire l’image du front à chaque fois.

### API et base dans Docker, front sur la machine

Démarrer seulement l’API et sa dépendance PostgreSQL, en publiant le port API local :

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build api
npm ci --prefix front
npm run dev:front
```

Ouvrir **http://127.0.0.1:5173**. Le complément Compose publie `127.0.0.1:3000:3000`. Le nom de service `api` en fin de commande évite de lancer Nginx pour cette session.

Si le front Nginx était déjà démarré, il peut rester actif sur 8080 ; le démarrage ciblé ne l’arrête pas automatiquement. Vite utilise son propre port 5173.

Dans [vite.config.js](front/vite.config.js), le proxy transforme `/api/watchlist` en `http://127.0.0.1:3000/watchlist`. Cette réécriture joue le même rôle que Nginx, mais pour le développement et la preview Vite.

### API Node sur la machine

L’API peut aussi tourner hors Docker si PostgreSQL est joignable depuis la machine :

```powershell
npm ci --prefix api
$env:DATABASE_URL = 'postgres://postgres:motdepasse@127.0.0.1:5432/binggge'
npm run dev
```

Dans un autre terminal, lancer le front avec `npm run dev:front`. La base du Compose principal n’ouvre pas 5432 : il faut une base locale ou une configuration dédiée qui le publie.

Le serveur Node lit `process.env`. Il ne charge pas le fichier `.env` de Compose : définir `DATABASE_URL` dans l’environnement du processus est nécessaire si les valeurs de repli ne conviennent pas.

## 12. Configuration et commandes

### Variables

| Variable | Consommateur | Fonction |
| --- | --- | --- |
| `DB_PASS` | Compose, depuis `.env` racine | Mot de passe PostgreSQL et construction de la chaîne de connexion API |
| `DATABASE_URL` | API | Adresse PostgreSQL, fournie par Compose dans les conteneurs |
| `PORT` | API | Port d’écoute, 3000 par défaut |
| `VITE_API_URL` | Build ou serveur Vite | Base des URL appelées par le navigateur, `/api` par défaut |
| `API_PROXY_TARGET` | Configuration Vite | Cible du proxy local, `http://127.0.0.1:3000` par défaut |
| `VITE_BASE_PATH` | Configuration Vite | Base publique des fichiers du front, `/` par défaut |
| `SSH_DEPLOY_KEY` | Secret GitHub Actions | Clé SSH utilisée par le déploiement |
| `LOGIN` | Variable GitHub Actions | Compte SSH et nom du répertoire serveur |

Pour personnaliser le développement, copier [front/.env.example](front/.env.example) vers `front/.env.local`, puis ajuster les valeurs utiles.

Les variables `VITE_*` sont intégrées au JavaScript envoyé au navigateur : ne jamais y placer de secret. Modifier l’environnement du conteneur Nginx ne reconfigure pas un build statique déjà produit ; il faut adapter les valeurs de compilation puis reconstruire.

Le build autonome Nginx fixe `/` et `/api`. Le build embarqué dans l’image API fixe `/TasTom/` et `/TasTom`. Pour un autre préfixe ou login de déploiement, adapter les valeurs du Dockerfile API, son middleware de réécriture et la configuration du reverse proxy ; une variable ajoutée à Nginx après compilation ne suffit pas.

### Raccourcis depuis la racine

| Commande | Effet |
| --- | --- |
| `npm run install:api` | Installer les dépendances de `api/` avec `npm install` |
| `npm run install:front` | Installer les dépendances de `front/` avec `npm install` |
| `npm start` | Lancer l’API Node |
| `npm run dev` | Lancer l’API avec `node --watch` |
| `npm run dev:front` | Lancer Vite sur 5173 |
| `npm run build` | Générer `front/dist/` |
| `npm run preview` | Servir le build sur 4173, avec le proxy Vite configuré |
| `npm test` | Tests API ; une base est nécessaire |
| `npm run test:front` | Tests React, sans PostgreSQL |

La racine n’est pas un workspace npm et n’installe pas automatiquement les deux sous-projets. Pour reproduire les dépendances verrouillées, utiliser `npm ci --prefix api` et `npm ci --prefix front`.

## 13. Tests et validations

### Tests du front

```bash
npm ci --prefix front
npm run test:front
```

Les onze tests de [App.test.jsx](front/src/App.test.jsx) couvrent :

1. l’accueil avec six séries sans requête préalable ;
2. l’encodage de la recherche et les métadonnées sans image ;
3. le rejet d’une ancienne réponse après une nouvelle recherche ;
4. l’erreur de recherche, son annonce, la nouvelle tentative et le résultat vide ;
5. la création de profil suivie de l’ajout, avec prévention d’un second clic ;
6. le pseudo déjà pris et le retour vers un profil existant ;
7. la restauration du profil, le filtrage et la déconnexion ;
8. l’échec de chargement de watchlist et sa nouvelle tentative ;
9. le changement de profil pendant un ajout ;
10. l’annulation d’un choix de profil qui se termine après la déconnexion ;
11. le lien d’accès au contenu qui conserve l’écran watchlist.

Vitest exécute React dans jsdom ; Testing Library pilote les contrôles. `fetch` est simulé pour maîtriser les erreurs et l’ordre des réponses. Ces tests n’utilisent ni la vraie API, ni PostgreSQL, ni un moteur de rendu visuel complet.

### Tests API

Les six tests de [api/tests/server.test.js](api/tests/server.test.js) utilisent Supertest et, pour les parcours de données, une vraie base :

1. `/health` répond `200` avec l’état attendu ;
2. l’inscription crée un utilisateur, vérifié aussi avec une requête SQL ;
3. une série ajoutée apparaît dans la watchlist du profil ;
4. l’absence d’en-tête utilisateur est refusée avec `401` ;
5. un titre vide est refusé avec `400` ;
6. `/TasTom/health` renvoie la même réponse que `/health`.

Les tests créent des pseudos uniques, suppriment leurs lignes à la fin et ferment le pool. L’ancienne assertion santé qui attendait `418` a été corrigée : le fichier actuel attend bien `200`. Le test de préfixe valide une route API, pas à lui seul le chargement du build React sous ce préfixe.

Pour utiliser une base de test séparée, voici un conteneur jetable sur le port **55432**, distinct de la base applicative :

```bash
docker run -d --name binggge-test-db -p 127.0.0.1:55432:5432 -e POSTGRES_PASSWORD=test -e POSTGRES_DB=binggge postgres:16-alpine
docker exec binggge-test-db pg_isready -U postgres -d binggge
```

Attendre que la deuxième commande confirme la disponibilité. Charger ensuite le schéma **dans cette base de test uniquement** ; le script supprime les tables avant de les recréer.

PowerShell :

```powershell
Get-Content -Encoding UTF8 api/db/schema.sql | docker exec -i binggge-test-db psql -U postgres -d binggge
npm ci --prefix api
$env:DATABASE_URL = 'postgres://postgres:test@127.0.0.1:55432/binggge'
npm test
```

Bash :

```bash
docker exec -i binggge-test-db psql -U postgres -d binggge < api/db/schema.sql
npm ci --prefix api
DATABASE_URL=postgres://postgres:test@127.0.0.1:55432/binggge npm test
```

Après les tests, arrêter et supprimer le conteneur jetable :

```bash
docker stop binggge-test-db
docker rm -v binggge-test-db
```

### Build et intégration Docker

```bash
npm run build
docker compose config --quiet
docker compose build
docker compose up -d --wait --wait-timeout 120
docker compose exec front nginx -t
```

Lors de la première intégration Nginx, les validations suivantes ont réussi : les onze tests front, le build Vite, les deux images Docker de cette étape, les trois services sains, le chargement des fichiers statiques, une vraie recherche TVMaze, puis la création d’un profil temporaire, l’ajout et la lecture d’une série via Nginx. Les données temporaires ont ensuite été supprimées.

L’image API a ensuite évolué pour embarquer le front sous `/TasTom/` et l’initialisation SQL est devenue manuelle. Les validations de l’étape précédente ne prouvent pas à elles seules le fonctionnement de ce nouveau parcours : reconstruire, tester la route préfixée, charger ses fichiers statiques et essayer les actions depuis cette origine avant de valider un déploiement.

Le test d’intégration initial n’est pas encore une suite E2E versionnée et automatiquement rejouée en CI. Les tests et builds ne sont pas relancés par la simple rédaction de ce README ; le résultat courant doit être établi avec les commandes ci-dessus et les checks GitHub. Le rendu visuel multi-écrans et l’accès public distant demandent leurs propres vérifications.

## 14. CI et déploiement

Le workflow [.github/workflows/ci.yml](.github/workflows/ci.yml) est déclenché par les événements `push` et `pull_request`.

```mermaid
flowchart LR
    F["front : tests, build Vite et image front"] --> B["build : image API"]
    T["test : tests API et PostgreSQL de service"] --> B
    B --> D["deploy : SSH et Compose sur main"]
```

| Job | Travail | Dépendance |
| --- | --- | --- |
| `front` | Node 20, `npm ci`, tests React, build Vite et image front | Aucune autre tâche |
| `test` | PostgreSQL 16 de service, initialisation du schéma et tests API | Aucune autre tâche |
| `build` | Image API avec front embarqué, contexte racine, étiquette SHA | Réussite de `front` et `test` |
| `deploy` | SSH, `git pull`, `sudo binggge up -d --build` | Réussite de `build` et branche `main` |

La base de CI est jointe par `localhost:5432`, car les tests tournent sur la VM du runner. C’est différent du nom `db` utilisé dans la stack Compose.

Le workflow ne pousse pas les images construites en CI dans un registre. Le serveur récupère les sources avec Git, puis reconstruit ses images via Compose.

### Préparation du serveur et de GitHub

Le workflow utilise `iut.cafeclaudie.fr`. Le compte serveur a pour répertoire personnel `/srv/binggge/<LOGIN>`, ce qui explique le `cd ~` dans la commande distante. `sudo binggge` est la commande Compose autorisée par cet environnement. Il faut :

- un dépôt cloné à cet emplacement et la commande serveur `sudo binggge` disponible ;
- un fichier `.env` serveur avec `DB_PASS`, conservé hors Git ;
- le secret GitHub `SSH_DEPLOY_KEY` et la variable `LOGIN` ;
- le routage Traefik vers le conteneur API pour le chemin public de l’application.

La commande distante du workflow est :

```bash
cd ~ && git pull && sudo binggge up -d --build
```

Le workflow n’initialise pas les tables du PostgreSQL persistant sur le serveur. Sur une première installation et une base vide, charger le schéma explicitement via la commande autorisée, par exemple depuis un terminal Bash du serveur :

```bash
# Première installation uniquement : ce script supprime les tables existantes.
cat api/db/schema.sql | sudo binggge exec -T db psql -U postgres -d binggge -v ON_ERROR_STOP=1
```

Ne pas rejouer ce script à chaque déploiement. L’initialisation du PostgreSQL éphémère dans le job de tests CI est un autre traitement, qui ne prépare pas la base persistante du serveur.

Le chemin prévu pour l’interface est `https://iut.cafeclaudie.fr/TasTom/`, et celui de la sonde `https://iut.cafeclaudie.fr/TasTom/health`. Ce sont les adresses attendues par la configuration ; elles ne constituent pas une preuve de disponibilité actuelle. La configuration complète de Traefik reste externe au dépôt.

Le service Nginx local reste publié sur le loopback 8080. Le serveur décrit ici route vers l’API qui sert aussi les fichiers React : il n’a pas besoin de router le trafic public vers ce Nginx autonome. Un proxy conteneurisé doit partager un réseau approprié avec sa cible ; son propre `127.0.0.1` ne désigne pas l’hôte.

Avant une exposition destinée à de vrais utilisateurs, l’identification par pseudo doit être remplacée par une authentification adaptée. Le déploiement pédagogique actuel ne protège pas la confidentialité des listes.

La protection de `main`, notamment l’obligation de réussir les checks, se configure dans GitHub ; elle n’est pas créée par le workflow. La définition des jobs ne prouve pas qu’une exécution particulière a réussi : consulter les checks du commit concerné.

## 15. Dépannage

| Symptôme | Cause à vérifier | Diagnostic ou action |
| --- | --- | --- |
| Moteur Docker injoignable | Moteur arrêté, contexte ou droits | Démarrer Docker et vérifier `docker version` |
| Port 8080 déjà utilisé | Autre service à cette adresse | Arrêter le service concerné ou modifier le port hôte du front |
| Erreur de recherche | API injoignable ou TVMaze en erreur | Examiner `docker compose logs api front` et `/api/health` |
| Santé API correcte, profil en erreur | La sonde ne vérifie pas SQL | Examiner les journaux API et les paramètres PostgreSQL |
| `password authentication failed` | Volume initialisé avec un autre mot de passe | Aligner le mot de passe du rôle et la configuration, sans supprimer la base |
| Modifier `DB_PASS` ne change rien | `POSTGRES_PASSWORD` initialise seulement un volume vide | Changer le mot de passe dans PostgreSQL, puis recréer l’API |
| `relation users does not exist` | Initialisation manuelle non faite | Inspecter `\dt` ; sur base neuve seulement charger le schéma, sinon appliquer une évolution adaptée |
| `401` sur la liste | Pseudo absent ou inconnu | Choisir/créer le profil et vérifier `X-User` |
| `409` à l’inscription | Pseudo déjà enregistré | Utiliser « Retrouver mon profil » |
| Séries en double | Pas d’unicité SQL par profil et série | La protection du front ne couvre pas les appels directs ou simultanés |
| Affiche manquante dans la liste | Métadonnées absentes du navigateur | La liste reste en base ; le front affiche un remplacement |
| Vite ne joint pas l’API | Port API non publié ou mauvaise cible | Utiliser le complément Compose local et vérifier `API_PROXY_TARGET` |
| Une variable front n’a pas d’effet dans Docker | Valeur intégrée au build | Adapter la compilation et reconstruire l’image |
| Front serveur vide ou fichiers introuvables sous `/TasTom/` | Image API ancienne, mauvais contexte ou préfixe incohérent | Construire avec le contexte racine et vérifier les chemins publics du build et de Traefik |
| Ancienne copie du dépôt testant encore 418 | Version antérieure du test santé | Mettre à jour le dépôt : le test actuel attend 200 |

Pour changer le mot de passe d’un rôle sans l’inscrire dans une commande, ouvrir `psql` dans le conteneur puis utiliser sa commande interactive `\password postgres`. La valeur choisie et celle de `.env` doivent ensuite correspondre.

Ne pas utiliser `docker compose down -v` ou rejouer `schema.sql` comme première réponse à une erreur de connexion : ces actions peuvent supprimer les données.

## 16. Limites et améliorations

Ces points sont des évolutions possibles, pas des fonctions déjà implémentées :

| Limite actuelle | Évolution possible |
| --- | --- |
| Identité déclarée via `X-User` | Authentification, mots de passe hachés et sessions ou jetons vérifiés |
| Pas de suppression de série | `DELETE /watchlist/:id`, contrôle du propriétaire et commande front |
| `seen` seulement lu et affiché | Route de modification et action « déjà vue » |
| Doublons possibles en base | `UNIQUE(user_id, show_id)` et gestion du conflit API |
| Schéma recréé par suppression | Migrations versionnées et sauvegardes avant évolution |
| Contraintes SQL incomplètes | Examiner `NOT NULL`, les contraintes de domaine et les index selon les besoins |
| Métadonnées dépendantes du navigateur | Stockage ou récupération serveur des informations utiles |
| TVMaze sans cache ni timeout API explicite | Cache, délai serveur et gestion plus précise des indisponibilités |
| Validation minimale des entrées | Validation structurée et contrat OpenAPI |
| Pas de limitation de fréquence | Mesures contre les abus avant un usage public |
| E2E manuel et contrôle visuel incomplet | Parcours navigateur et intégration Docker automatisés |
| Configuration Traefik externe et préfixe `/TasTom` fixé dans le code | Paramétrage cohérent du préfixe et documentation de l’infrastructure |
| Tags d’images évolutifs | Politique de mise à jour et verrouillage par digest si nécessaire |

Les requêtes SQL paramétrées, les contraintes, les validations minimales et les ports locaux répondent chacun à un besoin précis. Ils ne remplacent pas l’authentification, les migrations ni un audit complet de sécurité.

## 17. Progression de l’implémentation

La construction du projet a suivi ces couches :

1. **API initiale :** santé HTTP, recherche TVMaze et premières opérations de watchlist.
2. **Persistance :** PostgreSQL, tables liées, inscription par pseudo et garde `X-User`, avec les tests API.
3. **Exécution et CI :** image API, Compose avec base persistante, contrôles automatisés et workflow SSH.
4. **Interface React :** recherche en accueil, sélection de séries, profils, watchlist, cache, états visuels et tests d’interaction.
5. **Assemblage local :** image front en deux étapes, proxy Nginx, service front dans Compose, ordre de démarrage et validation des échanges front/API/base.
6. **Adaptation au serveur :** front aussi embarqué dans l’image API, service statique Express, préfixe `/TasTom`, build depuis la racine et déploiement via `sudo binggge`. Les tables sont initialisées manuellement pour respecter l’absence de montages hôtes autorisés sur le serveur.

Pour considérer une évolution terminée, vérifier son comportement, ses tests, son build et sa documentation ; pour une mise en ligne, vérifier aussi le routage distant réel. Une capture de succès local ou un conteneur sain ne suffit pas à prouver un déploiement public fonctionnel.
