/**
 * Firebase / Google Analytics (GA4) Utility for Blithe Web Portal
 * Strictly adds missing events matching Meta Pixel without altering existing analytics.
 */

import { logEvent } from 'firebase/analytics';
import { analytics } from '../firebase.js';
import { getLeadSourceProps } from '../services/leadService.js';

/**
 * Safe wrapper to log standard GA4 events with lead source parameters & console logging
 */
export const trackGAEvent = (eventName, params = {}) => {
  try {
    const leadProps = typeof getLeadSourceProps === 'function' ? getLeadSourceProps() : {};
    const fullParams = {
      ...params,
      ...leadProps,
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
 * 1. GA4 Standard: view_item (matches Meta Pixel ViewContent)
 */
export const trackGAViewItem = (event) => {
  if (!event) return false;

  let val = 0;
  if (typeof event.price === 'number') {
    val = event.price;
  } else if (typeof event.price === 'string') {
    const parsed = parseFloat(event.price.replace(/[^0-9.]/g, ''));
    if (!isNaN(parsed)) val = parsed;
  }

  const categoryName = event.category || event.categoryName || 'General Event';
  const eventTitle = event.title || event.eventName || 'Event Details';
  const eventId = event.id || 'event-id';

  const params = {
    currency: 'INR',
    value: val,
    items: [
      {
        item_id: eventId,
        item_name: eventTitle,
        item_category: categoryName,
        price: val,
        quantity: 1
      }
    ]
  };

  return trackGAEvent('view_item', params);
};

/**
 * 2. GA4 Standard: begin_checkout (matches Meta Pixel InitiateCheckout)
 */
export const trackGABeginCheckout = (event, totalAmount = 0, numItems = 1) => {
  if (!event) return false;

  let val = totalAmount;
  if (!val) {
    if (typeof event.price === 'number') {
      val = event.price;
    } else if (typeof event.price === 'string') {
      const parsed = parseFloat(event.price.replace(/[^0-9.]/g, ''));
      if (!isNaN(parsed)) val = parsed;
    }
  }

  const eventTitle = event.title || event.eventName || 'Event Booking';
  const categoryName = event.category || event.categoryName || 'Event';
  const eventId = event.id || 'event-id';

  const params = {
    currency: 'INR',
    value: val || 0,
    items: [
      {
        item_id: eventId,
        item_name: eventTitle,
        item_category: categoryName,
        price: val || 0,
        quantity: numItems || 1
      }
    ]
  };

  return trackGAEvent('begin_checkout', params);
};

/**
 * 3. GA4 Standard: sign_up (matches Meta Pixel CompleteRegistration)
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
 * 4. GA4 Standard: add_payment_info (matches Meta Pixel AddPaymentInfo)
 */
export const trackGAAPaymentInfo = (event, totalAmount = 0, numItems = 1, paymentType = 'razorpay') => {
  const eventTitle = event?.title || event?.eventName || 'Event Booking';
  const eventId = event?.id || 'event-id';

  const params = {
    currency: 'INR',
    value: totalAmount || 0,
    payment_type: paymentType,
    items: [
      {
        item_id: eventId,
        item_name: eventTitle,
        price: totalAmount || 0,
        quantity: numItems || 1
      }
    ]
  };

  return trackGAEvent('add_payment_info', params);
};

/**
 * 5. GA4 Standard: purchase (matches Meta Pixel Purchase)
 * Triggered on BookingSuccess after Firestore verification
 */
export const trackGAPurchase = (bookingId, bData = {}) => {
  if (!bookingId) return false;

  const totalAmount = bData.totalPrice || bData.totalAmount || 0;
  const eventName = bData.eventName || 'Event Booking';
  const eventId = bData.eventId || 'event-id';
  const numItems = bData.totalQuantity || bData.quantity || 1;
  const ticketPrice = bData.ticketPrice || (numItems > 0 ? (totalAmount / numItems) : totalAmount);

  const params = {
    transaction_id: String(bookingId),
    value: totalAmount,
    currency: 'INR',
    payment_status: bData.status || 'confirmed',
    items: [
      {
        item_id: eventId,
        item_name: eventName,
        price: ticketPrice,
        quantity: numItems
      }
    ]
  };

  return trackGAEvent('purchase', params);
};
