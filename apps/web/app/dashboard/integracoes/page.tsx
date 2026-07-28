import { prisma } from '@zappigo/db';
import { requireSession } from '../../../lib/auth-server';
import { disconnectGoogleCalendar } from './actions';

const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: 'A conexão expirou ou foi iniciada em outra aba — tenta de novo.',
  connect_failed: 'Não foi possível conectar ao Google Calendar agora — tenta de novo em alguns minutos.',
};

export default async function IntegracoesPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { companyId } = await requireSession();
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      googleCalendarId: true,
      googleCalendarRefreshTokenEncrypted: true,
      googleCalendarConnectedEmail: true,
      googleCalendarConnectedAt: true,
    },
  });
  if (!company) return null;

  const { connected, error } = await searchParams;
  const isConnected = !!company.googleCalendarId && !!company.googleCalendarRefreshTokenEncrypted;

  return (
    <>
      <h1 className="dash-h1">Integrações</h1>
      <p className="dash-subtitle">Conecte serviços externos que sua empresa já usa.</p>

      {connected === '1' && (
        <div className="dash-card" style={{ background: '#ecfdf3', borderColor: '#bbf7d0' }}>
          <p style={{ margin: 0, color: '#166534', fontSize: 13.5 }}>Google Calendar conectado com sucesso.</p>
        </div>
      )}
      {error && (
        <div className="dash-card" style={{ background: '#fef2f2', borderColor: '#fecaca' }}>
          <p style={{ margin: 0, color: '#991b1b', fontSize: 13.5 }}>
            {ERROR_MESSAGES[error] ?? 'Não foi possível conectar.'}
          </p>
        </div>
      )}

      <div className="dash-card">
        <h3 style={{ fontSize: 15, marginTop: 0, marginBottom: 8 }}>Google Calendar</h3>
        <p style={{ color: '#666', fontSize: 13, marginTop: 0, marginBottom: 14 }}>
          Conectado, a IA passa a checar seu Google Calendar de verdade antes de oferecer horário
          (evita marcar em cima de um compromisso que só existe lá, não no painel da Zappigo), e
          todo agendamento confirmado pelo assistente aparece automaticamente no seu Calendar.
        </p>

        {isConnected ? (
          <>
            <p style={{ fontSize: 13.5, margin: '0 0 14px' }}>
              Conectado como <strong>{company.googleCalendarConnectedEmail}</strong>
              {company.googleCalendarConnectedAt && (
                <span style={{ color: '#999' }}>
                  {' '}
                  desde {company.googleCalendarConnectedAt.toLocaleDateString('pt-BR')}
                </span>
              )}
              .
            </p>
            <form action={disconnectGoogleCalendar}>
              <button type="submit" className="dash-btn dash-btn-secondary">
                Desconectar
              </button>
            </form>
          </>
        ) : (
          <a href="/api/integrations/google-calendar/authorize" className="dash-btn" style={{ textDecoration: 'none' }}>
            Conectar Google Calendar
          </a>
        )}
      </div>
    </>
  );
}
