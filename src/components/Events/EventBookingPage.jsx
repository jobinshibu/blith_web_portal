import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, MapPin, X, Plus, Minus, User, Mail, Phone, CreditCard, CheckCircle, ShieldCheck, Info, ArrowLeft, Tag, Lock } from 'lucide-react';
import { collection, query, where, getDocs, setDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import Button from '../Button/Button';
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

const EventBookingPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  const scrollRef = useRef(null);
  const [quantities, setQuantities] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [attendee, setAttendee] = useState({ name: '', email: '', phone: '' });
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [bookingId, setBookingId] = useState('');
  
  const [showErrors, setShowErrors] = useState(false);
  const [isVerifyingUser, setIsVerifyingUser] = useState(false);
  const [resolvedUserId, setResolvedUserId] = useState(null);

  const [allCoupons, setAllCoupons] = useState([]);
  const [validCoupons, setValidCoupons] = useState([]);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [showCouponModal, setShowCouponModal] = useState(false);

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

  // Fetch Coupons
  useEffect(() => {
    if (!event) return;
    const fetchCoupons = async () => {
      try {
        const couponsRef = collection(db, "coupon");
        const q = query(couponsRef, where("isActive", "==", true));
        const snapshot = await getDocs(q);
        
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
  }, [event]);

  if (loading) {
    return <div className="booking-page-loading">Loading booking details...</div>;
  }

  if (!event) {
    return <div className="booking-page-loading">Event not found. <Link to="/events">Go back</Link></div>;
  }

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

  const isValid = 
    totalTickets > 0 && 
    (isMultiDay ? selectedDate !== null : true) &&
    attendee.name.trim() !== '' &&
    attendee.email.trim() !== '' &&
    attendee.phone.trim() !== '' &&
    agreeTerms;

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!isValid) {
      setShowErrors(true);
      if (scrollRef.current) scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
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

      // Validate Coupon
      if (appliedCoupon) {
        const usageRef = collection(db, `coupons/${appliedCoupon.id}/usage`);
        const usageQ = query(usageRef, where("userId", "==", uId));
        const usageSnap = await getDocs(usageQ);
        if (!usageSnap.empty) {
          setAppliedCoupon(null);
          alert("The coupon you selected has already been used by you.");
          setIsVerifyingUser(false);
          return;
        }
      }

      // Proceed to Payment (Razorpay logic goes here)
      console.log('Proceed to Payment with total:', total);
      alert('Redirecting to Payment Gateway...');
      
    } catch (err) {
      console.error("Error in user verification:", err);
      alert("Failed to proceed. Please try again.");
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

                const isUnavailable = !ticket.status || ticket.remainingSlots <= 0;
                const qty = quantities[idx] || 0;
                return (
                  <div key={idx} className={`ticket-tier-card ${qty > 0 ? 'selected-tier' : ''} ${isUnavailable ? 'unavailable' : ''}`}>
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
                        <button type="button" className="qty-btn" disabled={qty <= 0} onClick={() => updateQuantity(idx, -1)}>-</button>
                        <span className="qty-val">{qty}</span>
                        <button type="button" className="qty-btn" disabled={isUnavailable || qty >= Math.min(10, ticket.remainingSlots)} onClick={() => updateQuantity(idx, 1)}>+</button>
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
              {showErrors && !attendee.phone.trim() && (
                <div className="validation-hint"><Info size={16} /><span>Please provide your phone number.</span></div>
              )}
            </div>
          </div>

          {/* Coupons Section */}
          <div className="section-block coupons-block glass">
            <h3>{isMultiDay ? '4. Available Offers' : '3. Available Offers'}</h3>
            {allCoupons.length === 0 ? (
              <p style={{ color: '#6B7280', fontStyle: 'italic' }}>No active coupons available right now.</p>
            ) : (
              <div className="coupons-list-view">
                {allCoupons.map(coupon => {
                  const potDiscount = calculateDiscount(coupon, subtotal);
                  const isApplicable = subtotal >= (coupon.minOrderAmount || 0);
                  const isSelected = appliedCoupon?.id === coupon.id;
                  const neededAmount = (coupon.minOrderAmount || 0) - subtotal;

                  return (
                    <div
                      key={coupon.id}
                      className={`coupon-ticket-card ${isSelected ? 'selected' : ''} ${!isApplicable ? 'locked' : ''}`}
                      onClick={() => {
                        if (isApplicable) {
                          setAppliedCoupon(isSelected ? null : coupon);
                        }
                      }}
                    >
                      {/* Left Side: Offer Details */}
                      <div className="ticket-details-side">
                        <div className="coupon-badge-row">
                          <span className="coupon-code-tag">
                            <Tag size={12} className="tag-icon" />
                            {coupon.code}
                          </span>
                          {isApplicable && !isSelected && (
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
                          <p className="coupon-min-spend">
                            Min. order: ₹{coupon.minOrderAmount}
                          </p>
                        )}
                        
                        {!isApplicable && neededAmount > 0 && (
                          <div className="unlock-progress-hint">
                            <Lock size={12} className="lock-icon" />
                            <span>Add ₹{neededAmount} more to unlock</span>
                          </div>
                        )}
                      </div>

                      {/* Ticket Stub Dashed Divider */}
                      <div className="ticket-divider-line"></div>

                      {/* Right Side: Action Trigger */}
                      <div className="ticket-action-side">
                        {isSelected ? (
                          <div className="coupon-action-status active">
                            <CheckCircle size={20} className="check-icon" />
                            <span>REMOVE</span>
                          </div>
                        ) : !isApplicable ? (
                          <div className="coupon-action-status locked">
                            <Lock size={18} className="lock-icon" />
                            <span>LOCKED</span>
                          </div>
                        ) : (
                          <button type="button" className="coupon-apply-btn">
                            APPLY
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

            <div className="terms-checkbox" style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
              <input type="checkbox" id="terms" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} />
              <label htmlFor="terms" style={{ fontSize: '0.85rem' }}>
                I agree to Blithe's <Link to="/terms" target="_blank" style={{ color: '#7C3AED', textDecoration: 'underline', fontWeight: 600 }}>standard terms, event regulations and cancellation policies</Link>.
              </label>
              {showErrors && !agreeTerms && (
                <div className="validation-hint" style={{ marginTop: '0.5rem' }}>
                  <Info size={16} /><span>Please accept the Terms & Conditions.</span>
                </div>
              )}
            </div>

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

            <div className="payment-security-note" style={{ marginTop: '1rem', justifyContent: 'center' }}>
              <ShieldCheck size={16} />
              <span>Secured Checkout Protection</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventBookingPage;
