import { logEvent } from 'firebase/analytics';
import { analytics } from '../firebase';

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
  const querySource = params.get('source') || params.get('ref') || params.get('utf');

  if (utmSource || utmMedium || utmCampaign) {
    return {
      source: (utmSource || querySource || 'unknown').toLowerCase(),
      type: 'utm',
      utm_source: (utmSource || '').toLowerCase(),
      utm_medium: (utmMedium || '').toLowerCase(),
      utm_campaign: (utmCampaign || '').toLowerCase(),
      utm_term: (utmTerm || '').toLowerCase(),
      utm_content: (utmContent || '').toLowerCase()
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
      utm_content: ''
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
          landing_page: window.location.pathname
        });
      }
      return;
    }

    // 2. If no explicit URL source, check if we already have a stored source in this session.
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
