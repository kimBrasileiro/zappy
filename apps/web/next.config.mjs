import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import createNextIntlPlugin from 'next-intl/plugin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Next.js only auto-loads .env* files from this app's own directory, but
// this monorepo keeps a single .env.local at the repo root (matching
// .env.example there). Load it explicitly — doesn't override any var Next
// already picked up from apps/web's own .env* files, and no-ops harmlessly
// in production where this gitignored file won't exist.
loadEnv({ path: path.resolve(__dirname, '../../.env.local') });

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@zappigo/db', '@zappigo/types'],
  // Stop advertising the framework in every response — pure info-disclosure
  // reduction, doesn't change behavior.
  poweredByHeader: false,
  // Baseline hardening found missing in the production security pass. Safe
  // to apply to every route, including /widget.js and /api/chat: none of
  // these headers affect how the widget embeds on a customer's page (that's
  // a <script> injecting DOM on their site, never an iframe of our own
  // pages) or the widget's CORS behavior (a separate, deliberately open
  // Access-Control-Allow-Origin: * set per-route, untouched by this). CSP is
  // deliberately NOT included here — this app relies on several inline
  // scripts (JSON-LD, icons) that a real CSP would need auditing to not
  // break, worth doing as its own pass rather than guessing at a policy.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      // Every deployment (zappigo.com.br, zappigo.es, ...) sits behind its
      // own Cloudflare Worker reverse proxy in front of its Cloud Run
      // service (no region here supports Cloud Run domain mappings — see
      // infra/README.md#custom-domain), so the request the app actually
      // receives still has Host set to the raw *.run.app hostname while
      // Origin is the real public domain. Next.js's default Server Actions
      // CSRF check compares those and rejects the mismatch ("Invalid Server
      // Actions request") — this is the documented escape hatch, not a
      // security loosening: it's still an explicit allowlist, just derived
      // from this deployment's own NEXT_PUBLIC_APP_URL (available at build
      // time, see Dockerfile) instead of one deployment's domain hardcoded
      // for all of them.
      allowedOrigins: (() => {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL;
        if (!appUrl) return ['zappigo.com.br', 'www.zappigo.com.br', 'zappigo.es', 'www.zappigo.es'];
        const host = new URL(appUrl).hostname;
        return host.startsWith('www.') ? [host, host.slice(4)] : [host, `www.${host}`];
      })(),
    },
  },
};

// Points at i18n/request.ts — cookie-driven locale, no [locale] route
// segment or middleware (see that file's own comment for why).
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

export default withNextIntl(nextConfig);
