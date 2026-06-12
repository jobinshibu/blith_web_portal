import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchEventsThunk } from '../../store/eventsSlice';
import { Calendar, MapPin, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import logo from '../../assets/logo.jpeg';
import logoText from '../../assets/fifablith.png';
import './LinkTree.scss';

const LinkTree = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const dispatch = useDispatch();
  const { events: rawEvents, loading: eventsLoading } = useSelector(state => state.events);

  useEffect(() => {
    dispatch(fetchEventsThunk());
  }, [dispatch]);

  useEffect(() => {
    setLoading(eventsLoading);
  }, [eventsLoading]);

  useEffect(() => {
    if (!rawEvents || rawEvents.length === 0) {
      if (!eventsLoading && rawEvents.length === 0) {
        setEvents([]);
      }
      return;
    }

    try {
      const toDateObj = (ts) => {
        if (!ts) return null;
        if (typeof ts.toDate === 'function') return ts.toDate();
        return new Date(ts);
      };

      const eventsData = rawEvents
        .filter(data => {
          const isNotBlocked = data.block === false;
          // Only show events that are not expired
          const endD = toDateObj(data.eventEndDate);
          const isNotExpired = endD ? endD >= new Date() : true;
          // Only show events that are hosted on Blithe (paymentUrl/paymentURl/paymentURL is empty)
          const paymentUrlVal = data.paymentUrl || data.paymentURl || data.paymentURL || "";
          const isBlitheEvent = !paymentUrlVal || paymentUrlVal.trim() === "";
          return isNotBlocked && isNotExpired && isBlitheEvent;
        })
        .sort((a, b) => {
          const dateA = a.eventStartDate ? toDateObj(a.eventStartDate) : new Date();
          const dateB = b.eventStartDate ? toDateObj(b.eventStartDate) : new Date();
          return dateA - dateB; // Sort by closest date first
        });

      setEvents(eventsData);
    } catch (error) {
      console.error("Error setting LinkTree events: ", error);
    }
  }, [rawEvents, eventsLoading]);

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Date TBD';
    const date = typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  return (
    <div className="linktree-page-wrapper">
      <div className="linktree-container">
        <motion.div
          className="profile-section"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="avatar">
            <img src={logo} alt="Go Blithe" />
          </div>
          <div className="profile-info">
            <h1>Go Blithe</h1>
            <p>Discover and book the exclusive events near you.</p>
          </div>
        </motion.div>

        <div className="links-section">
          {loading ? (
            <div className="loading-container" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '40vh', gap: '1.5rem', width: '100%' }}>
              <motion.img
                src={logo}
                alt="Loading..."
                style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 10px 25px rgba(124, 58, 237, 0.2)' }}
                animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              />
              <h2 style={{ color: '#7C3AED', fontWeight: 'bold', fontSize: '1.1rem', margin: 0 }}>Loading events...</h2>
            </div>
          ) : events.length > 0 ? (
            events.map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 + (index * 0.1), ease: "easeOut" }}
              >
                <Link to={`/events/${event.id}`} className="link-button">
                  <img
                    src={event.image && event.image.length > 0 ? event.image[0] : '/assets/placeholder.jpg'}
                    alt={event.eventName}
                    className="event-thumbnail"
                  />
                  <div className="event-info">
                    <h3>{event.eventName || 'Untitled Event'}</h3>
                    <div className="event-meta">
                      <span>
                        <Calendar size={12} />
                        {formatDate(event.eventStartDate)}
                      </span>
                      {event.city && (
                        <span>
                          <MapPin size={12} />
                          {event.city}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={20} className="arrow-icon" />
                </Link>
              </motion.div>
            ))
          ) : (
            <div className="loading-text">No active events available at the moment.</div>
          )}
        </div>

        <motion.div
          className="footer-logo"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
        >
          <Link to="/">
            <img src={logoText} alt="Go Blithe" style={{ height: '32px' }} />
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

export default LinkTree;
