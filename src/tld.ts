import * as psl from "psl";

export type RemoveResult = {
  removed: boolean;
  result: string;
};

/**
 * Extract the domain name without the public suffix and subdomains
 * This handles both second-level domains (.co.uk) and attribute-type domains (.lg.jp)
 */
export function extractDomainName(hostname: string): string {
  try {
    const parsed = psl.parse(hostname);

    // Check if parsing failed
    if ("error" in parsed) {
      // Fallback: just remove the TLD
      const lastDotIdx = hostname.lastIndexOf(".");
      if (lastDotIdx > 0) {
        return hostname.substr(0, lastDotIdx);
      }
      return hostname;
    }

    // For PSL, we want the SLD (second level domain) part
    // For example: test.example.co.uk -> we want "test.example"
    // For example.lg.jp -> we want "example"

    if (parsed.subdomain && parsed.sld) {
      return `${parsed.subdomain}.${parsed.sld}`;
    } else if (parsed.sld) {
      return parsed.sld;
    }

    // Fallback
    const lastDotIdx = hostname.lastIndexOf(".");
    if (lastDotIdx > 0) {
      return hostname.substr(0, lastDotIdx);
    }
    return hostname;
  } catch (error) {
    // Fallback: just remove the TLD
    const lastDotIdx = hostname.lastIndexOf(".");
    if (lastDotIdx > 0) {
      return hostname.substr(0, lastDotIdx);
    }
    return hostname;
  }
}

/**
 * Extract just the second level domain (without subdomains)
 */
export function extractDomainNameIgnoreSubdomain(hostname: string): string {
  try {
    const parsed = psl.parse(hostname);

    // Check if parsing failed
    if ("error" in parsed) {
      // Fallback: extract last part before TLD
      const lastDotIdx = hostname.lastIndexOf(".");
      if (lastDotIdx > 0) {
        const withoutTld = hostname.substr(0, lastDotIdx);
        const secondLastDotIdx = withoutTld.lastIndexOf(".");
        if (secondLastDotIdx > 0) {
          return withoutTld.substr(secondLastDotIdx + 1);
        }
        return withoutTld;
      }
      return hostname;
    }

    // Return just the SLD (second level domain)
    if (parsed.sld) {
      return parsed.sld;
    }

    // Fallback
    const lastDotIdx = hostname.lastIndexOf(".");
    if (lastDotIdx > 0) {
      const withoutTld = hostname.substr(0, lastDotIdx);
      const secondLastDotIdx = withoutTld.lastIndexOf(".");
      if (secondLastDotIdx > 0) {
        return withoutTld.substr(secondLastDotIdx + 1);
      }
      return withoutTld;
    }
    return hostname;
  } catch (error) {
    // Fallback: extract last part before TLD
    const lastDotIdx = hostname.lastIndexOf(".");
    if (lastDotIdx > 0) {
      const withoutTld = hostname.substr(0, lastDotIdx);
      const secondLastDotIdx = withoutTld.lastIndexOf(".");
      if (secondLastDotIdx > 0) {
        return withoutTld.substr(secondLastDotIdx + 1);
      }
      return withoutTld;
    }
    return hostname;
  }
}

export function removeAttributeTypeDomain(domain: string): RemoveResult {
  try {
    const parsed = psl.parse(domain);

    // Check if parsing failed
    if ("error" in parsed) {
      return { removed: false, result: domain };
    }

    // Use PSL to determine if this is a multi-part TLD (attribute-type domain)
    // PSL handles all the complexity of determining valid public suffixes
    if (parsed.tld && parsed.tld.includes(".") && parsed.sld) {
      // Return subdomain + SLD if subdomain exists, otherwise just SLD
      if (parsed.subdomain && parsed.sld) {
        return { removed: true, result: `${parsed.subdomain}.${parsed.sld}` };
      } else {
        return { removed: true, result: parsed.sld };
      }
    }

    return { removed: false, result: domain };
  } catch (error) {
    return { removed: false, result: domain };
  }
}

export function removeSecondLevelDomain(domain: string): RemoveResult {
  try {
    const parsed = psl.parse(domain);

    // Check if parsing failed
    if ("error" in parsed) {
      return { removed: false, result: domain };
    }

    // Use PSL to determine if this is a multi-part TLD
    // PSL handles all the complexity of determining valid public suffixes
    if (parsed.tld && parsed.tld.includes(".") && parsed.sld) {
      // Return subdomain + SLD if subdomain exists, otherwise just SLD
      if (parsed.subdomain && parsed.sld) {
        return { removed: true, result: `${parsed.subdomain}.${parsed.sld}` };
      } else {
        return { removed: true, result: parsed.sld };
      }
    }

    return { removed: false, result: domain };
  } catch (error) {
    return { removed: false, result: domain };
  }
}
