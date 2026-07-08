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
  transpilePackages: ['@chat-ia/db', '@chat-ia/types'],
};

export default nextConfig;
