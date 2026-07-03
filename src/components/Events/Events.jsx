import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronDown, Calendar, MapPin, Clock, ArrowRight, Sparkles, Trophy, Music, Utensils, Tent, Film, Dumbbell, Presentation, Mic, Mic2, X, ChevronLeft, ChevronRight, Globe, Info, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { fetchEventsThunk, fetchCategoriesThunk } from '../../store/eventsSlice';
import logo from '../../assets/logo.jpeg';
import './Events.scss';
import { db, analytics } from '../../firebase';
import { logEvent } from 'firebase/analytics';
import { getActiveLeadSource } from '../../services/leadService';


// Robust multi-fallback IP Geolocation helper
const fetchApproximateLocation = async () => {
  try {
    const response = await fetch('https://ipapi.co/json/');
    if (response.ok) {
      const data = await response.json();
      if (data.latitude && data.longitude) {
        return {
          lat: parseFloat(data.latitude),
          lng: parseFloat(data.longitude),
          type: 'approximate',
          city: data.city || '',
          region: data.region || ''
        };
      }
    }
  } catch (err) {
    console.warn("Failed to fetch location from ipapi.co, trying ipinfo.io...", err);
  }

  try {
    const response = await fetch('https://ipinfo.io/json');
    if (response.ok) {
      const data = await response.json();
      if (data.loc) {
        const [lat, lng] = data.loc.split(',').map(parseFloat);
        if (!isNaN(lat) && !isNaN(lng)) {
          return {
            lat,
            lng,
            type: 'approximate',
            city: data.city || '',
            region: data.region || ''
          };
        }
      }
    }
  } catch (err) {
    console.error("All IP geolocation fallbacks failed", err);
  }
  throw new Error("Could not retrieve approximate location.");
};

// Geolocation instructions & recovery modal
const LocationPermissionModal = ({ onClose, onUseApproxLocation, isFetchingApprox }) => {
  const [activeTab, setActiveTab] = useState('chrome');

  const instructions = {
    chrome: [
      "Click the lock/settings icon (🔒) on the left side of the address bar.",
      "Toggle the 'Location' permission switch to 'Allow'.",
      "Reload the page to apply changes."
    ],
    safari: [
      "Open Safari Settings (Cmd + ,) and click on 'Websites'.",
      "Click on 'Location' in the left sidebar.",
      "Find 'blithe' in the list and set its permission to 'Allow'.",
      "Refresh the browser tab."
    ],
    firefox: [
      "Click the permissions settings icon to the left of the URL address bar.",
      "Click the 'X' button next to 'Blocked' to clear the blocked status.",
      "Reload the page and select 'Allow' when prompted for location access."
    ],
    edge: [
      "Click the lock icon (🔒) next to the URL in the address bar.",
      "Change the 'Location' permission selection to 'Allow'.",
      "Reload the page."
    ]
  };

  return (
    <div className="location-modal-overlay" onClick={onClose}>
      <motion.div
        className="location-modal"
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
      >
        <button className="location-modal-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>

        <div className="location-modal-content">
          <div className="icon-pulse-wrapper">
            <MapPin size={32} />
          </div>
          <h2>Location Access Blocked</h2>
          <p className="modal-description">
            We couldn't access your location. To find events near you, choose one of the options below:
          </p>

          <div className="option-card IP-option">
            <h3>Option 1: Quick Approximate Location</h3>
            <p>Find events in your region using your IP address. No browser settings change required!</p>
            <button
              type="button"
              className="approx-loc-btn"
              onClick={onUseApproxLocation}
              disabled={isFetchingApprox}
            >
              {isFetchingApprox ? (
                <>
                  <span className="spinner-icon"></span>
                  Locating...
                </>
              ) : (
                <>
                  <Globe size={18} />
                  Use Approximate Location
                </>
              )}
            </button>
          </div>

          <div className="option-card settings-option">
            <h3>Option 2: Allow Precise GPS Location</h3>
            <p>For high-accuracy event sorting and distances, reset permissions in your browser settings:</p>

            <div className="browser-tabs">
              {['chrome', 'safari', 'firefox', 'edge'].map(browser => (
                <button
                  type="button"
                  key={browser}
                  className={`browser-tab-btn ${activeTab === browser ? 'active' : ''}`}
                  onClick={() => setActiveTab(browser)}
                >
                  {browser.charAt(0).toUpperCase() + browser.slice(1)}
                </button>
              ))}
            </div>

            <div className="instruction-steps">
              <ol>
                {instructions[activeTab].map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// Helper to process and split hashtags from string/array formats
const processTags = (tagsInput) => {
  if (!tagsInput) return [];
  let tagsArray = [];
  if (typeof tagsInput === 'string') {
    // Split by space, hash, or comma
    tagsArray = tagsInput.split(/[\s#,]+/);
  } else if (Array.isArray(tagsInput)) {
    // If it's an array, split each string item by space, hash, or comma
    tagsInput.forEach(tag => {
      if (typeof tag === 'string') {
        tagsArray.push(...tag.split(/[\s#,]+/));
      } else {
        tagsArray.push(tag);
      }
    });
  }
  return tagsArray
    .map(t => t.trim())
    .filter(t => t !== "");
};

const CATEGORY_STYLES = [
  { name: "Music Shows", label: "Music", icon: Music, color: "#7C3AED", bg: "#F5F3FF", border: "rgba(124, 58, 237, 0.2)", selectedBg: "linear-gradient(135deg, #7C3AED, #8B5CF6)", glow: "rgba(124, 58, 237, 0.25)" },
  { name: "Nightlife", label: "Nightlife", icon: Sparkles, color: "#7C3AED", bg: "#F5F3FF", border: "rgba(124, 58, 237, 0.2)", selectedBg: "linear-gradient(135deg, #7C3AED, #8B5CF6)", glow: "rgba(124, 58, 237, 0.25)" },
  { name: "Comedy Shows", label: "Comedy", icon: Mic, color: "#7C3AED", bg: "#F5F3FF", border: "rgba(124, 58, 237, 0.2)", selectedBg: "linear-gradient(135deg, #7C3AED, #8B5CF6)", glow: "rgba(124, 58, 237, 0.25)" },
  { name: "Sports", label: "Sports", icon: Trophy, color: "#7C3AED", bg: "#F5F3FF", border: "rgba(124, 58, 237, 0.2)", selectedBg: "linear-gradient(135deg, #7C3AED, #8B5CF6)", glow: "rgba(124, 58, 237, 0.25)" },
  { name: "Performances", label: "Performances", icon: Mic2, color: "#7C3AED", bg: "#F5F3FF", border: "rgba(124, 58, 237, 0.2)", selectedBg: "linear-gradient(135deg, #7C3AED, #8B5CF6)", glow: "rgba(124, 58, 237, 0.25)" },
  { name: "Food & Drinks", label: "Food & Drinks", icon: Utensils, color: "#7C3AED", bg: "#F5F3FF", border: "rgba(124, 58, 237, 0.2)", selectedBg: "linear-gradient(135deg, #7C3AED, #8B5CF6)", glow: "rgba(124, 58, 237, 0.25)" },
  { name: "Fests & Fairs", label: "Fests & Fairs", icon: Tent, color: "#7C3AED", bg: "#F5F3FF", border: "rgba(124, 58, 237, 0.2)", selectedBg: "linear-gradient(135deg, #7C3AED, #8B5CF6)", glow: "rgba(124, 58, 237, 0.25)" },
  { name: "Social Mixers", label: "Social Mixers", icon: Sparkles, color: "#7C3AED", bg: "#F5F3FF", border: "rgba(124, 58, 237, 0.2)", selectedBg: "linear-gradient(135deg, #7C3AED, #8B5CF6)", glow: "rgba(124, 58, 237, 0.25)" },
  { name: "Screenings", label: "Screenings", icon: Film, color: "#7C3AED", bg: "#F5F3FF", border: "rgba(124, 58, 237, 0.2)", selectedBg: "linear-gradient(135deg, #7C3AED, #8B5CF6)", glow: "rgba(124, 58, 237, 0.25)" },
  { name: "Fitness", label: "Fitness", icon: Dumbbell, color: "#7C3AED", bg: "#F5F3FF", border: "rgba(124, 58, 237, 0.2)", selectedBg: "linear-gradient(135deg, #7C3AED, #8B5CF6)", glow: "rgba(124, 58, 237, 0.25)" },
  { name: "Conferences", label: "Conferences", icon: Presentation, color: "#7C3AED", bg: "#F5F3FF", border: "rgba(124, 58, 237, 0.2)", selectedBg: "linear-gradient(135deg, #7C3AED, #8B5CF6)", glow: "rgba(124, 58, 237, 0.25)" },
  { name: "Open Mics", label: "Open Mics", icon: Mic2, color: "#7C3AED", bg: "#F5F3FF", border: "rgba(124, 58, 237, 0.2)", selectedBg: "linear-gradient(135deg, #7C3AED, #8B5CF6)", glow: "rgba(124, 58, 237, 0.25)" },
];

const getCalendarMonths = () => {
  const months = [];
  const startYear = 2026;
  const startMonth = 4; // May (0-indexed)
  
  const today = new Date();
  const currentYear = today.getFullYear();
  
  // Generate months from May 2026 up to 10 years in the future to support future dates (2028, 2029, 2030, etc.)
  const endYear = Math.max(currentYear, 2026) + 10;
  
  let tempYear = startYear;
  let tempMonth = startMonth;
  
  while (tempYear < endYear || (tempYear === endYear && tempMonth <= 11)) {
    const firstDay = new Date(tempYear, tempMonth, 1);
    const name = firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const daysInMonth = new Date(tempYear, tempMonth + 1, 0).getDate();
    const startDayOfWeek = firstDay.getDay();
    
    months.push({
      name,
      monthIndex: tempMonth,
      year: tempYear,
      daysInMonth,
      startDayOfWeek
    });
    
    tempMonth++;
    if (tempMonth > 11) {
      tempMonth = 0;
      tempYear++;
    }
  }
  return months;
};

const CALENDAR_MONTHS = getCalendarMonths();

// Custom Category Card component to maintain single source of styles/logic
const CategoryCard = ({ cat, isSelected, onClick }) => {
  const IconComponent = cat.icon;
  return (
    <motion.div
      className={`category-card-wrapper ${isSelected ? 'selected' : ''}`}
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      onClick={onClick}
    >
      <div
        className="category-card"
        style={{
          '--cat-color': cat.color,
          '--cat-bg': cat.bg,
          '--cat-border': cat.border,
          '--cat-selected-bg': cat.selectedBg,
          '--cat-glow': cat.glow
        }}
      >
        <div className="category-icon-box">
          <IconComponent size={18} strokeWidth={2.5} />
        </div>
        <span className="category-card-title">
          {cat.label}
        </span>
      </div>
    </motion.div>
  );
};

const parseEventDateRange = (dateStr, year = 2026) => {
  const monthMap = {
    "jan": 0, "feb": 1, "mar": 2, "apr": 3, "may": 4, "jun": 5,
    "jul": 6, "aug": 7, "sep": 8, "oct": 9, "nov": 10, "dec": 11,
    "january": 0, "february": 1, "march": 2, "april": 3, "may": 4, "june": 5,
    "july": 6, "august": 7, "september": 8, "october": 9, "november": 10, "december": 11
  };

  if (dateStr.includes(" - ")) {
    const parts = dateStr.split(" - ");
    const startPart = parts[0].trim();
    const endPart = parts[1].trim();

    const startMatch = startPart.match(/(\d+)\s+([A-Za-z]+)/);
    const endMatch = endPart.match(/(\d+)\s+([A-Za-z]+)/);

    if (startMatch && endMatch) {
      const startDay = parseInt(startMatch[1], 10);
      const startMonth = monthMap[startMatch[2].toLowerCase()] ?? 4;
      const endDay = parseInt(endMatch[1], 10);
      const endMonth = monthMap[endMatch[2].toLowerCase()] ?? startMonth;

      return {
        start: new Date(year, startMonth, startDay),
        end: new Date(year, endMonth, endDay)
      };
    }
  } else {
    const match = dateStr.match(/(\d+)\s+([A-Za-z]+)/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = monthMap[match[2].toLowerCase()] ?? 4;
      const date = new Date(year, month, day);
      return { start: date, end: date };
    }
  }
  return null;
};

const isEventInDateRange = (eventDateStr, selectedStart, selectedEnd) => {
  if (!selectedStart) return true;

  const year = selectedStart.getFullYear();
  const parsed = parseEventDateRange(eventDateStr, year);
  if (!parsed) return false;

  const eventStart = new Date(parsed.start.getFullYear(), parsed.start.getMonth(), parsed.start.getDate()).getTime();
  const eventEnd = new Date(parsed.end.getFullYear(), parsed.end.getMonth(), parsed.end.getDate()).getTime();

  const selStart = new Date(selectedStart.getFullYear(), selectedStart.getMonth(), selectedStart.getDate()).getTime();
  const selEnd = selectedEnd
    ? new Date(selectedEnd.getFullYear(), selectedEnd.getMonth(), selectedEnd.getDate()).getTime()
    : null;

  if (selEnd) {
    return (eventStart <= selEnd && eventEnd >= selStart);
  } else {
    // If only start date is selected, show all events from that day onwards
    return (eventEnd >= selStart);
  }
};

const formatDateShort = (date) => {
  if (!date) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${date.getDate()} ${months[date.getMonth()]}`;
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km
  return distance;
};

const Events = () => {
  useEffect(() => {
    try {
      logEvent(analytics, 'view_landing_page', {
        page_name: 'web-landing-page',
        platform: 'web',
        enter_timestamp: new Date().toISOString()
      });
    } catch (analyticsErr) {
      console.warn("Failed to log view_landing_page event to Firebase Analytics:", analyticsErr);
    }
  }, []);

  const handleEventClick = (event) => {
    try {
      const leadSource = getActiveLeadSource(event.id);
      logEvent(analytics, 'landing_page_event_click', {
        page_name: 'web-landing-page',
        event_id: event.id,
        event_name: event.title || event.eventName || 'Untitled Event',
        category_name: event.category || 'Other',
        platform: 'web',
        ...(leadSource ? { lead_source: leadSource } : {})
      });
    } catch (analyticsErr) {
      console.warn("Failed to log event analytics:", analyticsErr);
    }
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [isNearbyFilterActive, setIsNearbyFilterActive] = useState(false);
  const [userLocation, setUserLocation] = useState(() => {
    const cached = sessionStorage.getItem('blithe_user_location');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [isFetchingApprox, setIsFetchingApprox] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const foundIndex = CALENDAR_MONTHS.findIndex(
      m => m.monthIndex === currentMonth && m.year === currentYear
    );
    return foundIndex !== -1 ? foundIndex : 0;
  }); // dynamically defaults to current month if present, otherwise 0 (May)
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [exploreCategories, setExploreCategories] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [visibleCount, setVisibleCount] = useState(12);

  const calendarRef = useRef(null);
  const searchSectionRef = useRef(null);
  const sentinelRef = useRef(null);

  // Scroll search bar to top when user starts typing
  useEffect(() => {
    if (searchQuery.trim() !== "") {
      const element = searchSectionRef.current;
      if (element) {
        const yOffset = -90; // sticky navbar offset + spacing
        const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }
  }, [searchQuery]);

  const dispatch = useDispatch();
  const { events: rawEvents, categories: rawCategories, loading: reduxLoading, error: reduxError } = useSelector(state => state.events);

  useEffect(() => {
    dispatch(fetchEventsThunk());
    dispatch(fetchCategoriesThunk());
  }, [dispatch]);

  useEffect(() => {
    setLoading(reduxLoading);
  }, [reduxLoading]);

  useEffect(() => {
    if (reduxError) {
      setError(reduxError);
    }
  }, [reduxError]);

  useEffect(() => {
    if (!rawCategories || rawCategories.length === 0) return;

    const fetchedCats = rawCategories.map((cat, index) => {
      const name = cat.categoryName || cat.name || cat.title || "Category";
      const nameLower = name.toLowerCase();

      let styleMatch;
      if (nameLower.includes("music") || nameLower.includes("gig") || nameLower.includes("concert")) styleMatch = CATEGORY_STYLES.find(s => s.label === "Music");
      else if (nameLower.includes("party") || nameLower.includes("night") || nameLower.includes("club")) styleMatch = CATEGORY_STYLES.find(s => s.label === "Nightlife");
      else if (nameLower.includes("comedy") || nameLower.includes("standup")) styleMatch = CATEGORY_STYLES.find(s => s.label === "Comedy");
      else if (nameLower.includes("sport") || nameLower.includes("game") || nameLower.includes("match")) styleMatch = CATEGORY_STYLES.find(s => s.label === "Sports");
      else if (nameLower.includes("food") || nameLower.includes("beverage") || nameLower.includes("drink")) styleMatch = CATEGORY_STYLES.find(s => s.label === "Food & Drinks");
      else if (nameLower.includes("tech") || nameLower.includes("business") || nameLower.includes("workshop") || nameLower.includes("exhibition")) styleMatch = CATEGORY_STYLES.find(s => s.label === "Conferences");
      else if (nameLower.includes("movie") || nameLower.includes("film") || nameLower.includes("screen") || nameLower.includes("theatre")) styleMatch = CATEGORY_STYLES.find(s => s.label === "Screenings");
      else if (nameLower.includes("fitness") || nameLower.includes("health") || nameLower.includes("wellness")) styleMatch = CATEGORY_STYLES.find(s => s.label === "Fitness");
      else if (nameLower.includes("art") || nameLower.includes("craft") || nameLower.includes("paint")) styleMatch = CATEGORY_STYLES.find(s => s.label === "Social Mixers");
      else if (nameLower.includes("dance") || nameLower.includes("perform")) styleMatch = CATEGORY_STYLES.find(s => s.label === "Performances");
      else if (nameLower.includes("travel") || nameLower.includes("adventure") || nameLower.includes("farm") || nameLower.includes("camp")) styleMatch = CATEGORY_STYLES.find(s => s.label === "Fests & Fairs");
      else styleMatch = CATEGORY_STYLES.find(s => nameLower.includes(s.label.toLowerCase()) || s.label.toLowerCase().includes(nameLower));

      const style = styleMatch || CATEGORY_STYLES[index % CATEGORY_STYLES.length];

      return {
        id: cat.id,
        name: name,
        label: name,
        icon: style.icon,
        color: style.color,
        bg: style.bg,
        border: style.border,
        selectedBg: style.selectedBg,
        glow: style.glow
      };
    });
    setExploreCategories(fetchedCats);
  }, [rawCategories]);

  useEffect(() => {
    if (!rawEvents || rawEvents.length === 0) {
      if (!reduxLoading && rawEvents.length === 0) {
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
          const endD = toDateObj(data.eventEndDate);
          const isNotExpired = endD ? endD >= new Date() : true;
          const hasNoPaymentUrl = !data.paymentUrl || data.paymentUrl.trim() === "";
          return isNotBlocked && isNotExpired && hasNoPaymentUrl;
        })
        .map(data => {
          // Format date and time
          const startDateObj = data.eventStartDate ? toDateObj(data.eventStartDate) : new Date();
          const endDateObj = data.eventEndDate ? toDateObj(data.eventEndDate) : null;

          const formattedStartDate = startDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
          let formattedDate = formattedStartDate;
          const formattedTime = startDateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

          if (endDateObj) {
            const formattedEndDate = endDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
            if (formattedStartDate !== formattedEndDate) {
              formattedDate = `${formattedStartDate} - ${formattedEndDate}`;
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

          // Determine sold out status
          const hasTickets = data.tickets && data.tickets.length > 0;
          let isSoldOut = data.soldOut === true;
          if (!isSoldOut && hasTickets) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const hasAvailableTicket = data.tickets.some(t => {
              const isStatusActive = t.status !== false;
              const hasSlots = t.remainingSlots > 0;

              let isNotExpired = true;
              if (t.endDate) {
                const ticketEndDate = t.endDate.seconds ? toDateObj(t.endDate) : new Date(t.endDate);
                const tDate = new Date(ticketEndDate);
                tDate.setHours(0, 0, 0, 0);
                if (tDate < today) {
                  isNotExpired = false;
                }
              }
              return isStatusActive && hasSlots && isNotExpired;
            });
            isSoldOut = !hasAvailableTicket;
          }

          const featuredEndD = toDateObj(data.featuredEndDate);
          const isPromoted = data.featured === true && featuredEndD && featuredEndD >= new Date();

          const eLat = parseFloat(data.lat || data.latitude);
          const eLng = parseFloat(data.long || data.lng || data.longitude);
          let distance = null;
          if (userLocation && !isNaN(eLat) && !isNaN(eLng)) {
            distance = calculateDistance(userLocation.lat, userLocation.lng, eLat, eLng);
          }

          return {
            id: data.id,
            title: data.eventName || "Untitled Event",
            image: (data.image && data.image.length > 0) ? data.image[0] : "",
            date: formattedDate,
            time: formattedTime,
            location: data.location || data.venue || "TBA",
            price: displayPrice,
            category: data.category || "Other",
            promoted: isPromoted,
            hashtags: processTags(data.tags),
            priceMessage: data.priceMessage || "",
            isSoldOut: isSoldOut,
            distance: distance,
            raw: data
          };
        });

      // Sort events chronologically (earlier calendar date first), then by proximity (distance)
      eventsData.sort((a, b) => {
        const dateA = a.raw.eventStartDate ? (typeof a.raw.eventStartDate.toDate === 'function' ? a.raw.eventStartDate.toDate() : new Date(a.raw.eventStartDate)) : new Date(0);
        const dateB = b.raw.eventStartDate ? (typeof b.raw.eventStartDate.toDate === 'function' ? b.raw.eventStartDate.toDate() : new Date(b.raw.eventStartDate)) : new Date(0);

        const dayA = dateA instanceof Date && !isNaN(dateA)
          ? new Date(dateA.getFullYear(), dateA.getMonth(), dateA.getDate()).getTime()
          : 0;
        const dayB = dateB instanceof Date && !isNaN(dateB)
          ? new Date(dateB.getFullYear(), dateB.getMonth(), dateB.getDate()).getTime()
          : 0;

        if (dayA !== dayB) {
          return dayA - dayB;
        }

        // Same calendar day: sort by distance ascending
        const distA = a.distance;
        const distB = b.distance;

        if (distA !== null && distA !== undefined && distB !== null && distB !== undefined) {
          if (distA !== distB) {
            return distA - distB;
          }
        } else if (distA !== null && distA !== undefined) {
          return -1; // a has distance, b does not, so a comes first
        } else if (distB !== null && distB !== undefined) {
          return 1;  // b has distance, a does not, so b comes first
        }

        // Fallback/Tie-breaker: chronological order of the time
        return dateA - dateB;
      });

      setEvents(eventsData);
    } catch (err) {
      console.error("Error processing events in Redux cache: ", err);
    }
  }, [rawEvents, reduxLoading, userLocation]);

  // Request location on mount — triggers browser permission popup after a 5s delay
  useEffect(() => {
    const cached = sessionStorage.getItem('blithe_user_location');
    if (cached) {
      try {
        setUserLocation(JSON.parse(cached));
      } catch (e) { }
      return; // Already have cached location, do not auto-request again
    }

    if (sessionStorage.getItem('blithe_user_location_declined') === 'true') {
      return; // User previously declined, do not auto-request again
    }

    if (!navigator.geolocation) return;

    const timer = setTimeout(() => {
      // Re-verify that location wasn't set or declined while waiting
      if (sessionStorage.getItem('blithe_user_location') || sessionStorage.getItem('blithe_user_location_declined') === 'true') {
        return;
      }

      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const loc = { lat: latitude, lng: longitude, type: 'precise' };
          setUserLocation(loc);
          sessionStorage.setItem('blithe_user_location', JSON.stringify(loc));
          sessionStorage.removeItem('blithe_user_location_declined');
          setIsLocating(false);
        },
        (error) => {
          // User denied or error — fail silently, nearby filter will handle it
          setIsLocating(false);
          if (error && error.code === 1) { // PERMISSION_DENIED
            sessionStorage.setItem('blithe_user_location_declined', 'true');
          }
        },
        { maximumAge: 60000, timeout: 10000, enableHighAccuracy: false }
      );
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  // Close calendar dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setIsCalendarOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Filter promoted events for the carousel
  const promotedEvents = events.filter(e => e.promoted);

  // New absolute indexing logic for infinite smooth carousel
  const [absoluteIndex, setAbsoluteIndex] = useState(0);

  const handlePrevClick = (e) => {
    if (e) e.stopPropagation();
    setDirection(-1);
    setAbsoluteIndex(prev => prev - 1);
  };

  const handleNextClick = (e) => {
    if (e) e.stopPropagation();
    setDirection(1);
    setAbsoluteIndex(prev => prev + 1);
  };

  const handleDotClick = (idx) => {
    const total = promotedEvents.length;
    if (total === 0) return;
    const currentMod = ((absoluteIndex % total) + total) % total;
    let diff = idx - currentMod;

    if (diff > total / 2) diff -= total;
    if (diff < -total / 2) diff += total;

    setDirection(diff > 0 ? 1 : -1);
    setAbsoluteIndex(prev => prev + diff);
  };

  // Auto-play functionality
  useEffect(() => {
    if (promotedEvents.length === 0 || isHovered) return;
    const timer = setInterval(() => {
      setDirection(1);
      setAbsoluteIndex(prev => prev + 1);
    }, 2500);
    return () => clearInterval(timer);
  }, [promotedEvents.length, isHovered, absoluteIndex]);

  // Unified Toggle Category Logic
  const toggleCategory = (catName) => {
    setSearchQuery(prev => {
      let currentQueries = prev.split(/,\s*/).filter(q => q.trim() !== "");
      if (currentQueries.some(q => q.toLowerCase() === catName.toLowerCase())) {
        currentQueries = currentQueries.filter(q => q.toLowerCase() !== catName.toLowerCase());
      } else {
        currentQueries.push(catName);
      }
      return currentQueries.join(", ");
    });
  };

  const isCategorySelected = (catName) => {
    const queries = searchQuery.split(/,\s*/).filter(q => q.trim() !== "");
    return queries.some(q => q.toLowerCase() === catName.toLowerCase());
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchQuery("");
    setStartDate(null);
    setEndDate(null);
    setIsNearbyFilterActive(false);
  };

  const getWeekendDates = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday

    let start = new Date(today);
    let end = new Date(today);

    if (dayOfWeek === 5) {
      // Friday
      start.setDate(today.getDate());
      end.setDate(today.getDate() + 2);
    } else if (dayOfWeek === 6) {
      // Saturday
      start.setDate(today.getDate());
      end.setDate(today.getDate() + 1);
    } else if (dayOfWeek === 0) {
      // Sunday
      start.setDate(today.getDate());
      end.setDate(today.getDate());
    } else {
      // Monday to Thursday
      const daysToFriday = 5 - dayOfWeek;
      start.setDate(today.getDate() + daysToFriday);
      end.setDate(today.getDate() + daysToFriday + 2);
    }

    return { start, end };
  };

  // Quick select date ranges
  const handleQuickDateSelect = (pill) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (pill === "Today") {
      if (startDate && !endDate && startDate.getTime() === today.getTime()) {
        setStartDate(null);
        setEndDate(null);
      } else if (startDate && endDate && startDate.getTime() === today.getTime() && endDate.getTime() === today.getTime()) {
        setStartDate(null);
        setEndDate(null);
      } else {
        setStartDate(today);
        setEndDate(today);
      }
    } else if (pill === "Tomorrow") {
      if (startDate && !endDate && startDate.getTime() === tomorrow.getTime()) {
        setStartDate(null);
        setEndDate(null);
      } else if (startDate && endDate && startDate.getTime() === tomorrow.getTime() && endDate.getTime() === tomorrow.getTime()) {
        setStartDate(null);
        setEndDate(null);
      } else {
        setStartDate(tomorrow);
        setEndDate(tomorrow);
      }
    } else if (pill === "This Weekend") {
      const { start, end } = getWeekendDates();
      if (startDate && endDate && startDate.getTime() === start.getTime() && endDate.getTime() === end.getTime()) {
        setStartDate(null);
        setEndDate(null);
      } else {
        setStartDate(start);
        setEndDate(end);
      }
    }
  };

  const isPillActive = (pill) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (!startDate) return false;

    if (pill === "Today") {
      return startDate.getTime() === today.getTime() && (!endDate || endDate.getTime() === today.getTime());
    }
    if (pill === "Tomorrow") {
      return startDate.getTime() === tomorrow.getTime() && (!endDate || endDate.getTime() === tomorrow.getTime());
    }
    if (pill === "This Weekend") {
      const { start, end } = getWeekendDates();
      return endDate && startDate.getTime() === start.getTime() && endDate.getTime() === end.getTime();
    }
    return false;
  };

  const handleCalendarDayClick = (date) => {
    if (!startDate || (startDate && endDate)) {
      setStartDate(date);
      setEndDate(null);
    } else {
      if (date < startDate) {
        setStartDate(date);
        setEndDate(null);
      } else {
        setEndDate(date);
        setIsCalendarOpen(false); // Auto close dropdown on selection of full range
      }
    }
  };

  // Filter events based on selections
  const filteredEvents = events.filter(event => {
    // 1. Unified Search & Category Filter (OR logic for multiple terms)
    if (searchQuery.trim() !== "") {
      const queries = searchQuery.toLowerCase().split(/,\s*/).filter(q => q.trim() !== "");

      const isMatch = queries.some(queryClean => {
        const q = queryClean.startsWith('#') ? queryClean.slice(1) : queryClean;

        const matchHashtag = event.hashtags && event.hashtags.some(tag => {
          const tagClean = tag.toLowerCase().replace('#', '');
          return tagClean.includes(q);
        });

        const matchTitle = event.title.toLowerCase().includes(q);
        const matchLoc = event.location.toLowerCase().includes(q);
        const matchCat = event.category.toLowerCase().includes(q);

        return matchHashtag || matchTitle || matchLoc || matchCat;
      });

      if (!isMatch) return false;
    }

    // 2. Custom Date Range Picker Filter
    if (startDate) {
      if (!isEventInDateRange(event.date, startDate, endDate)) return false;
    }

    // 4. Nearby Filter
    if (isNearbyFilterActive && userLocation) {
      const eLat = parseFloat(event.raw.lat || event.raw.latitude);
      const eLng = parseFloat(event.raw.long || event.raw.lng || event.raw.longitude);

      if (isNaN(eLat) || isNaN(eLng)) return false;

      const distance = calculateDistance(userLocation.lat, userLocation.lng, eLat, eLng);
      if (distance === null || distance > 5) return false;
    }

    return true;
  });

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(12);
  }, [searchQuery, startDate, endDate, isNearbyFilterActive]);

  // Infinite scroll listener using IntersectionObserver with scroll fallback
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      const handleScroll = () => {
        const scrollTop = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop;
        const windowHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
        const documentHeight = document.documentElement.scrollHeight || document.body.scrollHeight;

        // If user scrolls within 500px of the bottom of the page
        if (windowHeight + scrollTop >= documentHeight - 500) {
          setVisibleCount(prev => prev + 12);
        }
      };
      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => window.removeEventListener('scroll', handleScroll);
    }

    const currentSentinel = sentinelRef.current;
    if (!currentSentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => prev + 12);
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(currentSentinel);

    return () => {
      observer.unobserve(currentSentinel);
    };
  }, [visibleCount, filteredEvents.length]);

  const handleNearbyClick = () => {
    if (isNearbyFilterActive) {
      setIsNearbyFilterActive(false);
      setLocationError(null);
      return;
    }

    if (userLocation) {
      setIsNearbyFilterActive(true);
    } else {
      setIsLocating(true);
    }
    setLocationError(null);

    if (!navigator.geolocation) {
      if (!userLocation) handleIPFallback();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const loc = { lat: latitude, lng: longitude, type: 'precise' };
        setUserLocation(loc);
        sessionStorage.setItem('blithe_user_location', JSON.stringify(loc));
        sessionStorage.removeItem('blithe_user_location_declined');
        setIsNearbyFilterActive(true);
        setIsLocating(false);
      },
      (error) => {
        console.warn("Precise geolocation failed/denied, falling back to IP-based location...", error);
        if (error && error.code === 1) {
          sessionStorage.setItem('blithe_user_location_declined', 'true');
        }
        if (!userLocation) {
          handleIPFallback();
        } else {
          setIsLocating(false);
        }
      },
      { maximumAge: 60000, timeout: 5000, enableHighAccuracy: false }
    );
  };

  const handleIPFallback = async () => {
    setIsLocating(true);
    try {
      const approxLoc = await fetchApproximateLocation();
      setUserLocation(approxLoc);
      sessionStorage.setItem('blithe_user_location', JSON.stringify(approxLoc));
      setIsNearbyFilterActive(true);
      setLocationError(null);
    } catch (err) {
      console.error("IP fallback fetch failed", err);
      setLocationError("Could not retrieve location.");
      setShowLocationModal(true);
    } finally {
      setIsLocating(false);
    }
  };

  const handleUseApproxLocation = async () => {
    setIsFetchingApprox(true);
    try {
      const approxLoc = await fetchApproximateLocation();
      setUserLocation(approxLoc);
      sessionStorage.setItem('blithe_user_location', JSON.stringify(approxLoc));
      setIsNearbyFilterActive(true);
      setLocationError(null);
      setShowLocationModal(false);
    } catch (err) {
      console.error("IP fallback fetch failed in modal", err);
      setLocationError("Could not retrieve approximate location.");
    } finally {
      setIsFetchingApprox(false);
    }
  };

  const renderCalendarDays = () => {
    const monthData = CALENDAR_MONTHS[currentMonthIndex];
    const blankDays = Array(monthData.startDayOfWeek).fill(null);
    const monthDays = Array.from({ length: monthData.daysInMonth }, (_, i) => i + 1);
    const allDays = [...blankDays, ...monthDays];

    return allDays.map((day, index) => {
      if (day === null) {
        return <div key={`empty-${index}`} className="calendar-day empty"></div>;
      }

      const date = new Date(monthData.year, monthData.monthIndex, day);
      const isSelectedStart = startDate && date.getTime() === startDate.getTime();
      const isSelectedEnd = endDate && date.getTime() === endDate.getTime();
      const isInRange = startDate && endDate && date > startDate && date < endDate;

      let dayClass = "calendar-day";
      if (isSelectedStart) dayClass += " selected-start";
      if (isSelectedEnd) dayClass += " selected-end";
      if (isInRange) dayClass += " in-range";

      return (
        <button
          type="button"
          key={`day-${day}`}
          className={dayClass}
          onClick={() => handleCalendarDayClick(date)}
        >
          {day}
        </button>
      );
    });
  };

  const activeFeaturedEvent = promotedEvents[carouselIndex];

  return (
    <div className="events-page">
      {loading ? (
        <div className="loading-container" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '60vh', gap: '1.5rem' }}>
          <motion.img
            src={logo}
            alt="Loading..."
            style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 10px 25px rgba(124, 58, 237, 0.2)' }}
            animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
          <h2 style={{ color: '#7C3AED', fontWeight: 'bold', fontSize: '1.25rem' }}>Loading blithe events...</h2>
        </div>
      ) : error ? (
        <div className="error-container" style={{ padding: '5rem', textAlign: 'center' }}>
          <h2 style={{ color: '#EF4444', marginBottom: '1rem' }}>Failed to load events</h2>
          <p style={{ color: '#fff', backgroundColor: 'rgba(239, 68, 68, 0.2)', padding: '1rem', borderRadius: '0.5rem', display: 'inline-block' }}>
            {error}
          </p>
          <p style={{ marginTop: '1rem', color: '#9CA3AF' }}>Check your Firebase Security Rules or internet connection.</p>
        </div>
      ) : (
        <>
          {/* Featured Event Hero Section */}
          {activeFeaturedEvent && (() => {
            const maxVisible = 1;
            const peekPercent = 5;
            const totalPeek = (maxVisible - 1) * peekPercent;
            const activeWidth = maxVisible === 1 ? '100%' : `${100 / (1 + totalPeek / 100)}%`;
            const borderRadius = '0';

            const visibleItems = Array.from({ length: maxVisible }).map((_, i) => {
              const absIdx = absoluteIndex + i;
              const total = promotedEvents.length;
              const eventIdx = ((absIdx % total) + total) % total;
              return {
                event: promotedEvents[eventIdx],
                absIdx,
                index: i
              };
            });

            return (
              <section
                className="hero-carousel-section"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                <div className="hero-card-stack">
                  <AnimatePresence initial={false} custom={direction}>
                    {visibleItems.map(({ event, absIdx, index }) => {
                      const cardVariants = {
                        enter: (dir) => {
                          if (index === 0) {
                            return { x: dir === 1 ? "100%" : "-100%", scale: 1, zIndex: 11, opacity: 1 };
                          }
                          const currentOffset = index * peekPercent;
                          const currentScale = 1 - (index * 0.05);
                          const currentZIndex = 10 - index;
                          return {
                            x: dir === 1 ? `${currentOffset + peekPercent}%` : `${currentOffset - peekPercent}%`,
                            scale: dir === 1 ? currentScale - 0.05 : currentScale + 0.05,
                            zIndex: currentZIndex - 1,
                            opacity: 0
                          };
                        },
                        animate: () => {
                          const currentOffset = index * peekPercent;
                          const currentScale = 1 - (index * 0.05);
                          const currentZIndex = 10 - index;
                          return {
                            x: `${currentOffset}%`,
                            scale: currentScale,
                            zIndex: currentZIndex,
                            opacity: 1
                          };
                        },
                        exit: (dir) => {
                          if (index === 0) {
                            return { x: dir === 1 ? "-100%" : "100%", scale: 1, zIndex: 11, opacity: 1 };
                          }
                          const currentOffset = index * peekPercent;
                          const currentScale = 1 - (index * 0.05);
                          const currentZIndex = 10 - index;
                          return {
                            x: dir === 1 ? `${currentOffset - peekPercent}%` : `${currentOffset + peekPercent}%`,
                            scale: dir === 1 ? currentScale + 0.05 : currentScale - 0.05,
                            zIndex: currentZIndex,
                            opacity: 0
                          };
                        }
                      };

                      return (
                        <motion.div
                          key={index === 0 ? `active-${event.id}-${absIdx}` : `stacked-${event.id}-${absIdx}`}
                          custom={direction}
                          variants={cardVariants}
                          initial="enter"
                          animate="animate"
                          exit="exit"
                          transition={{ duration: 1.5, ease: [0.32, 0.72, 0, 1] }}
                          className={`hero-event-card ${index === 0 ? 'active' : ''}`}
                          style={{ width: activeWidth, borderRadius, transformOrigin: 'right center' }}
                          onClick={() => {
                            if (index > 0) handleNextClick();
                          }}
                        >
                          <div className="card-bg-layer" style={{ backgroundImage: `url(${event.image})` }}>
                            <div className="card-gradient-overlay" />
                          </div>

                          <div className={`card-content-layout ${index !== 0 ? 'hidden-content' : ''}`}>
                            <div className="card-text-side">
                              <div className="hero-meta-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                                <span className="hero-badge-modern">Featured</span>

                              </div>
                              <h1 className="hero-title">{event.title}</h1>

                              <div className="hero-meta-items">
                                <div className="hero-meta-item">
                                  <MapPin size={18} className="meta-icon" />
                                  <span>{event.location}</span>
                                </div>

                              </div>
                              <div className="hero-date-time">
                                <Calendar size={18} className="orange-icon" />
                                <span>{event.date}</span>
                              </div>
                              <p className="hero-price">{event.price}</p>

                              <div className={`hero-actions ${index !== 0 ? 'disabled' : ''}`}>
                                <Link to={`/events/${event.id}`} onClick={e => {
                                  if (index !== 0) {
                                    e.preventDefault();
                                  } else {
                                    handleEventClick(event);
                                  }
                                }} className="hero-cta-btn" style={event.isSoldOut ? { backgroundColor: '#4B5563' } : {}}>
                                  {event.isSoldOut ? 'Sold Out' : 'Book Now'}
                                </Link>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  <div className="hero-card-controls-wrapper">
                    <div className="hero-card-controls">
                      <button className="card-nav-btn prev-btn" onClick={handlePrevClick} aria-label="Previous Slide"><ChevronLeft size={24} /></button>
                      <div className="hero-carousel-indicators">
                        {promotedEvents.map((event, idx) => (
                          <button
                            key={event.id}
                            onClick={(e) => { e.stopPropagation(); handleDotClick(idx); }}
                            className={`indicator-dot ${idx === (((absoluteIndex % promotedEvents.length) + promotedEvents.length) % promotedEvents.length) ? 'active' : ''}`}
                            aria-label={`Go to event ${idx + 1}`}
                          />
                        ))}
                      </div>
                      <button className="card-nav-btn next-btn" onClick={handleNextClick} aria-label="Next Slide"><ChevronRight size={24} /></button>
                    </div>
                  </div>
                </div>
              </section>
            );
          })()}

          <div className={`event-card-main-container ${!activeFeaturedEvent ? 'no-banner' : ''}`}>
            {/* Search Bar Section */}
            <section ref={searchSectionRef} className="search-section" style={{ paddingTop: !activeFeaturedEvent ? '20px' : '0' }}>
              <div className="search-bar-wrapper glass">
                <span className="hashtag-prefix">#</span>
                <input
                  type="text"
                  placeholder="Search trending hashtags, music, standup..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button className="clear-search-btn" onClick={() => setSearchQuery("")}>
                    <X size={18} />
                  </button>
                )}
              </div>
            </section>

            {/* Explore Events Section */}
            <section className="explore-section">
              {/* PC Grid Layout (flex wrap) */}
              <div className={`category-grid-pc-wrapper ${isCategoriesExpanded ? 'expanded' : ''}`}>
                <div className="category-grid-pc">
                  {exploreCategories
                    .slice()
                    .sort((a, b) => {
                      const aSel = isCategorySelected(a.name) ? 1 : 0;
                      const bSel = isCategorySelected(b.name) ? 1 : 0;
                      return bSel - aSel;
                    })
                    .map((cat, i) => (
                      <CategoryCard
                        key={i}
                        cat={cat}
                        isSelected={isCategorySelected(cat.name)}
                        onClick={() => toggleCategory(cat.name)}
                      />
                    ))}
                </div>

                <button
                  type="button"
                  className={`category-toggle-arrow-btn ${isCategoriesExpanded ? 'expanded' : ''}`}
                  onClick={() => setIsCategoriesExpanded(!isCategoriesExpanded)}
                  aria-label={isCategoriesExpanded ? "Show Less" : "Show More"}
                >
                  <ChevronDown size={20} className="chevron-icon" />
                </button>
              </div>

              {/* Mobile Swipeable Slider Layout */}
              <div className="category-slider-mobile">
                <div className="category-slider">
                  {exploreCategories
                    .slice()
                    .sort((a, b) => {
                      const aSel = isCategorySelected(a.name) ? 1 : 0;
                      const bSel = isCategorySelected(b.name) ? 1 : 0;
                      return bSel - aSel;
                    })
                    .map((cat, i) => (
                      <CategoryCard
                        key={i}
                        cat={cat}
                        isSelected={isCategorySelected(cat.name)}
                        onClick={() => toggleCategory(cat.name)}
                      />
                    ))}
                </div>
              </div>
            </section>

            {/* All Events Section */}
            <section className="all-events-section">

              {/* Interactive Filter Pills Bar */}
              <div className="filters-bar">
                {/* Custom Date Range Picker Container */}
                <div
                  className="date-picker-container"
                  ref={calendarRef}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className={`filter-btn-toggle date-range-picker-btn ${isCalendarOpen ? 'active' : ''} ${startDate ? 'has-date' : ''}`}
                    onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                  >
                    <Calendar size={16} />
                    <span>
                      {startDate ? (
                        `${formatDateShort(startDate)}${endDate ? ` - ${formatDateShort(endDate)}` : ''}`
                      ) : (
                        'Select Dates'
                      )}
                    </span>
                    <ChevronDown size={14} className={`chevron-icon ${isCalendarOpen ? 'rotated' : ''}`} />
                  </button>

                  {/* Custom Dropdown Calendar */}
                  {isCalendarOpen && (
                    <div className="calendar-dropdown-card glass">
                      <div className="calendar-header">
                        <button
                          type="button"
                          className="month-nav-btn"
                          onClick={() => setCurrentMonthIndex(prev => Math.max(0, prev - 1))}
                          disabled={currentMonthIndex === 0}
                          style={currentMonthIndex === 0 ? { opacity: 0.3, cursor: 'not-allowed', pointerEvents: 'none' } : {}}
                        >
                          <ChevronLeft size={18} />
                        </button>
                        <span className="month-year-label">
                          {CALENDAR_MONTHS[currentMonthIndex].name}
                        </span>
                        <button
                          type="button"
                          className="month-nav-btn"
                          onClick={() => setCurrentMonthIndex(prev => Math.min(CALENDAR_MONTHS.length - 1, prev + 1))}
                          disabled={currentMonthIndex === CALENDAR_MONTHS.length - 1}
                          style={currentMonthIndex === CALENDAR_MONTHS.length - 1 ? { opacity: 0.3, cursor: 'not-allowed', pointerEvents: 'none' } : {}}
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>

                      <div className="calendar-weekdays">
                        <span>Su</span>
                        <span>Mo</span>
                        <span>Tu</span>
                        <span>We</span>
                        <span>Th</span>
                        <span>Fr</span>
                        <span>Sa</span>
                      </div>

                      <div className="calendar-days-grid">
                        {renderCalendarDays()}
                      </div>

                      {(startDate || endDate) && (
                        <div className="calendar-footer">
                          <button
                            type="button"
                            className="calendar-reset-btn"
                            onClick={handleClearFilters}
                          >
                            Reset Range
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Quick Filtering Pills */}
                <div className="quick-filter-pills">
                  <button
                    type="button"
                    className={`filter-pill ${isPillActive('Today') ? 'active' : ''}`}
                    onClick={() => handleQuickDateSelect('Today')}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    className={`filter-pill ${isPillActive('Tomorrow') ? 'active' : ''}`}
                    onClick={() => handleQuickDateSelect('Tomorrow')}
                  >
                    Tomorrow
                  </button>
                  <button
                    type="button"
                    className={`filter-pill ${isPillActive('This Weekend') ? 'active' : ''}`}
                    onClick={() => handleQuickDateSelect('This Weekend')}
                  >
                    This Weekend
                  </button>
                  <button
                    type="button"
                    className={`filter-pill ${isNearbyFilterActive ? 'active' : ''}`}
                    onClick={handleNearbyClick}
                    disabled={isLocating}
                  >
                    {isLocating ? 'Locating...' : 'Nearby'}
                  </button>
                  {isNearbyFilterActive && userLocation?.type === 'approximate' && (
                    <button
                      type="button"
                      className="approx-info-indicator"
                      onClick={() => setShowLocationModal(true)}
                      title="Using approximate location. Click to enable precise GPS."
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#7C3AED',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: '4px',
                        marginLeft: '-4px',
                        transition: 'transform 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <Info size={16} />
                    </button>
                  )}
                  {locationError && <span className="location-error" style={{ color: 'red', fontSize: '0.8rem', marginLeft: '0.5rem' }}>{locationError}</span>}

                  {/* Clear Filters Indicator */}
                  {(searchQuery || startDate || endDate || isNearbyFilterActive) && (
                    <button
                      type="button"
                      className="clear-all-pill"
                      onClick={handleClearFilters}
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>

              {/* Events Portrait Grid */}
              <div className="events-main">

                {filteredEvents.length > 0 ? (
                  <>
                    <motion.div layout className="events-portrait-grid">
                      <AnimatePresence>
                        {filteredEvents.slice(0, visibleCount).map((event, index) => (
                          <motion.div
                            key={event.id}
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.3, delay: index * 0.03 }}
                            className="event-card-container"
                          >
                            <Link to={`/events/${event.id}`} onClick={() => handleEventClick(event)} className="portrait-event-card">
                              <div className="portrait-image-wrapper">
                                <img src={event.image} alt={event.title} loading="lazy" />
                                {event.promoted && (
                                  <span className="featured-badge-small">Featured</span>
                                )}
                                {event.isSoldOut && (
                                  <span className="sold-out-badge" style={{
                                    position: 'absolute',
                                    top: '12px',
                                    left: event.promoted ? '80px' : '12px',
                                    backgroundColor: '#EF4444',
                                    color: '#fff',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                    zIndex: 10
                                  }}>Sold Out</span>
                                )}
                              </div>

                              <div className="portrait-card-details">
                                <div className="portrait-card-date-row">
                                  <span className="portrait-card-date">
                                    {event.date}
                                  </span>
                                </div>
                                <h3 className="portrait-card-title">{event.title}</h3>
                                <div className="portrait-card-location-row">
                                  <p className="portrait-card-location">{event.location}</p>
                                  {event.distance !== null && event.distance !== undefined && (
                                    <span className="location-distance-tag">
                                      <MapPin size={12} className="distance-icon" />
                                      {event.distance < 1
                                        ? `${Math.round(event.distance * 1000)}m`
                                        : `${Math.round(event.distance)} km`}
                                    </span>
                                  )}
                                </div>
                                <p className="portrait-card-price" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                  <span>{event.price}</span>
                                  {event.priceMessage && <span className="price-message" style={{ color: '#EF4444', marginLeft: '6px', fontWeight: 600 }}>{event.priceMessage}</span>}
                                </p>
                              </div>
                            </Link>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </motion.div>
                    {filteredEvents.length > visibleCount && (
                      <div ref={sentinelRef} style={{ height: '10px', width: '100%', margin: '20px 0' }} />
                    )}
                  </>
                ) : (
                  <div className="no-events-container glass">
                    <h3>No events match your criteria</h3>
                    <p>Try searching for another keyword or clearing the active filters.</p>
                    <button className="reset-filters-btn" onClick={handleClearFilters}>
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>
        </>
      )}
      {showLocationModal && (
        <LocationPermissionModal
          onClose={() => setShowLocationModal(false)}
          onUseApproxLocation={handleUseApproxLocation}
          isFetchingApprox={isFetchingApprox}
        />
      )}
    </div>
  );
};

export default Events;