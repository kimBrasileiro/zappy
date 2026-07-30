import type { Metadata } from 'next';
import Script from 'next/script';
import { prisma } from '@zappigo/db';
import { MarketingHome } from './marketing-home';

const BRAND_COLOR = '#2563eb';
const WHATSAPP_GREEN = '#25D366';

const CHAT_ICON = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4h16v12H7l-3 3V4z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
const ICON_WHATSAPP =
  '<svg viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M12 2a10 10 0 0 0-8.66 15L2 22l5.14-1.31A10 10 0 1 0 12 2zm0 18.2a8.16 8.16 0 0 1-4.17-1.14l-.3-.18-3.05.78.82-2.97-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.52-6.13c-.25-.12-1.47-.72-1.7-.81s-.4-.12-.56.12-.63.81-.78.97-.28.19-.53.06a6.7 6.7 0 0 1-1.97-1.22 7.4 7.4 0 0 1-1.36-1.7c-.14-.25 0-.38.11-.5s.25-.29.37-.44a1.6 1.6 0 0 0 .25-.41.46.46 0 0 0 0-.44c-.06-.12-.56-1.35-.77-1.85s-.4-.42-.56-.43h-.48a.9.9 0 0 0-.66.31 2.76 2.76 0 0 0-.86 2.05 4.78 4.78 0 0 0 1 2.54 10.9 10.9 0 0 0 4.19 3.7c.58.25 1.04.4 1.4.51a3.37 3.37 0 0 0 1.54.1 2.52 2.52 0 0 0 1.65-1.16 2 2 0 0 0 .14-1.16c-.06-.1-.22-.16-.47-.28z"/></svg>';

const DEFAULT_DESCRIPTION = 'Fale com a gente pelo chat ou pelo WhatsApp — respondemos rapidinho.';

type PageProps = { searchParams: { company?: string } };

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const companySlug = searchParams.company?.trim();
  if (!companySlug) return {};

  const company = await prisma.company.findUnique({ where: { slug: companySlug } });
  if (!company) return {};

  const description = (company.config as { description?: string } | null)?.description || DEFAULT_DESCRIPTION;
  return {
    title: `${company.name} — atendimento via Zappigo`,
    description,
    openGraph: { title: company.name, description },
  };
}

// Public homepage for companies with no website of their own — a ready-made
// link (Google Maps, Instagram bio, business card) that gives every company
// a real page with a working chat + WhatsApp button, whether or not they
// have a site. The install <script> preview for companies that DO have a
// site of their own lives on /dashboard/instalacao (logged-in only) — this
// page is the public-facing counterpart, not a developer tool.
export default async function HomePage({ searchParams }: PageProps) {
  const companySlug = searchParams.company?.trim();
  if (!companySlug) {
    return <MarketingHome />;
  }

  const company = await prisma.company.findUnique({ where: { slug: companySlug } });
  const whatsappNumber = process.env.WHATSAPP_CLOUD_API_NUMBER;
  const whatsappDigits = whatsappNumber?.replace(/\D/g, '');
  const waLink =
    whatsappDigits && company
      ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(`Olá, gostaria de falar com ${company.name}`)}`
      : null;
  const description = company ? (company.config as { description?: string } | null)?.description || DEFAULT_DESCRIPTION : null;

  return (
    <main
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #f5f7ff 0%, #f8f9fb 320px)',
        color: '#1a1a1a',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '20px 24px',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            background: BRAND_COLOR,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          dangerouslySetInnerHTML={{ __html: CHAT_ICON.replace('width="24"', 'width="17"').replace('height="24"', 'height="17"') }}
        />
        <span style={{ fontWeight: 700, fontSize: 15 }}>Zappigo</span>
        <span style={{ color: '#999', fontSize: 13 }}>· atendimento via IA para o seu negócio</span>
      </header>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '64px 24px 120px', textAlign: 'center' }}>
        {company ? (
          <>
            <h1 style={{ fontSize: 32, margin: '0 0 16px' }}>{company.name}</h1>
            <p style={{ color: '#555', fontSize: 16, lineHeight: 1.7, margin: '0 0 32px' }}>{description}</p>

            <p style={{ color: '#888', fontSize: 14, marginBottom: 20 }}>
              Clique no botão de chat no canto da tela, ou fale direto pelo WhatsApp:
            </p>

            {waLink && (
              <a
                href={waLink}
                target="_blank"
                rel="noopener"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  background: WHATSAPP_GREEN,
                  color: '#fff',
                  padding: '14px 28px',
                  borderRadius: 999,
                  fontWeight: 600,
                  fontSize: 16,
                  textDecoration: 'none',
                }}
              >
                <span dangerouslySetInnerHTML={{ __html: ICON_WHATSAPP }} />
                Fale no WhatsApp
              </a>
            )}
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 28, margin: '0 0 12px' }}>Empresa não encontrada</h1>
            <p style={{ color: '#b91c1c', maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
              Nenhuma empresa cadastrada com o slug <code>{companySlug}</code>. Confira o link.
            </p>
          </>
        )}
      </div>

      {company && (
        <Script
          key={companySlug}
          src="/widget.js"
          strategy="afterInteractive"
          data-company={companySlug}
          data-company-name={company.name}
          data-color={BRAND_COLOR}
          data-whatsapp={whatsappNumber}
        />
      )}
    </main>
  );
}
