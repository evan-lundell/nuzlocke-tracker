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
import { useAction } from "#/lib/use-action";
import { cn } from "#/lib/utils";
import {
	addGameLocationFn,
	deleteGameLocationFn,
	getGameLocationsFn,
	renameLocationFn,
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
	head: () => ({ meta: [{ title: "Locations · Nuzlocke Tracker" }] }),
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
				<h1 className="text-2xl font-semibold">Locations</h1>
				<p className="text-sm text-muted-foreground">
					Order, rename, hide or add locations for a game. Changes apply to
					every run of that game. Starter is always first.
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

	return (
		<div className="space-y-6">
			<AddLocationForm gameId={gameId} />

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
						Nothing ordered yet. Use "Order all" below, or add locations one at
						a time, then drag them into place.
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
									<SortableRow key={loc.id} loc={loc} position={i + 1}>
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
						Every location is ordered.
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
	children,
}: {
	loc: Loc;
	position: number;
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
						<span className="w-6 text-right text-xs text-muted-foreground tabular-nums">
							{position}
						</span>
					</>
				}
			>
				{children}
			</LocationRow>
		</li>
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
				{editing ? (
					<Input
						value={name}
						autoFocus
						className="h-8"
						aria-label="Location name"
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
				{loc.isCustom && !editing && (
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
				{loc.isCustom && loc.encounterCount === 0 && (
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

function AddLocationForm({ gameId }: { gameId: number }) {
	const [name, setName] = useState("");
	const [add, pending] = useAction(useServerFn(addGameLocationFn));

	return (
		<form
			className="flex max-w-md gap-2"
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
						Every location goes back to alphabetical. Names, hidden locations
						and encounters are kept.
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
