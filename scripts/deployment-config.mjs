import { createHash } from 'node:crypto';

export function validAppsScriptUrl(value) {
  return typeof value === 'string' && /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(value);
}

export function deploymentConfig(publicEnv, deploymentEnv = process.env) {
  let apiUrl = publicEnv.VITE_APPS_SCRIPT_URL || '';
  const environment = deploymentEnv.VERCEL_ENV || 'local';
  if (environment === 'preview') {
    apiUrl = deploymentEnv.FITZONE_PREVIEW_APPS_SCRIPT_URL || '';
    const productionFingerprint = deploymentEnv.FITZONE_PRODUCTION_ENDPOINT_SHA256 || '';
    if (deploymentEnv.FITZONE_PREVIEW_SYNTHETIC !== '1' || !validAppsScriptUrl(apiUrl) ||
        !/^[a-f0-9]{64}$/.test(productionFingerprint) ||
        createHash('sha256').update(apiUrl).digest('hex') === productionFingerprint) {
      throw new Error('Preview blocked: configure a distinct synthetic staging endpoint and verified production endpoint fingerprint. See docs/SECURITY_PRODUCTION_CHECKLIST.md.');
    }
  }
  if ((apiUrl && !validAppsScriptUrl(apiUrl)) || (environment === 'production' && !apiUrl)) {
    throw new Error('VITE_APPS_SCRIPT_URL must be a Google Apps Script HTTPS /exec URL without query parameters.');
  }
  const lookupMode = publicEnv.VITE_MEMBER_LOOKUP_MODE || 'legacy';
  if (!['legacy', 'capability'].includes(lookupMode)) throw new Error('Invalid member lookup mode.');
  return { apiUrl, environment, lookupMode };
}
