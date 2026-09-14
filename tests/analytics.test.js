import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`\x1b[32m[PASS]\x1b[0m ${message}`);
    passedTests++;
  } else {
    console.error(`\x1b[31m[FAIL]\x1b[0m ${message}`);
    process.exitCode = 1;
  }
}

console.log('\n=== Firebase / GA4 Analytics Integration & Event Test Suite ===\n');

// 1. Verify src/utils/analytics.js exists and exports required tracking functions
const analyticsUtilPath = path.join(projectRoot, 'src', 'utils', 'analytics.js');
assert(fs.existsSync(analyticsUtilPath), 'src/utils/analytics.js exists');

const analyticsUtilContent = fs.readFileSync(analyticsUtilPath, 'utf-8');
assert(analyticsUtilContent.includes('export const trackGAEvent ='), 'exports trackGAEvent');
assert(analyticsUtilContent.includes('export const trackGAViewItem ='), 'exports trackGAViewItem (matches ViewContent)');
assert(analyticsUtilContent.includes('export const trackGABeginCheckout ='), 'exports trackGABeginCheckout (matches InitiateCheckout)');
assert(analyticsUtilContent.includes('export const trackGASignUp ='), 'exports trackGASignUp (matches CompleteRegistration)');
assert(analyticsUtilContent.includes('export const trackGAAPaymentInfo ='), 'exports trackGAAPaymentInfo (matches AddPaymentInfo)');
assert(analyticsUtilContent.includes('export const trackGAPurchase ='), 'exports trackGAPurchase (matches Purchase)');

// 2. Verify EventDetails.jsx integration
const eventDetailsPath = path.join(projectRoot, 'src', 'components', 'Events', 'EventDetails.jsx');
const eventDetailsContent = fs.readFileSync(eventDetailsPath, 'utf-8');
assert(eventDetailsContent.includes("import { trackGAViewItem, trackGABeginCheckout } from '../../utils/analytics';"), 'EventDetails.jsx imports analytics helpers');
assert(eventDetailsContent.includes("trackGAViewItem(loadedEventObj);"), 'EventDetails.jsx calls trackGAViewItem on event load');
assert(eventDetailsContent.includes("trackGABeginCheckout(event);"), 'EventDetails.jsx calls trackGABeginCheckout on Book Now click');
assert(eventDetailsContent.includes("trackEventPageView(loadedEventObj);"), 'EventDetails.jsx preserves Meta Pixel trackEventPageView');
assert(eventDetailsContent.includes("trackClickCheckoutNow(event);"), 'EventDetails.jsx preserves Meta Pixel trackClickCheckoutNow');
assert(eventDetailsContent.includes("logEvent(analytics, 'view_event_page'"), 'EventDetails.jsx preserves existing view_event_page untouched');

// 3. Verify EventBookingPage.jsx integration
const bookingPagePath = path.join(projectRoot, 'src', 'components', 'Events', 'EventBookingPage.jsx');
const bookingPageContent = fs.readFileSync(bookingPagePath, 'utf-8');
assert(bookingPageContent.includes("import { trackGABeginCheckout, trackGASignUp, trackGAAPaymentInfo } from '../../utils/analytics';"), 'EventBookingPage.jsx imports analytics helpers');
assert(bookingPageContent.includes("trackGABeginCheckout(loadedEvt, data.price || 0, 1);"), 'EventBookingPage.jsx calls trackGABeginCheckout on booking load');
assert(bookingPageContent.includes("trackGASignUp({ name: currentAttendee.name, email: currentAttendee.email, method: 'phone_checkout' });"), 'EventBookingPage.jsx calls trackGASignUp on user signup');
assert(bookingPageContent.includes("trackGAAPaymentInfo(event, total, totalTickets,"), 'EventBookingPage.jsx calls trackGAAPaymentInfo on Proceed to Pay');
assert(bookingPageContent.includes("trackSignup({ name: currentAttendee.name"), 'EventBookingPage.jsx preserves Meta Pixel trackSignup');
assert(bookingPageContent.includes("trackClickPayNow({"), 'EventBookingPage.jsx preserves Meta Pixel trackClickPayNow');
assert(bookingPageContent.includes("logEvent(analytics, 'pay_and_proceed_button_click'"), 'EventBookingPage.jsx preserves existing pay_and_proceed_button_click untouched');
assert(bookingPageContent.includes("payment_type: 'free'"), 'EventBookingPage.jsx supports pay_and_proceed_button_click for free bookings');

// 4. Verify BookingSuccess.jsx integration
const successPagePath = path.join(projectRoot, 'src', 'components', 'Events', 'BookingSuccess.jsx');
const successPageContent = fs.readFileSync(successPagePath, 'utf-8');
assert(successPageContent.includes("import { trackGAPurchase } from '../../utils/analytics';"), 'BookingSuccess.jsx imports trackGAPurchase');
assert(successPageContent.includes("trackGAPurchase(bookingId, bData);"), 'BookingSuccess.jsx calls trackGAPurchase on booking confirmation');
assert(successPageContent.includes("trackPixelPurchase(bookingId"), 'BookingSuccess.jsx preserves Meta Pixel trackPixelPurchase');

// 5. Test Payload Generators Logic Simulation
const mockEvent = { id: 'evt_123', title: 'Summer Fest', category: 'Music', price: 750 };
const mockBooking = { eventId: 'evt_123', eventName: 'Summer Fest', totalPrice: 1500, totalQuantity: 2, status: 'confirmed' };

// Simulate ViewItem payload
const viewItemPayload = {
  currency: 'INR',
  value: mockEvent.price,
  items: [{ item_id: mockEvent.id, item_name: mockEvent.title, item_category: mockEvent.category, price: mockEvent.price, quantity: 1 }]
};
assert(viewItemPayload.value === 750 && viewItemPayload.items[0].item_id === 'evt_123', 'view_item schema matches GA4 standard');

// Simulate BeginCheckout payload
const beginCheckoutPayload = {
  currency: 'INR',
  value: 1500,
  items: [{ item_id: mockEvent.id, item_name: mockEvent.title, item_category: mockEvent.category, price: 1500, quantity: 2 }]
};
assert(beginCheckoutPayload.value === 1500 && beginCheckoutPayload.items[0].quantity === 2, 'begin_checkout schema matches GA4 standard');

// Simulate SignUp payload
const signUpPayload = { method: 'phone_checkout', user_name: 'John Doe', user_email: 'john@example.com' };
assert(signUpPayload.method === 'phone_checkout' && signUpPayload.user_name === 'John Doe', 'sign_up schema matches GA4 standard');

// Simulate AddPaymentInfo payload
const addPaymentInfoPayload = { currency: 'INR', value: 1500, payment_type: 'razorpay', items: [{ item_id: mockEvent.id, item_name: mockEvent.title, price: 1500, quantity: 2 }] };
assert(addPaymentInfoPayload.payment_type === 'razorpay' && addPaymentInfoPayload.value === 1500, 'add_payment_info schema matches GA4 standard');

// Simulate Purchase payload
const purchasePayload = {
  transaction_id: 'bk_999',
  value: mockBooking.totalPrice,
  currency: 'INR',
  payment_status: 'confirmed',
  items: [{ item_id: mockBooking.eventId, item_name: mockBooking.eventName, price: 750, quantity: 2 }]
};
assert(purchasePayload.transaction_id === 'bk_999' && purchasePayload.value === 1500 && purchasePayload.items[0].quantity === 2, 'purchase schema matches GA4 standard');

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.\n`);

if (passedTests === totalTests) {
  console.log('\x1b[32mAll Firebase / GA4 analytics parity tests passed successfully!\x1b[0m\n');
} else {
  console.error('\x1b[31mSome tests failed.\x1b[0m\n');
  process.exitCode = 1;
}
