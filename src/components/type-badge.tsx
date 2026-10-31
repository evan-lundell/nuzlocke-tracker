import { cn } from "#/lib/utils";

const TYPE_COLORS: Record<string, string> = {
	normal: "#9fa19f",
	fire: "#e62829",
	water: "#2980ef",
	electric: "#fac000",
	grass: "#3fa129",
	ice: "#3dcef3",
	fighting: "#ff8000",
	poison: "#9141cb",
	ground: "#915121",
	flying: "#81b9ef",
	psychic: "#ef4179",
	bug: "#91a119",
	rock: "#afa981",
	ghost: "#704170",
	dragon: "#5060e1",
	dark: "#624d4e",
	steel: "#60a1b8",
	fairy: "#ef70ef",
};

export function TypeBadge({
	type,
	dimmed,
	title,
}: {
	type: string;
	dimmed?: boolean;
	title?: string;
}) {
	return (
		<span
			title={title}
			className={cn(
				"rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white transition-opacity",
				dimmed && "opacity-30",
			)}
			style={{ backgroundColor: TYPE_COLORS[type] ?? "#777" }}
		>
			{type}
		</span>
	);
}
