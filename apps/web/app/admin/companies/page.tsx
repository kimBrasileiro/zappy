import { prisma } from '@zappy/db';

export default async function AdminCompaniesPage() {
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { users: true, tickets: true } } },
  });

  return (
    <>
      <h1 className="dash-h1">Empresas</h1>
      <p className="dash-subtitle">Todas as empresas cadastradas no sistema.</p>

      <table className="dash-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Slug</th>
            <th>Plano</th>
            <th>Status</th>
            <th>Usuários</th>
            <th>Tickets</th>
            <th>Criada em</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => (
            <tr key={company.id}>
              <td>{company.name}</td>
              <td>{company.slug}</td>
              <td>{company.plan}</td>
              <td>
                <span className={company.status === 'active' ? 'dash-badge dash-badge-in_progress' : 'dash-badge dash-badge-closed'}>
                  {company.status}
                </span>
              </td>
              <td>{company._count.users}</td>
              <td>{company._count.tickets}</td>
              <td>{company.createdAt.toLocaleString('pt-BR')}</td>
            </tr>
          ))}
          {companies.length === 0 && (
            <tr>
              <td colSpan={7} style={{ color: '#999' }}>
                Nenhuma empresa ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
