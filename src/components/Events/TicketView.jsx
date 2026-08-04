import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { doc, getDoc, collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { motion } from 'framer-motion';
import html2canvas from 'html2canvas';
import { QRCodeSVG } from 'qrcode.react';

import {
  Copy,
  CheckCircle2,
  AlertCircle,
  User,
  Ticket as TicketIcon,
  Calendar,
  Clock,
  Compass,
  MapPin,
  ShieldCheck,
  Share2,
  ExternalLink
} from 'lucide-react';

import { toast } from 'react-hot-toast';
import logoTransparent from '../../assets/logo-transparent.png';
import './TicketView.scss';

const TicketView = () => {
  // Strict URL parameter route: /ticketView/:eventId/:bookingId
  const { eventId: rawEventId, bookingId: rawBookingId } = useParams();
  const navigate = useNavigate();
  const ticketRef = useRef(null);

  // Smart parameter auto-correction for /ticketView/:eventId/:bookingId
  let resolvedBookingId = rawBookingId;
  let resolvedEventId = rawEventId;

  if (rawEventId && (rawEventId.startsWith('BVB') || (rawBookingId && rawBookingId.startsWith('BLEV')))) {
    resolvedBookingId = rawEventId;
    resolvedEventId = rawBookingId;
  }

  const bookingId = resolvedBookingId;
  const eventId = resolvedEventId;

  // State variables
  const [booking, setBooking] = useState(null);
  const [eventDetails, setEventDetails] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(false);

  // Parse Firestore Timestamp or string date to Date object
  const parseDate = (val) => {
    if (!val) return null;
    if (val.toDate && typeof val.toDate === 'function') return val.toDate();
    if (val.seconds) return new Date(val.seconds * 1000);
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  // Format date: e.g., "30 Jul, 2026"
  const formatDate = (val) => {
    const d = parseDate(val);
    if (!d) return 'N/A';
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Format time: e.g., "12:00 AM - 03:00 PM"
  const formatTime = (bookingObj, eventObj) => {
    const explicitTimeVal = 
      bookingObj?.eventTime || 
      bookingObj?.time || 
      eventObj?.eventTime || 
      eventObj?.time || 
      eventObj?.startTime || 
      eventObj?.eventStartTime;

    if (explicitTimeVal && typeof explicitTimeVal === 'string' && explicitTimeVal.trim() !== '') {
      return explicitTimeVal.trim();
    }

    const startDateVal = eventObj?.eventStartDate || bookingObj?.eventDate;
    const startDateObj = parseDate(startDateVal);
    if (!startDateObj) return null;

    const startFormatted = startDateObj.toLocaleTimeString('en-US', {
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

  // Optimized Firestore fetching with instant eventId lookups
  useEffect(() => {
    if (!bookingId) {
      setLoading(false);
      setError("Invalid URL parameters. Required format: /ticketView/:eventId/:bookingId");
      return;
    }

    let isMounted = true;

    const fetchTicketDetails = async () => {
      setLoading(true);
      setError(null);

      try {
        let foundBooking = null;

        // 0a. Parallel fetch event document instantly from event collection
        if (eventId) {
          getDoc(doc(db, "event", eventId))
            .then((eSnap) => {
              if (eSnap.exists() && isMounted) {
                setEventDetails({ id: eSnap.id, ...eSnap.data() });
              }
            })
            .catch((e) => console.warn("Instant event fetch warning:", e));

          // 0b. Fast direct O(1) doc lookup under event subcollection
          try {
            const ebRef = doc(db, "event", eventId, "eventBookings", bookingId);
            const ebSnap = await getDoc(ebRef);
            if (ebSnap.exists()) {
              foundBooking = { id: ebSnap.id, ...ebSnap.data() };
            }
          } catch (e) { }

          if (!foundBooking) {
            try {
              const ebRef2 = doc(db, "event", eventId, "myBookings", bookingId);
              const ebSnap2 = await getDoc(ebRef2);
              if (ebSnap2.exists()) {
                foundBooking = { id: ebSnap2.id, ...ebSnap2.data() };
              }
            } catch (e) { }
          }
        }

        // 1. Query collectionGroup 'myBookings' by field 'bookingId'
        if (!foundBooking) {
          try {
            const q1 = query(collectionGroup(db, 'myBookings'), where('bookingId', '==', bookingId));
            const snap1 = await getDocs(q1);
            if (!snap1.empty) {
              foundBooking = { id: snap1.docs[0].id, ...snap1.docs[0].data() };
            }
          } catch (cgErr) {
            console.warn("collectionGroup 'myBookings' query error:", cgErr);
          }
        }

        // 2. Query collectionGroup 'eventBookings' by field 'bookingId'
        if (!foundBooking) {
          try {
            const q3 = query(collectionGroup(db, 'eventBookings'), where('bookingId', '==', bookingId));
            const snap3 = await getDocs(q3);
            if (!snap3.empty) {
              foundBooking = { id: snap3.docs[0].id, ...snap3.docs[0].data() };
            }
          } catch (cgErr) {
            console.warn("collectionGroup 'eventBookings' query error:", cgErr);
          }
        }

        // 3. Fallback direct collection lookups
        if (!foundBooking) {
          const directCollections = ['myBookings', 'bookings', 'eventBookings'];
          for (const colName of directCollections) {
            try {
              const directRef = doc(db, colName, bookingId);
              const directSnap = await getDoc(directRef);
              if (directSnap.exists()) {
                foundBooking = { id: directSnap.id, ...directSnap.data() };
                break;
              }
            } catch (e) { }
          }
        }

        if (!isMounted) return;

        if (foundBooking) {
          setBooking(foundBooking);

          // Fetch associated event info from event collection if not already loaded
          const targetEventId = foundBooking.eventId || eventId;
          if (targetEventId && !eventDetails) {
            try {
              const eventSnap = await getDoc(doc(db, "event", targetEventId));
              if (eventSnap.exists()) {
                setEventDetails({ id: eventSnap.id, ...eventSnap.data() });
              }
            } catch (e) {
              console.error("Error fetching event details:", e);
            }
          }

          // Fetch user data if profile image or name missing
          if (foundBooking.userId) {
            try {
              const userSnap = await getDoc(doc(db, "users", foundBooking.userId));
              if (userSnap.exists()) {
                setUserData(userSnap.data());
              }
            } catch (e) {
              console.error("Error fetching user info:", e);
            }
          }
        } else {
          setError("Booking details not found. Please verify your URL.");
        }
      } catch (err) {
        console.error("Error in fetchTicketDetails:", err);
        if (isMounted) setError("Failed to retrieve booking information.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchTicketDetails();

    return () => {
      isMounted = false;
    };
  }, [bookingId, eventId]);

  // Copy Booking ID handler
  const handleCopyId = () => {
    if (bookingId) {
      navigator.clipboard.writeText(bookingId);
      setCopiedId(true);
      toast.success("Booking ID copied!");
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  // Ticket Action Handlers
  const handleExploreEvents = () => {
    navigate('/');
  };

  const handleShareTicket = async () => {
    if (!ticketRef.current) {
      toast.error("Ticket element not ready.");
      return;
    }

    const toastId = toast.loading("Generating ticket image...");

    try {
      // Convert external image elements inside ticket element to Base64 to prevent CORS canvas taint
      const imgElements = Array.from(ticketRef.current.querySelectorAll('img'));
      const originalSrcs = imgElements.map((img) => img.src);

      await Promise.all(
        imgElements.map(async (img) => {
          if (img.src && !img.src.startsWith('data:')) {
            try {
              const res = await fetch(img.src, { mode: 'cors' });
              const blob = await res.blob();
              await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                  if (reader.result) img.src = reader.result;
                  resolve();
                };
                reader.onerror = () => resolve();
                reader.readAsDataURL(blob);
              });
            } catch (e) {
              // Ignore fetch error, keep original src
            }
          }
        })
      );

      const canvas = await html2canvas(ticketRef.current, {
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#0B0B0E',
        scale: 2,
        logging: false
      });

      // Restore original img srcs
      imgElements.forEach((img, i) => {
        img.src = originalSrcs[i];
      });

      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast.error("Failed to export image.", { id: toastId });
          return;
        }

        const fileName = `Blithe-Ticket-${bookingId || 'Pass'}.png`;
        const file = new File([blob], fileName, { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: eventName || 'Blithe Pass',
              text: `Here is my entry ticket for ${eventName || 'this event'}!\n${window.location.href}`,
              files: [file]
            });
            toast.dismiss(toastId);
          } catch (err) {
            if (err.name !== 'AbortError') {
              downloadFile(file);
              toast.success("Ticket image downloaded!", { id: toastId });
            } else {
              toast.dismiss(toastId);
            }
          }
        } else if (navigator.share) {
          try {
            await navigator.share({
              title: eventName || 'Blithe Pass',
              text: `Here is my entry ticket for ${eventName || 'this event'}!`,
              url: window.location.href
            });
            toast.dismiss(toastId);
          } catch (err) {
            if (err.name !== 'AbortError') {
              downloadFile(file);
              toast.success("Ticket image downloaded!", { id: toastId });
            } else {
              toast.dismiss(toastId);
            }
          }
        } else {
          downloadFile(file);
          toast.success("Ticket image downloaded!", { id: toastId });
        }
      }, 'image/png');
    } catch (err) {
      console.error("Error generating ticket image:", err);
      toast.error("Could not capture ticket image.", { id: toastId });
    }
  };

  const downloadFile = (file) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(file);
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Compute data values safely
  const eventBannerImage = booking?.eventImage
    ? (Array.isArray(booking.eventImage) ? booking.eventImage[0] : booking.eventImage)
    : (eventDetails?.image ? (Array.isArray(eventDetails.image) ? eventDetails.image[0] : eventDetails.image) : null);

  const eventName = booking?.eventName || eventDetails?.eventName || eventDetails?.title || 'Event Booking';
  const categoryName = eventDetails?.category || booking?.category || 'Event';

  // Strictly extract venue from event collection 'venue' field
  const locationStr = eventDetails?.venue || booking?.venue || eventDetails?.location || booking?.location || eventDetails?.address || booking?.address || null;

  const ticketHolderName = booking?.userName || userData?.fullName || userData?.name || userData?.displayName || 'Ticket Holder';
  const ticketHolderImage = booking?.userProfileImage || userData?.profilePic || userData?.photoURL || null;

  const eventDateStr = formatDate(eventDetails?.eventStartDate || booking?.eventDate);
  const eventTimeStr = formatTime(booking, eventDetails);
  const bookedDateStr = formatDate(booking?.createdDate || booking?.bookingDate || new Date());

  const quantityCount = Number(booking?.totalQuantity || (booking?.tickets ? booking.tickets.reduce((acc, curr) => acc + (Number(curr.quantity) || Number(curr.totalQuantity) || 1), 0) : 1));

  // Compute status explicitly for CSS matching & professional label display
  const rawStatus = (booking?.status || 'confirmed').toString().trim().toLowerCase().replace(/[\s_-]/g, '');

  const isPending = rawStatus === 'pending' || rawStatus === 'processing';
  const isCancelled = rawStatus === 'cancelled' || rawStatus === 'canceled' || rawStatus === 'rejected' || rawStatus === 'failed';
  const isPartiallyAttended = rawStatus === 'partiallyattended' || rawStatus === 'partial' || rawStatus === 'partialattended';
  const isAttended = rawStatus === 'attended' || rawStatus === 'completed' || rawStatus === 'used';

  const statusClass = isPartiallyAttended
    ? 'partially-attended'
    : isAttended
      ? 'attended'
      : isPending
        ? 'pending'
        : isCancelled
          ? 'cancelled'
          : 'confirmed';

  const statusLabel = isPartiallyAttended
    ? 'PARTIALLY ATTENDED'
    : isAttended
      ? 'ATTENDED'
      : isPending
        ? 'PROCESSING'
        : isCancelled
          ? 'CANCELLED PASS'
          : (rawStatus && rawStatus !== 'confirmed' && rawStatus !== 'true'
            ? rawStatus.toUpperCase()
            : 'VALID PASS');

  // QR Code generation containing only the bookingId when scanned
  const qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
    bookingId
  )}&margin=6`;

  return (
    <div className="mobile-fit-ticket-page">
      {/* Background Orbs & Ambient Illumination */}
      <div className="bg-orb orb-1"></div>
      <div className="bg-orb orb-2"></div>
      <div className="ambient-top-glow"></div>

      {/* Header Bar with Contextual Actions */}
      <header className="mobile-fit-header">
        <div className="brand-title-box">
          <div className="brand-logo-row">
            <img src={logoTransparent} alt="Blithe Logo" className="header-brand-logo" />
            <span className="brand-name">BLITHE PASS</span>
          </div>
          {/* <span className="brand-sub">Official Entry Ticket</span> */}
        </div>

        <div className="header-actions">
          <button className="action-btn secondary share-btn" onClick={handleShareTicket} aria-label="Share Ticket">
            <Share2 size={13} />
            <span className="btn-text">Share</span>
          </button>

          <button className="action-btn primary" onClick={handleExploreEvents} aria-label="Explore Events">
            <Compass size={13} />
            <span>Explore Events</span>
          </button>
        </div>
      </header>

      {/* Main Viewport Container */}
      <main className="mobile-fit-viewport-container">
        {loading ? (
          <div className="skeleton-card glass">
            <div className="skeleton-line title"></div>
            <div className="skeleton-line row"></div>
            <div className="skeleton-qr"></div>
          </div>
        ) : error ? (
          <motion.div
            className="error-card glass"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <AlertCircle size={44} className="error-icon" />
            <h2>Ticket Unavailable</h2>
            <p>{error}</p>
            <button className="btn-glow" onClick={handleExploreEvents}>
              Explore Events
            </button>
          </motion.div>
        ) : (
          <motion.div
            className="ticket-pass-card glass"
            ref={ticketRef}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {/* LEFT SECTION: PASS HERO & EVENT DETAILS */}
            <div className="left-pass-section">
              {/* Top Status Pill */}
              <div className="top-status-row">
                <div className={`status-pill ${statusClass}`}>
                  <span className="dot"></span>
                  <span>{statusLabel}</span>
                </div>
              </div>

              {/* Hero Banner: Poster + Dominant Event Name */}
              <div className="hero-event-section">
                <div className="poster-frame">
                  {eventBannerImage ? (
                    <img src={eventBannerImage} alt={eventName} className="poster-image" />
                  ) : (
                    <div className="poster-placeholder">
                      <TicketIcon size={36} />
                    </div>
                  )}
                  <span className="category-pill">{categoryName}</span>
                </div>

                <div className="event-title-meta">
                  <h1 className="event-name-heading">{eventName}</h1>

                  {/* Visual Hierarchy: Venue (Primary Accent) > Date (Secondary) */}
                  {locationStr && (
                    <div
                      className="primary-venue-block"
                      onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationStr)}`, '_blank')}
                      title="Open Venue Directions in Google Maps"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationStr)}`, '_blank'); }}
                    >
                      <div className="venue-text-wrap">
                        <span className="venue-lbl">VENUE</span>
                        <span className="venue-val">{locationStr}</span>
                      </div>
                      <ExternalLink size={12} className="nav-arrow" />
                    </div>
                  )}

                  <div className="secondary-date-time-block">
                    <div className="meta-item">
                      <Calendar size={13} className="date-icon" />
                      <span className="date-lbl">EVENT DATE:</span>
                      <span className="date-val">{eventDateStr}</span>
                    </div>
                    {eventTimeStr && (
                      <div className="meta-item">
                        <Clock size={13} className="date-icon" />
                        <span className="date-lbl">TIME:</span>
                        <span className="date-val">{eventTimeStr}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Ticket Holder & Booking Information (Icons & Un-boxed Rows) */}
              <div className="holder-meta-grid">
                <div className="meta-row">
                  <div className="meta-label-group">
                    <User size={13} className="meta-icon" />
                    <span className="lbl">Ticket Holder:</span>
                  </div>
                  <div className="holder-user-val">
                    {ticketHolderImage ? (
                      <img src={ticketHolderImage} alt={ticketHolderName} className="avatar" />
                    ) : (
                      <div className="avatar-placeholder">
                        <User size={10} />
                      </div>
                    )}
                    <span className="val">{ticketHolderName}</span>
                  </div>
                </div>

                <div className="meta-row">
                  <div className="meta-label-group">
                    <TicketIcon size={13} className="meta-icon" />
                    <span className="lbl">Tickets:</span>
                  </div>
                  <span className="val">{quantityCount} {quantityCount === 1 ? 'Ticket' : 'Tickets'}</span>
                </div>

                <div className="meta-row">
                  <div className="meta-label-group">
                    <Calendar size={13} className="meta-icon" />
                    <span className="lbl">Booked Date:</span>
                  </div>
                  <span className="val">{bookedDateStr}</span>
                </div>
              </div>
            </div>

            {/* PERFORATED TEAR SEPARATOR WITH REALISTIC NOTCHES */}
            <div className="tear-separator">
              <div className="notch left-notch"></div>
              <div className="dashed-line"></div>
              <div className="notch right-notch"></div>
            </div>

            {/* RIGHT SECTION: ENTRY VERIFICATION QR & STUB */}
            <div className="right-stub-section">
              <div className="stub-header-row">
                <span className="stub-title">ENTRY VERIFICATION</span>
              </div>

              <div className="stub-body-row">
                {/* Entry QR Box */}
                <div className="qr-wrapper">
                  <div className="qr-card">
                    <QRCodeSVG
                      value={bookingId || 'ticket'}
                      size={140}
                      bgColor="#FFFFFF"
                      fgColor="#000000"
                      level="H"
                      includeMargin={false}
                      style={{ width: '100%', height: '100%' }}
                    />
                  </div>
                  <span className="scan-text">Scan at Entrance</span>
                </div>

                {/* Ticket Items & Copy ID */}
                <div className="stub-details-col">
                  <div className="type-list">
                    {booking?.tickets && booking.tickets.length > 0 ? (
                      booking.tickets.map((t, idx) => {
                        const qty = Number(t.quantity || t.totalQuantity || 1);
                        const name = t.ticketName || t.name || 'Generic Ticket';
                        const itemPrice = t.totalPrice !== undefined
                          ? Number(t.totalPrice)
                          : (t.price ? Number(t.price) * qty : 0);
                        const attendedCount = t.totalAttendedQuantity !== undefined
                          ? Number(t.totalAttendedQuantity)
                          : (t.attendedQuantity !== undefined ? Number(t.attendedQuantity) : 0);

                        return (
                          <div key={idx} className="type-item">
                            <div className="type-left">
                              <span className="name">{qty}x {name}</span>
                              <span className="attended-tag">Event Attended: {attendedCount}/{qty}</span>
                            </div>
                            <span className="price">₹{(itemPrice || 0).toFixed(2)}</span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="type-item">
                        <div className="type-left">
                          <span className="name">{quantityCount}x Standard Ticket</span>
                          <span className="attended-tag">Attended: {booking?.attendedQuantity || 0}/{quantityCount}</span>
                        </div>
                        <span className="price">₹{Number(booking?.totalPrice || 0).toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  {/* Booking ID Copy Pill */}
                  <div
                    className="booking-id-btn"
                    onClick={handleCopyId}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleCopyId();
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Copy Booking ID ${bookingId}`}
                  >
                    <div className="b-id-left">
                      <span className="lbl">ID:</span>
                      <span className="val">{bookingId}</span>
                    </div>
                    {copiedId ? (
                      <CheckCircle2 size={14} className="copy-icon success" />
                    ) : (
                      <Copy size={14} className="copy-icon" />
                    )}
                  </div>
                </div>
              </div>

              {/* Footer Total & Verified Branding */}
              <div className="stub-footer">
                <div className="total-box">
                  <span className="lbl">Total Paid:</span>
                  <span className="val">₹{Number(booking?.totalPrice || 0).toFixed(2)}</span>
                </div>
                {/* 
                <div className="verified-brand-box">
                  <ShieldCheck size={14} className="verified-shield-icon" />
                  <span className="verified-text">Verified by</span>
                  <img src={logoTransparent} alt="Blithe" className="brand-logo" />
                  <span className="verified-brand-name">Blithe</span>
                </div> */}
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default TicketView;
