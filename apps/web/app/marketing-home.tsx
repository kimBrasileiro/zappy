import Script from 'next/script';
import { getLocale, getTranslations } from 'next-intl/server';
import { FREE_TIER_MODE } from '../lib/stripe/plans';
import { LocaleSwitcher } from './locale-switcher';

const BRAND_COLOR = '#2563eb';

const ICON_CHAT = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4h16v12H7l-3 3V4z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
const ICON_WHATSAPP = `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2a10 10 0 0 0-8.66 15L2 22l5.14-1.31A10 10 0 1 0 12 2zm0 18.2a8.16 8.16 0 0 1-4.17-1.14l-.3-.18-3.05.78.82-2.97-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.52-6.13c-.25-.12-1.47-.72-1.7-.81s-.4-.12-.56.12-.63.81-.78.97-.28.19-.53.06a6.7 6.7 0 0 1-1.97-1.22 7.4 7.4 0 0 1-1.36-1.7c-.14-.25 0-.38.11-.5s.25-.29.37-.44a1.6 1.6 0 0 0 .25-.41.46.46 0 0 0 0-.44c-.06-.12-.56-1.35-.77-1.85s-.4-.42-.56-.43h-.48a.9.9 0 0 0-.66.31 2.76 2.76 0 0 0-.86 2.05 4.78 4.78 0 0 0 1 2.54 10.9 10.9 0 0 0 4.19 3.7c.58.25 1.04.4 1.4.51a3.37 3.37 0 0 0 1.54.1 2.52 2.52 0 0 0 1.65-1.16 2 2 0 0 0 .14-1.16c-.06-.1-.22-.16-.47-.28z"/></svg>`;
const ICON_CALENDAR = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const ICON_HEADSET = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 13v-1a8 8 0 0 1 16 0v1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="2" y="13" width="5" height="7" rx="1.5" stroke="currentColor" stroke-width="2"/><rect x="17" y="13" width="5" height="7" rx="1.5" stroke="currentColor" stroke-width="2"/><path d="M19 20v1a2 2 0 0 1-2 2h-3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const ICON_QUESTION = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1" fill="currentColor"/></svg>`;
const ICON_CHECK = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const FEATURE_ICONS: Record<string, string> = {
  whatsapp: ICON_WHATSAPP,
  chat: ICON_CHAT,
  calendar: ICON_CALENDAR,
  question: ICON_QUESTION,
  headset: ICON_HEADSET,
};

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

// Rich-result eligibility for "sistema de agendamento" / "suporte via
// whatsapp" / pricing searches (SoftwareApplication+offers) and for the FAQ
// section above (FAQPage) — escaping `<` defensively even though every
// input here is our own copy, not user data, so a stray `</script>`
// substring can never prematurely close this tag.
function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export async function MarketingHome() {
  const whatsappNumber = process.env.WHATSAPP_CLOUD_API_NUMBER;
  const locale = await getLocale();
  const t = await getTranslations('marketing');

  const trustItems = t.raw('trustItems') as string[];
  const features = t.raw('features.items') as { icon: string; title: string; body: string }[];
  const plans = t.raw('pricing.plans') as { name: string; price: string; period: string; items: string[]; cta: string }[];
  const freePlanItems = t.raw('pricing.free.items') as string[];
  const steps = t.raw('howItWorks.steps') as { title: string; body: string }[];
  const faqItems = t.raw('faq.items') as { question: string; answer: string; answerFree?: string; answerPaid?: string }[];
  const demoQuickReplies = (t.raw('demoQuickReplies') as string[]).join('|');

  const planHrefs = ['/signup', '/signup', '/signup'];

  const SOFTWARE_APPLICATION_JSON_LD = jsonLd({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Zappigo',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: FREE_TIER_MODE ? t('faq.jsonLdDescriptionFree') : t('faq.jsonLdDescriptionPaid'),
    offers: FREE_TIER_MODE
      ? [{ '@type': 'Offer', name: t('faq.jsonLdFreeOfferName'), price: '0', priceCurrency: 'BRL', url: '/signup' }]
      : plans.map((plan, i) => ({
          '@type': 'Offer',
          name: plan.name,
          price: plan.price.replace(/\D/g, ''),
          priceCurrency: 'BRL',
          url: planHrefs[i],
        })),
  });

  const FAQ_JSON_LD = jsonLd({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answerFree !== undefined ? (FREE_TIER_MODE ? item.answerFree : item.answerPaid) : item.answer },
    })),
  });

  return (
    <main
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
        color: '#1a1a1a',
      }}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: SOFTWARE_APPLICATION_JSON_LD }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: FAQ_JSON_LD }} />

      <style>{`
        @media (max-width: 720px) {
          .marketing-nav-links { display: none !important; }
          .marketing-header { padding: 14px 16px !important; gap: 8px !important; }
          .marketing-header-buttons { gap: 8px !important; }
          .marketing-header-buttons a { padding: 9px 14px !important; font-size: 13px !important; }
        }
      `}</style>
      <header
        className="marketing-header"
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
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
              flexShrink: 0,
            }}
            dangerouslySetInnerHTML={{
              __html: ICON_CHAT.replace('width="24"', 'width="17"').replace('height="24"', 'height="17"'),
            }}
          />
          <span style={{ fontWeight: 700, fontSize: 16 }}>Zappigo</span>
        </div>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <div className="marketing-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            <a href="#recursos" style={{ color: '#555', fontSize: 13.5, textDecoration: 'none' }}>
              {t('nav.resources')}
            </a>
            <a href="#precos" style={{ color: '#555', fontSize: 13.5, textDecoration: 'none' }}>
              {t('nav.pricing')}
            </a>
            <a href="#como-funciona" style={{ color: '#555', fontSize: 13.5, textDecoration: 'none' }}>
              {t('nav.howItWorks')}
            </a>
            <a href="#faq" style={{ color: '#555', fontSize: 13.5, textDecoration: 'none' }}>
              {t('nav.faq')}
            </a>
          </div>
          <LocaleSwitcher />
          <div className="marketing-header-buttons" style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <Button href="/login" variant="secondary">
              {t('nav.login')}
            </Button>
            <Button href="/signup">{t('nav.start')}</Button>
          </div>
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
          {FREE_TIER_MODE ? t('hero.badgeFree') : t('hero.badgePaid')}
        </span>
        <h1 style={{ fontSize: 42, lineHeight: 1.2, margin: '0 auto 16px', maxWidth: 720 }}>
          {FREE_TIER_MODE ? t('hero.titleFree') : t('hero.titlePaid')}
        </h1>
        <p style={{ fontSize: 16.5, color: '#555', maxWidth: 600, margin: '0 auto 32px', lineHeight: 1.6 }}>
          {FREE_TIER_MODE ? t('hero.descriptionFree') : t('hero.descriptionPaid')}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 36 }}>
          <Button href="/signup">{t('hero.start')}</Button>
          <Button href="#assistente" variant="secondary">
            {t('hero.talkToAssistant')}
          </Button>
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px 28px',
            justifyContent: 'center',
            maxWidth: 720,
            margin: '0 auto',
          }}
        >
          {trustItems.map((item) => (
            <span
              key={item}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#555' }}
            >
              <span
                style={{ color: BRAND_COLOR, flexShrink: 0, width: 15, height: 15 }}
                dangerouslySetInnerHTML={{ __html: ICON_CHECK }}
              />
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="recursos" style={{ padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ fontSize: 28, textAlign: 'center', marginBottom: 48 }}>{t('features.sectionTitle')}</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: 20,
          }}
        >
          {features.map((f) => (
            <div
              key={f.title}
              style={{
                background: '#fff',
                border: '1px solid rgba(0,0,0,0.06)',
                borderRadius: 16,
                padding: '28px 20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                textAlign: 'center',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: '#eef2ff',
                  color: BRAND_COLOR,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 14,
                }}
                dangerouslySetInnerHTML={{
                  __html: (FEATURE_ICONS[f.icon] ?? ICON_CHAT).replace('width="24"', 'width="26"').replace('height="24"', 'height="26"'),
                }}
              />
              <h3 style={{ fontSize: 15, margin: '0 0 6px' }}>{f.title}</h3>
              <p style={{ fontSize: 12.5, color: '#666', lineHeight: 1.5, margin: 0 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="precos" style={{ padding: '80px 24px', background: '#f8f9fb' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, textAlign: 'center', marginBottom: 12 }}>
            {FREE_TIER_MODE ? t('pricing.sectionTitleFree') : t('pricing.sectionTitle')}
          </h2>
          <p style={{ textAlign: 'center', color: '#666', fontSize: 14.5, marginBottom: 48 }}>
            {FREE_TIER_MODE ? t('pricing.sectionSubtitleFree') : t('pricing.sectionSubtitle')}
          </p>

          {FREE_TIER_MODE ? (
            <div
              style={{
                maxWidth: 420,
                margin: '0 auto',
                background: '#fff',
                borderRadius: 16,
                padding: 32,
                border: `2px solid ${BRAND_COLOR}`,
                boxShadow: '0 8px 24px rgba(37,99,235,0.12)',
                textAlign: 'center',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  background: BRAND_COLOR,
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '3px 10px',
                  borderRadius: 999,
                  marginBottom: 14,
                }}
              >
                {t('pricing.free.badge')}
              </span>
              <h3 style={{ fontSize: 17, margin: '0 0 6px' }}>{t('pricing.free.title')}</h3>
              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 30, fontWeight: 700 }}>{t('pricing.free.price')}</span>
                <span style={{ fontSize: 13.5, color: '#888' }}> {t('pricing.free.period')}</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', textAlign: 'left' }}>
                {freePlanItems.map((item) => (
                  <li key={item} style={{ display: 'flex', gap: 8, fontSize: 13.5, color: '#444', marginBottom: 10 }}>
                    <span
                      style={{ color: BRAND_COLOR, flexShrink: 0, width: 16, height: 16, marginTop: 1 }}
                      dangerouslySetInnerHTML={{ __html: ICON_CHECK }}
                    />
                    {item}
                  </li>
                ))}
              </ul>
              <Button href="/signup" variant="primary">
                {t('pricing.free.cta')}
              </Button>
            </div>
          ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 24,
              alignItems: 'stretch',
            }}
          >
            {plans.map((plan, i) => (
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
                {i === 0 && (
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
                    {t('pricing.mostPopular')}
                  </span>
                )}
                <h3 style={{ fontSize: 17, margin: '0 0 6px' }}>{plan.name}</h3>
                <div style={{ marginBottom: 20 }}>
                  <span style={{ fontSize: i === 0 ? 30 : 20, fontWeight: 700 }}>{plan.price}</span>
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
                <Button href={planHrefs[i] ?? '/signup'} variant="primary">
                  {plan.cta}
                </Button>
              </div>
            ))}
          </div>
          )}
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" style={{ padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ fontSize: 28, textAlign: 'center', marginBottom: 12 }}>{t('howItWorks.sectionTitle')}</h2>
        <p style={{ textAlign: 'center', color: '#666', fontSize: 14.5, marginBottom: 48 }}>
          {t('howItWorks.sectionSubtitle')}
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 28,
          }}
        >
          {steps.map((step, i) => (
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
      </section>

      {/* FAQ — real, crawlable Q&A content (also emitted as FAQPage JSON-LD
          above), not just something buried inside the live chat widget. */}
      <section id="faq" style={{ padding: '80px 24px', background: '#f8f9fb' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, textAlign: 'center', marginBottom: 12 }}>{t('faq.sectionTitle')}</h2>
          <p style={{ textAlign: 'center', color: '#666', fontSize: 14.5, marginBottom: 40 }}>
            {t('faq.sectionSubtitle')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {faqItems.map((item) => (
              <details
                key={item.question}
                style={{
                  background: '#fff',
                  borderRadius: 12,
                  border: '1px solid rgba(0,0,0,0.06)',
                  padding: '16px 20px',
                }}
              >
                <summary style={{ fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>{item.question}</summary>
                <p style={{ fontSize: 13.5, color: '#555', lineHeight: 1.7, margin: '10px 0 0' }}>
                  {item.answerFree !== undefined ? (FREE_TIER_MODE ? item.answerFree : item.answerPaid) : item.answer}
                </p>
              </details>
            ))}
          </div>
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
        <h2 style={{ fontSize: 26, margin: '0 0 12px' }}>{t('chatCta.title')}</h2>
        <p style={{ fontSize: 14.5, opacity: 0.9, maxWidth: 480, margin: '0 auto' }}>{t('chatCta.body')}</p>
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
        © {new Date().getFullYear()} Zappigo · <a href="/login" style={{ color: '#999' }}>{t('footer.login')}</a> ·{' '}
        <a href="/signup" style={{ color: '#999' }}>{t('footer.signup')}</a> ·{' '}
        <a href="/terms" style={{ color: '#999' }}>{t('footer.terms')}</a> ·{' '}
        <a href="/privacy" style={{ color: '#999' }}>{t('footer.privacy')}</a>
      </footer>

      <Script
        src="/widget.js"
        strategy="afterInteractive"
        data-company="zappigo"
        data-company-name="Zappigo"
        data-color={BRAND_COLOR}
        data-whatsapp={whatsappNumber}
        data-quick-replies={demoQuickReplies}
        data-lang={locale}
      />
    </main>
  );
}
