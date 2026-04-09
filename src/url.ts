import * as tld from "./tld";
import { GroupingRule } from "./customRules";

/**
 * getHost extracts the hostname from a URL (with www stripped).
 */
function getHost(urlStr: string): string {
  const m = urlStr.match(/https?:\/\/([^/]*)/);
  if (!m || !m[1]) return "";
  return m[1].replace(/^www\d?\./i, "");
}

/**
 * getPathSegments extracts path segments from a URL.
 * e.g. "https://docs.google.com/document/d/123" → ["document", "d", "123"]
 */
function getPathSegments(urlStr: string): string[] {
  const m = urlStr.match(/https?:\/\/[^/]+(\/.*?)(?:\?|#|$)/);
  if (!m || !m[1]) return [];
  return m[1].split("/").filter((s) => s !== "");
}

/**
 * getGroupingKey returns the grouping key for a URL, considering custom rules.
 * If a rule matches the URL's host, the first N path segments are appended.
 * @param urlStr The URL to get the grouping key for
 * @param domainName The already-computed domain name (from getDomainName or getDomainNameIgnoreSubDomain)
 * @param rules Custom grouping rules
 */
export function getGroupingKey(
  urlStr: string,
  domainName: string,
  rules: GroupingRule[]
): string {
  if (domainName === "") return "";
  const host = getHost(urlStr);
  for (const rule of rules) {
    if (host === rule.host || host.endsWith("." + rule.host)) {
      const segments = getPathSegments(urlStr);
      const pathParts = segments.slice(0, rule.pathDepth);
      if (pathParts.length > 0) {
        return domainName + "/" + pathParts.join("/");
      }
      break;
    }
  }
  return domainName;
}

/**
 * getDomainName returns domain name part of the url.
 * - ignore `www`
 * @param url
 * @returns
 */
export function getDomainName(url: string): string {
  let domainName = "";
  if (url === "") {
    return domainName;
  }

  const m = url.match(/https?:\/\/(.*)$/);
  if (m === null || m[1] === undefined || m[1] === "") {
    return domainName;
  }
  domainName = m[1];

  domainName = domainName.replace(/^www\d?\./i, "");

  const idx = domainName.indexOf("/");
  if (idx > 0) {
    domainName = domainName.substr(0, idx);
  }

  let removeRes = tld.removeSecondLevelDomain(domainName);
  if (removeRes.removed) {
    return removeRes.result;
  }

  removeRes = tld.removeAttributeTypeDomain(domainName);
  if (removeRes.removed) {
    return removeRes.result;
  }

  const lastDotIdx = domainName.lastIndexOf(".");
  if (lastDotIdx > 0) {
    domainName = domainName.substr(0, lastDotIdx);
  }

  return domainName;
}

/**
 * getDomainNameIgnoreSubDomain returns domain name part ignored sub-domain of the url.
 * - ignore `www`
 * - ignore sub-domain part
 * @param url
 * @returns
 */
export function getDomainNameIgnoreSubDomain(url: string): string {
  const fullDomainName = getDomainName(url);

  const lastDotIdx = fullDomainName.lastIndexOf(".");
  if (lastDotIdx < 0) {
    return fullDomainName;
  }
  return fullDomainName.substr(lastDotIdx + 1);
}

/**
 * getURLWithoutParameters returns URL without query parameters and hash.
 * @param url
 * @returns
 */
export function getURLWithoutParameters(url: string): string {
  if (url === "") {
    return url;
  }

  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
  } catch (error) {
    // Fallback for invalid URLs
    const questionMarkIndex = url.indexOf("?");
    const hashIndex = url.indexOf("#");

    let endIndex = url.length;
    if (questionMarkIndex !== -1 && hashIndex !== -1) {
      endIndex = Math.min(questionMarkIndex, hashIndex);
    } else if (questionMarkIndex !== -1) {
      endIndex = questionMarkIndex;
    } else if (hashIndex !== -1) {
      endIndex = hashIndex;
    }

    return url.substring(0, endIndex);
  }
}
