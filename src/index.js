const http = require('http');

const PORT = process.env.PORT || 3000;

// GET /health - Renvoie { status: "ok" }
// GET /shows?q= - Appelle TVMaze et renvoie une liste allégée
// GET /watchlist - Renvoie un tableau vide

const server = http.createServer(async (req, res) => {
  // CORS headers pour permettre les requêtes depuis le navigateur
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Gérer les requêtes OPTIONS (preflight CORS)
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Router
  const url = new URL(req.url, `http://${req.headers.host}`);

  // GET /health
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  // GET /shows?q=
  if (req.method === 'GET' && url.pathname === '/shows') {
    const q = url.searchParams.get('q');

    if (!q) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: "Le paramètre 'q' est requis" }));
      return;
    }

    try {
      const response = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`);
      const data = await response.json();

      // Liste allégée : identifiant, titre, année, image
      const shows = data.map(item => ({
        id: item.show.id,
        title: item.show.name,
        year: item.show.premiered ? parseInt(item.show.premiered.slice(0, 4)) : null,
        image: item.show.image ? item.show.image.medium : null
      }));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(shows));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: "Erreur lors de l'appel à TVMaze" }));
    }
    return;
  }

  // GET /watchlist
  if (req.method === 'GET' && url.pathname === '/watchlist') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([])); // Tableau vide
    return;
  }

  // 404 - Route inconnue
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: "Route introuvable" }));
});

server.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});