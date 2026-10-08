import { logEvent } from 'firebase/analytics';
import { collection, addDoc, doc, setDoc, serverTimestamp, increment } from 'firebase/firestore';
import { analytics, db } from '../firebase';

/**
 * Safely reads a cookie value by name.
 * Used for extracting Meta 1st-party cookies (_fbp, _fbc).
 */
export const getCookie = (name) => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : null;
};

/**
 * Extracts all URL query parameters, Meta tracking details, and Meta cookies.
 * @returns {Object} Complete URL parameters, path details, and Meta tracking attributes.
 */
export const getAllUrlDetails = () => {
  if (typeof window === 'undefined') {
    return {
      full_url: '',
      path: '',
      hostname: '',
      parameters: {},
      meta_details: {},
      timestamp: new Date().toISOString()
    };
  }

  const urlParams = new URLSearchParams(window.location.search);
  const paramsObject = {};
  for (const [key, value] of urlParams.entries()) {
    paramsObject[key] = value;
  }

  const fbclid = urlParams.get('fbclid') || null;
  const utmSource = urlParams.get('utm_source') || null;
  const utmMedium = urlParams.get('utm_medium') || null;
  const utmCampaign = urlParams.get('utm_campaign') || null;
  const utmContent = urlParams.get('utm_content') || null;
  const utmTerm = urlParams.get('utm_term') || null;
  const adId = urlParams.get('ad_id') || urlParams.get('adid') || urlParams.get('ad_ID') || urlParams.get('adId') || null;
  const adsetId = urlParams.get('adset_id') || urlParams.get('adsetid') || urlParams.get('adset_ID') || urlParams.get('adSetId') || null;
  const campaignId = urlParams.get('campaign_id') || urlParams.get('campaignid') || urlParams.get('campaign_ID') || urlParams.get('campaignId') || null;
  const placement = urlParams.get('placement') || urlParams.get('meta_placement') || null;
  const siteSourceName = urlParams.get('site_source_name') || urlParams.get('source_name') || null;

  // Retrieve 1st-party Meta cookies created by Meta Pixel SDK
  const fbp = getCookie('_fbp');
  // _fbc is created by Meta Pixel when fbclid is present; construct fallback if not yet set in cookies
  const fbc = getCookie('_fbc') || (fbclid ? `fb.1.${Date.now()}.${fbclid}` : null);

  return {
    full_url: window.location.href,
    path: window.location.pathname,
    hostname: window.location.hostname,
    referrer: typeof document !== 'undefined' ? (document.referrer || 'none') : 'none',
    parameters: paramsObject,
    meta_details: {
      fbclid,
      fbp,
      fbc,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_content: utmContent,
      utm_term: utmTerm,
      ad_id: adId,
      adset_id: adsetId,
      campaign_id: campaignId,
      placement,
      site_source_name: siteSourceName
    },
    timestamp: new Date().toISOString()
  };
};

/**
/**
 * Extracts and inspects URL ad traffic parameters for debugging.
 * Note: Root 'ad_traffic_logs' collection writes are disabled per requirement.
 * All ad tracking is recorded strictly under users/{userId}/ad_traffic_logs subcollection.
 */
export const saveAdTrafficData = async () => {
  if (typeof window === 'undefined') return null;

  const trafficData = getAllUrlDetails();
  const meta = trafficData.meta_details;

  // Log all extracted details to console for developer inspection
  console.groupCollapsed(
    `%c[AdTraffic Tracking] Initialized Check (${window.location.pathname})`,
    'color: #0284C7; font-weight: bold;'
  );
  console.log('%cFull URL:%c', 'font-weight: bold;', '', trafficData.full_url);
  console.log('%cDetected Query Parameters:%c', 'font-weight: bold;', '', trafficData.parameters);
  console.log('%cMeta & UTM Details:%c', 'font-weight: bold;', '', meta);
  console.log('%cFull Payload:%c', 'font-weight: bold;', '', trafficData);
  console.groupEnd();

  // Expose on window for easy developer inspection in DevTools console
  window.__BLITHE_AD_TRAFFIC_DATA__ = trafficData;
  return null;
};

// In-memory set to lock concurrent in-flight writes
const inFlightUserLogs = new Set();

/**
 * Records an ad traffic log as a subcollection under a specific user document:
 * users/{userId}/ad_traffic_logs/{subDocId}
 * 
 * Also updates the parent user document with:
 * - utm_campaign
 * - utm_source
 * - ad_id
 * - adset_id
 * - referrer
 * - ad_traffic_log_id (the doc ID of that subcollection document)
 * 
 * @param {string} userId - Target user UID
 * @param {Object} options - Options object
 * @param {boolean} options.isLogin - true if existing user fetched/logged in, false if new user created
 * @returns {Promise<string|null>} The generated subcollection document ID
 */
export const recordUserAdTrafficLog = async (userId, { isLogin = false, eventId = null } = {}) => {
  if (!userId || typeof window === 'undefined') return null;

  try {
    const urlDetails = getAllUrlDetails();
    const meta = urlDetails?.meta_details || {};

    const utm_source = meta.utm_source || sessionStorage.getItem('blithe_utm_source') || '';
    const utm_campaign = meta.utm_campaign || sessionStorage.getItem('blithe_utm_campaign') || '';
    const ad_id = meta.ad_id || sessionStorage.getItem('blithe_ad_id') || '';
    const adset_id = meta.adset_id || sessionStorage.getItem('blithe_adset_id') || '';
    const referrer = urlDetails?.referrer || sessionStorage.getItem('blithe_lead_referrer') || (typeof document !== 'undefined' ? document.referrer : 'none') || 'none';
    const fbclid = meta.fbclid || sessionStorage.getItem('blithe_fbclid') || '';
    const campaign_id = meta.campaign_id || sessionStorage.getItem('blithe_campaign_id') || '';
    const placement = meta.placement || sessionStorage.getItem('blithe_placement') || '';
    const site_source_name = meta.site_source_name || sessionStorage.getItem('blithe_site_source_name') || '';
    const fbp = meta.fbp || sessionStorage.getItem('blithe_fbp') || getCookie('_fbp') || '';
    const fbc = meta.fbc || sessionStorage.getItem('blithe_fbc') || getCookie('_fbc') || '';

    // Verify using fbclid, ad_id, campaign_id that traffic is genuinely from Meta ads
    const isMetaAd = Boolean(fbclid || ad_id || campaign_id);
    if (!isMetaAd) {
      console.log(`[UserAdTraffic] No Meta ad tracking parameters (fbclid, ad_id, campaign_id) detected for user ${userId}. Skipping subcollection write and adclickcount.`);
      return null;
    }

    // Automatically resolve eventId from path if not explicitly provided
    const currentPath = urlDetails?.path || (typeof window !== 'undefined' ? window.location.pathname : '');
    const pathMatch = currentPath.match(/\/events\/([a-zA-Z0-9_-]+)/);
    const resolvedEventId = eventId || (pathMatch ? pathMatch[1] : null);

    // Deduplication check: use resolved parameters (including sessionStorage fallback)
    const adIdentifier = fbclid || ad_id || campaign_id || utm_campaign || utm_source || 'direct';
    const sessionKey = `blithe_user_traffic_logged_${userId}_${adIdentifier}_${resolvedEventId || 'global'}_${isLogin ? 'new' : 'returning'}`;

    // 1. Check in-flight lock (blocks concurrent calls within milliseconds)
    if (inFlightUserLogs.has(sessionKey)) {
      console.log(`[UserAdTraffic] Write already in-flight for (${sessionKey}). Skipping duplicate.`);
      return null;
    }

    // 2. Check sessionStorage deduplication
    const alreadyLoggedDocId = sessionStorage.getItem(sessionKey);
    if (alreadyLoggedDocId) {
      console.log(`[UserAdTraffic] Already logged for user ${userId} with ad key (${adIdentifier}). Skipping duplicate write. (ID: ${alreadyLoggedDocId})`);
      return alreadyLoggedDocId;
    }

    // 3. 5-second rate throttle per user to prevent duplicate writes within seconds
    const lastLogTimeKey = `blithe_user_traffic_last_time_${userId}`;
    const lastLogTime = parseInt(sessionStorage.getItem(lastLogTimeKey) || '0', 10);
    const now = Date.now();
    if (now - lastLogTime < 5000 && !isLogin) {
      console.log(`[UserAdTraffic] Throttled duplicate call within seconds for user ${userId}. Skipping duplicate.`);
      return null;
    }

    // Set locks immediately
    inFlightUserLogs.add(sessionKey);
    sessionStorage.setItem(lastLogTimeKey, String(now));

    // 1. Generate subcollection doc reference to obtain docId beforehand
    const subcollectionRef = collection(db, 'users', userId, 'ad_traffic_logs');
    const subDocRef = doc(subcollectionRef);
    const logDocId = subDocRef.id;

    // Immediately reserve sessionKey so subsequent fast calls see it right away
    sessionStorage.setItem(sessionKey, logDocId);

    const fullUrl = (meta.fbclid || meta.ad_id || meta.campaign_id)
      ? (urlDetails?.full_url || window.location.href)
      : (sessionStorage.getItem('blithe_lead_full_url') || urlDetails?.full_url || (typeof window !== 'undefined' ? window.location.href : ''));

    const logPayload = {
      // 1. Exact structure matching the main ad_traffic_logs format
      created_at: serverTimestamp(),
      full_url: fullUrl,
      hostname: urlDetails?.hostname || (typeof window !== 'undefined' ? window.location.hostname : ''),
      path: urlDetails?.path || (typeof window !== 'undefined' ? window.location.pathname : ''),
      referrer: referrer || 'none',
      timestamp: urlDetails?.timestamp || new Date().toISOString(),
      meta_details: {
        ad_id: ad_id || null,
        adset_id: adset_id || null,
        campaign_id: campaign_id || null,
        fbc: fbc || null,
        fbclid: fbclid || null,
        fbp: fbp || null,
        placement: placement || null,
        site_source_name: site_source_name || null,
        utm_campaign: utm_campaign || null,
        utm_content: meta.utm_content || sessionStorage.getItem('blithe_utm_content') || null,
        utm_medium: meta.utm_medium || sessionStorage.getItem('blithe_utm_medium') || null,
        utm_source: utm_source || null,
        utm_term: meta.utm_term || sessionStorage.getItem('blithe_utm_term') || null
      },
      parameters: urlDetails?.parameters || {},

      // 2. Subcollection and user tracking metadata (clean, no duplicate IDs)
      id: logDocId,
      userId: userId,
      eventId: resolvedEventId || null,
      login: Boolean(isLogin), // true for new user registration, false for existing user
      platform: 'web',

      // 3. Top-level query convenience fields
      utm_campaign: utm_campaign || null,
      utm_source: utm_source || null,
      ad_id: ad_id || null,
      adset_id: adset_id || null
    };

    await setDoc(subDocRef, logPayload);
    inFlightUserLogs.delete(sessionKey);
    console.log(`[UserAdTraffic] Wrote subcollection log users/${userId}/ad_traffic_logs/${logDocId} with login=${Boolean(isLogin)} eventId=${resolvedEventId}`);

    // 2. Update the parent user document:
    // If isLogin === true (initial user arrival): save original attribution and increment adclickcount.
    // If isLogin === false (repeat ad click): preserve all original attribution fields and ONLY increment adclickcount.
    const userDocRef = doc(db, 'users', userId);

    if (isLogin) {
      const parentUpdate = {
        utm_campaign: utm_campaign || '',
        utm_source: utm_source || '',
        ad_id: ad_id || '',
        adset_id: adset_id || '',
        referrer: referrer || '',
        full_url: fullUrl || (typeof window !== 'undefined' ? window.location.href : ''),
        ad_traffic_log_id: logDocId,
        adclickcount: increment(1)
      };

      if (resolvedEventId) {
        parentUpdate.eventId = resolvedEventId;
      }

      await setDoc(userDocRef, parentUpdate, { merge: true });
      console.log(`[UserAdTraffic] Initial user arrival (login=true): saved original attribution to users/${userId}:`, parentUpdate);
    } else {
      // Repeat ad click: do NOT touch attribution fields, only increment the adclickcount counter
      await setDoc(userDocRef, { adclickcount: increment(1) }, { merge: true });
      console.log(`[UserAdTraffic] Repeat ad click (login=false): preserved initial attribution and incremented only adclickcount on users/${userId}.`);
    }

    return logDocId;
  } catch (err) {
    console.error(`[UserAdTraffic] Error saving ad traffic subcollection for user ${userId}:`, err);
    return null;
  } finally {
    if (typeof sessionKey !== 'undefined') {
      inFlightUserLogs.delete(sessionKey);
    }
  }
};

// Expose on window for easy developer inspection in DevTools console
if (typeof window !== 'undefined') {
  window.getAllUrlDetails = getAllUrlDetails;
  window.saveAdTrafficData = saveAdTrafficData;
  window.recordUserAdTrafficLog = recordUserAdTrafficLog;
}

/**
 * Detects if there is an explicit lead source and UTM parameters in the URL query.
 * @returns {Object|null} Object containing the UTM parameters, source and type of detection, or null.
 */
const detectUrlSource = () => {
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get('utm_source');
  const utmMedium = params.get('utm_medium');
  const utmCampaign = params.get('utm_campaign');
  const utmTerm = params.get('utm_term');
  const utmContent = params.get('utm_content');
  const fbclid = params.get('fbclid');
  const adId = params.get('ad_id') || params.get('adid') || params.get('ad_ID') || params.get('adId');
  const adsetId = params.get('adset_id') || params.get('adsetid') || params.get('adset_ID') || params.get('adSetId');
  const campaignId = params.get('campaign_id') || params.get('campaignid') || params.get('campaign_ID') || params.get('campaignId');
  const placement = params.get('placement') || params.get('meta_placement');
  const siteSourceName = params.get('site_source_name') || params.get('source_name');
  const querySource = params.get('source') || params.get('ref') || params.get('utf');

  if (utmSource || utmMedium || utmCampaign) {
    return {
      source: (utmSource || querySource || 'unknown').toLowerCase(),
      type: 'utm',
      utm_source: (utmSource || '').toLowerCase(),
      utm_medium: (utmMedium || '').toLowerCase(),
      utm_campaign: (utmCampaign || '').toLowerCase(),
      utm_term: (utmTerm || '').toLowerCase(),
      utm_content: (utmContent || '').toLowerCase(),
      fbclid: fbclid || null,
      ad_id: adId || null,
      adset_id: adsetId || null,
      campaign_id: campaignId || null,
      placement: placement || null,
      site_source_name: siteSourceName || null
    };
  }
  if (fbclid) {
    return {
      source: 'facebook',
      type: 'meta_ad',
      utm_source: 'facebook',
      utm_medium: 'cpc',
      utm_campaign: (utmCampaign || '').toLowerCase(),
      utm_term: (utmTerm || '').toLowerCase(),
      utm_content: (utmContent || '').toLowerCase(),
      fbclid,
      ad_id: adId || null,
      adset_id: adsetId || null,
      campaign_id: campaignId || null,
      placement: placement || null,
      site_source_name: siteSourceName || null
    };
  }
  if (querySource) {
    return {
      source: querySource.toLowerCase(),
      type: 'query',
      utm_source: querySource.toLowerCase(),
      utm_medium: '',
      utm_campaign: '',
      utm_term: '',
      utm_content: '',
      fbclid: null,
      ad_id: null,
      adset_id: null,
      campaign_id: null,
      placement: null,
      site_source_name: null
    };
  }
  return null;
};

/**
 * Detects the lead source using the document referrer.
 * @returns {Object|null} Object containing the source and type of detection, or null.
 */
const detectReferrerSource = () => {
  const referrer = document.referrer;
  if (referrer) {
    try {
      const referrerUrl = new URL(referrer);
      const hostname = referrerUrl.hostname.toLowerCase();

      if (hostname.includes('instagram.com')) {
        return { source: 'instagram', type: 'referrer', referrer, utm_source: 'instagram', utm_medium: 'referral', utm_campaign: '' };
      }
      if (hostname.includes('facebook.com') || hostname.includes('fb.me')) {
        return { source: 'facebook', type: 'referrer', referrer, utm_source: 'facebook', utm_medium: 'referral', utm_campaign: '' };
      }
      if (hostname.includes('t.co') || hostname.includes('twitter.com') || hostname.includes('x.com')) {
        return { source: 'twitter', type: 'referrer', referrer, utm_source: 'twitter', utm_medium: 'referral', utm_campaign: '' };
      }
      // Return hostname for other external referrers
      if (hostname && !hostname.includes(window.location.hostname)) {
        return { source: hostname, type: 'referrer', referrer, utm_source: hostname, utm_medium: 'referral', utm_campaign: '' };
      }
    } catch (e) {
      console.warn("Failed to parse referrer URL:", e);
    }
  }
  return null;
};

/**
 * Checks and records lead source & UTM campaign properties during initial mount.
 */
export const initLeadTracking = () => {
  try {
    // 1. URL parameters have highest priority and always override/reset lead source.
    const urlSource = detectUrlSource();
    if (urlSource) {
      const alreadyLogged = sessionStorage.getItem('blithe_lead_source_logged');

      sessionStorage.setItem('blithe_lead_source', urlSource.source);
      sessionStorage.setItem('blithe_lead_referrer', document.referrer || 'none');
      sessionStorage.setItem('blithe_lead_type', urlSource.type);
      sessionStorage.setItem('blithe_utm_source', urlSource.utm_source || urlSource.source);
      sessionStorage.setItem('blithe_utm_medium', urlSource.utm_medium || '');
      sessionStorage.setItem('blithe_utm_campaign', urlSource.utm_campaign || '');
      sessionStorage.setItem('blithe_utm_term', urlSource.utm_term || '');
      sessionStorage.setItem('blithe_utm_content', urlSource.utm_content || '');
      sessionStorage.setItem('blithe_lead_full_url', window.location.href);

      if (urlSource.fbclid) sessionStorage.setItem('blithe_fbclid', urlSource.fbclid);
      if (urlSource.ad_id) sessionStorage.setItem('blithe_ad_id', urlSource.ad_id);
      if (urlSource.adset_id) sessionStorage.setItem('blithe_adset_id', urlSource.adset_id);
      if (urlSource.campaign_id) sessionStorage.setItem('blithe_campaign_id', urlSource.campaign_id);
      if (urlSource.placement) sessionStorage.setItem('blithe_placement', urlSource.placement);
      if (urlSource.site_source_name) sessionStorage.setItem('blithe_site_source_name', urlSource.site_source_name);

      // Store 1st-party Meta cookies if available
      const fbp = getCookie('_fbp');
      const fbc = getCookie('_fbc') || (urlSource.fbclid ? `fb.1.${Date.now()}.${urlSource.fbclid}` : null);
      if (fbp) sessionStorage.setItem('blithe_fbp', fbp);
      if (fbc) sessionStorage.setItem('blithe_fbc', fbc);

      if (alreadyLogged !== urlSource.source) {
        sessionStorage.setItem('blithe_lead_source_logged', urlSource.source);
        sessionStorage.removeItem('blithe_landing_event_id');

        logEvent(analytics, 'lead_source_detected', {
          source: urlSource.source,
          lead_referrer: document.referrer || 'none',
          lead_type: urlSource.type,
          utm_source: urlSource.utm_source || urlSource.source,
          utm_medium: urlSource.utm_medium || '',
          utm_campaign: urlSource.utm_campaign || '',
          fbclid: urlSource.fbclid || '',
          ad_id: urlSource.ad_id || '',
          landing_page: window.location.pathname
        });
      }
      return;
    }

    // 3. If no explicit URL source, check if we already have a stored source in this session.
    const storedSource = sessionStorage.getItem('blithe_lead_source');
    if (!storedSource) {
      const refSource = detectReferrerSource();
      if (refSource) {
        sessionStorage.setItem('blithe_lead_source', refSource.source);
        sessionStorage.setItem('blithe_lead_referrer', refSource.referrer || 'none');
        sessionStorage.setItem('blithe_lead_type', refSource.type);
        sessionStorage.setItem('blithe_lead_source_logged', refSource.source);
        sessionStorage.setItem('blithe_utm_source', refSource.utm_source || refSource.source);
        sessionStorage.setItem('blithe_utm_medium', refSource.utm_medium || 'referral');
        sessionStorage.setItem('blithe_utm_campaign', '');
        sessionStorage.removeItem('blithe_landing_event_id');

        logEvent(analytics, 'lead_source_detected', {
          source: refSource.source,
          lead_referrer: refSource.referrer || 'none',
          lead_type: refSource.type,
          utm_source: refSource.utm_source || refSource.source,
          utm_medium: refSource.utm_medium || 'referral',
          utm_campaign: '',
          landing_page: window.location.pathname
        });
      }
    }
  } catch (err) {
    console.warn("Error initializing lead tracking:", err);
  }
};

/**
 * Retrieves the lead source for a specific event, ensuring it is only attributed
 * to the first event the user interacts with (either clicks or views first).
 */
export const getActiveLeadSource = (eventId) => {
  try {
    const leadSource = sessionStorage.getItem('blithe_lead_source');
    if (!leadSource) return null;

    let landingEventId = sessionStorage.getItem('blithe_landing_event_id');
    if (!landingEventId && eventId) {
      sessionStorage.setItem('blithe_landing_event_id', eventId);
      return leadSource;
    }

    if (landingEventId === eventId) {
      return leadSource;
    }
  } catch (err) {
    console.warn("Error in getActiveLeadSource:", err);
  }
  return null;
};

/**
 * Returns lead source and UTM parameters to be attached to standard analytics events.
 * @returns {Object} Tracking parameters for campaign attribution.
 */
export const getLeadSourceProps = () => {
  try {
    const source = sessionStorage.getItem('blithe_lead_source') || 'unknown';
    const referrer = sessionStorage.getItem('blithe_lead_referrer') || 'none';
    const type = sessionStorage.getItem('blithe_lead_type') || 'unknown';
    const utmSource = sessionStorage.getItem('blithe_utm_source') || (source !== 'unknown' ? source : '');
    const utmMedium = sessionStorage.getItem('blithe_utm_medium') || '';
    const utmCampaign = sessionStorage.getItem('blithe_utm_campaign') || '';
    const utmTerm = sessionStorage.getItem('blithe_utm_term') || '';
    const utmContent = sessionStorage.getItem('blithe_utm_content') || '';
    const fbclid = sessionStorage.getItem('blithe_fbclid') || '';
    const adId = sessionStorage.getItem('blithe_ad_id') || '';
    const campaignId = sessionStorage.getItem('blithe_campaign_id') || '';
    const fbp = sessionStorage.getItem('blithe_fbp') || getCookie('_fbp') || '';
    const fbc = sessionStorage.getItem('blithe_fbc') || getCookie('_fbc') || '';

    const props = {
      source: source,
      lead_referrer: referrer,
      lead_type: type
    };

    if (utmSource) props.utm_source = utmSource;
    if (utmMedium) props.utm_medium = utmMedium;
    if (utmCampaign) props.utm_campaign = utmCampaign;
    if (utmTerm) props.utm_term = utmTerm;
    if (utmContent) props.utm_content = utmContent;
    if (fbclid) props.fbclid = fbclid;
    if (adId) props.ad_id = adId;
    if (campaignId) props.campaign_id = campaignId;
    if (fbp) props.fbp = fbp;
    if (fbc) props.fbc = fbc;

    return props;
  } catch (err) {
    console.warn("Error in getLeadSourceProps:", err);
    return {
      source: 'unknown',
      lead_referrer: 'none',
      lead_type: 'unknown'
    };
  }
};
