// Baked in at build time from Docker build args; empty in local dev
const version = import.meta.env.VITE_APP_VERSION || null;
const commit = import.meta.env.VITE_APP_COMMIT || null;
const repoUrl = import.meta.env.VITE_APP_REPO_URL || null;

export const appVersion = {
	version,
	commit,
	shortCommit: commit?.slice(0, 7) ?? null,
	commitUrl: commit && repoUrl ? `${repoUrl}/commit/${commit}` : null,
};

/** e.g. "v1.2.0 (abc1234)", "abc1234", or "dev" */
export function versionLabel() {
	const { version, shortCommit } = appVersion;
	if (version && shortCommit) return `${version} (${shortCommit})`;
	return version ?? shortCommit ?? "dev";
}
