import { createFileRoute, Link } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { RunStatusBadge } from "#/components/run-status-badge";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import { getRunsFn } from "#/server/runs.functions";

export const Route = createFileRoute("/")({
	loader: () => getRunsFn(),
	component: RunsPage,
});

function RunsPage() {
	const runs = Route.useLoaderData();

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-semibold">Runs</h1>
				<Button asChild>
					<Link to="/runs/new">
						<PlusIcon /> New run
					</Link>
				</Button>
			</div>

			{runs.length === 0 ? (
				<p className="text-muted-foreground">
					No runs yet. Start one to begin tracking encounters.
				</p>
			) : (
				<div className="grid gap-3 sm:grid-cols-2">
					{runs.map((run) => (
						<Link
							key={run.id}
							to="/runs/$runId"
							params={{ runId: String(run.id) }}
							className="rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
						>
							<Card className="transition-colors hover:bg-accent/50">
								<CardHeader>
									<div className="flex items-start justify-between gap-2">
										<CardTitle>{run.name}</CardTitle>
										<RunStatusBadge status={run.status} />
									</div>
									<CardDescription>
										{run.gameName} · {run.party} in party · {run.box} boxed ·{" "}
										{run.dead} dead
									</CardDescription>
								</CardHeader>
							</Card>
						</Link>
					))}
				</div>
			)}
		</div>
	);
}
