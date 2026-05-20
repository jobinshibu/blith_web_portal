import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Mail, Phone, Ticket, ShieldCheck, CreditCard, ChevronRight, Calendar, MapPin, Clock } from 'lucide-react';
import Button from '../Button/Button';
import './BookingModal.scss';

// Mock Ticket Options generator based on event price
const getTicketOptions = (basePriceStr) => {
  let basePrice = 0;
  if (basePriceStr && basePriceStr.toLowerCase() !== 'free') {
    basePrice = parseInt(basePriceStr.replace(/[^\d]/g, '')) || 0;
  }

  return [
    {
      id: 'general',
      name: 'General Admission',
      description: 'Standard access to the event area. First come, first served seating.',
      price: basePrice,
      perks: ['Standard Entry', 'Access to general areas']
    },
    {
      id: 'vip',
      name: 'VIP Experience Pass',
      description: 'Front-row reserved seating, express entry lane, and complimentary welcome drink.',
      price: basePrice > 0 ? basePrice + 500 : 499,
      perks: ['Front-row reserved seating', 'Express entry lane', 'Complimentary drink', 'VIP Lounge access']
    }
  ];
};

const BookingModal = ({ isOpen, onClose, event }) => {
  if (!isOpen) return null;

  const ticketOptions = getTicketOptions(event.price);
  
  const [step, setStep] = useState(1); // 1: Ticket Selection, 2: Attendee Info, 3: Processing, 4: Success Ticket
  const [quantities, setQuantities] = useState({ general: 1, vip: 0 });
  const [attendee, setAttendee] = useState({ name: '', email: '', phone: '' });
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [bookingId, setBookingId] = useState('');

  // Handle quantity changes
  const updateQuantity = (type, delta) => {
    setQuantities(prev => ({
      ...prev,
      [type]: Math.max(0, Math.min(10, prev[type] + delta))
    }));
  };

  // Calculations
  const generalSubtotal = quantities.general * ticketOptions[0].price;
  const vipSubtotal = quantities.vip * ticketOptions[1].price;
  const subtotal = generalSubtotal + vipSubtotal;
  const bookingFee = subtotal > 0 ? Math.round(subtotal * 0.08) : 0; // 8% fee
  const total = subtotal + bookingFee;
  const totalTickets = quantities.general + quantities.vip;

  // Validation
  const isStep1Valid = totalTickets > 0;
  const isStep2Valid = attendee.name.trim() !== '' && 
                       attendee.email.trim() !== '' && 
                       attendee.phone.trim() !== '' && 
                       agreeTerms;

  // Handle Form Proceed
  const handleProceedToDetails = () => {
    if (isStep1Valid) setStep(2);
  };

  // Handle Complete Booking (Simulated Checkout)
  const handleCompleteBooking = (e) => {
    e.preventDefault();
    if (!isStep2Valid) return;

    // Transition to simulated processing
    setStep(3);

    // Generate random Booking ID
    const randomId = 'BLT-' + Math.floor(100000 + Math.random() * 900000) + '-' + event.title.substring(0, 3).toUpperCase();
    setBookingId(randomId);

    // Auto progress to Success Screen after 2 seconds
    setTimeout(() => {
      setStep(4);
    }, 2000);
  };

  // Close modal and reset state
  const handleClose = () => {
    setStep(1);
    setQuantities({ general: 1, vip: 0 });
    setAttendee({ name: '', email: '', phone: '' });
    setAgreeTerms(false);
    onClose();
  };

  // Page Transition variants for framer-motion
  const slideVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.2 } }
  };

  return (
    <div className="booking-modal-overlay">
      {/* Background blur/shadow click handler */}
      <div className="backdrop-click-catcher" onClick={handleClose}></div>
      
      <motion.div 
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        className="booking-modal-container glass-card"
      >
        {/* Header (Hidden in step 3 & 4) */}
        {step < 3 && (
          <div className="modal-header">
            <div className="title-area">
              <span className="step-tag">Step {step} of 2</span>
              <h2>Book Tickets for {event.title}</h2>
            </div>
            <button className="close-btn" onClick={handleClose} aria-label="Close booking">
              <X size={20} />
            </button>
          </div>
        )}

        <div className="modal-body-scrollable">
          <AnimatePresence mode="wait">
            
            {/* STEP 1: TICKET SELECTION */}
            {step === 1 && (
              <motion.div 
                key="step1"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="step-content ticket-selection-step"
              >
                <div className="ticket-tiers-list">
                  {ticketOptions.map((tier) => (
                    <div 
                      key={tier.id} 
                      className={`ticket-tier-card ${quantities[tier.id] > 0 ? 'selected-tier' : ''}`}
                    >
                      <div className="tier-info">
                        <div className="tier-header">
                          <h3>{tier.name}</h3>
                          <span className="tier-price">
                            {tier.price === 0 ? 'Free' : `₹ ${tier.price}`}
                          </span>
                        </div>
                        <p className="tier-desc">{tier.description}</p>
                        
                        <div className="tier-perks">
                          {tier.perks.map((perk, i) => (
                            <span key={i} className="perk-pill">✓ {perk}</span>
                          ))}
                        </div>
                      </div>
                      
                      <div className="tier-selector">
                        <button 
                          className="qty-btn"
                          disabled={quantities[tier.id] <= 0}
                          onClick={() => updateQuantity(tier.id, -1)}
                        >
                          -
                        </button>
                        <span className="qty-val">{quantities[tier.id]}</span>
                        <button 
                          className="qty-btn"
                          disabled={quantities[tier.id] >= 10}
                          onClick={() => updateQuantity(tier.id, 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="order-summary-sidebar">
                  <div className="summary-box glass">
                    <h4>Billing Details</h4>
                    <div className="summary-row">
                      <span>General Tickets ({quantities.general})</span>
                      <span>₹ {generalSubtotal}</span>
                    </div>
                    <div className="summary-row">
                      <span>VIP Experience ({quantities.vip})</span>
                      <span>₹ {vipSubtotal}</span>
                    </div>
                    <div className="summary-row divider">
                      <span>Subtotal</span>
                      <span>₹ {subtotal}</span>
                    </div>
                    <div className="summary-row">
                      <span>Booking Fee (8%)</span>
                      <span>{bookingFee === 0 ? 'Free' : `₹ ${bookingFee}`}</span>
                    </div>
                    <div className="summary-row grand-total">
                      <span>Grand Total</span>
                      <span>₹ {total}</span>
                    </div>

                    <div className="secure-badge">
                      <ShieldCheck size={16} />
                      <span>Secured Checkout Protection</span>
                    </div>
                  </div>
                  
                  <div className="action-row">
                    <Button 
                      variant="primary" 
                      size="lg" 
                      className="w-100 proceed-btn"
                      disabled={!isStep1Valid}
                      onClick={handleProceedToDetails}
                    >
                      Proceed to Details <ChevronRight size={18} />
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2: ATTENDEE DETAILS */}
            {step === 2 && (
              <motion.div 
                key="step2"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="step-content attendee-step"
              >
                <form onSubmit={handleCompleteBooking} className="attendee-form">
                  <div className="form-sections">
                    <div className="inputs-section glass">
                      <h3>Contact Information</h3>
                      <p className="section-subtitle">Your digital tickets will be sent to these details</p>
                      
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

                    <div className="billing-summary-glass glass">
                      <h3>Order Summary</h3>
                      <div className="event-mini-card">
                        <img src={event.image} alt={event.title} className="mini-event-img" />
                        <div className="mini-event-info">
                          <h4>{event.title}</h4>
                          <p><Calendar size={12} /> {event.date.split(',')[1] || event.date}</p>
                          <p><Clock size={12} /> {event.time}</p>
                        </div>
                      </div>

                      <div className="ticket-items-list">
                        {quantities.general > 0 && (
                          <div className="ticket-item-row">
                            <span>{quantities.general}x General Admission</span>
                            <span>₹ {generalSubtotal}</span>
                          </div>
                        )}
                        {quantities.vip > 0 && (
                          <div className="ticket-item-row">
                            <span>{quantities.vip}x VIP Experience Pass</span>
                            <span>₹ {vipSubtotal}</span>
                          </div>
                        )}
                        <div className="summary-row divider">
                          <span>Total Tickets</span>
                          <span>{totalTickets}</span>
                        </div>
                        <div className="summary-row total-row">
                          <span>Grand Total</span>
                          <span>₹ {total}</span>
                        </div>
                      </div>

                      <div className="payment-security-note">
                        <CreditCard size={16} />
                        <span>Simulated Instant Booking Approval</span>
                      </div>
                    </div>
                  </div>

                  <div className="navigation-actions">
                    <button 
                      type="button" 
                      className="back-step-btn" 
                      onClick={() => setStep(1)}
                    >
                      ← Back to Tickets
                    </button>
                    
                    <Button 
                      variant="primary" 
                      size="lg" 
                      type="submit"
                      disabled={!isStep2Valid}
                      className="pay-btn"
                    >
                      Confirm & Secure Booking <CreditCard size={20} />
                    </Button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* STEP 3: TRANSACTION PROCESSING */}
            {step === 3 && (
              <motion.div 
                key="step3"
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

            {/* STEP 4: SUCCESS TICKET SUMMARY */}
            {step === 4 && (
              <motion.div 
                key="step4"
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

                {/* PREMIUM DIGITAL TICKET STUB */}
                <div className="digital-ticket-container">
                  <div className="ticket-stub ticket-main">
                    <div className="ticket-glow"></div>
                    <div className="ticket-header-brand">
                      <span className="logo-brand">BLITHE PASS</span>
                      <span className="booking-code">{bookingId}</span>
                    </div>

                    <h3 className="ticket-event-title">{event.title}</h3>

                    <div className="ticket-meta-details">
                      <div className="detail-col">
                        <span className="lbl">DATE & TIME</span>
                        <span className="val">{event.date.split(',')[1] || event.date} at {event.time}</span>
                      </div>
                      <div className="detail-col">
                        <span className="lbl">VENUE</span>
                        <span className="val">{event.location}</span>
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
                          {[
                            quantities.general > 0 ? `${quantities.general}x General` : '',
                            quantities.vip > 0 ? `${quantities.vip}x VIP` : ''
                          ].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Cutout notch dividing stub and barcode */}
                  <div className="ticket-divider">
                    <div className="notch notch-left"></div>
                    <div className="dashed-line"></div>
                    <div className="notch notch-right"></div>
                  </div>

                  <div className="ticket-stub ticket-barcode-section">
                    <div className="qr-barcode-wrapper">
                      {/* Interactive mock QR Code using SVG */}
                      <svg className="mock-qr" width="120" height="120" viewBox="0 0 100 100" fill="none">
                        <rect x="0" y="0" width="100" height="100" rx="6" fill="#111827" />
                        {/* Anchor squares */}
                        <rect x="10" y="10" width="25" height="25" fill="#8B5CF6" rx="2" />
                        <rect x="15" y="15" width="15" height="15" fill="#FFFFFF" rx="1" />
                        <rect x="19" y="19" width="7" height="7" fill="#8B5CF6" rx="1" />

                        <rect x="65" y="10" width="25" height="25" fill="#8B5CF6" rx="2" />
                        <rect x="70" y="15" width="15" height="15" fill="#FFFFFF" rx="1" />
                        <rect x="74" y="74" width="7" height="7" fill="#8B5CF6" rx="1" />

                        <rect x="10" y="65" width="25" height="25" fill="#8B5CF6" rx="2" />
                        <rect x="15" y="70" width="15" height="15" fill="#FFFFFF" rx="1" />
                        <rect x="19" y="74" width="7" height="7" fill="#8B5CF6" rx="1" />

                        {/* Random mock QR dots */}
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

                      {/* Mock scan lines/barcodes */}
                      <div className="barcode-glow-line"></div>
                      <div className="ticket-barcode-num">Scan QR Code for Entry</div>
                    </div>
                  </div>
                </div>

                <div className="download-ticket-actions">
                  <button className="download-btn secondary-btn">
                    ↓ Download Ticket PDF
                  </button>
                  <button className="download-btn wallet-btn">
                     Add to Apple Wallet
                  </button>
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
