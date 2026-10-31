import { cn } from "#/lib/utils";
import { TypeBadge } from "./type-badge";

/**
 * Picks which of a dual-type Pokémon's types counts for the no-duplicate-types
 * party rule. Single-type Pokémon just show their type (it's set automatically).
 */
export function RuleTypePicker({
	types,
	value,
	onChange,
	disabled,
}: {
	types: string[];
	value: string | null;
	onChange: (type: string) => void;
	disabled?: boolean;
}) {
	if (types.length === 1) {
		return (
			<div className="flex items-center">
				<TypeBadge type={types[0]} title="Counts for the type rule" />
			</div>
		);
	}

	return (
		<fieldset
			className="flex items-center gap-1"
			aria-label="Type that counts for the type rule"
		>
			{types.map((type) => (
				<button
					key={type}
					type="button"
					disabled={disabled}
					aria-pressed={value === type}
					onClick={() => onChange(type)}
					className={cn(
						"rounded focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
						value === type &&
							"ring-2 ring-foreground/70 ring-offset-1 ring-offset-background",
					)}
				>
					<TypeBadge type={type} dimmed={value !== null && value !== type} />
				</button>
			))}
			{value === null && (
				<span className="text-xs text-amber-600 dark:text-amber-400">pick</span>
			)}
		</fieldset>
	);
}
