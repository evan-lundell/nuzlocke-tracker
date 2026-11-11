import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
	ListOrderedIcon,
	PlusIcon,
	SwordsIcon,
	Trash2Icon,
	XIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { RuleTypePicker } from "#/components/rule-type-picker";
import { type SpeciesOption, SpeciesPicker } from "#/components/species-picker";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import type { EncounterOutcome } from "#/db/schema";
import { buildLineRoots, caughtLines } from "#/lib/evolution-lines";
import { currentLevelCap } from "#/lib/level-cap";
import { useAction } from "#/lib/use-action";
import { cn } from "#/lib/utils";
import {
	addCustomLocationFn,
	clearEncounterFn,
	deleteCustomLocationFn,
	getRunLocationsFn,
	saveEncounterFn,
	setBattleCompletedFn,
} from "#/server/encounters.functions";
import { getSpeciesFn } from "#/server/refdata.functions";

export const Route = createFileRoute("/runs/$runId/")({
	loader: async ({ params }) => {
		const runId = Number(params.runId);
		const [locations, species] = await Promise.all([
			getRunLocationsFn({ data: { runId } }),
			getSpeciesFn(),
		]);
		return { runId, locations, species };
	},
	component: EncountersPage,
});

type LocationRow = Awaited<ReturnType<typeof getRunLocationsFn>>[number];

const OUTCOMES: { value: EncounterOutcome; label: string }[] = [
	{ value: "caught", label: "Caught" },
	{ value: "failed", label: "Failed / fled" },
	{ value: "missed", label: "Missed" },
	{ value: "skipped", label: "Skipped (dupe)" },
];

const FILTERS = ["all", "todo", "logged"] as const;
type Filter = (typeof FILTERS)[number];

function EncountersPage() {
	const { runId, locations, species } = Route.useLoaderData();
	const { gameId } = useLoaderData({ from: "/runs/$runId" });
	const [filter, setFilter] = useState<Filter>("all");
	const lineRoots = useMemo(() => buildLineRoots(species), [species]);

	const places = locations.filter((l) => l.kind === "location");
	const logged = places.filter((l) => l.outcome).length;
	const isDone = (l: LocationRow) =>
		l.kind === "battle" ? !!l.completedAt : !!l.outcome;
	const visible = locations.filter((l) =>
		filter === "all" ? true : filter === "todo" ? !isDone(l) : isDone(l),
	);
	const levelCap = currentLevelCap(locations);

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex rounded-md border p-0.5 text-sm">
					{FILTERS.map((f) => (
						<button
							key={f}
							type="button"
							onClick={() => setFilter(f)}
							className={cn(
								"rounded px-3 py-1 capitalize text-muted-foreground",
								filter === f && "bg-secondary text-foreground",
							)}
						>
							{f === "todo" ? "To do" : f}
						</button>
					))}
				</div>
				<div className="flex items-center gap-3">
					<span className="text-sm text-muted-foreground">
						{logged}/{places.length} logged
					</span>
					<Button size="sm" variant="ghost" asChild>
						<Link to="/admin/locations" search={{ game: gameId }}>
							<ListOrderedIcon /> Edit locations
						</Link>
					</Button>
					<AddLocationDialog runId={runId} />
				</div>
			</div>

			{levelCap && (
				<p className="flex items-center gap-2 text-sm">
					<SwordsIcon className="size-4 text-muted-foreground" />
					<span className="font-medium">Level cap: {levelCap.levelCap}</span>
					<span className="text-muted-foreground">· {levelCap.name}</span>
				</p>
			)}

			{locations.length === 0 && (
				<p className="text-sm text-muted-foreground">
					No locations for this game yet. Add your own with "Add location".
				</p>
			)}

			<div className="divide-y rounded-lg border">
				{visible.map((loc) =>
					loc.kind === "battle" ? (
						<BattleRow
							key={`${loc.locationId}:${!!loc.completedAt}`}
							runId={runId}
							row={loc}
						/>
					) : (
						<EncounterRow
							key={loc.locationId}
							runId={runId}
							row={loc}
							species={species}
							locations={locations}
							lineRoots={lineRoots}
						/>
					),
				)}
			</div>
		</div>
	);
}

function BattleRow({ runId, row }: { runId: number; row: LocationRow }) {
	// Local so the tick shows instantly; reverts if the save fails
	const [completed, setCompleted] = useState(!!row.completedAt);
	const [save, saving] = useAction(useServerFn(setBattleCompletedFn));

	return (
		<label
			className={cn(
				"flex min-h-12 cursor-pointer items-center gap-2 bg-muted/50 px-3 py-2",
				completed && "text-muted-foreground",
			)}
		>
			<SwordsIcon className="size-4 shrink-0 text-muted-foreground" />
			<span className={cn("truncate font-medium", completed && "line-through")}>
				{row.locationName}
			</span>
			{row.levelCap !== null && (
				<span className="shrink-0 text-sm text-muted-foreground tabular-nums">
					Lv. {row.levelCap}
				</span>
			)}
			<span className="ml-auto flex shrink-0 items-center gap-2 text-sm">
				Completed
				<input
					type="checkbox"
					checked={completed}
					disabled={saving}
					onChange={async (e) => {
						const next = e.target.checked;
						setCompleted(next);
						const result = await save({
							data: { runId, locationId: row.locationId, completed: next },
						});
						if (!result) setCompleted(!next);
					}}
				/>
			</span>
		</label>
	);
}

function EncounterRow({
	runId,
	row,
	species,
	locations,
	lineRoots,
}: {
	runId: number;
	row: LocationRow;
	species: (SpeciesOption & { types: string[] })[];
	locations: LocationRow[];
	lineRoots: Map<number, number>;
}) {
	// Evolution lines caught elsewhere in the run (this row's own catch excluded)
	const dupeLines = useMemo(
		() => caughtLines(locations, lineRoots, row.locationId),
		[locations, lineRoots, row.locationId],
	);
	const dupeOf = (id: number) => dupeLines.get(lineRoots.get(id) ?? id);
	const [speciesId, setSpeciesId] = useState(row.speciesId);
	const [nickname, setNickname] = useState(row.nickname ?? "");
	const [outcome, setOutcome] = useState<EncounterOutcome | null>(row.outcome);
	const [ruleType, setRuleType] = useState(row.ruleType);

	// The row stays mounted across saves so focus survives (remounting would
	// drop it). When persisted data changes underneath us (a save landing, a
	// clear), adopt only the fields the server changed, so in-progress edits to
	// other fields (e.g. a nickname typed while a save is in flight) survive.
	const [synced, setSynced] = useState(row);
	if (synced !== row) {
		if (row.speciesId !== synced.speciesId) setSpeciesId(row.speciesId);
		if (row.nickname !== synced.nickname) setNickname(row.nickname ?? "");
		if (row.outcome !== synced.outcome) setOutcome(row.outcome);
		if (row.ruleType !== synced.ruleType) setRuleType(row.ruleType);
		setSynced(row);
	}
	const types = species.find((s) => s.id === speciesId)?.types ?? [];

	const [save, saving] = useAction(useServerFn(saveEncounterFn));
	const [clear, clearing] = useAction(useServerFn(clearEncounterFn));
	const [remove, removing] = useAction(useServerFn(deleteCustomLocationFn));
	const busy = saving || clearing || removing;

	const persist = (
		changes: Partial<{
			speciesId: number | null;
			nickname: string;
			outcome: EncounterOutcome | null;
			ruleType: string | null;
		}>,
	) => {
		const next = { speciesId, nickname, outcome, ruleType, ...changes };
		if (!next.outcome) return;
		save({
			data: {
				runId,
				locationId: row.locationId,
				speciesId: next.speciesId,
				nickname: next.nickname,
				outcome: next.outcome,
				ruleType: next.ruleType,
			},
		});
	};

	return (
		<div className="grid grid-cols-1 items-center gap-2 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_12rem_9rem_10rem_4.5rem]">
			<div className="flex min-w-0 items-center gap-2">
				<span className="truncate font-medium">{row.locationName}</span>
				{row.isCustom && (
					<span className="text-xs text-muted-foreground">custom</span>
				)}
				{outcome === "caught" && types.length > 0 && (
					<div className="ml-auto">
						<RuleTypePicker
							types={types}
							value={ruleType}
							onChange={(type) => {
								setRuleType(type);
								persist({ ruleType: type });
							}}
						/>
					</div>
				)}
			</div>

			<SpeciesPicker
				species={species}
				value={speciesId}
				dupeOf={dupeOf}
				onChange={(id) => {
					const nextOutcome = outcome ?? (id ? "caught" : null);
					setSpeciesId(id);
					setOutcome(nextOutcome);
					setRuleType(null);
					persist({ speciesId: id, outcome: nextOutcome, ruleType: null });
				}}
			/>

			<Input
				value={nickname}
				placeholder="Nickname"
				disabled={outcome !== "caught"}
				onChange={(e) => setNickname(e.target.value)}
				onBlur={() => {
					if (nickname !== (row.nickname ?? "")) {
						persist({});
					}
				}}
			/>

			<Select
				value={outcome ?? ""}
				onValueChange={(v) => {
					const next = v as EncounterOutcome;
					setOutcome(next);
					persist({ outcome: next });
				}}
			>
				<SelectTrigger className="w-full">
					<SelectValue placeholder="Outcome" />
				</SelectTrigger>
				<SelectContent>
					{OUTCOMES.map((o) => (
						<SelectItem key={o.value} value={o.value}>
							{o.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			<div className="flex justify-end gap-1">
				{row.encounterId && (
					<Button
						variant="ghost"
						size="icon"
						title="Clear encounter"
						disabled={busy}
						onClick={() =>
							clear({ data: { runId, locationId: row.locationId } })
						}
					>
						<XIcon />
					</Button>
				)}
				{row.isCustom && (
					<Button
						variant="ghost"
						size="icon"
						title="Delete custom location"
						disabled={busy}
						onClick={() =>
							remove({ data: { runId, locationId: row.locationId } })
						}
					>
						<Trash2Icon />
					</Button>
				)}
			</div>
		</div>
	);
}

function AddLocationDialog({ runId }: { runId: number }) {
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [pinTop, setPinTop] = useState(true);
	const [add, pending] = useAction(useServerFn(addCustomLocationFn));

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (next) {
					setName("");
					setPinTop(true);
				}
				setOpen(next);
			}}
		>
			<DialogTrigger asChild>
				<Button size="sm" variant="outline">
					<PlusIcon /> Add location
				</Button>
			</DialogTrigger>
			<DialogContent>
				<form
					className="space-y-4"
					onSubmit={async (e) => {
						e.preventDefault();
						const result = await add({
							data: { runId, name, sortOrder: pinTop ? -1 : null },
						});
						if (result) setOpen(false);
					}}
				>
					<DialogHeader>
						<DialogTitle>Add custom location</DialogTitle>
					</DialogHeader>
					<div className="space-y-2">
						<Label htmlFor="loc-name">Name</Label>
						<Input
							id="loc-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Gift Eevee, Fossil, Static Snorlax…"
							required
							autoFocus
						/>
					</div>
					<label className="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							checked={pinTop}
							onChange={(e) => setPinTop(e.target.checked)}
						/>
						Show at the top of the list
					</label>
					<DialogFooter>
						<Button type="submit" disabled={pending || !name.trim()}>
							Add
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
