import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, MapPin, X, Plus, Minus, User, Mail, Phone, CreditCard, CheckCircle, ShieldCheck, Info } from 'lucide-react';
import { collection, query, where, getDocs, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import Button from '../Button/Button';
import './BookingModal.scss';

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

const BookingModal = ({ isOpen, onClose, event }) => {
  if (!isOpen || !event) return null;

  const scrollRef = useRef(null);
  const [step, setStep] = useState(1); // 1: Tickets, 2: Details, 3: Payment, 4: Processing, 5: Success
  const [quantities, setQuantities] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [attendee, setAttendee] = useState({ name: '', email: '', phone: '' });
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [bookingId, setBookingId] = useState('');
  const [showStep1Errors, setShowStep1Errors] = useState(false);
  const [showStep2Errors, setShowStep2Errors] = useState(false);

  // New States
  const [isVerifyingUser, setIsVerifyingUser] = useState(false);
  const [resolvedUserId, setResolvedUserId] = useState(null);

  const [allCoupons, setAllCoupons] = useState([]);
  const [validCoupons, setValidCoupons] = useState([]);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [isCheckingCoupons, setIsCheckingCoupons] = useState(false);
  const [showCouponModal, setShowCouponModal] = useState(false);

  // Scroll to top when step changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [step]);

  // Handle Dates
  const startDate = parseDate(event.eventStartDate);
  const endDate = parseDate(event.eventEndDate);
  const availableDates = getDatesBetween(startDate, endDate);
  const isMultiDay = availableDates.length > 1;

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setQuantities({});
      setAttendee({ name: '', email: '', phone: '' });
      setAgreeTerms(false);
      setSelectedDate(isMultiDay ? null : availableDates[0]);
      setShowStep1Errors(false);
      setShowStep2Errors(false);
      setResolvedUserId(null);
      setAppliedCoupon(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, event?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const fetchCoupons = async () => {
      try {
        const couponsRef = collection(db, "coupon");
        const q = query(couponsRef, where("isActive", "==", true));
        const snapshot = await getDocs(q);
        console.log("Fetched coupons snapshot size:", snapshot.size);

        const now = new Date();
        const couponsData = [];

        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          const expiry = data.expiryDate ? parseDate(data.expiryDate) : null;
          if (expiry && expiry < now) return;
          if (data.eventId && data.eventId !== event.id) return;

          couponsData.push({ id: docSnap.id, ...data });
        });
        
        // Inject dummy coupons if DB is empty for UI testing
        if (couponsData.length === 0) {
          couponsData.push({
            id: 'dummy_1',
            code: 'BLITHE50',
            title: 'Welcome Discount',
            percentage: false,
            discountValue: 50,
            minOrderAmount: 100,
            type: 'general',
            isActive: true
          });
          couponsData.push({
            id: 'dummy_2',
            code: 'EARLYBIRD',
            title: 'Early Bird Special',
            percentage: true,
            discountValue: 15,
            maxDiscount: 150,
            minOrderAmount: 0,
            type: 'general',
            isActive: true
          });
        }

        setAllCoupons(couponsData);
      } catch (err) {
        console.error("Error fetching coupons:", err);
      }
    };
    fetchCoupons();
  }, [isOpen, event?.id]);

  const tickets = event.tickets || [];

  const updateQuantity = (idx, delta) => {
    const ticket = tickets[idx];
    if (!ticket || !ticket.status || ticket.remainingSlots <= 0) return;

    setQuantities(prev => {
      const current = prev[idx] || 0;
      const maxSlots = Math.min(10, ticket.remainingSlots);
      return {
        ...prev,
        [idx]: Math.max(0, Math.min(maxSlots, current + delta))
      };
    });
  };

  const subtotal = tickets.reduce((sum, ticket, idx) => {
    return sum + (quantities[idx] || 0) * (ticket.blithePrice || 0);
  }, 0);

  const platformFeeRate = event.platformFee || 0;
  const bookingFee = subtotal > 0 ? Math.round(subtotal * (platformFeeRate / 100)) : 0;

  const calculateDiscount = (coupon, currentSubtotal) => {
    if (!coupon || currentSubtotal < (coupon.minOrderAmount || 0)) return 0;
    if (coupon.percentage) {
      const computed = Math.round(currentSubtotal * (coupon.discountValue / 100));
      return coupon.maxDiscount ? Math.min(computed, coupon.maxDiscount) : computed;
    }
    return coupon.discountValue;
  };

  const discountAmount = calculateDiscount(appliedCoupon, subtotal);
  const total = Math.max(0, (subtotal - discountAmount) + bookingFee);
  const totalTickets = Object.values(quantities).reduce((a, b) => a + b, 0);

  const isStep1Valid = totalTickets > 0 && (isMultiDay ? selectedDate !== null : true);
  const isStep2Valid = attendee.name.trim() !== '' &&
    attendee.email.trim() !== '' &&
    attendee.phone.trim() !== '' &&
    agreeTerms;

  const handleNextToDetails = () => {
    if (!isStep1Valid) {
      setShowStep1Errors(true);
      return;
    }
    setShowStep1Errors(false);
    setStep(2);
  };

  const handleBackToTickets = () => {
    setStep(1);
    setShowStep2Errors(false);
  };

  const handleVerifyUser = async (e) => {
    e.preventDefault();
    if (!isStep2Valid) {
      setShowStep2Errors(true);
      return;
    }
    setShowStep2Errors(false);
    setIsVerifyingUser(true);

    try {
      // 1. Resolve User
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("countryCode", "==", "91"), where("phoneNo", "==", attendee.phone));
      const querySnapshot = await getDocs(q);

      let uId = null;
      let hasPastBookings = false;

      if (!querySnapshot.empty) {
        uId = querySnapshot.docs[0].id;
      } else {
        const newDocRef = doc(usersRef);
        uId = newDocRef.id;
        await setDoc(newDocRef, {
          uid: uId,
          name: attendee.name,
          email: attendee.email,
          phoneNo: attendee.phone,
          countryCode: "91",
          createdTime: serverTimestamp(),
          loginTime: serverTimestamp(),
          online: true,
          deleted: false,
          admin: false,
          block: false,
          organiser: false
        });
      }

      setResolvedUserId(uId);
      setIsCheckingCoupons(true);

      // 2. Filter Coupons for this user
      const valid = [];
      for (const coupon of allCoupons) {
        if (coupon.type === "first_booking" && hasPastBookings) {
          continue;
        }

        const usageRef = collection(db, `coupons/${coupon.id}/usage`);
        const usageQ = query(usageRef, where("userId", "==", uId));
        const usageSnap = await getDocs(usageQ);

        if (usageSnap.empty) {
          valid.push(coupon);
        }
      }

      setValidCoupons(valid);

      if (appliedCoupon && !valid.find(c => c.id === appliedCoupon.id)) {
        setAppliedCoupon(null);
        alert("The coupon you selected is no longer valid or has already been used by you.");
      }

      setIsCheckingCoupons(false);
      setStep(3);
    } catch (err) {
      console.error("Error in user verification:", err);
      alert("Failed to proceed. Please try again.");
    } finally {
      setIsVerifyingUser(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  const slideVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.2 } }
  };

  const displayDate = selectedDate ? selectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const displayTime = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const getStepTitle = () => {
    if (step === 1) return "Step 1: Select Tickets";
    if (step === 2) return "Step 2: Customer Details";
    if (step === 3) return "Step 3: Review & Pay";
    return "";
  };

  return (
    <div className="booking-modal-overlay">
      <div className="backdrop-click-catcher" onClick={handleClose}></div>

      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        className="booking-modal-container glass-card multi-step-flow"
      >
        {step < 4 && (
          <div className="modal-header">
            <div className="title-area">
              <span className="step-tag">{getStepTitle()}</span>
              <h2>{event.eventName || event.title}</h2>
            </div>
            <button className="close-btn" onClick={handleClose} aria-label="Close booking">
              <X size={20} />
            </button>
          </div>
        )}

        <div className="modal-body-scrollable" ref={scrollRef}>
          <AnimatePresence mode="wait">

            {/* STEP 1: TICKETS */}
            {step === 1 && (
              <motion.div
                key="step1"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="step-content single-checkout-step"
              >
                <div className="checkout-layout">
                  <div className="checkout-left-col full-width-col">

                    {/* Date Selection */}
                    {isMultiDay && (
                      <div className="section-block date-selection-block">
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
                        {showStep1Errors && (!selectedDate && isMultiDay) && (
                          <div className="validation-hint" style={{ marginTop: '0.75rem' }}>
                            <Info size={16} />
                            <span>Please select a date for the event.</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Ticket Selection */}
                    <div className="section-block ticket-selection-block">
                      <h3>{isMultiDay ? '2. Select Tickets' : '1. Select Tickets'}</h3>
                      <div className="ticket-tiers-list">
                        {tickets.map((ticket, idx) => {
                          const ticketEndDate = ticket.endDate ? parseDate(ticket.endDate) : null;
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          if (ticketEndDate && ticketEndDate < today) return null;

                          const isUnavailable = !ticket.status || ticket.remainingSlots <= 0;
                          const qty = quantities[idx] || 0;
                          return (
                            <div
                              key={idx}
                              className={`ticket-tier-card ${qty > 0 ? 'selected-tier' : ''} ${isUnavailable ? 'unavailable' : ''}`}
                            >
                              <div className="tier-top">
                                <h4>{ticket.ticketName}</h4>
                                {isUnavailable ? (
                                  <p className="tier-desc error-text">Sold Out / Unavailable</p>
                                ) : (
                                  <p className="tier-desc">Remaining slots: {ticket.remainingSlots}</p>
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
                                  <button
                                    type="button"
                                    className="qty-btn"
                                    disabled={qty <= 0}
                                    onClick={() => updateQuantity(idx, -1)}
                                  >
                                    -
                                  </button>
                                  <span className="qty-val">{qty}</span>
                                  <button
                                    type="button"
                                    className="qty-btn"
                                    disabled={isUnavailable || qty >= Math.min(10, ticket.remainingSlots)}
                                    onClick={() => updateQuantity(idx, 1)}
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {showStep1Errors && Object.values(quantities).every(qty => qty === 0) && (
                        <div className="validation-hint" style={{ marginTop: '0.75rem' }}>
                          <Info size={16} />
                          <span>Please choose your desired tickets.</span>
                        </div>
                      )}
                    </div>

                    <div className="action-row flex-end mt-4">
                      <Button
                        variant="primary"
                        size="md"
                        onClick={handleNextToDetails}
                        className="pay-btn"
                      >
                        Continue
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2: DETAILS & PAYMENT SUMMARY */}
            {step === 2 && (
              <motion.div
                key="step2"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="step-content single-checkout-step"
              >
                {showCouponModal ? (
                  <div className="coupon-selection-page glass" style={{ minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Available Coupons</h3>
                      <button 
                        type="button" 
                        onClick={() => setShowCouponModal(false)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#6B7280', fontWeight: 600 }}
                      >
                        <X size={18} /> Close
                      </button>
                    </div>

                    {allCoupons.length === 0 ? (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <p style={{ color: '#6B7280', fontStyle: 'italic' }}>No active coupons available right now.</p>
                      </div>
                    ) : (
                      <div className="coupons-list-view" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, overflowY: 'auto', paddingBottom: '1rem' }}>
                        {allCoupons.map(coupon => {
                          const potDiscount = calculateDiscount(coupon, subtotal);
                          const finalAmount = Math.max(0, subtotal + bookingFee - potDiscount);
                          const isApplicable = subtotal >= (coupon.minOrderAmount || 0);

                          return (
                            <div
                              key={coupon.id}
                              style={{
                                padding: '1rem',
                                border: `2px solid ${appliedCoupon?.id === coupon.id ? '#7C3AED' : '#E5E7EB'}`,
                                borderRadius: '0.5rem',
                                background: appliedCoupon?.id === coupon.id ? 'rgba(124, 58, 237, 0.05)' : 'white',
                                cursor: isApplicable ? 'pointer' : 'not-allowed',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'all 0.2s ease',
                                opacity: isApplicable ? 1 : 0.6
                              }}
                              onClick={() => {
                                if (isApplicable) {
                                  setAppliedCoupon(appliedCoupon?.id === coupon.id ? null : coupon);
                                  setShowCouponModal(false);
                                }
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                  <span style={{
                                    background: '#7C3AED', color: 'white', padding: '0.25rem 0.6rem',
                                    borderRadius: '0.25rem', fontSize: '0.8rem', fontWeight: 700
                                  }}>
                                    {coupon.code}
                                  </span>
                                  {appliedCoupon?.id === coupon.id && <CheckCircle size={16} color="#7C3AED" />}
                                </div>
                                <h4 style={{ margin: '0.25rem 0 0', fontWeight: 600, color: '#1F2937', fontSize: '0.95rem' }}>
                                  {coupon.title || 'Special Discount'}
                                </h4>
                                {!isApplicable && (
                                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#DC2626', fontWeight: 500 }}>
                                    Requires order above ₹{coupon.minOrderAmount}
                                  </p>
                                )}
                              </div>
                              
                              <div style={{ textAlign: 'right', minWidth: '100px' }}>
                                <div style={{ fontSize: '0.9rem', color: '#10B981', fontWeight: 700, marginBottom: '0.25rem' }}>
                                  -₹{potDiscount}
                                </div>
                                {isApplicable && (
                                  <div style={{ fontSize: '0.75rem', color: '#4B5563' }}>
                                    Final: <span style={{ fontWeight: 700 }}>₹{finalAmount}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleVerifyUser} className="checkout-layout two-col">
                  {/* Left Column: Attendee Details */}
                  <div className="checkout-left-col">
                    <div className="section-block attendee-details-block glass">
                      <h3>Contact Information</h3>
                      <div className="input-group">
                        <label htmlFor="name">Full Name</label>
                        <div className="input-wrapper">
                          <User size={18} className="input-icon" />
                          <input
                            type="text"
                            id="name"
                            placeholder="e.g. Rahul Sharma"
                            value={attendee.name}
                            onChange={(e) => setAttendee(prev => ({ ...prev, name: e.target.value }))}
                          />
                        </div>
                        {showStep2Errors && !attendee.name.trim() && (
                          <div className="validation-hint" style={{ marginTop: '0.5rem' }}>
                            <Info size={16} />
                            <span>Please provide your full name.</span>
                          </div>
                        )}
                      </div>

                      <div className="input-group">
                        <label htmlFor="email">Email Address</label>
                        <div className="input-wrapper">
                          <Mail size={18} className="input-icon" />
                          <input
                            type="email"
                            id="email"
                            placeholder="e.g. rahul@example.com"
                            value={attendee.email}
                            onChange={(e) => setAttendee(prev => ({ ...prev, email: e.target.value }))}
                          />
                        </div>
                        {showStep2Errors && !attendee.email.trim() && (
                          <div className="validation-hint" style={{ marginTop: '0.5rem' }}>
                            <Info size={16} />
                            <span>Please provide a valid email address.</span>
                          </div>
                        )}
                      </div>

                      <div className="input-group">
                        <label htmlFor="phone">Phone Number</label>
                        <div className="input-wrapper">
                          <Phone size={18} className="input-icon" />
                          <input
                            type="tel"
                            id="phone"
                            placeholder="e.g. 9876543210"
                            value={attendee.phone}
                            onChange={(e) => setAttendee(prev => ({ ...prev, phone: e.target.value }))}
                          />
                        </div>
                        {showStep2Errors && !attendee.phone.trim() && (
                          <div className="validation-hint" style={{ marginTop: '0.5rem' }}>
                            <Info size={16} />
                            <span>Please provide your phone number.</span>
                          </div>
                        )}
                      </div>

                      <div className="terms-checkbox">
                        <input
                          type="checkbox"
                          id="terms"
                          checked={agreeTerms}
                          onChange={(e) => setAgreeTerms(e.target.checked)}
                        />
                        <label htmlFor="terms">
                          I agree to Blithe's standard terms, event regulations and cancellation policies.
                        </label>
                      </div>
                      {showStep2Errors && !agreeTerms && (
                        <div className="validation-hint" style={{ marginTop: '0.5rem' }}>
                          <Info size={16} />
                          <span>Please accept the Terms & Conditions.</span>
                        </div>
                      )}

                      {/* Coupons Section inline */}
                      <div className="section-block coupons-block" style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(124, 58, 237, 0.15)' }}>
                        <div 
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            padding: '1rem', 
                            border: '1px dashed #7C3AED', 
                            borderRadius: '0.5rem', 
                            background: 'rgba(124, 58, 237, 0.05)'
                          }}
                        >
                          <div 
                            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', flex: 1 }}
                            onClick={() => setShowCouponModal(true)}
                          >
                            <div style={{ background: '#7C3AED', color: 'white', padding: '0.5rem', borderRadius: '50%' }}>
                              <CheckCircle size={16} />
                            </div>
                            <div>
                              <h4 style={{ margin: 0, fontWeight: 700, color: '#111827' }}>
                                {appliedCoupon ? `${appliedCoupon.code} Applied!` : 'Apply Coupon'}
                              </h4>
                              <p style={{ margin: 0, fontSize: '0.85rem', color: '#6B7280' }}>
                                {appliedCoupon ? `You saved ₹${discountAmount}` : 'Click here to view available offers'}
                              </p>
                            </div>
                          </div>
                          
                          {appliedCoupon ? (
                            <button 
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setAppliedCoupon(null); }}
                              style={{ color: '#DC2626', fontWeight: 700, fontSize: '0.85rem', background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }}
                            >
                              REMOVE
                            </button>
                          ) : (
                            <span 
                              style={{ color: '#7C3AED', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', padding: '0.5rem' }}
                              onClick={() => setShowCouponModal(true)}
                            >
                              View Offers &rarr;
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Order Summary */}
                  <div className="checkout-right-col">
                    <div className="billing-summary-glass glass">
                      <h3>Order Summary</h3>
                      <div className="event-mini-card">
                        <img src={event.image || '/assets/placeholder.jpg'} alt={event.eventName || event.title} className="mini-event-img" />
                        <div className="mini-event-info">
                          <h4>{event.eventName || event.title}</h4>
                          <p><Calendar size={12} /> {displayDate}</p>
                          <p><Clock size={12} /> {displayTime}</p>
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
                              <span>₹ {subtotal}</span>
                            </div>
                            <div className="summary-row">
                              <span>Platform Fee</span>
                              <span>{bookingFee === 0 ? 'Free' : `₹ ${bookingFee}`}</span>
                            </div>
                            {appliedCoupon && (
                              <div className="summary-row" style={{ color: '#10B981', fontWeight: 600 }}>
                                <span>Discount ({appliedCoupon.code})</span>
                                <span>- ₹ {discountAmount}</span>
                              </div>
                            )}
                            <div className="summary-row total-row">
                              <span>Grand Total</span>
                              <span>₹ {total}</span>
                            </div>
                          </>
                        )}
                        {totalTickets === 0 && (
                          <p className="empty-cart-msg">No tickets selected.</p>
                        )}
                      </div>

                      <div className="action-row split-actions mt-4">
                        <Button
                          variant="outline"
                          size="md"
                          type="button"
                          onClick={handleBackToTickets}
                        >
                          Back
                        </Button>
                        <Button
                          variant="primary"
                          size="md"
                          type="submit"
                          className="pay-btn"
                          disabled={isVerifyingUser}
                        >
                          {isVerifyingUser ? 'Verifying...' : 'Continue to Checkout'} <CreditCard size={18} style={{ marginLeft: '8px' }} />
                        </Button>
                      </div>

                      <div className="payment-security-note">
                        <ShieldCheck size={16} />
                        <span>Secured Checkout Protection</span>
                      </div>
                    </div>
                  </div>
                </form>
                )}
              </motion.div>
            )}

            {/* STEP 3: REVIEW & PAY */}
            {step === 3 && (
              <motion.div
                key="step3"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="step-content single-checkout-step"
              >
                <div className="checkout-layout two-col">
                  {/* Left Column: Coupons */}
                  <div className="checkout-left-col">
                    <div className="section-block glass">
                      <h3>Available Offers</h3>
                      {validCoupons.length === 0 ? (
                        <p style={{ color: '#6B7280', fontSize: '0.9rem' }}>No offers available for your booking.</p>
                      ) : (
                        <div className="coupons-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {validCoupons.map(coupon => (
                            <div
                              key={coupon.id}
                              className={`coupon-card ${appliedCoupon?.id === coupon.id ? 'applied' : ''}`}
                              style={{
                                padding: '1rem',
                                border: `1px solid ${appliedCoupon?.id === coupon.id ? '#7C3AED' : '#E5E7EB'}`,
                                borderRadius: '0.5rem',
                                background: appliedCoupon?.id === coupon.id ? 'rgba(124, 58, 237, 0.05)' : 'white',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}
                              onClick={() => setAppliedCoupon(appliedCoupon?.id === coupon.id ? null : coupon)}
                            >
                              <div>
                                <h4 style={{ margin: 0, fontWeight: 600, color: '#1F2937' }}>{coupon.code}</h4>
                                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#6B7280' }}>
                                  {coupon.title || 'Special Discount'}
                                </p>
                              </div>
                              <div>
                                <span style={{
                                  background: '#7C3AED', color: 'white', padding: '0.25rem 0.5rem',
                                  borderRadius: '1rem', fontSize: '0.8rem', fontWeight: 600
                                }}>
                                  {coupon.percentage ? `${coupon.discountValue}% OFF` : `₹${coupon.discountValue} OFF`}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Order Summary (Step 3) */}
                  <div className="checkout-right-col">
                    <div className="billing-summary-glass glass">
                      <h3>Final Order Summary</h3>
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

                        <div className="summary-row divider">
                          <span>Subtotal</span>
                          <span>₹ {subtotal}</span>
                        </div>
                        <div className="summary-row">
                          <span>Platform Fee</span>
                          <span>{bookingFee === 0 ? 'Free' : `₹ ${bookingFee}`}</span>
                        </div>
                        {appliedCoupon && (
                          <div className="summary-row" style={{ color: '#10B981', fontWeight: 600 }}>
                            <span>Discount ({appliedCoupon.code})</span>
                            <span>- ₹ {discountAmount}</span>
                          </div>
                        )}
                        <div className="summary-row total-row">
                          <span>Grand Total</span>
                          <span>₹ {total}</span>
                        </div>
                      </div>

                      <div className="action-row split-actions mt-4">
                        <Button
                          variant="outline"
                          size="md"
                          type="button"
                          onClick={() => setStep(2)}
                        >
                          Back
                        </Button>
                        <Button
                          variant="primary"
                          size="md"
                          type="button"
                          className="pay-btn"
                          onClick={() => {
                            console.log('Proceed to Payment with total:', total);
                            // Handle Razorpay
                          }}
                        >
                          Proceed to Payment <CreditCard size={18} style={{ marginLeft: '8px' }} />
                        </Button>
                      </div>

                      <div className="payment-security-note">
                        <ShieldCheck size={16} />
                        <span>Secured Checkout Protection</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default BookingModal;
