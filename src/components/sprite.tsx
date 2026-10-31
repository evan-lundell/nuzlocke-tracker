import { cn } from "#/lib/utils";

export function Sprite({
	speciesId,
	name,
	className,
}: {
	speciesId: number | null;
	name?: string | null;
	className?: string;
}) {
	if (!speciesId) {
		return <div className={cn("size-10 shrink-0", className)} />;
	}
	return (
		<img
			src={`/sprites/${speciesId}.png`}
			alt={name ?? ""}
			loading="lazy"
			className={cn("size-10 shrink-0 [image-rendering:pixelated]", className)}
		/>
	);
}
