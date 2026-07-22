import Link from 'next/link';
import type { ReactNode } from 'react';

const BRAND_COLOR = '#2563eb';

export function LegalPage({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <main
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
        color: '#1a1a1a',
        maxWidth: 760,
        margin: '0 auto',
        padding: '48px 24px 100px',
        lineHeight: 1.7,
      }}
    >
      <Link href="/" style={{ color: BRAND_COLOR, fontSize: 13.5, textDecoration: 'none' }}>
        ← Voltar pra Zappy
      </Link>

      <h1 style={{ fontSize: 30, margin: '20px 0 4px' }}>{title}</h1>
      <p style={{ color: '#888', fontSize: 13, margin: '0 0 28px' }}>Última atualização: {lastUpdated}</p>

      {/* Not legal advice — a placeholder-filled starting point, not a
          substitute for review by an actual lawyer before this touches real
          payments. Deliberately loud so it doesn't get missed and
          accidentally shipped as-is. */}
      <div
        style={{
          background: '#fef3c7',
          border: '1px solid #fde68a',
          borderRadius: 10,
          padding: '14px 18px',
          fontSize: 13.5,
          color: '#92400e',
          marginBottom: 32,
        }}
      >
        ⚠️ Modelo de referência para servir de ponto de partida — ainda não foi revisado por um
        advogado. Preencha os campos entre colchetes com os dados reais da empresa e passe por
        revisão jurídica antes de usar com cobranças reais.
      </div>

      <div style={{ fontSize: 14.5, color: '#333' }}>{children}</div>
    </main>
  );
}
