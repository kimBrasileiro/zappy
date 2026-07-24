'use server';

import { prisma } from '@zappigo/db';
import { requireSession } from '../../../lib/auth-server';
import { sendEmail } from '../../../lib/email/resend';
import { SUPER_ADMIN_EMAIL } from '../../../lib/admin-auth';

export interface SupportFormState {
  error?: string;
  sent?: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  bug: 'Bug / problema técnico',
  duvida: 'Dúvida',
  sugestao: 'Sugestão',
  outro: 'Outro',
};

export async function sendSupportMessage(
  _prevState: SupportFormState,
  formData: FormData,
): Promise<SupportFormState> {
  const { companyId, userId } = await requireSession();

  const category = String(formData.get('category') ?? 'outro');
  const message = String(formData.get('message') ?? '').trim();
  if (!message) return { error: 'Escreve uma mensagem antes de enviar.' };

  const [company, user] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { name: true, slug: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
  ]);

  await sendEmail(
    SUPER_ADMIN_EMAIL,
    `[Zappigo] ${CATEGORY_LABELS[category] ?? 'Contato'} — ${company?.name ?? companyId}`,
    `<p><strong>Empresa:</strong> ${company?.name ?? '—'} (${company?.slug ?? companyId})</p>` +
      `<p><strong>De:</strong> ${user?.name ?? '—'} (${user?.email ?? '—'})</p>` +
      `<p><strong>Categoria:</strong> ${CATEGORY_LABELS[category] ?? category}</p>` +
      `<p><strong>Mensagem:</strong></p><p>${message.replace(/\n/g, '<br>')}</p>`,
  );

  return { sent: true };
}
