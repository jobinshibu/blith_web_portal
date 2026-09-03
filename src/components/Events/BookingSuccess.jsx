import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useDispatch, useSelector } from 'react-redux';
import { fetchEventsThunk } from '../../store/eventsSlice';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, 
  Calendar, 
  Clock, 
  MapPin, 
  Ticket, 
  ArrowRight, 
  Home, 
  Copy, 
  AlertCircle,
  ChevronRight,
  Sparkles,
  Star,
  X
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import logoTransparent from '../../assets/logo-transparent.png';
import { trackPixelPurchase } from '../../utils/pixel';
import './BookingSuccess.scss';

// ─── Platform detection helpers ──────────────────────────────────────────────
const getMobilePlatform = () => {
  const ua = navigator.userAgent || navigator.vendor || window.opera || '';
  if (/android/i.test(ua)) return 'android';
  if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'ios';
  return 'desktop';
};

const STORE_URLS = {
  android: 'https://play.google.com/store/apps/details?id=com.firstlogicmetalab.blith_user_app&showAllReviews=true',
  ios: 'https://apps.apple.com/in/app/blithe/id6473627877?action=write-review',
};

const BookingSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const bookingId = searchParams.get('bookingId');
  const eventId = searchParams.get('eventId');
  const userId = searchParams.get('userId');

  const [booking, setBooking] = useState(null);
  const [eventDetails, setEventDetails] = useState(null);
  const [relatedEvents, setRelatedEvents] = useState([]);
  const [clusterCategoryNames, setClusterCategoryNames] = useState([]);

  // ── Review modal state ──────────────────────────────────────────────────────
  // DEV: ?testReview=ios|android|desktop forces the modal open immediately
  const devTestPlatform = import.meta.env.DEV ? searchParams.get('testReview') : null;
  const mobilePlatform = devTestPlatform || getMobilePlatform();
  const [showReviewModal, setShowReviewModal] = useState(
    import.meta.env.DEV && !!devTestPlatform
  );
  const [hoveredStar, setHoveredStar] = useState(0);
  const [selectedStar, setSelectedStar] = useState(0);
  
  const dispatch = useDispatch();
  const { events: rawEvents } = useSelector(state => state.events);

  useEffect(() => {
    dispatch(fetchEventsThunk());
  }, [dispatch]);

  // Loading and Polling status
  const [loading, setLoading] = useState(true);
  const [pollCount, setPollCount] = useState(0);
  const [copiedId, setCopiedId] = useState(false);

  // Parse Firestore Timestamp to Date
  const parseDate = (ts) => {
    if (!ts) return new Date();
    if (ts.toDate) return ts.toDate();
    if (ts.seconds) return new Date(ts.seconds * 1000);
    return new Date(ts);
  };

  // Helper to format date cleanly
  const formatEventDate = (date) => {
    if (!date) return '';
    const d = parseDate(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Helper to format time cleanly
  const formatEventTime = (bookingObj, eventObj) => {
    // Check explicit time strings on booking or event document
    const explicitTime = 
      bookingObj?.eventTime || 
      bookingObj?.time || 
      eventObj?.eventTime || 
      eventObj?.time || 
      eventObj?.startTime || 
      eventObj?.eventStartTime;

    if (explicitTime && typeof explicitTime === 'string' && explicitTime.trim() !== '') {
      return explicitTime.trim();
    }

    // Extract time from dates (eventStartDate or booking.eventDate)
    let startDateObj = eventObj?.eventStartDate ? parseDate(eventObj.eventStartDate) : null;
    let bookingDateObj = bookingObj?.eventDate ? parseDate(bookingObj.eventDate) : null;

    let dateToUse = startDateObj || bookingDateObj;
    if (!dateToUse) return '';

    const startFormatted = dateToUse.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    if (eventObj?.eventEndDate) {
      const endDateObj = parseDate(eventObj.eventEndDate);
      if (endDateObj) {
        const endFormatted = endDateObj.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        if (startFormatted !== endFormatted) {
          return `${startFormatted} - ${endFormatted}`;
        }
      }
    }

    return startFormatted;
  };

  // Copy booking ID
  const handleCopyBookingId = () => {
    if (bookingId) {
      navigator.clipboard.writeText(bookingId);
      setCopiedId(true);
      toast.success("Booking ID copied to clipboard!");
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  useEffect(() => {
    if (!eventId) return;

    const fetchEvent = async () => {
      try {
        const eventRef = doc(db, 'event', eventId);
        const snap = await getDoc(eventRef);
        if (snap.exists()) {
          const data = snap.data();
          setEventDetails({ id: snap.id, ...data });

          let names = [];
          try {
            const categoriesSnap = await getDocs(query(collection(db, "eventCategories"), where("deleted", "==", false)));
            const categoriesList = categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const clustersSnap = await getDocs(query(collection(db, "cluster_categories"), where("isDeleted", "==", false)));
            const clustersList = clustersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const currentEventCategoryDoc = categoriesList.find(
              cat => cat.categoryName?.toLowerCase() === data.category?.toLowerCase()
            );

            if (currentEventCategoryDoc) {
              const associatedClusterIds = new Set();
              if (currentEventCategoryDoc.clusterId) {
                if (Array.isArray(currentEventCategoryDoc.clusterId)) {
                  currentEventCategoryDoc.clusterId.forEach(id => {
                    if (id) associatedClusterIds.add(id);
                  });
                } else if (typeof currentEventCategoryDoc.clusterId === 'string' && currentEventCategoryDoc.clusterId) {
                  associatedClusterIds.add(currentEventCategoryDoc.clusterId);
                }
              }

              clustersList.forEach(cluster => {
                if (cluster.categoryIds && cluster.categoryIds.includes(currentEventCategoryDoc.id)) {
                  if (cluster.id) associatedClusterIds.add(cluster.id);
                  if (cluster.clusterId) associatedClusterIds.add(cluster.clusterId);
                }
              });

              const matchedCategories = new Set();
              categoriesList.forEach(cat => {
                if (cat.clusterId) {
                  if (Array.isArray(cat.clusterId)) {
                    if (cat.clusterId.some(id => associatedClusterIds.has(id))) {
                      matchedCategories.add(cat.categoryName?.toLowerCase());
                    }
                  } else if (typeof cat.clusterId === 'string' && associatedClusterIds.has(cat.clusterId)) {
                    matchedCategories.add(cat.categoryName?.toLowerCase());
                  }
                }

                const isInCategoryIdsOfAssociatedCluster = clustersList.some(cluster => {
                  const isAssociated = associatedClusterIds.has(cluster.id) || associatedClusterIds.has(cluster.clusterId);
                  return isAssociated && cluster.categoryIds && cluster.categoryIds.includes(cat.id);
                });

                if (isInCategoryIdsOfAssociatedCluster) {
                  matchedCategories.add(cat.categoryName?.toLowerCase());
                }
              });

              names = Array.from(matchedCategories).filter(Boolean);
            }
          } catch (clusterErr) {
            console.error("Error determining cluster category names in BookingSuccess:", clusterErr);
          }
          setClusterCategoryNames(names);
        }
      } catch (err) {
        console.error("Error fetching event details:", err);
      }
    };

    fetchEvent();
  }, [eventId]);

  // Poll Booking details & Trigger Purchase Meta Pixel Event
  useEffect(() => {
    if (!bookingId || !userId) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    let intervalId;
    let reviewTimer;

    const fetchBooking = async () => {
      try {
        const bookingRef = doc(db, "users", userId, "myBookings", bookingId);
        const bookingSnap = await getDoc(bookingRef);

        if (bookingSnap.exists()) {
          if (isMounted) {
            const bData = bookingSnap.data();
            setBooking(bData);
            setLoading(false);
            clearInterval(intervalId);
            trackPixelPurchase(bookingId, bData.totalPrice || bData.totalAmount || 0, bData.eventName || 'Event Booking', bData.totalQuantity || 1);

            // ── Trigger review modal after 3s win-moment delay (all devices) ──
            reviewTimer = setTimeout(() => {
              if (isMounted) setShowReviewModal(true);
            }, 3000);
          }
        } else {
          setPollCount(prev => {
            if (prev >= 10) {
              clearInterval(intervalId);
              if (isMounted) {
                setLoading(false);
              }
            }
            return prev + 1;
          });
        }
      } catch (err) {
        console.error("Error fetching booking details:", err);
      }
    };

    fetchBooking();
    intervalId = setInterval(fetchBooking, 1500);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      clearTimeout(reviewTimer);
    };
  }, [bookingId, userId]);

  // ── Review modal handlers ───────────────────────────────────────────────────
  const handleReviewRedirect = useCallback((platform) => {
    const url = STORE_URLS[platform] || STORE_URLS[mobilePlatform];
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    // On desktop keep modal open so user can tap the other store too
    if (mobilePlatform !== 'desktop') setShowReviewModal(false);
  }, [mobilePlatform]);

  const handleDismissReview = useCallback(() => {
    setShowReviewModal(false);
  }, []);

  // Fetch and score related events
  useEffect(() => {
    if (!eventDetails || !rawEvents || rawEvents.length === 0) return;

    const fetchRelatedEvents = () => {
      try {
        const now = new Date();
        let allEvents = [];

        allEvents = rawEvents
          .filter(e => {
            const isNotCurrent = e.id !== eventDetails.id;
            const isNotBlocked = e.block !== true && e.blocked !== true && e.isBlocked !== true;
            const endD = e.eventEndDate ? parseDate(e.eventEndDate) : null;
            const isNotExpired = endD ? endD >= now : true;
            return isNotCurrent && isNotBlocked && isNotExpired;
          });

        // Score related events based on location & category matches
        const scored = allEvents.map(e => {
          let score = 0;

          // Category match or Cluster match
          const isCategoryMatch = Boolean(eventDetails.category && e.category && e.category.trim().toLowerCase() === eventDetails.category.trim().toLowerCase());
          const isClusterMatch = Boolean(e.category && Array.isArray(clusterCategoryNames) && clusterCategoryNames.some(c => c.toLowerCase() === e.category.trim().toLowerCase()));

          if (isCategoryMatch) {
            score += 10;
          } else if (isClusterMatch) {
            score += 6;
          }

          // Event type match (Online vs In-person)
          if (eventDetails.eventType && e.eventType && e.eventType.toLowerCase() === eventDetails.eventType.toLowerCase()) {
            score += 2;
          }

          // Location match
          const loc1 = (eventDetails.location || eventDetails.venue || "").toLowerCase();
          const loc2 = (e.location || e.venue || "").toLowerCase();

          if (loc1 && loc2) {
            if (loc1.includes("online") && loc2.includes("online")) {
              score += 5;
            } else {
              const cities = ["bangalore", "bengaluru", "mumbai", "delhi", "noida", "gurgaon", "chennai", "hyderabad", "pune", "kolkata"];
              const city1 = cities.find(c => loc1.includes(c));
              const city2 = cities.find(c => loc2.includes(c));
              
              if (city1 && city2 && city1 === city2) {
                score += 5;
              } else if (loc1 === loc2) {
                score += 8;
              }
            }
          }

          return { event: e, score };
        });

        // Filter and sort by highest similarity score
        let finalRelated = scored
          .filter(item => item.score > 0)
          .sort((a, b) => b.score - a.score)
          .map(item => item.event);

        // Fallback: If not enough related events, pad with general future events
        if (finalRelated.length < 3) {
          const ids = new Set(finalRelated.map(e => e.id));
          const additions = allEvents.filter(e => !ids.has(e.id)).slice(0, 3 - finalRelated.length);
          finalRelated = [...finalRelated, ...additions];
        }

        // Format to standard event card fields
        const formatted = finalRelated.map(e => {
          const startDateObj = e.eventStartDate ? parseDate(e.eventStartDate) : new Date();
          const endDateObj = e.eventEndDate ? parseDate(e.eventEndDate) : null;

          const formattedStartDate = startDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
          let formattedDate = formattedStartDate;

          if (endDateObj) {
            const formattedEndDate = endDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
            if (formattedStartDate !== formattedEndDate) {
              formattedDate = `${formattedStartDate} - ${formattedEndDate}`;
            }
          }

          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const isTicketAvailable = (t) => {
            if (!t) return false;
            if (t.deleted === true || t.deleted === 'true' || t.isDeleted === true || t.isDeleted === 'true' || t.delete === true || t.delete === 'true' || t.isDelete === true || t.isDelete === 'true') {
              return false;
            }
            if (t.status === false || t.status === 'false') return false;
            const remainingSlots = Number(t.remainingSlots);
            if (isNaN(remainingSlots) || remainingSlots <= 0) return false;
            if (t.endDate) {
              const ticketEndDate = parseDate(t.endDate);
              if (ticketEndDate && !isNaN(ticketEndDate.getTime())) {
                const tDate = new Date(ticketEndDate);
                tDate.setHours(0, 0, 0, 0);
                if (tDate < today) return false;
              }
            }
            return true;
          };

          let isSoldOut = e.soldOut === true;
          let displayPrice = "Free";
          let isPriceOnwards = false;

          if (e.tickets && e.tickets.length > 0) {
            const availableTickets = isSoldOut ? [] : e.tickets.filter(isTicketAvailable);
            if (!isSoldOut && availableTickets.length === 0) {
              isSoldOut = true;
            }

            if (isSoldOut) {
              displayPrice = "Sold Out";
              isPriceOnwards = false;
            } else {
              const availablePaidTickets = availableTickets.filter(t => (Number(t.actualPrice) || Number(t.price) || 0) > 0);
              if (availablePaidTickets.length > 0) {
                const minPrice = Math.min(...availablePaidTickets.map(t => Number(t.actualPrice) || Number(t.price) || 0));
                displayPrice = `₹${minPrice}`;
                isPriceOnwards = true;
              } else {
                displayPrice = "Free";
                isPriceOnwards = false;
              }
            }
          } else if (isSoldOut) {
            displayPrice = "Sold Out";
            isPriceOnwards = false;
          } else if (e.price > 0) {
            displayPrice = `₹${e.price}`;
          }

          const isFeatured = e.featured === true && e.featuredEndDate && parseDate(e.featuredEndDate) >= now;

          return {
            id: e.id,
            title: e.eventName || "Untitled Event",
            image: (e.image && e.image.length > 0) ? e.image[0] : "",
            date: formattedDate,
            location: e.location || e.venue || "TBA",
            price: displayPrice,
            category: e.category || "Other",
            promoted: isFeatured,
            isPriceOnwards: isPriceOnwards,
            priceMessage: e.priceMessage || ""
          };
        });

        setRelatedEvents(formatted);
      } catch (err) {
        console.error("Error setting related events:", err);
      }
    };

    fetchRelatedEvents();
  }, [eventDetails, rawEvents, clusterCategoryNames]);

  // Framer Motion Entrance
  const ticketVariant = {
    hidden: { opacity: 0, y: 25 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  return (
    <div className="booking-success-page">

      {/* ── App Review Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showReviewModal && (
          <motion.div
            className="review-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={handleDismissReview}
          >
            <motion.div
              className={`review-modal-card${mobilePlatform === 'desktop' ? ' desktop' : ''}`}
              initial={{ opacity: 0, y: 60, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              transition={{ type: 'spring', damping: 22, stiffness: 260 }}
              onClick={e => e.stopPropagation()}
            >
              {/* Close button */}
              <button className="review-close-btn" onClick={handleDismissReview} aria-label="Close">
                <X size={16} />
              </button>

              {/* Decorative top gradient bar */}
              <div className="review-gradient-bar" />

              {/* Icon badge */}
              <div className="review-icon-wrap">
                <div className="review-icon-ring">
                  <img src={logoTransparent} alt="Blithe" className="review-app-logo" />
                </div>
                <div className="review-sparkle-1"><Sparkles size={12} /></div>
                <div className="review-sparkle-2"><Sparkles size={10} /></div>
              </div>

              {/* Copy */}
              <div className="review-copy">
                <h3 className="review-title">Enjoying Blithe? 🎉</h3>
                <p className="review-subtitle">
                  {mobilePlatform === 'desktop'
                    ? 'Your booking is confirmed! Rate us on your preferred store — it means the world to us.'
                    : `Your booking is confirmed! Take 10 seconds to rate us on the ${
                        mobilePlatform === 'android' ? 'Play Store' : 'App Store'
                      } — it means the world to us.`
                  }
                </p>
              </div>

              {/* Interactive stars */}
              <div className="review-stars-row">
                {[1, 2, 3, 4, 5].map(star => (
                  <motion.button
                    key={star}
                    className={`review-star-btn ${
                      star <= (hoveredStar || selectedStar) ? 'active' : ''
                    }`}
                    onMouseEnter={() => setHoveredStar(star)}
                    onMouseLeave={() => setHoveredStar(0)}
                    onClick={() => setSelectedStar(star)}
                    whileTap={{ scale: 0.8 }}
                    animate={star <= selectedStar ? { rotate: [0, -15, 15, 0], scale: [1, 1.3, 1] } : {}}
                    transition={{ duration: 0.3 }}
                    aria-label={`Rate ${star} stars`}
                  >
                    <Star
                      size={32}
                      fill={star <= (hoveredStar || selectedStar) ? '#F59E0B' : 'none'}
                      stroke={star <= (hoveredStar || selectedStar) ? '#F59E0B' : '#D1D5DB'}
                      strokeWidth={1.5}
                    />
                  </motion.button>
                ))}
              </div>

              {/* Rating label */}
              {(hoveredStar || selectedStar) > 0 && (
                <motion.p
                  className="review-rating-label"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {['', 'Not great 😞', 'Could be better 😕', 'It\'s OK 😐', 'Pretty good! 😊', 'Love it! 🤩'][
                    hoveredStar || selectedStar
                  ]}
                </motion.p>
              )}

              {/* CTA buttons */}
              <div className={`review-actions${mobilePlatform === 'desktop' ? ' desktop-dual' : ''}`}>
                {mobilePlatform === 'desktop' ? (
                  // Desktop: show both stores side by side
                  <>
                    <motion.button
                      className="review-cta-store android"
                      onClick={() => handleReviewRedirect('android')}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3.18 23.76c.3.17.64.24.98.21l12.94-12L13.06 8l-9.88 15.76zM20.5 10.22L17.67 8.6l-3.28 3.03 3.28 3.03 2.85-1.63c.81-.46.81-1.74-.02-2.81zM1.5.65C1.19.99 1 1.47 1 2.08v19.84c0 .61.19 1.09.5 1.43L1.62 23.4 13.06 12 1.62.6 1.5.65zM3.18.24L13.06 4 16.1 7.04 3.18.24z" />
                      </svg>
                      <span>
                        <small>GET IT ON</small>
                        Google Play
                      </span>
                    </motion.button>
                    <motion.button
                      className="review-cta-store ios"
                      onClick={() => handleReviewRedirect('ios')}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                      </svg>
                      <span>
                        <small>DOWNLOAD ON THE</small>
                        App Store
                      </span>
                    </motion.button>
                    <button className="review-cta-dismiss" onClick={handleDismissReview}>
                      Maybe later
                    </button>
                  </>
                ) : (
                  // Mobile: single correct store
                  <>
                    <motion.button
                      className="review-cta-primary"
                      onClick={() => handleReviewRedirect(mobilePlatform)}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      {mobilePlatform === 'android' ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M3.18 23.76c.3.17.64.24.98.21l12.94-12L13.06 8l-9.88 15.76zM20.5 10.22L17.67 8.6l-3.28 3.03 3.28 3.03 2.85-1.63c.81-.46.81-1.74-.02-2.81zM1.5.65C1.19.99 1 1.47 1 2.08v19.84c0 .61.19 1.09.5 1.43L1.62 23.4 13.06 12 1.62.6 1.5.65zM3.18.24L13.06 4 16.1 7.04 3.18.24z" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                        </svg>
                      )}
                      Rate on {mobilePlatform === 'android' ? 'Google Play' : 'App Store'}
                    </motion.button>
                    <button className="review-cta-dismiss" onClick={handleDismissReview}>
                      Maybe later
                    </button>
                  </>
                )}
              </div>

              {/* Footer note */}
              <p className="review-footer-note">
                Your review goes directly to the store — nothing is saved by us.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Decorative Glowing Orbs */}
      <div className="glowing-orb orb-1"></div>
      <div className="glowing-orb orb-2"></div>

      <div className="container compact-container">
        {/* Compact Animated Confirmation Banner */}
        <div className="success-header-card compact">
          <motion.div 
            className={`success-badge-outer ${booking?.status === 'pending' ? 'pending' : ''}`}
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", damping: 14, stiffness: 180 }}
          >
            <div className="success-badge-inner">
              {booking?.status === 'pending' ? (
                <Clock size={28} strokeWidth={3.5} className="checkmark-icon" />
              ) : (
                <Check size={28} strokeWidth={3.5} className="checkmark-icon" />
              )}
            </div>
          </motion.div>
          
          <div className="header-text-group">
            <h1 className="gradient-success-title">
              {booking?.status === 'pending' ? 'Booking Request Pending' : 'Your Booking Confirmed'}
            </h1>
            <p className="success-subtitle">
              {booking?.status === 'pending' 
                ? 'Your registration is subject to host approval. We will notify you once approved.' 
                : 'Your tickets are secured. Receipt has been emailed to you.'}
            </p>
          </div>
        </div>

        {/* LANDSCAPE TICKET DESIGN */}
        <motion.div 
          className="classic-landscape-ticket glass"
          initial="hidden"
          animate="visible"
          variants={ticketVariant}
        >
          
          {/* LEFT SECTION: Main Ticket Details */}
          <div className="ticket-main-section">
            
            {/* Event Header row */}
            <div className="ticket-header-row">
              {eventDetails?.image && (
                <div className="ticket-thumbnail">
                  <img src={eventDetails.image && eventDetails.image.length > 0 ? eventDetails.image[0] : eventDetails.image} alt="Event Thumbnail" />
                </div>
              )}
              <div className="ticket-event-meta">
                <span className="category-tag">{eventDetails?.category || 'Event'}</span>
                <h2 className="ticket-title">{eventDetails?.eventName || eventDetails?.title}</h2>
              </div>
            </div>

            {/* Event Details Row */}
            <div className="ticket-details-row">
              <div className="meta-box">
                <Calendar size={14} className="icon" />
                <div>
                  <span className="meta-lbl">Date</span>
                  <span className="meta-val">{formatEventDate(eventDetails?.eventStartDate || booking?.eventDate)}</span>
                </div>
              </div>
              <div className="meta-box">
                <Clock size={14} className="icon" />
                <div>
                  <span className="meta-lbl">Time</span>
                  <span className="meta-val">{formatEventTime(booking, eventDetails) || 'TBA'}</span>
                </div>
              </div>
              <div className="meta-box location">
                <MapPin size={14} className="icon" />
                <div>
                  <span className="meta-lbl">Venue</span>
                  <span className="meta-val">{eventDetails?.venue || eventDetails?.location || 'TBA'}</span>
                </div>
              </div>
            </div>

            {/* Attendee Info Grid */}
            <div className="ticket-attendee-grid">
              <div className="att-row">
                <span className="att-lbl">Name</span>
                <span className="att-val">{booking?.userName || 'Attendee'}</span>
              </div>
              <div className="att-row">
                <span className="att-lbl">Email</span>
                <span className="att-val email">{booking?.userEmail || '—'}</span>
              </div>
              <div className="att-row">
                <span className="att-lbl">Phone</span>
                <span className="att-val">
                  {booking?.userPhone || (booking?.tickets && booking.tickets[0]?.userPhone) || '—'}
                </span>
              </div>
            </div>

            {/* Compact Booking Tickets list */}
            {booking?.tickets && (
              <div className="ticket-items-summary">
                <span className="items-lbl">Tickets:</span>
                <div className="items-pills-container">
                  {booking.tickets.map((t, index) => (
                    <span className="ticket-pill" key={index}>
                      {t.ticketName} <span className="pill-qty">x{t.quantity || t.totalQuantity}</span>
                    </span>
                  ))}
                  <span className="grand-total-pill">
                    {booking?.totalPrice && booking.totalPrice > 0 ? `Paid: ₹${booking.totalPrice.toFixed(2)}` : 'Free'}
                  </span>
                </div>
              </div>
            )}

            {/* Polling loader if details are resolving */}
            {loading && !booking && (
              <div className="polling-loader-compact">
                <div className="compact-spinner"></div>
                <span>Syncing booking registry details...</span>
              </div>
            )}
          </div>

          {/* VERTICAL TEAR-OFF DIVIDER */}
          <div className="ticket-tear-divider">
            <div className="notch top"></div>
            <div className="dashed-line"></div>
            <div className="notch bottom"></div>
          </div>

          {/* RIGHT SECTION: Tear-off action stub */}
          <div className="ticket-stub-section">
            <div className="stub-header">
              <span className={`stub-status-badge ${booking?.status === 'pending' ? 'pending' : ''}`}>
                <span className="pulse-dot"></span> {booking?.status === 'pending' ? 'Pending Approval' : 'Confirmed'}
              </span>
            </div>

            {/* Booking ID Details */}
            <div className="stub-booking-id-area">
              <span className="stub-lbl">Booking ID</span>
              <span className="stub-val booking-id" onClick={handleCopyBookingId}>
                {booking?.bookingId || bookingId}
                <Copy size={12} className="copy-icn" />
              </span>
            </div>

            {/* Compact Action buttons */}
            <div className="stub-nav-actions">
              <Link to="/" className="stub-action-btn primary">
                Discover more Events <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </motion.div>

        {/* App Download Banner */}
        <motion.div 
          className="app-download-banner glass"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
        >
          <div className="app-banner-content">
            <div className="app-info-left">
              <div className="app-logo-container">
                <img src={logoTransparent} alt="Blithe App" />
              </div>
              <div className="app-texts">
                <h3 className="app-banner-title">Download the Blithe App</h3>
                <p className="app-banner-desc">You can see your event and booking details in the Blithe app.</p>
              </div>
            </div>
            
            <div className="app-download-badges">
              <a href="https://play.google.com/store/apps/details?id=com.firstlogicmetalab.blith_user_app" target="_blank" rel="noopener noreferrer" className="store-badge-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3.18 23.76c.3.17.64.24.98.21l12.94-12L13.06 8l-9.88 15.76zM20.5 10.22L17.67 8.6l-3.28 3.03 3.28 3.03 2.85-1.63c.81-.46.81-1.74-.02-2.81zM1.5.65C1.19.99 1 1.47 1 2.08v19.84c0 .61.19 1.09.5 1.43L1.62 23.4 13.06 12 1.62.6 1.5.65zM3.18.24L13.06 4 16.1 7.04 3.18.24z" />
                </svg>
                <div className="badge-text">
                  <span className="badge-sub">Get it on</span>
                  <span className="badge-main">Google Play</span>
                </div>
              </a>
              <a href="https://apps.apple.com/in/app/blithe/id6473627877" target="_blank" rel="noopener noreferrer" className="store-badge-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                <div className="badge-text">
                  <span className="badge-sub">Download on the</span>
                  <span className="badge-main">App Store</span>
                </div>
              </a>
            </div>
          </div>
        </motion.div>

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
                        <span className="featured-badge-small">Featured</span>
                      )}
                    </div>
                    <div className="portrait-card-details">
                      <span className="portrait-card-date">{relatedEvent.date}</span>
                      <h3 className="portrait-card-title">{relatedEvent.title}</h3>
                      <p className="portrait-card-location">{relatedEvent.location}</p>

                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingSuccess;
