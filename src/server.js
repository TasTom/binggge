// API de gestion de taches - support de cours Git & deploiement
const express = require("express");

const app = express();
app.use(express.json());

// Le port est configurable via l'environnement (utile en Docker / CI)
const PORT = process.env.PORT || 3000;

// Base de donnees en memoire : un simple tableau, remis a zero a chaque redemarrage
let todos = [];
let prochainId = 1;

// Verification de sante, utilisee par le pipeline et par Docker
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Liste toutes les taches
app.get("/todos", (req, res) => {
  res.json(todos);
});

// Cree une tache
// ATTENTION : aucune validation du champ "title" (piege pedagogique volontaire)
app.post("/todos", (req, res) => {
  const tache = { id: prochainId++, title: req.body.title, done: false };
  todos.push(tache);
  res.status(201).json(tache);
});

// Supprime une tache par son id
// ATTENTION : renvoie 200 meme si l'id n'existe pas (piege pedagogique volontaire)
app.delete("/todos/:id", (req, res) => {
  todos = todos.filter((t) => t.id !== Number(req.params.id));
  res.json({ deleted: true });
});

// Demarrage du serveur (ignore quand le fichier est importe par les tests)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`api-todo demarre sur le port ${PORT}`);
  });
}

module.exports = app;
