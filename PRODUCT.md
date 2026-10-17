# binggge

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React, demandé par l’utilisateur. API Express et PostgreSQL existante. Vite pour le front.

## Product Purpose

Rechercher des séries via TVMaze et retrouver une watchlist personnelle.
L’utilisateur a confirmé que la recherche de séries doit être l’écran d’accueil.

## Capabilities and Constraints

L’API fournit GET /shows?q=, POST /register, GET /watchlist et POST /watchlist.
Le profil est identifié par un pseudo transmis via X-User ; aucun mot de passe
ni mécanisme d’authentification n’existe. Ne pas présenter ce choix de profil
comme une connexion sécurisée. L’API ne permet ni suppression ni modification
du statut vu. Le front doit utiliser uniquement les capacités existantes.

## Brand Commitments

Nom existant : binggge. Interface simple, épurée et sobre, demandée explicitement.
Langue de travail : français. Impeccable et UI UX Pro Max demandés par l’utilisateur.

## Evidence on Hand

Contrat API dans api/src/server.js ; documentation dans readme.md.
Affiches et métadonnées réelles fournies par les résultats TVMaze.
Aucun chiffre d’audience ni témoignage à inventer.

## Open Decisions

Public précis non défini. Hypothèse de travail : personnes souhaitant choisir
une série et la conserver pour plus tard, sur ordinateur ou mobile.
