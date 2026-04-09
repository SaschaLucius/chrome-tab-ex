import { GroupingRule } from "./customRules";

/**
 * Default grouping rules shipped with the extension.
 * These are used when no user-configured rules exist in storage.
 * Add entries here to pre-configure rules at build time.
 */
const defaultRules: GroupingRule[] = [
  { host: "docs.google.com", pathDepth: 1 },
  // Add more default rules below:
  // { host: "github.com", pathDepth: 1 },
];

export default defaultRules;
