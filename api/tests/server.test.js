// Tests de l'API binggge (séance 2).
// Prérequis : docker compose up -d db, puis rejouer api/db/schema.sql.
// Lancement  : cd api && npm test

const { describe, test, after } = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')

const { app, db } = require('../src/server')

// Logins uniques : les tests sont rejouables sans nettoyage manuel.
const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
const newLogin = (name) => `test-${name}-${suffix}`

const created = []

// Nettoyage : on repart sans laisser de lignes derrière nous,
// puis on ferme le pool sinon le processus de test reste bloqué.
after(async () => {
  if (created.length) {
    await db.query(
      `DELETE FROM watchlist
        WHERE user_id IN (SELECT id FROM users WHERE login = ANY($1))`,
      [created])
    await db.query('DELETE FROM users WHERE login = ANY($1)', [created])
  }
  await db.end()
})

describe('API binggge', () => {
  // 01
  test('/health répond 200', async () => {
    const r = await request(app).get('/health')

    assert.equal(r.status, 200)
    assert.deepEqual(r.body, { status: 'ok' })
  })

  // 02
  test('une inscription crée bien l\'utilisateur', async () => {
    const login = newLogin('register')
    created.push(login)

    const r = await request(app).post('/register').send({ login })

    assert.equal(r.status, 201)

    // La réponse ne suffit pas : on vérifie que la ligne existe en base.
    const { rows } = await db.query('SELECT id FROM users WHERE login = $1', [login])
    assert.equal(rows.length, 1)
  })

  // 03
  test('ajouter une série la fait apparaître dans /watchlist', async () => {
    const login = newLogin('watchlist')
    created.push(login)

    await request(app).post('/register').send({ login }).expect(201)

    const added = await request(app)
      .post('/watchlist')
      .set('X-User', login)
      .send({ show_id: 44778, title: 'Severance' })

    assert.equal(added.status, 201)

    const r = await request(app).get('/watchlist').set('X-User', login)

    assert.equal(r.status, 200)
    assert.equal(r.body.length, 1)
    assert.equal(r.body[0].title, 'Severance')
    assert.equal(r.body[0].showId, 44778)
  })

  // 04 - le test qui vérifie un refus
  test('/watchlist sans en-tête renvoie 401', async () => {
    const r = await request(app).get('/watchlist')

    assert.equal(r.status, 401)
  })

  // 05 - un titre vide est refusé
  test('un titre vide est refusé', async () => {
    const login = newLogin('titre-vide')
    created.push(login)

    await request(app).post('/register').send({ login }).expect(201)

    const r = await request(app)
      .post('/watchlist')
      .set('X-User', login)
      .send({ show_id: 1, title: '' })

    assert.equal(r.status, 400)
  })
})
