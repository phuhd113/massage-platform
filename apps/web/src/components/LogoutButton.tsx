'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await fetch('/api/auth/session', { method: 'DELETE' });
    router.refresh();
    router.push('/');
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={pending}
      className="text-sm text-ink-600 hover:text-brand-600 disabled:opacity-60"
    >
      {pending ? 'Đang thoát…' : 'Đăng xuất'}
    </button>
  );
}
