import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Clock, ArrowLeft, Share2, Info, Ticket, ChevronLeft, ChevronRight, ChevronDown, Navigation, AlertTriangle, Sparkles, X, Copy, Check, ExternalLink, Loader2, ShieldCheck, User, Phone, Mail, HelpCircle, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, getDoc, collection, collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useDispatch, useSelector } from 'react-redux';
import { fetchEventsThunk } from '../../store/eventsSlice';
import { updateUserInterests } from '../../services/userService';
import Button from '../Button/Button';
import logo from '../../assets/logo.jpeg';
import logoTransparent from '../../assets/logo-transparent.png';
import './EventDetails.scss';

// Custom SVG Brand Icons since they were removed from Lucide v1.0+
const FacebookIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
);
const TwitterIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" /></svg>
);
const InstagramIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
);

// Helper to format social and website links as absolute URLs
const formatSocialUrl = (url) => {
  if (!url) return '';
  const trimmed = url.trim();
  if (/^(f|ht)tps?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

// Helper to calculate distance in km
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
  return R * c;
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
      } else if (tag !== null && tag !== undefined) {
        tagsArray.push(String(tag));
      }
    });
  }
  return tagsArray
    .map(t => typeof t === 'string' ? t.trim() : String(t).trim())
    .filter(t => t !== "");
};

// ─── Share Modal ─────────────────────────────────────────────────────────────
// eslint-disable-next-line react/prop-types
const ShareModal = ({ event, onClose, onShare }) => {
  const [copied, setCopied] = useState(false);
  const [copiedSocial, setCopiedSocial] = useState(null);
  const shareUrl = window.location.href;
  const shareText = `Check out "${event.title}" on Blithe!`;

  const handleCopy = async () => {
    let success = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        success = true;
      } else {
        throw new Error('Clipboard API not available');
      }
    } catch {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = shareUrl;
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        success = document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch (err) {
        console.error("Fallback copy failed: ", err);
      }
    }

    if (success) {
      setCopied(true);
      if (onShare) onShare();
      setTimeout(() => setCopied(false), 2500);
    }
    return success;
  };

  const handleSocialClick = async (e, s) => {
    if (onShare) onShare();
    if (s.id === 'instagram') {
      e.preventDefault();
      const success = await handleCopy();
      if (success) {
        setCopiedSocial('instagram');
        setTimeout(() => setCopiedSocial(null), 2000);
      }
      window.open(s.url, '_blank', 'noopener,noreferrer');
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
                onClick={(e) => handleSocialClick(e, s)}
              >
                <span className="share-social-icon">{s.icon}</span>
                <span className="share-social-label">
                  {copiedSocial === s.id ? 'Copied!' : s.label}
                </span>
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
                href="https://play.google.com/store/apps/details?id=com.firstlogicmetalab.blith_user_app"
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
                href="https://apps.apple.com/in/app/blithe/id6473627877"
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

// ─── Attendees Modal ────────────────────────────────────────────────────────
const AttendeesModal = ({ onClose, attendeesList = [], currentUser = null }) => {
  const currentUserId = currentUser?.uid;
  const currentUserName = currentUser?.name;

  // Filter out the current user from the displayed avatar list (they're already counted)
  const otherAttendees = attendeesList.filter(att => {
    if (!currentUser) return true;
    if (att.userId && currentUserId && att.userId === currentUserId) return false;
    if (att.userName && currentUserName && att.userName.toLowerCase() === currentUserName.toLowerCase()) {
      return false;
    }
    return true;
  });

  // Always use the full list length as the total count (same as event detail page)
  const totalCount = attendeesList.length;

  return (
    <AnimatePresence>
      <motion.div
        className="attendees-modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="attendees-modal"
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 60, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Close */}
          <button className="attendees-modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>

          <div className="attendees-modal-content">
            <div className="icon-pulse-wrapper">
              <Sparkles size={32} style={{ color: '#7C3AED' }} />
            </div>
            <h2>Event Attendees</h2>



            {/* All Attendees Section */}
            <div className="all-attendees-section">
              {totalCount > 0 ? (
                <>
                  {/* Overlapping avatars row — same design as going-section */}
                  <div className="modal-attendees-pill">
                    <div className="attendee-avatars">
                      {attendeesList.slice(0, 6).map((att, idx) => (
                        <div
                          key={idx}
                          className="attendee-avatar-wrapper"
                          style={{ zIndex: attendeesList.length - idx }}
                          title={att.userName || 'Attendee'}
                        >
                          {att.userProfileImage ? (
                            <img src={att.userProfileImage} alt={att.userName || 'Attendee'} className="attendee-avatar-img" />
                          ) : (
                            <img
                              src={`https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(att.userName || 'Attendee')}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`}
                              alt={att.userName || 'Attendee'}
                              className="attendee-avatar-img dicebear-avatar"
                            />
                          )}
                        </div>
                      ))}
                      {attendeesList.length > 6 && (
                        <div className="attendee-avatar-wrapper attendee-avatar-more" style={{ zIndex: 0 }}>
                          <span>+{attendeesList.length - 6}</span>
                        </div>
                      )}
                    </div>
                    <span className="attendees-count-text">
                      <span className="highlight-count">{totalCount}</span>{' '}
                      {totalCount === 1 ? 'person is' : 'people are'} going
                    </span>
                  </div>

                  {/* Name list below avatars */}
                  {/* <div className="modal-attendees-names" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '240px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                    {attendeesList.filter(att => !att.isGuest).map((att, idx) => (
                      <div key={idx} className="modal-attendee-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div className="modal-attendee-avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden' }}>
                            {att.userProfileImage ? (
                              <img src={att.userProfileImage} alt={att.userName || 'Attendee'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <img
                                src={`https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(att.userName || 'Attendee')}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`}
                                alt={att.userName || 'Attendee'}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            )}
                          </div>
                          <span className="modal-attendee-name" style={{ fontWeight: 600, fontSize: '0.9rem' }}>{att.userName || 'Attendee'}</span>
                        </div>
                        <span className="modal-attendee-badge" style={{ fontSize: '0.8rem', background: 'rgba(124, 58, 237, 0.08)', color: '#7C3AED', padding: '0.25rem 0.6rem', borderRadius: '2rem', fontWeight: 700 }}>
                          {att.ticketCount} {att.ticketCount === 1 ? 'ticket' : 'tickets'}
                        </span>
                      </div>
                    ))}
                  </div> */}
                </>
              ) : (
                <p className="no-attendees-text" style={{ textAlign: 'center', width: '100%', color: 'rgba(100,100,120,0.7)', margin: '1rem 0' }}>
                  Be the first to secure a spot!
                </p>
              )}
            </div>

            {/* Download the Blithe App */}
            <div className="attendees-app-download">
              <div className="attendees-app-divider"><span>See who's nearby, download the app to connect.</span></div>
              <div className="attendees-app-section">
                <div className="attendees-app-info">
                  <img src={logoTransparent} alt="Blithe App" className="attendees-app-logo" />
                  <div>
                    <p className="attendees-app-name">Blithe</p>
                    {/* <p className="attendees-app-tagline">See the attendees near you</p> */}
                  </div>
                </div>
                <div className="attendees-app-badges">
                  <a
                    href="https://play.google.com/store/apps/details?id=com.firstlogicmetalab.blith_user_app"
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
                    href="https://apps.apple.com/in/app/blithe/id6473627877"
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
            </div>

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};



const EventDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [currentIndex, setCurrentIndex] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const lastClickTime = useRef(0);
  const [isAboutExpanded, setIsAboutExpanded] = useState(false);
  const [isOrgAboutExpanded, setIsOrgAboutExpanded] = useState(false);
  const [isTermsExpanded, setIsTermsExpanded] = useState(false);
  const [showAboutBtn, setShowAboutBtn] = useState(false);
  const [showOrgAboutBtn, setShowOrgAboutBtn] = useState(false);
  const [showTermsBtn, setShowTermsBtn] = useState(false);
  const [dbTAndC, setDbTAndC] = useState("");
  const [organiser, setOrganiser] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [userLocation, setUserLocation] = useState(() => {
    const cached = localStorage.getItem('blithe_user_location');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [attendeesList, setAttendeesList] = useState([]);
  const [attendeesCount, setAttendeesCount] = useState(0);
  const [showAttendeesPopup, setShowAttendeesPopup] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [settings, setSettings] = useState(null);

  // Fetch current user from sessionStorage and Firestore
  useEffect(() => {
    const fetchCurrentUserProfile = async () => {
      try {
        const cachedDetails = sessionStorage.getItem('blithe_checkout_attendee');
        console.log("[CurrentUser Debug] cachedDetails from sessionStorage:", cachedDetails);
        if (cachedDetails) {
          const parsed = JSON.parse(cachedDetails);
          const email = parsed.email?.trim().toLowerCase();
          const phone = parsed.phone?.trim();
          const uid = parsed.uid;

          // 1. Try UID lookup directly (most reliable)
          if (uid) {
            console.log("[CurrentUser Debug] Attempting Firestore lookup by UID:", uid);
            const userDocRef = doc(db, "users", uid);
            const userSnap = await getDoc(userDocRef);
            if (userSnap.exists()) {
              const uData = { uid: userSnap.id, ...userSnap.data() };
              setCurrentUser(uData);
              console.log("[CurrentUser Debug] Resolved user profile from Firestore by UID:", uData);
              return;
            } else {
              console.warn("[CurrentUser Debug] User doc does not exist for UID:", uid);
            }
          }

          // 2. Try Email lookup
          if (email) {
            console.log("[CurrentUser Debug] Attempting Firestore lookup by email:", email);
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("email", "==", email));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              const userDoc = querySnapshot.docs[0];
              const uData = { uid: userDoc.id, ...userDoc.data() };
              setCurrentUser(uData);
              console.log("[CurrentUser Debug] Resolved user profile from Firestore by email:", uData);
              return;
            }
          }

          // 3. Try Phone lookup
          if (phone) {
            console.log("[CurrentUser Debug] Attempting Firestore lookup by phoneNo:", phone);
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("phoneNo", "==", phone));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              const userDoc = querySnapshot.docs[0];
              const uData = { uid: userDoc.id, ...userDoc.data() };
              setCurrentUser(uData);
              console.log("[CurrentUser Debug] Resolved user profile from Firestore by phoneNo:", uData);
              return;
            }
          }

          // 4. Fallback to session details
          if (parsed.name) {
            const fallbackUser = {
              uid: uid || parsed.bookingId || '',
              name: parsed.name,
              email: parsed.email || '',
              phoneNo: parsed.phone || '',
              profilePic: parsed.profilePic || ''
            };
            setCurrentUser(fallbackUser);
            console.log("[CurrentUser Debug] Fell back to cached session user (not found in Firestore):", fallbackUser);
          }
        } else {
          console.log("[CurrentUser Debug] No cached user found in sessionStorage.");
        }
      } catch (err) {
        console.warn("[CurrentUser Debug] Failed to fetch current user profile:", err);
      }
    };
    fetchCurrentUserProfile();
  }, []);

  // Fetch user location — triggers browser permission popup after a 5s delay if not cached
  useEffect(() => {
    const cached = localStorage.getItem('blithe_user_location');
    if (cached) {
      try {
        setUserLocation(JSON.parse(cached));
        return;
      } catch (e) { }
    }
    if (!navigator.geolocation) return;

    const timer = setTimeout(() => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const loc = { lat: latitude, lng: longitude, type: 'precise' };
          setUserLocation(loc);
          localStorage.setItem('blithe_user_location', JSON.stringify(loc));
        },
        () => { },
        { maximumAge: 60000, timeout: 10000, enableHighAccuracy: false }
      );
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  // Fetch platform settings for contact support info
  useEffect(() => {
    const fetchSettings = async () => {
      const attempts = [
        () => getDocs(collection(db, 'appConfig')),
        () => getDocs(collection(db, 'config')),
        () => getDocs(collection(db, 'platformSettings')),
      ];

      for (const attempt of attempts) {
        try {
          const snapshot = await attempt();
          if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            if (data.contactSupport !== undefined || data.email !== undefined) {
              setSettings(data);
              return;
            }
          }
        } catch (_) { }
      }

      // Fallback
      setSettings({
        contactSupport: "+91 98453 47592",
        email: "hello@blithe.social"
      });
    };
    fetchSettings();
  }, []);

  // Fetch dynamic terms and conditions from settings/event document
  useEffect(() => {
    const fetchTAndC = async () => {
      try {
        const docRef = doc(db, "settings", "event");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && data.tAndC) {
            setDbTAndC(data.tAndC);
          }
        }
      } catch (err) {
        console.error("Error fetching terms and conditions from /settings/event:", err);
      }
    };
    fetchTAndC();
  }, []);

  // Fetch attendees for the event
  useEffect(() => {
    const fetchAttendees = async () => {
      if (!id) return;
      try {
        let bookings = [];

        // 1. Try querying collectionGroup "myBookings"
        try {
          const bookingsQuery = query(
            collectionGroup(db, 'myBookings'),
            where('eventId', '==', id),
            where('status', '==', 'confirmed')
          );
          const bookingsSnapshot = await getDocs(bookingsQuery);
          bookingsSnapshot.forEach(docSnap => {
            bookings.push(docSnap.data());
          });
        } catch (cgErr) {
          console.warn("[Attendees] collectionGroup 'myBookings' failed, trying 'mybooking':", cgErr);
          // 2. Try collectionGroup "mybooking" if "myBookings" fails (e.g. index issue or collection naming)
          try {
            const bookingsQuery = query(
              collectionGroup(db, 'mybooking'),
              where('eventId', '==', id),
              where('status', '==', 'confirmed')
            );
            const bookingsSnapshot = await getDocs(bookingsQuery);
            bookingsSnapshot.forEach(docSnap => {
              bookings.push(docSnap.data());
            });
          } catch (cgErr2) {
            console.warn("[Attendees] collectionGroup 'mybooking' failed:", cgErr2);
          }
        }

        // 3. Fallback to eventBookings subcollection under the event document
        if (bookings.length === 0) {
          try {
            const eventBookingsRef = collection(db, "event", id, "eventBookings");
            const q = query(eventBookingsRef, where('status', '==', 'confirmed'));
            const snap = await getDocs(q);
            snap.forEach(docSnap => {
              bookings.push(docSnap.data());
            });
          } catch (fallbackErr) {
            console.error("[Attendees] Fallback fetch from eventBookings failed:", fallbackErr);
          }
        }

        // Process bookings to filter unique attendees and extract names and profile images
        const uniqueUsers = new Map();
        bookings.forEach(b => {
          const userId = b.userId || b.bookingId;
          if (userId) {
            const qty = b.totalQuantity || (b.tickets ? b.tickets.reduce((sum, t) => sum + (t.quantity || 0), 0) : 1);
            if (!uniqueUsers.has(userId)) {
              uniqueUsers.set(userId, {
                userId,
                userName: b.userName || 'Attendee',
                userProfileImage: b.userProfileImage || b.profilePic || '',
                ticketCount: qty
              });
            } else {
              const existing = uniqueUsers.get(userId);
              existing.ticketCount += qty;
            }
          }
        });

        const expandedList = [];
        uniqueUsers.forEach((userData) => {
          expandedList.push({
            userId: userData.userId,
            userName: userData.userName,
            userProfileImage: userData.userProfileImage,
            isGuest: false,
            ticketCount: userData.ticketCount
          });

          for (let i = 1; i < userData.ticketCount; i++) {
            expandedList.push({
              userId: `${userData.userId}_guest_${i}`,
              userName: `${userData.userName} (Guest ${i})`,
              userProfileImage: '',
              isGuest: true,
              parentName: userData.userName,
              ticketCount: 1
            });
          }
        });

        setAttendeesList(expandedList);
        setAttendeesCount(expandedList.length);
      } catch (err) {
        console.error("[Attendees] Error fetching attendees:", err);
      }
    };

    fetchAttendees();
  }, [id]);

  const aboutRef = useRef(null);
  const orgAboutRef = useRef(null);
  const termsRef = useRef(null);
  const [relatedEvents, setRelatedEvents] = useState([]);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  const hasLoggedView = useRef(false);
  const hasLoggedShare = useRef(false);

  // Reset logged states on event ID change
  useEffect(() => {
    hasLoggedView.current = false;
    hasLoggedShare.current = false;
  }, [id]);

  // Log viewEvent interest update (score = 1) when both user and event details are loaded
  useEffect(() => {
    console.log("[Interests Debug] viewEvent effect triggered. Details:", {
      userId: currentUser?.uid,
      eventCategory: event?.category,
      eventId: event?.id,
      routeId: id,
      hasLoggedView: hasLoggedView.current
    });
    if (currentUser?.uid && event?.category && event?.id === id && !hasLoggedView.current) {
      hasLoggedView.current = true;
      console.log(`[Interests Debug] Invoking updateUserInterests for viewEvent. Category: '${event.category}', UID: '${currentUser.uid}'`);
      updateUserInterests(currentUser.uid, event.category, 1)
        .then(() => console.log("[Interests Debug] viewEvent update finished."))
        .catch(err => console.error("[Interests Debug] viewEvent update failed:", err));
    } else {
      console.log("[Interests Debug] viewEvent conditions not satisfied:", {
        hasUid: !!currentUser?.uid,
        hasCategory: !!event?.category,
        idMatch: event?.id === id,
        notAlreadyLogged: !hasLoggedView.current
      });
    }
  }, [currentUser?.uid, event?.category, event?.id, id]);

  const handleShareEvent = () => {
    console.log("[Interests Debug] handleShareEvent called. Details:", {
      userId: currentUser?.uid,
      eventCategory: event?.category,
      hasLoggedShare: hasLoggedShare.current
    });
    if (currentUser?.uid && event?.category && !hasLoggedShare.current) {
      hasLoggedShare.current = true;
      console.log(`[Interests Debug] Invoking updateUserInterests for shareEvent. Category: '${event.category}', UID: '${currentUser.uid}'`);
      updateUserInterests(currentUser.uid, event.category, 1)
        .then(() => console.log("[Interests Debug] shareEvent update finished."))
        .catch(err => console.error("[Interests Debug] shareEvent update failed:", err));
    } else {
      console.log("[Interests Debug] shareEvent conditions not satisfied:", {
        hasUid: !!currentUser?.uid,
        hasCategory: !!event?.category,
        notAlreadyLogged: !hasLoggedShare.current
      });
    }
  };

  const tagsRef = useRef(null);
  const [showTagsScrollBtn, setShowTagsScrollBtn] = useState(false);
  const [isTagsScrollAtEnd, setIsTagsScrollAtEnd] = useState(false);

  const checkTagsOverflow = () => {
    if (tagsRef.current) {
      const { scrollWidth, clientWidth, scrollLeft } = tagsRef.current;
      setShowTagsScrollBtn(scrollWidth > clientWidth);
      setIsTagsScrollAtEnd(scrollLeft + clientWidth >= scrollWidth - 10);
    }
  };

  const handleTagsScroll = () => {
    if (tagsRef.current) {
      if (isTagsScrollAtEnd) {
        tagsRef.current.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        tagsRef.current.scrollBy({ left: 150, behavior: 'smooth' });
      }
    }
  };

  useEffect(() => {
    checkTagsOverflow();
    // Use a small timeout to let rendering finish
    const timer = setTimeout(checkTagsOverflow, 100);
    window.addEventListener('resize', checkTagsOverflow);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkTagsOverflow);
    };
  }, [event?.tags]);

  const dispatch = useDispatch();
  const { events: rawEvents } = useSelector(state => state.events);

  useEffect(() => {
    dispatch(fetchEventsThunk());
  }, [dispatch, id]);

  const handleShareClick = () => {
    handleShareEvent();
    setShowShareModal(true);
  };

  useEffect(() => {
    const checkOverflow = () => {
      if (aboutRef.current && !isAboutExpanded) {
        setShowAboutBtn(aboutRef.current.scrollHeight > aboutRef.current.clientHeight);
      }
      if (orgAboutRef.current && !isOrgAboutExpanded) {
        setShowOrgAboutBtn(orgAboutRef.current.scrollHeight > orgAboutRef.current.clientHeight);
      }
      if (termsRef.current && !isTermsExpanded) {
        setShowTermsBtn(termsRef.current.scrollHeight > termsRef.current.clientHeight);
      }
    };

    checkOverflow();
    const timeoutId = setTimeout(checkOverflow, 100);
    window.addEventListener('resize', checkOverflow);
    return () => {
      window.removeEventListener('resize', checkOverflow);
      clearTimeout(timeoutId);
    };
  }, [event, organiser, isAboutExpanded, isOrgAboutExpanded, isTermsExpanded, dbTAndC]);

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

          const organizerId = data.oId || data.oid || "";
          if (organizerId) {
            try {
              const organiserRef = doc(db, "organisers", organizerId);
              const organiserSnap = await getDoc(organiserRef);
              if (organiserSnap.exists()) {
                const orgData = organiserSnap.data();
                setOrganiser({
                  id: organiserSnap.id,
                  name: orgData.name || orgData.displayName || orgData.organiserName || orgData.username || "Organizer",
                  image: orgData.profileImage || orgData.profilePic || orgData.photoURL || orgData.organiserImage || orgData.image || orgData.logo || "",
                  about: orgData.about || orgData.description || orgData.bio || "",
                  facebookUrl: orgData.facebookUrl || orgData.facebook || "",
                  instagramUrl: orgData.instagramUrl || orgData.instagram || "",
                  twitterUrl: orgData.twitterUrl || orgData.twitter || "",
                  websiteUrl: orgData.websiteUrl || orgData.website || ""
                });
              } else {
                setOrganiser(null);
              }
            } catch (err) {
              console.error("Error fetching organiser: ", err);
              setOrganiser(null);
            }
          } else {
            setOrganiser(null);
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
            tags: processTags(data.tags),
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
    const fetchRelatedEvents = () => {
      if (!event || !event.raw || !rawEvents || rawEvents.length === 0) return;
      try {
        const toDateObj = (ts) => {
          if (!ts) return null;
          if (typeof ts.toDate === 'function') return ts.toDate();
          return new Date(ts);
        };
        const now = new Date();

        let allActiveEvents = [];
        rawEvents.forEach(data => {
          if (data.id !== event.id) {
            const isNotBlocked = data.block === false;
            const endD = toDateObj(data.eventEndDate);
            const isNotExpired = endD ? endD >= now : true;
            const hasNoPaymentUrl = !data.paymentUrl || data.paymentUrl.trim() === "";

            if (isNotBlocked && isNotExpired && hasNoPaymentUrl) {
              const startDateObj = data.eventStartDate ? toDateObj(data.eventStartDate) : new Date();
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

              const isCategoryMatch = data.category && event.category && data.category === event.category;
              const commonTags = processTags(data.tags).filter(t => (event.tags || []).includes(t));

              // Only recommend if there is a category match OR common tags
              if (isCategoryMatch || commonTags.length > 0) {
                let score = 0;
                if (isCategoryMatch) score += 5;
                score += commonTags.length * 2;

                // Match distance proximity (nearby, if location geopoint is available)
                const getDistance = (lat1, lon1, lat2, lon2) => {
                  const R = 6371; // Earth's radius in km
                  const dLat = (lat2 - lat1) * Math.PI / 180;
                  const dLon = (lon2 - lon1) * Math.PI / 180;
                  const a =
                    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
                  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                  return R * c;
                };

                const lat1 = event.geopoint?.latitude || event.geopoint?._lat;
                const lon1 = event.geopoint?.longitude || event.geopoint?._long;
                const lat2 = data.position?.geopoint?.latitude || data.position?.geopoint?._lat;
                const lon2 = data.position?.geopoint?.longitude || data.position?.geopoint?._long;

                if (lat1 && lon1 && lat2 && lon2) {
                  const dist = getDistance(lat1, lon1, lat2, lon2);
                  if (dist <= 10) {
                    score += 5;
                  } else if (dist <= 30) {
                    score += 2;
                  }
                } else if (data.location && event.location && data.location.includes(event.location.split(',')[0])) {
                  score += 2; // fallback to text location prefix match
                }

                if (formattedDate === event.date) score += 1;

                const featuredEndD = toDateObj(data.featuredEndDate);
                const isFeatured = data.featured === true && featuredEndD && featuredEndD >= now;

                let relatedDistance = null;
                if (userLocation && lat2 && lon2) {
                  relatedDistance = calculateDistance(userLocation.lat, userLocation.lng, lat2, lon2);
                }

                allActiveEvents.push({
                  id: data.id,
                  promoted: isFeatured,
                  title: data.eventName || "Untitled Event",
                  image: (data.image && data.image.length > 0) ? data.image[0] : "",
                  date: formattedDate,
                  location: data.location || data.venue || "TBA",
                  price: displayPrice,
                  isPriceOnwards: isPriceOnwards,
                  priceMessage: data.priceMessage || "",
                  score,
                  distance: relatedDistance,
                  eventStartDate: data.eventStartDate || null
                });
              }
            }
          }
        });

        allActiveEvents.sort((a, b) => b.score - a.score);
        const topRelated = allActiveEvents.slice(0, 4);
        // Sort top related events chronologically (earlier calendar date first), then by proximity (distance)
        topRelated.sort((a, b) => {
          const dateA = a.eventStartDate ? (typeof a.eventStartDate.toDate === 'function' ? a.eventStartDate.toDate() : new Date(a.eventStartDate)) : new Date(0);
          const dateB = b.eventStartDate ? (typeof b.eventStartDate.toDate === 'function' ? b.eventStartDate.toDate() : new Date(b.eventStartDate)) : new Date(0);

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

        setRelatedEvents(topRelated);
      } catch (err) {
        console.error("Error fetching related events from Redux", err);
      }
    };

    if (event) {
      fetchRelatedEvents();
    }
  }, [event, rawEvents, userLocation]);

  // Reset currentIndex to 1 when event ID changes
  useEffect(() => {
    setCurrentIndex(1);
    setIsTransitioning(false);
  }, [id]);

  const mediaList = event
    ? (event.extraImages && event.extraImages.length > 0
      ? [event.image, ...event.extraImages]
      : [event.image]
    ).filter(Boolean)
    : [];

  const paddedMediaList = mediaList.length > 0
    ? [mediaList[mediaList.length - 1], ...mediaList, mediaList[0]]
    : [];

  // Reset currentIndex if it somehow goes out of bounds of the current media list
  useEffect(() => {
    if (mediaList.length === 0) {
      if (currentIndex !== 1) {
        setCurrentIndex(1);
        setIsTransitioning(false);
      }
    } else if (currentIndex > mediaList.length + 1 || currentIndex < 0) {
      setCurrentIndex(1);
      setIsTransitioning(false);
    }
  }, [mediaList.length, currentIndex]);

  const eventLat = event?.geopoint?.latitude || event?.geopoint?._lat;
  const eventLng = event?.geopoint?.longitude || event?.geopoint?._long;
  const distance = (userLocation && eventLat && eventLng)
    ? calculateDistance(userLocation.lat, userLocation.lng, eventLat, eventLng)
    : null;

  const handlePrev = () => {
    const now = Date.now();
    if (now - lastClickTime.current < 500) return;
    lastClickTime.current = now;
    if (mediaList.length <= 1) return;
    setIsTransitioning(true);
    setCurrentIndex(prev => prev - 1);
  };

  const handleNext = () => {
    const now = Date.now();
    if (now - lastClickTime.current < 500) return;
    lastClickTime.current = now;
    if (mediaList.length <= 1) return;
    setIsTransitioning(true);
    setCurrentIndex(prev => prev + 1);
  };

  const handleAnimationComplete = () => {
    if (currentIndex === 0) {
      setIsTransitioning(false);
      setCurrentIndex(mediaList.length);
    } else if (currentIndex === mediaList.length + 1) {
      setIsTransitioning(false);
      setCurrentIndex(1);
    }
  };

  // Auto-scroll for the carousel
  useEffect(() => {
    if (mediaList.length <= 1) return;
    const interval = setInterval(() => {
      handleNext();
    }, 4000);
    return () => clearInterval(interval);
  }, [mediaList.length, currentIndex]);

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
        <button onClick={() => navigate('/events')} className="back-link">Back to Events</button>
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isEventExpired = event.eventEndDate
    ? event.eventEndDate.toDate() < today
    : (event.eventStartDate ? event.eventStartDate.toDate() < today : false);

  const checkEventSoldOut = (evt) => {
    if (evt.soldOut === true) return true;
    if (evt.tickets && evt.tickets.length > 0) {
      const hasAvailableTicket = evt.tickets.some(t => {
        const isStatusActive = t.status !== false;
        const hasSlots = t.remainingSlots > 0;

        let isNotExpired = true;
        if (t.endDate) {
          const ticketEndDate = t.endDate.seconds ? t.endDate.toDate() : new Date(t.endDate);
          const tDate = new Date(ticketEndDate);
          tDate.setHours(0, 0, 0, 0);
          if (tDate < today) {
            isNotExpired = false;
          }
        }
        return isStatusActive && hasSlots && isNotExpired;
      });
      return !hasAvailableTicket;
    }
    return false;
  };
  const isSoldOut = checkEventSoldOut(event);

  return (
    <div className="event-details-page">
      <div className="details-header-bar container">
        <button onClick={() => navigate('/events')} className="back-link-btn">
          <ArrowLeft size={20} /> <span className="text">Back to Events</span>
        </button>
      </div>

      <div className="container main-content">
        <div className="content-grid">
          {/* Left Column: Premium media carousel */}
          <div className="media-carousel-area">
            <div className="main-carousel-view">
              <div className="carousel-track-container">
                {paddedMediaList.length > 0 ? (
                  <motion.div
                    className="carousel-track"
                    animate={{ x: `-${currentIndex * 100}%` }}
                    transition={isTransitioning ? { type: "spring", stiffness: 300, damping: 30 } : { duration: 0 }}
                    onAnimationComplete={handleAnimationComplete}
                  >
                    {paddedMediaList.map((mediaUrl, idx) => (
                      <img
                        key={idx}
                        src={mediaUrl}
                        alt={`${event.title} - view ${idx}`}
                        className="carousel-slide-image"
                        loading="eager"
                      />
                    ))}
                  </motion.div>
                ) : (
                  <img
                    src={logo}
                    alt={event.title}
                    className="carousel-slide-image"
                    loading="eager"
                  />
                )}
              </div>

              {event.promoted && (
                <span className="featured-badge-small" style={{ zIndex: 20 }}>Featured</span>
              )}

              {/* Navigation Chevrons */}
              {mediaList.length > 1 && (
                <>
                  <button
                    type="button"
                    className="slide-arrow-btn prev"
                    onClick={handlePrev}
                    aria-label="Previous image"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button
                    type="button"
                    className="slide-arrow-btn next"
                    onClick={handleNext}
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



            {/* Organiser card */}
            {organiser && (
              <div className="organiser-details-card glass">
                <div className="section-header">
                  <User size={22} style={{ color: '#7C3AED' }} />
                  <h2>Hosted By</h2>
                </div>
                <div className="organiser-profile">
                  <div className="organiser-avatar">
                    {organiser.image ? (
                      <img src={organiser.image} alt={organiser.name} />
                    ) : (
                      <img
                        src={`https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(organiser.name || 'Organizer')}&backgroundColor=b6e3f4,c0aede,d1d4f9`}
                        alt={organiser.name || 'Organizer'}
                        className="organiser-avatar-img dicebear-avatar"
                      />
                    )}
                  </div>
                  <div className="organiser-meta">
                    <h3 className="organiser-name">{organiser.name}</h3>
                    <span className="organiser-badge">
                      <Check size={12} strokeWidth={3} className="check-icon" />
                      Verified Organiser
                    </span>
                    {(organiser.instagramUrl || organiser.websiteUrl) && (
                      <div className="organiser-socials">
                        {organiser.instagramUrl && (
                          <a href={formatSocialUrl(organiser.instagramUrl)} target="_blank" rel="noopener noreferrer" className="social-link instagram" aria-label="Instagram">
                            <InstagramIcon size={22} />
                          </a>
                        )}
                        {organiser.websiteUrl && (
                          <a href={formatSocialUrl(organiser.websiteUrl)} target="_blank" rel="noopener noreferrer" className="social-link website" aria-label="Website">
                            <Globe size={22} />
                          </a>
                        )}
                      </div>
                    )}
                    {organiser.about && (
                      <>
                        <div className={`expandable-content ${isOrgAboutExpanded ? 'expanded' : ''}`} ref={orgAboutRef}>
                          <p className="organiser-about" style={{ margin: 0 }}>{organiser.about}</p>
                        </div>
                        {showOrgAboutBtn && (
                          <button
                            type="button"
                            className="read-more-btn"
                            onClick={() => setIsOrgAboutExpanded(!isOrgAboutExpanded)}
                            aria-expanded={isOrgAboutExpanded}
                            style={{ alignSelf: 'flex-start', marginTop: '0.25rem' }}
                          >
                            {isOrgAboutExpanded ? 'Read Less' : 'Read More'}
                            <ChevronDown size={18} className={`chevron-icon ${isOrgAboutExpanded ? 'expanded' : ''}`} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Event Details & Action Box */}
          <div className="event-info-sidebar">
            <div className="event-details-card glass">
              <div className="card-top-row">
                <span className="category-badge">{event.category}</span>
                <button
                  className="share-btn"
                  aria-label="Share Event"
                  onClick={handleShareClick}
                >
                  <Share2 size={18} />
                </button>
              </div>

              {event.tags && event.tags.length > 0 && (
                <div className="hashtags-row">
                  <div className="event-tags-wrapper">
                    <div className="event-tags" ref={tagsRef} onScroll={checkTagsOverflow}>
                      {event.tags.map((tag, idx) => (
                        <span key={idx} className="hashtag">
                          {tag.startsWith('#') ? tag : `#${tag}`}
                        </span>
                      ))}
                    </div>
                  </div>
                  {showTagsScrollBtn && (
                    <button
                      className="tags-scroll-btn"
                      aria-label={isTagsScrollAtEnd ? "Scroll Hashtags Left" : "Scroll Hashtags Right"}
                      onClick={handleTagsScroll}
                    >
                      {isTagsScrollAtEnd ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                    </button>
                  )}
                </div>
              )}
              <h1 className="event-title">{event.title}</h1>
              {/* <p className="mobile-date-highlight">{event.date}, {event.time}</p> */}


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
                      <p className="val">
                        {event.venue}
                        {distance !== null && (
                          <span className="venue-distance" style={{ marginLeft: '8px', color: '#7C3AED', fontWeight: 700, fontSize: '0.85rem' }}>
                            ({distance < 1 ? `${Math.round(distance * 1000)}m` : `${Math.round(distance)} km`} away)
                          </span>
                        )}
                      </p>
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
              {/* Attendees section */}
              {attendeesCount >= 4 && (
                <div className="attendees-going-section" onClick={() => setShowAttendeesPopup(true)}>
                  <div className="attendee-avatars">
                    <>
                      {attendeesList.slice(0, 3).map((att, idx) => (
                        <div key={idx} className="attendee-avatar-wrapper" style={{ zIndex: 4 - idx }}>
                          {att.userProfileImage ? (
                            <img src={att.userProfileImage} alt={att.userName || "Attendee"} className="attendee-avatar-img" />
                          ) : (
                            <img
                              src={`https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(att.userName || 'Attendee')}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`}
                              alt={att.userName || 'Attendee'}
                              className="attendee-avatar-img dicebear-avatar"
                            />
                          )}
                        </div>
                      ))}
                      <div className="attendee-avatar-wrapper attendee-avatar-more" style={{ zIndex: 1 }}>
                        <span>+{attendeesCount - 3}</span>
                      </div>
                    </>
                  </div>
                  <span className="attendees-count-text">
                    <span className="highlight-count">{attendeesCount}</span> {attendeesCount === 1 ? 'person is' : 'people are'} going
                  </span>
                </div>
              )}

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
                      <span className="price-message" style={{ fontSize: '0.9rem', color: '#EF4444', fontWeight: 800 }}>{event.priceMessage}</span>
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
                {(settings?.contactSupport || settings?.email) && (
                  <p className="support-query-line">
                    Talk to Us{' '}
                    {settings.contactSupport && (
                      <a href={`tel:${settings.contactSupport.trim()}`}>
                        {settings.contactSupport.trim()}
                      </a>
                    )}
                    {settings.contactSupport && settings.email && ' | '}
                    {settings.email && (
                      <a href={`mailto:${settings.email.trim()}`}>
                        {settings.email.trim()}
                      </a>
                    )}
                  </p>
                )}
              </div>
            </div>


            {/* Terms & Conditions card */}
            <div className="terms-details-card glass">
              <div className="section-header">
                <Info size={22} />
                <h2>Terms & Conditions</h2>
              </div>
              <div className={`expandable-content ${isTermsExpanded ? 'expanded' : ''}`} ref={termsRef}>
                <p className="description" style={{ whiteSpace: 'pre-wrap' }}>
                  {dbTAndC || event.termsAndConditions}
                </p>
              </div>
              {showTermsBtn && (
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
                      <div className="portrait-card-date-row">
                        <span className="portrait-card-date">{relatedEvent.date}</span>
                      </div>
                      <h3 className="portrait-card-title">{relatedEvent.title}</h3>
                      <div className="portrait-card-location-row">
                        <p className="portrait-card-location">{relatedEvent.location}</p>
                        {relatedEvent.distance !== null && relatedEvent.distance !== undefined && (
                          <span className="location-distance-tag">
                            <MapPin size={12} className="distance-icon" />
                            {relatedEvent.distance < 1
                              ? `${Math.round(relatedEvent.distance * 1000)}m`
                              : `${Math.round(relatedEvent.distance)} km`}
                          </span>
                        )}
                      </div>
                      <p className="portrait-card-price" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <span>
                          {relatedEvent.price}
                          {relatedEvent.isPriceOnwards && <span style={{ fontSize: '0.8em', color: '#6B7280', marginLeft: '4px', fontWeight: 500 }}>onwards</span>}
                        </span>
                        {relatedEvent.priceMessage && <span className="price-message" style={{ color: '#EF4444', marginLeft: '6px', fontWeight: 600 }}>{relatedEvent.priceMessage}</span>}
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
          <ShareModal event={event} onClose={() => setShowShareModal(false)} onShare={handleShareEvent} />
        )}
      </AnimatePresence>

      {/* Attendees Modal */}
      <AnimatePresence>
        {showAttendeesPopup && (
          <AttendeesModal
            onClose={() => setShowAttendeesPopup(false)}
            attendeesList={attendeesList}
            currentUser={currentUser}
          />
        )}
      </AnimatePresence>

    </div>
  );
};

export default EventDetails;
