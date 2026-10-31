import { ChevronsUpDownIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "#/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "#/components/ui/popover";
import { cn } from "#/lib/utils";
import { Sprite } from "./sprite";

export type SpeciesOption = { id: number; name: string };

function DupeBadge({ reason }: { reason: string }) {
	return (
		<Badge
			variant="outline"
			title={`Dupe: ${reason}`}
			className="px-1.5 text-muted-foreground"
		>
			Dupe
		</Badge>
	);
}

export function SpeciesPicker({
	species,
	value,
	onChange,
	disabled,
	dupeOf,
}: {
	species: SpeciesOption[];
	value: number | null;
	onChange: (id: number | null) => void;
	disabled?: boolean;
	/** Why a species is a dupe (e.g. "Pidgey on Route 1"), or undefined */
	dupeOf?: (id: number) => string | undefined;
}) {
	const [open, setOpen] = useState(false);
	const selected = species.find((s) => s.id === value);
	const selectedDupe = selected && dupeOf?.(selected.id);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					disabled={disabled}
					className="w-full justify-between font-normal"
				>
					<span className="flex min-w-0 items-center gap-1">
						{selected ? (
							<>
								<Sprite
									speciesId={selected.id}
									name={selected.name}
									className="-my-2 -ml-2 size-8"
								/>
								<span className="truncate">{selected.name}</span>
								{selectedDupe && <DupeBadge reason={selectedDupe} />}
							</>
						) : (
							<span className="text-muted-foreground">Pokémon…</span>
						)}
					</span>
					<ChevronsUpDownIcon className="opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-64 p-0" align="start">
				<Command>
					<CommandInput placeholder="Search Pokémon…" />
					<CommandList>
						<CommandEmpty>No Pokémon found.</CommandEmpty>
						<CommandGroup>
							{value !== null && (
								<CommandItem
									value="__clear"
									onSelect={() => {
										onChange(null);
										setOpen(false);
									}}
								>
									<span className="text-muted-foreground">Clear</span>
								</CommandItem>
							)}
							{species.map((s) => {
								const dupe = dupeOf?.(s.id);
								return (
									<CommandItem
										key={s.id}
										value={`${s.name} ${s.id}`}
										onSelect={() => {
											onChange(s.id);
											setOpen(false);
										}}
									>
										<Sprite
											speciesId={s.id}
											name={s.name}
											className={cn("-my-1 size-8", dupe && "opacity-50")}
										/>
										<span
											className={cn("flex-1", dupe && "text-muted-foreground")}
										>
											{s.name}
										</span>
										{dupe && <DupeBadge reason={dupe} />}
										<span className="text-xs text-muted-foreground">
											#{s.id}
										</span>
									</CommandItem>
								);
							})}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
