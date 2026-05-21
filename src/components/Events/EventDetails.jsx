import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, MapPin, Clock, ArrowLeft, Share2, Info, Ticket, ChevronLeft, ChevronRight, Navigation, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, getDoc } from "firebase/firestore";
import { db } from '../../firebase';
import Button from '../Button/Button';
import BookingModal from './BookingModal';
import './EventDetails.scss';

// Category-specific extra media images to build a premium gallery/carousel
const getEventMedia = (event) => {
  const baseImage = event.image;
  const extraImages = {
    "Music Shows": [
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=1066&fit=crop&q=80",
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&h=1066&fit=crop&q=80",
      "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&h=1066&fit=crop&q=80"
    ],
    "Comedy Shows": [
      "https://images.unsplash.com/photo-1516280440614-37939bbacd6a?w=800&h=1066&fit=crop&q=80",
      "https://images.unsplash.com/photo-1585699324551-f6c309eed262?w=800&h=1066&fit=crop&q=80",
      "https://images.unsplash.com/photo-1603190287605-e6ade32fa852?w=800&h=1066&fit=crop&q=80"
    ],
    "Performances": [
      "https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?w=800&h=1066&fit=crop&q=80",
      "https://images.unsplash.com/photo-1460723237483-7a6dc9d0b212?w=800&h=1066&fit=crop&q=80",
      "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=800&h=1066&fit=crop&q=80"
    ],
    "Sports": [
      "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&h=1066&fit=crop&q=80",
      "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&h=1066&fit=crop&q=80",
      "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&h=1066&fit=crop&q=80"
    ],
    "Conferences": [
      "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=1066&fit=crop&q=80",
      "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&h=1066&fit=crop&q=80",
      "https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=800&h=1066&fit=crop&q=80"
    ],
    "Food & Drinks": [
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=1066&fit=crop&q=80",
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=1066&fit=crop&q=80",
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=1066&fit=crop&q=80"
    ],
    "Nightlife": [
      "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&h=1066&fit=crop&q=80",
      "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&h=1066&fit=crop&q=80",
      "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800&h=1066&fit=crop&q=80"
    ]
  };
  const extras = extraImages[event.category] || [
    "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800&h=1066&fit=crop&q=80",
    "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&h=1066&fit=crop&q=80"
  ];
  return [baseImage, ...extras];
};

const EventDetails = () => {
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const { id } = useParams();

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        let docRef = doc(db, "event", id);
        let docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          
          // Format date and time
          const startDateObj = data.eventStartDate ? data.eventStartDate.toDate() : new Date();
          const endDateObj = data.eventEndDate ? data.eventEndDate.toDate() : null;
          
          const formattedStartDate = startDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
          let formattedDate = formattedStartDate;
          
          let formattedTime = startDateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
          
          if (endDateObj) {
            const formattedEndDate = endDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
            if (formattedStartDate !== formattedEndDate) {
              formattedDate = `${formattedStartDate} - ${formattedEndDate}`;
            }
            
            const endFormattedTime = endDateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            if (formattedTime !== endFormattedTime) {
              formattedTime = `${formattedTime} - ${endFormattedTime}`;
            }
          }
          
          // Determine price
          let displayPrice = "Free";
          if (data.tickets && data.tickets.length > 0) {
            const minPrice = Math.min(...data.tickets.map(t => t.actualPrice || 0));
            displayPrice = minPrice > 0 ? `₹${minPrice} onwards` : "Free";
          } else if (data.price > 0) {
            displayPrice = `₹${data.price}`;
          }

          setEvent({ 
            id: docSnap.id, 
            title: data.eventName || "Untitled Event",
            image: (data.image && data.image.length > 0) ? data.image[0] : "",
            extraImages: (data.image && data.image.length > 1) ? data.image.slice(1) : [],
            date: formattedDate,
            time: formattedTime,
            location: data.location || data.venue || "TBA",
            geopoint: data.position?.geopoint || null,
            price: displayPrice,
            category: data.category || "Other",
            eventType: data.eventType || "Offline",
            ageRestriction: data.ageRestriction || false,
            minAge: data.minAge || 18,
            description: data.description || "No description provided.",
            termsAndConditions: data.termsAndConditions || "No terms specified.",
            raw: data 
          });
        } else {
          console.log("No such event found with ID:", id);
        }
      } catch (error) {
        console.error("Error fetching event details: ", error);
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [id]);

  const mediaList = event ? [event.image, ...(event.extraImages || [])].filter(Boolean) : [];

  // Auto-scroll for the carousel
  useEffect(() => {
    if (mediaList.length <= 1) return;
    const interval = setInterval(() => {
      setActiveMediaIndex(prev => (prev + 1) % mediaList.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [mediaList.length]);

  if (loading) {
    return (
      <div className="loading-container container" style={{ padding: '5rem 0', textAlign: 'center', color: '#7C3AED' }}>
        <h2>Loading event details...</h2>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="error-page container">
        <h2>Event not found</h2>
        <Link to="/events" className="back-link">Back to Events</Link>
      </div>
    );
  }

  return (
    <div className="event-details-page">
      <div className="details-header-bar container">
        <Link to="/events" className="back-link-btn">
          <ArrowLeft size={20} /> <span className="text">Back to Events</span>
        </Link>
      </div>

      <div className="container main-content">
        <div className="content-grid">
          {/* Left Column: Premium media carousel */}
          <div className="media-carousel-area">
            <div className="main-carousel-view glass">
              <AnimatePresence mode="wait">
                <motion.img 
                  key={activeMediaIndex}
                  src={mediaList[activeMediaIndex]} 
                  alt={`${event.title} - view ${activeMediaIndex + 1}`} 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  transition={{ duration: 0.3 }}
                  className="carousel-main-image"
                />
              </AnimatePresence>

              {/* Navigation Chevrons */}
              {mediaList.length > 1 && (
                <>
                  <button 
                    type="button" 
                    className="slide-arrow-btn prev"
                    onClick={() => setActiveMediaIndex(prev => (prev - 1 + mediaList.length) % mediaList.length)}
                    aria-label="Previous image"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button 
                    type="button" 
                    className="slide-arrow-btn next"
                    onClick={() => setActiveMediaIndex(prev => (prev + 1) % mediaList.length)}
                    aria-label="Next image"
                  >
                    <ChevronRight size={24} />
                  </button>
                </>
              )}
            </div>

            {/* About / Description card */}
            <div className="about-details-card glass">
              <div className="section-header">
                <Info size={22} />
                <h2>About the Event</h2>
              </div>
              <p className="description">{event.description}</p>
            </div>


            {/* Terms & Conditions card (Left Column) */}
            <div className="terms-details-card glass desktop-terms">
              <div className="section-header">
                <Info size={22} />
                <h2>Terms & Conditions</h2>
              </div>
              <p className="description" style={{ whiteSpace: 'pre-wrap' }}>
                {event.termsAndConditions}
              </p>
            </div>
          </div>

          {/* Right Column: Event Details & Action Box */}
          <div className="event-info-sidebar">
            <div className="event-details-card glass">
              <div className="card-top-row">
                <span className="category-badge">{event.category}</span>
                <button 
                  className="share-btn" 
                  aria-label="Share Event"
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({ title: event.title, text: event.description, url: window.location.href });
                    } else {
                      navigator.clipboard.writeText(window.location.href);
                      alert("Link copied to clipboard!");
                    }
                  }}
                >
                  <Share2 size={18} />
                </button>
              </div>
              <h1 className="event-title">{event.title}</h1>
              <p className="mobile-date-highlight">{event.date}, {event.time}</p>
              
              <div className="info-list">
                <div className="info-item desktop-date-time">
                  <div className="icon-box"><Calendar size={20} className="icon" /></div>
                  <div className="text-content">
                    <p className="val">{event.date}</p>
                    <p className="sub">Date & Schedule</p>
                  </div>
                </div>
                <div className="info-item desktop-date-time">
                  <div className="icon-box"><Clock size={20} className="icon" /></div>
                  <div className="text-content">
                    <p className="val">{event.time}</p>
                    <p className="sub">Event Time</p>
                  </div>
                </div>
                
                <div className="info-item">
                  <div className="icon-box"><MapPin size={20} className="icon" /></div>
                  <div className="text-content">
                    <p className="val">{event.location.split(',')[0]}</p>
                    <p className="sub">{event.location}</p>
                  </div>
                  <button 
                    className="map-icon-btn" 
                    onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`, '_blank')}
                    title="View on Maps"
                    aria-label="View on Maps"
                  >
                    <Navigation size={18} />
                  </button>
                </div>

                <div className="info-item mobile-only-item">
                  <div className="icon-box"><Ticket size={20} className="icon" /></div>
                  <div className="text-content">
                    <p className="val">{event.eventType} Event</p>
                    <p className="sub">Event Type</p>
                  </div>
                </div>
                
                {event.ageRestriction && (
                  <div className="info-item">
                    <div className="icon-box"><AlertTriangle size={20} className="icon" style={{ color: '#F59E0B' }} /></div>
                    <div className="text-content">
                      <p className="val">Age Restricted</p>
                      <p className="sub">Strictly {event.minAge} years and above</p>
                    </div>
                  </div>
                )}
              </div>

              <p className="guarantee">
                <Ticket size={14} /> 100% SECURE TRANSACTION
              </p>

              <div className="action-box desktop-booking-box">
                <div className="price-row">
                  <span className="label">Ticket Price</span>
                  <span className="amount">{event.price}</span>
                </div>
                <Button 
                  variant="primary" 
                  size="lg" 
                  className="book-now-btn"
                  onClick={() => setIsBookingOpen(true)}
                >
                  Book Tickets Now
                </Button>
              </div>
            </div>



            {/* Terms & Conditions card (Mobile Bottom) */}
            <div className="terms-details-card glass mobile-terms">
              <div className="section-header">
                <Info size={22} />
                <h2>Terms & Conditions</h2>
              </div>
              <ul className="terms-list">
                <li>Tickets once booked cannot be exchanged or refunded.</li>
                <li>An Internet handling fee may be levied. Please check the total amount before payment.</li>
                <li>We recommend that you arrive at least 30 minutes prior at the venue for a seamless entry.</li>
                <li>It is mandatory to wear masks at all times and follow social distancing norms.</li>
                <li>Please do not purchase tickets if you feel sick.</li>
                <li>Unlawful resale (or attempted unlawful resale) of a ticket would lead to seizure or cancellation of that ticket without refund or other compensation.</li>
              </ul>
            </div>

            </div>

          </div>
      </div>

      <div className="mobile-fixed-booking-bar">
        <div className="price-row">
          <span className="amount">{event.price}</span>
          <span className="amount-sub">onwards</span>
        </div>
        <div className="action-buttons">
          <Button 
            variant="primary" 
            size="lg" 
            className="book-now-btn"
            onClick={() => setIsBookingOpen(true)}
          >
            Book Tickets Now
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {isBookingOpen && (
          <BookingModal 
            isOpen={isBookingOpen} 
            onClose={() => setIsBookingOpen(false)} 
            event={event} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default EventDetails;
