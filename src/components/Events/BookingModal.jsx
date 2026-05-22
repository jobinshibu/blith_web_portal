import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Mail, Phone, ShieldCheck, CreditCard, Calendar, Clock } from 'lucide-react';
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
  currentDate.setHours(0,0,0,0);
  const endDate = new Date(end);
  endDate.setHours(0,0,0,0);
  
  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return dates;
};

const BookingModal = ({ isOpen, onClose, event }) => {
  if (!isOpen || !event) return null;

  const [step, setStep] = useState(1); // 1: Tickets, 2: Details, 3: Payment, 4: Processing, 5: Success
  const [quantities, setQuantities] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [attendee, setAttendee] = useState({ name: '', email: '', phone: '' });
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [bookingId, setBookingId] = useState('');

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
    }
  }, [isOpen, event, isMultiDay, availableDates[0]]);

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

  const bookingFee = subtotal > 0 ? Math.round(subtotal * 0.08) : 0;
  const total = subtotal + bookingFee;
  const totalTickets = Object.values(quantities).reduce((a, b) => a + b, 0);

  const isStep1Valid = totalTickets > 0 && (isMultiDay ? selectedDate !== null : true);
  const isStep2Valid = attendee.name.trim() !== '' && 
                       attendee.email.trim() !== '' && 
                       attendee.phone.trim() !== '' && 
                       agreeTerms;
  const isFormValid = isStep1Valid && isStep2Valid;

  const handleNextToDetails = () => {
    if (isStep1Valid) setStep(2);
  };

  const handleNextToPayment = () => {
    if (isStep2Valid) setStep(3);
  };

  const handleBackToTickets = () => {
    setStep(1);
  };

  const handleBackToDetails = () => {
    setStep(2);
  };

  const handleCompleteBooking = (e) => {
    e.preventDefault();
    if (!isFormValid) return;

    setStep(4); // Processing

    const randomId = 'BLT-' + Math.floor(100000 + Math.random() * 900000) + '-' + (event.eventName || event.title || 'EVT').substring(0, 3).toUpperCase();
    setBookingId(randomId);

    setTimeout(() => {
      setStep(5); // Success
    }, 2000);
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
    if (step === 2) return "Step 2: Attendee Details";
    if (step === 3) return "Step 3: Payment & Summary";
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

        <div className="modal-body-scrollable">
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
                      </div>
                    )}

                    {/* Ticket Selection */}
                    <div className="section-block ticket-selection-block">
                      <h3>{isMultiDay ? '2. Select Tickets' : '1. Select Tickets'}</h3>
                      <div className="ticket-tiers-list">
                        {tickets.map((ticket, idx) => {
                          const isUnavailable = !ticket.status || ticket.remainingSlots <= 0;
                          const qty = quantities[idx] || 0;
                          return (
                            <div 
                              key={idx} 
                              className={`ticket-tier-card ${qty > 0 ? 'selected-tier' : ''} ${isUnavailable ? 'unavailable' : ''}`}
                            >
                              <div className="tier-info">
                                <div className="tier-header">
                                  <h4>{ticket.ticketName}</h4>
                                  <span className="tier-price">
                                    {ticket.blithePrice === 0 ? 'Free' : `₹ ${ticket.blithePrice}`}
                                  </span>
                                </div>
                                {isUnavailable ? (
                                  <p className="tier-desc error-text">Sold Out / Unavailable</p>
                                ) : (
                                  <p className="tier-desc">Remaining slots: {ticket.remainingSlots}</p>
                                )}
                              </div>
                              
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
                          );
                        })}
                      </div>
                    </div>

                    <div className="action-row flex-end mt-4">
                      <Button 
                        variant="primary" 
                        size="lg" 
                        onClick={handleNextToDetails}
                        disabled={!isStep1Valid}
                        className="pay-btn"
                      >
                        Continue
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2: DETAILS */}
            {step === 2 && (
              <motion.div 
                key="step2"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="step-content single-checkout-step"
              >
                <div className="checkout-layout">
                  <div className="checkout-left-col full-width-col">
                    {/* Attendee Details */}
                    <div className="section-block attendee-details-block glass">
                      <h3>Contact Information</h3>
                      <div className="input-group">
                        <label htmlFor="name">Full Name</label>
                        <div className="input-wrapper">
                          <User size={18} className="input-icon" />
                          <input 
                            type="text" 
                            id="name"
                            required
                            placeholder="e.g. Rahul Sharma"
                            value={attendee.name}
                            onChange={(e) => setAttendee(prev => ({ ...prev, name: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="input-group">
                        <label htmlFor="email">Email Address</label>
                        <div className="input-wrapper">
                          <Mail size={18} className="input-icon" />
                          <input 
                            type="email" 
                            id="email"
                            required
                            placeholder="e.g. rahul@example.com"
                            value={attendee.email}
                            onChange={(e) => setAttendee(prev => ({ ...prev, email: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="input-group">
                        <label htmlFor="phone">Phone Number</label>
                        <div className="input-wrapper">
                          <Phone size={18} className="input-icon" />
                          <input 
                            type="tel" 
                            id="phone"
                            required
                            placeholder="e.g. 9876543210"
                            value={attendee.phone}
                            onChange={(e) => setAttendee(prev => ({ ...prev, phone: e.target.value }))}
                          />
                        </div>
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
                    </div>

                    <div className="action-row split-actions mt-4">
                      <Button 
                        variant="outline" 
                        size="lg" 
                        onClick={handleBackToTickets}
                      >
                        Back
                      </Button>
                      <Button 
                        variant="primary" 
                        size="lg" 
                        onClick={handleNextToPayment}
                        disabled={!isStep2Valid}
                        className="pay-btn"
                      >
                        Continue
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 3: PAYMENT */}
            {step === 3 && (
              <motion.div 
                key="step3"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="step-content single-checkout-step"
              >
                <form onSubmit={handleCompleteBooking} className="checkout-layout">
                  <div className="checkout-left-col full-width-col">
                    <div className="billing-summary-glass glass">
                      <h3>Order Summary</h3>
                      <div className="event-mini-card">
                        <img src={event.image?.[0] || event.image} alt={event.eventName} className="mini-event-img" />
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
                                <span>₹ {qty * ticket.blithePrice}</span>
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
                              <span>Platform Fee (8%)</span>
                              <span>{bookingFee === 0 ? 'Free' : `₹ ${bookingFee}`}</span>
                            </div>
                            <div className="summary-row total-row">
                              <span>Grand Total</span>
                              <span>₹ {total}</span>
                            </div>
                          </>
                        )}
                        {totalTickets === 0 && (
                          <p className="empty-cart-msg">Please select at least 1 ticket to proceed.</p>
                        )}
                      </div>

                      <div className="action-row split-actions mt-4">
                        <Button 
                          variant="outline" 
                          size="lg" 
                          type="button"
                          onClick={handleBackToDetails}
                        >
                          Back
                        </Button>
                        <Button 
                          variant="primary" 
                          size="lg" 
                          type="submit"
                          disabled={!isFormValid}
                          className="pay-btn"
                        >
                          Confirm & Book <CreditCard size={18} style={{marginLeft: '8px'}} />
                        </Button>
                      </div>

                      <div className="payment-security-note">
                        <ShieldCheck size={16} />
                        <span>Secured Checkout Protection</span>
                      </div>
                    </div>
                  </div>
                </form>
              </motion.div>
            )}

            {/* STEP 2: TRANSACTION PROCESSING */}
            {step === 2 && (
              <motion.div 
                key="step2"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="step-content processing-step"
              >
                <div className="loader-container">
                  <div className="pulse-circles">
                    <div className="circle c1"></div>
                    <div className="circle c2"></div>
                    <div className="circle c3"></div>
                  </div>
                  <h3>Processing Secure Transaction</h3>
                  <p>Hold on! We are holding your seats and generating your digital ticket...</p>
                </div>
              </motion.div>
            )}

            {/* STEP 3: SUCCESS TICKET SUMMARY */}
            {step === 3 && (
              <motion.div 
                key="step3"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="step-content success-step"
              >
                <div className="success-header">
                  <div className="success-icon-badge">
                    ✓
                  </div>
                  <h2>Booking Confirmed!</h2>
                  <p className="success-desc">
                    Congratulations! Your booking is complete. A copy of your digital ticket has been sent to <strong>{attendee.email}</strong>.
                  </p>
                </div>

                <div className="digital-ticket-container">
                  <div className="ticket-stub ticket-main">
                    <div className="ticket-glow"></div>
                    <div className="ticket-header-brand">
                      <span className="logo-brand">BLITHE PASS</span>
                      <span className="booking-code">{bookingId}</span>
                    </div>

                    <h3 className="ticket-event-title">{event.eventName || event.title}</h3>

                    <div className="ticket-meta-details">
                      <div className="detail-col">
                        <span className="lbl">DATE & TIME</span>
                        <span className="val">{displayDate} at {displayTime}</span>
                      </div>
                      <div className="detail-col">
                        <span className="lbl">VENUE</span>
                        <span className="val">{event.location || event.venue}</span>
                      </div>
                    </div>

                    <div className="ticket-meta-details spacer">
                      <div className="detail-col">
                        <span className="lbl">ATTENDEE</span>
                        <span className="val">{attendee.name}</span>
                      </div>
                      <div className="detail-col">
                        <span className="lbl">TICKET SUMMARY</span>
                        <span className="val">
                          {tickets.map((t, idx) => quantities[idx] > 0 ? `${quantities[idx]}x ${t.ticketName}` : null).filter(Boolean).join(', ')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="ticket-divider">
                    <div className="notch notch-left"></div>
                    <div className="dashed-line"></div>
                    <div className="notch notch-right"></div>
                  </div>

                  <div className="ticket-stub ticket-barcode-section">
                    <div className="qr-barcode-wrapper">
                      <svg className="mock-qr" width="120" height="120" viewBox="0 0 100 100" fill="none">
                        <rect x="0" y="0" width="100" height="100" rx="6" fill="#111827" />
                        <rect x="10" y="10" width="25" height="25" fill="#8B5CF6" rx="2" />
                        <rect x="15" y="15" width="15" height="15" fill="#FFFFFF" rx="1" />
                        <rect x="19" y="19" width="7" height="7" fill="#8B5CF6" rx="1" />
                        <rect x="65" y="10" width="25" height="25" fill="#8B5CF6" rx="2" />
                        <rect x="70" y="15" width="15" height="15" fill="#FFFFFF" rx="1" />
                        <rect x="74" y="74" width="7" height="7" fill="#8B5CF6" rx="1" />
                        <rect x="10" y="65" width="25" height="25" fill="#8B5CF6" rx="2" />
                        <rect x="15" y="70" width="15" height="15" fill="#FFFFFF" rx="1" />
                        <rect x="19" y="74" width="7" height="7" fill="#8B5CF6" rx="1" />
                        <rect x="42" y="10" width="5" height="5" fill="#A78BFA" rx="1" />
                        <rect x="42" y="20" width="10" height="5" fill="#DDD6FE" rx="1" />
                        <rect x="42" y="30" width="5" height="10" fill="#8B5CF6" rx="1" />
                        <rect x="52" y="15" width="5" height="5" fill="#A78BFA" rx="1" />
                        <rect x="10" y="42" width="10" height="5" fill="#A78BFA" rx="1" />
                        <rect x="25" y="42" width="5" height="15" fill="#DDD6FE" rx="1" />
                        <rect x="35" y="52" width="10" height="5" fill="#8B5CF6" rx="1" />
                        <rect x="65" y="42" width="5" height="10" fill="#A78BFA" rx="1" />
                        <rect x="75" y="42" width="15" height="5" fill="#8B5CF6" rx="1" />
                        <rect x="75" y="52" width="5" height="10" fill="#DDD6FE" rx="1" />
                        <rect x="85" y="52" width="5" height="5" fill="#8B5CF6" rx="1" />
                        <rect x="42" y="65" width="15" height="5" fill="#A78BFA" rx="1" />
                        <rect x="42" y="75" width="5" height="15" fill="#DDD6FE" rx="1" />
                        <rect x="52" y="85" width="15" height="5" fill="#8B5CF6" rx="1" />
                        <rect x="65" y="75" width="10" height="10" fill="#DDD6FE" rx="1" />
                        <rect x="80" y="75" width="10" height="5" fill="#8B5CF6" rx="1" />
                      </svg>
                      <div className="barcode-glow-line"></div>
                      <div className="ticket-barcode-num">Scan QR Code for Entry</div>
                    </div>
                  </div>
                </div>

                <div className="done-action">
                  <Button 
                    variant="primary" 
                    size="lg" 
                    onClick={handleClose}
                    className="w-100 finalize-btn"
                  >
                    Done & Return to Events
                  </Button>
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
