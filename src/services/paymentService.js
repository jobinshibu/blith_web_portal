/**
 * paymentService.js
 * Secure payment service for Razorpay integration.
 * 
 * SECURITY NOTICE:
 * Razorpay Key Secret is NEVER stored, referenced, or sent from the client-side.
 * Order creation is routed through the secure server-side backend proxy (razorpay-proxy.php),
 * which attaches authentication server-side and validates request parameters.
 */

// Public Key ID for initializing Razorpay Checkout modal in client browser
export const RAZORPAY_KEY_ID = "rzp_live_SBgnzuGhztmYSZ";

/**
 * Creates a Razorpay Order via the secure backend proxy.
 *
 * @param {number} amount - Order amount in INR (rupees)
 * @param {string} bookingId - Unique Blithe booking ID (e.g. BVB...)
 * @returns {Promise<Object>} The created Razorpay order object (e.g. { id, amount, currency, ... })
 */
export const createRazorpayOrder = async (amount, bookingId) => {
  if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
    throw new Error('Invalid order amount. Amount must be a positive number.');
  }

  const amountInPaise = Math.round(amount * 100);
  const cleanBookingId = String(bookingId || '').trim();

  // In production and local development, /razorpay-api routes to the secure backend proxy
  const endpoint = "/razorpay-api/v1/orders";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      amount: amountInPaise,
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
      notes: {
        bookingId: cleanBookingId
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Razorpay Order creation failed: ${response.status} - ${errText}`);
  }

  const orderData = await response.json();
  if (!orderData || !orderData.id) {
    throw new Error('Invalid response from payment gateway order service.');
  }

  return orderData;
};
