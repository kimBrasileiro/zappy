import { prisma } from '@zappigo/db';
import { requireSession } from '../../../lib/auth-server';
import { CopySnippet } from '../../copy-snippet';
import { DomainsForm } from './domains-form';

const BRAND_COLOR = '#2563eb';
const WHATSAPP_GREEN = '#25D366';
const ICON_WHATSAPP =
  '<svg viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M12 2a10 10 0 0 0-8.66 15L2 22l5.14-1.31A10 10 0 1 0 12 2zm0 18.2a8.16 8.16 0 0 1-4.17-1.14l-.3-.18-3.05.78.82-2.97-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.52-6.13c-.25-.12-1.47-.72-1.7-.81s-.4-.12-.56.12-.63.81-.78.97-.28.19-.53.06a6.7 6.7 0 0 1-1.97-1.22 7.4 7.4 0 0 1-1.36-1.7c-.14-.25 0-.38.11-.5s.25-.29.37-.44a1.6 1.6 0 0 0 .25-.41.46.46 0 0 0 0-.44c-.06-.12-.56-1.35-.77-1.85s-.4-.42-.56-.43h-.48a.9.9 0 0 0-.66.31 2.76 2.76 0 0 0-.86 2.05 4.78 4.78 0 0 0 1 2.54 10.9 10.9 0 0 0 4.19 3.7c.58.25 1.04.4 1.4.51a3.37 3.37 0 0 0 1.54.1 2.52 2.52 0 0 0 1.65-1.16 2 2 0 0 0 .14-1.16c-.06-.1-.22-.16-.47-.28z"/></svg>';

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
    `        data-company-name="${company.name}"`,
    `        data-color="${BRAND_COLOR}"`,
    whatsappNumber ? `        data-whatsapp="${whatsappNumber}"` : null,
    `        async></script>`,
  ]
    .filter(Boolean)
    .join('\n');

  const waLink = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(`Olá, gostaria de agendar serviços com ${company.name}`)}`
    : null;

  // Self-contained: inline styles + inline SVG icon, no external CSS/JS —
  // has to render correctly dropped into any arbitrary third-party site,
  // the same bar the chat <script> snippet below already meets.
  const waButtonSnippet = waLink
    ? `<a href="${waLink}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:10px;background:${WHATSAPP_GREEN};color:#fff;padding:12px 22px;border-radius:999px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-weight:600;font-size:15px;text-decoration:none;line-height:1;">${ICON_WHATSAPP}Fale no WhatsApp</a>`
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
            O número compartilhado de WhatsApp da Zappigo ainda não foi configurado nesta
            instância — assim que estiver, o link aparece aqui automaticamente.
          </p>
        )}
      </div>

      <div className="dash-card">
        <h3 style={{ fontSize: 15, marginTop: 0, marginBottom: 8 }}>Botão do WhatsApp</h3>
        {waButtonSnippet ? (
          <>
            <p style={{ color: '#666', fontSize: 13, marginTop: 0, marginBottom: 12 }}>
              Prefere um botão pronto, com ícone, em vez de um link puro? Cole esse HTML em
              qualquer lugar do seu site — funciona sozinho, sem depender de nenhum CSS ou script
              seu:
            </p>
            <div style={{ marginBottom: 14 }} dangerouslySetInnerHTML={{ __html: waButtonSnippet }} />
            <CopySnippet snippet={waButtonSnippet} />
          </>
        ) : (
          <p style={{ color: '#999', fontSize: 13, margin: 0 }}>
            O número compartilhado de WhatsApp da Zappigo ainda não foi configurado nesta
            instância — assim que estiver, o botão aparece aqui automaticamente.
          </p>
        )}
      </div>

      <div className="dash-card">
        <h3 style={{ fontSize: 15, marginTop: 0, marginBottom: 8 }}>Script do chat</h3>
        <p style={{ color: '#666', fontSize: 13, marginTop: 0, marginBottom: 12 }}>
          Uma linha de <code>&lt;script&gt;</code>, sem mudanças no resto do site — cole antes do
          fechamento de <code>&lt;/body&gt;</code>. Nunca mexeu com isso? Veja abaixo como fazer
          conforme onde seu site foi feito:
        </p>
        <CopySnippet snippet={snippet} />

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <details>
            <summary style={{ cursor: 'pointer', fontSize: 13.5, fontWeight: 600 }}>
              Meu site é WordPress
            </summary>
            <ol style={{ fontSize: 13, color: '#555', lineHeight: 1.7, margin: '10px 0 0', paddingLeft: 20 }}>
              <li>
                No menu do WordPress, instale o plugin gratuito <b>Insert Headers and Footers</b>{' '}
                (Plugins → Adicionar novo → busque pelo nome).
              </li>
              <li>Depois de ativado, vá em Configurações → Insert Headers and Footers.</li>
              <li>Cole o script no campo &quot;Scripts in Footer&quot; e clique em Salvar.</li>
            </ol>
          </details>

          <details>
            <summary style={{ cursor: 'pointer', fontSize: 13.5, fontWeight: 600 }}>
              Meu site é Wix
            </summary>
            <ol style={{ fontSize: 13, color: '#555', lineHeight: 1.7, margin: '10px 0 0', paddingLeft: 20 }}>
              <li>No editor do Wix, vá em Configurações → Custom Code (Código personalizado).</li>
              <li>Clique em &quot;Adicionar código personalizado&quot; e cole o script.</li>
              <li>
                Em &quot;Adicionar código para&quot;, escolha <b>Todas as páginas</b>, e em
                &quot;Posição no código&quot;, escolha <b>Body - end</b>.
              </li>
              <li>Salve e publique o site.</li>
            </ol>
            <p style={{ fontSize: 12.5, color: '#999', margin: '8px 0 0' }}>
              Custom Code só está disponível em planos pagos do Wix — no plano grátis, peça ajuda
              pelo contato abaixo.
            </p>
          </details>

          <details>
            <summary style={{ cursor: 'pointer', fontSize: 13.5, fontWeight: 600 }}>
              Meu site foi feito por uma agência ou freelancer
            </summary>
            <p style={{ fontSize: 13, color: '#555', lineHeight: 1.7, margin: '10px 0 0' }}>
              Encaminhe o script acima pra quem cuida do seu site e peça pra colar logo antes do
              fechamento de <code>&lt;/body&gt;</code> — é uma instrução que qualquer desenvolvedor
              reconhece na hora, geralmente leva menos de 5 minutos.
            </p>
          </details>

          <details>
            <summary style={{ cursor: 'pointer', fontSize: 13.5, fontWeight: 600 }}>
              Meu site é feito no Google Sites ou não sei onde colar
            </summary>
            <p style={{ fontSize: 13, color: '#555', lineHeight: 1.7, margin: '10px 0 0' }}>
              O Google Sites não permite colar scripts personalizados — nesse caso, use o{' '}
              <b>Link direto do WhatsApp</b> ou o <b>Botão do WhatsApp</b> no topo desta página, que
              funcionam em qualquer lugar (Google Sites, Instagram, WhatsApp, onde quiser colar um
              link). Se preferir, escreva pra suporte@zappigo.com.br que a gente ajuda a instalar.
            </p>
          </details>
        </div>
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
