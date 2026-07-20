import Script from 'next/script';
import { prisma } from '@zappy/db';
import { CopySnippet } from './copy-snippet';
import { MarketingHome } from './marketing-home';

const BRAND_COLOR = '#2563eb';

const CHAT_ICON = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4h16v12H7l-3 3V4z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;

export default async function HomePage({
  searchParams,
}: {
  searchParams: { company?: string };
}) {
  // No ?company= at all → this is the Zappy institutional site itself, not
  // a customer-preview page. Test any company's widget by slug instead:
  // /?company=sua-loja-teste.
  const companySlug = searchParams.company?.trim();
  if (!companySlug) {
    return <MarketingHome />;
  }

  const company = await prisma.company.findUnique({ where: { slug: companySlug } });
  const whatsappNumber = process.env.WHATSAPP_CLOUD_API_NUMBER;

  const snippet = [
    `<script src="https://cdn.seudominio.com/widget.js"`,
    `        data-company="${companySlug}"`,
    `        data-color="${BRAND_COLOR}"`,
    whatsappNumber ? `        data-whatsapp="${whatsappNumber}"` : null,
    `        async></script>`,
  ]
    .filter(Boolean)
    .join('\n');

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
        <span style={{ fontWeight: 700, fontSize: 15 }}>Zappy</span>
        <span style={{ color: '#999', fontSize: 13 }}>· atendimento via IA para o seu negócio</span>
      </header>

      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '40px 24px 120px' }}>
        <section style={{ marginBottom: 40 }}>
          <span
            style={{
              display: 'inline-block',
              background: '#eef2ff',
              color: BRAND_COLOR,
              fontSize: 12,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 999,
              marginBottom: 12,
            }}
          >
            Preview do widget · empresa: <code>{companySlug}</code>
          </span>
          <h1 style={{ fontSize: 30, margin: '0 0 8px' }}>
            {company ? company.name : 'Empresa não encontrada'}
          </h1>
          <p style={{ color: '#888', fontSize: 12.5, margin: '0 0 12px' }}>
            Testando outra loja? Acesse <code>/?company=slug-da-sua-loja</code> (ex:{' '}
            <a href="/?company=acme-demo" style={{ color: BRAND_COLOR }}>
              /?company=acme-demo
            </a>
            ).
          </p>
          {company ? (
            <p style={{ color: '#555', maxWidth: 560, lineHeight: 1.6 }}>
              Esta página simula o site de um cliente com o widget de chat instalado. O botão no
              canto inferior direito é o widget real, rodando a partir de{' '}
              <code>public/widget.js</code> — as respostas vêm do Gemini de verdade via{' '}
              <code>/api/chat</code>, e cada conversa vira um ticket real no Postgres.
            </p>
          ) : (
            <p style={{ color: '#b91c1c', maxWidth: 560, lineHeight: 1.6 }}>
              Nenhuma empresa cadastrada com o slug <code>{companySlug}</code>. Confira o link ou
              cadastre uma empresa em <code>/onboarding</code>.
            </p>
          )}
        </section>

        {company && (
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 380px)',
              gap: 28,
            }}
          >
            <div
              style={{
                background: '#fff',
                borderRadius: 16,
                border: '1px solid rgba(0,0,0,0.06)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 14px',
                  background: '#f3f4f6',
                  borderBottom: '1px solid rgba(0,0,0,0.06)',
                }}
              >
                {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
                  <span key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />
                ))}
                <span style={{ marginLeft: 10, fontSize: 11.5, color: '#999' }}>
                  {company.name.toLowerCase().replace(/\s+/g, '')}.com.br
                </span>
              </div>
              <div style={{ padding: 32, minHeight: 300 }}>
                <h2 style={{ fontSize: 20, marginTop: 0 }}>Bem-vindo à {company.name}</h2>
                <p style={{ color: '#555', lineHeight: 1.7 }}>
                  Conteúdo de exemplo do site do cliente — o widget não interfere no CSS/JS desta
                  página porque roda isolado dentro de um Shadow DOM.
                </p>
                <p style={{ color: '#555', lineHeight: 1.7 }}>
                  Clique no botão de chat para abrir o painel, testar os quick-replies e enviar
                  uma mensagem.
                </p>
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: 15, marginBottom: 8 }}>Instalação</h3>
              <p style={{ color: '#666', fontSize: 13, marginTop: 0, marginBottom: 12 }}>
                Uma linha de <code>&lt;script&gt;</code>, sem mudanças no resto do site:
              </p>
              <CopySnippet snippet={snippet} />
            </div>
          </section>
        )}
      </div>

      {company && (
        <Script
          key={companySlug}
          src="/widget.js"
          strategy="afterInteractive"
          data-company={companySlug}
          data-color={BRAND_COLOR}
          data-whatsapp={whatsappNumber}
        />
      )}
    </main>
  );
}
