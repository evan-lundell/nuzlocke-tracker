/// <reference types="vite/client" />

interface ImportMetaEnv {
	// Set by the Docker build (see Dockerfile); unset in local dev
	readonly VITE_APP_VERSION?: string;
	readonly VITE_APP_COMMIT?: string;
	readonly VITE_APP_REPO_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
