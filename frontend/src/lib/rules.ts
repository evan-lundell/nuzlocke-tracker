import type { Run } from './types';

const TYPE_LOCK_RULE_KEY = 'type-lock';

export function isTypeLocked(run: Pick<Run, 'runRules'>): boolean {
  return run.runRules.some((runRule) => runRule.rule.key === TYPE_LOCK_RULE_KEY);
}
