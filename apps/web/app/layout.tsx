import type { ReactNode } from 'react';

export const metadata = {
  title: 'Chat IA',
  description: 'Multi-tenant AI customer support platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
