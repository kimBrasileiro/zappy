'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

// Debounced so typing doesn't trigger a server round-trip (and the 5s
// AutoRefresh's router.refresh()) on every keystroke — updates the `q` URL
// param, which the page's own Prisma query reads server-side. Composes
// cleanly with AutoRefresh since that just re-renders whatever the current
// URL already is, search included.
export function SearchInput({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get('q') ?? '');
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) params.set('q', value.trim());
      else params.delete('q');
      router.push(`${pathname}?${params.toString()}`);
    }, 300);
    return () => clearTimeout(timeoutRef.current);
    // Only re-run when the input value itself changes — router/pathname/
    // searchParams are stable-enough Next.js references that including
    // them would just re-fire this on every navigation this effect causes.
  }, [value]);

  return (
    <input
      type="text"
      className="dash-search-input"
      placeholder={placeholder}
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}
