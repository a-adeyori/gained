import Link from 'next/link';
import { signOut } from '@/app/(auth)/actions';
import { Logo } from '@/components/ui';
import { requireUser } from '@/lib/auth';

const NAV = {
  parent: [
    { href: '/home', label: 'Home' },
    { href: '/book', label: 'Book a tutor' },
    { href: '/progress', label: 'Progress' },
  ],
  student: [{ href: '/home', label: 'Home' }],
  tutor: [
    { href: '/home', label: 'Home' },
    { href: '/tutor/availability', label: 'Profile & availability' },
    { href: '/tutor', label: 'Earnings' },
  ],
  admin: [
    { href: '/admin', label: 'Escrows' },
    { href: '/admin/appeals', label: 'Appeals' },
  ],
};

const ROLE_COLOR = { parent: '#60a5fa', student: '#ffb020', tutor: '#a78bfa', admin: '#f472b6' };

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const user = await requireUser();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4">
          <Link href="/home" aria-label="Gained home">
            <Logo className="text-xl" />
          </Link>
          <nav className="-mx-1 flex flex-1 items-center gap-1 overflow-x-auto text-sm">
            {NAV[user.role].map((item) => (
              <Link key={item.href} href={item.href} className="whitespace-nowrap rounded-full px-3 py-1.5 text-ink-soft hover:bg-surface-2 hover:text-ink">
                {item.label}
              </Link>
            ))}
          </nav>
          <span
            className="hidden rounded-full px-2.5 py-1 text-xs font-semibold capitalize text-[#121210] sm:inline-block"
            style={{ background: ROLE_COLOR[user.role] }}
            title={`Signed in as ${user.name}`}
          >
            {user.role}
          </span>
          <form action={signOut}>
            <button className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-ink">Sign out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-12">{children}</main>
    </div>
  );
}
