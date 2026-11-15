import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
	ArchiveIcon,
	ExternalLinkIcon,
	InfoIcon,
	SkullIcon,
	SparklesIcon,
	UsersIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { RuleTypePicker } from "#/components/rule-type-picker";
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
import { formatEvolutionMethod } from "#/lib/evolution-methods";
import { useAction } from "#/lib/use-action";
import { cn } from "#/lib/utils";
import {
	evolvePokemonFn,
	getCaughtFn,
	setPokemonStateFn,
} from "#/server/encounters.functions";

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
	const [evolve, evolving] = useAction(useServerFn(evolvePokemonFn));
	const [dying, setDying] = useState<Mon | null>(null);
	const [evolvingMon, setEvolvingMon] = useState<Mon | null>(null);
	const [infoMon, setInfoMon] = useState<Mon | null>(null);

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
										disabled={pending || evolving}
										onMove={(state) => move(mon, state)}
										onEvolve={() => setEvolvingMon(mon)}
										onInfo={() => setInfoMon(mon)}
									/>
								))
							)}
						</section>
					);
				})}
			</div>

			<InfoDialog mon={infoMon} onClose={() => setInfoMon(null)} />

			<EvolveDialog
				key={evolvingMon?.id}
				mon={evolvingMon}
				pending={evolving}
				onClose={() => setEvolvingMon(null)}
				onConfirm={async (speciesId, ruleType) => {
					if (!evolvingMon) return;
					await evolve({
						data: { encounterId: evolvingMon.id, speciesId, ruleType },
					});
					setEvolvingMon(null);
				}}
			/>

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
	onEvolve,
	onInfo,
}: {
	mon: Mon;
	disabled: boolean;
	onMove: (state: PokemonState) => void;
	onEvolve: () => void;
	onInfo: () => void;
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
						<TypeBadge
							key={t}
							type={t}
							dimmed={mon.ruleType !== null && mon.ruleType !== t}
							title={
								mon.ruleType === t ? "Counts for the type rule" : undefined
							}
						/>
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
				{mon.speciesId !== null && (
					<Button
						size="sm"
						variant="ghost"
						className="ml-auto h-7 px-2 text-xs"
						onClick={onInfo}
					>
						<InfoIcon /> Info
					</Button>
				)}
				{mon.state !== "dead" && mon.evolutions.length > 0 && (
					<Button
						size="sm"
						variant="ghost"
						className="h-7 px-2 text-xs"
						disabled={disabled}
						onClick={onEvolve}
					>
						<SparklesIcon /> Evolve
					</Button>
				)}
			</div>
		</div>
	);
}

function EvolveDialog({
	mon,
	pending,
	onClose,
	onConfirm,
}: {
	mon: Mon | null;
	pending: boolean;
	onClose: () => void;
	onConfirm: (speciesId: number, ruleType: string | null) => Promise<void>;
}) {
	const options = mon?.evolutions ?? [];
	const [targetId, setTargetId] = useState<number | null>(
		options.length === 1 ? options[0].id : null,
	);
	const target = options.find((o) => o.id === targetId);
	// Keep the current rule type when the evolution still has it
	const [ruleType, setRuleType] = useState<string | null>(null);
	const keptType =
		mon?.ruleType && target?.types.includes(mon.ruleType) ? mon.ruleType : null;
	const chosenType =
		target?.types.length === 1 ? target.types[0] : (ruleType ?? keptType);
	const name = mon?.nickname || mon?.speciesName || "Pokémon";

	return (
		<Dialog open={mon !== null} onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<form
					className="space-y-4"
					onSubmit={async (e) => {
						e.preventDefault();
						if (target && chosenType) await onConfirm(target.id, chosenType);
					}}
				>
					<DialogHeader>
						<DialogTitle>Evolve {name}</DialogTitle>
					</DialogHeader>

					{options.length > 1 && (
						<fieldset className="grid grid-cols-2 gap-2">
							<legend className="mb-2 text-sm font-medium">Evolves into</legend>
							{options.map((o) => (
								<button
									key={o.id}
									type="button"
									aria-pressed={o.id === targetId}
									onClick={() => {
										setTargetId(o.id);
										setRuleType(null);
									}}
									className={cn(
										"flex items-center gap-2 rounded-lg border p-2 text-left text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
										o.id === targetId && "border-foreground/70 bg-accent",
									)}
								>
									<Sprite speciesId={o.id} name={o.name} />
									<span className="min-w-0">
										<span className="block truncate">{o.name}</span>
										<EvolutionHint evolution={o} />
									</span>
								</button>
							))}
						</fieldset>
					)}

					{target && (
						<div className="space-y-2">
							{options.length === 1 && (
								<div className="flex items-center gap-2">
									<Sprite speciesId={target.id} name={target.name} />
									<span>
										<span className="block font-medium">{target.name}</span>
										<EvolutionHint evolution={target} />
									</span>
								</div>
							)}
							{target.types.length > 1 && (
								<div className="space-y-1">
									<Label>Type that counts for the type rule</Label>
									<RuleTypePicker
										types={target.types}
										value={chosenType}
										onChange={setRuleType}
									/>
								</div>
							)}
						</div>
					)}

					<DialogFooter>
						<Button type="submit" disabled={!target || !chosenType || pending}>
							<SparklesIcon /> Evolve
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

const STATS = [
	["hp", "HP"],
	["attack", "Attack"],
	["defense", "Defense"],
	["specialAttack", "Sp. Atk"],
	["specialDefense", "Sp. Def"],
	["speed", "Speed"],
] as const;

// Roughly pokemondb's bands
const statColor = (v: number) =>
	v < 50
		? "bg-red-500"
		: v < 80
			? "bg-orange-400"
			: v < 100
				? "bg-yellow-400"
				: v < 130
					? "bg-lime-500"
					: "bg-emerald-500";

type Evolution = Mon["evolutions"][number];

// Alcremie alone has 21 ways; past this, point to Pokémon Database
const MAX_METHODS = 3;

function EvolutionHint({
	evolution: { methods, varies },
}: {
	evolution: Pick<Evolution, "methods" | "varies">;
}) {
	if (methods.length === 0) {
		return (
			<span className="block text-xs text-muted-foreground">
				Not possible in this game
			</span>
		);
	}
	const shown = methods.slice(0, MAX_METHODS);
	const more = methods.length - shown.length;
	return (
		<span className="block text-xs text-muted-foreground">
			{varies && <span className="block italic">Varies by game:</span>}
			{shown.map((m) => {
				const text = formatEvolutionMethod(m);
				return (
					<span key={`${m.versionGroup}:${text}`} className="block">
						{text}
						{varies && m.versionGroupName && ` (${m.versionGroupName})`}
					</span>
				);
			})}
			{more > 0 && (
				<span className="block">
					…and {more} other {more === 1 ? "way" : "ways"}
				</span>
			)}
		</span>
	);
}

function InfoDialog({
	mon: openMon,
	onClose,
}: {
	mon: Mon | null;
	onClose: () => void;
}) {
	// Keep showing the last Pokémon while the dialog animates closed
	const last = useRef(openMon);
	if (openMon) last.current = openMon;
	const mon = openMon ?? last.current;
	const stats = mon
		? STATS.map(([key, label]) => ({ key, label, value: mon[key] }))
		: [];
	const hasStats = stats.every((s) => s.value !== null);
	const total = stats.reduce((sum, s) => sum + (s.value ?? 0), 0);

	return (
		<Dialog open={openMon !== null} onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Sprite
							speciesId={mon?.speciesId ?? null}
							name={mon?.speciesName}
						/>
						<span className="min-w-0">
							<span className="block truncate">
								{mon?.nickname || mon?.speciesName}
							</span>
							{mon?.nickname && (
								<span className="block text-sm font-normal text-muted-foreground">
									{mon.speciesName}
								</span>
							)}
						</span>
						<span className="ml-auto flex gap-1">
							{mon?.types?.map((t) => (
								<TypeBadge key={t} type={t} />
							))}
						</span>
					</DialogTitle>
				</DialogHeader>

				<section className="space-y-1">
					<h3 className="text-sm font-medium">Base stats</h3>
					{hasStats ? (
						<table className="w-full text-sm">
							<tbody>
								{stats.map((s) => (
									<tr key={s.key}>
										<th className="w-16 py-0.5 pr-2 text-left font-normal text-muted-foreground">
											{s.label}
										</th>
										<td className="w-10 pr-2 text-right tabular-nums">
											{s.value}
										</td>
										<td>
											<div
												className={cn(
													"h-2 rounded-full",
													statColor(s.value ?? 0),
												)}
												// 255 is the highest any base stat goes
												style={{ width: `${((s.value ?? 0) / 255) * 100}%` }}
											/>
										</td>
									</tr>
								))}
								<tr className="border-t">
									<th className="pt-1 pr-2 text-left font-normal text-muted-foreground">
										Total
									</th>
									<td className="pt-1 pr-2 text-right font-medium tabular-nums">
										{total}
									</td>
									<td />
								</tr>
							</tbody>
						</table>
					) : (
						<p className="text-sm text-muted-foreground">No stats available.</p>
					)}
				</section>

				<section className="space-y-1">
					<h3 className="text-sm font-medium">Evolves into</h3>
					{mon?.evolutions.length ? (
						<ul className="space-y-1">
							{mon.evolutions.map((e) => (
								<li key={e.id} className="flex items-center gap-2 text-sm">
									<Sprite speciesId={e.id} name={e.name} />
									<span className="min-w-0">
										<span className="block">{e.name}</span>
										<EvolutionHint evolution={e} />
									</span>
								</li>
							))}
						</ul>
					) : (
						<p className="text-sm text-muted-foreground">
							Doesn't evolve any further.
						</p>
					)}
				</section>

				{mon?.speciesSlug && (
					<DialogFooter>
						<Button variant="outline" asChild>
							<a
								href={`https://pokemondb.net/pokedex/${mon.speciesSlug}`}
								target="_blank"
								rel="noopener noreferrer"
							>
								View on Pokémon Database <ExternalLinkIcon />
							</a>
						</Button>
					</DialogFooter>
				)}
			</DialogContent>
		</Dialog>
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
