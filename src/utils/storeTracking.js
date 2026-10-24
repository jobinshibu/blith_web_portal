/**
 * Utility to construct Google Play Store & Apple App Store URLs with ad/UTM tracking parameters.
 * 
 * - Google Play Store supports the `referrer` query parameter:
 *   e.g. https://play.google.com/store/apps/details?id=com.firstlogicmetalab.blith_user_app&referrer=utm_source%3Dfacebook%26utm_medium%3Dcpc...
 * - Apple App Store supports appending campaign/custom tracking query parameters directly:
 *   e.g. https://apps.apple.com/in/app/blithe/id6473627877?utm_source=facebook&utm_medium=cpc...
 * 
 * When a user arrives from an Ad (or previous navigation in the session),
 * all current URL params and tracked session parameters (UTMs, fbclid, ad_id, etc.) are captured
 * and forwarded to the store links.
 */

const DEFAULT_PLAY_STORE_BASE = 'https://play.google.com/store/apps/details?id=com.firstlogicmetalab.blith_user_app';
const DEFAULT_APP_STORE_BASE = 'https://apps.apple.com/in/app/blithe/id6473627877';

/**
 * Collects all ad, UTM, and referral tracking parameters from active URL search & sessionStorage.
 * @returns {Record<string, string>} Key-value map of tracking parameters
 */
export const getActiveTrackingParams = () => {
  if (typeof window === 'undefined') return {};

  const collected = {};

  // 1. First populate from sessionStorage (if previously captured upon landing)
  try {
    const sessionKeys = [
      ['blithe_utm_source', 'utm_source'],
      ['blithe_utm_medium', 'utm_medium'],
      ['blithe_utm_campaign', 'utm_campaign'],
      ['blithe_utm_term', 'utm_term'],
      ['blithe_utm_content', 'utm_content'],
      ['blithe_fbclid', 'fbclid'],
      ['blithe_ad_id', 'ad_id'],
      ['blithe_adset_id', 'adset_id'],
      ['blithe_campaign_id', 'campaign_id'],
      ['blithe_placement', 'placement'],
      ['blithe_site_source_name', 'site_source_name'],
      ['blithe_link_source', 'linkSource'],
      ['blithe_landing_event_id', 'eventId'],
    ];

    for (const [sKey, pKey] of sessionKeys) {
      const val = sessionStorage.getItem(sKey);
      if (val && val.trim() !== '') {
        collected[pKey] = val.trim();
      }
    }
  } catch (e) {
    console.warn('[storeTracking] Unable to read sessionStorage:', e);
  }

  // 2. Active URL query parameters override/supplement session values
  try {
    const searchParams = new URLSearchParams(window.location.search);
    for (const [key, value] of searchParams.entries()) {
      if (value && value.trim() !== '') {
        collected[key] = value.trim();
      }
    }
  } catch (e) {
    console.warn('[storeTracking] Unable to read window.location.search:', e);
  }

  return collected;
};

/**
 * Builds Google Play Store URL with parameters encoded in `referrer` parameter.
 * 
 * @param {string} [baseUrl] Base Google Play URL (optional)
 * @param {Record<string, string>} [extraParams] Extra key-values to pass (optional)
 * @returns {string} Fully formatted Google Play Store URL
 */
export const getTrackedPlayStoreUrl = (baseUrl = DEFAULT_PLAY_STORE_BASE, extraParams = {}) => {
  // If the database or caller provides the nonexistent/broken 'com.blithe' package ID, sanitize to the valid published app package
  if (!baseUrl || baseUrl.includes('id=com.blithe') || baseUrl.endsWith('/com.blithe')) {
    baseUrl = DEFAULT_PLAY_STORE_BASE;
  }

  const allParams = { ...getActiveTrackingParams(), ...extraParams };

  // Remove empty keys
  const cleanEntries = Object.entries(allParams).filter(([_, v]) => v !== undefined && v !== null && String(v).trim() !== '');

  if (cleanEntries.length === 0) {
    return baseUrl;
  }

  // Google Play accepts attribution parameters inside a single 'referrer' query param:
  // e.g. referrer=utm_source%3Dfacebook%26utm_medium%3Dcpc...
  const referrerSearch = new URLSearchParams();
  for (const [k, v] of cleanEntries) {
    referrerSearch.set(k, String(v));
  }

  const referrerString = referrerSearch.toString();

  // Check if baseUrl already has query params
  const separator = baseUrl.includes('?') ? '&' : '?';

  // If baseUrl already has a referrer param, append to it
  try {
    const url = new URL(baseUrl);
    const existingReferrer = url.searchParams.get('referrer');
    if (existingReferrer) {
      const mergedReferrer = existingReferrer + '&' + referrerString;
      url.searchParams.set('referrer', mergedReferrer);
      return url.toString();
    }
    url.searchParams.set('referrer', referrerString);
    return url.toString();
  } catch {
    return `${baseUrl}${separator}referrer=${encodeURIComponent(referrerString)}`;
  }
};

/**
 * Builds Apple App Store URL with parameters appended as query parameters.
 * 
 * @param {string} [baseUrl] Base Apple App Store URL (optional)
 * @param {Record<string, string>} [extraParams] Extra key-values to pass (optional)
 * @returns {string} Fully formatted App Store URL
 */
export const getTrackedAppStoreUrl = (baseUrl = DEFAULT_APP_STORE_BASE, extraParams = {}) => {
  // If baseUrl is empty, or points to the incomplete Apple URL without the app ID (e.g. 'https://apps.apple.com/app/blithe' which returns 404),
  // fall back to the complete verified App Store link
  if (!baseUrl || !baseUrl.includes('id6473627877')) {
    baseUrl = DEFAULT_APP_STORE_BASE;
  }

  const allParams = { ...getActiveTrackingParams(), ...extraParams };

  const cleanEntries = Object.entries(allParams).filter(([_, v]) => v !== undefined && v !== null && String(v).trim() !== '');

  if (cleanEntries.length === 0) {
    return baseUrl;
  }

  try {
    const url = new URL(baseUrl);
    for (const [k, v] of cleanEntries) {
      url.searchParams.set(k, String(v));
    }
    return url.toString();
  } catch {
    const search = new URLSearchParams();
    for (const [k, v] of cleanEntries) {
      search.set(k, String(v));
    }
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}${search.toString()}`;
  }
};

/**
 * Fires analytics and pixel events when user clicks Play Store or App Store button.
 * Logs `app_download_click` event with source, platform, and ad parameters.
 * 
 * @param {'android'|'ios'} platform 
 * @param {string} [placement] Component/Location where click originated (e.g. 'event_details', 'checkout', 'profile')
 */
export const trackAppDownloadClick = (platform, placement = '') => {
  try {
    const params = getActiveTrackingParams();
    
    // Log to Firebase / Google Analytics (GA4)
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'app_download_click', {
        store_platform: platform,
        placement: placement || 'unknown',
        ...params
      });
    }

    // Log to Meta Pixel (Custom Event)
    if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
      window.fbq('trackCustom', 'AppDownloadClick', {
        store_platform: platform,
        placement: placement || 'unknown',
        ...params
      });
    }

    console.log(`%c[StoreTracking] App download click tracked (${platform}, ${placement}):`, 'color: #7C3AED; font-weight: bold;', params);
  } catch (err) {
    console.warn('[StoreTracking] Error logging app download click:', err);
  }
};

