import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";
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
import { useAction } from "#/lib/use-action";
import { cn } from "#/lib/utils";
import {
	addCustomLocationFn,
	clearEncounterFn,
	deleteCustomLocationFn,
	getRunLocationsFn,
	saveEncounterFn,
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
	const [filter, setFilter] = useState<Filter>("all");

	const logged = locations.filter((l) => l.outcome).length;
	const visible = locations.filter((l) =>
		filter === "all" ? true : filter === "todo" ? !l.outcome : !!l.outcome,
	);

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
						{logged}/{locations.length} logged
					</span>
					<AddLocationDialog runId={runId} />
				</div>
			</div>

			{locations.length === 0 && (
				<p className="text-sm text-muted-foreground">
					No locations for this game yet. Add your own with "Add location".
				</p>
			)}

			<div className="divide-y rounded-lg border">
				{visible.map((loc) => (
					<EncounterRow
						key={`${loc.locationId}:${loc.encounterId ?? "new"}:${loc.outcome}:${loc.speciesId}`}
						runId={runId}
						row={loc}
						species={species}
					/>
				))}
			</div>
		</div>
	);
}

function EncounterRow({
	runId,
	row,
	species,
}: {
	runId: number;
	row: LocationRow;
	species: SpeciesOption[];
}) {
	const [speciesId, setSpeciesId] = useState(row.speciesId);
	const [nickname, setNickname] = useState(row.nickname ?? "");
	const [outcome, setOutcome] = useState<EncounterOutcome | null>(row.outcome);

	const [save, saving] = useAction(useServerFn(saveEncounterFn));
	const [clear, clearing] = useAction(useServerFn(clearEncounterFn));
	const [remove, removing] = useAction(useServerFn(deleteCustomLocationFn));
	const busy = saving || clearing || removing;

	const persist = (next: {
		speciesId: number | null;
		nickname: string;
		outcome: EncounterOutcome | null;
	}) => {
		if (!next.outcome) return;
		save({
			data: {
				runId,
				locationId: row.locationId,
				speciesId: next.speciesId,
				nickname: next.nickname,
				outcome: next.outcome,
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
			</div>

			<SpeciesPicker
				species={species}
				value={speciesId}
				disabled={busy}
				onChange={(id) => {
					const nextOutcome = outcome ?? (id ? "caught" : null);
					setSpeciesId(id);
					setOutcome(nextOutcome);
					persist({ speciesId: id, nickname, outcome: nextOutcome });
				}}
			/>

			<Input
				value={nickname}
				placeholder="Nickname"
				disabled={busy || outcome !== "caught"}
				onChange={(e) => setNickname(e.target.value)}
				onBlur={() => {
					if (nickname !== (row.nickname ?? "")) {
						persist({ speciesId, nickname, outcome });
					}
				}}
			/>

			<Select
				value={outcome ?? ""}
				disabled={busy}
				onValueChange={(v) => {
					const next = v as EncounterOutcome;
					setOutcome(next);
					persist({ speciesId, nickname, outcome: next });
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
							placeholder="Starter, Gift Eevee, Fossil…"
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
