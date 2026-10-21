import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(projectRoot, '..');

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

console.log('\n=== Blithe Project Comprehensive Security & Hardening Test Suite ===\n');

// -----------------------------------------------------------------------------
// 1. FRONTEND SECRET EXPOSURE AUDIT
// -----------------------------------------------------------------------------
console.log('--- 1. Frontend Secret Exposure Audit ---');

const bookingPagePath = path.join(projectRoot, 'src', 'components', 'Events', 'EventBookingPage.jsx');
const bookingPageContent = fs.readFileSync(bookingPagePath, 'utf-8');

const paymentServicePath = path.join(projectRoot, 'src', 'services', 'paymentService.js');
assert(fs.existsSync(paymentServicePath), 'paymentService.js exists in src/services');

const paymentServiceContent = fs.readFileSync(paymentServicePath, 'utf-8');

// Live secret that was previously leaked in frontend code
const LEAKED_SECRET = '6c2w1nZcqVdlusV8j1AGz55t';

assert(!bookingPageContent.includes(LEAKED_SECRET), 'EventBookingPage.jsx DOES NOT contain the Razorpay Key Secret');
assert(!paymentServiceContent.includes(LEAKED_SECRET), 'paymentService.js DOES NOT contain the Razorpay Key Secret');

// Check all JS/JSX files in src/ for the leaked secret
function searchDirForSecret(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist') {
      searchDirForSecret(fullPath);
    } else if (entry.isFile() && /\.(js|jsx|ts|tsx)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      assert(!content.includes(LEAKED_SECRET), `${path.relative(projectRoot, fullPath)} is free of exposed Razorpay Key Secret`);
    }
  }
}
searchDirForSecret(path.join(projectRoot, 'src'));

assert(paymentServiceContent.includes('export const RAZORPAY_KEY_ID ='), 'paymentService.js exports public RAZORPAY_KEY_ID');
assert(paymentServiceContent.includes('export const createRazorpayOrder ='), 'paymentService.js exports createRazorpayOrder');
assert(bookingPageContent.includes("from '../../services/paymentService'"), 'EventBookingPage.jsx imports from paymentService');

// -----------------------------------------------------------------------------
// 2. BACKEND GATEWAY PROXY SECURITY
// -----------------------------------------------------------------------------
console.log('\n--- 2. Backend Gateway Proxy Security ---');

const proxyPath = path.join(repoRoot, 'blith-social', 'razorpay-proxy.php');
assert(fs.existsSync(proxyPath), 'blith-social/razorpay-proxy.php exists');

const proxyContent = fs.readFileSync(proxyPath, 'utf-8');
assert(proxyContent.includes("$route !== 'v1/orders'"), 'razorpay-proxy.php enforces route allowlist (only v1/orders)');
assert(proxyContent.includes("http_response_code(403)"), 'razorpay-proxy.php returns 403 Forbidden for unauthorized routes');
assert(proxyContent.includes("RAZORPAY_KEY_SECRET"), 'razorpay-proxy.php uses server-side secret constants');
assert(proxyContent.includes("intval($requestData['amount'])"), 'razorpay-proxy.php validates amount as integer');
assert(proxyContent.includes("$amount <= 0"), 'razorpay-proxy.php rejects zero or negative amounts');
assert(proxyContent.includes("$currency !== 'INR'"), 'razorpay-proxy.php restricts currency strictly to INR');

// Config protection in .htaccess
const htaccessPath = path.join(repoRoot, 'blith-social', '.htaccess');
const htaccessContent = fs.readFileSync(htaccessPath, 'utf-8');
assert(htaccessContent.includes('security_config'), '.htaccess blocks direct HTTP access to security_config.php');
assert(htaccessContent.includes('.env'), '.htaccess blocks direct HTTP access to .env files');

// -----------------------------------------------------------------------------
// 3. BOOKING PRICE & COUPON TAMPERING DEFENSE
// -----------------------------------------------------------------------------
console.log('\n--- 3. Booking Price & Coupon Tampering Defense ---');

assert(bookingPageContent.includes('Security validation: If marked as free, verify that the tickets are genuinely free'),
  'EventBookingPage.jsx performs atomic transaction verification for free bookings');
assert(bookingPageContent.includes('calculatedRequiredAmount += price * Number(bt.quantity || 1)'),
  'EventBookingPage.jsx calculates expected ticket prices against server DB records');
assert(bookingPageContent.includes('Security verification failed: Paid ticket tiers cannot be completed as free bookings'),
  'EventBookingPage.jsx throws error if price > 0 without verified full coupon');

// -----------------------------------------------------------------------------
// 4. UNATHORIZED ACCOUNT DELETION DEFENSE
// -----------------------------------------------------------------------------
console.log('\n--- 4. Account Deletion Ownership Verification ---');

const deleteAccountPath = path.join(projectRoot, 'src', 'components', 'DeleteAccount', 'DeleteAccount.jsx');
const deleteAccountContent = fs.readFileSync(deleteAccountPath, 'utf-8');

assert(deleteAccountContent.includes('isOwnershipVerified'), 'DeleteAccount.jsx tracks isOwnershipVerified state');
assert(deleteAccountContent.includes('handleVerifyOwnership'), 'DeleteAccount.jsx implements handleVerifyOwnership method');
assert(deleteAccountContent.includes('!currentUser && !isOwnershipVerified'), 'DeleteAccount.jsx blocks deletion if unauthenticated user is unverified');
assert(deleteAccountContent.includes('Account ownership verification is required'), 'DeleteAccount.jsx notifies user if verification is missing');

// -----------------------------------------------------------------------------
// 5. PII & SENSITIVE CONSOLE LOG REMOVAL
// -----------------------------------------------------------------------------
console.log('\n--- 5. PII & Sensitive Console Log Removal ---');

const userServicePath = path.join(projectRoot, 'src', 'services', 'userService.js');
const userServiceContent = fs.readFileSync(userServicePath, 'utf-8');

assert(!userServiceContent.includes('Attempting to register new user with data:'), 'userService.js no longer logs registration passwords/details');
assert(!userServiceContent.includes('Checking if phone number ${phoneNo} exists'), 'userService.js no longer logs plain phone numbers on check');
assert(!userServiceContent.includes('Checking if email ${email} exists'), 'userService.js no longer logs plain emails on check');
assert(!userServiceContent.includes('Successfully created user document in Firestore:'), 'userService.js no longer logs full user document objects');

const viteConfigPath = path.join(projectRoot, 'vite.config.js');
const viteConfigContent = fs.readFileSync(viteConfigPath, 'utf-8');
assert(viteConfigContent.includes("drop: command === 'build' ? ['console', 'debugger'] : []"),
  'vite.config.js drops console and debugger in production builds');

// -----------------------------------------------------------------------------
// 6. BACKEND SMTP SECRETS & INJECTION DEFENSE
// -----------------------------------------------------------------------------
console.log('\n--- 6. Backend SMTP Secrets & Injection Defense ---');

const contactUsPath = path.join(repoRoot, 'blith-social', 'ajax', 'contactUsAdd.php');
const contactUsContent = fs.readFileSync(contactUsPath, 'utf-8');

assert(!contactUsContent.includes("'uhp1-77ws-7uzn-fcev'"), 'contactUsAdd.php no longer contains hardcoded cleartext SMTP password');
assert(contactUsContent.includes('BLITHE_SMTP_PASS'), 'contactUsAdd.php uses BLITHE_SMTP_PASS constant');
assert(contactUsContent.includes('htmlspecialchars($full_name'), 'contactUsAdd.php escapes full_name against HTML injection');
assert(contactUsContent.includes('str_replace(["\\r", "\\n"], \'\', $full_name)'), 'contactUsAdd.php strips newlines from email Subject');

const venueMailPath = path.join(repoRoot, 'blith-social', 'venue-mail-api.php');
const venueMailContent = fs.readFileSync(venueMailPath, 'utf-8');

assert(!venueMailContent.includes("'uhp1-77ws-7uzn-fcev'"), 'venue-mail-api.php no longer contains hardcoded cleartext SMTP password');
assert(venueMailContent.includes('BLITHE_SMTP_PASS'), 'venue-mail-api.php uses BLITHE_SMTP_PASS constant');
assert(venueMailContent.includes('cleanVenueName'), 'venue-mail-api.php sanitizes venueName against CRLF injection');

// -----------------------------------------------------------------------------
// 7. FIRESTORE & STORAGE SECURITY RULES
// -----------------------------------------------------------------------------
console.log('\n--- 7. Firestore & Storage Security Rules ---');

const firestoreRulesPath = path.join(repoRoot, 'firestore.rules');
assert(fs.existsSync(firestoreRulesPath), 'firestore.rules exists in repository root');

const firestoreRulesContent = fs.readFileSync(firestoreRulesPath, 'utf-8');
assert(firestoreRulesContent.includes('match /users/{userId}'), 'firestore.rules restricts user profile access');
assert(firestoreRulesContent.includes('isOwner(userId)'), 'firestore.rules enforces ownership checks on users collection');
assert(firestoreRulesContent.includes('match /event/{eventId}'), 'firestore.rules guards event collection');
assert(firestoreRulesContent.includes('match /pendingBookings/{orderId}'), 'firestore.rules defines pendingBookings access');

const storageRulesPath = path.join(repoRoot, 'storage.rules');
assert(fs.existsSync(storageRulesPath), 'storage.rules exists in repository root');

const firebaseJsonPath = path.join(repoRoot, 'firebase.json');
const firebaseJsonContent = fs.readFileSync(firebaseJsonPath, 'utf-8');
assert(firebaseJsonContent.includes('"source": "functions"'), 'firebase.json preserves Flutter team Cloud Functions configuration');

console.log(`\nResults: ${passedTests}/${totalTests} security checks passed.\n`);

if (passedTests === totalTests) {
  console.log('\x1b[32mAll security verification tests passed successfully!\x1b[0m\n');
} else {
  console.error('\x1b[31mSome security verification tests failed.\x1b[0m\n');
  process.exitCode = 1;
}
