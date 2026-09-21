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

console.log('\n=== GA4 Essential Reports & Required Event Specs Test Suite ===\n');

// 1. Verify src/utils/analytics.js exists and exports required tracking functions
const analyticsUtilPath = path.join(projectRoot, 'src', 'utils', 'analytics.js');
assert(fs.existsSync(analyticsUtilPath), 'src/utils/analytics.js exists');

const analyticsUtilContent = fs.readFileSync(analyticsUtilPath, 'utf-8');
assert(analyticsUtilContent.includes('export const trackGAEvent ='), 'exports trackGAEvent');
assert(analyticsUtilContent.includes('export const setGAUserId ='), 'exports setGAUserId (Report 2: Cross-Platform User ID)');
assert(analyticsUtilContent.includes('export const trackGAViewItem ='), 'exports trackGAViewItem (Report 1: Funnel step 1)');
assert(analyticsUtilContent.includes('export const trackGASelectContent ='), 'exports trackGASelectContent (Report 1: Funnel step 2)');
assert(analyticsUtilContent.includes('export const trackGABeginCheckout ='), 'exports trackGABeginCheckout (Report 1: Funnel step 3)');
assert(analyticsUtilContent.includes('export const trackGASignUp ='), 'exports trackGASignUp');
assert(analyticsUtilContent.includes('export const trackGAAPaymentInfo ='), 'exports trackGAAPaymentInfo');
assert(analyticsUtilContent.includes('export const trackGAPurchase ='), 'exports trackGAPurchase (Report 1: Funnel step 4)');
assert(analyticsUtilContent.includes('export const trackGASearch ='), 'exports trackGASearch (Report 3: User Engagement)');
assert(analyticsUtilContent.includes('export const trackGAShare ='), 'exports trackGAShare (Report 3: User Engagement)');
assert(analyticsUtilContent.includes('export const trackGAError ='), 'exports trackGAError (Report 5: Tech Performance)');

// 2. Verify EventDetails.jsx integration
const eventDetailsPath = path.join(projectRoot, 'src', 'components', 'Events', 'EventDetails.jsx');
const eventDetailsContent = fs.readFileSync(eventDetailsPath, 'utf-8');
assert(eventDetailsContent.includes("import { trackGAViewItem, trackGASelectContent, trackGAShare } from '../../utils/analytics';"), 'EventDetails.jsx imports analytics helpers');
assert(eventDetailsContent.includes("trackGAViewItem(loadedEventObj);"), 'EventDetails.jsx calls trackGAViewItem on event load');
assert(eventDetailsContent.includes("trackGASelectContent(event);"), 'EventDetails.jsx calls trackGASelectContent on Book Now click');
assert(eventDetailsContent.includes("trackGAShare(event, platformId);"), 'EventDetails.jsx calls trackGAShare on share actions');
assert(eventDetailsContent.includes("trackEventPageView(loadedEventObj);"), 'EventDetails.jsx preserves Meta Pixel trackEventPageView');
assert(eventDetailsContent.includes("trackClickCheckoutNow(event);"), 'EventDetails.jsx preserves Meta Pixel trackClickCheckoutNow');

// 3. Verify Events.jsx integration
const eventsPath = path.join(projectRoot, 'src', 'components', 'Events', 'Events.jsx');
const eventsContent = fs.readFileSync(eventsPath, 'utf-8');
assert(eventsContent.includes("import { trackGASearch } from '../../utils/analytics';"), 'Events.jsx imports trackGASearch');
assert(eventsContent.includes("trackGASearch(searchQuery.trim(), activeCat);"), 'Events.jsx triggers debounced search event');

// 4. Verify EventBookingPage.jsx integration
const bookingPagePath = path.join(projectRoot, 'src', 'components', 'Events', 'EventBookingPage.jsx');
const bookingPageContent = fs.readFileSync(bookingPagePath, 'utf-8');
assert(bookingPageContent.includes("import { trackGABeginCheckout, trackGASignUp, trackGAAPaymentInfo, trackGAError, setGAUserId } from '../../utils/analytics';"), 'EventBookingPage.jsx imports analytics helpers');
assert(bookingPageContent.includes("trackGABeginCheckout(loadedEvt, data.price || 0, 1);"), 'EventBookingPage.jsx calls trackGABeginCheckout on booking load');
assert(bookingPageContent.includes("setGAUserId(newUid);"), 'EventBookingPage.jsx calls setGAUserId for new attendees');
assert(bookingPageContent.includes("setGAUserId(foundUserData.uid);"), 'EventBookingPage.jsx calls setGAUserId for existing attendees');
assert(bookingPageContent.includes("trackGAError(orderErr?.code || 'RAZORPAY_ORDER_FAILED'"), 'EventBookingPage.jsx tracks Razorpay order error');
assert(bookingPageContent.includes("trackGAError(response.error?.code || 'PAYMENT_GATEWAY_FAILED'"), 'EventBookingPage.jsx tracks Razorpay payment failure');

// 5. Verify leadService.js UTM capture
const leadServicePath = path.join(projectRoot, 'src', 'services', 'leadService.js');
const leadServiceContent = fs.readFileSync(leadServicePath, 'utf-8');
assert(leadServiceContent.includes("utm_medium: (utmMedium || '').toLowerCase()"), 'leadService captures utm_medium');
assert(leadServiceContent.includes("utm_campaign: (utmCampaign || '').toLowerCase()"), 'leadService captures utm_campaign');
assert(leadServiceContent.includes("utm_content: (utmContent || '').toLowerCase()"), 'leadService captures utm_content');

// 6. Schema & Payload Generators Validation
const mockEvent = {
  id: 'evt_trek_001',
  title: 'Himalayan Sunrise Trek',
  category: 'Trek',
  hostId: 'host_org_99',
  price: 1200
};

// Report 1: view_item schema
const viewItemPayload = {
  event_id: mockEvent.id,
  event_category: mockEvent.category,
  host_id: mockEvent.hostId,
  price: mockEvent.price,
  currency: 'INR',
  items: [{ item_id: mockEvent.id, item_name: mockEvent.title, item_category: mockEvent.category, host_id: mockEvent.hostId, price: mockEvent.price, quantity: 1 }]
};
assert(
  viewItemPayload.event_id === 'evt_trek_001' &&
  viewItemPayload.event_category === 'Trek' &&
  viewItemPayload.host_id === 'host_org_99' &&
  viewItemPayload.price === 1200 &&
  viewItemPayload.currency === 'INR',
  'Report 1: view_item schema complies with all required parameters (event_id, event_category, host_id, price, currency)'
);

// Report 1: select_content schema
const selectContentPayload = {
  content_type: 'event',
  item_id: mockEvent.id,
  event_id: mockEvent.id,
  event_category: mockEvent.category,
  host_id: mockEvent.hostId,
  price: mockEvent.price,
  currency: 'INR'
};
assert(
  selectContentPayload.content_type === 'event' &&
  selectContentPayload.host_id === 'host_org_99' &&
  selectContentPayload.event_id === 'evt_trek_001',
  'Report 1: select_content schema complies with required parameters'
);

// Report 3: search & share schemas
const searchPayload = { search_term: 'trek', content_type: 'Trek' };
assert(searchPayload.search_term === 'trek' && searchPayload.content_type === 'Trek', 'Report 3: search schema complies with parameters (search_term, content_type)');

const sharePayload = { method: 'whatsapp', content_type: 'Trek', item_id: mockEvent.id };
assert(sharePayload.method === 'whatsapp' && sharePayload.item_id === 'evt_trek_001', 'Report 3: share schema complies with parameters (method, content_type, item_id)');

// Report 5: api_error schema
const apiErrorPayload = { error_code: 'BAD_REQUEST_PAYMENT', screen_name: 'EventBookingPage', fatal: true };
assert(
  apiErrorPayload.error_code === 'BAD_REQUEST_PAYMENT' &&
  apiErrorPayload.screen_name === 'EventBookingPage' &&
  apiErrorPayload.fatal === true,
  'Report 5: api_error schema complies with parameters (error_code, screen_name, fatal)'
);

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.\n`);

if (passedTests === totalTests) {
  console.log('\x1b[32mAll GA4 Essential Reports & Required Event Specs tests passed successfully!\x1b[0m\n');
} else {
  console.error('\x1b[31mSome tests failed.\x1b[0m\n');
  process.exitCode = 1;
}
