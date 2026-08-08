import { useState } from 'react';
import type { FormEvent } from 'react';
import { useGames } from '../games/useGames';
import { useCreateRun } from './useCreateRun';

export function CreateRunForm() {
  const { data: games, isPending: gamesPending } = useGames();
  const createRun = useCreateRun();
  const [gameId, setGameId] = useState('');
  const [name, setName] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!gameId) return;
    createRun.mutate(
      { gameId, name: name.trim() || undefined },
      { onSuccess: () => setName('') },
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-md border border-neutral-300 p-4 dark:border-neutral-700"
    >
      <h2 className="text-lg font-semibold">Start a new run</h2>

      <label className="flex flex-col gap-1 text-sm">
        Game
        <select
          value={gameId}
          onChange={(event) => setGameId(event.target.value)}
          disabled={gamesPending}
          required
          className="rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="" disabled>
            {gamesPending ? 'Loading games…' : 'Select a game'}
          </option>
          {games?.map((game) => (
            <option key={game.id} value={game.id}>
              {game.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Name (optional)
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={100}
          placeholder="e.g. First Nuzlocke attempt"
          className="rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>

      {createRun.isError && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {createRun.error.message}
        </p>
      )}

      <button
        type="submit"
        disabled={!gameId || createRun.isPending}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
      >
        {createRun.isPending ? 'Creating…' : 'Create run'}
      </button>
    </form>
  );
}
