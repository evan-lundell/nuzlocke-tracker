import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { Textarea } from "#/components/ui/textarea";
import { useAction } from "#/lib/use-action";
import { getGamesFn } from "#/server/refdata.functions";
import { createRunFn } from "#/server/runs.functions";

export const Route = createFileRoute("/runs/new")({
	loader: () => getGamesFn(),
	component: NewRunPage,
});

function NewRunPage() {
	const games = Route.useLoaderData();
	const navigate = useNavigate();
	const [createRun, pending] = useAction(useServerFn(createRunFn));
	const [name, setName] = useState("");
	const [gameId, setGameId] = useState("");
	const [rules, setRules] = useState("");

	const generations = Map.groupBy(games, (g) => g.generation);

	return (
		<form
			className="max-w-lg space-y-5"
			onSubmit={async (e) => {
				e.preventDefault();
				const run = await createRun({
					data: { name, gameId: Number(gameId), rules },
				});
				if (run) {
					navigate({ to: "/runs/$runId", params: { runId: String(run.id) } });
				}
			}}
		>
			<h1 className="text-2xl font-semibold">New run</h1>

			<div className="space-y-2">
				<Label htmlFor="name">Name</Label>
				<Input
					id="name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="FireRed hardcore attempt #3"
					required
					autoFocus
				/>
			</div>

			<div className="space-y-2">
				<Label htmlFor="game">Game</Label>
				<Select value={gameId} onValueChange={setGameId} required>
					<SelectTrigger id="game" className="w-full">
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
			</div>

			<div className="space-y-2">
				<Label htmlFor="rules">Rules (optional)</Label>
				<Textarea
					id="rules"
					value={rules}
					onChange={(e) => setRules(e.target.value)}
					placeholder={"Dupes clause\nShiny clause\nLevel caps"}
					rows={5}
				/>
			</div>

			<Button type="submit" disabled={pending || !name.trim() || !gameId}>
				Create run
			</Button>
		</form>
	);
}
