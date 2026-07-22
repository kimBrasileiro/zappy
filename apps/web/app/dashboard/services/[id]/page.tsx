import { notFound } from 'next/navigation';
import { prisma } from '@zappy/db';
import { requireSession } from '../../../../lib/auth-server';
import { addStaffAbsence, removeStaffAbsence, updateService } from '../actions';
import { ServiceForm, type BusinessHours } from '../service-form';
import { StaffAbsenceForm } from './staff-absence-form';

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default async function EditServicePage({ params }: { params: { id: string } }) {
  const { companyId } = await requireSession();

  const service = await prisma.service.findUnique({ where: { id: params.id } });
  if (!service || service.companyId !== companyId) notFound();

  const absences =
    service.staffNames.length > 0
      ? await prisma.staffAbsence.findMany({
          where: { serviceId: service.id, date: { gte: new Date(new Date().toISOString().slice(0, 10)) } },
          orderBy: { date: 'asc' },
        })
      : [];

  return (
    <>
      <h1 className="dash-h1">Editar serviço</h1>
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
          }}
          submitLabel="Salvar alterações"
        />
      </div>

      {service.staffNames.length > 0 && (
        <div className="dash-card">
          <h3 style={{ fontSize: 14, margin: '0 0 4px' }}>Ausências da equipe</h3>
          <p style={{ fontSize: 12, color: '#777', margin: '0 0 14px', lineHeight: 1.5 }}>
            Marque um dia em que uma pessoa não vai atender (folga, falta, férias). Nesse dia, o
            dashboard e o chat de IA param de oferecer horários com essa pessoa — se ela for a
            única da equipe, o sistema avisa o cliente que não há horário disponível.
          </p>
          <StaffAbsenceForm action={addStaffAbsence.bind(null, service.id)} staffNames={service.staffNames} />

          {absences.length > 0 ? (
            <table className="dash-table" style={{ marginTop: 16 }}>
              <thead>
                <tr>
                  <th>Pessoa</th>
                  <th>Dia</th>
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
                          Remover
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: '#999', fontSize: 13, marginTop: 16 }}>Nenhuma ausência marcada.</p>
          )}
        </div>
      )}
    </>
  );
}
