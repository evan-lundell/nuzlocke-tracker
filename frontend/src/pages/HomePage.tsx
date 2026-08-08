import { useCurrentUser } from '../features/auth/useCurrentUser';
import { LoginButtons } from '../features/auth/LoginButtons';
import { RunsList } from '../features/runs/RunsList';
import { CreateRunForm } from '../features/runs/CreateRunForm';

export function HomePage() {
  const { data: user, isPending } = useCurrentUser();

  if (isPending) {
    return <p className="p-6 text-sm">Loading…</p>;
  }

  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
        <h1 className="text-2xl font-semibold">Track your nuzlocke runs</h1>
        <LoginButtons />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-6">
      <section>
        <h1 className="mb-3 text-xl font-semibold">Your runs</h1>
        <RunsList />
      </section>
      <section>
        <CreateRunForm />
      </section>
    </div>
  );
}
