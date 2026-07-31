import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../../lib/auth-server';
import { CopySnippet } from '../../copy-snippet';
import { DomainsForm } from './domains-form';

const BRAND_COLOR = '#2563eb';
const WHATSAPP_GREEN = '#25D366';
const ICON_WHATSAPP =
  '<svg viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M12 2a10 10 0 0 0-8.66 15L2 22l5.14-1.31A10 10 0 1 0 12 2zm0 18.2a8.16 8.16 0 0 1-4.17-1.14l-.3-.18-3.05.78.82-2.97-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.52-6.13c-.25-.12-1.47-.72-1.7-.81s-.4-.12-.56.12-.63.81-.78.97-.28.19-.53.06a6.7 6.7 0 0 1-1.97-1.22 7.4 7.4 0 0 1-1.36-1.7c-.14-.25 0-.38.11-.5s.25-.29.37-.44a1.6 1.6 0 0 0 .25-.41.46.46 0 0 0 0-.44c-.06-.12-.56-1.35-.77-1.85s-.4-.42-.56-.43h-.48a.9.9 0 0 0-.66.31 2.76 2.76 0 0 0-.86 2.05 4.78 4.78 0 0 0 1 2.54 10.9 10.9 0 0 0 4.19 3.7c.58.25 1.04.4 1.4.51a3.37 3.37 0 0 0 1.54.1 2.52 2.52 0 0 0 1.65-1.16 2 2 0 0 0 .14-1.16c-.06-.1-.22-.16-.47-.28z"/></svg>';

// (11) 97831-4841 instead of the raw +5511978314841 — for anyone reading it
// out loud, printing it, or typing it by hand (Instagram bio, a physical
// sign), not just clicking a pre-filled wa.me link.
function formatWhatsAppNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const match = digits.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return match ? `+55 (${match[1]}) ${match[2]}-${match[3]}` : raw;
}

export default async function InstalacaoPage() {
  const { companyId } = await requireSession();
  const t = await getTranslations('dashboard.installation');
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const whatsappNumber = process.env.WHATSAPP_CLOUD_API_NUMBER;
  const whatsappDigits = whatsappNumber?.replace(/\D/g, '');
  const whatsappGreeting = t('whatsappGreeting', { name: company.name });

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
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(whatsappGreeting)}`
    : null;

  // Self-contained: inline styles + inline SVG icon, no external CSS/JS —
  // has to render correctly dropped into any arbitrary third-party site,
  // the same bar the chat <script> snippet below already meets.
  const waButtonSnippet = waLink
    ? `<a href="${waLink}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:10px;background:${WHATSAPP_GREEN};color:#fff;padding:12px 22px;border-radius:999px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-weight:600;font-size:15px;text-decoration:none;line-height:1;">${ICON_WHATSAPP}${t('whatsappButtonLabel')}</a>`
    : null;

  const homepageLink = `${appUrl}/?company=${company.slug}`;

  const richTags = {
    b: (chunks: ReactNode) => <b>{chunks}</b>,
    code: (chunks: ReactNode) => <code>{chunks}</code>,
  };

  return (
    <>
      <h1 className="dash-h1">{t('title')}</h1>
      <p className="dash-subtitle">
        {t('subtitle')}
      </p>

      <div className="dash-card">
        <h3 style={{ fontSize: 15, marginTop: 0, marginBottom: 8 }}>{t('homepageCardTitle')}</h3>
        <p style={{ color: '#666', fontSize: 13, marginTop: 0, marginBottom: 12 }}>
          {t('homepageCardBody')}
        </p>
        <CopySnippet snippet={homepageLink} />
      </div>

      <div className="dash-card">
        <h3 style={{ fontSize: 15, marginTop: 0, marginBottom: 8 }}>{t('whatsappLinkCardTitle')}</h3>
        {waLink ? (
          <>
            <p style={{ color: '#666', fontSize: 13, marginTop: 0, marginBottom: 12 }}>
              {t('whatsappLinkBody')}
            </p>
            <CopySnippet snippet={waLink} />

            <p style={{ color: '#666', fontSize: 13, margin: '16px 0 6px' }}>
              {t('whatsappNoLinkIntro')}
            </p>
            <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 6px' }}>
              {formatWhatsAppNumber(whatsappNumber ?? '')}
            </p>
            <CopySnippet snippet={whatsappGreeting} />
            <p style={{ color: '#999', fontSize: 12, margin: '8px 0 0' }}>
              {t('whatsappSharedNote')}
            </p>
          </>
        ) : (
          <p style={{ color: '#999', fontSize: 13, margin: 0 }}>
            {t('whatsappNotConfiguredLink')}
          </p>
        )}
      </div>

      <div className="dash-card">
        <h3 style={{ fontSize: 15, marginTop: 0, marginBottom: 8 }}>{t('whatsappButtonCardTitle')}</h3>
        {waButtonSnippet ? (
          <>
            <p style={{ color: '#666', fontSize: 13, marginTop: 0, marginBottom: 12 }}>
              {t('whatsappButtonBody')}
            </p>
            <div style={{ marginBottom: 14 }} dangerouslySetInnerHTML={{ __html: waButtonSnippet }} />
            <CopySnippet snippet={waButtonSnippet} />
          </>
        ) : (
          <p style={{ color: '#999', fontSize: 13, margin: 0 }}>
            {t('whatsappNotConfiguredButton')}
          </p>
        )}
      </div>

      <div className="dash-card">
        <h3 style={{ fontSize: 15, marginTop: 0, marginBottom: 8 }}>{t('chatScriptCardTitle')}</h3>
        <p style={{ color: '#666', fontSize: 13, marginTop: 0, marginBottom: 12 }}>
          {t.rich('chatScriptBody', richTags)}
        </p>
        <CopySnippet snippet={snippet} />

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <details>
            <summary style={{ cursor: 'pointer', fontSize: 13.5, fontWeight: 600 }}>
              {t('wordpressSummary')}
            </summary>
            <ol style={{ fontSize: 13, color: '#555', lineHeight: 1.7, margin: '10px 0 0', paddingLeft: 20 }}>
              <li>{t.rich('wordpressStep1', richTags)}</li>
              <li>{t('wordpressStep2')}</li>
              <li>{t('wordpressStep3')}</li>
            </ol>
          </details>

          <details>
            <summary style={{ cursor: 'pointer', fontSize: 13.5, fontWeight: 600 }}>
              {t('wixSummary')}
            </summary>
            <ol style={{ fontSize: 13, color: '#555', lineHeight: 1.7, margin: '10px 0 0', paddingLeft: 20 }}>
              <li>{t('wixStep1')}</li>
              <li>{t('wixStep2')}</li>
              <li>{t.rich('wixStep3', richTags)}</li>
              <li>{t('wixStep4')}</li>
            </ol>
            <p style={{ fontSize: 12.5, color: '#999', margin: '8px 0 0' }}>
              {t('wixNote')}
            </p>
          </details>

          <details>
            <summary style={{ cursor: 'pointer', fontSize: 13.5, fontWeight: 600 }}>
              {t('agencySummary')}
            </summary>
            <p style={{ fontSize: 13, color: '#555', lineHeight: 1.7, margin: '10px 0 0' }}>
              {t.rich('agencyBody', richTags)}
            </p>
          </details>

          <details>
            <summary style={{ cursor: 'pointer', fontSize: 13.5, fontWeight: 600 }}>
              {t('googleSitesSummary')}
            </summary>
            <p style={{ fontSize: 13, color: '#555', lineHeight: 1.7, margin: '10px 0 0' }}>
              {t.rich('googleSitesBody', richTags)}
            </p>
          </details>
        </div>
      </div>

      <div className="dash-card">
        <h3 style={{ fontSize: 15, marginTop: 0, marginBottom: 8 }}>{t('domainsCardTitle')}</h3>
        <p style={{ color: '#666', fontSize: 13, marginTop: 0, marginBottom: 12 }}>
          {t.rich('domainsBody', richTags)}
        </p>
        <DomainsForm defaultDomains={company.allowedDomains} />
      </div>
    </>
  );
}
