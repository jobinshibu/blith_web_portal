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

console.log('\n=== Meta Pixel Integration & Event Test Suite ===\n');

// 1. Verify index.html Meta Pixel Integration
const indexPath = path.join(projectRoot, 'index.html');
const indexContent = fs.readFileSync(indexPath, 'utf-8');

assert(indexContent.includes("fbq('init', '2265492044286196');"), "index.html initialises Meta Pixel ID 2265492044286196");
assert(indexContent.includes('id=2265492044286196'), "index.html noscript fallback uses Meta Pixel ID 2265492044286196");
assert(!indexContent.includes('875322181980267'), "index.html no longer contains old Meta Pixel ID 875322181980267");
assert(indexContent.includes('test_event_code'), "index.html handles test_event_code parameter");

// 2. Setup mock browser environment for testing pixel.js
const mockStorage = {};
global.window = {
  location: { search: '?test_event_code=TEST13665' },
  fbq: function (...args) {
    global.window.fbqCalls.push(args);
  },
  fbqCalls: []
};
global.sessionStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, val) => { mockStorage[key] = String(val); },
  removeItem: (key) => { delete mockStorage[key]; }
};

// 3. Dynamically import pixel.js
const {
  META_PIXEL_ID,
  isPixelLoaded,
  getStoredTestCode,
  setStoredTestCode,
  trackPixelEvent,
  trackPixelCustom,
  trackHomeLandingPageView,
  trackEventPageView,
  trackEventCategoryView,
  trackClickCheckoutNow,
  trackClickPayNow,
  trackSignup,
  trackPixelPurchase
} = await import('../src/utils/pixel.js');

assert(META_PIXEL_ID === '2265492044286196', `META_PIXEL_ID exported correctly as 2265492044286196 (got ${META_PIXEL_ID})`);
assert(isPixelLoaded() === true, "isPixelLoaded detects window.fbq correctly");

// Test test code extraction from URL query parameter
const testCodeFromUrl = getStoredTestCode();
assert(testCodeFromUrl === 'TEST13665', `getStoredTestCode extracts TEST13665 from URL (got ${testCodeFromUrl})`);
assert(mockStorage['meta_test_event_code'] === 'TEST13665', "sessionStorage persists meta_test_event_code TEST13665");

// Test explicit setStoredTestCode
setStoredTestCode('TEST13665');
assert(getStoredTestCode() === 'TEST13665', "setStoredTestCode correctly stores TEST13665");

// 4. Test tracking functions with test event code TEST13665
global.window.fbqCalls = [];

trackHomeLandingPageView();
assert(global.window.fbqCalls.length === 1, "trackHomeLandingPageView triggers 1 standard fbq call (PageView)");
let pageViewCall = global.window.fbqCalls[0];
assert(pageViewCall[0] === 'track' && pageViewCall[1] === 'PageView', "PageView standard event fired");
assert(pageViewCall[3]?.test_event_code === 'TEST13665', "PageView event includes test_event_code: TEST13665");

// Test Event Page View tracking
global.window.fbqCalls = [];
trackEventPageView({ id: 'evt_101', title: 'Music Fest 2026', price: '₹500', category: 'Concert' });
assert(global.window.fbqCalls.length === 1, "trackEventPageView triggers 1 standard fbq call (ViewContent)");
assert(global.window.fbqCalls[0][0] === 'track' && global.window.fbqCalls[0][1] === 'ViewContent', "ViewContent standard event fired");
assert(global.window.fbqCalls[0][2]?.content_name === 'Music Fest 2026', "ViewContent payload has correct content_name");
assert(global.window.fbqCalls[0][2]?.content_category === 'Concert', "ViewContent payload has correct content_category");
assert(global.window.fbqCalls[0][3]?.test_event_code === 'TEST13665', "ViewContent event includes test_event_code: TEST13665");

// Test Dedicated Category View tracking (backwards compatibility)
global.window.fbqCalls = [];
trackEventCategoryView({ title: 'Music Fest 2026', category: 'Concert' });
assert(global.window.fbqCalls.length === 0, "trackEventCategoryView is no-op to prevent duplicate tracking");

// Test Checkout tracking
global.window.fbqCalls = [];
trackClickCheckoutNow({ id: 'evt_101', title: 'Music Fest 2026' }, 500, 1);
assert(global.window.fbqCalls.length === 1, "trackClickCheckoutNow triggers 1 standard fbq call (InitiateCheckout)");
assert(global.window.fbqCalls[0][0] === 'track' && global.window.fbqCalls[0][1] === 'InitiateCheckout', "InitiateCheckout standard event fired");
assert(global.window.fbqCalls[0][3]?.test_event_code === 'TEST13665', "InitiateCheckout event includes test_event_code: TEST13665");

// Test Pay Now tracking
global.window.fbqCalls = [];
trackClickPayNow({ bookingId: 'bk_202', eventName: 'Music Fest 2026', totalAmount: 500 });
assert(global.window.fbqCalls.length === 1, "trackClickPayNow triggers 1 standard fbq call (AddPaymentInfo)");
assert(global.window.fbqCalls[0][0] === 'track' && global.window.fbqCalls[0][1] === 'AddPaymentInfo', "AddPaymentInfo standard event fired");
assert(global.window.fbqCalls[0][3]?.test_event_code === 'TEST13665', "AddPaymentInfo event includes test_event_code: TEST13665");

// Test Signup tracking
global.window.fbqCalls = [];
trackSignup({ name: 'John Doe', email: 'john@example.com', method: 'web_checkout' });
assert(global.window.fbqCalls.length === 1, "trackSignup triggers 1 standard fbq call (CompleteRegistration)");
assert(global.window.fbqCalls[0][0] === 'track' && global.window.fbqCalls[0][1] === 'CompleteRegistration', "CompleteRegistration standard event fired");
assert(global.window.fbqCalls[0][3]?.test_event_code === 'TEST13665', "CompleteRegistration event includes test_event_code: TEST13665");

// Test Purchase tracking
global.window.fbqCalls = [];
trackPixelPurchase('bk_202', 500, 'Music Fest 2026', 1);
assert(global.window.fbqCalls.length === 1, "trackPixelPurchase triggers 1 standard fbq call (Purchase)");
assert(global.window.fbqCalls[0][0] === 'track' && global.window.fbqCalls[0][1] === 'Purchase', "Purchase standard event fired");
assert(global.window.fbqCalls[0][3]?.test_event_code === 'TEST13665', "Purchase event includes test_event_code: TEST13665");

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.\n`);
if (passedTests === totalTests) {
  console.log('\x1b[32mAll Meta Pixel integration and TEST13665 tests passed successfully!\x1b[0m\n');
} else {
  process.exit(1);
}
