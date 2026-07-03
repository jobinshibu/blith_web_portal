import { logEvent } from 'firebase/analytics';
import { analytics } from '../firebase';

/**
 * Detects if there is an explicit lead source in the URL query parameters.
 * @returns {Object|null} Object containing the source and type of detection, or null.
 */
const detectUrlSource = () => {
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get('utm_source');
  const querySource = params.get('source') || params.get('ref');

  if (utmSource) {
    return { source: utmSource.toLowerCase(), type: 'utm' };
  }
  if (querySource) {
    return { source: querySource.toLowerCase(), type: 'query' };
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
        return { source: 'instagram', type: 'referrer', referrer };
      }
      if (hostname.includes('facebook.com') || hostname.includes('fb.me')) {
        return { source: 'facebook', type: 'referrer', referrer };
      }
      if (hostname.includes('t.co') || hostname.includes('twitter.com') || hostname.includes('x.com')) {
        return { source: 'twitter', type: 'referrer', referrer };
      }
      // Return hostname for other external referrers
      if (hostname && !hostname.includes(window.location.hostname)) {
        return { source: hostname, type: 'referrer', referrer };
      }
    } catch (e) {
      console.warn("Failed to parse referrer URL:", e);
    }
  }
  return null;
};

/**
 * Checks and records lead source during the initial application mount.
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

      if (alreadyLogged !== urlSource.source) {
        sessionStorage.setItem('blithe_lead_source_logged', urlSource.source);
        sessionStorage.removeItem('blithe_landing_event_id'); // reset landing event limit for new source link

        logEvent(analytics, 'lead_source_detected', {
          lead_source: urlSource.source,
          lead_referrer: document.referrer || 'none',
          lead_type: urlSource.type,
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
        sessionStorage.removeItem('blithe_landing_event_id');

        logEvent(analytics, 'lead_source_detected', {
          lead_source: refSource.source,
          lead_referrer: refSource.referrer || 'none',
          lead_type: refSource.type,
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
 *
 * @param {string} eventId - The ID of the event being clicked, viewed, or booked.
 * @returns {string|null} The lead source if this is the landing event, or null otherwise.
 */
export const getActiveLeadSource = (eventId) => {
  try {
    const leadSource = sessionStorage.getItem('blithe_lead_source');
    if (!leadSource) return null;

    let landingEventId = sessionStorage.getItem('blithe_landing_event_id');
    if (!landingEventId && eventId) {
      // First event interaction in this session, lock it to this event ID
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
 * Returns lead source parameters to be attached to standard analytics events.
 * @returns {Object} Tracking parameters for lead source attribution.
 */
export const getLeadSourceProps = () => {
  try {
    const source = sessionStorage.getItem('blithe_lead_source');
    if (source) {
      return {
        lead_source: source,
        lead_referrer: sessionStorage.getItem('blithe_lead_referrer') || 'none',
        lead_type: sessionStorage.getItem('blithe_lead_type') || 'none'
      };
    }
  } catch (err) {
    console.warn("Error getting lead source props:", err);
  }
  return {
    lead_source: 'direct',
    lead_referrer: 'none',
    lead_type: 'none'
  };
};
