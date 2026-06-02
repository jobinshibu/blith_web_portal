import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Clock, ArrowLeft, Share2, Info, Ticket, ChevronLeft, ChevronRight, ChevronDown, Navigation, AlertTriangle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
import { db } from '../../firebase';
import Button from '../Button/Button';
import logo from '../../assets/logo.jpeg';
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
  const navigate = useNavigate();
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [isAboutExpanded, setIsAboutExpanded] = useState(false);
  const [isTermsExpanded, setIsTermsExpanded] = useState(false);
  const [showAboutBtn, setShowAboutBtn] = useState(false);
  const [showTermsDesktopBtn, setShowTermsDesktopBtn] = useState(false);
  const [showTermsMobileBtn, setShowTermsMobileBtn] = useState(false);
  
  const aboutRef = useRef(null);
  const termsDesktopRef = useRef(null);
  const termsMobileRef = useRef(null);

  const [relatedEvents, setRelatedEvents] = useState([]);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const { id } = useParams();

  useEffect(() => {
    const checkOverflow = () => {
      if (aboutRef.current && !isAboutExpanded) {
        setShowAboutBtn(aboutRef.current.scrollHeight > aboutRef.current.clientHeight);
      }
      if (termsDesktopRef.current && !isTermsExpanded) {
        setShowTermsDesktopBtn(termsDesktopRef.current.scrollHeight > termsDesktopRef.current.clientHeight);
      }
      if (termsMobileRef.current && !isTermsExpanded) {
        setShowTermsMobileBtn(termsMobileRef.current.scrollHeight > termsMobileRef.current.clientHeight);
      }
    };

    checkOverflow();
    const timeoutId = setTimeout(checkOverflow, 100);
    window.addEventListener('resize', checkOverflow);
    return () => {
      window.removeEventListener('resize', checkOverflow);
      clearTimeout(timeoutId);
    };
  }, [event, isAboutExpanded, isTermsExpanded]);

  useEffect(() => {
    const fetchEvent = async () => {
      setLoading(true);
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
          let isPriceOnwards = false;
          if (data.tickets && data.tickets.length > 0) {
            const minPrice = Math.min(...data.tickets.map(t => t.actualPrice || 0));
            displayPrice = minPrice > 0 ? `₹${minPrice}` : "Free";
            isPriceOnwards = minPrice > 0;
          } else if (data.price > 0) {
            displayPrice = `₹${data.price}`;
          }

          const isFeatured = data.featured === true && data.featuredEndDate && data.featuredEndDate.toDate() >= new Date();

          setEvent({ 
            id: docSnap.id, 
            promoted: isFeatured,
            title: data.eventName || "Untitled Event",
            image: (data.image && data.image.length > 0) ? data.image[0] : "",
            extraImages: (data.image && data.image.length > 1) ? data.image.slice(1) : [],
            date: formattedDate,
            time: formattedTime,
            location: data.location || data.venue || "TBA",
            venue: data.venue || (data.location ? data.location.split(',')[0] : "TBA"),
            geopoint: data.position?.geopoint || null,
            price: displayPrice,
            isPriceOnwards: isPriceOnwards,
            category: data.category || "Other",
            eventType: data.eventType || "Offline",
            ageRestriction: data.ageRestriction || false,
            minAge: data.minAge || 18,
            description: data.description || "No description provided.",
            termsAndConditions: data.termsAndConditions || "No terms specified.",
            tickets: data.tickets || [],
            tags: data.tags || [],
            platformFee: data.platformFee || 0,
            eventStartDate: data.eventStartDate || null,
            eventEndDate: data.eventEndDate || null,
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

  useEffect(() => {
    const fetchRelatedEvents = async () => {
      if (!event || !event.raw) return;
      try {
        const eventsQuery = query(collection(db, "event"), where("deleted", "==", false));
        const querySnapshot = await getDocs(eventsQuery);
        
        let allActiveEvents = [];
        querySnapshot.forEach(doc => {
          if (doc.id !== event.id) {
            const data = doc.data();
            const isNotBlocked = data.block === false;
            const isNotExpired = data.eventEndDate ? data.eventEndDate.toDate() >= new Date() : true;
            const hasNoPaymentUrl = !data.paymentUrl || data.paymentUrl.trim() === "";
            
            if (isNotBlocked && isNotExpired && hasNoPaymentUrl) {
              const startDateObj = data.eventStartDate ? data.eventStartDate.toDate() : new Date();
              const formattedDate = startDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
              
              let displayPrice = "Free";
              let isPriceOnwards = false;
              if (data.tickets && data.tickets.length > 0) {
                const minPrice = Math.min(...data.tickets.map(t => t.actualPrice || 0));
                displayPrice = minPrice > 0 ? `₹${minPrice}` : "Free";
                isPriceOnwards = minPrice > 0;
              } else if (data.price > 0) {
                displayPrice = `₹${data.price}`;
              }

              let score = 0;
              if (data.category === event.category) score += 3;
              if (data.location && event.location && data.location.includes(event.location.split(',')[0])) score += 2;
              if (formattedDate === event.date) score += 1;
              
              const isFeatured = data.featured === true && data.featuredEndDate && data.featuredEndDate.toDate() >= new Date();
              
              allActiveEvents.push({
                id: doc.id,
                promoted: isFeatured,
                title: data.eventName || "Untitled Event",
                image: (data.image && data.image.length > 0) ? data.image[0] : "",
                date: formattedDate,
                location: data.location || data.venue || "TBA",
                price: displayPrice,
                isPriceOnwards: isPriceOnwards,
                score,
                eventStartDate: data.eventStartDate || null
              });
            }
          }
        });
        
        allActiveEvents.sort((a, b) => b.score - a.score);
        const topRelated = allActiveEvents.slice(0, 4);
        // Sort top related events chronologically (ascending: earlier date first)
        topRelated.sort((a, b) => {
          const dateA = a.eventStartDate ? (typeof a.eventStartDate.toDate === 'function' ? a.eventStartDate.toDate() : new Date(a.eventStartDate)) : new Date(0);
          const dateB = b.eventStartDate ? (typeof b.eventStartDate.toDate === 'function' ? b.eventStartDate.toDate() : new Date(b.eventStartDate)) : new Date(0);
          return dateA - dateB;
        });

        setRelatedEvents(topRelated);
      } catch (err) {
        console.error("Error fetching related events", err);
      }
    };
    
    if (event) {
      fetchRelatedEvents();
    }
  }, [event]);

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
      <div className="loading-container container" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '60vh', gap: '1.5rem', textAlign: 'center' }}>
        <motion.img 
          src={logo} 
          alt="Loading..." 
          style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 10px 25px rgba(124, 58, 237, 0.2)' }} 
          animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }} 
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <h2 style={{ color: '#7C3AED', fontWeight: 'bold', fontSize: '1.25rem' }}>Loading event details...</h2>
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

  const today = new Date();
  today.setHours(0,0,0,0);
  const isEventExpired = event.eventEndDate 
    ? event.eventEndDate.toDate() < today 
    : (event.eventStartDate ? event.eventStartDate.toDate() < today : false);

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

              {event.promoted && (
                <span className="featured-badge-small" style={{ zIndex: 20 }}>✨ Featured</span>
              )}

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
              <div className={`expandable-content ${isAboutExpanded ? 'expanded' : ''}`} ref={aboutRef}>
                <p className="description">{event.description}</p>
              </div>
              {showAboutBtn && (
                <button 
                  className="read-more-btn" 
                  onClick={() => setIsAboutExpanded(!isAboutExpanded)}
                  aria-expanded={isAboutExpanded}
                >
                  {isAboutExpanded ? 'Read Less' : 'Read More'}
                  <ChevronDown size={18} className={`chevron-icon ${isAboutExpanded ? 'expanded' : ''}`} />
                </button>
              )}
            </div>


            {/* Terms & Conditions card (Left Column) */}
            <div className="terms-details-card glass desktop-terms">
              <div className="section-header">
                <Info size={22} />
                <h2>Terms & Conditions</h2>
              </div>
              <div className={`expandable-content ${isTermsExpanded ? 'expanded' : ''}`} ref={termsDesktopRef}>
                <p className="description" style={{ whiteSpace: 'pre-wrap' }}>
                  {event.termsAndConditions}
                </p>
              </div>
              {showTermsDesktopBtn && (
                <button 
                  className="read-more-btn" 
                  onClick={() => setIsTermsExpanded(!isTermsExpanded)}
                  aria-expanded={isTermsExpanded}
                >
                  {isTermsExpanded ? 'Read Less' : 'Read More'}
                  <ChevronDown size={18} className={`chevron-icon ${isTermsExpanded ? 'expanded' : ''}`} />
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Event Details & Action Box */}
          <div className="event-info-sidebar">
            <div className="event-details-card glass">
              <div className="card-top-row" style={{ marginTop: '-0.5rem' }}>
                <div className="tags-column" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span className="category-badge" style={{ alignSelf: 'flex-start' }}>{event.category}</span>
                  {event.tags && event.tags.length > 0 && (
                    <div className="event-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {event.tags.map((tag, idx) => (
                        <span key={idx} className="hashtag" style={{ 
                          fontSize: '0.75rem', 
                          color: '#6B7280', 
                          background: 'rgba(0,0,0,0.04)', 
                          padding: '0.2rem 0.6rem', 
                          borderRadius: '1rem',
                          fontWeight: '600'
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
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
                
                {event.eventType !== 'Online' && (
                  <div className="info-item">
                    <div className="icon-box"><MapPin size={20} className="icon" /></div>
                    <div className="text-content">
                      <p className="val">{event.venue}</p>
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
                )}

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
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <span className="amount">{event.price}</span>
                    {event.isPriceOnwards && <span className="amount-sub" style={{ fontSize: '0.9rem', color: '#6B7280', fontWeight: 500 }}>onwards</span>}
                  </div>
                </div>
                <Button 
                  variant={isEventExpired ? "secondary" : "primary"}
                  size="lg" 
                  className="book-now-btn"
                  onClick={() => navigate(`/events/${event.id}/book`)}
                  disabled={isEventExpired}
                >
                  {isEventExpired ? 'Event Ended' : 'Book Tickets Now'}
                </Button>
              </div>
            </div>



            {/* Terms & Conditions card (Mobile Bottom) */}
            <div className="terms-details-card glass mobile-terms">
              <div className="section-header">
                <Info size={22} />
                <h2>Terms & Conditions</h2>
              </div>
              <div className={`expandable-content ${isTermsExpanded ? 'expanded' : ''}`} ref={termsMobileRef}>
                <p className="description" style={{ whiteSpace: 'pre-wrap', color: '#374151', fontSize: '0.95rem', lineHeight: '1.6' }}>
                  {event.termsAndConditions}
                </p>
              </div>
              {showTermsMobileBtn && (
                <button 
                  className="read-more-btn" 
                  onClick={() => setIsTermsExpanded(!isTermsExpanded)}
                  aria-expanded={isTermsExpanded}
                >
                  {isTermsExpanded ? 'Read Less' : 'Read More'}
                  <ChevronDown size={18} className={`chevron-icon ${isTermsExpanded ? 'expanded' : ''}`} />
                </button>
              )}
            </div>

            </div>

          </div>

        {/* Related Events Section */}
        {relatedEvents.length > 0 && (
          <div className="related-events-section">
            <div className="section-header">
              <Sparkles size={22} style={{ color: '#7C3AED' }} />
              <h2>You might also like</h2>
            </div>
            <div className="events-portrait-grid">
              {relatedEvents.map(relatedEvent => (
                <div key={relatedEvent.id} className="event-card-container">
                  <Link to={`/events/${relatedEvent.id}`} className="portrait-event-card" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                    <div className="portrait-image-wrapper">
                      <img src={relatedEvent.image} alt={relatedEvent.title} loading="lazy" />
                      {relatedEvent.promoted && (
                        <span className="featured-badge-small">✨ Featured</span>
                      )}
                    </div>
                    <div className="portrait-card-details">
                      <span className="portrait-card-date">{relatedEvent.date}</span>
                      <h3 className="portrait-card-title">{relatedEvent.title}</h3>
                      <p className="portrait-card-location">{relatedEvent.location}</p>
                      <p className="portrait-card-price">
                        {relatedEvent.price}
                        {relatedEvent.isPriceOnwards && <span style={{ fontSize: '0.8em', color: '#6B7280', marginLeft: '4px', fontWeight: 500 }}>onwards</span>}
                      </p>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mobile-fixed-booking-bar">
        <div className="price-row">
          <span className="amount">{event.price}</span>
          {event.isPriceOnwards && <span className="amount-sub" style={{ fontSize: '0.9rem', color: '#6B7280', fontWeight: 500, marginLeft: '4px' }}>onwards</span>}
        </div>
        <Button 
          variant={isEventExpired ? "secondary" : "primary"}
          size="lg" 
          onClick={() => navigate(`/events/${event.id}/book`)}
          disabled={isEventExpired}
        >
          {isEventExpired ? 'Event Ended' : 'Book Now'}
        </Button>
      </div>

    </div>
  );
};

export default EventDetails;
