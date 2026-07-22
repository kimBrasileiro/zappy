import type { MetadataRoute } from 'next';

// /dashboard, /admin, /onboarding are auth-gated (redirect to /login with no
// real content when crawled anonymously) and /api is never meant to be
// indexed — none of them should show up in search results even though
// disallowing here doesn't itself guarantee de-indexing of anything already
// linked elsewhere (a robots.txt Disallow blocks crawling, not indexing of
// an already-known URL — this app just never links to them publicly, so
// that gap doesn't apply in practice).
export default function robots(): MetadataRoute.Robots {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/admin', '/onboarding', '/api'],
    },
    sitemap: appUrl ? `${appUrl}/sitemap.xml` : undefined,
  };
}
