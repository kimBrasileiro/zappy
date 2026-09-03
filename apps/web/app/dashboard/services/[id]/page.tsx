import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../../../lib/auth-server';
import { addStaffAbsence, removeStaffAbsence, updateService } from '../actions';
import { ServiceForm, type BusinessHours } from '../service-form';
import { StaffAbsenceForm } from './staff-absence-form';

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default async function EditServicePage({ params }: { params: { id: string } }) {
  const { companyId } = await requireSession();
  const t = await getTranslations('dashboard.services');

  const service = await prisma.service.findUnique({ where: { id: params.id } });
  if (!service || service.companyId !== companyId) notFound();

  // Autocomplete suggestions for the staff rows — names already in use on
  // this company's OTHER services (this one's own names are already in the
  // form via defaultValues, no need to duplicate them here).
  const otherServices = await prisma.service.findMany({
    where: { companyId, id: { not: service.id } },
    select: { staffNames: true },
  });
  const existingStaffNames = [...new Set(otherServices.flatMap((s) => s.staffNames))].sort();

  const absences =
    service.staffNames.length > 0
      ? await prisma.staffAbsence.findMany({
          where: { serviceId: service.id, date: { gte: new Date(new Date().toISOString().slice(0, 10)) } },
          orderBy: { date: 'asc' },
        })
      : [];

  return (
    <>
      <h1 className="dash-h1">{t('editTitle')}</h1>
      <div className="dash-card">
        <ServiceForm
          action={updateService.bind(null, service.id)}
          defaultValues={{
            name: service.name,
            description: service.description,
            durationMinutes: service.durationMinutes,
            priceCents: service.priceCents,
            bookingMode: service.bookingMode,
            businessHours: service.businessHours as BusinessHours | null,
            is24h: service.is24h,
            cancellationNoticeHours: service.cancellationNoticeHours,
            cancellationFeeCents: service.cancellationFeeCents,
            staffNames: service.staffNames,
            staffDurations: service.staffDurations as Record<string, number>,
          }}
          existingStaffNames={existingStaffNames}
          submitLabel={t('saveChanges')}
        />
      </div>

      {service.staffNames.length > 0 && (
        <div className="dash-card">
          <h3 style={{ fontSize: 14, margin: '0 0 4px' }}>{t('absencesTitle')}</h3>
          <p style={{ fontSize: 12, color: '#777', margin: '0 0 14px', lineHeight: 1.5 }}>
            {t('absencesBody')}
          </p>
          <StaffAbsenceForm action={addStaffAbsence.bind(null, service.id)} staffNames={service.staffNames} />

          {absences.length > 0 ? (
            <table className="dash-table" style={{ marginTop: 16 }}>
              <thead>
                <tr>
                  <th>{t('tablePerson')}</th>
                  <th>{t('tableDay')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {absences.map((absence) => (
                  <tr key={absence.id}>
                    <td>{absence.staffName}</td>
                    <td>{formatDate(absence.date)}</td>
                    <td>
                      <form action={removeStaffAbsence.bind(null, service.id, absence.id)}>
                        <button type="submit" className="dash-btn dash-btn-danger">
                          {t('remove')}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: '#999', fontSize: 13, marginTop: 16 }}>{t('noAbsences')}</p>
          )}
        </div>
      )}
    </>
  );
}
