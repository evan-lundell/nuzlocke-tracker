import {
	createFileRoute,
	Link,
	Outlet,
	useNavigate,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { RunStatusBadge } from "#/components/run-status-badge";
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
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { Textarea } from "#/components/ui/textarea";
import type { RunStatus } from "#/db/schema";
import { useAction } from "#/lib/use-action";
import { cn } from "#/lib/utils";
import { deleteRunFn, getRunFn, updateRunFn } from "#/server/runs.functions";

export const Route = createFileRoute("/runs/$runId")({
	loader: ({ params }) => getRunFn({ data: { id: Number(params.runId) } }),
	head: ({ loaderData }) => ({
		meta: [{ title: `${loaderData?.name ?? "Run"} · Nuzlocke Tracker` }],
	}),
	component: RunLayout,
});

function RunLayout() {
	const run = Route.useLoaderData();
	const { runId } = Route.useParams();

	return (
		<div className="space-y-5">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="space-y-1">
					<div className="flex items-center gap-2">
						<h1 className="text-2xl font-semibold">{run.name}</h1>
						<RunStatusBadge status={run.status} />
					</div>
					<p className="text-sm text-muted-foreground">{run.gameName}</p>
				</div>
				<div className="flex gap-2">
					<EditRunDialog run={run} />
					<DeleteRunButton runId={run.id} />
				</div>
			</div>

			{run.rules && (
				<details className="rounded-lg border px-3 py-2 text-sm">
					<summary className="cursor-pointer font-medium">Rules</summary>
					<p className="mt-2 whitespace-pre-wrap text-muted-foreground">
						{run.rules}
					</p>
				</details>
			)}

			<nav className="flex gap-1 border-b">
				{(
					[
						{ to: "/runs/$runId", label: "Encounters", exact: true },
						{ to: "/runs/$runId/team", label: "Team", exact: false },
					] as const
				).map((tab) => (
					<Link
						key={tab.to}
						to={tab.to}
						params={{ runId }}
						activeOptions={{ exact: tab.exact }}
						className={cn(
							"-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground",
							"data-[status=active]:border-primary data-[status=active]:text-foreground",
						)}
					>
						{tab.label}
					</Link>
				))}
			</nav>

			<Outlet />
		</div>
	);
}

function EditRunDialog({
	run,
}: {
	run: { id: number; name: string; rules: string; status: RunStatus };
}) {
	const [open, setOpen] = useState(false);
	const [name, setName] = useState(run.name);
	const [rules, setRules] = useState(run.rules);
	const [status, setStatus] = useState(run.status);
	const [updateRun, pending] = useAction(useServerFn(updateRunFn));

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (next) {
					setName(run.name);
					setRules(run.rules);
					setStatus(run.status);
				}
				setOpen(next);
			}}
		>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm">
					<PencilIcon /> Edit
				</Button>
			</DialogTrigger>
			<DialogContent>
				<form
					className="space-y-4"
					onSubmit={async (e) => {
						e.preventDefault();
						await updateRun({ data: { id: run.id, name, rules, status } });
						setOpen(false);
					}}
				>
					<DialogHeader>
						<DialogTitle>Edit run</DialogTitle>
					</DialogHeader>
					<div className="space-y-2">
						<Label htmlFor="edit-name">Name</Label>
						<Input
							id="edit-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							required
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="edit-status">Status</Label>
						<Select
							value={status}
							onValueChange={(v) => setStatus(v as RunStatus)}
						>
							<SelectTrigger id="edit-status" className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="active">Active</SelectItem>
								<SelectItem value="completed">Completed</SelectItem>
								<SelectItem value="failed">Failed</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label htmlFor="edit-rules">Rules</Label>
						<Textarea
							id="edit-rules"
							value={rules}
							onChange={(e) => setRules(e.target.value)}
							rows={5}
						/>
					</div>
					<DialogFooter>
						<Button type="submit" disabled={pending || !name.trim()}>
							Save
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function DeleteRunButton({ runId }: { runId: number }) {
	const navigate = useNavigate();
	const deleteRun = useServerFn(deleteRunFn);

	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button variant="outline" size="sm">
					<Trash2Icon /> Delete
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete this run?</AlertDialogTitle>
					<AlertDialogDescription>
						All encounters for this run will be deleted. This can't be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						className="bg-destructive text-white hover:bg-destructive/90"
						onClick={async () => {
							await deleteRun({ data: { id: runId } });
							navigate({ to: "/" });
						}}
					>
						Delete
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
