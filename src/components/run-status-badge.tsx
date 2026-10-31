import { Badge } from "#/components/ui/badge";
import type { RunStatus } from "#/db/schema";

const VARIANTS = {
	active: "default",
	completed: "secondary",
	failed: "destructive",
} as const;

export function RunStatusBadge({ status }: { status: RunStatus }) {
	return (
		<Badge variant={VARIANTS[status]} className="capitalize">
			{status}
		</Badge>
	);
}
