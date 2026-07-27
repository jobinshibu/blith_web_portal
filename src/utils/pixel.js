/**
 * Meta Pixel Utility for Blithe Web Portal
 * Helps trigger and debug Meta Pixel events cleanly.
 */

// Helper to check if fbq is ready
export const isPixelLoaded = () => {
  return typeof window !== 'undefined' && typeof window.fbq === 'function';
};

/**
 * Track standard Meta Pixel event with console logging
 */
export const trackPixelEvent = (eventName, params = {}, options = {}) => {
  if (isPixelLoaded()) {
    try {
      window.fbq('track', eventName, params, options);
      console.log(`%c[Meta Pixel] Tracked standard event: ${eventName}`, 'color: #1877F2; font-weight: bold;', params);
      return true;
    } catch (err) {
      console.error(`[Meta Pixel] Error tracking event ${eventName}:`, err);
      return false;
    }
  } else {
    console.warn(`[Meta Pixel] fbq function not found on window object. Event '${eventName}' was not sent. Check if Pixel ID (1933447620923074) is initialized in index.html.`);
    return false;
  }
};

/**
 * Track custom Meta Pixel event
 */
export const trackPixelCustom = (customEventName, params = {}) => {
  if (isPixelLoaded()) {
    try {
      window.fbq('trackCustom', customEventName, params);
      console.log(`%c[Meta Pixel] Tracked custom event: ${customEventName}`, 'color: #7C3AED; font-weight: bold;', params);
      return true;
    } catch (err) {
      console.error(`[Meta Pixel] Error tracking custom event ${customEventName}:`, err);
      return false;
    }
  } else {
    console.warn(`[Meta Pixel] fbq function not found. Custom Event '${customEventName}' not sent.`);
    return false;
  }
};

/**
 * Standard ViewContent event for Event Details
 */
export const trackPixelViewContent = (event) => {
  if (!event) return false;
  
  let val = 0;
  if (typeof event.price === 'number') {
    val = event.price;
  } else if (typeof event.price === 'string') {
    const parsed = parseFloat(event.price.replace(/[^0-9.]/g, ''));
    if (!isNaN(parsed)) val = parsed;
  }

  return trackPixelEvent('ViewContent', {
    content_name: event.title || event.eventName || 'Event Details',
    content_category: event.category || 'Event',
    content_ids: [event.id || 'dummy-pixel-test'],
    content_type: 'product',
    value: val,
    currency: 'INR'
  });
};

/**
 * Standard InitiateCheckout event for Event Booking
 */
export const trackPixelInitiateCheckout = (event, totalAmount = 0, numItems = 1) => {
  return trackPixelEvent('InitiateCheckout', {
    content_name: event?.title || event?.eventName || 'Event Booking',
    content_category: event?.category || 'Event',
    content_ids: [event?.id || 'dummy-pixel-test'],
    content_type: 'product',
    value: totalAmount,
    currency: 'INR',
    num_items: numItems
  });
};

/**
 * Standard Purchase event for Booking Success
 */
export const trackPixelPurchase = (bookingId, totalAmount = 0, eventName = 'Event Booking', numItems = 1) => {
  return trackPixelEvent('Purchase', {
    content_name: eventName,
    content_ids: [bookingId || 'TEST-BOOKING-123'],
    content_type: 'product',
    value: totalAmount,
    currency: 'INR',
    num_items: numItems
  });
};
