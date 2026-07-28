import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

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
  experimental: {
    serverActions: {
      // zappigo.com.br sits behind a Cloudflare Worker reverse proxy in
      // front of this Cloud Run service (southamerica-east1 doesn't support
      // Cloud Run domain mappings — see infra/README.md#custom-domain), so
      // the request the app actually receives still has Host set to the raw
      // *.run.app hostname while Origin is zappigo.com.br. Next.js's default
      // Server Actions CSRF check compares those and rejects the mismatch
      // ("Invalid Server Actions request") — this is the documented escape
      // hatch, not a security loosening: it's still an explicit allowlist,
      // just one that accounts for the proxy in front.
      allowedOrigins: ['zappigo.com.br', 'www.zappigo.com.br'],
    },
  },
};

export default nextConfig;
