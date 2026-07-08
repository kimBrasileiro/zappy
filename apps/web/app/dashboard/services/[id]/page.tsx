import { notFound } from 'next/navigation';
import { prisma } from '@zappy/db';
import { requireSession } from '../../../../lib/auth-server';
import { updateService } from '../actions';
import { ServiceForm, type BusinessHours } from '../service-form';

export default async function EditServicePage({ params }: { params: { id: string } }) {
  const { companyId } = await requireSession();

  const service = await prisma.service.findUnique({ where: { id: params.id } });
  if (!service || service.companyId !== companyId) notFound();

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
          }}
          submitLabel="Salvar alterações"
        />
      </div>
    </>
  );
}
