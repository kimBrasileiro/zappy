import Link from 'next/link';
import { prisma } from '@zappy/db';
import { requireSuperAdmin } from '../../../lib/admin-auth';
import { toggleUserActive } from './actions';

export default async function AdminUsersPage() {
  const { userId: callerId } = await requireSuperAdmin();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: { company: true },
  });

  return (
    <>
      <h1 className="dash-h1">Usuários</h1>
      <p className="dash-subtitle">Todos os usuários cadastrados no sistema, de todas as empresas.</p>

      <table className="dash-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Nome</th>
            <th>Empresa</th>
            <th>Role</th>
            <th>Status</th>
            <th>Criado em</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.email}</td>
              <td>{user.name}</td>
              <td>{user.company?.name ?? '—'}</td>
              <td>{user.role}</td>
              <td>
                <span className={user.status === 'active' ? 'dash-badge dash-badge-in_progress' : 'dash-badge dash-badge-closed'}>
                  {user.status}
                </span>
              </td>
              <td>{user.createdAt.toLocaleString('pt-BR')}</td>
              <td style={{ display: 'flex', gap: 6 }}>
                <Link href={`/admin/users/${user.id}`} className="dash-btn dash-btn-secondary">
                  Editar
                </Link>
                {user.id !== callerId && (
                  <form action={toggleUserActive.bind(null, user.id)}>
                    <button type="submit" className={user.status === 'active' ? 'dash-btn dash-btn-danger' : 'dash-btn dash-btn-secondary'}>
                      {user.status === 'active' ? 'Desativar' : 'Reativar'}
                    </button>
                  </form>
                )}
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={7} style={{ color: '#999' }}>
                Nenhum usuário ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
