import type { MetadataRoute } from 'next';

// Only the public marketing/auth pages — /dashboard, /admin, /onboarding
// are auth-gated and excluded here the same way they're excluded from
// robots.ts.
export default function sitemap(): MetadataRoute.Sitemap {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const now = new Date();

  return [
    { url: appUrl, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${appUrl}/signup`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${appUrl}/login`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
