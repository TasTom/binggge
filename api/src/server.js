// Séance 2 : inscription + garde des routes privées (API Express + Postgres).
// Base : docker compose up -d db, puis rejouer api/db/schema.sql.

const express = require('express')
const { Pool } = require('pg')

const app = express()
app.use(express.json())

// CORS : le front (binggge) tourne sur une autre origine que l'API
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User')

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204)
  }

  next()
})

// Connexion Postgres (valeurs par défaut = docker-compose.yml)
const db = new Pool({
  connectionString: process.env.DATABASE_URL
    || 'postgres://postgres:binggge@localhost:5432/binggge',
})

// GET /health - sonde de disponibilité (interrogée par le pipeline, séance 3)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

// GET /shows?q= - recherche TVMaze, renvoie une liste allégée
app.get('/shows', async (req, res, next) => {
  const q = req.query.q

  if (!q || typeof q !== 'string' || !q.trim()) {
    return res.status(400).json({ error: "Le paramètre 'q' est requis" })
  }

  try {
    const response = await fetch(
      `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`)

    if (!response.ok) {
      throw new Error(`TVMaze a répondu ${response.status}`)
    }

    const data = await response.json()

    // Liste allégée : identifiant, titre, année, image
    res.json(data.map(item => ({
      id: item.show.id,
      title: item.show.name,
      year: item.show.premiered ? Number(item.show.premiered.slice(0, 4)) : null,
      image: item.show.image ? item.show.image.medium : null,
    })))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Erreur lors de l'appel à TVMaze" })
  }
})

// POST /register
app.post('/register', async (req, res, next) => {
  const login = req.body && req.body.login
  if (!login || typeof login !== 'string' || !login.trim()) {
    return res.status(400).json({ error: "Le champ 'login' est requis" })
  }
  try {
    await db.query(
      'INSERT INTO users(login) VALUES($1)',
      [login.trim()])
    res.status(201).json({ login: login.trim() })
  } catch (err) {
    // 23505 = violation d'unicité : login déjà pris
    if (err.code === '23505') {
      return res.status(409).json({ error: 'login déjà utilisé' })
    }
    next(err)
  }
})

// le garde des routes privées : le login doit exister en base.
// Pose req.user, utilisé ensuite par les routes.
const user = async (req, res, next) => {
  const login = String(req.get('X-User') || '').trim()

  if (!login) {
    return res.status(401).json({ error: 'non authentifié' })
  }

  try {
    const { rows } = await db.query(
      'SELECT id, login FROM users WHERE login = $1', [login])

    if (!rows[0]) {
      return res.status(401).json({ error: 'non authentifié' })
    }

    req.user = rows[0]
    next()
  } catch (err) {
    next(err)
  }
}

app.get('/watchlist', user, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, show_id AS "showId", title, seen
         FROM watchlist
        WHERE user_id = $1
        ORDER BY id`,
      [req.user.id])
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

// POST /watchlist - privé
app.post('/watchlist', user, async (req, res, next) => {
  const showId = req.body && req.body.show_id
  const title = req.body && req.body.title

  if (!Number.isInteger(showId)) {
    return res.status(400).json({ error: "Le champ 'show_id' doit être un entier" })
  }
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: "Le champ 'title' ne peut pas être vide" })
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO watchlist(user_id, show_id, title)
       VALUES($1, $2, $3)
       RETURNING id, show_id AS "showId", title, seen`,
      [req.user.id, showId, title.trim()])

    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

// 404 - Route inconnue
app.use((req, res) => {
  res.status(404).json({ error: 'Route introuvable' })
})

// gestionnaire d'erreurs
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err)
  res.status(err.status || 500).json({ error: 'Erreur serveur' })
})

const PORT = process.env.PORT || 3000
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`API démarrée sur le port ${PORT}`)
  })
}

module.exports = { app, user, db }
