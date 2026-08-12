import { useState } from 'react';
import type { FormEvent } from 'react';
import { useGames } from '../games/useGames';
import { useRules } from '../rules/useRules';
import { useCreateRun } from './useCreateRun';

export function CreateRunForm() {
  const {
    data: games,
    isPending: gamesPending,
    isError: gamesIsError,
    error: gamesError,
  } = useGames();
  const { data: rules } = useRules();
  const createRun = useCreateRun();
  const [gameId, setGameId] = useState('');
  const [name, setName] = useState('');
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);

  function toggleRule(ruleId: string) {
    setSelectedRuleIds((current) =>
      current.includes(ruleId)
        ? current.filter((id) => id !== ruleId)
        : [...current, ruleId],
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!gameId) return;
    createRun.mutate(
      {
        gameId,
        name: name.trim() || undefined,
        ruleIds: selectedRuleIds.length ? selectedRuleIds : undefined,
      },
      {
        onSuccess: () => {
          setName('');
          setSelectedRuleIds([]);
        },
      },
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
        {gamesIsError && (
          <span className="text-sm text-red-600 dark:text-red-400">
            {gamesError.message}
          </span>
        )}
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

      {rules && rules.length > 0 && (
        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="mb-1">Rules</legend>
          {rules.map((rule) => (
            <label key={rule.id} className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={selectedRuleIds.includes(rule.id)}
                onChange={() => toggleRule(rule.id)}
                className="mt-1"
              />
              <span>
                <span className="font-medium">{rule.name}</span>
                <span className="block text-xs text-neutral-500">
                  {rule.description}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

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
