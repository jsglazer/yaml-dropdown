/** Vault-relative path helpers. Posix separators only; no Node `path` involved. */

/**
 * The parent folder of a vault-relative file path, with no leading or trailing
 * slash. Files at the vault root yield the empty string.
 */
export function parentFolderPath(filePath: string): string {
	const cut = filePath.lastIndexOf("/");
	return cut === -1 ? "" : filePath.slice(0, cut);
}
