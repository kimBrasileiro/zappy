'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@zappigo/db';
import { requireSession } from '../../../lib/auth-server';

export async function disconnectGoogleCalendar(): Promise<void> {
  const { companyId } = await requireSession();
  await prisma.company.update({
    where: { id: companyId },
    data: {
      googleCalendarId: null,
      googleCalendarRefreshTokenEncrypted: null,
      googleCalendarConnectedEmail: null,
      googleCalendarConnectedAt: null,
    },
  });
  revalidatePath('/dashboard/integracoes');
}
