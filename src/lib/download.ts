/** Filename-safe version of a run name, e.g. "Mt. Moon Run!" -> "mt-moon-run". */
export function slugify(name: string, fallback: string) {
	const slug = name
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return slug || fallback;
}

/** Saves a value to the user's machine as a pretty-printed JSON file. */
export function downloadJson(filename: string, value: unknown) {
	const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], {
		type: "application/json",
	});
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}
