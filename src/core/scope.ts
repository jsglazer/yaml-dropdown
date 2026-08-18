import type { RuleScope } from "./settings";

/**
 * Scope matching. Folder patterns are RegExp sources; file and class patterns are
 * exact literals. All three are case-sensitive — `caseInsensitiveKeys` governs
 * frontmatter key matching only.
 */

export type CompileResult =
	| { readonly ok: true; readonly regex: RegExp }
	| { readonly ok: false; readonly error: string };

/**
 * Compile a user-entered folder pattern. Never throws: an invalid pattern comes
 * back as `{ ok: false }` so the settings tab can render the message inline and
 * the matcher can skip the rule.
 */
export function compileFolderPattern(pattern: string): CompileResult {
	try {
		return { ok: true, regex: new RegExp(pattern) };
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export interface ScopeTarget {
	/** Vault-relative path of the active file. */
	readonly filePath: string;
	/** Vault-relative parent folder; the empty string at vault root. */
	readonly folderPath: string;
	/** The note's `DropdownClass`, or null when it has none. */
	readonly className: string | null;
}

export function scopeMatches(scope: RuleScope, target: ScopeTarget): boolean {
	switch (scope.type) {
		case "file":
			return scope.pattern === target.filePath;
		case "class":
			return target.className !== null && scope.pattern === target.className;
		case "folder": {
			const compiled = compileFolderPattern(scope.pattern);
			// A rule whose pattern does not compile is skipped, never fatal.
			return compiled.ok ? compiled.regex.test(target.folderPath) : false;
		}
	}
}
