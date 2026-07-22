import { prisma } from '@zappy/db';
import { requireSession } from '../../../lib/auth-server';
import { CopySnippet } from '../../copy-snippet';
import { DomainsForm } from './domains-form';

const BRAND_COLOR = '#2563eb';

export default async function InstalacaoPage() {
  const { companyId } = await requireSession();
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const whatsappNumber = process.env.WHATSAPP_CLOUD_API_NUMBER;
  const whatsappDigits = whatsappNumber?.replace(/\D/g, '');

  const snippet = [
    `<script src="${appUrl}/widget.js"`,
    `        data-company="${company.slug}"`,
    `        data-color="${BRAND_COLOR}"`,
    whatsappNumber ? `        data-whatsapp="${whatsappNumber}"` : null,
    `        async></script>`,
  ]
    .filter(Boolean)
    .join('\n');

  const waLink = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(`Z:${company.slug} Olá!`)}`
    : null;

  return (
    <>
      <h1 className="dash-h1">Instalação</h1>
      <p className="dash-subtitle">
        Cole o script abaixo no site da sua empresa — ele já traz o chat e (se o número
        compartilhado estiver configurado) o botão de continuar no WhatsApp.
      </p>

      <div className="dash-card">
        <h3 style={{ fontSize: 15, marginTop: 0, marginBottom: 8 }}>Link direto do WhatsApp</h3>
        {waLink ? (
          <>
            <p style={{ color: '#666', fontSize: 13, marginTop: 0, marginBottom: 12 }}>
              Copie e cole esse link no site da sua empresa ou na ficha do Google Maps (campo de
              site/agendamento) — o jeito mais fácil de deixar seus clientes agendando
              automaticamente pelo WhatsApp, sem precisar instalar nada:
            </p>
            <CopySnippet snippet={waLink} />
          </>
        ) : (
          <p style={{ color: '#999', fontSize: 13, margin: 0 }}>
            O número compartilhado de WhatsApp da Zappy ainda não foi configurado nesta
            instância — assim que estiver, o link aparece aqui automaticamente.
          </p>
        )}
      </div>

      <div className="dash-card">
        <h3 style={{ fontSize: 15, marginTop: 0, marginBottom: 8 }}>Script do chat</h3>
        <p style={{ color: '#666', fontSize: 13, marginTop: 0, marginBottom: 12 }}>
          Uma linha de <code>&lt;script&gt;</code>, sem mudanças no resto do site:
        </p>
        <CopySnippet snippet={snippet} />
      </div>

      <div className="dash-card">
        <h3 style={{ fontSize: 15, marginTop: 0, marginBottom: 8 }}>Domínios permitidos</h3>
        <p style={{ color: '#666', fontSize: 13, marginTop: 0, marginBottom: 12 }}>
          Um domínio por linha (ex: <code>meusite.com.br</code>), sem <code>https://</code> nem{' '}
          <code>www.</code> — qualquer um dos dois é aceito automaticamente. Enquanto essa lista
          estiver vazia, o script funciona em qualquer site (útil pra testar); assim que você
          adicionar pelo menos um domínio, só eles (e esta página de preview) poderão usar o chat
          como sua empresa.
        </p>
        <DomainsForm defaultDomains={company.allowedDomains} />
      </div>
    </>
  );
}
