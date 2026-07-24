import { notFound } from 'next/navigation';
import { prisma } from '@zappigo/db';
import { requireSuperAdmin } from '../../../../lib/admin-auth';
import { updateUser } from '../actions';
import { UserForm } from '../user-form';

export default async function EditUserPage({ params }: { params: { id: string } }) {
  await requireSuperAdmin();

  const user = await prisma.user.findUnique({ where: { id: params.id } });
  if (!user) notFound();

  return (
    <>
      <h1 className="dash-h1">Editar usuário</h1>
      <div className="dash-card">
        <UserForm
          action={updateUser.bind(null, user.id)}
          email={user.email}
          defaultValues={{ name: user.name, role: user.role }}
        />
      </div>
    </>
  );
}
