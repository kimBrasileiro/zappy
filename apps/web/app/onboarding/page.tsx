import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '../../lib/auth';
import { authStyles as s } from '../(auth)/auth-styles';
import { OnboardingForm } from './onboarding-form';

export default async function OnboardingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  const user = session.user as typeof session.user & { companyId: string | null };
  if (user.companyId) redirect('/dashboard');

  return (
    <main style={s.main}>
      <OnboardingForm />
    </main>
  );
}
