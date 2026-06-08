import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Clock, ArrowLeft, Share2, Info, Ticket, ChevronLeft, ChevronRight, ChevronDown, Navigation, AlertTriangle, Sparkles, X, Copy, Check, ExternalLink, Loader2, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
import { db } from '../../firebase';
import Button from '../Button/Button';
import logo from '../../assets/logo.jpeg';
import logoTransparent from '../../assets/logo-transparent.png';
import './EventDetails.scss';

// ─── Share Modal ─────────────────────────────────────────────────────────────
const ShareModal = ({ event, onClose }) => {
  const [copied, setCopied] = useState(false);
  const shareUrl = window.location.href;
  const shareText = `Check out "${event.title}" on Blithe!`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* fallback – nothing critical */
}
  };

  const socials = [
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      color: '#25D366',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      ),
      url: `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`,
    },
    {
      id: 'telegram',
      label: 'Telegram',
      color: '#229ED9',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
      ),
      url: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
    },
    {
      id: 'twitter',
      label: 'X (Twitter)',
      color: '#000000',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.213 5.567zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
    },
    {
      id: 'facebook',
      label: 'Facebook',
      color: '#1877F2',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      ),
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    },
    {
      id: 'linkedin',
      label: 'LinkedIn',
      color: '#0A66C2',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.23 0H1.77C.8 0 0 .77 0 1.72v20.56C0 23.23.8 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.72V1.72C24 .77 23.2 0 22.23 0zM7.12 20.45H3.56V9H7.12v11.45zM5.34 7.43c-1.14 0-2.06-.92-2.06-2.06 0-1.14.92-2.06 2.06-2.06 1.14 0 2.06.92 2.06 2.06 0 1.14-.92 2.06-2.06 2.06zm15.11 13.02h-3.56v-5.6c0-1.34-.03-3.05-1.86-3.05-1.86 0-2.14 1.45-2.14 2.95v5.7h-3.56V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29z" />
        </svg>
      ),
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    },
    {
      id: 'reddit',
      label: 'Reddit',
      color: '#FF4500',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 11.5c0-1.65-1.35-3-3-3-.96 0-1.86.48-2.42 1.24-1.64-1-3.85-1.64-6.29-1.72l1.35-4.24 3.71.79c.07.9.84 1.63 1.78 1.63 1 0 1.8-1 1.8-2s-.8-2-1.8-2c-.9 0-1.64.66-1.77 1.51l-4.14-.88c-.23-.05-.47.09-.53.33L9.33 8c-2.49.06-4.75.7-6.42 1.72C2.35 8.98 1.45 8.5 1 8.5c-1.65 0-3 1.35-3 3 0 1.12.63 2.1 1.56 2.62-.06.39-.09.79-.09 1.19 0 3.73 4.25 6.75 9.5 6.75s9.5-3.02 9.5-6.75c0-.4-.03-.8-.09-1.19.93-.52 1.56-1.5 1.56-2.62zm-18-1c.72 0 1.3.58 1.3 1.3s-.58 1.3-1.3 1.3-1.3-.58-1.3-1.3.58-1.3 1.3-1.3zm10.6 5.8c-.83.83-2.4 1.2-4.6 1.2s-3.77-.37-4.6-1.2c-.2-.2-.2-.52 0-.72s.52-.2.72 0c.64.64 1.94.92 3.88.92s3.24-.28 3.88-.92c.2-.2.52-.2.72 0s.2.52 0 .72zm-.4-3.5c.72 0 1.3.58 1.3 1.3s-.58 1.3-1.3 1.3-1.3-.58-1.3-1.3.58-1.3 1.3-1.3z" />
        </svg>
      ),
      url: `https://reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareText)}`,
    },
    {
      id: 'pinterest',
      label: 'Pinterest',
      color: '#E60023',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.906 2.17-2.906 1.023 0 1.517.769 1.517 1.686 0 1.02-.648 2.546-.98 3.958-.283 1.192.599 2.161 1.776 2.161 2.128 0 3.765-2.244 3.765-5.48 0-2.861-2.062-4.869-5.005-4.869-3.41 0-5.413 2.561-5.413 5.2 0 1.03.397 2.138.893 2.738.1.12.115.22.085.345-.09.375-.293 1.199-.334 1.363-.053.21-.174.254-.402.149-1.498-.697-2.435-2.887-2.435-4.647 0-3.785 2.75-7.261 7.929-7.261 4.164 0 7.397 2.965 7.397 6.93 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.748-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.36 11.985-11.988C24.005 5.367 18.623 0 12.017 0z" />
        </svg>
      ),
      url: `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(shareUrl)}&description=${encodeURIComponent(shareText)}`,
    },
    {
      id: 'instagram',
      label: 'Instagram',
      color: '#E1306C',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051C.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
        </svg>
      ),
      url: `https://www.instagram.com/`,
    },
    {
      id: 'email',
      label: 'Email',
      color: '#EA4335',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      ),
      url: `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(shareUrl)}`,
    },
  ];

  return (
    <AnimatePresence>
      <motion.div
        className="share-modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="share-modal"
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 60, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Close */}
          <button className="share-modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>

          {/* Event image preview */}
          <div className="share-event-preview">
            <div className="share-event-image-wrap">
              <img src={event.image} alt={event.title} />
              <div className="share-event-image-overlay">
                <img src={logoTransparent} alt="Blithe" className="share-watermark" />
              </div>
            </div>
            <div className="share-event-meta">
              <span className="share-event-category">{event.category}</span>
              <h3 className="share-event-title">{event.title}</h3>
              <p className="share-event-date">{event.date} · {event.time}</p>
            </div>
          </div>

          {/* Social share row */}
          <p className="share-section-label">Share via</p>
          <div className="share-socials-row">
            {socials.map(s => (
              <a
                key={s.id}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="share-social-btn"
                style={{ '--social-color': s.color }}
                aria-label={`Share on ${s.label}`}
              >
                <span className="share-social-icon">{s.icon}</span>
                <span className="share-social-label">{s.label}</span>
              </a>
            ))}
          </div>

          {/* Copy link */}
          <button className={`share-copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy}>
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? 'Link Copied!' : 'Copy Event Link'}
          </button>

          {/* Divider */}
          <div className="share-divider"><span>Also available on</span></div>

          {/* App badges */}
          <div className="share-app-section">
            <div className="share-app-info">
              <img src={logoTransparent} alt="Blithe App" className="share-app-logo" />
              <div>
                <p className="share-app-name">Blithe</p>
                <p className="share-app-tagline">Discover events on the go</p>
              </div>
            </div>
            <div className="share-app-badges">
              <a
                href="https://play.google.com/store"
                target="_blank"
                rel="noopener noreferrer"
                className="share-badge-btn"
                aria-label="Get it on Google Play"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3.18 23.76c.3.17.64.24.98.21l12.94-12L13.06 8l-9.88 15.76zM20.5 10.22L17.67 8.6l-3.28 3.03 3.28 3.03 2.85-1.63c.81-.46.81-1.74-.02-2.81zM1.5.65C1.19.99 1 1.47 1 2.08v19.84c0 .61.19 1.09.5 1.43L1.62 23.4 13.06 12 1.62.6 1.5.65zM3.18.24L13.06 4 16.1 7.04 3.18.24z" />
                </svg>
                <div>
                  <span className="badge-sub">Get it on</span>
                  <span className="badge-main">Google Play</span>
                </div>
              </a>
              <a
                href="https://apps.apple.com"
                target="_blank"
                rel="noopener noreferrer"
                className="share-badge-btn"
                aria-label="Download on the App Store"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                <div>
                  <span className="badge-sub">Download on the</span>
                  <span className="badge-main">App Store</span>
                </div>
              </a>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

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
  const [showShareModal, setShowShareModal] = useState(false);

  const aboutRef = useRef(null);
  const termsDesktopRef = useRef(null);
  const termsMobileRef = useRef(null);

  const [relatedEvents, setRelatedEvents] = useState([]);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const { id } = useParams();

  const handleShareClick = () => {
    setShowShareModal(true);
  };

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
            priceMessage: data.priceMessage || "",
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
            soldOut: data.soldOut || false,
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
                priceMessage: data.priceMessage || "",
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
  today.setHours(0, 0, 0, 0);
  const isEventExpired = event.eventEndDate
    ? event.eventEndDate.toDate() < today
    : (event.eventStartDate ? event.eventStartDate.toDate() < today : false);
  const isSoldOut = event.soldOut === true;

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
                <span className="featured-badge-small" style={{ zIndex: 20 }}>Featured</span>
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
                  onClick={handleShareClick}
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
                  </div>
                </div>
                <div className="info-item desktop-date-time">
                  <div className="icon-box"><Clock size={20} className="icon" /></div>
                  <div className="text-content">
                    <p className="val">{event.time}</p>
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

              <div className="action-box desktop-booking-box">
                <div className="price-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <span className="label">Ticket Price</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                      <span className="amount">{event.price}</span>
                      {event.isPriceOnwards && <span className="amount-sub" style={{ fontSize: '0.9rem', color: '#6B7280', fontWeight: 500 }}>onwards</span>}
                    </div>
                  </div>
                  {event.priceMessage && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', marginTop: '2px' }}>
                      <span className="price-message" style={{ fontSize: '0.85rem', color: '#EF4444', fontWeight: 800 }}>{event.priceMessage}</span>
                    </div>
                  )}
                </div>
                <Button
                  variant={(isEventExpired || isSoldOut) ? "secondary" : "primary"}
                  size="lg"
                  className="book-now-btn"
                  onClick={() => navigate(`/events/${event.id}/book`)}
                  disabled={isEventExpired || isSoldOut}
                >
                  {isEventExpired ? 'Event Ended' : isSoldOut ? 'Sold Out' : 'Book Now'}
                </Button>
                <p className="guarantee" style={{ marginTop: '1rem', marginBottom: '0' }}>
                  <ShieldCheck size={14} style={{ color: '#10B981' }} /> 100% SECURE TRANSACTION
                </p>
              </div>
            </div>



            {/* Terms & Conditions card (Mobile Bottom) */}
            <div className="terms-details-card glass mobile-terms">
              <div className="section-header">
                <Info size={22} />
                <h2>Terms & Conditions</h2>
              </div>
              <div className={`expandable-content ${isTermsExpanded ? 'expanded' : ''}`} ref={termsMobileRef}>
                <p className="description" style={{ whiteSpace: 'pre-wrap' }}>
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
                        <span className="featured-badge-small">Featured</span>
                      )}
                    </div>
                    <div className="portrait-card-details">
                      <span className="portrait-card-date">{relatedEvent.date}</span>
                      <h3 className="portrait-card-title">{relatedEvent.title}</h3>
                      <p className="portrait-card-location">{relatedEvent.location}</p>
                      <p className="portrait-card-price" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <span>
                          {relatedEvent.price}
                          {relatedEvent.isPriceOnwards && <span style={{ fontSize: '0.8em', color: '#6B7280', marginLeft: '4px', fontWeight: 500 }}>onwards</span>}
                        </span>
                        {relatedEvent.priceMessage && <span className="price-message" style={{ fontSize: '1em', color: '#EF4444', marginLeft: '6px', fontWeight: 600 }}>{relatedEvent.priceMessage}</span>}
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
        <div className="price-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span className="amount">{event.price}</span>
            {event.isPriceOnwards && <span className="amount-sub" style={{ fontSize: '0.9rem', color: '#6B7280', fontWeight: 500, marginLeft: '4px' }}>onwards</span>}
          </div>
          {event.priceMessage && <span className="price-message" style={{ fontSize: '0.75rem', color: '#EF4444', fontWeight: 800, display: 'block', marginTop: '2px' }}>{event.priceMessage}</span>}
        </div>
        <Button
          variant={(isEventExpired || isSoldOut) ? "secondary" : "primary"}
          size="lg"
          onClick={() => navigate(`/events/${event.id}/book`)}
          disabled={isEventExpired || isSoldOut}
        >
          {isEventExpired ? 'Event Ended' : isSoldOut ? 'Sold Out' : 'Book Now'}
        </Button>
      </div>

      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && event && (
          <ShareModal event={event} onClose={() => setShowShareModal(false)} />
        )}
      </AnimatePresence>

    </div>
  );
};

export default EventDetails;
