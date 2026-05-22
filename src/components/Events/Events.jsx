import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronDown, Calendar, MapPin, Clock, ArrowRight, Sparkles, Trophy, Music, Utensils, Tent, Film, Dumbbell, Presentation, Mic, Mic2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from '../../firebase';
import logo from '../../assets/logo.jpeg';
import './Events.scss';

const CATEGORY_STYLES = [
  { name: "Music Shows", label: "Music", icon: Music, gradient: "linear-gradient(135deg, #ffffff, #f3f4f6)", color: "#111827", glow: "rgba(17, 24, 39, 0.1)" },
  { name: "Nightlife", label: "Nightlife", icon: Sparkles, gradient: "linear-gradient(135deg, #ffffff, #f3f4f6)", color: "#111827", glow: "rgba(17, 24, 39, 0.1)" },
  { name: "Comedy Shows", label: "Comedy", icon: Mic, gradient: "linear-gradient(135deg, #ffffff, #f3f4f6)", color: "#111827", glow: "rgba(17, 24, 39, 0.1)" },
  { name: "Sports", label: "Sports", icon: Trophy, gradient: "linear-gradient(135deg, #ffffff, #f3f4f6)", color: "#111827", glow: "rgba(17, 24, 39, 0.1)" },
  { name: "Performances", label: "Performances", icon: Mic2, gradient: "linear-gradient(135deg, #ffffff, #f3f4f6)", color: "#111827", glow: "rgba(17, 24, 39, 0.1)" },
  { name: "Food & Drinks", label: "Food & Drinks", icon: Utensils, gradient: "linear-gradient(135deg, #ffffff, #f3f4f6)", color: "#111827", glow: "rgba(17, 24, 39, 0.1)" },
  { name: "Fests & Fairs", label: "Fests & Fairs", icon: Tent, gradient: "linear-gradient(135deg, #ffffff, #f3f4f6)", color: "#111827", glow: "rgba(17, 24, 39, 0.1)" },
  { name: "Social Mixers", label: "Social Mixers", icon: Sparkles, gradient: "linear-gradient(135deg, #ffffff, #f3f4f6)", color: "#111827", glow: "rgba(17, 24, 39, 0.1)" },
  { name: "Screenings", label: "Screenings", icon: Film, gradient: "linear-gradient(135deg, #ffffff, #f3f4f6)", color: "#111827", glow: "rgba(17, 24, 39, 0.1)" },
  { name: "Fitness", label: "Fitness", icon: Dumbbell, gradient: "linear-gradient(135deg, #ffffff, #f3f4f6)", color: "#111827", glow: "rgba(17, 24, 39, 0.1)" },
  { name: "Conferences", label: "Conferences", icon: Presentation, gradient: "linear-gradient(135deg, #ffffff, #f3f4f6)", color: "#111827", glow: "rgba(17, 24, 39, 0.1)" },
  { name: "Open Mics", label: "Open Mics", icon: Mic2, gradient: "linear-gradient(135deg, #ffffff, #f3f4f6)", color: "#111827", glow: "rgba(17, 24, 39, 0.1)" },
];

const CALENDAR_MONTHS = [
  {
    name: "May 2026",
    monthIndex: 4, // 0-indexed May
    year: 2026,
    daysInMonth: 31,
    startDayOfWeek: 5, // Starts on Friday
  },
  {
    name: "June 2026",
    monthIndex: 5, // 0-indexed June
    year: 2026,
    daysInMonth: 30,
    startDayOfWeek: 1, // Starts on Monday
  }
];

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
          background: cat.gradient,
          boxShadow: isSelected ? `0 15px 30px ${cat.glow}` : 'none',
          border: isSelected ? `2px solid ${cat.color}` : '1px solid rgba(255, 255, 255, 0.4)'
        }}
      >
        <div className="category-icon-box" style={{ color: cat.color }}>
          <IconComponent size={18} strokeWidth={2.5} />
        </div>
        <span className="category-card-title" style={{ color: cat.color }}>
          {cat.label}
        </span>
      </div>
    </motion.div>
  );
};

const parseEventDateRange = (dateStr) => {
  const year = 2026;
  const monthMap = { "may": 4, "jun": 5 };

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

  const parsed = parseEventDateRange(eventDateStr);
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
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [isNearbyFilterActive, setIsNearbyFilterActive] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0); // 0 = May, 1 = June
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [exploreCategories, setExploreCategories] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [visibleCount, setVisibleCount] = useState(12);

  const calendarRef = useRef(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const catQuery = query(collection(db, "eventCategories"), where("deleted", "==", false));
        const querySnapshot = await getDocs(catQuery);
        const fetchedCats = querySnapshot.docs.map((doc, index) => {
          const data = doc.data();
          const name = data.categoryName || data.name || data.title || "Category";
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
            id: doc.id,
            name: name,
            label: name,
            icon: style.icon,
            gradient: style.gradient,
            color: style.color,
            glow: style.glow
          };
        });
        setExploreCategories(fetchedCats);
      } catch (error) {
        console.error("Error fetching categories: ", error);
      }
    };
    fetchCategories();

    const fetchEvents = async () => {
      try {
        const eventsQuery = query(collection(db, "event"), where("deleted", "==", false));
        const querySnapshot = await getDocs(eventsQuery);

        // Map and filter out blocked or expired events
        const eventsData = querySnapshot.docs
          .filter(doc => {
            const data = doc.data();
            const isNotBlocked = data.block === false;
            const isNotExpired = data.eventEndDate ? data.eventEndDate.toDate() >= new Date() : true;
            const hasNoPaymentUrl = !data.paymentUrl || data.paymentUrl.trim() === "";
            return isNotBlocked && isNotExpired && hasNoPaymentUrl;
          })
          .map(doc => {
            const data = doc.data();

            // Format date and time
            const startDateObj = data.eventStartDate ? data.eventStartDate.toDate() : new Date();
            const endDateObj = data.eventEndDate ? data.eventEndDate.toDate() : null;

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

            return {
              id: doc.id,
              title: data.eventName || "Untitled Event",
              image: (data.image && data.image.length > 0) ? data.image[0] : "",
              date: formattedDate,
              time: formattedTime,
              location: data.location || data.venue || "TBA",
              price: displayPrice,
              category: data.category || "Other",
              promoted: data.featured === true && data.featuredEndDate && data.featuredEndDate.toDate() >= new Date(),
              hashtags: data.tags || [],
              raw: data
            };
          });
        setEvents(eventsData);
      } catch (error) {
        console.error("Error fetching events: ", error);
        setError(error.message || "An unknown error occurred while fetching events.");
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  // Silently fetch user location on mount ONLY if permission is already granted
  useEffect(() => {
    if (navigator.geolocation && navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        if (result.state === 'granted') {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { latitude, longitude } = position.coords;
              setUserLocation({ lat: latitude, lng: longitude });
            },
            () => {
              // Fail silently
            },
            { maximumAge: 60000, timeout: 5000, enableHighAccuracy: false }
          );
        }
      });
    }
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

  // Auto-play for the Featured Carousel (Decreased scroll time to 3.0 seconds)
  useEffect(() => {
    if (promotedEvents.length === 0 || isHovered) return;
    const interval = setInterval(() => {
      setDirection(1);
      setCarouselIndex(prevIndex => (prevIndex + 1) % promotedEvents.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [promotedEvents.length, isHovered]);

  // Handle manual carousel navigation
  const handleDotClick = (index) => {
    setDirection(index > carouselIndex ? 1 : -1);
    setCarouselIndex(index);
  };

  const handlePrevClick = (e) => {
    e.stopPropagation();
    // User requested Left Arrow -> animate to left
    setDirection(1);
    setCarouselIndex(prevIndex => (prevIndex - 1 + promotedEvents.length) % promotedEvents.length);
  };

  const handleNextClick = (e) => {
    e.stopPropagation();
    // User requested Right Arrow -> animate to right
    setDirection(-1);
    setCarouselIndex(prevIndex => (prevIndex + 1) % promotedEvents.length);
  };

  const carouselVariants = {
    enter: (direction) => ({
      x: direction > 0 ? 100 : -100,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction) => ({
      zIndex: 0,
      x: direction < 0 ? 100 : -100,
      opacity: 0
    })
  };

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

  // Quick select date ranges
  const handleQuickDateSelect = (pill) => {
    const today = new Date(2026, 4, 20);
    const tomorrow = new Date(2026, 4, 21);
    const weekendStart = new Date(2026, 4, 23);
    const weekendEnd = new Date(2026, 4, 24);

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
      if (startDate && endDate && startDate.getTime() === weekendStart.getTime() && endDate.getTime() === weekendEnd.getTime()) {
        setStartDate(null);
        setEndDate(null);
      } else {
        setStartDate(weekendStart);
        setEndDate(weekendEnd);
      }
    }
  };

  const isPillActive = (pill) => {
    const today = new Date(2026, 4, 20);
    const tomorrow = new Date(2026, 4, 21);
    const weekendStart = new Date(2026, 4, 23);
    const weekendEnd = new Date(2026, 4, 24);

    if (!startDate) return false;

    if (pill === "Today") {
      return startDate.getTime() === today.getTime() && (!endDate || endDate.getTime() === today.getTime());
    }
    if (pill === "Tomorrow") {
      return startDate.getTime() === tomorrow.getTime() && (!endDate || endDate.getTime() === tomorrow.getTime());
    }
    if (pill === "This Weekend") {
      return endDate && startDate.getTime() === weekendStart.getTime() && endDate.getTime() === weekendEnd.getTime();
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

  // Infinite scroll listener
  useEffect(() => {
    const handleScroll = () => {
      // If user scrolls within 500px of the bottom of the page
      if (window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 500) {
        setVisibleCount(prev => prev + 12);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNearbyClick = () => {
    if (isNearbyFilterActive) {
      setIsNearbyFilterActive(false);
      // We do NOT clear userLocation here, so we can re-use it instantly next time
      setLocationError(null);
      return;
    }

    if (userLocation) {
      // If we already prefetched it silently, activate immediately
      setIsNearbyFilterActive(true);
      return;
    }

    // Otherwise, we need to request it now
    setIsLocating(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported.");
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setIsNearbyFilterActive(true);
        setIsLocating(false);
      },
      (error) => {
        setLocationError("Permission denied or failed.");
        setIsLocating(false);
      },
      { maximumAge: 60000, timeout: 5000, enableHighAccuracy: false }
    );
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
          {activeFeaturedEvent && (
            <section
              className="hero-carousel-section"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              {/* Immersive Blurry Backdrop */}
              <div
                className="hero-backdrop"
                style={{ backgroundImage: `url(${activeFeaturedEvent.image})` }}
              />
              <div className="hero-overlay"></div>

              {/* Forward & Backward Navigation Buttons */}
              <button className="carousel-control-btn prev" onClick={handlePrevClick} aria-label="Previous Slide">
                <ChevronLeft size={32} />
              </button>
              <button className="carousel-control-btn next" onClick={handleNextClick} aria-label="Next Slide">
                <ChevronRight size={32} />
              </button>

              <div className="container hero-container">
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={activeFeaturedEvent.id}
                    custom={direction}
                    variants={carouselVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="hero-grid"
                  >
                    {/* Left: Content Area */}
                    <div className="hero-content-col">
                      <div className="hero-date-time">
                        <Calendar size={18} className="orange-icon" />
                        <span>{activeFeaturedEvent.date}</span>
                      </div>
                      <h1 className="hero-title">{activeFeaturedEvent.title}</h1>

                      <div className="hero-meta-items">
                        <div className="hero-meta-item">
                          <MapPin size={18} className="meta-icon" />
                          <span>{activeFeaturedEvent.location}</span>
                        </div>
                      </div>

                      <p className="hero-price">{activeFeaturedEvent.price}</p>

                      <Link to={`/events/${activeFeaturedEvent.id}`} className="hero-cta-btn">
                        Book tickets
                      </Link>
                    </div>

                    {/* Right: Premium Portrait Poster */}
                    <div className="hero-visual-col">
                      <div className="hero-poster-wrapper">
                        <img
                          src={activeFeaturedEvent.image}
                          alt={activeFeaturedEvent.title}
                          className="hero-portrait-poster"
                        />
                        {activeFeaturedEvent.promoted && (
                          <span className="hero-badge">Featured Event</span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Carousel Navigation Dots */}
                <div className="hero-carousel-indicators">
                  {promotedEvents.map((event, idx) => (
                    <button
                      key={event.id}
                      onClick={() => handleDotClick(idx)}
                      className={`indicator-dot ${idx === carouselIndex ? 'active' : ''}`}
                      aria-label={`Go to event ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>
            </section>
          )}

          <div className="container">
            {/* Search Bar Section */}
            <section className="search-section">
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
                  {exploreCategories.map((cat, i) => (
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
                  {exploreCategories.map((cat, i) => (
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
              <div className="all-events-header">
                <h2 className="section-title">All events</h2>
              </div>

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
                          onClick={() => setCurrentMonthIndex(prev => (prev === 1 ? 0 : 1))}
                        >
                          <ChevronLeft size={18} />
                        </button>
                        <span className="month-year-label">
                          {CALENDAR_MONTHS[currentMonthIndex].name}
                        </span>
                        <button
                          type="button"
                          className="month-nav-btn"
                          onClick={() => setCurrentMonthIndex(prev => (prev === 0 ? 1 : 0))}
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
                          <Link to={`/events/${event.id}`} className="portrait-event-card">
                            <div className="portrait-image-wrapper">
                              <img src={event.image} alt={event.title} loading="lazy" />
                            </div>

                            <div className="portrait-card-details">
                              <span className="portrait-card-date">
                                {event.date}
                              </span>
                              <h3 className="portrait-card-title">{event.title}</h3>
                              <p className="portrait-card-location">{event.location}</p>
                              <p className="portrait-card-price">{event.price}</p>
                            </div>
                          </Link>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </motion.div>
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
    </div>
  );
};

export default Events;