import type { Rule, Run } from './types';

export const TYPE_LOCK_RULE_KEY = 'type-lock';

// PICK (default): the player chooses one of a dual-typed catch's two types.
// PRIMARY: the app auto-locks dual-typed catches to their primary type,
// no player decision required.
export type TypeLockMode = 'PRIMARY' | 'PICK';

export function isTypeLocked(run: Pick<Run, 'runRules'>): boolean {
  return run.runRules.some((runRule) => runRule.rule.key === TYPE_LOCK_RULE_KEY);
}

export function isTypeLockRule(rule: Pick<Rule, 'key'>): boolean {
  return rule.key === TYPE_LOCK_RULE_KEY;
}
