/**
 * couponService.js
 *
 * JavaScript port of the Flutter CouponRepository.
 * Handles:
 *  - Fetching and filtering available coupons for a user/event
 *  - Reserving a coupon (10-min hold) before payment
 *  - Committing a reservation once payment succeeds
 *  - Releasing a reservation if the user cancels or navigates away
 *  - Cleaning up expired reservations
 *
 * Firestore structure:
 *   coupons/{couponId}                          ← master coupon doc
 *   coupons/{couponId}/reservations/{userId}    ← 10-min reservation slot
 *   coupons/{couponId}/usage/{docId}            ← committed usage records
 *   users/{userId}/myBookings/{bookingId}       ← to check first-timer status
 */

import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  writeBatch,
  runTransaction,
  Timestamp,
  increment as _increment,
} from 'firebase/firestore';
import { db } from '../firebase';
import { v4 as uuidv4 } from 'uuid';

// ─── Firestore Collection References ────────────────────────────────────────

const COUPONS_COLLECTION = 'coupons';
const USERS_COLLECTION = 'users';
const MY_BOOKINGS_SUBCOLLECTION = 'myBookings';

const couponsRef = () => collection(db, COUPONS_COLLECTION);
const couponDocRef = (couponId) => doc(db, COUPONS_COLLECTION, couponId);
const reservationRef = (couponId, userId) =>
  doc(db, COUPONS_COLLECTION, couponId, 'reservations', userId);

// ─── Result Helpers ──────────────────────────────────────────────────────────

/**
 * @typedef {{ success: true, sessionId: string, reservedUntil: Date, couponId: string }} ApplySuccess
 * @typedef {{ success: false, error: string }} ApplyFailure
 * @typedef {ApplySuccess | ApplyFailure} CouponApplyResult
 */
const applySuccess = (sessionId, reservedUntil, couponId) => ({
  success: true,
  sessionId,
  reservedUntil,
  couponId,
});
const applyFailure = (error) => ({ success: false, error });

/**
 * @typedef {{ success: true }} CommitSuccess
 * @typedef {{ success: false, error: string }} CommitFailure
 * @typedef {CommitSuccess | CommitFailure} CouponCommitResult
 */
const commitSuccess = () => ({ success: true });
const commitFailure = (error) => ({ success: false, error });

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert a Firestore Timestamp or Date-like object to a JS Date */
const toDate = (val) => {
  if (!val) return new Date(0);
  if (val.toDate) return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  return new Date(val);
};

/** Check whether a reservation document represents an expired hold */
const isReservationExpired = (resData) => {
  if (!resData?.expiresAt) return true;
  return toDate(resData.expiresAt) < new Date();
};

/** Break an array into chunks of at most `size` elements */
const chunkArray = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

// ─── cleanupExpiredReservations ──────────────────────────────────────────────

/**
 * Finds all active-but-expired reservations for a coupon and marks them as
 * "released", decrementing the coupon's reservedCount.
 *
 * Called automatically before every `applyCoupon` to keep counts accurate.
 *
 * @param {string} couponId
 */
export const cleanupExpiredReservations = async (couponId) => {
  try {
    const reservationsRef = collection(db, COUPONS_COLLECTION, couponId, 'reservations');
    const expiredQuery = query(
      reservationsRef,
      where('status', '==', 'active'),
      where('expiresAt', '<', Timestamp.now())
    );
    const snapshot = await getDocs(expiredQuery);
    if (snapshot.empty) return;

    const chunks = chunkArray(snapshot.docs, 450); // stay under Firestore 500-write batch limit
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      batch.update(couponDocRef(couponId), {
        reservedCount: _increment(-chunk.length),
      });
      chunk.forEach((d) => batch.update(d.ref, { status: 'released' }));
      await batch.commit();
    }
  } catch (err) {
    // Fail silently – cleanup is best-effort
    console.warn('[couponService] cleanupExpiredReservations error:', err);
  }
};

// ─── _getUsedCouponIds ───────────────────────────────────────────────────────

/**
 * Returns the set of coupon IDs that this user has already committed (used).
 * Queries the `usage` collectionGroup across all coupons.
 *
 * @param {string} userId
 * @returns {Promise<Set<string>>}
 */
const getUsedCouponIds = async (userId) => {
  try {
    const usageGroup = collectionGroup(db, 'usage');
    const q = query(usageGroup, where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return new Set(snapshot.docs.map((d) => d.data().couponId));
  } catch (err) {
    console.warn('[couponService] getUsedCouponIds error:', err);
    return new Set();
  }
};

// ─── _checkHasBookings ───────────────────────────────────────────────────────

/**
 * Returns true if the user has at least one confirmed paid booking.
 * Used to decide whether "welcome" coupons are eligible.
 *
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
const checkHasBookings = async (userId) => {
  try {
    const bookingsRef = collection(db, USERS_COLLECTION, userId, MY_BOOKINGS_SUBCOLLECTION);
    const q = query(
      bookingsRef,
      where('status', '==', 'confirmed'),
      where('totalPrice', '>', 0)
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (err) {
    console.warn('[couponService] checkHasBookings error:', err);
    return false;
  }
};

// ─── fetchFilteredCoupons ────────────────────────────────────────────────────

/**
 * Fetches all coupons that are:
 *  1. Active and not deleted
 *  2. Not yet expired
 *  3. Not already used by this user
 *  4. Within their usage limit (usedCount + reservedCount < usageLimit)
 *  5. Eligible for this user/event (user-specific, event-specific, welcome)
 *
 * Mirrors the Flutter `getCoupons` stream, but as a one-shot fetch.
 *
 * @param {string|null} userId  — null = anonymous, skips user-specific filtering
 * @param {string} eventId
 * @returns {Promise<Array>} filtered coupon objects
 */
export const fetchFilteredCoupons = async (userId, eventId) => {
  try {
    // 1. Pre-fetch per-user context (only if we have a userId)
    const [usedCouponIds, hasBookings] = userId
      ? await Promise.all([getUsedCouponIds(userId), checkHasBookings(userId)])
      : [new Set(), false];

    // 2. Fetch all active, deleted (for testing), non-expired coupons
    const now = Timestamp.now();
    const q = query(
      couponsRef(),
      where('isActive', '==', true),
      where('deleted', '==', false),
      where('expiryDate', '>=', now)
    );
    const snapshot = await getDocs(q);

    // 3. Apply filters
    const filtered = [];
    snapshot.forEach((docSnap) => {
      const data = { id: docSnap.id, ...docSnap.data() };

      // Already used by this user
      if (userId && usedCouponIds.has(data.id)) return;

      // Usage limit reached  (effectiveUsed = usedCount + reservedCount)
      if (data.usageLimit > 0) {
        const usedCount = data.usedCount || 0;
        const reservedCount = data.reservedCount || 0;
        const effectiveUsed = usedCount + reservedCount;
        if (effectiveUsed >= data.usageLimit) return;
      }

      const type = (data.type || '').toLowerCase();

      // User-specific coupons — only show to targeted users
      if (type === 'user') {
        if (!userId) return;
        const targets = data.targetUserIds || [];
        if (!targets.includes(userId)) return;
      }

      // Event-specific coupons — only show for this event
      if (type === 'event') {
        if (data.eventId !== eventId) return;
      }

      // Welcome coupons — only for first-time bookers
      if (type === 'welcome') {
        if (hasBookings) return;
      }

      filtered.push(data);
    });

    return filtered;
  } catch (err) {
    console.error('[couponService] fetchFilteredCoupons error:', err);
    return [];
  }
};

// ─── applyCoupon ─────────────────────────────────────────────────────────────

/**
 * Attempts to reserve a coupon for the given user + order.
 *
 * Flow:
 *  1. Cleanup expired reservations to keep counts accurate
 *  2. Run Firestore transaction:
 *     a. Read coupon doc — validate active, not expired, order meets minimum, not over limit
 *     b. Check welcome eligibility if needed
 *     c. If an active, non-expired reservation already exists → refresh its expiry
 *     d. Otherwise → create new reservation + increment reservedCount
 *
 * @param {{ couponId: string, userId: string, orderAmount: number }} params
 * @returns {Promise<CouponApplyResult>}
 */
export const applyCoupon = async ({ couponId, userId, orderAmount }) => {
  try {
    await cleanupExpiredReservations(couponId);

    return await runTransaction(db, async (transaction) => {
      const couponSnap = await transaction.get(couponDocRef(couponId));
      if (!couponSnap.exists()) return applyFailure('Coupon not found');

      const coupon = { id: couponSnap.id, ...couponSnap.data() };

      // --- Validations ---
      if (!coupon.isActive) return applyFailure('Coupon is inactive');

      const expiryDate = toDate(coupon.expiryDate);
      if (expiryDate < new Date()) return applyFailure('Coupon has expired');

      if (orderAmount < (coupon.minOrderAmount || 0)) {
        return applyFailure(`Minimum order amount is ₹${coupon.minOrderAmount}`);
      }

      const type = (coupon.type || '').toLowerCase();
      if (type === 'user') {
        const targets = coupon.targetUserIds || [];
        if (!targets.includes(userId)) return applyFailure('This coupon is not for you');
      }

      const usedCount = coupon.usedCount || 0;
      const reservedCount = coupon.reservedCount || 0;
      const effectiveUsed = usedCount + reservedCount;
      if (coupon.usageLimit > 0 && effectiveUsed >= coupon.usageLimit) {
        return applyFailure('Coupon usage limit reached');
      }

      // Welcome coupon: check has no confirmed paid bookings
      if (type === 'welcome') {
        const hasBookings = await checkHasBookings(userId);
        if (hasBookings) {
          return applyFailure('Welcome coupons are only for first-time bookings');
        }
      }

      // --- Reservation ---
      const resRef = reservationRef(couponId, userId);
      const resSnap = await transaction.get(resRef);

      const sessionId = uuidv4();
      const reservedAt = new Date();
      const expiresAt = new Date(reservedAt.getTime() + 10 * 60 * 1000); // 10 minutes

      if (resSnap.exists()) {
        const existing = resSnap.data();
        if (existing.status === 'active' && !isReservationExpired(existing)) {
          // Refresh existing active reservation
          transaction.update(resRef, {
            expiresAt: Timestamp.fromDate(expiresAt),
            orderAmount,
            sessionId,
          });
          return applySuccess(sessionId, expiresAt, couponId);
        }
      }

      // Create new reservation + increment counter
      transaction.set(resRef, {
        userId,
        sessionId,
        reservedAt: Timestamp.fromDate(reservedAt),
        expiresAt: Timestamp.fromDate(expiresAt),
        orderAmount,
        status: 'active',
      });

      transaction.update(couponDocRef(couponId), {
        reservedCount: _increment(1),
      });

      return applySuccess(sessionId, expiresAt, couponId);
    });
  } catch (err) {
    console.error('[couponService] applyCoupon error:', err);
    return applyFailure(`Error applying coupon: ${err.message || err}`);
  }
};

// ─── commitCoupon ────────────────────────────────────────────────────────────

/**
 * Finalises a coupon reservation after a successful payment.
 *
 * Atomically:
 *  - Marks the reservation as "committed"
 *  - Increments `usedCount`, decrements `reservedCount` on the coupon doc
 *  - Writes a usage record under `coupons/{couponId}/usage/{userId}_{sessionId}`
 *
 * @param {{ couponId: string, userId: string, sessionId: string }} params
 * @returns {Promise<CouponCommitResult>}
 */
export const commitCoupon = async ({ couponId, userId, sessionId }) => {
  try {
    return await runTransaction(db, async (transaction) => {
      const resRef = reservationRef(couponId, userId);
      const resSnap = await transaction.get(resRef);

      if (!resSnap.exists()) {
        return commitFailure('Reservation not found, please re-apply your coupon');
      }

      const reservation = resSnap.data();

      if (reservation.status !== 'active') {
        return commitFailure('Reservation is no longer active');
      }
      if (isReservationExpired(reservation)) {
        return commitFailure('Reservation expired, please re-apply your coupon');
      }
      if (reservation.sessionId !== sessionId) {
        return commitFailure('Invalid session, please re-apply');
      }

      // Validate coupon is still active
      const couponSnap = await transaction.get(couponDocRef(couponId));
      if (!couponSnap.exists()) return commitFailure('Coupon not found');
      const coupon = couponSnap.data();
      if (!coupon.isActive || toDate(coupon.expiryDate) < new Date()) {
        return commitFailure('Coupon is no longer valid');
      }

      // Atomically update counts and mark reservation committed
      transaction.update(couponDocRef(couponId), {
        usedCount: _increment(1),
        reservedCount: _increment(-1),
      });
      transaction.update(resRef, { status: 'committed' });

      return commitSuccess();
    });
  } catch (err) {
    console.error('[couponService] commitCoupon error:', err);
    return commitFailure(`Error committing coupon: ${err.message || err}`);
  }
};

// ─── releaseCoupon ───────────────────────────────────────────────────────────

/**
 * Releases an active coupon reservation (user removed it or navigated away).
 *
 * @param {{ couponId: string, userId: string, sessionId: string }} params
 */
export const releaseCoupon = async ({ couponId, userId, sessionId }) => {
  try {
    const resRef = reservationRef(couponId, userId);
    const resSnap = await getDoc(resRef);

    if (!resSnap.exists()) return;

    const reservation = resSnap.data();
    if (reservation.status !== 'active' || reservation.sessionId !== sessionId) return;

    const batch = writeBatch(db);
    batch.update(resRef, { status: 'released' });
    batch.update(couponDocRef(couponId), { reservedCount: _increment(-1) });
    await batch.commit();
  } catch (err) {
    // Fail silently — best-effort cleanup
    console.warn('[couponService] releaseCoupon error:', err);
  }
};
