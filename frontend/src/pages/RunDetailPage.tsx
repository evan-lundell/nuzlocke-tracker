import { Link, useParams } from 'react-router-dom';
import { useRun } from '../features/runs/useRun';

export function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const { data: run, isPending, isError, error } = useRun(runId ?? '');

  if (isPending) return <p className="p-6 text-sm">Loading run…</p>;
  if (isError) {
    return (
      <p className="p-6 text-sm text-red-600 dark:text-red-400">
        {error.message}
      </p>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6">
      <Link to="/" className="text-sm text-neutral-500 hover:underline">
        ← Back to runs
      </Link>
      <h1 className="text-xl font-semibold">
        {run.name ?? `${run.game.name} run`}
      </h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-neutral-500">Game</dt>
        <dd>{run.game.name}</dd>
        <dt className="text-neutral-500">Status</dt>
        <dd>{run.status}</dd>
        <dt className="text-neutral-500">Started</dt>
        <dd>{new Date(run.startedAt).toLocaleDateString()}</dd>
      </dl>
      <p className="text-sm text-neutral-500">
        Encounter log and party management are coming soon.
      </p>
    </div>
  );
}
