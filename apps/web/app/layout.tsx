import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Only set when NEXT_PUBLIC_APP_URL is a real absolute URL (see infra's
// "chicken-and-egg app_url" note) — metadataBase just becomes unset
// otherwise, which Next.js handles fine, it only means relative OG image
// paths won't resolve to an absolute URL until this is configured.
const appUrl = process.env.NEXT_PUBLIC_APP_URL;
const metadataBase = appUrl ? new URL(appUrl) : undefined;

const TITLE = 'Zappigo — Sistema de Agendamento e Suporte via WhatsApp com IA';
const DESCRIPTION =
  'Agendamento automático e suporte via WhatsApp e chat, com um assistente de IA que responde o FAQ da sua empresa e marca horários sozinho — com handoff pra atendimento humano quando precisar.';

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: TITLE,
    template: '%s · Zappigo',
  },
  description: DESCRIPTION,
  keywords: [
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
      <body>{children}</body>
    </html>
  );
}
