import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Wraps a mutation: runs it, re-runs route loaders so the UI shows persisted
 * state, and toasts on failure. Returns [run, pending].
 */
export function useAction<TArgs extends unknown[], TResult>(
	fn: (...args: TArgs) => Promise<TResult>,
) {
	const router = useRouter();
	const [pending, setPending] = useState(false);

	const run = async (...args: TArgs): Promise<TResult | undefined> => {
		setPending(true);
		try {
			const result = await fn(...args);
			await router.invalidate({ sync: true });
			return result;
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Something went wrong");
			return undefined;
		} finally {
			setPending(false);
		}
	};

	return [run, pending] as const;
}
