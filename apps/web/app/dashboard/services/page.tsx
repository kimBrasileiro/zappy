import Link from 'next/link';
import { prisma } from '@zappy/db';
import { requireSession } from '../../../lib/auth-server';
import { createService, deleteService, toggleServiceActive } from './actions';
import { ServiceForm } from './service-form';
import { RefreshButton } from '../refresh-button';

function formatDuration(minutes: number): string {
  if (minutes % 60 === 0 && minutes >= 60) return `${minutes / 60}h`;
  return `${minutes} min`;
}

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default async function ServicesPage() {
  const { companyId } = await requireSession();

  const services = await prisma.service.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <>
      <div className="dash-toolbar">
        <div>
          <h1 className="dash-h1">Serviços</h1>
          <p className="dash-subtitle" style={{ marginBottom: 0 }}>
            Serviços que os clientes podem agendar pelo chat — duração e preço aparecem pro bot na
            hora de oferecer horários.
          </p>
        </div>
        <RefreshButton />
      </div>

      <div className="dash-card">
        <ServiceForm action={createService} submitLabel="Criar serviço" />
      </div>

      <table className="dash-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Duração</th>
            <th>Preço</th>
            <th>Agendamento</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {services.map((service) => (
            <tr key={service.id}>
              <td>
                <Link href={`/dashboard/services/${service.id}`}>{service.name}</Link>
                {service.is24h && (
                  <span className="dash-badge dash-badge-in_progress" style={{ marginLeft: 8 }}>
                    24h
                  </span>
                )}
              </td>
              <td>{formatDuration(service.durationMinutes)}</td>
              <td>{formatPrice(service.priceCents)}</td>
              <td>{service.bookingMode === 'manual' ? 'Pré-agendamento' : 'Automático'}</td>
              <td>
                <span className={service.active ? 'dash-badge dash-badge-in_progress' : 'dash-badge dash-badge-closed'}>
                  {service.active ? 'ativo' : 'inativo'}
                </span>
              </td>
              <td style={{ display: 'flex', gap: 6 }}>
                <form action={toggleServiceActive.bind(null, service.id)}>
                  <button type="submit" className="dash-btn dash-btn-secondary">
                    {service.active ? 'Desativar' : 'Ativar'}
                  </button>
                </form>
                <form action={deleteService.bind(null, service.id)}>
                  <button type="submit" className="dash-btn dash-btn-danger">
                    Excluir
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {services.length === 0 && (
            <tr>
              <td colSpan={6} style={{ color: '#999' }}>
                Nenhum serviço ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
