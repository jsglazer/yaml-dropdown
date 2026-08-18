import type { Rule, ScopeType } from "./settings";
import { scopeMatches } from "./scope";

/**
 * Rule precedence: a strict three-tier, winner-takes-all resolution in increasing
 * order Folder => Class => File. There is no Global tier. The single highest-tier
 * rule matching a key supplies that key's complete value list — lists are never
 * merged, unioned, or concatenated across tiers. Within a tier, the first matching
 * rule in settings order wins.
 */

/** Highest precedence first. */
const TIER_ORDER: readonly ScopeType[] = ["file", "class", "folder"];

export interface MatchContext {
	/** The frontmatter key at the cursor. */
	readonly key: string;
	readonly filePath: string;
	readonly folderPath: string;
	readonly className: string | null;
	readonly caseInsensitiveKeys: boolean;
}

export function resolveRule(rules: readonly Rule[], context: MatchContext): Rule | null {
	for (const tier of TIER_ORDER) {
		for (const rule of rules) {
			if (!rule.enabled) continue;
			if (rule.scope.type !== tier) continue;
			if (!keyMatches(rule.key, context.key, context.caseInsensitiveKeys)) continue;
			if (!scopeMatches(rule.scope, context)) continue;
			return rule;
		}
	}
	return null;
}

function keyMatches(ruleKey: string, documentKey: string, caseInsensitive: boolean): boolean {
	if (!caseInsensitive) return ruleKey === documentKey;
	return ruleKey.toLowerCase() === documentKey.toLowerCase();
}
