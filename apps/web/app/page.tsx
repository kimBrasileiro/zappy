import Script from 'next/script';
import { CopySnippet } from './copy-snippet';

const DEFAULT_COMPANY_ID = 'acme-demo'; // matches the slug created by packages/db/prisma/seed.ts
const DEMO_COLOR = '#2563eb';

export default function HomePage({
  searchParams,
}: {
  searchParams: { company?: string };
}) {
  // Test any company's widget by slug without touching code: /?company=sua-loja-teste
  const companyId = searchParams.company?.trim() || DEFAULT_COMPANY_ID;

  const snippet = `<script src="https://cdn.seudominio.com/widget.js"
        data-company="${companyId}"
        data-color="${DEMO_COLOR}"
        async></script>`;

  return (
    <main
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
        maxWidth: 1040,
        margin: '0 auto',
        padding: '48px 24px 120px',
        color: '#1a1a1a',
      }}
    >
      <section style={{ marginBottom: 48 }}>
        <span
          style={{
            display: 'inline-block',
            background: '#eef2ff',
            color: '#2563eb',
            fontSize: 12,
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: 999,
            marginBottom: 12,
          }}
        >
          Preview do widget · empresa: <code>{companyId}</code>
        </span>
        <h1 style={{ fontSize: 32, margin: '0 0 8px' }}>Acme Corp</h1>
        <p style={{ color: '#888', fontSize: 12.5, margin: '0 0 12px' }}>
          Testando outra loja? Acesse <code>/?company=slug-da-sua-loja</code> (ex:{' '}
          <a href="/?company=acme-demo">/?company=acme-demo</a>).
        </p>
        <p style={{ color: '#555', maxWidth: 560, lineHeight: 1.6 }}>
          Esta página simula o site de um cliente com o widget de chat instalado. O botão no canto
          inferior direito é o widget real, rodando a partir de <code>public/widget.js</code> —
          as respostas vêm do Gemini de verdade via <code>/api/chat</code>, e cada conversa vira
          um ticket real no Postgres.
        </p>
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 380px)',
          gap: 32,
        }}
      >
        <div
          style={{
            background: '#f8f9fb',
            borderRadius: 16,
            padding: 32,
            minHeight: 320,
          }}
        >
          <h2 style={{ fontSize: 20, marginTop: 0 }}>Bem-vindo à Acme Corp</h2>
          <p style={{ color: '#555', lineHeight: 1.7 }}>
            Conteúdo de exemplo do site do cliente — o widget não interfere no CSS/JS desta página
            porque roda isolado dentro de um Shadow DOM.
          </p>
          <p style={{ color: '#555', lineHeight: 1.7 }}>
            Clique no botão de chat para abrir o painel, testar os quick-replies e enviar uma
            mensagem.
          </p>
        </div>

        <div>
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>Instalação</h3>
          <p style={{ color: '#666', fontSize: 13, marginTop: 0, marginBottom: 12 }}>
            Uma linha de <code>&lt;script&gt;</code>, sem mudanças no resto do site:
          </p>
          <CopySnippet snippet={snippet} />
        </div>
      </section>

      <Script
        key={companyId}
        src="/widget.js"
        strategy="afterInteractive"
        data-company={companyId}
        data-color={DEMO_COLOR}
      />
    </main>
  );
}
