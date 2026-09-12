-- Script rejouable : repart d'un schéma propre.
-- ATTENTION : les données existantes sont supprimées.
DROP TABLE IF EXISTS watchlist CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  login TEXT UNIQUE NOT NULL
);
CREATE TABLE watchlist (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  show_id INT NOT NULL,
  title TEXT NOT NULL,
  seen BOOLEAN DEFAULT false
);
