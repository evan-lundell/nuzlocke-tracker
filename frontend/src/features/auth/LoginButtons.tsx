import { loginUrl } from '../../lib/api';

export function LoginButtons() {
  return (
    <div className="flex flex-col items-center gap-3">
      <a
        href={loginUrl('google')}
        className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
      >
        Continue with Google
      </a>
      <a
        href={loginUrl('github')}
        className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
      >
        Continue with GitHub
      </a>
    </div>
  );
}
