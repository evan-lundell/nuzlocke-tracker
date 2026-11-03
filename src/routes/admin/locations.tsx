import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
	EyeIcon,
	EyeOffIcon,
	GripVerticalIcon,
	ListMinusIcon,
	ListPlusIcon,
	PencilIcon,
	PlusIcon,
	SwordsIcon,
	Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "#/components/ui/alert-dialog";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { parseLevelCap } from "#/lib/level-cap";
import { useAction } from "#/lib/use-action";
import { cn } from "#/lib/utils";
import {
	addGameBattleFn,
	addGameLocationFn,
	deleteGameLocationFn,
	getGameLocationsFn,
	renameLocationFn,
	setBattleLevelCapFn,
	setLocationHiddenFn,
	setLocationOrderFn,
} from "#/server/admin.functions";
import { getGamesFn } from "#/server/refdata.functions";

export const Route = createFileRoute("/admin/locations")({
	validateSearch: (search: Record<string, unknown>): { game?: number } => {
		const game = Number(search.game);
		return Number.isInteger(game) && game > 0 ? { game } : {};
	},
	loaderDeps: ({ search }) => ({ game: search.game }),
	loader: async ({ deps }) => {
		const [games, locations] = await Promise.all([
			getGamesFn(),
			deps.game ? getGameLocationsFn({ data: { gameId: deps.game } }) : null,
		]);
		return { games, locations };
	},
	head: () => ({ meta: [{ title: "Locations & battles · Nuzlocke Tracker" }] }),
	component: LocationsAdminPage,
});

type Loc = Awaited<ReturnType<typeof getGameLocationsFn>>[number];

function LocationsAdminPage() {
	const { games, locations } = Route.useLoaderData();
	const { game } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const generations = Map.groupBy(games, (g) => g.generation);

	return (
		<div className="space-y-5">
			<div className="space-y-1">
				<h1 className="text-2xl font-semibold">Locations & battles</h1>
				<p className="text-sm text-muted-foreground">
					Order, rename, hide or add locations and battles for a game. Drag
					rows, or type a row's number to move it there. Changes apply to every
					run of that game. Starter is always first.
				</p>
			</div>

			<Select
				value={game ? String(game) : ""}
				onValueChange={(v) => navigate({ search: { game: Number(v) } })}
			>
				<SelectTrigger className="w-full sm:w-72" aria-label="Game">
					<SelectValue placeholder="Pick a game" />
				</SelectTrigger>
				<SelectContent>
					{[...generations].map(([gen, gens]) => (
						<SelectGroup key={gen}>
							<SelectLabel>Generation {gen}</SelectLabel>
							{gens.map((g) => (
								<SelectItem key={g.id} value={String(g.id)}>
									{g.name}
								</SelectItem>
							))}
						</SelectGroup>
					))}
				</SelectContent>
			</Select>

			{game && locations && (
				<LocationEditor
					// Reset local order whenever the server data changes
					key={`${game}:${locations.map((l) => `${l.id}.${l.sortOrder}`).join()}`}
					gameId={game}
					locations={locations}
				/>
			)}
		</div>
	);
}

function LocationEditor({
	gameId,
	locations,
}: {
	gameId: number;
	locations: Loc[];
}) {
	// Local order (ids only) so drags render instantly; location details always
	// come from the latest server data
	const [orderedIds, setOrderedIds] = useState(() =>
		locations.filter((l) => l.sortOrder !== null).map((l) => l.id),
	);
	const byId = new Map(locations.map((l) => [l.id, l]));
	const ordered = orderedIds.flatMap((id) => byId.get(id) ?? []);
	const unordered = locations.filter((l) => !orderedIds.includes(l.id));
	const [saveOrder, saving] = useAction(useServerFn(setLocationOrderFn));

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const commit = (next: Loc[]) => {
		const ids = next.map((l) => l.id);
		setOrderedIds(ids);
		saveOrder({ data: { gameId, orderedIds: ids } });
	};

	const onDragEnd = ({ active, over }: DragEndEvent) => {
		if (!over || active.id === over.id) return;
		const from = ordered.findIndex((l) => l.id === active.id);
		const to = ordered.findIndex((l) => l.id === over.id);
		commit(arrayMove(ordered, from, to));
	};

	const moveTo = (id: number, position: number) => {
		const from = ordered.findIndex((l) => l.id === id);
		const to = Math.min(Math.max(position, 1), ordered.length) - 1;
		if (from !== to) commit(arrayMove(ordered, from, to));
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap gap-x-6 gap-y-2">
				<AddLocationForm gameId={gameId} />
				<AddBattleForm gameId={gameId} />
			</div>

			<section className="space-y-2">
				<div className="flex items-center justify-between gap-2">
					<h2 className="font-semibold">
						Ordered{" "}
						<span className="font-normal text-muted-foreground">
							{ordered.length}
						</span>
					</h2>
					{ordered.length > 0 && (
						<ClearOrderButton disabled={saving} onConfirm={() => commit([])} />
					)}
				</div>
				{ordered.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						Nothing ordered yet. Use "Order all" below, or add rows one at a
						time, then drag them into place.
					</p>
				) : (
					<DndContext
						// Stable id so dnd-kit's aria ids match between SSR and hydration
						id="location-order"
						sensors={sensors}
						collisionDetection={closestCenter}
						onDragEnd={onDragEnd}
					>
						<SortableContext
							items={ordered.map((l) => l.id)}
							strategy={verticalListSortingStrategy}
						>
							<ol className="divide-y rounded-lg border">
								{ordered.map((loc, i) => (
									<SortableRow
										key={loc.id}
										loc={loc}
										position={i + 1}
										onMove={(position) => moveTo(loc.id, position)}
									>
										<Button
											variant="ghost"
											size="icon"
											title="Remove from order"
											disabled={saving}
											onClick={() =>
												commit(ordered.filter((l) => l.id !== loc.id))
											}
										>
											<ListMinusIcon />
										</Button>
									</SortableRow>
								))}
							</ol>
						</SortableContext>
					</DndContext>
				)}
			</section>

			<section className="space-y-2">
				<div className="flex items-center justify-between gap-2">
					<h2 className="font-semibold">
						Unordered{" "}
						<span className="font-normal text-muted-foreground">
							{unordered.length} · alphabetical
						</span>
					</h2>
					{unordered.length > 0 && (
						<Button
							size="sm"
							variant="outline"
							disabled={saving}
							onClick={() => commit([...ordered, ...unordered])}
						>
							Order all
						</Button>
					)}
				</div>
				{unordered.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						Everything is ordered.
					</p>
				) : (
					<ul className="divide-y rounded-lg border">
						{unordered.map((loc) => (
							<li key={loc.id}>
								<LocationRow loc={loc}>
									<Button
										variant="ghost"
										size="icon"
										title="Add to end of order"
										disabled={saving}
										onClick={() => commit([...ordered, loc])}
									>
										<ListPlusIcon />
									</Button>
								</LocationRow>
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	);
}

function SortableRow({
	loc,
	position,
	onMove,
	children,
}: {
	loc: Loc;
	position: number;
	onMove: (position: number) => void;
	children: React.ReactNode;
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		setActivatorNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: loc.id });

	return (
		<li
			ref={setNodeRef}
			style={{ transform: CSS.Transform.toString(transform), transition }}
			className={cn(
				"bg-background",
				isDragging && "relative z-10 shadow-lg ring-1 ring-ring",
			)}
		>
			<LocationRow
				loc={loc}
				lead={
					<>
						<button
							ref={setActivatorNodeRef}
							type="button"
							className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing"
							aria-label={`Drag ${loc.locationName}`}
							{...attributes}
							{...listeners}
						>
							<GripVerticalIcon className="size-4" />
						</button>
						<PositionInput
							// Remount when the row moves so the field shows its new position
							key={position}
							position={position}
							label={`Position of ${loc.locationName}`}
							onMove={onMove}
						/>
					</>
				}
			>
				{children}
			</LocationRow>
		</li>
	);
}

/** The row's position number; type a new one and press Enter to move it. */
function PositionInput({
	position,
	label,
	onMove,
}: {
	position: number;
	label: string;
	onMove: (position: number) => void;
}) {
	const [value, setValue] = useState(String(position));

	const submit = () => {
		const next = Number.parseInt(value, 10);
		if (Number.isInteger(next) && next !== position) onMove(next);
		else setValue(String(position));
	};

	return (
		<input
			type="text"
			inputMode="numeric"
			aria-label={label}
			title="Type a position and press Enter to move"
			value={value}
			onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
			onFocus={(e) => e.currentTarget.select()}
			onBlur={submit}
			onKeyDown={(e) => {
				if (e.key === "Enter") e.currentTarget.blur();
				if (e.key === "Escape") {
					const input = e.currentTarget;
					setValue(String(position));
					// blur after the reset renders so submit sees the original value
					requestAnimationFrame(() => input.blur());
				}
			}}
			className="w-10 rounded border border-transparent bg-transparent px-1 py-0.5 text-right text-xs text-muted-foreground tabular-nums hover:border-input focus:border-input focus:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
		/>
	);
}

function LocationRow({
	loc,
	lead,
	children,
}: {
	loc: Loc;
	lead?: React.ReactNode;
	children: React.ReactNode;
}) {
	const [editing, setEditing] = useState(false);
	const [name, setName] = useState(loc.locationName);
	const [rename, renaming] = useAction(useServerFn(renameLocationFn));
	const [setHidden, hiding] = useAction(useServerFn(setLocationHiddenFn));
	const [remove, removing] = useAction(useServerFn(deleteGameLocationFn));
	const isBattle = loc.kind === "battle";
	const busy = renaming || hiding || removing;

	const finishRename = () => {
		setEditing(false);
		const trimmed = name.trim();
		if (trimmed && trimmed !== loc.locationName) {
			rename({ data: { locationId: loc.id, name: trimmed } });
		} else {
			setName(loc.locationName);
		}
	};

	return (
		<div className="flex min-h-12 items-center gap-2 px-2 py-1.5">
			{lead}
			<div className="flex min-w-0 flex-1 items-center gap-2">
				{isBattle && (
					<SwordsIcon
						className="size-4 shrink-0 text-muted-foreground"
						aria-label="Battle"
					/>
				)}
				{editing ? (
					<Input
						value={name}
						autoFocus
						className="h-8"
						aria-label="Name"
						onChange={(e) => setName(e.target.value)}
						onBlur={finishRename}
						onKeyDown={(e) => {
							if (e.key === "Enter") e.currentTarget.blur();
							if (e.key === "Escape") {
								setName(loc.locationName);
								setEditing(false);
							}
						}}
					/>
				) : (
					<span
						className={cn(
							"truncate",
							loc.hidden && "text-muted-foreground line-through",
						)}
					>
						{loc.locationName}
					</span>
				)}
				{loc.hidden && !editing && (
					<span className="text-xs text-muted-foreground">hidden</span>
				)}
				{isBattle && !editing && (
					<LevelCapInput
						// Remount when the saved cap changes so the field shows it
						key={loc.levelCap}
						locationId={loc.id}
						levelCap={loc.levelCap}
						name={loc.locationName}
					/>
				)}
				{loc.isCustom && !isBattle && !editing && (
					<span className="text-xs text-muted-foreground">added</span>
				)}
				{loc.encounterCount > 0 && !editing && (
					<span
						className="text-xs text-muted-foreground"
						title="Encounters logged here across all runs"
					>
						· {loc.encounterCount} logged
					</span>
				)}
				{loc.completionCount > 0 && !editing && (
					<span
						className="text-xs text-muted-foreground"
						title="Runs that have completed this battle"
					>
						· {loc.completionCount} completed
					</span>
				)}
			</div>
			<div className="flex shrink-0 gap-0.5">
				<Button
					variant="ghost"
					size="icon"
					title="Rename"
					disabled={busy}
					onClick={() => setEditing(true)}
				>
					<PencilIcon />
				</Button>
				<Button
					variant="ghost"
					size="icon"
					title={loc.hidden ? "Show in runs" : "Hide from runs"}
					disabled={busy}
					onClick={() =>
						setHidden({ data: { locationId: loc.id, hidden: !loc.hidden } })
					}
				>
					{loc.hidden ? <EyeOffIcon /> : <EyeIcon />}
				</Button>
				{children}
				{loc.isCustom && loc.encounterCount + loc.completionCount === 0 && (
					<Button
						variant="ghost"
						size="icon"
						title="Delete"
						disabled={busy}
						onClick={() => remove({ data: { locationId: loc.id } })}
					>
						<Trash2Icon />
					</Button>
				)}
			</div>
		</div>
	);
}

/**
 * A battle's level cap; saves on blur or Enter, and blank means no cap. An
 * out-of-range value goes back to the saved cap.
 */
function LevelCapInput({
	locationId,
	levelCap,
	name,
}: {
	locationId: number;
	levelCap: number | null;
	name: string;
}) {
	const saved = levelCap === null ? "" : String(levelCap);
	const [value, setValue] = useState(saved);
	const [save, saving] = useAction(useServerFn(setBattleLevelCapFn));

	return (
		<label className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
			Lv.
			<input
				type="text"
				inputMode="numeric"
				aria-label={`Level cap of ${name}`}
				placeholder="–"
				value={value}
				disabled={saving}
				onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
				onFocus={(e) => e.currentTarget.select()}
				onBlur={async () => {
					const next = parseLevelCap(value);
					if (value === saved) return;
					const result =
						next !== undefined &&
						(await save({ data: { locationId, levelCap: next } }));
					if (!result) setValue(saved);
				}}
				onKeyDown={(e) => {
					if (e.key === "Enter") e.currentTarget.blur();
					if (e.key === "Escape") setValue(saved);
				}}
				className="w-10 rounded border border-transparent bg-transparent px-1 py-0.5 text-right tabular-nums hover:border-input focus:border-input focus:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
			/>
		</label>
	);
}

function AddBattleForm({ gameId }: { gameId: number }) {
	const [name, setName] = useState("");
	const [levelCap, setLevelCap] = useState("");
	const [add, pending] = useAction(useServerFn(addGameBattleFn));
	const cap = parseLevelCap(levelCap);

	return (
		<form
			className="flex w-full max-w-md gap-2"
			onSubmit={async (e) => {
				e.preventDefault();
				if (cap === undefined) return;
				const result = await add({ data: { gameId, name, levelCap: cap } });
				if (result) {
					setName("");
					setLevelCap("");
				}
			}}
		>
			<Input
				value={name}
				onChange={(e) => setName(e.target.value)}
				placeholder="Add a battle, e.g. Brock"
				aria-label="New battle name"
			/>
			<Input
				value={levelCap}
				inputMode="numeric"
				className="w-24 shrink-0"
				onChange={(e) => setLevelCap(e.target.value.replace(/\D/g, ""))}
				placeholder="Level cap"
				aria-label="New battle level cap"
				aria-invalid={cap === undefined}
				title="1-100, or blank for no cap"
			/>
			<Button
				type="submit"
				variant="outline"
				disabled={pending || !name.trim() || cap === undefined}
			>
				<SwordsIcon /> Add
			</Button>
		</form>
	);
}

function AddLocationForm({ gameId }: { gameId: number }) {
	const [name, setName] = useState("");
	const [add, pending] = useAction(useServerFn(addGameLocationFn));

	return (
		<form
			className="flex w-full max-w-md gap-2"
			onSubmit={async (e) => {
				e.preventDefault();
				const result = await add({ data: { gameId, name } });
				if (result) setName("");
			}}
		>
			<Input
				value={name}
				onChange={(e) => setName(e.target.value)}
				placeholder="Add a location, e.g. Pallet Town"
				aria-label="New location name"
			/>
			<Button
				type="submit"
				variant="outline"
				disabled={pending || !name.trim()}
			>
				<PlusIcon /> Add
			</Button>
		</form>
	);
}

function ClearOrderButton({
	disabled,
	onConfirm,
}: {
	disabled: boolean;
	onConfirm: () => void;
}) {
	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button size="sm" variant="ghost" disabled={disabled}>
					Clear order
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Clear this game's order?</AlertDialogTitle>
					<AlertDialogDescription>
						Every location and battle goes back to alphabetical. Names, level
						caps, hidden rows, encounters and completed battles are kept.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction onClick={onConfirm}>Clear order</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
