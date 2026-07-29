/**
 * Meta Pixel Utility for Blithe Web Portal
 * Pure production event tracking without dummy/test codes.
 */

export const META_PIXEL_ID = '2265492044286196';

// Helper to check if fbq is ready
export const isPixelLoaded = () => {
  return typeof window !== 'undefined' && typeof window.fbq === 'function';
};

// Helper to get active Meta Test Event Code (from URL parameter ?test_event_code=... or sessionStorage)
export const getStoredTestCode = () => {
  if (typeof window === 'undefined') return '';
  const urlParams = new URLSearchParams(window.location.search);
  const fromUrl = urlParams.get('test_event_code');
  if (fromUrl) {
    sessionStorage.setItem('meta_test_event_code', fromUrl);
    return fromUrl;
  }
  return sessionStorage.getItem('meta_test_event_code') || '';
};

export const setStoredTestCode = (code) => {
  if (typeof window === 'undefined') return;
  if (code) {
    sessionStorage.setItem('meta_test_event_code', code);
  } else {
    sessionStorage.removeItem('meta_test_event_code');
  }
};

/**
 * Track standard Meta Pixel event with console logging
 */
export const trackPixelEvent = (eventName, params = {}, options = {}) => {
  if (isPixelLoaded()) {
    try {
      const activeTestCode = options.test_event_code || getStoredTestCode();
      const finalOptions = activeTestCode ? { ...options, test_event_code: activeTestCode } : options;
      if (Object.keys(finalOptions).length > 0) {
        window.fbq('track', eventName, params, finalOptions);
      } else {
        window.fbq('track', eventName, params);
      }
      console.log(`%c[Meta Pixel] Standard event: ${eventName}`, 'color: #1877F2; font-weight: bold;', params);
      return true;
    } catch (err) {
      console.error(`[Meta Pixel] Error tracking standard event ${eventName}:`, err);
      return false;
    }
  }
  return false;
};

/**
 * Track custom Meta Pixel event
 */
export const trackPixelCustom = (customEventName, params = {}, options = {}) => {
  if (isPixelLoaded()) {
    try {
      const activeTestCode = options.test_event_code || getStoredTestCode();
      const finalOptions = activeTestCode ? { ...options, test_event_code: activeTestCode } : options;
      if (Object.keys(finalOptions).length > 0) {
        window.fbq('trackCustom', customEventName, params, finalOptions);
      } else {
        window.fbq('trackCustom', customEventName, params);
      }
      console.log(`%c[Meta Pixel] Custom event: ${customEventName}`, 'color: #7C3AED; font-weight: bold;', params);
      return true;
    } catch (err) {
      console.error(`[Meta Pixel] Error tracking custom event ${customEventName}:`, err);
      return false;
    }
  }
  return false;
};

// ─── PRODUCTION META PIXEL EVENTS ───────────────────────────────────────────

/**
 * 1. Home / Landing page View
 */
export const trackHomeLandingPageView = () => {
  const params = { page: 'Home / Landing page', domain: 'blithe.social' };
  return trackPixelEvent('PageView', params);
};

/**
 * 2. Event page view
 */
export const trackEventPageView = (event) => {
  if (!event) return false;

  let val = 0;
  if (typeof event.price === 'number') {
    val = event.price;
  } else if (typeof event.price === 'string') {
    const parsed = parseFloat(event.price.replace(/[^0-9.]/g, ''));
    if (!isNaN(parsed)) val = parsed;
  }

  const categoryName = event.category || event.categoryName || 'General Event';

  const params = {
    content_name: event.title || event.eventName || 'Event Details',
    content_category: categoryName,
    content_ids: [event.id || 'event-id'],
    content_type: 'product',
    value: val,
    currency: 'INR'
  };

  return trackPixelEvent('ViewContent', params);
};

/**
 * 2b. Track Category view event (kept for backwards compatibility)
 */
export const trackEventCategoryView = (event) => {
  return true;
};

/**
 * 3. Click Checkout Now Button
 */
export const trackClickCheckoutNow = (event, totalAmount = 0, numItems = 1) => {
  const params = {
    content_name: event?.title || event?.eventName || 'Event Booking',
    content_category: event?.category || 'Event',
    content_ids: [event?.id || 'event-id'],
    content_type: 'product',
    value: totalAmount || event?.price || 0,
    currency: 'INR',
    num_items: numItems
  };

  return trackPixelEvent('InitiateCheckout', params);
};

/**
 * 4. Click Pay Now Button
 */
export const trackClickPayNow = (bookingDetails = {}) => {
  const params = {
    content_name: bookingDetails?.eventName || 'Event Booking',
    content_ids: [bookingDetails?.bookingId || bookingDetails?.eventId || 'booking-id'],
    value: bookingDetails?.totalAmount || bookingDetails?.totalPrice || 0,
    currency: 'INR',
    num_items: bookingDetails?.numItems || bookingDetails?.totalQuantity || 1
  };

  return trackPixelEvent('AddPaymentInfo', params);
};

/**
 * 5. Signup
 */
export const trackSignup = (userData = {}) => {
  const params = {
    status: 'success',
    registration_method: userData?.method || 'web_checkout',
    user_name: userData?.name || '',
    user_email: userData?.email || ''
  };

  return trackPixelEvent('CompleteRegistration', params);
};

/**
 * Purchase event for completed booking
 */
export const trackPixelPurchase = (bookingId, totalAmount = 0, eventName = 'Event Booking', numItems = 1) => {
  const params = {
    content_name: eventName,
    content_ids: [bookingId],
    content_type: 'product',
    value: totalAmount,
    currency: 'INR',
    num_items: numItems
  };

  return trackPixelEvent('Purchase', params);
};

// Legacy exports for backwards compatibility
export const trackPixelViewContent = trackEventPageView;
export const trackPixelInitiateCheckout = trackClickCheckoutNow;
