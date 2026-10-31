import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArchiveIcon, SkullIcon, UsersIcon } from "lucide-react";
import { useState } from "react";
import { Sprite } from "#/components/sprite";
import { TypeBadge } from "#/components/type-badge";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import type { PokemonState } from "#/db/schema";
import { useAction } from "#/lib/use-action";
import { getCaughtFn, setPokemonStateFn } from "#/server/encounters.functions";

export const Route = createFileRoute("/runs/$runId/team")({
	loader: ({ params }) =>
		getCaughtFn({ data: { runId: Number(params.runId) } }),
	component: TeamPage,
});

type Mon = Awaited<ReturnType<typeof getCaughtFn>>[number];

const COLUMNS: { state: PokemonState; title: string; empty: string }[] = [
	{ state: "party", title: "Party", empty: "No one in your party." },
	{ state: "box", title: "Box", empty: "Box is empty." },
	{ state: "dead", title: "Graveyard", empty: "No deaths yet." },
];

const MOVES = {
	party: { label: "Party", icon: UsersIcon },
	box: { label: "Box", icon: ArchiveIcon },
	dead: { label: "Died", icon: SkullIcon },
} as const;

function TeamPage() {
	const caught = Route.useLoaderData();
	const [setState, pending] = useAction(useServerFn(setPokemonStateFn));
	const [dying, setDying] = useState<Mon | null>(null);

	const move = (mon: Mon, state: PokemonState) => {
		if (state === "dead") {
			setDying(mon);
			return;
		}
		setState({ data: { encounterId: mon.id, state, causeOfDeath: "" } });
	};

	if (caught.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">
				Nothing caught yet. Log a catch on the Encounters tab.
			</p>
		);
	}

	return (
		<>
			<div className="grid gap-4 md:grid-cols-3">
				{COLUMNS.map((col) => {
					const mons = caught.filter((m) => m.state === col.state);
					return (
						<section key={col.state} className="space-y-2">
							<h2 className="font-semibold">
								{col.title}{" "}
								<span className="font-normal text-muted-foreground">
									{col.state === "party" ? `${mons.length}/6` : mons.length}
								</span>
							</h2>
							{mons.length === 0 ? (
								<p className="text-sm text-muted-foreground">{col.empty}</p>
							) : (
								mons.map((mon) => (
									<MonCard
										key={mon.id}
										mon={mon}
										disabled={pending}
										onMove={(state) => move(mon, state)}
									/>
								))
							)}
						</section>
					);
				})}
			</div>

			<CauseOfDeathDialog
				mon={dying}
				onClose={() => setDying(null)}
				onConfirm={async (causeOfDeath) => {
					if (!dying) return;
					await setState({
						data: { encounterId: dying.id, state: "dead", causeOfDeath },
					});
					setDying(null);
				}}
			/>
		</>
	);
}

function MonCard({
	mon,
	disabled,
	onMove,
}: {
	mon: Mon;
	disabled: boolean;
	onMove: (state: PokemonState) => void;
}) {
	const title = mon.nickname || mon.speciesName || "Unknown";

	return (
		<div className="rounded-lg border p-2">
			<div className="flex items-center gap-2">
				<Sprite
					speciesId={mon.speciesId}
					name={mon.speciesName}
					className={mon.state === "dead" ? "grayscale" : undefined}
				/>
				<div className="min-w-0 flex-1">
					<div className="truncate font-medium">{title}</div>
					<div className="truncate text-xs text-muted-foreground">
						{mon.nickname && mon.speciesName ? `${mon.speciesName} · ` : ""}
						{mon.locationName}
					</div>
				</div>
				<div className="flex gap-1">
					{mon.types?.map((t) => (
						<TypeBadge key={t} type={t} />
					))}
				</div>
			</div>
			{mon.state === "dead" && mon.causeOfDeath && (
				<p className="mt-1 text-xs text-muted-foreground italic">
					{mon.causeOfDeath}
				</p>
			)}
			<div className="mt-2 flex gap-1">
				{(Object.keys(MOVES) as PokemonState[])
					.filter((s) => s !== mon.state)
					.map((s) => {
						const { label, icon: Icon } = MOVES[s];
						return (
							<Button
								key={s}
								size="sm"
								variant="ghost"
								className="h-7 px-2 text-xs"
								disabled={disabled}
								onClick={() => onMove(s)}
							>
								<Icon /> {label}
							</Button>
						);
					})}
			</div>
		</div>
	);
}

function CauseOfDeathDialog({
	mon,
	onClose,
	onConfirm,
}: {
	mon: Mon | null;
	onClose: () => void;
	onConfirm: (cause: string) => Promise<void>;
}) {
	const [cause, setCause] = useState("");

	return (
		<Dialog
			open={mon !== null}
			onOpenChange={(open) => {
				if (!open) onClose();
				setCause("");
			}}
		>
			<DialogContent>
				<form
					className="space-y-4"
					onSubmit={async (e) => {
						e.preventDefault();
						await onConfirm(cause);
						setCause("");
					}}
				>
					<DialogHeader>
						<DialogTitle>
							RIP {mon?.nickname || mon?.speciesName || "Pokémon"}
						</DialogTitle>
					</DialogHeader>
					<div className="space-y-2">
						<Label htmlFor="cause">Cause of death (optional)</Label>
						<Input
							id="cause"
							value={cause}
							onChange={(e) => setCause(e.target.value)}
							placeholder="Crit from Misty's Starmie"
							autoFocus
						/>
					</div>
					<DialogFooter>
						<Button type="submit" variant="destructive">
							Send to graveyard
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
