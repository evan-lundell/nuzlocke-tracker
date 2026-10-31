import { TanStackDevtools } from "@tanstack/react-devtools";
import {
	createRootRoute,
	HeadContent,
	Link,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { Toaster } from "#/components/ui/sonner";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Nuzlocke Tracker" },
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{ rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
		],
	}),
	shellComponent: RootDocument,
	notFoundComponent: () => (
		<p className="text-muted-foreground">Nothing here.</p>
	),
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body className="min-h-screen bg-background text-foreground antialiased">
				<header className="border-b">
					<div className="mx-auto flex h-14 max-w-5xl items-center px-4">
						<Link to="/" className="font-semibold tracking-tight">
							Nuzlocke Tracker
						</Link>
						<nav className="ml-auto flex gap-4 text-sm">
							<Link
								to="/admin/locations"
								className="text-muted-foreground hover:text-foreground data-[status=active]:text-foreground"
							>
								Locations
							</Link>
						</nav>
					</div>
				</header>
				<main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
				<Toaster />
				<TanStackDevtools
					config={{ position: "bottom-right" }}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}
