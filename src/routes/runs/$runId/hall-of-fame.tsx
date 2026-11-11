import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
	DownloadIcon,
	PlayIcon,
	RefreshCwIcon,
	TrophyIcon,
	XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Sprite } from "#/components/sprite";
import { TypeBadge } from "#/components/type-badge";
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
import type { HallOfFameMember } from "#/db/schema";
import { slugify } from "#/lib/download";
import {
	CARD_HEIGHT,
	CARD_WIDTH,
	type CardInfo,
	downloadCanvas,
	drawHallOfFameCard,
} from "#/lib/hall-of-fame-card";
import { useAction } from "#/lib/use-action";
import { cn } from "#/lib/utils";
import { getCaughtFn } from "#/server/encounters.functions";
import {
	enterHallOfFameFn,
	getHallOfFameFn,
	removeHallOfFameFn,
} from "#/server/hall-of-fame.functions";

export const Route = createFileRoute("/runs/$runId/hall-of-fame")({
	loader: async ({ params }) => {
		const runId = Number(params.runId);
		const [entry, caught] = await Promise.all([
			getHallOfFameFn({ data: { runId } }),
			getCaughtFn({ data: { runId } }),
		]);
		return { entry, party: caught.filter((m) => m.state === "party") };
	},
	component: HallOfFamePage,
});

const runRoute = getRouteApi("/runs/$runId");

function HallOfFamePage() {
	const { entry, party } = Route.useLoaderData();
	const run = runRoute.useLoaderData();
	const [enter, entering] = useAction(useServerFn(enterHallOfFameFn));
	const [ceremony, setCeremony] = useState(false);

	const induct = async () => {
		const result = await enter({ data: { runId: run.id } });
		if (result) setCeremony(true);
	};

	if (!entry) {
		return (
			<div className="space-y-4">
				<div className="space-y-1">
					<h2 className="font-semibold">Beat the game?</h2>
					<p className="text-sm text-muted-foreground">
						Enter your current party into the Hall of Fame. This saves a copy of
						the team as it is now and marks the run completed.
					</p>
				</div>
				{party.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						Your party is empty. Move Pokémon into it on the Team tab first.
					</p>
				) : (
					<>
						<div className="flex flex-wrap gap-2">
							{party.map((m) => (
								<div
									key={m.id}
									className="flex items-center gap-2 rounded-lg border py-1 pr-3 pl-1"
								>
									<Sprite speciesId={m.speciesId} name={m.speciesName} />
									<span className="text-sm font-medium">
										{m.nickname || m.speciesName}
									</span>
								</div>
							))}
						</div>
						<Button onClick={induct} disabled={entering}>
							<TrophyIcon /> Enter Hall of Fame
						</Button>
					</>
				)}
			</div>
		);
	}

	const info: CardInfo = {
		runName: run.name,
		gameName: run.gameName,
		inductedAt: new Date(entry.inductedAt),
		battlesWon: entry.battlesWon,
		deaths: entry.deaths,
		members: entry.members,
	};

	return (
		<div className="space-y-4">
			<HallOfFameCard
				info={info}
				filename={`${slugify(run.name, "run")}-hall-of-fame.png`}
			>
				<Button variant="outline" size="sm" onClick={() => setCeremony(true)}>
					<PlayIcon /> Replay ceremony
				</Button>
				<ReinductButton
					disabled={entering || party.length === 0}
					onConfirm={induct}
				/>
				<RemoveButton runId={run.id} />
			</HallOfFameCard>
			{ceremony && (
				<Ceremony members={entry.members} onDone={() => setCeremony(false)} />
			)}
		</div>
	);
}

function HallOfFameCard({
	info,
	filename,
	children,
}: {
	info: CardInfo;
	filename: string;
	children: React.ReactNode;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [ready, setReady] = useState(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: redraw when any card field changes
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		setReady(false);
		drawHallOfFameCard(canvas, info).then(() => setReady(true));
	}, [JSON.stringify(info)]);

	return (
		<div className="space-y-3">
			<canvas
				ref={canvasRef}
				width={CARD_WIDTH}
				height={CARD_HEIGHT}
				className="h-auto w-full max-w-3xl rounded-xl shadow-lg"
				aria-label="Hall of Fame card"
			/>
			<div className="flex flex-wrap gap-2">
				<Button
					size="sm"
					disabled={!ready}
					onClick={() =>
						canvasRef.current && downloadCanvas(canvasRef.current, filename)
					}
				>
					<DownloadIcon /> Download image
				</Button>
				{children}
			</div>
		</div>
	);
}

const STEP_MS = 1800;

/** Full-screen reveal: each member gets a moment in the spotlight, then the whole team. */
function Ceremony({
	members,
	onDone,
}: {
	members: HallOfFameMember[];
	onDone: () => void;
}) {
	const [step, setStep] = useState(0);
	const finale = step >= members.length;

	useEffect(() => {
		if (finale) return;
		const t = setTimeout(() => setStep(step + 1), STEP_MS);
		return () => clearTimeout(t);
	}, [step, finale]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onDone();
			else if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight") {
				e.preventDefault();
				setStep((s) => s + 1);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onDone]);

	const current = members[step];

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: keyboard handled on window
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Hall of Fame ceremony"
			className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center gap-8 overflow-hidden bg-[radial-gradient(ellipse_at_top,#2a2f66,#0a0c1c_70%)] p-6 text-[#f4f1e8]"
			onClick={() => (finale ? onDone() : setStep((s) => s + 1))}
		>
			<button
				type="button"
				aria-label="Close"
				className="absolute top-4 right-4 rounded-full p-2 text-white/70 hover:text-white"
				onClick={(e) => {
					e.stopPropagation();
					onDone();
				}}
			>
				<XIcon />
			</button>

			<h2 className="animate-in fade-in slide-in-from-top-4 text-3xl font-extrabold tracking-[0.3em] text-[#f5c542] drop-shadow-[0_0_18px_rgba(245,197,66,0.6)] duration-700 sm:text-5xl">
				HALL OF FAME
			</h2>

			{current ? (
				<div
					key={step}
					className="animate-in fade-in zoom-in-75 flex flex-col items-center gap-3 duration-700"
				>
					<div className="relative">
						<div className="absolute inset-x-0 bottom-2 mx-auto h-8 w-48 rounded-[50%] bg-[#f5c542]/30 blur-md" />
						<Sprite
							speciesId={current.speciesId}
							name={current.speciesName}
							className="relative size-48 sm:size-64"
						/>
					</div>
					<p className="text-3xl font-bold">
						{current.nickname || current.speciesName}
					</p>
					{current.nickname && current.speciesName && (
						<p className="text-white/60">{current.speciesName}</p>
					)}
					<div className="flex gap-1.5">
						{current.types.map((t) => (
							<TypeBadge key={t} type={t} />
						))}
					</div>
				</div>
			) : (
				<div className="animate-in fade-in zoom-in-90 flex flex-col items-center gap-6 duration-1000">
					<div className="grid grid-cols-3 gap-4 sm:gap-8">
						{members.map((m, i) => (
							<div
								key={m.metAt}
								className="animate-in fade-in slide-in-from-bottom-6 fill-mode-both flex flex-col items-center duration-700"
								style={{ animationDelay: `${i * 120}ms` }}
							>
								<Sprite
									speciesId={m.speciesId}
									name={m.speciesName}
									className="size-20 sm:size-32"
								/>
								<span className="text-sm font-semibold sm:text-base">
									{m.nickname || m.speciesName}
								</span>
							</div>
						))}
					</div>
					<p className="text-lg text-[#f5c542]">Congratulations, Champion!</p>
				</div>
			)}

			<div className="flex gap-2">
				{members.map((m, i) => (
					<span
						key={m.metAt}
						className={cn(
							"size-2 rounded-full transition-colors",
							i <= step ? "bg-[#f5c542]" : "bg-white/20",
						)}
					/>
				))}
			</div>
			<p className="text-xs text-white/40">
				{finale ? "Click to close" : "Click to skip ahead"}
			</p>
		</div>
	);
}

function ReinductButton({
	disabled,
	onConfirm,
}: {
	disabled: boolean;
	onConfirm: () => void;
}) {
	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button variant="outline" size="sm" disabled={disabled}>
					<RefreshCwIcon /> Re-enter current party
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Replace the Hall of Fame team?</AlertDialogTitle>
					<AlertDialogDescription>
						The saved team will be replaced with your party as it is now.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction onClick={onConfirm}>Replace</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

function RemoveButton({ runId }: { runId: number }) {
	const [remove, pending] = useAction(useServerFn(removeHallOfFameFn));
	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button variant="outline" size="sm" disabled={pending}>
					Remove
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Remove from the Hall of Fame?</AlertDialogTitle>
					<AlertDialogDescription>
						The saved team will be deleted. The run stays marked completed.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						className="bg-destructive text-white hover:bg-destructive/90"
						onClick={() => remove({ data: { runId } })}
					>
						Remove
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
