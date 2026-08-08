import { Link } from 'react-router-dom';
import { useRuns } from './useRuns';

export function RunsList() {
  const { data: runs, isPending, isError, error } = useRuns();

  if (isPending) return <p className="text-sm">Loading runs…</p>;
  if (isError) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        {error.message}
      </p>
    );
  }
  if (runs.length === 0) {
    return <p className="text-sm text-neutral-500">No runs yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {runs.map((run) => (
        <li key={run.id}>
          <Link
            to={`/runs/${run.id}`}
            className="flex items-center justify-between rounded-md border border-neutral-300 px-4 py-3 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            <span className="font-medium">
              {run.name ?? `${run.game.name} run`}
            </span>
            <span className="text-sm text-neutral-500">{run.game.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
