/**
 * Firebase / Google Analytics (GA4) Utility for Blithe Web Portal
 * Implements GA4 Essential Reports & Required Event Specs:
 * 1. Funnel Exploration (view_item, select_content, begin_checkout, purchase, event_rsvp)
 * 2. Cross-Platform Journey (setUserId)
 * 3. User Engagement & Feature Adoption (search, share, join_group, follow_host)
 * 4. User Acquisition & Attribution (UTM properties from leadService)
 * 5. Tech Performance & Exception Diagnostics (api_error)
 */

import { logEvent, setUserId } from 'firebase/analytics';
import { analytics } from '../firebase.js';
import { getLeadSourceProps } from '../services/leadService.js';

/**
 * Safe wrapper to log standard GA4 events with lead source parameters & console logging
 */
export const trackGAEvent = (eventName, params = {}) => {
  try {
    const leadProps = typeof getLeadSourceProps === 'function' ? getLeadSourceProps() : {};
    const fullParams = {
      ...leadProps,
      ...params,
      platform: 'web'
    };

    if (analytics) {
      logEvent(analytics, eventName, fullParams);
    }

    console.log(
      `%c[Firebase Analytics] Standard event: ${eventName}`,
      'color: #F58220; font-weight: bold;',
      fullParams
    );
    return true;
  } catch (err) {
    console.warn(`[Firebase Analytics] Error logging event ${eventName}:`, err);
    return false;
  }
};

/**
 * Sets the authenticated User ID in GA4 for Cross-Platform User Tracking
 */
export const setGAUserId = (userId) => {
  try {
    if (analytics && userId) {
      setUserId(analytics, String(userId));
      console.log(`%c[Firebase Analytics] setUserId: ${userId}`, 'color: #10B981; font-weight: bold;');
      return true;
    }
  } catch (err) {
    console.warn('[Firebase Analytics] Error setting user ID:', err);
  }
  return false;
};

/**
 * Helper to extract numeric price from event
 */
const parsePrice = (price) => {
  if (typeof price === 'number') return price;
  if (typeof price === 'string') {
    const parsed = parseFloat(price.replace(/[^0-9.]/g, ''));
    if (!isNaN(parsed)) return parsed;
  }
  return 0;
};

/**
 * 1. Funnel Exploration: view_item (when opening an event detail page)
 * Required Parameters: event_id, event_category, host_id, price, currency
 */
export const trackGAViewItem = (event) => {
  if (!event) return false;

  const val = parsePrice(event.price);
  const categoryName = event.category || event.categoryName || 'General';
  const eventTitle = event.title || event.eventName || 'Event Details';
  const eventId = event.id || 'event-id';
  const hostId = event.hostId || event.organizerId || event.userId || event.creatorId || 'unknown_host';

  const params = {
    event_id: eventId,
    event_category: categoryName,
    host_id: hostId,
    price: val,
    currency: 'INR',
    value: val,
    items: [
      {
        item_id: eventId,
        item_name: eventTitle,
        item_category: categoryName,
        host_id: hostId,
        price: val,
        quantity: 1
      }
    ]
  };

  return trackGAEvent('view_item', params);
};

/**
 * 2. Funnel Exploration: select_content (when tapping "Book" or "RSVP" button)
 * Required Parameters: event_id, event_category, host_id, price, currency, content_type, item_id
 */
export const trackGASelectContent = (event) => {
  if (!event) return false;

  const val = parsePrice(event.price);
  const categoryName = event.category || event.categoryName || 'General';
  const eventTitle = event.title || event.eventName || 'Event Details';
  const eventId = event.id || 'event-id';
  const hostId = event.hostId || event.organizerId || event.userId || event.creatorId || 'unknown_host';

  const params = {
    content_type: 'event',
    item_id: eventId,
    event_id: eventId,
    event_name: eventTitle,
    event_category: categoryName,
    host_id: hostId,
    price: val,
    currency: 'INR',
    value: val
  };

  return trackGAEvent('select_content', params);
};

/**
 * 3. Funnel Exploration: begin_checkout (when entering booking details / checkout screen)
 * Required Parameters: event_id, event_category, host_id, price, currency
 */
export const trackGABeginCheckout = (event, totalAmount = 0, numItems = 1) => {
  if (!event) return false;

  let val = totalAmount;
  if (!val) {
    val = parsePrice(event.price);
  }

  const eventTitle = event.title || event.eventName || 'Event Booking';
  const categoryName = event.category || event.categoryName || 'Event';
  const eventId = event.id || 'event-id';
  const hostId = event.hostId || event.organizerId || event.userId || event.creatorId || 'unknown_host';

  const params = {
    event_id: eventId,
    event_category: categoryName,
    host_id: hostId,
    currency: 'INR',
    value: val || 0,
    price: val || 0,
    items: [
      {
        item_id: eventId,
        item_name: eventTitle,
        item_category: categoryName,
        host_id: hostId,
        price: val || 0,
        quantity: numItems || 1
      }
    ]
  };

  return trackGAEvent('begin_checkout', params);
};

/**
 * 4. User Lifecycle: sign_up (matches Meta Pixel CompleteRegistration)
 */
export const trackGASignUp = (userData = {}) => {
  const params = {
    method: userData?.method || 'phone_checkout',
    user_name: userData?.name || '',
    user_email: userData?.email || ''
  };

  return trackGAEvent('sign_up', params);
};

/**
 * 5. Payment details entered: add_payment_info
 */
export const trackGAAPaymentInfo = (event, totalAmount = 0, numItems = 1, paymentType = 'razorpay') => {
  const eventTitle = event?.title || event?.eventName || 'Event Booking';
  const eventId = event?.id || 'event-id';
  const hostId = event?.hostId || event?.organizerId || event?.userId || event?.creatorId || 'unknown_host';
  const categoryName = event?.category || event?.categoryName || 'Event';

  const params = {
    currency: 'INR',
    value: totalAmount || 0,
    payment_type: paymentType,
    event_id: eventId,
    host_id: hostId,
    event_category: categoryName,
    items: [
      {
        item_id: eventId,
        item_name: eventTitle,
        item_category: categoryName,
        host_id: hostId,
        price: totalAmount || 0,
        quantity: numItems || 1
      }
    ]
  };

  return trackGAEvent('add_payment_info', params);
};

/**
 * 6. Funnel Exploration: purchase / event_rsvp (when booking succeeds)
 * Required Parameters: event_id, event_category, host_id, price, currency
 */
export const trackGAPurchase = (bookingId, bData = {}) => {
  if (!bookingId) return false;

  const totalAmount = bData.totalPrice || bData.totalAmount || 0;
  const eventName = bData.eventName || 'Event Booking';
  const eventId = bData.eventId || 'event-id';
  const categoryName = bData.category || bData.eventCategory || 'Event';
  const hostId = bData.hostId || bData.organizerId || bData.host_id || 'unknown_host';
  const numItems = bData.totalQuantity || bData.quantity || 1;
  const ticketPrice = bData.ticketPrice || (numItems > 0 ? (totalAmount / numItems) : totalAmount);

  const isFreeOrRsvp = totalAmount === 0 || bData.isRsvp === true;
  const eventNameGA = isFreeOrRsvp ? 'event_rsvp' : 'purchase';

  const params = {
    transaction_id: String(bookingId),
    value: totalAmount,
    price: ticketPrice,
    currency: 'INR',
    event_id: eventId,
    event_category: categoryName,
    host_id: hostId,
    payment_status: bData.status || 'confirmed',
    items: [
      {
        item_id: eventId,
        item_name: eventName,
        item_category: categoryName,
        host_id: hostId,
        price: ticketPrice,
        quantity: numItems
      }
    ]
  };

  // If RSVP, fire event_rsvp as requested in spec; also fire purchase for conversion revenue metrics
  if (isFreeOrRsvp) {
    trackGAEvent('event_rsvp', params);
  }
  return trackGAEvent('purchase', params);
};

/**
 * 7. User Engagement: search (when searching for activities or tags)
 * Required Parameters: search_term, content_type (e.g., "trek", "workshop"), item_id
 */
export const trackGASearch = (searchTerm, contentType = 'event', itemId = '') => {
  if (!searchTerm || typeof searchTerm !== 'string' || !searchTerm.trim()) return false;

  const params = {
    search_term: searchTerm.trim(),
    content_type: contentType
  };
  if (itemId) {
    params.item_id = itemId;
  }

  return trackGAEvent('search', params);
};

/**
 * 8. User Engagement: share (when sharing an event profile)
 * Required Parameters: content_type, item_id, method
 */
export const trackGAShare = (event, method = 'web_share') => {
  if (!event) return false;

  const eventId = event.id || 'event-id';
  const categoryName = event.category || event.categoryName || 'event';

  const params = {
    method: method,
    content_type: categoryName,
    item_id: eventId,
    event_id: eventId
  };

  return trackGAEvent('share', params);
};

/**
 * 9. User Engagement: join_group or follow_host (social interactions)
 */
export const trackGASocialInteraction = (actionType = 'follow_host', targetId = '', contentType = 'host') => {
  const eventName = actionType === 'join_group' ? 'join_group' : 'follow_host';
  const params = {
    content_type: contentType,
    item_id: targetId
  };

  return trackGAEvent(eventName, params);
};

/**
 * 10. Tech Performance & Exception Report: custom api_error
 * Triggers when payment gateways fail or an event booking fails to submit
 * Required Parameters: error_code, screen_name, fatal (boolean)
 */
export const trackGAError = (errorCode = 'UNKNOWN_ERROR', screenName = 'unknown_screen', fatal = false) => {
  const params = {
    error_code: String(errorCode),
    screen_name: String(screenName),
    fatal: Boolean(fatal)
  };

  return trackGAEvent('api_error', params);
};
