const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const config = require('../config');
const faucetApi = require('./routes/faucetApi');
const statusApi = require('./routes/statusApi');

function createServer() {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          // Allow embedding the Discord server widget iframe on the /faucet page.
          frameSrc: ["'self'", 'https://discord.com'],
        },
      },
    })
  );
  app.disable('x-powered-by');

  app.get('/healthz', (req, res) => res.status(200).json({ ok: true }));

  // Mounted under /faucet (not /api) so a single nginx location for /faucet
  // covers both the static page and this - nginx's existing /api prefix is
  // already claimed by a different backend on this host. faucetApi's
  // /api/claim stays under /api since it's loopback-only and never proxied
  // publicly.
  app.use('/faucet', statusApi);
  app.use('/faucet', express.static(path.join(__dirname, 'public')));
  app.use('/api', faucetApi);

  return app;
}

function start() {
  const app = createServer();
  // Bind to loopback only - nginx (same host) proxies to this port, and
  // /api/claim in particular must never be reachable directly from the
  // internet. Don't rely on the host firewall alone for that.
  return app.listen(config.web.port, '127.0.0.1');
}

module.exports = { createServer, start };
