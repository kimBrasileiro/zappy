import type { CSSProperties } from 'react';
import Script from 'next/script';
import { getLocale, getTranslations } from 'next-intl/server';
import { FREE_TIER_MODE } from '../lib/stripe/plans';
import { PRICE_BASICO, PRICE_FREE, PRICING_CURRENCY_CODE } from '../lib/pricing';
import { LocaleSwitcher } from './locale-switcher';

const BRAND_COLOR = '#2563eb';

// Static illustrative copies of booking-panel.tsx's own inputStyle/labelStyle
// (see that file) — this is a non-interactive marketing mockup, not the real
// component (which needs a live company/services from the DB), but it
// should look identical to what a visitor actually gets.
const mockLabelStyle: CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#444',
  marginBottom: 6,
};
const mockInputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #d8dce3',
  fontSize: 14,
  color: '#333',
  boxSizing: 'border-box',
};

const ICON_CHAT = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4h16v12H7l-3 3V4z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
const ICON_WHATSAPP = `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2a10 10 0 0 0-8.66 15L2 22l5.14-1.31A10 10 0 1 0 12 2zm0 18.2a8.16 8.16 0 0 1-4.17-1.14l-.3-.18-3.05.78.82-2.97-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.52-6.13c-.25-.12-1.47-.72-1.7-.81s-.4-.12-.56.12-.63.81-.78.97-.28.19-.53.06a6.7 6.7 0 0 1-1.97-1.22 7.4 7.4 0 0 1-1.36-1.7c-.14-.25 0-.38.11-.5s.25-.29.37-.44a1.6 1.6 0 0 0 .25-.41.46.46 0 0 0 0-.44c-.06-.12-.56-1.35-.77-1.85s-.4-.42-.56-.43h-.48a.9.9 0 0 0-.66.31 2.76 2.76 0 0 0-.86 2.05 4.78 4.78 0 0 0 1 2.54 10.9 10.9 0 0 0 4.19 3.7c.58.25 1.04.4 1.4.51a3.37 3.37 0 0 0 1.54.1 2.52 2.52 0 0 0 1.65-1.16 2 2 0 0 0 .14-1.16c-.06-.1-.22-.16-.47-.28z"/></svg>`;
const ICON_CALENDAR = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const ICON_HEADSET = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 13v-1a8 8 0 0 1 16 0v1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="2" y="13" width="5" height="7" rx="1.5" stroke="currentColor" stroke-width="2"/><rect x="17" y="13" width="5" height="7" rx="1.5" stroke="currentColor" stroke-width="2"/><path d="M19 20v1a2 2 0 0 1-2 2h-3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const ICON_QUESTION = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1" fill="currentColor"/></svg>`;
const ICON_CHECK = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_SYNC = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18 3v4h-4M6 21v-4h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_MIC = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="2" width="6" height="12" rx="3" stroke="currentColor" stroke-width="2"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4M9 22h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const ICON_SCISSORS = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="6" cy="6" r="2.5" stroke="currentColor" stroke-width="2"/><circle cx="6" cy="18" r="2.5" stroke="currentColor" stroke-width="2"/><path d="M20 5 8 13m12 6L8 11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const ICON_PAW = `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><ellipse cx="6.5" cy="10" rx="2" ry="2.6"/><ellipse cx="11" cy="6.5" rx="2" ry="2.6"/><ellipse cx="16" cy="6.5" rx="2" ry="2.6"/><ellipse cx="19.5" cy="10.5" rx="2" ry="2.6"/><path d="M12 12.5c-3.4 0-6.4 2.4-6.4 5.4a3.1 3.1 0 0 0 3.1 3.1c1.1 0 1.7-.4 2.6-.8.5-.2 1-.4 1.7-.4s1.2.2 1.7.4c.9.4 1.5.8 2.6.8a3.1 3.1 0 0 0 3.1-3.1c0-3-3-5.4-6.4-5.4z"/></svg>`;
const ICON_SPARKLE = `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/></svg>`;
const ICON_DROP = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3c4 5 7 8.5 7 12a7 7 0 1 1-14 0c0-3.5 3-7 7-12z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
const ICON_DUMBBELL = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 12h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="4.3" y="8.5" width="3" height="7" rx="1" stroke="currentColor" stroke-width="2"/><rect x="16.7" y="8.5" width="3" height="7" rx="1" stroke="currentColor" stroke-width="2"/><path d="M2.3 10.3v3.4M21.7 10.3v3.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const ICON_CAR = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.5 16v-3.2L5.7 8h12.6l2.2 4.8V16" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M3.5 16h17M5.5 16v2M18.5 16v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="7.3" cy="16" r="1.3" fill="currentColor"/><circle cx="16.7" cy="16" r="1.3" fill="currentColor"/></svg>`;

const FEATURE_ICONS: Record<string, string> = {
  whatsapp: ICON_WHATSAPP,
  chat: ICON_CHAT,
  calendar: ICON_CALENDAR,
  question: ICON_QUESTION,
  headset: ICON_HEADSET,
  googlecalendar: ICON_SYNC,
  audio: ICON_MIC,
};

const NICHE_ICONS: Record<string, string> = {
  scissors: ICON_SCISSORS,
  paw: ICON_PAW,
  sparkle: ICON_SPARKLE,
  drop: ICON_DROP,
  dumbbell: ICON_DUMBBELL,
  car: ICON_CAR,
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
  const tBookingPanel = await getTranslations('bookingPanel');

  const trustItems = t.raw('trustItems') as string[];
  const niches = t.raw('niches.items') as { icon: string; tag: string; headline: string; body: string }[];
  const features = t.raw('features.items') as { icon: string; title: string; body: string }[];
  const planMeta = t.raw('pricing.plans') as { name: string; period: string; items: string[]; cta: string }[];
  const freePlanItems = t.raw('pricing.free.items') as string[];
  const steps = t.raw('howItWorks.steps') as { title: string; body: string }[];
  const faqItems = t.raw('faq.items') as { question: string; answer: string; answerFree?: string; answerPaid?: string }[];
  const demoQuickReplies = (t.raw('demoQuickReplies') as string[]).join('|');
  const chatDemoMessages = t.raw('chatDemo.messages') as { from: 'customer' | 'bot'; text: string; time: string }[];

  // t.raw() bypasses ICU interpolation (it hands back the literal string,
  // placeholders and all) — the "quanto custa" answer's {priceBasico}
  // placeholder needs substituting by hand with the same deployment-config
  // price used in the pricing section above, not a hardcoded translated
  // amount.
  for (const item of faqItems) {
    if (item.answerPaid) {
      item.answerPaid = item.answerPaid.replace('{priceBasico}', PRICE_BASICO);
    }
  }

  // A single plan (see lib/stripe/plans.ts#PLANS) — price is deployment
  // config (lib/pricing.ts), not translated content.
  const planHrefs = ['/signup'];
  const planPrices = [PRICE_BASICO];
  const plans = planMeta.map((plan, i) => ({ ...plan, price: planPrices[i]! }));

  const SOFTWARE_APPLICATION_JSON_LD = jsonLd({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Zappigo',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: FREE_TIER_MODE ? t('faq.jsonLdDescriptionFree') : t('faq.jsonLdDescriptionPaid'),
    offers: FREE_TIER_MODE
      ? [{ '@type': 'Offer', name: t('faq.jsonLdFreeOfferName'), price: '0', priceCurrency: PRICING_CURRENCY_CODE, url: '/signup' }]
      : plans.map((plan, i) => ({
          '@type': 'Offer',
          name: plan.name,
          price: plan.price.replace(/\D/g, ''),
          priceCurrency: PRICING_CURRENCY_CODE,
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
        .marketing-hero-title { font-size: clamp(28px, 6.5vw, 42px); }
        @media (max-width: 720px) {
          .marketing-nav-links { display: none !important; }
          .marketing-header { padding: 14px 16px !important; gap: 8px !important; }
          .marketing-header-buttons { gap: 8px !important; }
          .marketing-header-buttons a { padding: 9px 14px !important; font-size: 13px !important; }
        }
        @media (max-width: 520px) {
          .marketing-hero-section { padding: 52px 16px 60px !important; }
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
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, no need for next/image here */}
          <img src="/zappigo-logo.png" alt="Zappigo" style={{ height: 40, width: 'auto' }} />
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
        className="marketing-hero-section"
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
        <h1 className="marketing-hero-title" style={{ lineHeight: 1.2, margin: '0 auto 16px', maxWidth: 720 }}>
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

      {/* Two ways to book — concrete proof of the hero's claim, right where
          a visitor decides whether to keep reading. Both mockups are real
          markup (the left one matches the dashboard's own dash-bubble chat
          styling, the right one matches booking-panel.tsx's actual inline
          styles almost 1:1) rather than screenshot images, so neither goes
          stale and both stay crisp at any zoom level. */}
      <section style={{ padding: '0 24px 70px', maxWidth: 980, margin: '0 auto' }}>
        <h2 style={{ fontSize: 26, textAlign: 'center', marginBottom: 12 }}>{t('bookingDemo.sectionTitle')}</h2>
        <p style={{ textAlign: 'center', color: '#666', fontSize: 14.5, marginBottom: 40, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
          {t('bookingDemo.sectionSubtitle')}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32, alignItems: 'start' }}>
          <div>
            <div
              style={{
                background: '#e5ded4',
                borderRadius: 20,
                padding: '14px 12px',
                boxShadow: '0 20px 50px rgba(0,0,0,0.12)',
                border: '1px solid rgba(0,0,0,0.06)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: '#075e54',
                  color: '#fff',
                  borderRadius: '12px 12px 0 0',
                  padding: '10px 14px',
                  margin: '-14px -12px 12px',
                }}
              >
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.18)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  Z
                </span>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t('chatDemo.contactName')}</div>
                  <div style={{ fontSize: 11, opacity: 0.85 }}>{t('chatDemo.contactStatus')}</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 2px' }}>
                {chatDemoMessages.map((msg, i) => (
                  <div
                    key={i}
                    style={{
                      alignSelf: msg.from === 'customer' ? 'flex-end' : 'flex-start',
                      maxWidth: '82%',
                      background: msg.from === 'customer' ? '#dcf8c6' : '#fff',
                      borderRadius: 10,
                      padding: '7px 10px',
                      boxShadow: '0 1px 1px rgba(0,0,0,0.08)',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.45, color: '#1a1a1a', whiteSpace: 'pre-line' }}>
                      {msg.text}
                    </p>
                    <div style={{ textAlign: 'right', fontSize: 10, color: '#8696a0', marginTop: 2 }}>{msg.time}</div>
                  </div>
                ))}
              </div>
            </div>
            <p style={{ textAlign: 'center', color: '#888', fontSize: 12.5, marginTop: 14 }}>{t('chatDemo.caption')}</p>
          </div>

          <div>
            <div
              style={{
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 16,
                padding: 22,
                background: '#fff',
                boxShadow: '0 20px 50px rgba(0,0,0,0.12)',
              }}
            >
              <h3 style={{ margin: '0 0 4px', fontSize: 17 }}>{tBookingPanel('title')}</h3>
              <p style={{ color: '#777', fontSize: 12.5, margin: '0 0 18px' }}>{tBookingPanel('subtitle')}</p>

              <div style={{ marginBottom: 14 }}>
                <span style={mockLabelStyle}>{tBookingPanel('serviceLabel')}</span>
                <div style={mockInputStyle}>{t('bookingDemo.mockService')}</div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <span style={mockLabelStyle}>{tBookingPanel('staffLabel')}</span>
                <div style={mockInputStyle}>{t('bookingDemo.mockStaff')}</div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <span style={mockLabelStyle}>{tBookingPanel('dateLabel')}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ ...mockInputStyle, flex: 1 }}>{t('bookingDemo.mockDate')}</div>
                  <span
                    style={{
                      padding: '9px 14px',
                      borderRadius: 8,
                      background: BRAND_COLOR,
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tBookingPanel('checkAvailabilityButton')}
                  </span>
                </div>
              </div>

              {(['morningLabel', 'afternoonLabel'] as const).map((labelKey, groupI) => (
                <div key={labelKey} style={{ marginBottom: groupI === 0 ? 12 : 0 }}>
                  <p style={{ fontSize: 11, color: '#999', margin: '0 0 8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                    {tBookingPanel(labelKey)}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {(groupI === 0 ? ['09:00', '09:30', '10:00', '10:30'] : ['13:00', '13:30', '14:00']).map((slot, i) => {
                      const selected = groupI === 0 && i === 1;
                      return (
                        <span
                          key={slot}
                          style={{
                            padding: '7px 12px',
                            borderRadius: 8,
                            border: `1px solid ${BRAND_COLOR}`,
                            background: selected ? BRAND_COLOR : '#fff',
                            color: selected ? '#fff' : BRAND_COLOR,
                            fontSize: 12.5,
                            fontWeight: 600,
                          }}
                        >
                          {slot}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <p style={{ textAlign: 'center', color: '#888', fontSize: 12.5, marginTop: 14 }}>{t('bookingDemo.caption')}</p>
          </div>
        </div>
      </section>

      {/* Niches — vertical-specific positioning, each card leads to its own
          landing copy angle even though there's no dedicated route yet. */}
      <section id="nicho" style={{ padding: '70px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ fontSize: 26, textAlign: 'center', marginBottom: 12 }}>{t('niches.sectionTitle')}</h2>
        <p style={{ textAlign: 'center', color: '#666', fontSize: 14.5, marginBottom: 40, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
          {t('niches.sectionSubtitle')}
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 20,
          }}
        >
          {niches.map((n) => (
            <div
              key={n.tag}
              style={{
                background: '#fff',
                border: '1px solid rgba(0,0,0,0.06)',
                borderRadius: 16,
                padding: '26px 24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: '#eef2ff',
                  color: BRAND_COLOR,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 14,
                }}
                dangerouslySetInnerHTML={{
                  __html: (NICHE_ICONS[n.icon] ?? ICON_SPARKLE).replace('width="24"', 'width="22"').replace('height="24"', 'height="22"'),
                }}
              />
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: BRAND_COLOR, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {n.tag}
              </span>
              <h3 style={{ fontSize: 17, margin: '0 0 8px', lineHeight: 1.35 }}>{n.headline}</h3>
              <p style={{ fontSize: 13.5, color: '#666', lineHeight: 1.55, margin: 0 }}>{n.body}</p>
            </div>
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
                <span style={{ fontSize: 30, fontWeight: 700 }}>{PRICE_FREE}</span>
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
                {i === 0 && plans.length > 1 && (
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

      {/* key={locale}: a plain prop change on an already-loaded <script
          src> does NOT make Next.js re-execute it — the widget only reads
          data-lang once, synchronously, at initial script execution.
          Changing the key forces React to remove and re-insert the tag
          (see widget/src/index.ts's window.__zappigoWidgetInstance
          teardown for how the previous instance gets cleaned up instead
          of a second widget stacking on the page), so a locale switch on
          this page actually reaches the widget instead of needing a full
          reload. Same pattern app/page.tsx already used (key={companySlug}). */}
      <Script
        key={locale}
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
