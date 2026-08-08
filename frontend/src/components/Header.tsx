import { Link } from 'react-router-dom';
import { useCurrentUser } from '../features/auth/useCurrentUser';
import { useLogout } from '../features/auth/useLogout';

export function Header() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();

  return (
    <header className="flex items-center justify-between border-b border-neutral-300 px-6 py-4 dark:border-neutral-700">
      <Link to="/" className="text-lg font-semibold">
        Nuzlocke Tracker
      </Link>
      {user && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-500">{user.displayName}</span>
          <button
            type="button"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Log out
          </button>
        </div>
      )}
    </header>
  );
}
