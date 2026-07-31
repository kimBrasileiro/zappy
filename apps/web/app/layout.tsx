import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Script from 'next/script';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { FREE_TIER_MODE } from '../lib/stripe/plans';

// Real Measurement ID for the "Zappigo" GA4 property — see privacy/page.tsx's
// Cookies section, updated in the same change, for the disclosure this
// requires. afterInteractive (not beforeInteractive/lazyOnload): loads after
// the page is interactive so it never competes with hydration for the
// first paint, but still fires early enough to capture the pageview.
const GA_MEASUREMENT_ID = 'G-EK9L29B8FH';

// Only set when NEXT_PUBLIC_APP_URL is a real absolute URL (see infra's
// "chicken-and-egg app_url" note) — metadataBase just becomes unset
// otherwise, which Next.js handles fine, it only means relative OG image
// paths won't resolve to an absolute URL until this is configured.
const appUrl = process.env.NEXT_PUBLIC_APP_URL;
const metadataBase = appUrl ? new URL(appUrl) : undefined;

// A function (not a static `export const metadata`) so it can resolve the
// request's actual locale (i18n/request.ts: NEXT_LOCALE cookie, falling
// back to this deployment's own DEFAULT_LOCALE) — a crawler never sends the
// cookie, so it always sees this deployment's own default language (pt for
// zappigo.com.br, es for a Spain deployment, etc), which is exactly what a
// separately-deployed instance needs its SEO/share-preview copy to reflect.
// A real visitor's own browser tab title/description follow their chosen
// switcher locale too, at no extra cost since this already runs per request.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');

  // "Grátis"/"Gratis"/"Free" folded into the title/description/keywords ONLY
  // while FREE_TIER_MODE is on — it's a genuinely strong hook right now (the
  // exact gap every paid competitor in the space has, see zappy-pitch's
  // competitor table), but it stops being true the moment billing turns back
  // on, and SEO copy claiming otherwise then would be actively misleading.
  const TITLE = FREE_TIER_MODE ? t('titleFree') : t('titlePaid');
  const DESCRIPTION = FREE_TIER_MODE ? t('descriptionFree') : t('descriptionPaid');
  // Primary target per locale: "whatsapp scheduling/booking" — specific
  // enough to be winnable for a new domain with zero backlink history, and
  // already high-intent. The generic "scheduling system" term alone is the
  // saturated, high-authority-dominated one — kept as a secondary signal.
  const keywords = [
    ...(t.raw('keywords') as string[]),
    ...(FREE_TIER_MODE ? (t.raw('keywordsFree') as string[]) : []),
  ];

  return {
    metadataBase,
    title: {
      default: TITLE,
      template: '%s · Zappigo',
    },
    description: DESCRIPTION,
    keywords,
    openGraph: {
      title: TITLE,
      description: DESCRIPTION,
      url: '/',
      siteName: 'Zappigo',
      locale: t('ogLocale'),
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: TITLE,
      description: DESCRIPTION,
    },
    alternates: {
      canonical: '/',
    },
  };
}

// en/es aren't real regional variants (en-US, es-ES) — this app has no
// region-specific behavior tied to the locale beyond the three flat
// dictionaries in messages/, so the bare language code is the honest tag.
const HTML_LANG: Record<string, string> = { pt: 'pt-BR', es: 'es', en: 'en' };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={HTML_LANG[locale] ?? 'pt-BR'}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
        <Script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
        <Script id="ga4-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');`}
        </Script>
      </body>
    </html>
  );
}
