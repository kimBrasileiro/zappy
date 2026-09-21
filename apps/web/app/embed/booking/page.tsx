import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';
import { BookingPanel } from '../../booking-panel';
import { ClassBookingPanel } from '../../class-booking-panel';
import { isSportsCompany } from '../../../lib/modality';
import { listServices } from '../../../lib/bot/services';
import { getDeploymentTimezone, toWallClock } from '../../../lib/format-time';
import { PRICING_CURRENCY_CODE } from '../../../lib/pricing';
import { ResizeReporter } from './resize-reporter';

export const metadata: Metadata = { robots: { index: false, follow: false } };

type PageProps = { searchParams: { company?: string } };

// Just the booking form, no header/logo/hero — meant to sit inside an
// <iframe> on a customer's OWN site (see dashboard/instalacao's generated
// embed snippet), not to be visited directly. next.config.mjs carves out
// a `frame-ancestors *` exception for /embed/:path* specifically so this
// route (unlike every other page here) can be framed cross-origin.
export default async function BookingEmbedPage({ searchParams }: PageProps) {
  const companySlug = searchParams.company?.trim();
  const t = await getTranslations('companyHomepage');
  const locale = await getLocale();

  const company = companySlug ? await prisma.company.findUnique({ where: { slug: companySlug } }) : null;

  if (!company) {
    return (
      <main style={{ fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif', padding: 24, textAlign: 'center' }}>
        <p style={{ color: '#b91c1c', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
          {t.rich('notFoundBody', { code: (chunks) => <code>{chunks}</code>, slug: companySlug ?? '' })}
        </p>
        <ResizeReporter />
      </main>
    );
  }

  const services = await listServices(company.id);
  const todayLocal = toWallClock(getDeploymentTimezone(), new Date());
  const minDate = `${todayLocal.year}-${String(todayLocal.month0 + 1).padStart(2, '0')}-${String(todayLocal.day).padStart(2, '0')}`;

  return (
    <main style={{ fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif', padding: '4px', background: 'transparent' }}>
      {isSportsCompany(company) ? (
        <ClassBookingPanel companySlug={company.slug} minDate={minDate} locale={locale} currencyCode={PRICING_CURRENCY_CODE} />
      ) : (
        <BookingPanel
          companySlug={company.slug}
          services={services}
          minDate={minDate}
          locale={locale}
          currencyCode={PRICING_CURRENCY_CODE}
        />
      )}
      <ResizeReporter />
    </main>
  );
}
