import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Script from 'next/script';

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

const TITLE = 'Zappigo — Sistema de Agendamento por WhatsApp com IA';
const DESCRIPTION =
  'Sistema de agendamento por WhatsApp com IA: um assistente que responde o FAQ da sua empresa e marca horários sozinho no site e no WhatsApp — com handoff pra atendimento humano quando precisar.';

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: TITLE,
    template: '%s · Zappigo',
  },
  description: DESCRIPTION,
  // Primary target: "sistema de agendamento por whatsapp" — specific enough
  // to be winnable for a new domain with zero backlink history, and already
  // high-intent (whoever searches it knows they want WhatsApp specifically,
  // which is this product's actual differentiator vs. generic scheduling
  // tools). "sistema de agendamento" alone is the saturated, high-authority-
  // dominated term — kept as a secondary signal, not the primary bet.
  keywords: [
    'sistema de agendamento por whatsapp',
    'agendamento por whatsapp',
    'sistema de agendamento',
    'agendamento automático',
    'agendamento online',
    'suporte via whatsapp',
    'atendimento via whatsapp',
    'chatbot de atendimento',
    'assistente virtual de atendimento',
    'FAQ automático',
    'chat com IA para empresas',
  ],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: '/',
    siteName: 'Zappigo',
    locale: 'pt_BR',
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
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
