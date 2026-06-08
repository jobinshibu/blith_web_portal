import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, MapPin, X, Plus, Minus, User, Mail, Phone, CreditCard, CheckCircle, ShieldCheck, Info, ArrowLeft, Tag, Lock, Timer } from 'lucide-react';
import { collection, query, where, getDocs, setDoc, doc, getDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db } from '../../firebase';
import { createDefaultUserObject, generateUID } from '../../services/userService';
import {
  fetchFilteredCoupons,
  applyCoupon as applyCouponService,
  commitCoupon as commitCouponService,
  releaseCoupon as releaseCouponService,
} from '../../services/couponService';
import Button from '../Button/Button';
import { toast } from 'react-hot-toast';
import logo from '../../assets/logo.jpeg';
import './EventBookingPage.scss';

// Helper to parse Firestore timestamp to Date
const parseDate = (ts) => {
  if (!ts) return new Date();
  if (ts.toDate) return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  return new Date(ts);
};

// Helper to get dates between start and end
const getDatesBetween = (start, end) => {
  const dates = [];
  let currentDate = new Date(start);
  currentDate.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  while (currentDate <= endDate) {
    if (currentDate >= today) {
      dates.push(new Date(currentDate));
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return dates;
};

// Dynamically load Razorpay SDK
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

// Generate custom booking ID in format BVB<timestamp><3-digit random>
const generateBookingId = () => {
  const timestamp = Date.now();
  const randomNum = Math.floor(100 + Math.random() * 900);
  return `BVB${timestamp}${randomNum}`;
};

// Generate search prefixes list for bookings
const generateBookingSearchList = (userName, eventName, bookingId, eventId) => {
  const searchKeywords = new Set();
  const addPrefixes = (text) => {
    if (!text) return;
    const lower = text.toLowerCase();
    let cur = '';
    for (let i = 0; i < lower.length; i++) {
      cur += lower[i];
      searchKeywords.add(cur);
    }
  };

  addPrefixes(userName);
  addPrefixes(eventName);
  addPrefixes(bookingId);
  addPrefixes(eventId);

  return Array.from(searchKeywords);
};

// Helper to format date to YYYY-MM-DD
const formatDateStr = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const month = '' + (d.getMonth() + 1);
  const day = '' + d.getDate();
  const year = d.getFullYear();
  return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-');
};

// Helper to create Razorpay Order via REST API
const createRazorpayOrder = async (amount, bookingId, keyId, keySecret) => {
  const auth = btoa(`${keyId}:${keySecret}`);
  const amountInPaise = Math.round(amount * 100);
  const response = await fetch("/razorpay-api/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${auth}`
    },
    body: JSON.stringify({
      amount: amountInPaise,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: {
        bookingId: bookingId
      }
    })
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Razorpay Order creation failed: ${response.status} - ${errText}`);
  }
  return await response.json();
};

const EventBookingPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  const scrollRef = useRef(null);
  const [quantities, setQuantities] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [attendee, setAttendee] = useState({ name: '', email: '', phone: '' });

  // Load attendee details from sessionStorage on mount
  useEffect(() => {
    try {
      const cachedDetails = sessionStorage.getItem('blithe_checkout_attendee');
      if (cachedDetails) {
        const parsed = JSON.parse(cachedDetails);
        setAttendee(prev => ({
          ...prev,
          name: parsed.name || prev.name,
          email: parsed.email || prev.email,
          phone: parsed.phone || prev.phone
        }));
      }
    } catch (err) {
      console.warn("Failed to load checkout details from session:", err);
    }
  }, []);

  // Save attendee details to sessionStorage when they change
  useEffect(() => {
    if (attendee.name || attendee.email || attendee.phone) {
      try {
        sessionStorage.setItem('blithe_checkout_attendee', JSON.stringify(attendee));
      } catch (err) {
        console.warn("Failed to save checkout details to session:", err);
      }
    }
  }, [attendee]);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showFeeBreakdown, setShowFeeBreakdown] = useState(false);
  const [bookingId, setBookingId] = useState('');

  const [showErrors, setShowErrors] = useState(false);
  const [isVerifyingUser, setIsVerifyingUser] = useState(false);
  const [resolvedUserId, setResolvedUserId] = useState(null);

  // Coupon state
  const [filteredCoupons, setFilteredCoupons] = useState([]);
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponSession, setCouponSession] = useState(null);     // sessionId of active reservation
  const [couponReservedUntil, setCouponReservedUntil] = useState(null); // Date when reservation expires
  const [couponTimeLeft, setCouponTimeLeft] = useState(null);   // seconds remaining (for countdown)
  const [couponApplyingId, setCouponApplyingId] = useState(null); // couponId currently being applied
  const [couponErrors, setCouponErrors] = useState({});         // { [couponId]: errorString }
  const [resolvedUserIdForCoupons, setResolvedUserIdForCoupons] = useState(null);
  const [settings, setSettings] = useState(null);
  const couponTimerRef = useRef(null);

  // Daily Availability State
  const [dailyAvailability, setDailyAvailability] = useState({});
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  // Fetch Settings
  useEffect(() => {
    const fetchSettings = async () => {
      // Try common collection/document paths where app config (GST, serviceCode) may live.
      // The 'settings' collection only stores event categories in this project.
      const attempts = [
        () => getDocs(collection(db, 'appConfig')),
        () => getDocs(collection(db, 'config')),
        () => getDocs(collection(db, 'platformSettings')),
      ];

      for (const attempt of attempts) {
        try {
          const snapshot = await attempt();
          if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            if (data.gst !== undefined || data.serviceCode !== undefined) {
              setSettings(data);
              return;
            }
          }
        } catch (_) { }
      }

      // Config collection not found — fall back to a safe default so GST still renders.
      // 18% is the standard Indian GST rate applied on platform fees.
      setSettings({ gst: 18 });
    };
    fetchSettings();
  }, []);

  // Fetch Event Details
  useEffect(() => {
    const fetchEvent = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, "event", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setEvent({ id: docSnap.id, ...data });
        } else {
          setEvent(null);
        }
      } catch (err) {
        console.error("Error fetching event:", err);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchEvent();
  }, [id]);

  // Handle Dates
  const startDate = event ? parseDate(event.eventStartDate) : new Date();
  const endDate = event ? parseDate(event.eventEndDate) : new Date();
  const availableDates = event ? getDatesBetween(startDate, endDate) : [];
  const isMultiDay = availableDates.length > 1;

  useEffect(() => {
    if (event) {
      setSelectedDate(isMultiDay ? null : availableDates[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  // ─── Fetch filtered coupons (re-runs when event or resolved userId changes) ─
  useEffect(() => {
    if (!event) return;
    const load = async () => {
      setCouponLoading(true);
      try {
        const coupons = await fetchFilteredCoupons(
          resolvedUserIdForCoupons ?? null,
          event.id
        );
        setFilteredCoupons(coupons);
      } catch (err) {
        console.error('Error fetching coupons:', err);
      } finally {
        setCouponLoading(false);
      }
    };
    load();
  }, [event, resolvedUserIdForCoupons]);

  // Fetch Daily Availability
  useEffect(() => {
    if (!event || !selectedDate) {
      setDailyAvailability({});
      return;
    }
    const fetchAvailability = async () => {
      setLoadingAvailability(true);
      try {
        const dateStr = formatDateStr(selectedDate);
        const availabilityRef = doc(db, "event", event.id, "availability", dateStr);
        const snap = await getDoc(availabilityRef);
        if (snap.exists()) {
          setDailyAvailability(snap.data().tickets || {});
        } else {
          setDailyAvailability({});
        }
      } catch (err) {
        console.error("Error fetching daily availability:", err);
      } finally {
        setLoadingAvailability(false);
      }
    };
    fetchAvailability();
  }, [event, selectedDate]);

  // ─── Countdown timer for active coupon reservation ─────────────────────────
  useEffect(() => {
    if (couponTimerRef.current) clearInterval(couponTimerRef.current);
    if (!couponReservedUntil) { setCouponTimeLeft(null); return; }

    const tick = () => {
      const diff = Math.max(0, Math.floor((couponReservedUntil.getTime() - Date.now()) / 1000));
      setCouponTimeLeft(diff);
      if (diff === 0) {
        clearInterval(couponTimerRef.current);
        // Reservation expired — clear applied coupon silently
        setAppliedCoupon(null);
        setCouponSession(null);
        setCouponReservedUntil(null);
      }
    };
    tick();
    couponTimerRef.current = setInterval(tick, 1000);
    return () => clearInterval(couponTimerRef.current);
  }, [couponReservedUntil]);

  // ─── Release reservation when user leaves the page ─────────────────────────
  useEffect(() => {
    return () => {
      if (appliedCoupon && couponSession) {
        releaseCouponService({
          couponId: appliedCoupon.id,
          userId: resolvedUserIdForCoupons || resolvedUserId,
          sessionId: couponSession,
        }).catch(() => { });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedCoupon, couponSession]);

  // ─── Fetch user info by phone number & save to localStorage ─────────────────
  useEffect(() => {
    const fetchExistingUser = async () => {
      const trimmedPhone = attendee.phone.trim();
      if (/^\d{10}$/.test(trimmedPhone)) {
        console.log(`[Phone Fetch] 10-digit phone entered: ${trimmedPhone}`);
        try {
          const cacheKey = `blithe_user_${trimmedPhone}`;
          const cachedUser = localStorage.getItem(cacheKey);
          if (cachedUser) {
            console.log(`[Phone Fetch] Found cached user in localStorage:`, cachedUser);
            const userData = JSON.parse(cachedUser);
            setAttendee(prev => ({
              ...prev,
              name: userData.name || prev.name,
              email: userData.email || prev.email
            }));
            setResolvedUserId(userData.uid);
            setResolvedUserIdForCoupons(userData.uid);
            return;
          }

          console.log(`[Phone Fetch] Querying Firestore for phoneNo == ${trimmedPhone}`);
          const usersRef = collection(db, "users");
          const q = query(usersRef, where("phoneNo", "==", trimmedPhone));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            const userData = { uid: userDoc.id, ...userDoc.data() };
            console.log(`[Phone Fetch] Found user in Firestore:`, userData);

            // Save user information to localStorage
            localStorage.setItem(cacheKey, JSON.stringify(userData));
            console.log(`[Phone Fetch] Saved user to localStorage key: ${cacheKey}`);

            setAttendee(prev => ({
              ...prev,
              name: userData.name || prev.name,
              email: userData.email || prev.email
            }));
            setResolvedUserId(userData.uid);
            setResolvedUserIdForCoupons(userData.uid);
          } else {
            console.log(`[Phone Fetch] No user found with phoneNo == ${trimmedPhone}`);
            setResolvedUserId(null);
            setResolvedUserIdForCoupons(null);
          }
        } catch (err) {
          console.error("Error fetching existing user by phone:", err);
        }
      } else {
        setResolvedUserId(null);
        setResolvedUserIdForCoupons(null);
      }
    };

    fetchExistingUser();
  }, [attendee.phone]);

  if (loading) {
    return (
      <div className="booking-page-loading" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '60vh', gap: '1.5rem' }}>
        <motion.img
          src={logo}
          alt="Loading..."
          style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 10px 25px rgba(124, 58, 237, 0.2)' }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <h2 style={{ color: '#7C3AED', fontWeight: 'bold', fontSize: '1.25rem' }}>Loading booking details...</h2>
      </div>
    );
  }

  if (!event) {
    return <div className="booking-page-loading">Event not found. <Link to="/events">Go back</Link></div>;
  }

  const tickets = event.tickets || [];

  const getTicketRemainingSlots = (ticket) => {
    if (!ticket) return 0;
    const globalRemaining = ticket.remainingSlots || 0;
    const dailyLimitDefault = ticket.totalSlots !== undefined ? ticket.totalSlots : globalRemaining;
    const dailyRemaining = dailyAvailability[ticket.ticketName] !== undefined
      ? dailyAvailability[ticket.ticketName]
      : dailyLimitDefault;
    return Math.max(0, Math.min(globalRemaining, dailyRemaining));
  };

  const updateQuantity = (idx, delta) => {
    const ticket = tickets[idx];
    const remainingSlots = getTicketRemainingSlots(ticket);
    if (!ticket || !ticket.status || remainingSlots <= 0) return;

    setQuantities(prev => {
      const current = prev[idx] || 0;
      const maxSlots = Math.min(10, remainingSlots);
      return {
        ...prev,
        [idx]: Math.max(0, Math.min(maxSlots, current + delta))
      };
    });
  };

  const subtotal = tickets.reduce((sum, ticket, idx) => {
    return sum + (quantities[idx] || 0) * (ticket.blithePrice || 0);
  }, 0);

  // Use event.platformFee directly when present; fall back to 0 only if the field
  // is genuinely absent. This avoids GST being zeroed out when event.paid is missing.
  const platformFeeRate = (event && (event.paid || event.platformFee)) ? (event.platformFee || 0.0) : 0.0;
  const platformFeeVal = subtotal > 0 ? (subtotal * (platformFeeRate / 100)) : 0;

  // GST applies whenever there is a platform fee and the settings doc provides a rate.
  // We intentionally do NOT gate on event.paid here because that boolean is sometimes
  // absent from the Firestore document while platformFee is still set.
  const gstPercentage = (settings && platformFeeVal > 0) ? (parseFloat(settings.gst) || 0.0) : 0.0;
  const gstAmount = platformFeeVal * (gstPercentage / 100);

  const calculateDiscount = (coupon, currentSubtotal) => {
    if (!coupon || currentSubtotal < (coupon.minOrderAmount || 0)) return 0;
    if (coupon.percentage) {
      const computed = Math.round(currentSubtotal * (coupon.discountValue / 100));
      return coupon.maxDiscount ? Math.min(computed, coupon.maxDiscount) : computed;
    }
    return coupon.discountValue;
  };

  const discountAmount = calculateDiscount(appliedCoupon, subtotal);
  const total = Math.max(0, (subtotal - discountAmount) + platformFeeVal + gstAmount);
  const totalTickets = Object.values(quantities).reduce((a, b) => a + b, 0);

  const isPhoneValid = /^\d{10}$/.test(attendee.phone.trim());

  const isValid =
    totalTickets > 0 &&
    (isMultiDay ? selectedDate !== null : true) &&
    attendee.name.trim() !== '' &&
    attendee.email.trim() !== '' &&
    isPhoneValid &&
    agreeTerms;

  // Helper to block ticket slots for 10 minutes (paid events)
  const blockTicketSlots = async (uId, bookedTickets, dateStr, dbTickets, finalBookingSearchList) => {
    const availabilityRef = doc(db, "event", event.id, "availability", dateStr);

    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(availabilityRef);

      let ticketsMap = {};
      let blockedSlots = {};

      if (!snapshot.exists()) {
        // Lazy Initialization from Event's current tickets
        dbTickets.forEach((t) => {
          ticketsMap[t.ticketName] = t.totalSlots || 0;
        });
      } else {
        const data = snapshot.data();
        const ticketsMapDynamic = data.tickets || {};
        ticketsMap = { ...ticketsMapDynamic };
        blockedSlots = { ...(data.blocked_slots || {}) };

        // Merge missing tickets
        dbTickets.forEach((t) => {
          if (ticketsMap[t.ticketName] === undefined) {
            ticketsMap[t.ticketName] = t.totalSlots || 0;
          }
        });
      }

      // 1. Cleanup expired locks (10+ mins)
      const now = new Date();
      const userIdsToRemove = [];
      Object.entries(blockedSlots).forEach(([userIdKey, lockData]) => {
        if (lockData.expiry) {
          const expiryDate = lockData.expiry.toDate ? lockData.expiry.toDate() : new Date(lockData.expiry);
          if (expiryDate < now) {
            // Restore slots
            const reservedItems = lockData.items || [];
            reservedItems.forEach((item) => {
              const tName = item.ticketName;
              const qty = item.quantity;
              ticketsMap[tName] = (ticketsMap[tName] || 0) + qty;
            });
            userIdsToRemove.push(userIdKey);
          }
        }
      });
      userIdsToRemove.forEach((id) => {
        delete blockedSlots[id];
      });

      // 2. Check Aggregate Availability for all selected tickets
      const requestedTotals = {};
      bookedTickets.forEach((bookingTicket) => {
        requestedTotals[bookingTicket.ticketName] = (requestedTotals[bookingTicket.ticketName] || 0) + bookingTicket.quantity;
      });

      for (const [ticketName, requestedQty] of Object.entries(requestedTotals)) {
        const currentAvailable = ticketsMap[ticketName] || 0;
        if (currentAvailable < requestedQty) {
          throw new Error(`Insufficient slots for ${ticketName} on this date.`);
        }
      }

      // 3. Update (Reserve) and Store list of items in the lock
      const lockItems = [];
      bookedTickets.forEach((bookingTicket) => {
        ticketsMap[bookingTicket.ticketName] = (ticketsMap[bookingTicket.ticketName] || 0) - bookingTicket.quantity;
        lockItems.push({
          ticketName: bookingTicket.ticketName,
          quantity: bookingTicket.quantity
        });
      });

      blockedSlots[uId] = {
        items: lockItems,
        expiry: new Date(now.getTime() + 10 * 60 * 1000), // 10 minutes
        availabilityDate: dateStr,
        eventType: event.eventType || "Online",
        searchList: finalBookingSearchList,
        createdDate: new Date()
      };

      transaction.set(availabilityRef, {
        tickets: ticketsMap,
        blocked_slots: blockedSlots,
        updatedAt: serverTimestamp()
      }, { merge: true });
    });
  };

  // Helper to release ticket slots when checkout fails or is dismissed/cancelled
  const releaseTicketSlots = async (uId, dateStr) => {
    const availabilityRef = doc(db, "event", event.id, "availability", dateStr);
    try {
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(availabilityRef);
        if (!snapshot.exists()) return;

        const data = snapshot.data();
        const ticketsMap = { ...(data.tickets || {}) };
        const blockedSlots = { ...(data.blocked_slots || {}) };

        if (blockedSlots[uId]) {
          const lockData = blockedSlots[uId];
          const reservedItems = lockData.items || [];
          reservedItems.forEach((item) => {
            const tName = item.ticketName;
            const qty = item.quantity;
            ticketsMap[tName] = (ticketsMap[tName] || 0) + qty;
          });
          delete blockedSlots[uId];

          transaction.set(availabilityRef, {
            tickets: ticketsMap,
            blocked_slots: blockedSlots,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
      });
      console.log(`[Slots] Successfully released blocked slots for user: ${uId}`);
    } catch (err) {
      console.error("[Slots] Failed to release blocked slots:", err);
    }
  };

  // Helper to create pending booking (paid events)
  const createPendingBooking = async (orderId, bId, uId, bookedTickets, priceDetails, finalBookingSearchList) => {
    const pendingBookingRef = doc(db, "pendingBookings", orderId);
    const selectedDateVal = selectedDate ? selectedDate : startDate;

    const bookingData = {
      bookingId: bId,
      userId: uId,
      userName: attendee.name,
      userProfileImage: "",
      eventId: event.id,
      eventName: event.eventName || event.title || "",
      eventImage: (event.image && event.image.length > 0) ? event.image[0] : (event.image || ""),
      eventLocation: event.eventLocation || event.location || event.address || event.venue || "",
      eventLat: event.lat || event.latitude || 0.0,
      eventLong: event.long || event.longitude || 0.0,
      bookingDate: new Date(),
      eventDate: selectedDateVal,
      createdDate: new Date(),
      totalPrice: total,
      totalQuantity: totalTickets,
      status: "pending",
      platform: "Web",
      userEmail: attendee.email,
      eventType: event.eventType || "Online",
      searchList: finalBookingSearchList,
      tickets: bookedTickets,
      coupon: appliedCoupon ? {
        id: appliedCoupon.id,
        code: appliedCoupon.code,
        discountValue: appliedCoupon.discountValue,
        percentage: !!appliedCoupon.percentage,
        discount: discountAmount
      } : {},
      priceDetails: priceDetails,
      serviceCode: event.serviceCode || settings?.serviceCode || ""
    };

    await setDoc(pendingBookingRef, {
      bookingId: bId,
      razorpayOrderId: orderId,
      userId: uId,
      userPhone: attendee.phone,
      eventId: event.id,
      eventName: event.eventName || event.title || "",
      totalPrice: total,
      status: "pending",
      createdAt: serverTimestamp(),
      bookingData: bookingData,
      paymentMode: "razorpay",
      platform: "Web",
      availabilityDate: formatDateStr(selectedDateVal),
      eventType: event.eventType || "Online",
      searchList: finalBookingSearchList,
      createdDate: new Date(),
      coupon: appliedCoupon ? {
        id: appliedCoupon.id,
        code: appliedCoupon.code,
        discountValue: appliedCoupon.discountValue,
        percentage: !!appliedCoupon.percentage,
        discount: discountAmount
      } : {},
      priceDetails: priceDetails
    });
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!isValid) {
      setShowErrors(true);
      setTimeout(() => {
        const firstErrorEl = document.querySelector('.validation-hint');
        if (firstErrorEl) {
          firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (scrollRef.current) {
          scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 100);
      return;
    }
    setShowErrors(false);
    setIsVerifyingUser(true);

    try {
      // 1. Resolve User
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("countryCode", "==", "91"), where("phoneNo", "==", attendee.phone));
      const querySnapshot = await getDocs(q);

      let uId = null;
      let userProfileImage = "";

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        uId = userDoc.id;
        userProfileImage = userDoc.data().profilePic || "";
        console.log(`User already exists with UID: ${uId}`);
      } else {
        uId = generateUID();
        const newDocRef = doc(usersRef, uId);
        console.log(`User does not exist. Creating new record with UID: ${uId}`);
        const newUserDocument = createDefaultUserObject(uId, attendee.name, attendee.email, attendee.phone);
        await setDoc(newDocRef, newUserDocument);
        console.log(`New user record created successfully with UID: ${uId}`);
      }

      setResolvedUserId(uId);
      // Update userId for coupon context so re-fetch filters properly
      if (!resolvedUserIdForCoupons) setResolvedUserIdForCoupons(uId);

      // Validate coupon reservation is still live
      if (appliedCoupon && couponSession) {
        if (!couponReservedUntil || couponReservedUntil < new Date()) {
          setAppliedCoupon(null);
          setCouponSession(null);
          setCouponReservedUntil(null);
          toast.error('Your coupon reservation has expired. Please re-apply the coupon.');
          setIsVerifyingUser(false);
          return;
        }
      }

      const selectedDateVal = selectedDate ? selectedDate : startDate;
      const dateStr = formatDateStr(selectedDateVal);

      // Construct price details
      const priceDetails = {
        couponDiscountPrice: discountAmount,
        gstAmount: gstAmount,
        gstPercentage: gstPercentage,
        platformFee: platformFeeVal,
        platformFeePercentage: platformFeeRate,
        totalDiscount: discountAmount,
        totalPrice: total,
        totalTicketPrice: subtotal
      };

      // Construct booked tickets array
      const bookedTickets = [];
      tickets.forEach((ticket, idx) => {
        const qty = quantities[idx] || 0;
        if (qty > 0) {
          bookedTickets.push({
            category: ticket.category || "generic",
            price: ticket.blithePrice || 0,
            quantity: qty,
            ticketName: ticket.ticketName || "",
            totalPrice: subtotal > 0 ? (qty * (ticket.blithePrice || 0) / subtotal) * total : 0,
            totalQuantity: qty,
            userEmail: attendee.email,
            userId: uId,
            userName: attendee.name,
            userProfileImage: userProfileImage
          });
        }
      });

      const finalBookingSearchList = generateBookingSearchList(
        attendee.name,
        event.eventName || event.title || "",
        "",
        event.id
      );

      // Transaction-based Booking Confirmation Logic
      const performSaveBooking = async (paymentId, orderId, paymentStatusVal, existingBookingId) => {
        // Commit coupon reservation as early as possible (before the main transaction)
        // so the seat is permanently claimed even if the below transaction takes time.
        let couponCommitted = false;
        if (appliedCoupon && couponSession && uId) {
          const commitResult = await commitCouponService({
            couponId: appliedCoupon.id,
            userId: uId,
            sessionId: couponSession,
          });
          if (commitResult.success) {
            couponCommitted = true;
          } else {
            console.warn('[Coupon] commitCoupon failed:', commitResult.error);
            // Non-fatal — the booking still goes through; the reservation will auto-expire
          }
        }
        const bId = existingBookingId || generateBookingId();

        // Regenerate searchList including the generated booking ID
        const searchList = generateBookingSearchList(
          attendee.name,
          event.eventName || event.title || "",
          bId,
          event.id
        );

        // Update booking ID and profile image in booked tickets
        bookedTickets.forEach((t) => {
          t.userId = uId;
          t.userProfileImage = userProfileImage;
        });

        const myBookingData = {
          bookingDate: serverTimestamp(),
          bookingId: bId,
          createdDate: serverTimestamp(),
          eventDate: selectedDateVal,
          eventId: event.id,
          eventImage: (event.image && event.image.length > 0) ? event.image[0] : (event.image || ""),
          eventLat: event.lat || event.latitude || 0.0,
          eventLocation: event.eventLocation || event.location || event.address || event.venue || "",
          eventLong: event.long || event.longitude || 0.0,
          eventName: event.eventName || event.title || "",
          eventType: event.eventType || "Online",
          platform: "Web",
          searchList: searchList,
          status: "confirmed",
          tickets: bookedTickets
        };

        const eventBookingData = {
          bookingDate: serverTimestamp(),
          bookingId: bId,
          coupon: appliedCoupon ? {
            code: appliedCoupon.code,
            discount: discountAmount,
            discountValue: appliedCoupon.discountValue,
            id: appliedCoupon.id,
            percentage: !!appliedCoupon.percentage
          } : {},
          createdDate: serverTimestamp(),
          eventDate: selectedDateVal,
          eventId: event.id,
          eventImage: (event.image && event.image.length > 0) ? event.image[0] : (event.image || ""),
          eventLat: event.lat || event.latitude || 0.0,
          eventLocation: event.eventLocation || event.location || event.address || event.venue || "",
          eventLong: event.long || event.longitude || 0.0,
          eventName: event.eventName || event.title || "",
          eventType: event.eventType || "Online",
          isRated: false,
          isSkipped: false,
          paymentId: paymentId,
          paymentStatus: paymentStatusVal,
          platform: "Web",
          priceDetails: priceDetails,
          razorpayOrderId: orderId,
          searchList: searchList,
          serviceCode: event.serviceCode || settings?.serviceCode || "999631",
          status: "confirmed",
          tickets: bookedTickets,
          updatedAt: serverTimestamp(),
          userEmail: attendee.email,
          userId: uId,
          userName: attendee.name,
          userProfileImage: userProfileImage
        };

        const eventRef = doc(db, "event", event.id);
        const availabilityRef = doc(db, "event", event.id, "availability", dateStr);
        const userBookingRef = doc(db, "users", uId, "myBookings", bId);
        const eventBookingRef = doc(db, "event", event.id, "eventBookings", bId);

        await runTransaction(db, async (transaction) => {
          // 1. Read Event Document
          const eventSnap = await transaction.get(eventRef);
          if (!eventSnap.exists()) {
            throw new Error("Event not found");
          }
          const eventDbData = eventSnap.data();
          const dbTickets = eventDbData.tickets || [];

          // 2. Read Availability Document
          const availSnap = await transaction.get(availabilityRef);

          let ticketsMap = {};
          let blockedSlots = {};

          if (availSnap.exists()) {
            const availData = availSnap.data();
            const ticketsMapDynamic = availData.tickets || {};
            ticketsMap = { ...ticketsMapDynamic };
            blockedSlots = { ...(availData.blocked_slots || {}) };

            // Merge missing tickets
            dbTickets.forEach((t) => {
              if (ticketsMap[t.ticketName] === undefined) {
                ticketsMap[t.ticketName] = t.totalSlots || 0;
              }
            });
          } else {
            // Initialize for the first time
            dbTickets.forEach((t) => {
              ticketsMap[t.ticketName] = t.totalSlots || 0;
            });
          }

          // Cleanup slot locks from blockedSlots
          delete blockedSlots[uId];

          // 3. Decrement global and daily slots
          const updatedGlobalTickets = JSON.parse(JSON.stringify(dbTickets));

          for (const bookingTicket of bookedTickets) {
            // Decrement Daily
            const currentDayAvail = ticketsMap[bookingTicket.ticketName] || 0;
            if (currentDayAvail < bookingTicket.quantity) {
              throw new Error(`Insufficient slots for ${bookingTicket.ticketName} on this date.`);
            }
            ticketsMap[bookingTicket.ticketName] = currentDayAvail - bookingTicket.quantity;

            // Decrement Global
            const ticketIndex = updatedGlobalTickets.findIndex((t) => t.ticketName === bookingTicket.ticketName);
            if (ticketIndex !== -1) {
              const ticket = updatedGlobalTickets[ticketIndex];
              if ((ticket.remainingSlots || 0) < bookingTicket.quantity) {
                throw new Error(`Insufficient global slots for ${bookingTicket.ticketName}.`);
              }
              updatedGlobalTickets[ticketIndex] = {
                ...ticket,
                remainingSlots: (ticket.remainingSlots || 0) - bookingTicket.quantity
              };
            } else {
              throw new Error(`Ticket ${bookingTicket.ticketName} not found in event`);
            }
          }

          // 4. Sets and updates
          transaction.set(userBookingRef, myBookingData);
          transaction.set(eventBookingRef, eventBookingData);

          const eventUpdates = {
            tickets: updatedGlobalTickets
          };
          const iAmGoing = eventDbData.iAmGoing || [];
          if (!iAmGoing.includes(uId)) {
            eventUpdates.iAmGoing = [...iAmGoing, uId];
          }
          transaction.update(eventRef, eventUpdates);

          transaction.set(availabilityRef, {
            tickets: ticketsMap,
            blocked_slots: blockedSlots,
            updatedAt: serverTimestamp()
          }, { merge: true });

          // 5. Notifications
          const userNotiRef = doc(collection(db, "notification"));
          const orgNotiRef = doc(collection(db, "notification"));

          const userNotification = {
            fromId: eventDbData.oId || "",
            toId: uId,
            fromUser: eventDbData.eventName || eventDbData.title || "",
            toUser: attendee.name,
            id: userNotiRef.id,
            navigationId: bId,
            type: "Ticket Booked",
            fromOrg: true,
            toOrg: false,
            status: 0,
            date: new Date(),
            references: userNotiRef,
            isRead: false,
            rejectedReason: ""
          };

          const orgNotification = {
            fromId: uId,
            toId: eventDbData.oId || "",
            fromUser: attendee.name,
            toUser: eventDbData.eventName || eventDbData.title || "",
            id: orgNotiRef.id,
            navigationId: bId,
            type: "New Booking",
            fromOrg: false,
            toOrg: true,
            status: 0,
            date: new Date(),
            references: orgNotiRef,
            isRead: false,
            rejectedReason: ""
          };

          transaction.set(userNotiRef, userNotification);
          transaction.set(orgNotiRef, orgNotification);

          // Update pending booking status to confirmed if it exists
          if (total > 0 && orderId !== "free") {
            const pendingBookingDocRef = doc(db, "pendingBookings", orderId);
            transaction.update(pendingBookingDocRef, { status: "confirmed", paymentStatus: "paid" });
          }
        });

        // 6. Send Booking Confirmation Email (after transaction succeeds)
        if (attendee.email) {
          try {
            const formatCalDate = (date) => {
              if (!date) return '';
              const d = new Date(date);
              return d.toISOString().split('.')[0].replace(/[-:]/g, '') + 'Z';
            };

            const orgStartTime = parseDate(event.eventStartDate);
            const orgEndTime = event.eventEndDate ? parseDate(event.eventEndDate) : new Date(orgStartTime.getTime() + 2 * 60 * 60 * 1000);

            const finalStart = new Date(
              selectedDateVal.getFullYear(),
              selectedDateVal.getMonth(),
              selectedDateVal.getDate(),
              orgStartTime.getHours(),
              orgStartTime.getMinutes()
            );
            const finalEnd = new Date(finalStart.getTime() + 2 * 60 * 60 * 1000);

            const startStr = formatCalDate(finalStart);
            const endStr = formatCalDate(finalEnd);

            const isOnline = event.eventType === 'Online';
            const eventTitle = encodeURIComponent(event.eventName || event.title || "");
            const eventLocation = isOnline ? '' : encodeURIComponent(event.location || event.venue || "");
            const eventDetails = encodeURIComponent(
              `${isOnline ? `🔗 Join Meeting: ${event.meetingUrl || ''}\n\n` : ''}` +
              `Booking ID: ${bId}\n` +
              `Tickets: ${totalTickets}\n` +
              `${(!isOnline && !(event.location)) ? `Venue: ${event.venue || ''}` : ''}`
            );

            const googleCalendarUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${eventTitle}&dates=${startStr}/${endStr}&details=${eventDetails}&location=${eventLocation}`;
            const outlookCalendarUrl = `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${eventTitle}&startdt=${startStr}&enddt=${endStr}&body=${eventDetails}&location=${eventLocation}`;

            const ticketRows = bookedTickets.map((t) => `<tr>
              <td style="padding:8px;border:1px solid #ddd;">${t.ticketName}</td>
              <td style="padding:8px;border:1px solid #ddd;text-align:center;">${t.quantity}</td>
              <td style="padding:8px;border:1px solid #ddd;text-align:right;">₹${(t.price * t.quantity).toFixed(2)}</td>
            </tr>`).join('');

            const eventDateStr = selectedDateVal.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: '2-digit' });
            const bookedDateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: '2-digit' });

            const timeStr = (event.eventStartDate && event.eventEndDate)
              ? `${orgStartTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - ${orgEndTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
              : '';

            const emailHtml = `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;">
              <div style="background:#6C63FF;padding:20px;border-radius:10px 10px 0 0;text-align:center;">
                <h1 style="color:#fff;margin:0;">Booking Confirmed!</h1>
              </div>
              <div style="background:#fff;padding:20px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 10px 10px;">
                <p style="font-size:16px;">Hi <strong>${attendee.name || 'there'}</strong>,</p>
                
                <!-- Calendar Buttons -->
                <div style="text-align:center;margin:20px 0;padding:15px;background:#f0efff;border-radius:8px;">
                  <p style="margin-top:0;font-weight:bold;color:#584CF4;">📅 Add to calendar</p>
                  <a href="${googleCalendarUrl}" style="display:inline-block;padding:10px 15px;margin:5px;background:#fff;color:#4285F4;text-decoration:none;border-radius:5px;border:1px solid #4285F4;font-size:13px;font-weight:bold;">+ Google Calendar</a>
                  <a href="${outlookCalendarUrl}" style="display:inline-block;padding:10px 15px;margin:5px;background:#fff;color:#0078D4;text-decoration:none;border-radius:5px;border:1px solid #0078D4;font-size:13px;font-weight:bold;">+ Outlook / Office 365</a>
                </div>

                <p>Your booking for <strong>${event.eventName || event.title || ''}</strong> has been confirmed.</p>
                <div style="background:#f9f9f9;padding:15px;border-radius:8px;margin:15px 0;">
                  <table style="width:100%;">
                    <tr><td style="color:#888;width:120px;padding:3px 0;">Booking ID</td><td><strong>${bId}</strong></td></tr>
                    ${(event.serviceCode || settings?.serviceCode) ? `<tr><td style="color:#888;padding:3px 0;">HSN/SAC</td><td><strong>${event.serviceCode || settings?.serviceCode}</strong></td></tr>` : ''}
                    <tr><td style="color:#888;padding:3px 0;">Booked Date</td><td><strong>${bookedDateStr}</strong></td></tr>
                    <tr><td style="color:#888;padding:3px 0;">Event Date</td><td><strong>${eventDateStr}</strong></td></tr>
                    ${(!isOnline && timeStr) ? `<tr><td style="color:#888;padding:3px 0;">Time</td><td><strong>${timeStr}</strong></td></tr>` : ''}
                    ${!isOnline ? `<tr><td style="color:#888;padding:3px 0;">Venue</td><td><strong>${event.location || event.venue || ''}</strong></td></tr>` : ''}
                    ${(isOnline && event.meetingUrl) ? `<tr><td style="color:#888;padding:3px 0;">Meeting Link</td><td><a href="${event.meetingUrl}" style="color:#6C63FF;font-weight:bold;text-decoration:none;">Join Online Meeting</a></td></tr>` : ''}
                  </table>
                </div>

                <h3 style="border-bottom:2px solid #6C63FF;padding-bottom:5px;margin-top:25px;font-size:18px;">Ticket Details</h3>
                <table style="width:100%;border-collapse:collapse;margin:10px 0;">
                  <tr style="background:#f5f5f5;">
                    <th style="padding:10px;border:1px solid #ddd;text-align:left;">Ticket</th>
                    <th style="padding:10px;border:1px solid #ddd;text-align:center;">Qty</th>
                    <th style="padding:10px;border:1px solid #ddd;text-align:right;">Amount</th>
                  </tr>
                  ${ticketRows}
                </table>

                <h3 style="border-bottom:2px solid #6C63FF;padding-bottom:5px;margin-top:25px;font-size:18px;">Payment Summary</h3>
                <table style="width:100%;border-collapse:collapse;margin:10px 0;">
                  <tr>
                    <td style="color:#666;padding:8px 0;border-bottom:1px solid #eee;">Net Amount</td>
                    <td style="text-align:right;padding:8px 0;border-bottom:1px solid #eee;">₹${subtotal.toFixed(2)}</td>
                  </tr>
                  ${platformFeeVal > 0 ? `
                  <tr>
                    <td style="color:#666;padding:8px 0;border-bottom:1px solid #eee;">Platform Fee (${platformFeeRate.toFixed(2)}%)</td>
                    <td style="text-align:right;padding:8px 0;border-bottom:1px solid #eee;">₹${platformFeeVal.toFixed(2)}</td>
                  </tr>` : ''}
                  ${gstAmount > 0 ? `
                  <tr>
                    <td style="color:#666;padding:8px 0;border-bottom:1px solid #eee;">CGST (${(gstPercentage / 2).toFixed(2)}%)</td>
                    <td style="text-align:right;padding:8px 0;border-bottom:1px solid #eee;">₹${(gstAmount / 2).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style="color:#666;padding:8px 0;border-bottom:1px solid #eee;">SGST (${(gstPercentage / 2).toFixed(2)}%)</td>
                    <td style="text-align:right;padding:8px 0;border-bottom:1px solid #eee;">₹${(gstAmount / 2).toFixed(2)}</td>
                  </tr>` : ''}
                  <tr>
                    <td style="font-size:20px;padding-top:15px;font-weight:bold;color:#333;">Grand Total</td>
                    <td style="font-size:20px;padding-top:15px;text-align:right;font-weight:bold;color:#6C63FF;">₹${total.toFixed(2)}</td>
                  </tr>
                </table>

                <p style="text-align:center;color:#888;font-size:12px;margin:20px 0;">
                  <em>note: Ticket is sold by the event organiser. Blithe charges a platform service fee .</em>
                </p>
                <hr style="border:none;border-top:1px solid #eee;margin:10px 0 20px 0;">
                <p style="text-align:center;color:#888;font-size:13px;line-height:1.5;">
                  Need help? Contact our support team.<br>
                  <a href="https://www.blithe.social/" style="color:#6C63FF;text-decoration:none;margin:0 10px;font-weight:bold;">Website</a> | 
                  <a href="https://www.instagram.com/blithe.social?igsh=MWM4eGw4dnVxYTU0bw%3D%3D" style="color:#6C63FF;text-decoration:none;margin:0 10px;font-weight:bold;">Instagram</a><br>
                  Thank you for booking with <strong>Blithe</strong>! 🎶
                </p>
              </div>
            </div>`;

            await setDoc(doc(collection(db, "sendMail")), {
              date: serverTimestamp(),
              emailList: [attendee.email],
              html: emailHtml,
              status: `Booking Confirmation - ${event.eventName || event.title || ""}`
            });
          } catch (mailErr) {
            console.error("Email sending failure:", mailErr);
          }
        }

        console.log('Successfully created booking records!');
        // Clear coupon state now that it's committed and booking is done
        setAppliedCoupon(null);
        setCouponSession(null);
        setCouponReservedUntil(null);
        // Clear session storage details
        try {
          sessionStorage.removeItem('blithe_checkout_attendee');
        } catch (_) {}
        toast.success('Booking confirmed successfully!');
        setTimeout(() => {
          navigate('/events');
        }, 1500);
      };

      // 2. Process booking flow
      if (total <= 0) {
        // Direct booking for free events (skip slot blocking)
        await performSaveBooking("free", "free", "free");
      } else {
        // Block ticket slots first
        console.log("Paid Event: Blocking ticket slots...");
        await blockTicketSlots(uId, bookedTickets, dateStr, tickets, finalBookingSearchList);
        console.log("Slot block success! Creating Razorpay Order...");

        const bId = generateBookingId();
        let orderId = "";
        const keyId = "rzp_live_SBgnzuGhztmYSZ";
        const keySecret = "6c2w1nZcqVdlusV8j1AGz55t";

        try {
          const order = await createRazorpayOrder(total, bId, keyId, keySecret);
          orderId = order.id;
        } catch (orderErr) {
          console.error("Razorpay Order API failed:", orderErr);
          await releaseTicketSlots(uId, dateStr);
          toast.error("Failed to initiate payment. Please try again.");
          return;
        }

        // Create pending booking
        await createPendingBooking(orderId, bId, uId, bookedTickets, priceDetails, finalBookingSearchList);

        // Open Razorpay Checkout
        const isScriptLoaded = await loadRazorpayScript();
        if (!isScriptLoaded || !window.Razorpay) {
          await releaseTicketSlots(uId, dateStr);
          toast.error("Razorpay SDK failed to load. Please check your internet connection.");
          return;
        }

        const options = {
          key: keyId,
          amount: Math.round(total * 100),
          currency: "INR",
          name: "Blithe",
          description: `Booking for ${event.eventName || event.title}`,
          prefill: {
            name: attendee.name,
            email: attendee.email,
            contact: attendee.phone,
          },
          theme: {
            color: "#7C3AED",
          },
          handler: async function (response) {
            const paymentId = response.razorpay_payment_id;
            if (!paymentId) {
              toast.error("Payment verification failed. No payment ID returned.");
              return;
            }
            const actualOrderId = response.razorpay_order_id || orderId;
            await performSaveBooking(paymentId, actualOrderId, "paid", bId);
          },
          modal: {
            ondismiss: async function () {
              setIsVerifyingUser(false);
              await releaseTicketSlots(uId, dateStr);
              if (appliedCoupon && couponSession && uId) {
                try {
                  await releaseCouponService({
                    couponId: appliedCoupon.id,
                    userId: uId,
                    sessionId: couponSession,
                  });
                  setAppliedCoupon(null);
                  setCouponSession(null);
                  setCouponReservedUntil(null);
                } catch (err) {
                  console.warn('[Coupon] releaseCouponService failed on payment close:', err);
                }
              }
            }
          }
        };

        if (orderId) {
          options.order_id = orderId;
        }

        const rzp = new window.Razorpay(options);
        rzp.open();
      }

    } catch (err) {
      console.error("Error in booking flow:", err);
      toast.error(`Failed to proceed: ${err.message || err}`);
    } finally {
      setIsVerifyingUser(false);
    }
  };

  const displayDate = selectedDate ? selectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const displayTime = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="event-booking-page" ref={scrollRef}>
      <div className="booking-header-bar">
        <div className="container">
          <Link to={`/events/${id}`} className="back-link-btn">
            <ArrowLeft size={20} /> <span className="text">Back to Event</span>
          </Link>
          <h1 className="page-title">Secure Checkout</h1>
        </div>
      </div>

      <div className="container main-content checkout-layout two-col">
        {/* LEFT COLUMN: User Input & Tickets */}
        <div className="checkout-left-col">

          {/* Date Selection */}
          {isMultiDay && (
            <div className="section-block date-selection-block glass">
              <h3>1. Select Date</h3>
              <div className="date-cards-container">
                {availableDates.map((date, idx) => {
                  const isSelected = selectedDate && date.getTime() === selectedDate.getTime();
                  return (
                    <button
                      key={idx}
                      type="button"
                      className={`date-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedDate(date)}
                    >
                      <span className="date-month">{date.toLocaleDateString('en-GB', { month: 'short' })}</span>
                      <span className="date-day">{date.getDate()}</span>
                      <span className="date-weekday">{date.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                    </button>
                  );
                })}
              </div>
              {showErrors && !selectedDate && (
                <div className="validation-hint">
                  <Info size={16} /> <span>Please select a date.</span>
                </div>
              )}
            </div>
          )}

          {/* Ticket Selection */}
          <div className="section-block ticket-selection-block glass">
            <h3>{isMultiDay ? '2. Select Tickets' : '1. Select Tickets'}</h3>
            <div className="ticket-tiers-list">
              {tickets.map((ticket, idx) => {
                const ticketEndDate = ticket.endDate ? parseDate(ticket.endDate) : null;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (ticketEndDate && ticketEndDate < today) return null;

                const remainingSlots = getTicketRemainingSlots(ticket);
                const isUnavailable = !ticket.status || remainingSlots <= 0;
                const qty = quantities[idx] || 0;
                return (
                  <div key={idx} className={`ticket-tier-card ${qty > 0 ? 'selected-tier' : ''} ${isUnavailable ? 'unavailable' : ''}`}>
                    <div className="tier-top">
                      <h4>{ticket.ticketName}</h4>
                      {isUnavailable && (
                        <p className="tier-desc error-text">Sold Out / Unavailable</p>
                      )}
                    </div>
                    <div className="tier-bottom">
                      <span className="tier-price">
                        {(ticket.actualPrice && ticket.actualPrice > ticket.blithePrice) && (
                          <span className="original-price" style={{ textDecoration: 'line-through', color: '#9CA3AF', marginRight: '0.4rem', fontSize: '0.85em', fontWeight: 500 }}>
                            ₹ {ticket.actualPrice}
                          </span>
                        )}
                        {!ticket.blithePrice || ticket.blithePrice === 0 ? 'FREE' : `₹ ${ticket.blithePrice}`}
                      </span>
                      <div className="tier-selector">
                        <button type="button" className="qty-btn" disabled={qty <= 0} onClick={() => updateQuantity(idx, -1)}>-</button>
                        <span className="qty-val">{qty}</span>
                        <button type="button" className="qty-btn" disabled={isUnavailable || qty >= Math.min(10, remainingSlots)} onClick={() => updateQuantity(idx, 1)}>+</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {showErrors && totalTickets === 0 && (
              <div className="validation-hint">
                <Info size={16} /> <span>Please choose your desired tickets.</span>
              </div>
            )}
          </div>

          {/* Attendee Details */}
          <div className="section-block attendee-details-block glass">
            <h3>{isMultiDay ? '3. Contact Information' : '2. Contact Information'}</h3>
            <div className="input-group">
              <label htmlFor="name">Full Name</label>
              <div className="input-wrapper">
                <User size={18} className="input-icon" />
                <input type="text" id="name" placeholder="e.g. Rahul Sharma" value={attendee.name} onChange={(e) => setAttendee(prev => ({ ...prev, name: e.target.value }))} />
              </div>
              {showErrors && !attendee.name.trim() && (
                <div className="validation-hint"><Info size={16} /><span>Please provide your full name.</span></div>
              )}
            </div>

            <div className="input-group">
              <label htmlFor="email">Email Address</label>
              <div className="input-wrapper">
                <Mail size={18} className="input-icon" />
                <input type="email" id="email" placeholder="e.g. rahul@example.com" value={attendee.email} onChange={(e) => setAttendee(prev => ({ ...prev, email: e.target.value }))} />
              </div>
              {showErrors && !attendee.email.trim() && (
                <div className="validation-hint"><Info size={16} /><span>Please provide a valid email address.</span></div>
              )}
            </div>

            <div className="input-group">
              <label htmlFor="phone">Phone Number</label>
              <div className="input-wrapper">
                <Phone size={18} className="input-icon" />
                <input type="tel" id="phone" placeholder="e.g. 9876543210" value={attendee.phone} onChange={(e) => setAttendee(prev => ({ ...prev, phone: e.target.value }))} />
              </div>
              {showErrors && !isPhoneValid && (
                <div className="validation-hint"><Info size={16} /><span>Please provide a valid 10-digit phone number.</span></div>
              )}
            </div>
          </div>

          {/* Coupons Section */}
          <div className="section-block coupons-block glass">
            <h3>{isMultiDay ? '4. Available Offers' : '3. Available Offers'}</h3>

            {couponLoading ? (
              <div className="coupon-cards-loading">
                {[1, 2].map(i => (
                  <div key={i} className="coupon-skeleton">
                    <div className="skeleton-left" />
                    <div className="skeleton-right">
                      <div className="skeleton-line short" />
                      <div className="skeleton-line long" />
                      <div className="skeleton-line medium" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredCoupons.length === 0 ? (
              <p style={{ color: '#6B7280', fontStyle: 'italic' }}>No active coupons available right now.</p>
            ) : (
              <div className="coupons-list-view">
                {filteredCoupons.map(coupon => {
                  const potDiscount = calculateDiscount(coupon, subtotal);
                  const isApplicable = subtotal >= (coupon.minOrderAmount || 0);
                  const isSelected = appliedCoupon?.id === coupon.id;
                  const isApplying = couponApplyingId === coupon.id;
                  const neededAmount = (coupon.minOrderAmount || 0) - subtotal;
                  const cardError = couponErrors[coupon.id];

                  const handleApply = async () => {
                    if (!isApplicable || isApplying) return;

                    // Resolve userId first if not yet done (phone might not be entered)
                    let uId = resolvedUserIdForCoupons;
                    if (!uId && attendee.phone && /^\d{10}$/.test(attendee.phone.trim())) {
                      try {
                        const uRef = collection(db, 'users');
                        const uQ = query(uRef, where('countryCode', '==', '91'), where('phoneNo', '==', attendee.phone));
                        const uSnap = await getDocs(uQ);
                        if (!uSnap.empty) {
                          uId = uSnap.docs[0].id;
                          setResolvedUserIdForCoupons(uId);
                        }
                      } catch (_) { }
                    }

                    if (!uId) {
                      setCouponErrors(prev => ({ ...prev, [coupon.id]: 'Please enter your phone number first so we can verify eligibility.' }));
                      return;
                    }

                    setCouponApplyingId(coupon.id);
                    setCouponErrors(prev => { const n = { ...prev }; delete n[coupon.id]; return n; });

                    // Release previous reservation if a different coupon was selected
                    if (appliedCoupon && couponSession && appliedCoupon.id !== coupon.id) {
                      await releaseCouponService({ couponId: appliedCoupon.id, userId: uId, sessionId: couponSession });
                      setAppliedCoupon(null);
                      setCouponSession(null);
                      setCouponReservedUntil(null);
                    }

                    const result = await applyCouponService({
                      couponId: coupon.id,
                      userId: uId,
                      orderAmount: subtotal,
                    });

                    setCouponApplyingId(null);

                    if (result.success) {
                      setAppliedCoupon(coupon);
                      setCouponSession(result.sessionId);
                      setCouponReservedUntil(result.reservedUntil);
                    } else {
                      setCouponErrors(prev => ({ ...prev, [coupon.id]: result.error }));
                    }
                  };

                  const handleRemove = async () => {
                    const uId = resolvedUserIdForCoupons || resolvedUserId;
                    if (uId && couponSession) {
                      await releaseCouponService({ couponId: coupon.id, userId: uId, sessionId: couponSession });
                    }
                    setAppliedCoupon(null);
                    setCouponSession(null);
                    setCouponReservedUntil(null);
                  };

                  return (
                    <div
                      key={coupon.id}
                      className={`coupon-ticket-card ${isSelected ? 'selected' : ''} ${!isApplicable ? 'locked' : ''}`}
                    >
                      {/* Left Side: Offer Details */}
                      <div className="ticket-details-side">
                        <div className="coupon-badge-row">
                          <span className="coupon-code-tag">
                            <Tag size={12} className="tag-icon" />
                            {coupon.code}
                          </span>
                          {isApplicable && !isSelected && potDiscount > 0 && (
                            <span className="save-amount-badge">SAVE ₹{potDiscount}</span>
                          )}
                          {isSelected && (
                            <span className="applied-badge">APPLIED</span>
                          )}
                        </div>

                        <h4 className="coupon-title">
                          {coupon.title || 'Special Discount'}
                        </h4>

                        {coupon.minOrderAmount > 0 && !isSelected && (
                          <p className="coupon-min-spend">Min. order: ₹{coupon.minOrderAmount}</p>
                        )}

                        {!isApplicable && neededAmount > 0 && (
                          <div className="unlock-progress-hint">
                            <Lock size={12} className="lock-icon" />
                            <span>Add ₹{neededAmount} more to unlock</span>
                          </div>
                        )}

                        {/* Countdown timer for active reservation */}
                        {isSelected && couponTimeLeft !== null && (
                          <div className="coupon-timer-badge">
                            <Timer size={12} />
                            <span>
                              Reserved for{' '}
                              {String(Math.floor(couponTimeLeft / 60)).padStart(2, '0')}:
                              {String(couponTimeLeft % 60).padStart(2, '0')}
                            </span>
                          </div>
                        )}

                        {/* Inline error */}
                        {cardError && (
                          <p className="coupon-error-msg">{cardError}</p>
                        )}
                      </div>

                      {/* Ticket Stub Dashed Divider */}
                      <div className="ticket-divider-line"></div>

                      {/* Right Side: Action */}
                      <div className="ticket-action-side">
                        {isSelected ? (
                          <button type="button" className="coupon-action-status active" onClick={handleRemove}>
                            <CheckCircle size={20} className="check-icon" />
                            <span>REMOVE</span>
                          </button>
                        ) : !isApplicable ? (
                          <div className="coupon-action-status locked">
                            <Lock size={18} className="lock-icon" />
                            <span>LOCKED</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className={`coupon-apply-btn ${isApplying ? 'applying' : ''}`}
                            onClick={handleApply}
                            disabled={isApplying}
                          >
                            {isApplying ? '...' : 'APPLY'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: Order Summary (Sticky) */}
        <div className="checkout-right-col">
          <div className="billing-summary-glass glass sticky-summary">
            <h3>Order Summary</h3>
            <div className="event-mini-card">
              <img src={event.image && event.image.length > 0 ? event.image[0] : (event.image || '/assets/placeholder.jpg')} alt={event.eventName || event.title} className="mini-event-img" />
              <div className="mini-event-info">
                <h4>{event.eventName || event.title}</h4>
                <p><Calendar size={12} /> {displayDate || 'Date TBD'}</p>
                <p><Clock size={12} /> {displayTime || 'Time TBD'}</p>
              </div>
            </div>

            <div className="ticket-items-list">
              {tickets.map((ticket, idx) => {
                const qty = quantities[idx] || 0;
                if (qty > 0) {
                  return (
                    <div key={idx} className="ticket-item-row">
                      <span>{qty}x {ticket.ticketName}</span>
                      <span>{(!ticket.blithePrice || ticket.blithePrice === 0) ? 'FREE' : `₹ ${qty * ticket.blithePrice}`}</span>
                    </div>
                  );
                }
                return null;
              })}

              {totalTickets > 0 && (
                <>
                  <div className="summary-row divider">
                    <span>Subtotal</span>
                    <span>₹ {subtotal.toFixed(2)}</span>
                  </div>
                  {platformFeeVal > 0 ? (
                    <div className="fee-taxes-container" style={{ margin: '0.75rem 0' }}>
                      <div className="summary-row" style={{ marginBottom: '0.25rem' }}>
                        <span>
                          Platform Fee & Taxes{' '}
                          <button
                            type="button"
                            onClick={() => setShowFeeBreakdown(prev => !prev)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              color: '#7C3AED',
                              textDecoration: 'underline',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              fontWeight: 500,
                              fontFamily: 'inherit',
                              marginLeft: '4px'
                            }}
                          >
                            (read {showFeeBreakdown ? 'less' : 'more'})
                          </button>
                        </span>
                        <span>₹ {(platformFeeVal + gstAmount).toFixed(2)}</span>
                      </div>
                      {showFeeBreakdown && (
                        <div className="fee-breakdown-details" style={{ paddingLeft: '0.75rem', borderLeft: '2px solid #E9D5FF', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          <div className="summary-row" style={{ fontSize: '0.85rem', color: '#6B7280', marginBottom: 0 }}>
                            <span>Platform Fee ({platformFeeRate}%)</span>
                            <span>₹ {platformFeeVal.toFixed(2)}</span>
                          </div>
                          <div className="summary-row" style={{ fontSize: '0.85rem', color: '#6B7280', marginBottom: 0 }}>
                            <span>CGST ({(gstPercentage / 2).toFixed(1)}%)</span>
                            <span>₹ {(gstAmount / 2).toFixed(2)}</span>
                          </div>
                          <div className="summary-row" style={{ fontSize: '0.85rem', color: '#6B7280', marginBottom: 0 }}>
                            <span>SGST ({(gstPercentage / 2).toFixed(1)}%)</span>
                            <span>₹ {(gstAmount / 2).toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="summary-row" style={{ margin: '0.75rem 0' }}>
                      <span>Platform Fee</span>
                      <span style={{ color: '#10B981', fontWeight: 600 }}>Free</span>
                    </div>
                  )}
                  {appliedCoupon && (
                    <div className="summary-row" style={{ color: '#10B981', fontWeight: 600 }}>
                      <span>Discount ({appliedCoupon.code})</span>
                      <span>- ₹ {discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="summary-row total-row">
                    <span>Grand Total</span>
                    <span>₹ {total.toFixed(2)}</span>
                  </div>
                </>
              )}
              {totalTickets === 0 && (
                <p className="empty-cart-msg">No tickets selected.</p>
              )}
            </div>

            <div className="terms-checkbox" style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
              <input type="checkbox" id="terms" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} />
              <label htmlFor="terms" style={{ fontSize: '0.85rem' }}>
                I agree to Blithe's <Link to="/terms" target="_blank" style={{ color: '#7C3AED', textDecoration: 'underline', fontWeight: 600 }}>terms and conditions</Link>
              </label>
            </div>
            {showErrors && !agreeTerms && (
              <div className="validation-hint" style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>
                <Info size={16} /><span>Please accept the Terms & Conditions.</span>
              </div>
            )}

            <Button
              variant="primary"
              size="lg"
              type="button"
              className="pay-btn"
              onClick={handleCheckout}
              disabled={isVerifyingUser}
              style={{ width: '100%' }}
            >
              {isVerifyingUser ? 'Processing...' : 'Proceed to Payment'} <CreditCard size={18} style={{ marginLeft: '8px' }} />
            </Button>

            <div className="payment-security-note" style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={16} style={{ color: '#10B981' }} />
                <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#374151' }}>100% Secure Payments</span>
              </div>
              <div className="razorpay-info" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#6B7280' }}>
                <span>Powered securely by</span>
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/8/89/Razorpay_logo.svg"
                  alt="Razorpay"
                  style={{ height: '14px', opacity: 0.8 }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventBookingPage;
