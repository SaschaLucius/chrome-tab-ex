import defaultRules from "./defaultRules";

const CUSTOM_RULES_STORAGE_KEY = "custom_grouping_rules";

export interface GroupingRule {
  host: string; // e.g., "docs.google.com"
  pathDepth: number; // number of path segments to include in grouping key
}

export async function getGroupingRules(): Promise<GroupingRule[]> {
  const result = await chrome.storage.local.get(CUSTOM_RULES_STORAGE_KEY);
  if (result[CUSTOM_RULES_STORAGE_KEY]) {
    return result[CUSTOM_RULES_STORAGE_KEY];
  }
  return defaultRules;
}

export async function saveGroupingRules(rules: GroupingRule[]): Promise<void> {
  await chrome.storage.local.set({ [CUSTOM_RULES_STORAGE_KEY]: rules });
}
