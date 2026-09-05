# api-todo

Petite API HTTP de gestion de tâches, volontairement minimale, qui sert de support à un cours de 45 minutes sur Git et le déploiement.

## Démarrage

En local :

```bash
npm install
npm start
```

Avec Docker :

```bash
docker build -t api-todo .
docker run -p 3000:3000 api-todo
```

L'API écoute sur le port 3000 par défaut, surchargeable avec la variable d'environnement `PORT`.

## Routes

`GET /health` — état du service.

```bash
curl http://localhost:3000/health
```

`GET /todos` — liste des tâches.

```bash
curl http://localhost:3000/todos
```

`POST /todos` — création d'une tâche.

```bash
curl -X POST http://localhost:3000/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Réviser Git"}'
```

`DELETE /todos/:id` — suppression d'une tâche.

```bash
curl -X DELETE http://localhost:3000/todos/1
```

## Pièges connus

Ces deux défauts sont intentionnels : ils servent d'exercices en cours.

1. `POST /todos` ne valide pas le champ `title`. Un POST avec un corps vide crée une tâche sans titre au lieu de renvoyer une erreur 400.
2. `DELETE /todos/:id` renvoie toujours `200`, même lorsque l'id n'existe pas. Un 404 serait attendu.

## Convention de branches

La branche `main` est protégée : aucun push direct. Toute modification passe par une merge request relue par une autre personne.

Nommage des branches :

- `feat/<sujet>` pour une nouvelle fonctionnalité, par exemple `feat/validation-title`
- `fix/<sujet>` pour une correction, par exemple `fix/delete-404`

Les messages de commit suivent la convention `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `ci:`.
