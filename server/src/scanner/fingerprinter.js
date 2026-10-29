const crypto = require('crypto');

/**
 * Normalizes a URL by stripping transient query params and fragments
 * to ensure consistent deduplication of findings across duplicate crawls.
 */
const normalizeUrl = (rawUrl) => {
  try {
    const parsed = new URL(rawUrl);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return rawUrl;
  }
};

/**
 * Generates a deterministic SHA-256 fingerprint for finding deduplication.
 * 
 * @param {Object} params
 * @param {string} params.category - finding category
 * @param {string} params.title - title of the finding
 * @param {string} params.affectedUrl - URL where the finding occurred
 * @param {string} [params.keySignature] - Analyzer-specific signature (e.g. error name, header name, status code)
 * @returns {string} SHA-256 hex string
 */
const generateFingerprint = ({ category, title, affectedUrl, keySignature = '' }) => {
  const normUrl = normalizeUrl(affectedUrl);
  const data = `${category.trim().toLowerCase()}::${title.trim().toLowerCase()}::${normUrl}::${keySignature.trim().toLowerCase()}`;
  return crypto.createHash('sha256').update(data).digest('hex');
};

module.exports = {
  generateFingerprint,
  normalizeUrl
};
