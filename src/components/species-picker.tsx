import { ChevronsUpDownIcon } from "lucide-react";
import { useState } from "react";
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
import { Sprite } from "./sprite";

export type SpeciesOption = { id: number; name: string };

export function SpeciesPicker({
	species,
	value,
	onChange,
	disabled,
}: {
	species: SpeciesOption[];
	value: number | null;
	onChange: (id: number | null) => void;
	disabled?: boolean;
}) {
	const [open, setOpen] = useState(false);
	const selected = species.find((s) => s.id === value);

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
							{species.map((s) => (
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
										className="-my-1 size-8"
									/>
									<span className="flex-1">{s.name}</span>
									<span className="text-xs text-muted-foreground">#{s.id}</span>
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
