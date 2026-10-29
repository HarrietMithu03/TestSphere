const dns = require('dns');
const { promisify } = require('util');
const net = require('net');

const dnsLookup = promisify(dns.lookup);

/**
 * Checks if an IPv4 address falls into private, loopback, link-local, or reserved ranges
 */
const isPrivateIPv4 = (ip) => {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // Malformed IP, block
  }

  const [b0, b1] = parts;

  // 0.0.0.0/8 - Current network
  if (b0 === 0) return true;

  // 127.0.0.0/8 - Loopback
  if (b0 === 127) return true;

  // 10.0.0.0/8 - Private Class A
  if (b0 === 10) return true;

  // 172.16.0.0/12 - Private Class B (172.16.0.0 - 172.31.255.255)
  if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;

  // 192.168.0.0/16 - Private Class C
  if (b0 === 192 && b1 === 168) return true;

  // 169.254.0.0/16 - Link-local & Cloud Metadata (e.g., 169.254.169.254)
  if (b0 === 169 && b1 === 254) return true;

  // 224.0.0.0/4 - Multicast (224.0.0.0 - 239.255.255.255)
  if (b0 >= 224 && b0 <= 239) return true;

  // 240.0.0.0/4 - Reserved (240.0.0.0 - 255.255.255.254)
  if (b0 >= 240) return true;

  return false;
};

/**
 * Checks if an IPv6 address falls into loopback, unique local, link-local, or multicast
 */
const isPrivateIPv6 = (ip) => {
  const normalized = ip.toLowerCase();

  // Loopback ::1 and unspecified ::
  if (normalized === '::1' || normalized === '::') return true;

  // IPv4-mapped IPv6 (::ffff:192.168.1.1 or ::ffff:c0a8:0101)
  if (normalized.startsWith('::ffff:')) {
    const v4Part = normalized.replace('::ffff:', '');
    if (net.isIPv4(v4Part)) {
      return isPrivateIPv4(v4Part);
    }
    return true;
  }

  // Unique Local Address fc00::/7 (fc00:: to fdff::)
  if (/^f[cd][0-9a-f]{2}:/i.test(normalized)) return true;

  // Link-local Unicast fe80::/10 (fe80:: to febf::)
  if (/^fe[89ab][0-9a-f]:/i.test(normalized)) return true;

  // Multicast ff00::/8
  if (normalized.startsWith('ff')) return true;

  return false;
};

/**
 * Validates a target URL against SSRF and network isolation rules.
 * Resolves DNS to ensure host does not point to internal/private/loopback IPs.
 * 
 * @param {string} urlString 
 * @param {Object} options 
 * @param {boolean} options.allowLocalFixtures - Permits 127.0.0.1 or localhost when running controlled verification fixture
 * @returns {Promise<{ valid: boolean, error?: string, parsedUrl?: URL, resolvedIps?: string[] }>}
 */
const validateTargetUrl = async (urlString, options = {}) => {
  const allowLocal = options.allowLocalFixtures ?? (process.env.ALLOW_LOCAL_FIXTURES === 'true');

  if (!urlString || typeof urlString !== 'string') {
    return { valid: false, error: 'Target URL is missing or invalid.' };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(urlString.trim());
  } catch {
    return { valid: false, error: 'Target URL is malformed. Must include scheme, e.g., https://example.com' };
  }

  // 1. Enforce HTTP or HTTPS protocol only
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return {
      valid: false,
      error: `Protocol '${parsedUrl.protocol}' is not allowed. Only HTTP and HTTPS are permitted.`
    };
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  // 2. Reject internal and reserved domain suffixes
  if (
    hostname.endsWith('.internal') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.corp') ||
    hostname.endsWith('.home') ||
    hostname.endsWith('.lan')
  ) {
    return { valid: false, error: `Internal domain '${hostname}' is rejected for scanner safety.` };
  }

  // Check localhost / 127.0.0.1 special handling for test fixture
  const isLoopbackHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  if (isLoopbackHost) {
    if (allowLocal) {
      return {
        valid: true,
        parsedUrl,
        resolvedIps: ['127.0.0.1']
      };
    } else {
      return {
        valid: false,
        error: `Local loopback destination '${hostname}' is prohibited unless local testing fixture mode is enabled.`
      };
    }
  }

  // 3. If hostname is directly an IP address
  if (net.isIPv4(hostname)) {
    if (isPrivateIPv4(hostname)) {
      return { valid: false, error: `Target IP '${hostname}' is a private, loopback, or reserved address.` };
    }
    return { valid: true, parsedUrl, resolvedIps: [hostname] };
  }

  if (net.isIPv6(hostname)) {
    if (isPrivateIPv6(hostname)) {
      return { valid: false, error: `Target IPv6 '${hostname}' is a private or reserved address.` };
    }
    return { valid: true, parsedUrl, resolvedIps: [hostname] };
  }

  // 4. Resolve DNS records and verify all returned IP addresses
  try {
    const lookupResults = await dnsLookup(hostname, { all: true });
    if (!lookupResults || lookupResults.length === 0) {
      return { valid: false, error: `Could not resolve hostname '${hostname}'.` };
    }

    const resolvedIps = lookupResults.map((r) => r.address);

    for (const record of lookupResults) {
      const { address, family } = record;
      if (family === 4 && isPrivateIPv4(address)) {
        return {
          valid: false,
          error: `DNS resolution for '${hostname}' returned private/internal IP address (${address}). Scan rejected.`
        };
      }
      if (family === 6 && isPrivateIPv6(address)) {
        return {
          valid: false,
          error: `DNS resolution for '${hostname}' returned private IPv6 address (${address}). Scan rejected.`
        };
      }
    }

    return { valid: true, parsedUrl, resolvedIps };
  } catch (err) {
    return {
      valid: false,
      error: `DNS lookup failed for target host '${hostname}': ${err.message}`
    };
  }
};

/**
 * Validates if candidate URL stays within the allowed target scope.
 * 
 * @param {string} candidateUrl 
 * @param {string} allowedHost 
 * @param {boolean} allowSubdomains 
 * @returns {boolean}
 */
const isScopeAllowed = (candidateUrl, allowedHost, allowSubdomains = false) => {
  try {
    const parsed = new URL(candidateUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    const candidateHost = parsed.hostname.toLowerCase();
    const targetHost = allowedHost.toLowerCase();

    if (candidateHost === targetHost) {
      return true;
    }

    if (allowSubdomains && candidateHost.endsWith(`.${targetHost}`)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
};

module.exports = {
  validateTargetUrl,
  isScopeAllowed,
  isPrivateIPv4,
  isPrivateIPv6
};
