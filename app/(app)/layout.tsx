import Link from 'next/link';
import { signOut } from '@/app/(auth)/actions';
import { Logo } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { VerifyBanner } from './verify-banner';

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
        {/* On phones the nav gets its own full-width row under the logo, so no link is cut off. */}
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 px-4 pt-2 sm:h-14 sm:flex-nowrap sm:pt-0">
          <Link href="/home" aria-label="Gained home" className="mr-auto sm:mr-0">
            <Logo className="text-xl" />
          </Link>
          <nav className="order-last -mx-1 flex w-full items-center gap-1 overflow-x-auto py-1.5 text-sm sm:order-none sm:w-auto sm:flex-1 sm:py-0">
            {NAV[user.role].map((item) => (
              <Link key={item.href} href={item.href} className="whitespace-nowrap rounded-full px-3 py-1.5 text-ink-soft hover:bg-surface-2 hover:text-ink">
                {item.label}
              </Link>
            ))}
          </nav>
          <span
            className="rounded-full px-2.5 py-1 text-xs font-semibold capitalize text-[#121210]"
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
      {!user.email_verified_at && <VerifyBanner email={user.email} />}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-12">{children}</main>
    </div>
  );
}
