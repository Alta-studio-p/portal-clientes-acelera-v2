import type { ReactNode } from 'react';
import Link from 'next/link';

export function AuthFrame({ title, description, children, footer }: {
  title: string; description: string; children: ReactNode; footer: ReactNode;
}) {
  return <main className="flex min-h-dvh flex-1 flex-col bg-background">
    <header className="border-b border-border bg-surface px-6 py-5 sm:px-10">
      <Link href="/login" className="inline-flex items-center gap-2.5 rounded-md text-sm font-semibold">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-icon.png" alt="" className="h-8 w-8 object-contain" />Acelera Talent
      </Link>
    </header>
    <div className="flex flex-1 items-center justify-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-[420px]">
        <div className="mb-7">
          <h1 className="text-2xl font-semibold leading-tight">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-6 sm:p-8">{children}</div>
        <p className="mt-6 break-words text-center text-xs leading-5 text-muted [overflow-wrap:anywhere]">{footer}</p>
      </div>
    </div>
  </main>;
}
