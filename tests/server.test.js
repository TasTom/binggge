const test = require("node:test");
const assert = require("node:assert");
const request = require("supertest");
const app = require("../src/server");

test("GET /todos renvoie une liste vide au demarrage", async () => {
  const res = await request(app).get("/todos");
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body, []);
});

test("POST /todos cree une tache", async () => {
  const res = await request(app).post("/todos").send({ title: "Reviser Git" });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.title, "Reviser Git");
});

test("DELETE /todos/:id supprime la tache", async () => {
  const cree = await request(app).post("/todos").send({ title: "A supprimer" });
  const res = await request(app).delete(`/todos/${cree.body.id}`);
  assert.strictEqual(res.status, 200);

  const liste = await request(app).get("/todos");
  assert.ok(!liste.body.some((t) => t.id === cree.body.id));
});
