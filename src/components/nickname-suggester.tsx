import { useServerFn } from "@tanstack/react-start";
import { DicesIcon, Loader2Icon, RefreshCwIcon } from "lucide-react";
import { type RefObject, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "#/components/ui/popover";
import { cn } from "#/lib/utils";
import {
	type NicknameMode,
	suggestNicknamesFn,
} from "#/server/nicknames.functions";

/**
 * Dice button with nickname ideas for a row's catch: from Claude (free-text
 * theme) or the built-in lists (pick a theme). Remount it (via key) when the
 * species changes so old ideas don't linger.
 */
export function NicknameSuggester({
	runId,
	locationId,
	mode,
	themes,
	disabled,
	nicknameInput,
	onPick,
}: {
	runId: number;
	locationId: number;
	mode: NicknameMode;
	themes: string[];
	disabled: boolean;
	nicknameInput: RefObject<HTMLInputElement | null>;
	onPick: (name: string) => void;
}) {
	const suggest = useServerFn(suggestNicknamesFn);
	const [open, setOpen] = useState(false);
	const [names, setNames] = useState<string[]>([]);
	const [theme, setTheme] = useState("");
	const [loading, setLoading] = useState(false);
	// Ignore answers to requests that a reroll has since replaced
	const latest = useRef(0);
	const picked = useRef(false);

	const fetchNames = async (forTheme = theme) => {
		const id = ++latest.current;
		setLoading(true);
		try {
			const result = await suggest({
				data: { runId, locationId, theme: forTheme.trim() || undefined },
			});
			if (id === latest.current) setNames(result);
		} catch (err) {
			if (id === latest.current) {
				toast.error(
					err instanceof Error ? err.message : "Something went wrong",
				);
			}
		} finally {
			if (id === latest.current) setLoading(false);
		}
	};

	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (next) {
					picked.current = false;
					if (names.length === 0 && !loading) fetchNames();
				}
			}}
		>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="shrink-0"
					title="Suggest nicknames"
					aria-label="Suggest nicknames"
					disabled={disabled}
				>
					<DicesIcon />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				className="w-80 space-y-3"
				onCloseAutoFocus={(e) => {
					// After picking, carry on typing in the nickname box
					if (picked.current) {
						e.preventDefault();
						nicknameInput.current?.focus();
					}
				}}
			>
				<div className="flex min-h-9 flex-wrap items-center gap-1.5">
					{loading ? (
						<span className="flex items-center gap-2 text-sm text-muted-foreground">
							<Loader2Icon className="size-4 animate-spin" />{" "}
							{mode === "claude" ? "Thinking of names…" : "Rolling…"}
						</span>
					) : names.length === 0 ? (
						<span className="text-sm text-muted-foreground">
							No ideas yet. Try a reroll.
						</span>
					) : (
						names.map((name) => (
							<Button
								key={name}
								type="button"
								variant="secondary"
								size="sm"
								onClick={() => {
									picked.current = true;
									onPick(name);
									setOpen(false);
								}}
							>
								{name}
							</Button>
						))
					)}
				</div>
				{mode === "claude" ? (
					<form
						className="flex gap-2"
						onSubmit={(e) => {
							e.preventDefault();
							fetchNames();
						}}
					>
						<Input
							value={theme}
							onChange={(e) => setTheme(e.target.value)}
							placeholder="Theme (optional)"
							aria-label="Nickname theme"
							maxLength={60}
							className="h-8"
						/>
						<Button
							type="submit"
							size="sm"
							variant="outline"
							disabled={loading}
						>
							<RefreshCwIcon /> Reroll
						</Button>
					</form>
				) : (
					<div className="space-y-2 border-t pt-3">
						<fieldset className="flex flex-wrap gap-1" aria-label="Theme">
							{["", ...themes].map((t) => (
								<button
									key={t || "type"}
									type="button"
									aria-pressed={theme === t}
									onClick={() => {
										setTheme(t);
										fetchNames(t);
									}}
									className={cn(
										"rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground",
										theme === t &&
											"border-primary bg-primary text-primary-foreground hover:text-primary-foreground",
									)}
								>
									{t || "By type"}
								</button>
							))}
						</fieldset>
						<Button
							type="button"
							size="sm"
							variant="outline"
							className="w-full"
							disabled={loading}
							onClick={() => fetchNames()}
						>
							<RefreshCwIcon /> Reroll
						</Button>
					</div>
				)}
			</PopoverContent>
		</Popover>
	);
}
