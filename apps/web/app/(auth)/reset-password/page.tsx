import { Suspense } from 'react';
import { ResetPasswordForm } from './reset-password-form';

// useSearchParams() (reading the token better-auth's own email-link redirect
// appends — see lib/auth.ts#sendResetPassword) needs a Suspense boundary or
// `next build` fails to statically render this otherwise-static public page.
export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
