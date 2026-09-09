const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const config = require('../config');
const faucetApi = require('./routes/faucetApi');
const statusApi = require('./routes/statusApi');
const webClaimApi = require('./routes/webClaimApi');

function createServer() {
  const app = express();

  // Exactly one hop (nginx, on this same host, over loopback) sits in front
  // of us - trust its X-Forwarded-For so req.ip reflects the real visitor.
  // Needed for per-IP identity/rate-limiting on the public web-claim route;
  // without this every request looks like it comes from nginx's own
  // loopback address.
  app.set('trust proxy', 'loopback');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          // Discord server widget iframe + Cloudflare Turnstile (script,
          // its challenge iframe, and its own network calls) on /faucet.
          // Helmet's default directive keys are kebab-case strings (see
          // helmet.contentSecurityPolicy.getDefaultDirectives()) - using
          // camelCase here for one that already has a default (script-src)
          // creates a duplicate the header parser rejects at startup.
          'frame-src': ["'self'", 'https://discord.com', 'https://challenges.cloudflare.com'],
          'script-src': ["'self'", 'https://challenges.cloudflare.com'],
          'connect-src': ["'self'", 'https://challenges.cloudflare.com'],
        },
      },
    })
  );
  app.disable('x-powered-by');

  app.get('/healthz', (req, res) => res.status(200).json({ ok: true }));

  // Mounted under /faucet (not /api) so a single nginx location for /faucet
  // covers all of this - nginx's existing /api prefix is already claimed by
  // a different backend on this host. faucetApi's /api/claim stays under
  // /api since it's loopback-only and never proxied publicly.
  app.use('/faucet', statusApi);
  app.use('/faucet', webClaimApi);
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
