import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, MapPin, X, Plus, Minus, User, Mail, Phone, CreditCard, CheckCircle, ShieldCheck, Info, ArrowLeft, Tag, Lock, Timer, Percent, FileText, AlertTriangle } from 'lucide-react';
import { collection, query, where, getDocs, setDoc, doc, getDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db, analytics } from '../../firebase';
import { logEvent } from 'firebase/analytics';
import { createDefaultUserObject, generateUID, updateUserInterests } from '../../services/userService';
import {
  fetchFilteredCoupons,
  applyCoupon as applyCouponService,
  commitCoupon as commitCouponService,
  releaseCoupon as releaseCouponService,
  checkHasBookings,
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
  const [approvalAnswer, setApprovalAnswer] = useState("");

  const lastCheckedEmailRef = useRef('');
  const lastCheckedPhoneRef = useRef('');

  // Load attendee details from sessionStorage on mount and listen for session changes
  useEffect(() => {
    const syncDetails = () => {
      try {
        const cachedDetails = sessionStorage.getItem('blithe_checkout_attendee');
        if (cachedDetails) {
          const parsed = JSON.parse(cachedDetails);
          setAttendee(prev => {
            if (prev.name === parsed.name && prev.email === parsed.email && prev.phone === parsed.phone) {
              return prev;
            }
            return {
              name: parsed.name || '',
              email: parsed.email || '',
              phone: parsed.phone || ''
            };
          });
          if (parsed.uid) {
            setResolvedUserId(parsed.uid);
            setResolvedUserIdForCoupons(parsed.uid);
            setFetchedUserName(parsed.name || '');
            lastCheckedEmailRef.current = (parsed.email || '').trim().toLowerCase();
            lastCheckedPhoneRef.current = (parsed.phone || '').trim();
          }
        } else {
          setAttendee(prev => {
            if (prev.name === '' && prev.email === '' && prev.phone === '') return prev;
            return { name: '', email: '', phone: '' };
          });
          setResolvedUserId(null);
          setResolvedUserIdForCoupons(null);
          setFetchedUserName('');
        }
      } catch (err) {
        console.warn("Failed to load checkout details from session:", err);
      }
    };

    syncDetails();

    window.addEventListener('session-user-changed', syncDetails);
    return () => {
      window.removeEventListener('session-user-changed', syncDetails);
    };
  }, []);

  // Removed real-time save effect to prevent avatar updating letter-by-letter as user types
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [agreeAppTerms, setAgreeAppTerms] = useState(true);
  const [showAppTermsModal, setShowAppTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showFeeBreakdown, setShowFeeBreakdown] = useState(false);
  const [bookingId, setBookingId] = useState('');

  const [showErrors, setShowErrors] = useState(false);
  const [isVerifyingUser, setIsVerifyingUser] = useState(false);
  const [resolvedUserId, setResolvedUserId] = useState(null);
  const [fetchedUserName, setFetchedUserName] = useState('');

  const [termsText, setTermsText] = useState("");
  const [privacyPolicyText, setPrivacyPolicyText] = useState("");

  useEffect(() => {
    const fetchSettingsDoc = async () => {
      try {
        const docRef = doc(db, 'settings', 'settings');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data) {
            if (data.terms) {
              setTermsText(data.terms);
            }
            if (data.privacyPolicy) {
              setPrivacyPolicyText(data.privacyPolicy);
            }
          }
        }
      } catch (err) {
        console.error("Error fetching settings document:", err);
      }
    };
    fetchSettingsDoc();
  }, []);

  const parseTerms = (text) => {
    if (!text) return [];
    if (text.includes('\n')) {
      return text.split('\n').map(t => t.trim()).filter(Boolean);
    }
    const parts = text.split(/(?=\d+\.\s+)/);
    if (parts.length > 1) {
      return parts.map(t => t.trim()).filter(Boolean);
    }
    return [text.trim()];
  };

  const cleanTermText = (text) => {
    if (!text) return '';
    return text.replace(/^\d+\.\s*/, '');
  };

  const termsList = parseTerms(termsText);

  const handleAgreeAndProceed = (e) => {
    setAgreeTerms(true);
    setShowTermsModal(false);
    handleCheckout(e, true);
  };


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
  const [couponSearchInput, setCouponSearchInput] = useState('');
  const [revealedCouponCodes, setRevealedCouponCodes] = useState(new Set());

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

          // Check if it's a private event that is expired or deleted
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const parseTimestampToDate = (ts) => {
            if (!ts) return null;
            if (ts.toDate) return ts.toDate();
            if (ts.seconds) return new Date(ts.seconds * 1000);
            return new Date(ts);
          };
          const endDateObjVal = parseTimestampToDate(data.eventEndDate);
          const startDateObjVal = parseTimestampToDate(data.eventStartDate);
          const isEventExpired = endDateObjVal
            ? endDateObjVal < today
            : (startDateObjVal ? startDateObjVal < today : false);

          const isPrivate = data.isPrivateEvent === true;
          const isDeleted = data.deleted === true;
          const isExpired = data.isExpired === true || isEventExpired;

          if (isPrivate && (isDeleted || isExpired)) {
            setEvent({
              id: docSnap.id,
              isPrivateEvent: true,
              isUnavailablePrivateEvent: true,
              deleted: isDeleted,
              isExpired: isExpired
            });
            return;
          }

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

  // ─── Fetch user info by email or phone fallback ────────────────────────────
  useEffect(() => {
    let active = true;
    let timeoutId = null;

    const trimmedEmail = attendee.email.trim().toLowerCase();
    const trimmedPhone = attendee.phone.trim();
    const trimmedName = attendee.name.trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isEmailValid = emailRegex.test(trimmedEmail);
    const isPhoneValid = /^\d{10}$/.test(trimmedPhone);

    const isAllDetailsEntered = trimmedName !== '' && isEmailValid && isPhoneValid && agreeAppTerms;

    if (isAllDetailsEntered) {
      // If we already successfully looked up this email and phone, don't run it again
      if (trimmedEmail === lastCheckedEmailRef.current && trimmedPhone === lastCheckedPhoneRef.current) {
        return;
      }

      timeoutId = setTimeout(() => {
        const fetchExistingUser = async () => {
          lastCheckedEmailRef.current = trimmedEmail;
          lastCheckedPhoneRef.current = trimmedPhone;

          if (isEmailValid) {
            console.log(`[User Fetch] Querying Firestore for email == ${trimmedEmail}`);
            try {
              const usersRef = collection(db, "users");
              const q = query(usersRef, where("email", "==", trimmedEmail));
              const querySnapshot = await getDocs(q);

              if (!active) return;
              if (!querySnapshot.empty) {
                const userDoc = querySnapshot.docs[0];
                const userData = { uid: userDoc.id, ...userDoc.data() };
                console.log(`[User Fetch] Found user by email in Firestore:`, userData);

                const finalPhone = userData.phoneNo || userData.phone || trimmedPhone;
                lastCheckedPhoneRef.current = finalPhone;

                setAttendee(prev => ({
                  ...prev,
                  name: userData.name || prev.name,
                  phone: finalPhone
                }));
                setResolvedUserId(userData.uid);
                setResolvedUserIdForCoupons(userData.uid);
                setFetchedUserName(userData.name || '');

                try {
                  sessionStorage.setItem('blithe_checkout_attendee', JSON.stringify({
                    name: userData.name || attendee.name,
                    email: attendee.email,
                    phone: finalPhone,
                    uid: userData.uid,
                    profilePic: userData.profilePic || ""
                  }));
                  window.dispatchEvent(new CustomEvent('session-user-changed'));
                } catch (err) {
                  console.warn("Failed to save checkout details to session on email resolve:", err);
                }
                return; // Done
              } else {
                console.log(`[User Fetch] No user found with email == ${trimmedEmail}`);
              }
            } catch (err) {
              console.error("Error fetching existing user by email:", err);
            }
          }

          // If email doesn't exist/isn't found, check phone/mobile
          if (isPhoneValid) {
            console.log(`[User Fetch] Email not found or invalid. Querying Firestore for phoneNo == ${trimmedPhone}`);
            try {
              const usersRef = collection(db, "users");
              const q = query(usersRef, where("phoneNo", "==", trimmedPhone));
              const querySnapshot = await getDocs(q);

              if (!active) return;
              if (!querySnapshot.empty) {
                const userDoc = querySnapshot.docs[0];
                const userData = { uid: userDoc.id, ...userDoc.data() };
                console.log(`[User Fetch] User exists by phone: true. Found UID: ${userData.uid}`);

                const finalEmail = userData.email || trimmedEmail;
                lastCheckedEmailRef.current = finalEmail;

                setAttendee(prev => ({
                  ...prev,
                  name: userData.name || prev.name,
                  email: finalEmail
                }));
                setResolvedUserId(userData.uid);
                setResolvedUserIdForCoupons(userData.uid);
                setFetchedUserName(userData.name || '');

                try {
                  sessionStorage.setItem('blithe_checkout_attendee', JSON.stringify({
                    name: userData.name || attendee.name,
                    email: finalEmail,
                    phone: userData.phoneNo || userData.phone || attendee.phone,
                    uid: userData.uid,
                    profilePic: userData.profilePic || ""
                  }));
                  window.dispatchEvent(new CustomEvent('session-user-changed'));
                } catch (err) {
                  console.warn("Failed to save checkout details to session on phone resolve:", err);
                }
              } else {
                if (trimmedName && isEmailValid && isPhoneValid && agreeAppTerms) {
                  console.log(`[User Fetch] User exists by phone: false for phoneNo == ${trimmedPhone}. Instantly creating user...`);
                  const newUid = generateUID();
                  const newDocRef = doc(usersRef, newUid);
                  const newUserDoc = createDefaultUserObject(newUid, attendee.name, attendee.email, trimmedPhone);
                  await setDoc(newDocRef, newUserDoc);
                  console.log(`[User Fetch] Created user document for UID: ${newUid}`);
                  if (!active) return;
                  setResolvedUserId(newUid);
                  setResolvedUserIdForCoupons(newUid);
                  setFetchedUserName(attendee.name);

                  try {
                    sessionStorage.setItem('blithe_checkout_attendee', JSON.stringify({
                      name: attendee.name,
                      email: attendee.email,
                      phone: trimmedPhone,
                      uid: newUid,
                      profilePic: ""
                    }));
                    window.dispatchEvent(new CustomEvent('session-user-changed'));
                  } catch (err) {
                    console.warn("Failed to save checkout details to session on instant create:", err);
                  }
                } else {
                  console.log(`[User Fetch] Fields not complete yet (Name: "${trimmedName}", Email Valid: ${isEmailValid}, Phone Valid: ${isPhoneValid}, AppTerms: ${agreeAppTerms}). Skipping instant user creation.`);
                }
              }
            } catch (err) {
              console.error("Error fetching existing user by phone:", err);
            }
          }
        };

        fetchExistingUser();
      }, 1000);
    } else {
      if (active) {
        setResolvedUserId(null);
        setResolvedUserIdForCoupons(null);
        setFetchedUserName('');
      }
    }

    return () => {
      active = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [attendee.name, attendee.email, attendee.phone, agreeAppTerms]);

  useEffect(() => {
    if (!resolvedUserId) {
      setFetchedUserName('');
    }
  }, [resolvedUserId]);

  // Apply coupon handler
  const handleApplyCoupon = async (coupon) => {
    const isApplicable = subtotal >= (coupon.minOrderAmount || 0);
    if (!isApplicable || couponApplyingId === coupon.id) return;

    // Resolve userId first if not yet done (phone or email might not be entered)
    let uId = resolvedUserIdForCoupons;
    if (!uId) {
      const trimmedPhone = attendee.phone.trim();
      const trimmedEmail = attendee.email.trim().toLowerCase();
      const isPhoneValid = /^\d{10}$/.test(trimmedPhone);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isEmailValid = emailRegex.test(trimmedEmail);

      if (isEmailValid) {
        try {
          const uRef = collection(db, 'users');
          const uQ = query(uRef, where('email', '==', trimmedEmail));
          const uSnap = await getDocs(uQ);
          if (!uSnap.empty) {
            uId = uSnap.docs[0].id;
            setResolvedUserIdForCoupons(uId);
          }
        } catch (_) { }
      }
      if (!uId && isPhoneValid) {
        try {
          const uRef = collection(db, 'users');
          const uQ = query(uRef, where('phoneNo', '==', trimmedPhone));
          const uSnap = await getDocs(uQ);
          if (!uSnap.empty) {
            uId = uSnap.docs[0].id;
            setResolvedUserIdForCoupons(uId);
          }
        } catch (_) { }
      }
    }

    if (!uId) {
      setCouponErrors(prev => ({ ...prev, [coupon.id]: 'Please enter your phone number or email first so we can verify eligibility.' }));
      toast.error('Please enter your phone number or email first so we can verify eligibility.');
      return;
    }

    // Check if the user has already used this coupon
    const usageRef = collection(db, 'coupons', coupon.id, 'usage');
    const usageQuery = query(usageRef, where('userId', '==', uId));
    try {
      const usageSnap = await getDocs(usageQuery);
      if (!usageSnap.empty) {
        setCouponErrors(prev => ({ ...prev, [coupon.id]: 'You have already used this coupon.' }));
        toast.error('You have already used this coupon.');
        return;
      }
    } catch (err) {
      console.warn('Failed to verify coupon usage:', err);
    }

    setCouponApplyingId(coupon.id);
    setCouponErrors(prev => { const n = { ...prev }; delete n[coupon.id]; return n; });

    // Release previous reservation if a different coupon was selected
    if (appliedCoupon && couponSession && appliedCoupon.id !== coupon.id) {
      try {
        await releaseCouponService({ couponId: appliedCoupon.id, userId: uId, sessionId: couponSession });
      } catch (err) {
        console.warn('Failed to release previous coupon:', err);
      }
      setAppliedCoupon(null);
      setCouponSession(null);
      setCouponReservedUntil(null);
    }

    const result = await applyCouponService({
      couponId: coupon.id,
      userId: uId,
      orderAmount: subtotal,
      eventId: event.id,
    });

    setCouponApplyingId(null);

    if (result.success) {
      setAppliedCoupon(coupon);
      setCouponSession(result.sessionId);
      setCouponReservedUntil(result.reservedUntil);
      toast.success(`Coupon "${coupon.code}" applied successfully!`);
    } else {
      setCouponErrors(prev => ({ ...prev, [coupon.id]: result.error }));
      toast.error(result.error);
    }
  };

  // Remove coupon handler
  const handleRemoveCoupon = async (coupon) => {
    const uId = resolvedUserIdForCoupons || resolvedUserId;
    if (uId && couponSession) {
      try {
        await releaseCouponService({ couponId: coupon.id, userId: uId, sessionId: couponSession });
      } catch (err) {
        console.warn('Failed to release coupon:', err);
      }
    }
    setAppliedCoupon(null);
    setCouponSession(null);
    setCouponReservedUntil(null);
    toast.success('Coupon removed.');
  };

  // Search coupon handler
  const handleCouponSearch = async () => {
    const codeToSearch = couponSearchInput.trim().toUpperCase();
    if (!codeToSearch) {
      toast.error('Please enter a coupon code.');
      return;
    }

    // 1. Search locally first
    let foundCoupon = filteredCoupons.find(
      c => c.code && c.code.trim().toUpperCase() === codeToSearch
    );

    // 2. If not found locally, query Firestore
    if (!foundCoupon) {
      const loadingToastId = toast.loading('Checking coupon code...');
      try {
        const q = query(
          collection(db, 'coupons'),
          where('code', '==', codeToSearch),
          where('isActive', '==', true),
          where('deleted', '==', false)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const docSnap = snap.docs[0];
          const data = docSnap.data();
          foundCoupon = { id: docSnap.id, ...data };
        }
      } catch (err) {
        console.error('Error searching coupon in DB:', err);
      } finally {
        toast.dismiss(loadingToastId);
      }
    }

    if (foundCoupon) {
      const uId = resolvedUserIdForCoupons || resolvedUserId;
      const type = (foundCoupon.type || '').toLowerCase();

      // Check Expiration
      let expiryDate = null;
      if (foundCoupon.expiryDate) {
        if (foundCoupon.expiryDate.toDate) {
          expiryDate = foundCoupon.expiryDate.toDate();
        } else if (foundCoupon.expiryDate.seconds) {
          expiryDate = new Date(foundCoupon.expiryDate.seconds * 1000);
        } else {
          expiryDate = new Date(foundCoupon.expiryDate);
        }
      }
      if (expiryDate && expiryDate < new Date()) {
        toast.error('This coupon has expired.');
        return;
      }

      // Check Event specific eligibility
      if (type === 'event') {
        if (foundCoupon.eventId !== event.id) {
          toast.error('This coupon is not valid for this event.');
          return;
        }
      }

      // Check User specific eligibility
      if (type === 'user') {
        if (!uId) {
          toast.error('Please enter your phone number first so we can verify eligibility.');
          return;
        }
        const targets = foundCoupon.targetUserIds || [];
        if (!targets.includes(uId)) {
          toast.error('This coupon is not valid for your account.');
          return;
        }
      }

      // Check Welcome coupon eligibility
      if (type === 'welcome') {
        if (!uId) {
          toast.error('Please enter your phone number first so we can verify eligibility.');
          return;
        }
        const hasBookings = await checkHasBookings(uId);
        if (hasBookings) {
          toast.error('Welcome coupons are only for first-time bookings.');
          return;
        }
      }

      // Check usage limit
      if (foundCoupon.usageLimit > 0) {
        const usedCount = foundCoupon.usedCount || 0;
        const reservedCount = foundCoupon.reservedCount || 0;
        const effectiveUsed = usedCount + reservedCount;
        if (effectiveUsed >= foundCoupon.usageLimit) {
          toast.error('Coupon usage limit reached.');
          return;
        }
      }

      // Check if the user has already used this coupon
      if (uId) {
        const usageRef = collection(db, 'coupons', foundCoupon.id, 'usage');
        const usageQuery = query(usageRef, where('userId', '==', uId));
        try {
          const usageSnap = await getDocs(usageQuery);
          if (!usageSnap.empty) {
            toast.error('You have already used this coupon.');
            return;
          }
        } catch (err) {
          console.warn('Failed to verify coupon usage on search:', err);
        }
      }

      // Add to local filteredCoupons state so standard UI functions work on it
      setFilteredCoupons(prev => {
        if (prev.some(c => c.id === foundCoupon.id)) return prev;
        return [...prev, foundCoupon];
      });

      // Add to revealed list
      setRevealedCouponCodes(prev => {
        const next = new Set(prev);
        next.add(codeToSearch);
        return next;
      });

      // Check if applicable
      const isApplicable = subtotal >= (foundCoupon.minOrderAmount || 0);
      if (isApplicable) {
        await handleApplyCoupon(foundCoupon);
      } else {
        const neededAmount = (foundCoupon.minOrderAmount || 0) - subtotal;
        toast.error(`Coupon found! Add ₹${neededAmount} more to apply.`);
      }
    } else {
      toast.error('Invalid or expired coupon code.');
    }
  };

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
    return (
      <div className="error-page container">
        <div className="error-icon-wrapper not-found">
          <AlertTriangle size={48} />
        </div>
        <h2>Event Not Found</h2>
        <p>
          The event checkout could not be loaded. This event may have been removed.
        </p>
        <Link to="/events" className="back-btn">
          Explore Other Events
        </Link>
      </div>
    );
  }

  if (event.isUnavailablePrivateEvent) {
    return (
      <div className="error-page container">
        <div className="error-icon-wrapper">
          <Lock size={48} />
        </div>
        <h2>Checkout Unavailable</h2>
        <p>
          Registration for this private event is no longer open because the event has expired or been cancelled.
        </p>
        <Link to="/events" className="back-btn">
          Back to Events
        </Link>
      </div>
    );
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
    const discountVal = coupon.discountValue;
    if (coupon.percentage) {
      const computed = Math.round(currentSubtotal * (discountVal / 100));
      return coupon.maxDiscount ? Math.min(computed, coupon.maxDiscount) : computed;
    }
    return discountVal;
  };

  const discountAmount = calculateDiscount(appliedCoupon, subtotal);
  const total = Math.max(0, (subtotal - discountAmount) + platformFeeVal + gstAmount);
  const totalTickets = Object.values(quantities).reduce((a, b) => a + b, 0);

  const isPhoneValid = /^\d{10}$/.test(attendee.phone.trim());
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(attendee.email.trim());

  const isValid =
    totalTickets > 0 &&
    (isMultiDay ? selectedDate !== null : true) &&
    attendee.name.trim() !== '' &&
    attendee.email.trim() !== '' &&
    isPhoneValid &&
    (event?.approvalNeeded && event?.approvalQuestion ? approvalAnswer.trim() !== '' : true) &&
    agreeTerms && agreeAppTerms;

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
  const createPendingBooking = async (orderId, bId, uId, bookedTickets, priceDetails, finalBookingSearchList, userProfileImage) => {
    const pendingBookingRef = doc(db, "pendingBookings", orderId);
    const selectedDateVal = selectedDate ? selectedDate : startDate;

    const couponMap = appliedCoupon ? {
      code: String(appliedCoupon.code),
      discount: Number(discountAmount),
      discountValue: Number(appliedCoupon.discountValue),
      id: String(appliedCoupon.id),
      percentage: Boolean(appliedCoupon.percentage)
    } : {};

    const formattedPriceDetails = {
      couponDiscountPrice: Number(priceDetails.couponDiscountPrice || 0),
      gstAmount: Number(priceDetails.gstAmount || 0),
      gstPercentage: Number(priceDetails.gstPercentage || 0),
      platformFee: Number(priceDetails.platformFee || 0),
      platformFeePercentage: Number(priceDetails.platformFeePercentage || 0),
      totalDiscount: Number(priceDetails.totalDiscount || 0),
      totalPrice: Number(priceDetails.totalPrice || 0),
      totalTicketPrice: Number(priceDetails.totalTicketPrice || 0)
    };

    const preparedTickets = bookedTickets.map((t) => ({
      category: String(t.category || "generic"),
      price: Number(t.price || 0),
      quantity: Number(t.quantity || 0),
      ticketName: String(t.ticketName || ""),
      totalPrice: Number(t.totalPrice || 0),
      totalQuantity: Number(t.totalQuantity || 0)
    }));

    const bookingData = {
      bookingDate: serverTimestamp(),
      bookingId: bId,
      coupon: couponMap,
      createdDate: serverTimestamp(),
      eventDate: selectedDateVal,
      eventId: event.id,
      eventImage: (event.image && event.image.length > 0) ? String(event.image[0]) : String(event.image || ""),
      eventLat: Number(event.lat || event.latitude || 0.0),
      eventLocation: String(event.eventLocation || event.location || event.address || event.venue || ""),
      eventLong: Number(event.long || event.longitude || 0.0),
      eventName: String(event.eventName || event.title || ""),
      eventType: String(event.eventType || "Online"),
      isRated: false,
      isSkipped: false,
      platform: "Web",
      priceDetails: formattedPriceDetails,
      searchList: finalBookingSearchList,
      serviceCode: String(event.serviceCode || settings?.serviceCode || ""),
      status: "pending",
      approvalQuestion: event.approvalQuestion || "",
      approvalAnswer: event.approvalQuestion ? approvalAnswer : "",
      approvalNeeded: event.approvalNeeded === true,
      isPrivateEvent: event.isPrivateEvent === true,
      tickets: preparedTickets,
      totalAttendedQuantity: 0,
      totalPrice: Number(total),
      totalQuantity: Number(totalTickets),
      userEmail: String(attendee.email),
      userId: String(uId),
      userName: String(attendee.name),
      userPhone: String(attendee.phone),
      userProfileImage: String(userProfileImage || "")
    };

    await setDoc(pendingBookingRef, {
      availabilityDate: formatDateStr(selectedDateVal),
      bookingData: bookingData,
      bookingId: bId,
      coupon: couponMap,
      createdAt: serverTimestamp(),
      createdDate: serverTimestamp(),
      eventId: event.id,
      eventName: String(event.eventName || event.title || ""),
      eventType: String(event.eventType || "Online"),
      paymentId: "",
      paymentMode: "razorpay",
      platform: "Web",
      priceDetails: formattedPriceDetails,
      razorpayOrderId: orderId,
      tickets: preparedTickets,
      status: "pending",
      totalPrice: Number(total),
      userId: uId,
      userPhone: attendee.phone
    });
  };

  const handleCheckout = async (e, bypassTermsCheck = false) => {
    if (e && e.preventDefault) e.preventDefault();
    const isFormValid =
      totalTickets > 0 &&
      (isMultiDay ? selectedDate !== null : true) &&
      attendee.name.trim() !== '' &&
      attendee.email.trim() !== '' &&
      isPhoneValid &&
      (event?.approvalNeeded && event?.approvalQuestion ? approvalAnswer.trim() !== '' : true) &&
      (agreeTerms || bypassTermsCheck) &&
      agreeAppTerms;

    if (!isFormValid) {
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

    if (total > 0) {
      try {
        logEvent(analytics, 'pay_and_proceed_button_click', {
          email: attendee.email,
          event_id: event.id,
          event_name: event.eventName || event.title,
          platform: 'web',
        });
      } catch (analyticsErr) {
        console.warn("Failed to log pay_and_proceed_button_click to Firebase Analytics:", analyticsErr);
      }
    }

    try {
      // 1. Resolve User
      const usersRef = collection(db, "users");
      let uId = null;
      let userProfileImage = "";
      let userFound = false;

      // Try email lookup first
      if (attendee.email) {
        const trimmedEmail = attendee.email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(trimmedEmail)) {
          const q = query(usersRef, where("email", "==", trimmedEmail));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            uId = userDoc.id;
            userProfileImage = userDoc.data().profilePic || "";
            userFound = true;
            console.log(`User already exists with UID (found by email): ${uId}`);
          }
        }
      }

      // Try phone lookup if not found by email
      if (!userFound) {
        const trimmedPhone = attendee.phone.trim();
        if (/^\d{10}$/.test(trimmedPhone)) {
          const q = query(usersRef, where("phoneNo", "==", trimmedPhone));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            uId = userDoc.id;
            userProfileImage = userDoc.data().profilePic || "";
            userFound = true;
            console.log(`User already exists with UID (found by phone): ${uId}`);
          }
        }
      }

      if (!userFound) {
        uId = generateUID();
        const newDocRef = doc(usersRef, uId);
        console.log(`User does not exist. Creating new record with UID: ${uId}`);
        const newUserDocument = createDefaultUserObject(uId, attendee.name, attendee.email, attendee.phone);
        await setDoc(newDocRef, newUserDocument);
        console.log(`New user record created successfully with UID: ${uId}`);
      } else {
        console.log(`User already exists. Skipping merging details to protect the existing document.`);
      }

      setResolvedUserId(uId);
      setFetchedUserName(attendee.name);
      // Update userId for coupon context so re-fetch filters properly
      if (!resolvedUserIdForCoupons) setResolvedUserIdForCoupons(uId);

      // Save user profile state and dispatch change event only when user clicks Proceed to Payment
      try {
        sessionStorage.setItem('blithe_checkout_attendee', JSON.stringify({
          name: attendee.name,
          email: attendee.email,
          phone: attendee.phone,
          uid: uId,
          profilePic: userProfileImage || ""
        }));
        window.dispatchEvent(new CustomEvent('session-user-changed'));
      } catch (err) {
        console.warn("Failed to save checkout details to session on proceed:", err);
      }

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
        if (appliedCoupon && couponSession && uId) {
          const commitResult = await commitCouponService({
            couponId: appliedCoupon.id,
            userId: uId,
            sessionId: couponSession,
          });
          if (!commitResult.success) {
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

        // Prepare booked tickets with matching properties
        const preparedTickets = bookedTickets.map((t) => ({
          category: String(t.category || "generic"),
          price: Number(t.price || 0),
          quantity: Number(t.quantity || 0),
          ticketName: String(t.ticketName || ""),
          totalPrice: Number(t.totalPrice || 0),
          totalQuantity: Number(t.totalQuantity || 0)
        }));

        const couponMap = appliedCoupon ? {
          code: String(appliedCoupon.code),
          discount: Number(discountAmount),
          discountValue: Number(appliedCoupon.discountValue),
          id: String(appliedCoupon.id),
          percentage: Boolean(appliedCoupon.percentage)
        } : {};

        const formattedPriceDetails = {
          couponDiscountPrice: Number(priceDetails.couponDiscountPrice),
          gstAmount: Number(priceDetails.gstAmount),
          gstPercentage: Number(priceDetails.gstPercentage),
          platformFee: Number(priceDetails.platformFee),
          platformFeePercentage: Number(priceDetails.platformFeePercentage),
          totalDiscount: Number(priceDetails.totalDiscount),
          totalPrice: Number(priceDetails.totalPrice),
          totalTicketPrice: Number(priceDetails.totalTicketPrice)
        };

        const isFree = paymentId === "free";

        const myBookingData = isFree ? {
          bookingDate: serverTimestamp(),
          bookingId: bId,
          coupon: couponMap,
          createdDate: serverTimestamp(),
          eventDate: selectedDateVal,
          eventId: event.id,
          eventImage: (event.image && event.image.length > 0) ? String(event.image[0]) : String(event.image || ""),
          eventLat: Number(event.lat || event.latitude || 0.0),
          eventLocation: String(event.eventLocation || event.location || event.address || event.venue || ""),
          eventLong: Number(event.long || event.longitude || 0.0),
          eventName: String(event.eventName || event.title || ""),
          eventType: String(event.eventType || "Online"),
          isRated: false,
          isSkipped: false,
          platform: "Web",
          priceDetails: formattedPriceDetails,
          searchList: searchList,
          serviceCode: String(event.serviceCode || settings?.serviceCode || "998311"),
          status: event.approvalNeeded ? "pending" : "confirmed",
          approvalQuestion: event.approvalQuestion || "",
          approvalAnswer: event.approvalQuestion ? approvalAnswer : "",
          approvalNeeded: event.approvalNeeded === true,
          isPrivateEvent: event.isPrivateEvent === true,
          tickets: bookedTickets.map((t) => ({
            category: String(t.category || "generic"),
            price: Number(t.price || 0),
            quantity: Number(t.quantity || 0),
            ticketName: String(t.ticketName || ""),
            totalAttendedQuantity: 0,
            totalPrice: Number(t.totalPrice || 0),
            totalQuantity: Number(t.quantity || t.totalQuantity || 0),
            userEmail: String(t.userEmail || attendee.email),
            userId: String(t.userId || uId),
            userName: String(t.userName || attendee.name),
            userPhone: String(t.userPhone || attendee.phone || ""),
            userProfileImage: String(t.userProfileImage || userProfileImage || "")
          })),
          totalPrice: Number(total),
          totalQuantity: Number(totalTickets),
          userEmail: String(attendee.email),
          userId: String(uId),
          userName: String(attendee.name),
          userPhone: String(attendee.phone),
          userProfileImage: String(userProfileImage || "")
        } : {
          bookingDate: serverTimestamp(),
          bookingId: bId,
          coupon: couponMap,
          createdDate: serverTimestamp(),
          eventDate: selectedDateVal,
          eventId: event.id,
          eventImage: (event.image && event.image.length > 0) ? String(event.image[0]) : String(event.image || ""),
          eventLat: Number(event.lat || event.latitude || 0.0),
          eventLocation: String(event.eventLocation || event.location || event.address || event.venue || ""),
          eventLong: Number(event.long || event.longitude || 0.0),
          eventName: String(event.eventName || event.title || ""),
          eventType: String(event.eventType || "Online"),
          isRated: false,
          isSkipped: false,
          paymentId: String(paymentId),
          paymentStatus: String(paymentStatusVal),
          platform: "Web",
          priceDetails: formattedPriceDetails,
          razorpayOrderId: String(orderId),
          searchList: searchList,
          serviceCode: String(event.serviceCode || settings?.serviceCode || "998311"),
          status: event.approvalNeeded ? "pending" : "confirmed",
          approvalQuestion: event.approvalQuestion || "",
          approvalAnswer: event.approvalQuestion ? approvalAnswer : "",
          approvalNeeded: event.approvalNeeded === true,
          isPrivateEvent: event.isPrivateEvent === true,
          tickets: preparedTickets,
          updatedAt: serverTimestamp(),
          userEmail: String(attendee.email),
          userId: String(uId),
          userName: String(attendee.name),
          userPhone: String(attendee.phone),
          userProfileImage: String(userProfileImage || "")
        };

        const eventBookingData = isFree ? {
          bookingDate: serverTimestamp(),
          bookingId: bId,
          coupon: couponMap,
          createdDate: serverTimestamp(),
          eventDate: selectedDateVal,
          eventId: event.id,
          eventImage: (event.image && event.image.length > 0) ? String(event.image[0]) : String(event.image || ""),
          eventLat: Number(event.lat || event.latitude || 0.0),
          eventLocation: String(event.eventLocation || event.location || event.address || event.venue || ""),
          eventLong: Number(event.long || event.longitude || 0.0),
          eventName: String(event.eventName || event.title || ""),
          eventType: String(event.eventType || "Online"),
          isRated: false,
          isSkipped: false,
          platform: "Web",
          priceDetails: formattedPriceDetails,
          searchList: searchList,
          serviceCode: String(event.serviceCode || settings?.serviceCode || "998311"),
          status: event.approvalNeeded ? "pending" : "confirmed",
          approvalQuestion: event.approvalQuestion || "",
          approvalAnswer: event.approvalQuestion ? approvalAnswer : "",
          approvalNeeded: event.approvalNeeded === true,
          isPrivateEvent: event.isPrivateEvent === true,
          tickets: bookedTickets.map((t) => ({
            category: String(t.category || "generic"),
            price: Number(t.price || 0),
            quantity: Number(t.quantity || 0),
            ticketName: String(t.ticketName || ""),
            totalAttendedQuantity: 0,
            totalPrice: Number(t.totalPrice || 0),
            totalQuantity: Number(t.quantity || t.totalQuantity || 0),
            userEmail: String(t.userEmail || attendee.email),
            userId: String(t.userId || uId),
            userName: String(t.userName || attendee.name),
            userPhone: String(t.userPhone || attendee.phone || ""),
            userProfileImage: String(t.userProfileImage || userProfileImage || "")
          })),
          totalPrice: Number(total),
          totalQuantity: Number(totalTickets),
          userEmail: String(attendee.email),
          userId: String(uId),
          userName: String(attendee.name),
          userPhone: String(attendee.phone),
          userProfileImage: String(userProfileImage || "")
        } : {
          bookingDate: serverTimestamp(),
          bookingId: bId,
          coupon: couponMap,
          createdDate: serverTimestamp(),
          eventDate: selectedDateVal,
          eventId: event.id,
          eventImage: (event.image && event.image.length > 0) ? String(event.image[0]) : String(event.image || ""),
          eventLat: Number(event.lat || event.latitude || 0.0),
          eventLocation: String(event.eventLocation || event.location || event.address || event.venue || ""),
          eventLong: Number(event.long || event.longitude || 0.0),
          eventName: String(event.eventName || event.title || ""),
          eventType: String(event.eventType || "Online"),
          isRated: false,
          isSkipped: false,
          paymentId: String(paymentId),
          paymentStatus: String(paymentStatusVal),
          platform: "Web",
          priceDetails: formattedPriceDetails,
          razorpayOrderId: String(orderId),
          searchList: searchList,
          serviceCode: String(event.serviceCode || settings?.serviceCode || "998311"),
          status: event.approvalNeeded ? "pending" : "confirmed",
          approvalQuestion: event.approvalQuestion || "",
          approvalAnswer: event.approvalQuestion ? approvalAnswer : "",
          approvalNeeded: event.approvalNeeded === true,
          isPrivateEvent: event.isPrivateEvent === true,
          tickets: preparedTickets,
          updatedAt: serverTimestamp(),
          userEmail: String(attendee.email),
          userId: String(uId),
          userName: String(attendee.name),
          userPhone: String(attendee.phone),
          userProfileImage: String(userProfileImage || "")
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

          // 2. Notifications References
          const userNotiRef = doc(collection(db, "notification"));
          const orgNotiRef = doc(collection(db, "notification"));

          if (event.approvalNeeded) {
            // Write user booking and event booking directly (status pending)
            transaction.set(userBookingRef, myBookingData);
            transaction.set(eventBookingRef, eventBookingData);

            // Create notification documents
            const userNotification = {
              title: "Booking Pending",
              body: `Your booking request for '${eventDbData.eventName || eventDbData.title || ''}' is pending approval. You will receive a confirmation once the organizer reviews it.`,
              fromId: eventDbData.oId || "",
              toId: uId,
              fromUser: eventDbData.eventName || eventDbData.title || "",
              toUser: attendee.name,
              id: userNotiRef.id,
              navigationId: bId,
              type: "Booking Pending",
              fromOrg: true,
              toOrg: false,
              status: 0,
              date: new Date(),
              references: userNotiRef,
              isRead: false,
              rejectedReason: ""
            };

            const orgNotification = {
              title: "Booking Request",
              body: `${attendee.name} requested to book ${eventDbData.eventName || eventDbData.title || ''}`,
              fromId: uId,
              toId: eventDbData.oId || "",
              fromUser: attendee.name,
              toUser: eventDbData.eventName || eventDbData.title || "",
              id: orgNotiRef.id,
              navigationId: bId,
              type: "Booking Request",
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
          } else {
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
          }
        });

        // 6. Send Booking Emails (after transaction succeeds)
        if (event.approvalNeeded) {
          // Send Pending Confirmation Email to user
          if (attendee.email) {
            try {
              const pendingEmailHtml = `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;">
                <div style="background:#FF9900;padding:20px;border-radius:10px 10px 0 0;text-align:center;">
                  <h1 style="color:#fff;margin:0;">Booking Request Pending!</h1>
                </div>
                <div style="background:#fff;padding:20px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 10px 10px;">
                  <p style="font-size:16px;">Hi <strong>${attendee.name || 'there'}</strong>,</p>
                  <p>Your booking request for <strong>${event.eventName || event.title || ''}</strong> has been received and is pending approval by the organizer.</p>
                  <p>We will notify you by email as soon as the organizer reviews and updates your booking status.</p>
                  <div style="background:#f9f9f9;padding:15px;border-radius:8px;margin:15px 0;">
                    <table style="width:100%;">
                      <tr><td style="color:#888;width:120px;padding:3px 0;">Booking ID</td><td><strong>${bId}</strong></td></tr>
                      <tr><td style="color:#888;padding:3px 0;">Event Name</td><td><strong>${event.eventName || event.title || ''}</strong></td></tr>
                      <tr><td style="color:#888;padding:3px 0;">Status</td><td><strong style="color:#FF9900;">Pending Approval</strong></td></tr>
                    </table>
                  </div>
                  <hr style="border:none;border-top:1px solid #eee;margin:10px 0 20px 0;">
                  <p style="text-align:center;color:#888;font-size:13px;line-height:1.5;">
                    Need help? Contact our support team.<br>
                    <a href="https://www.blithe.social/" style="color:#6C63FF;text-decoration:none;margin:0 10px;font-weight:bold;">Website</a> | 
                    <a href="https://www.instagram.com/blithe.social?igsh=MWM4eGw4dnVxYTU0bw%3D%3D" style="color:#6C63FF;text-decoration:none;margin:0 10px;font-weight:bold;">Instagram</a><br>
                    Thank you for choosing <strong>Blithe</strong>! 🎶
                  </p>
                </div>
              </div>`;

              await setDoc(doc(collection(db, "sendMail")), {
                date: serverTimestamp(),
                emailList: [attendee.email],
                html: pendingEmailHtml,
                status: `Booking Request Pending - ${event.eventName || event.title || ""}`
              });
            } catch (mailErr) {
              console.error("Pending email sending failure:", mailErr);
            }
          }

          // Send notification email to the organizer if allowed
          if (event.orgBookingEmailAllow && event.organiserMail && event.organiserMail.trim()) {
            try {
              const ticketRowsOrg = bookedTickets
                .map((t) => `<tr>
                    <td style="padding:8px;border:1px solid #ddd;">${t.ticketName}</td>
                    <td style="padding:8px;border:1px solid #ddd;text-align:center;">${t.quantity}</td>
                  </tr>`)
                .join('');

              const eventDateStr = selectedDateVal.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: '2-digit' });

              const orgEmailHtml = `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;">
                <div style="background:#FFA500;padding:20px;border-radius:10px 10px 0 0;text-align:center;">
                  <h1 style="color:#fff;margin:0;">New Booking Request</h1>
                </div>
                <div style="background:#fff;padding:20px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 10px 10px;">
                  <p style="font-size:16px;">Hi Organizer,</p>
                  <p>You have received a new booking request for your private event: <strong>${event.eventName || event.title || ""}</strong>.</p>
                  
                  <h3 style="border-bottom:2px solid #FFA500;padding-bottom:5px;margin-top:25px;font-size:18px;">Request Details</h3>
                  <div style="background:#f9f9f9;padding:15px;border-radius:8px;margin:15px 0;">
                    <table style="width:100%;">
                      <tr><td style="color:#888;width:120px;padding:3px 0;">Name</td><td><strong>${attendee.name}</strong></td></tr>
                      <tr><td style="color:#888;padding:3px 0;">Email</td><td><strong>${attendee.email}</strong></td></tr>
                      <tr><td style="color:#888;padding:3px 0;">Phone</td><td><strong>${attendee.phone && attendee.phone.trim() ? attendee.phone : 'N/A'}</strong></td></tr>
                      <tr><td style="color:#888;padding:3px 0;">Booking ID</td><td><strong>${bId}</strong></td></tr>
                      <tr><td style="color:#888;padding:3px 0;">Event Date</td><td><strong>${eventDateStr}</strong></td></tr>
                      ${event.approvalQuestion ? `<tr><td style="color:#888;padding:3px 0;">Question</td><td><strong>${event.approvalQuestion}</strong></td></tr>` : ''}
                      ${approvalAnswer ? `<tr><td style="color:#888;padding:3px 0;">Answer</td><td><strong>${approvalAnswer}</strong></td></tr>` : ''}
                    </table>
                  </div>

                  <h3 style="border-bottom:2px solid #FFA500;padding-bottom:5px;margin-top:25px;font-size:18px;">Ticket Details</h3>
                  <table style="width:100%;border-collapse:collapse;margin:10px 0;">
                    <tr style="background:#f5f5f5;">
                      <th style="padding:10px;border:1px solid #ddd;text-align:left;">Ticket Type</th>
                      <th style="padding:10px;border:1px solid #ddd;text-align:center;">Quantity</th>
                    </tr>
                    ${ticketRowsOrg}
                  </table>

                  <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
                  <p style="text-align:center;color:#888;font-size:13px;line-height:1.5;">
                    Please open the app to approve or reject this booking request.<br>
                    Thank you for hosting with <strong>Blithe</strong>!
                  </p>
                </div>
              </div>`;

              await setDoc(doc(collection(db, "sendMail")), {
                date: serverTimestamp(),
                emailList: [event.organiserMail],
                html: orgEmailHtml,
                status: `New Booking Request - ${event.eventName || event.title || ""}`
              });
            } catch (orgMailErr) {
              console.error("Organizer email sending failure:", orgMailErr);
            }
          }

          console.log('Successfully created booking request!');
          const categoryIdentifier = event.categoryId || event.category_id || event.category || "Other";
          updateUserInterests(uId, categoryIdentifier, 5);

          setAppliedCoupon(null);
          setCouponSession(null);
          setCouponReservedUntil(null);

          toast.success('Booking request submitted successfully! Pending approval.');
          setTimeout(() => {
            navigate(`/booking-success?bookingId=${bId}&eventId=${event.id}&userId=${uId}`);
          }, 1500);

        } else {
          // Send Confirmed Booking Email (after transaction succeeds)
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
                      <td style="color:#666;padding:8px 0;border-bottom:1px solid #eee;">Platform Fee</td>
                      <td style="text-align:right;padding:8px 0;border-bottom:1px solid #eee;">₹${platformFeeVal.toFixed(2)}</td>
                    </tr>` : ''}
                    ${gstAmount > 0 ? `
                    <tr>
                      <td style="color:#666;padding:8px 0;border-bottom:1px solid #eee;">CGST</td>
                      <td style="text-align:right;padding:8px 0;border-bottom:1px solid #eee;">₹${(gstAmount / 2).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td style="color:#666;padding:8px 0;border-bottom:1px solid #eee;">SGST</td>
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

          // Send notification email to the organizer if allowed
          if (event.orgBookingEmailAllow && event.organiserMail && event.organiserMail.trim()) {
            try {
              const ticketRowsOrg = bookedTickets
                .map((t) => `<tr>
                    <td style="padding:8px;border:1px solid #ddd;">${t.ticketName}</td>
                    <td style="padding:8px;border:1px solid #ddd;text-align:center;">${t.quantity}</td>
                  </tr>`)
                .join('');

              const eventDateStr = selectedDateVal.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: '2-digit' });

              const orgEmailHtml = `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;">
                <div style="background:#4CAF50;padding:20px;border-radius:10px 10px 0 0;text-align:center;">
                  <h1 style="color:#fff;margin:0;">New Booking Alert</h1>
                </div>
                <div style="background:#fff;padding:20px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 10px 10px;">
                  <p style="font-size:16px;">Hi Organizer,</p>
                  <p>You have received a new booking for your event: <strong>${event.eventName || event.title || ""}</strong>.</p>
                  
                  <h3 style="border-bottom:2px solid #4CAF50;padding-bottom:5px;margin-top:25px;font-size:18px;">Attendee Details</h3>
                  <div style="background:#f9f9f9;padding:15px;border-radius:8px;margin:15px 0;">
                    <table style="width:100%;">
                      <tr><td style="color:#888;width:120px;padding:3px 0;">Name</td><td><strong>${attendee.name}</strong></td></tr>
                      <tr><td style="color:#888;padding:3px 0;">Email</td><td><strong>${attendee.email}</strong></td></tr>
                      <tr><td style="color:#888;padding:3px 0;">Phone</td><td><strong>${attendee.phone && attendee.phone.trim() ? attendee.phone : 'N/A'}</strong></td></tr>
                      <tr><td style="color:#888;padding:3px 0;">Booking ID</td><td><strong>${bId}</strong></td></tr>
                      <tr><td style="color:#888;padding:3px 0;">Event Date</td><td><strong>${eventDateStr}</strong></td></tr>
                    </table>
                  </div>

                  <h3 style="border-bottom:2px solid #4CAF50;padding-bottom:5px;margin-top:25px;font-size:18px;">Ticket Details</h3>
                  <table style="width:100%;border-collapse:collapse;margin:10px 0;">
                    <tr style="background:#f5f5f5;">
                      <th style="padding:10px;border:1px solid #ddd;text-align:left;">Ticket Type</th>
                      <th style="padding:10px;border:1px solid #ddd;text-align:center;">Quantity</th>
                    </tr>
                    ${ticketRowsOrg}
                  </table>

                  <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
                  <p style="text-align:center;color:#888;font-size:13px;line-height:1.5;">
                    Thank you for hosting with <strong>Blithe</strong>!
                  </p>
                </div>
              </div>`;

              await setDoc(doc(collection(db, "sendMail")), {
                date: serverTimestamp(),
                emailList: [event.organiserMail],
                html: orgEmailHtml,
                status: `New Booking Alert - ${event.eventName || event.title || ""}`
              });
            } catch (orgMailErr) {
              console.error("Organizer email sending failure:", orgMailErr);
            }
          }

          console.log('Successfully created booking records!');
          const categoryIdentifier = event.categoryId || event.category_id || event.category || "Other";
          updateUserInterests(uId, categoryIdentifier, 5);

          setAppliedCoupon(null);
          setCouponSession(null);
          setCouponReservedUntil(null);

          toast.success('Booking confirmed successfully!');
          setTimeout(() => {
            navigate(`/booking-success?bookingId=${bId}&eventId=${event.id}&userId=${uId}`);
          }, 1500);
        }
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
        await createPendingBooking(orderId, bId, uId, bookedTickets, priceDetails, finalBookingSearchList, userProfileImage);

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

            try {
              logEvent(analytics, 'booking_payment_success', {
                payment_id: paymentId || '',
                order_id: response.razorpay_order_id || orderId || '',
                event_id: event.id,
                event_name: event.eventName || event.title,
                platform: 'web',
              });
            } catch (analyticsErr) {
              console.warn("Failed to log booking_payment_success to Firebase Analytics:", analyticsErr);
            }

            // Commit the coupon reservation so usedCount is incremented and
            // reservedCount is decremented on the coupon document.
            if (appliedCoupon && couponSession && uId) {
              try {
                const commitResult = await commitCouponService({
                  couponId: appliedCoupon.id,
                  userId: uId,
                  sessionId: couponSession,
                });
                if (!commitResult.success) {
                  console.warn('[Coupon] commitCoupon failed after payment:', commitResult.error);
                  // Non-fatal — booking still proceeds; reservation will auto-expire.
                }
              } catch (err) {
                console.warn('[Coupon] commitCouponService threw after payment:', err);
              }
            }

            // For paid events, the backend Cloud Function handles the booking creation,
            // slot decrementing, notifications, and emails via Razorpay webhook.
            // Client side only shows success and redirects.
            // Update user interests with category score (score = 5 for booking events)
            const categoryIdentifier = event.categoryId || event.category_id || event.category || "Other";
            updateUserInterests(uId, categoryIdentifier, 5);

            setAppliedCoupon(null);
            setCouponSession(null);
            setCouponReservedUntil(null);
            // Keep session storage details to preserve form state if user navigates back

            toast.success("Payment successful! Your booking is being processed.");
            setTimeout(() => {
              navigate(`/booking-success?bookingId=${bId}&eventId=${event.id}&userId=${uId}`);
            }, 1500);
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
          <button onClick={() => navigate(`/events/${id}`)} className="back-link-btn">
            <ArrowLeft size={20} /> <span className="text">Back to Event</span>
          </button>
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
                        {(Number(ticket.actualPrice || 0) > Number(ticket.blithePrice || 0)) && (
                          <span className="original-price" style={{ textDecoration: 'line-through', color: '#9CA3AF', marginRight: '0.4rem', fontSize: '0.85em', fontWeight: 500 }}>
                            ₹ {ticket.actualPrice}
                          </span>
                        )}
                        {(!ticket.blithePrice || Number(ticket.blithePrice) === 0) ? 'FREE' : `₹ ${ticket.blithePrice}`}
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
            {!resolvedUserId && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: '#F9FAFB',
                border: '1px solid #E5E7EB',
                padding: '0.6rem 0.85rem',
                borderRadius: '0.5rem',
                marginBottom: '1rem'
              }}>
                <Info size={18} style={{ color: '#7C3AED' }} />
                <span style={{ fontSize: '0.88rem', color: 'black', fontWeight: 500 }}>
                  New here? We'll create an account for you
                </span>
              </div>
            )}

            <div className="terms-checkbox" style={{ marginTop: '0.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="appTerms"
                checked={agreeAppTerms}
                onChange={(e) => setAgreeAppTerms(e.target.checked)}
                style={{ width: 'auto', cursor: 'pointer', margin: 0 }}
              />
              <label htmlFor="appTerms" style={{ fontSize: '0.85rem', cursor: 'pointer', margin: 0, color: '#4B5563' }}>
                I agree to the <span onClick={(e) => { e.preventDefault(); setShowPrivacyModal(true); }} style={{ color: '#7C3AED', textDecoration: 'underline', fontWeight: 600, cursor: 'pointer' }}>Privacy Policy</span>
              </label>
            </div>
            {showErrors && !agreeAppTerms && (
              <div className="validation-hint" style={{ marginTop: '-0.75rem', marginBottom: '1rem' }}>
                <Info size={16} /><span>Please accept the Privacy Policy.</span>
              </div>
            )}

            <div className="input-group">
              <label htmlFor="name">Full Name <span className="required-star">*</span></label>
              <div className="input-wrapper">
                <User size={18} className="input-icon" />
                <input type="text" id="name" placeholder="e.g. Rahul Sharma" value={attendee.name} onChange={(e) => setAttendee(prev => ({ ...prev, name: e.target.value.replace(/[^a-zA-Z\s]/g, '') }))} />
              </div>
              {showErrors && !attendee.name.trim() && (
                <div className="validation-hint"><Info size={16} /><span>Please provide your full name.</span></div>
              )}
            </div>

            <div className="input-row-two-col">
              <div className="input-group">
                <label htmlFor="email">Email Address <span className="required-star">*</span></label>
                <div className="input-wrapper">
                  <Mail size={18} className="input-icon" />
                  <input
                    type="email"
                    id="email"
                    placeholder="e.g. rahul@example.com"
                    value={attendee.email}
                    onChange={(e) => {
                      const newEmail = e.target.value;
                      setAttendee(prev => {
                        if (resolvedUserId) {
                          setResolvedUserId(null);
                          setResolvedUserIdForCoupons(null);
                        }
                        return { ...prev, email: newEmail };
                      });
                    }}
                  />
                </div>
                {((showErrors || (attendee.name.trim() !== '' && isPhoneValid)) && !attendee.email.trim()) && (
                  <div className="validation-hint"><Info size={16} /><span>Please enter your email.</span></div>
                )}
              </div>

              <div className="input-group">
                <label htmlFor="phone">Phone Number <span className="required-star">*</span></label>
                <div className="input-wrapper">
                  <Phone size={18} className="input-icon" />
                  <span className="phone-prefix" style={{ position: 'absolute', left: '2.5rem', color: '#6B7280', fontWeight: 500, fontSize: '0.95rem', userSelect: 'none' }}>+91</span>
                  <input
                    type="tel"
                    id="phone"
                    placeholder="9876543210"
                    style={{ paddingLeft: '4.75rem' }}
                    value={attendee.phone}
                    onChange={(e) => {
                      const newPhone = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setAttendee(prev => {
                        if (resolvedUserId) {
                          setResolvedUserId(null);
                          setResolvedUserIdForCoupons(null);
                        }
                        return { ...prev, phone: newPhone };
                      });
                    }}
                  />
                </div>
                {((showErrors || (attendee.name.trim() !== '' && isEmailValid)) && !isPhoneValid) && (
                  <div className="validation-hint"><Info size={16} /><span>Please provide a valid 10-digit phone number.</span></div>
                )}
              </div>
            </div>



            {resolvedUserId && fetchedUserName && (
              <div className="user-logged-in-message" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1rem', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '0.5rem', marginBottom: '1.25rem', color: '#059669', fontSize: '0.9rem', fontWeight: 600 }}>
                <CheckCircle size={16} style={{ color: '#10B981', flexShrink: 0 }} />
                <span>Logged in as {fetchedUserName}</span>
              </div>
            )}
          </div>

          {/* Host Approval Question (if required) */}
          {event.approvalNeeded && (
            <div className="section-block approval-details-block glass" style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.85rem' }}>
                <Lock size={20} style={{ color: '#7C3AED' }} />
                <h3 style={{ margin: 0 }}>Host Approval Required</h3>
              </div>
              <p style={{ fontSize: '0.9rem', color: '#4B5563', marginBottom: '0.75rem', lineHeight: '1.5' }}>
                This event is private and requires the organizer's approval to join.
              </p>
              {event.approvalQuestion && (
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="approvalAnswer" style={{ fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.35rem' }}>
                    Qus: {event.approvalQuestion} <span className="required-star">*</span>
                  </label>
                  <textarea
                    id="approvalAnswer"
                    placeholder="Type your answer here..."
                    value={approvalAnswer}
                    onChange={(e) => setApprovalAnswer(e.target.value)}
                    style={{
                      width: '100%',
                      minHeight: '90px',
                      padding: '0.6rem 0.85rem',
                      border: '1px solid rgba(0, 0, 0, 0.1)',
                      borderRadius: '0.5rem',
                      fontSize: '0.9rem',
                      fontFamily: 'inherit',
                      outline: 'none',
                      resize: 'vertical',
                      backgroundColor: 'rgba(255, 255, 255, 0.5)'
                    }}
                  />
                  {showErrors && !approvalAnswer.trim() && (
                    <div className="validation-hint" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#EF4444', fontSize: '0.85rem', marginTop: '0.35rem' }}>
                      <Info size={16} /> <span>Please answer the host's question.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Coupons Section — hidden for free events */}
          {tickets.some(t => t.blithePrice && t.blithePrice > 0) && <div className="section-block coupons-block glass">
            <h3>{isMultiDay ? '4. Available Offers' : '3. Available Offers'}</h3>

            {/* Promo Code Search bar */}
            <div className="coupon-search-container">
              <div className="coupon-search-input-wrapper">
                <Tag size={16} className="tag-search-icon" />
                <input
                  type="text"
                  placeholder="Enter coupon code"
                  value={couponSearchInput}
                  onChange={(e) => setCouponSearchInput(e.target.value)}
                  className="coupon-search-input"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCouponSearch();
                    }
                  }}
                />
              </div>
              <button
                type="button"
                onClick={handleCouponSearch}
                className="coupon-search-btn"
              >
                Apply
              </button>
            </div>

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
            ) : filteredCoupons.filter(coupon => {
              const isPrivate = coupon.isPrivate === true;
              const isRevealed = revealedCouponCodes.has(coupon.code?.toUpperCase()) || appliedCoupon?.id === coupon.id;
              return !isPrivate || isRevealed;
            }).length === 0 ? (
              <p style={{ color: '#6B7280', fontStyle: 'italic', marginTop: '0.5rem' }}>No active coupons available right now.</p>
            ) : (
              <div className="coupons-list-view">
                {filteredCoupons
                  .filter(coupon => {
                    const isPrivate = coupon.isPrivate === true;
                    const isRevealed = revealedCouponCodes.has(coupon.code?.toUpperCase()) || appliedCoupon?.id === coupon.id;
                    return !isPrivate || isRevealed;
                  })
                  .map(coupon => {
                    const potDiscount = calculateDiscount(coupon, subtotal);
                    const isApplicable = subtotal >= (coupon.minOrderAmount || 0);
                    const isSelected = appliedCoupon?.id === coupon.id;
                    const isApplying = couponApplyingId === coupon.id;
                    const neededAmount = (coupon.minOrderAmount || 0) - subtotal;
                    const cardError = couponErrors[coupon.id];

                    const handleApply = () => handleApplyCoupon(coupon);
                    const handleRemove = () => handleRemoveCoupon(coupon);

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

                          {coupon.minOrderAmount > 0 && (
                            <p className="coupon-min-spend">
                              <Info size={12} className="info-icon" />
                              Min. order: <strong>₹{coupon.minOrderAmount}</strong>
                            </p>
                          )}

                          {coupon.percentage && Number(coupon.maxDiscount) > 0 && (
                            <p className="coupon-max-discount">
                              <Percent size={12} className="percent-icon" />
                              Max discount: <strong>₹{coupon.maxDiscount}</strong>
                            </p>
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

            {/* Promo banner for downloading the app to get more offers */}
            <div className="welcome-download-banner">
              <span className="banner-icon-container">
                <img src={logo} alt="Blithe Logo" className="banner-logo-img" />
              </span>
              <div className="banner-content">
                <h4 className="banner-title">For additional offers download the app</h4>
              </div>
              <div className="banner-app-badges">
                <a
                  href={settings?.playStoreLink || "https://play.google.com/store/apps/details?id=com.firstlogicmetalab.blith_user_app"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="banner-badge-btn"
                  aria-label="Get it on Google Play"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3.18 23.76c.3.17.64.24.98.21l12.94-12L13.06 8l-9.88 15.76zM20.5 10.22L17.67 8.6l-3.28 3.03 3.28 3.03 2.85-1.63c.81-.46.81-1.74-.02-2.81zM1.5.65C1.19.99 1 1.47 1 2.08v19.84c0 .61.19 1.09.5 1.43L1.62 23.4 13.06 12 1.62.6 1.5.65zM3.18.24L13.06 4 16.1 7.04 3.18.24z" />
                  </svg>
                  <div>
                    <span className="badge-sub">Get it on</span>
                    <span className="badge-main">Google Play</span>
                  </div>
                </a>
                <a
                  href={settings?.appStoreLink || "https://apps.apple.com/in/app/blithe/id6473627877"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="banner-badge-btn"
                  aria-label="Download on the App Store"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  <div>
                    <span className="badge-sub">Download on the</span>
                    <span className="badge-main">App Store</span>
                  </div>
                </a>
              </div>
            </div>
          </div>}

        </div>

        {/* RIGHT COLUMN: Order Summary (Sticky) */}
        <div className="checkout-right-col">
          <div className="billing-summary-glass glass sticky-summary">
            <h3>Order Summary</h3>
            <div className="event-mini-card">
              <img src={event.image && event.image.length > 0 ? event.image[0] : (event.image || '/assets/placeholder.jpg')} alt={event.eventName || event.title} className="mini-event-img" />
              <div className="mini-event-info">
                <h4>{event.eventName || event.title}</h4>
                <p><Calendar size={12} /> {displayDate || '(Choose Date)'}</p>
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
                      <span>{(!ticket.blithePrice || Number(ticket.blithePrice) === 0) ? 'FREE' : `₹ ${qty * Number(ticket.blithePrice)}`}</span>
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
                            <span>Platform Fee</span>
                            <span>₹ {platformFeeVal.toFixed(2)}</span>
                          </div>
                          <div className="summary-row" style={{ fontSize: '0.85rem', color: '#6B7280', marginBottom: 0 }}>
                            <span>CGST</span>
                            <span>₹ {(gstAmount / 2).toFixed(2)}</span>
                          </div>
                          <div className="summary-row" style={{ fontSize: '0.85rem', color: '#6B7280', marginBottom: 0 }}>
                            <span>SGST</span>
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
                I agree to Blithe's <span onClick={(e) => { e.preventDefault(); setShowTermsModal(true); }} style={{ color: '#7C3AED', textDecoration: 'underline', fontWeight: 600, cursor: 'pointer' }}>terms and conditions</span>
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

      {/* Terms and Conditions Modal */}
      <AnimatePresence>
        {showTermsModal && (
          <div className="terms-modal-overlay" onClick={() => setShowTermsModal(false)}>
            <motion.div
              className="terms-modal-card glass"
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button className="close-modal-btn" onClick={() => setShowTermsModal(false)}>
                <X size={20} />
              </button>

              <div className="terms-modal-header">
                <FileText size={32} className="terms-modal-icon" />
                <h2>Terms & Conditions</h2>
              </div>

              <div className="terms-modal-body">
                <p className="terms-modal-desc">
                  Please review the terms and conditions carefully before proceeding to payment.
                </p>
                <div className="terms-modal-list">
                  {termsList.map((term, index) => (
                    <div key={index} className="terms-modal-item">
                      <span className="terms-modal-num">{index + 1}.</span>
                      <p className="terms-modal-text">{cleanTermText(term)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="terms-modal-footer">
                <button className="terms-cancel-btn" onClick={() => setShowTermsModal(false)}>
                  Cancel
                </button>
                <button className="terms-agree-btn" onClick={handleAgreeAndProceed}>
                  Agree & Proceed
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* App Terms and Conditions Modal */}
      <AnimatePresence>
        {showAppTermsModal && (
          <div className="terms-modal-overlay" onClick={() => setShowAppTermsModal(false)}>
            <motion.div
              className="terms-modal-card glass"
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button className="close-modal-btn" onClick={() => setShowAppTermsModal(false)}>
                <X size={20} />
              </button>

              <div className="terms-modal-header">
                <FileText size={32} className="terms-modal-icon" />
                <h2>Terms of Service</h2>
              </div>

              <div className="terms-modal-body">
                <p className="terms-modal-desc" style={{ paddingBottom: '1rem' }}>
                  Please review the terms of service carefully before proceeding.
                </p>
                <div className="terms-modal-list" style={{ textAlign: 'left', lineHeight: '1.6', fontSize: '0.9rem', color: '#4B5563' }}>
                  <p><strong>1. Acceptance of Terms</strong><br />By accessing or using the Blithe app, you agree to comply with and be bound by these Terms of Service. If you do not agree with these terms, please do not use the app.</p>

                  <p style={{ marginTop: '1rem' }}><strong>2. Use of the App</strong><br />You must be at least 14 years old to use the Blithe app. By using the app, you represent and warrant that you are at least 14 years old.</p>

                  <p style={{ marginTop: '1rem' }}><strong>3. User Accounts</strong><br />To access certain features, you may need to create a user account. You are responsible for maintaining the confidentiality of your credentials and all activities under your account.</p>

                  <p style={{ marginTop: '1rem' }}><strong>4. User Conduct</strong><br />When using the Blithe app, you agree not to:<br />
                    &bull; Violate any applicable laws or regulations.<br />
                    &bull; Infringe on the rights of others.<br />
                    &bull; Use the app for any unlawful or unauthorized purpose.</p>

                  <p style={{ marginTop: '1rem' }}><strong>5. Events and Content</strong><br />You are solely responsible for the events you create and the content you upload. By using the app, you grant Blithe the right to display and promote your events.</p>

                  <p style={{ marginTop: '1rem' }}><strong>6. Termination of Accounts</strong><br />We reserve the right to terminate or suspend accounts without prior notice if we believe a user has violated these Terms of Service.</p>

                  <p style={{ marginTop: '1rem' }}><strong>7. Modification of the App</strong><br />We may update, modify, or discontinue features of the app at any time without prior notice.</p>

                  <p style={{ marginTop: '1rem' }}><strong>8. Limitation of Liability</strong><br />Blithe is not liable for any direct, indirect, incidental, special, or consequential damages arising out of or connected with the use of the app.</p>

                  <p style={{ marginTop: '1rem' }}><strong>9. Changes to Terms of Service</strong><br />We may update these Terms of Service. Continued use of the app after changes indicates your acceptance of the updated terms.</p>

                  <p style={{ marginTop: '1rem' }}><strong>10. Governing Law</strong><br />These Terms of Service are governed by and construed in accordance with the laws of Karnataka jurisdiction.</p>

                  <p style={{ marginTop: '1rem' }}><strong>11. Contact Us</strong><br />If you have any questions or concerns about these Terms of Service, please contact us at hello@blithe.social</p>

                  <p style={{ marginTop: '1rem' }}>By using the Blithe app, you agree to the terms outlined in these Terms of Service.</p>
                </div>
              </div>

              <div className="terms-modal-footer">
                <button className="terms-cancel-btn" onClick={() => setShowAppTermsModal(false)}>
                  Cancel
                </button>
                <button className="terms-agree-btn" onClick={() => {
                  setAgreeAppTerms(true);
                  setShowAppTermsModal(false);
                }}>
                  Agree & Proceed
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Privacy Policy Modal */}
      <AnimatePresence>
        {showPrivacyModal && (
          <div className="terms-modal-overlay" onClick={() => setShowPrivacyModal(false)}>
            <motion.div
              className="terms-modal-card glass"
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button className="close-modal-btn" onClick={() => setShowPrivacyModal(false)}>
                <X size={20} />
              </button>

              <div className="terms-modal-header">
                <FileText size={32} className="terms-modal-icon" />
                <h2>Privacy Policy</h2>
              </div>

              <div className="terms-modal-body">
                <p className="terms-modal-desc" style={{ paddingBottom: '1rem' }}>
                  Please review the privacy policy carefully before proceeding.
                </p>
                <div className="terms-modal-list" style={{ textAlign: 'left', lineHeight: '1.6', fontSize: '0.9rem', color: '#4B5563', whiteSpace: 'pre-wrap' }}>
                  {privacyPolicyText || "Loading privacy policy..."}
                </div>
              </div>

              <div className="terms-modal-footer">
                <button className="terms-cancel-btn" onClick={() => setShowPrivacyModal(false)}>
                  Cancel
                </button>
                <button className="terms-agree-btn" onClick={() => {
                  setAgreeAppTerms(true);
                  setShowPrivacyModal(false);
                }}>
                  Agree & Proceed
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EventBookingPage;
