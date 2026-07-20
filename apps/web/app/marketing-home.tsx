import Script from 'next/script';
import { CopySnippet } from './copy-snippet';

const BRAND_COLOR = '#2563eb';

// Overrides the widget's generic defaults (apps/widget/src/quick-replies.ts
// assumes a service business booking appointments) — same 3 flows
// (FAQ/booking/escalação), reworded for a SaaS sales chat.
const ZAPPY_QUICK_REPLIES = [
  'Quais planos e preços vocês têm?',
  'Quero agendar uma demo',
  'Como funciona a Zappy?',
  'Falar com o time comercial',
].join('|');

const ICON_CHAT = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4h16v12H7l-3 3V4z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
const ICON_WHATSAPP = `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2a10 10 0 0 0-8.66 15L2 22l5.14-1.31A10 10 0 1 0 12 2zm0 18.2a8.16 8.16 0 0 1-4.17-1.14l-.3-.18-3.05.78.82-2.97-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.52-6.13c-.25-.12-1.47-.72-1.7-.81s-.4-.12-.56.12-.63.81-.78.97-.28.19-.53.06a6.7 6.7 0 0 1-1.97-1.22 7.4 7.4 0 0 1-1.36-1.7c-.14-.25 0-.38.11-.5s.25-.29.37-.44a1.6 1.6 0 0 0 .25-.41.46.46 0 0 0 0-.44c-.06-.12-.56-1.35-.77-1.85s-.4-.42-.56-.43h-.48a.9.9 0 0 0-.66.31 2.76 2.76 0 0 0-.86 2.05 4.78 4.78 0 0 0 1 2.54 10.9 10.9 0 0 0 4.19 3.7c.58.25 1.04.4 1.4.51a3.37 3.37 0 0 0 1.54.1 2.52 2.52 0 0 0 1.65-1.16 2 2 0 0 0 .14-1.16c-.06-.1-.22-.16-.47-.28z"/></svg>`;
const ICON_CALENDAR = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const ICON_HEADSET = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 13v-1a8 8 0 0 1 16 0v1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="2" y="13" width="5" height="7" rx="1.5" stroke="currentColor" stroke-width="2"/><rect x="17" y="13" width="5" height="7" rx="1.5" stroke="currentColor" stroke-width="2"/><path d="M19 20v1a2 2 0 0 1-2 2h-3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const ICON_QUESTION = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1" fill="currentColor"/></svg>`;
const ICON_CHECK = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_LINK = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 15l6-6M10 6l.7-.7a4 4 0 0 1 5.66 5.66l-.7.7M14 18l-.7.7a4 4 0 0 1-5.66-5.66l.7-.7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_SLIDERS = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 6h10M4 12h6M4 18h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="17" cy="6" r="2" stroke="currentColor" stroke-width="2"/><circle cx="13" cy="12" r="2" stroke="currentColor" stroke-width="2"/><circle cx="19" cy="18" r="2" stroke="currentColor" stroke-width="2"/></svg>`;

const FEATURES = [
  {
    icon: ICON_CHAT,
    title: 'Chat no seu site',
    body: 'Uma linha de script e seu site ganha um assistente que conversa em português, direto no Shadow DOM — não interfere no seu CSS ou JS.',
  },
  {
    icon: ICON_WHATSAPP,
    title: 'WhatsApp nativo',
    body: 'Todo plano já inclui um número de WhatsApp compartilhado da Zappy — o mesmo bot que atende no site atende por lá também.',
  },
  {
    icon: ICON_CALENDAR,
    title: 'Agendamento automático',
    body: 'Cadastre seus serviços com duração e preço; o bot confirma horários de verdade com o cliente, respeitando o funcionamento da sua empresa.',
  },
  {
    icon: ICON_HEADSET,
    title: 'Handoff pra humano',
    body: 'Quando o bot não sabe responder, a conversa cai direto no Inbox do seu dashboard — sem o cliente precisar pedir duas vezes.',
  },
  {
    icon: ICON_QUESTION,
    title: 'FAQ automático',
    body: 'Cadastre as perguntas que você já responde todo dia. O bot mostra como botões clicáveis, sem inventar respostas.',
  },
  {
    icon: ICON_LINK,
    title: 'Conecta com seus sistemas',
    body: 'Já usa um sistema de agendamento ou CRM? A gente conecta a Zappy com o que você já tem, sem precisar trocar de ferramenta.',
  },
  {
    icon: ICON_SLIDERS,
    title: 'WhatsApp com número próprio',
    body: 'Quer um número de WhatsApp exclusivo da sua empresa? Nossa equipe de tecnologia cuida do onboarding personalizado, do início ao fim.',
  },
];

const PRICING = [
  {
    name: 'Básico',
    price: 'R$ 197',
    period: '/mês',
    highlight: true,
    items: [
      'Dashboard de agendamentos, conversas e FAQ',
      'Widget de chat no seu site',
      'Número de WhatsApp compartilhado da Zappy',
      'Handoff pra atendimento humano',
    ],
    cta: { label: 'Começar agora', href: '/signup' },
  },
  {
    name: 'WhatsApp próprio',
    price: 'R$ 397',
    period: '/mês',
    highlight: false,
    items: [
      'Tudo do plano Básico',
      'Número de WhatsApp exclusivo da sua empresa',
      'Onboarding assistido pelo nosso time',
    ],
    cta: { label: 'Começar agora', href: '/signup' },
  },
  {
    name: 'Integração com seu sistema',
    price: 'R$ 997',
    period: '/mês',
    highlight: false,
    items: [
      'Tudo do plano Básico',
      'Conecta com o sistema de agendamento que você já usa',
      'Sem trocar de ferramenta pro seu time',
    ],
    cta: { label: 'Começar agora', href: '/signup' },
  },
];

const STEPS = [
  { title: 'Cadastre sua empresa', body: 'Leva menos de dois minutos — sem cartão, sem burocracia.' },
  { title: 'Configure serviços e FAQ', body: 'Cadastre o que você vende e as perguntas que já responde todo dia.' },
  { title: 'Cole o script no seu site', body: 'Uma linha de código e o chat (e o WhatsApp) já estão no ar.' },
];

function Button({
  href,
  children,
  variant = 'primary',
}: {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}) {
  const isPrimary = variant === 'primary';
  return (
    <a
      href={href}
      style={{
        display: 'inline-block',
        padding: '11px 22px',
        borderRadius: 10,
        fontSize: 14.5,
        fontWeight: 600,
        textDecoration: 'none',
        background: isPrimary ? BRAND_COLOR : '#fff',
        color: isPrimary ? '#fff' : '#1a1a1a',
        border: isPrimary ? 'none' : '1px solid rgba(0,0,0,0.12)',
      }}
    >
      {children}
    </a>
  );
}

export async function MarketingHome() {
  const whatsappNumber = process.env.WHATSAPP_CLOUD_API_NUMBER;
  const installSnippet = [
    `<script src="https://cdn.seudominio.com/widget.js"`,
    `        data-company="sua-empresa"`,
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
        color: '#1a1a1a',
      }}
    >
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '16px 24px',
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(6px)',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
            dangerouslySetInnerHTML={{
              __html: ICON_CHAT.replace('width="24"', 'width="17"').replace('height="24"', 'height="17"'),
            }}
          />
          <span style={{ fontWeight: 700, fontSize: 16 }}>Zappy</span>
        </div>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <a href="#recursos" style={{ color: '#555', fontSize: 13.5, textDecoration: 'none' }}>
            Recursos
          </a>
          <a href="#precos" style={{ color: '#555', fontSize: 13.5, textDecoration: 'none' }}>
            Preços
          </a>
          <a href="#instalacao" style={{ color: '#555', fontSize: 13.5, textDecoration: 'none' }}>
            Como instalar
          </a>
          <Button href="/login" variant="secondary">
            Entrar
          </Button>
          <Button href="/signup">Começar agora</Button>
        </nav>
      </header>

      {/* Hero */}
      <section
        style={{
          background: 'linear-gradient(180deg, #f5f7ff 0%, #ffffff 100%)',
          padding: '80px 24px 90px',
          textAlign: 'center',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            background: '#eef2ff',
            color: BRAND_COLOR,
            fontSize: 12.5,
            fontWeight: 600,
            padding: '5px 12px',
            borderRadius: 999,
            marginBottom: 20,
          }}
        >
          Atendimento via IA para o seu negócio
        </span>
        <h1 style={{ fontSize: 42, lineHeight: 1.2, margin: '0 auto 16px', maxWidth: 720 }}>
          Um assistente que atende, tira dúvidas e agenda por você — no site e no WhatsApp
        </h1>
        <p style={{ fontSize: 16.5, color: '#555', maxWidth: 600, margin: '0 auto 32px', lineHeight: 1.6 }}>
          A Zappy conversa com seus clientes o dia todo, responde o que você já ensinou pra ela e
          agenda horários de verdade. Quando ela não souber algo, um humano do seu time assume a
          conversa, sem enrolação.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Button href="/signup">Começar agora</Button>
          <Button href="#assistente" variant="secondary">
            Conversar com o assistente
          </Button>
        </div>
      </section>

      {/* Features */}
      <section id="recursos" style={{ padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ fontSize: 28, textAlign: 'center', marginBottom: 48 }}>Tudo que seu atendimento precisa</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 24,
          }}
        >
          {FEATURES.map((f) => (
            <div
              key={f.title}
              style={{
                background: '#fff',
                border: '1px solid rgba(0,0,0,0.06)',
                borderRadius: 16,
                padding: 24,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: '#eef2ff',
                  color: BRAND_COLOR,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 14,
                }}
                dangerouslySetInnerHTML={{
                  __html: f.icon.replace('width="24"', 'width="19"').replace('height="24"', 'height="19"'),
                }}
              />
              <h3 style={{ fontSize: 16, margin: '0 0 8px' }}>{f.title}</h3>
              <p style={{ fontSize: 13.5, color: '#666', lineHeight: 1.6, margin: 0 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="precos" style={{ padding: '80px 24px', background: '#f8f9fb' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, textAlign: 'center', marginBottom: 12 }}>Planos</h2>
          <p style={{ textAlign: 'center', color: '#666', fontSize: 14.5, marginBottom: 48 }}>
            Comece com o plano básico e fale com a gente se precisar de algo sob medida.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 24,
              alignItems: 'stretch',
            }}
          >
            {PRICING.map((plan) => (
              <div
                key={plan.name}
                style={{
                  background: '#fff',
                  borderRadius: 16,
                  padding: 28,
                  border: `2px solid ${BRAND_COLOR}`,
                  boxShadow: '0 8px 24px rgba(37,99,235,0.12)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {plan.highlight && (
                  <span
                    style={{
                      alignSelf: 'flex-start',
                      background: BRAND_COLOR,
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '3px 10px',
                      borderRadius: 999,
                      marginBottom: 14,
                    }}
                  >
                    Mais popular
                  </span>
                )}
                <h3 style={{ fontSize: 17, margin: '0 0 6px' }}>{plan.name}</h3>
                <div style={{ marginBottom: 20 }}>
                  <span style={{ fontSize: plan.highlight ? 30 : 20, fontWeight: 700 }}>{plan.price}</span>
                  <span style={{ fontSize: 13.5, color: '#888' }}>{plan.period}</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', flex: 1 }}>
                  {plan.items.map((item) => (
                    <li
                      key={item}
                      style={{ display: 'flex', gap: 8, fontSize: 13.5, color: '#444', marginBottom: 10 }}
                    >
                      <span
                        style={{ color: BRAND_COLOR, flexShrink: 0, width: 16, height: 16, marginTop: 1 }}
                        dangerouslySetInnerHTML={{ __html: ICON_CHECK }}
                      />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button href={plan.cta.href} variant="primary">
                  {plan.cta.label}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Install */}
      <section id="instalacao" style={{ padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ fontSize: 28, textAlign: 'center', marginBottom: 48 }}>Como funciona</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 28,
            marginBottom: 40,
          }}
        >
          {STEPS.map((step, i) => (
            <div key={step.title}>
              <span
                style={{
                  display: 'inline-flex',
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: BRAND_COLOR,
                  color: '#fff',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  marginBottom: 12,
                }}
              >
                {i + 1}
              </span>
              <h3 style={{ fontSize: 15.5, margin: '0 0 6px' }}>{step.title}</h3>
              <p style={{ fontSize: 13.5, color: '#666', lineHeight: 1.6, margin: 0 }}>{step.body}</p>
            </div>
          ))}
        </div>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <p style={{ fontSize: 12.5, color: '#888', textAlign: 'center', marginBottom: 10 }}>
            Depois de cadastrar sua empresa, seu script fica pronto em <code>/dashboard/instalacao</code> — este aqui é só um exemplo:
          </p>
          <CopySnippet snippet={installSnippet} />
        </div>
      </section>

      {/* Chat CTA */}
      <section
        id="assistente"
        style={{
          padding: '70px 24px',
          background: `linear-gradient(135deg, ${BRAND_COLOR} 0%, #1e40af 100%)`,
          color: '#fff',
          textAlign: 'center',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'rgba(255,255,255,0.15)',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
          }}
          dangerouslySetInnerHTML={{ __html: ICON_WHATSAPP }}
        />
        <h2 style={{ fontSize: 26, margin: '0 0 12px' }}>Fale com o nosso assistente agora</h2>
        <p style={{ fontSize: 14.5, opacity: 0.9, maxWidth: 480, margin: '0 auto' }}>
          Clique no botão de chat no canto inferior direito — ele responde dúvidas sobre a Zappy e
          já agenda uma demonstração com o nosso time, no próprio site ou pelo WhatsApp.
        </p>
      </section>

      <footer
        style={{
          padding: '28px 24px',
          textAlign: 'center',
          fontSize: 12.5,
          color: '#999',
          borderTop: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        © {new Date().getFullYear()} Zappy · <a href="/login" style={{ color: '#999' }}>Entrar</a> ·{' '}
        <a href="/signup" style={{ color: '#999' }}>Criar conta</a>
      </footer>

      <Script
        src="/widget.js"
        strategy="afterInteractive"
        data-company="zappy"
        data-color={BRAND_COLOR}
        data-whatsapp={whatsappNumber}
        data-quick-replies={ZAPPY_QUICK_REPLIES}
      />
    </main>
  );
}
