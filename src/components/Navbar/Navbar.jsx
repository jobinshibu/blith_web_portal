import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import logoText from '../../assets/fifablith.png';
import './Navbar.scss';

// Custom SVG Brand Icons
const FacebookIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
);
const TwitterIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" /></svg>
);
const InstagramIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
);

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const isEventsPage = location.pathname === '/' || location.pathname === '/events' || location.pathname === '/events/';

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
    if (!isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
    document.body.style.overflow = 'unset';
  };

  const menuVariants = {
    closed: { x: '100%' },
    open: {
      x: 0,
      transition: {
        type: 'spring',
        damping: 35,
        stiffness: 300,
        staggerChildren: 0.1,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    closed: { opacity: 0, y: 30 },
    open: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" }
    }
  };

  return (
    <>
      <nav className="navbar">
        <a href="https://blithe.social" className="logo" onClick={closeMenu}>
          <img src={logoText} alt="Blithe" className="nav-logo-text-img" />
        </a>

        <div className="nav-links desktop-only">
          <a href="https://blithe.social/#how-it-works" className="nav-link">How it Works</a>
          <a href="https://blithe.social/#for-creators" className="nav-link">For Creators</a>
          <a href="https://blithe.social/#discover" className="nav-link">Discover</a>
          {!isEventsPage && <Link to="/events" className="nav-pill">Explore Events</Link>}
        </div>

        <div className="mobile-actions-group">
          {!isEventsPage && (
            <Link to="/events" className="nav-pill mobile-explore-btn" onClick={closeMenu}>
              Explore Events
            </Link>
          )}
          <button className="mobile-menu-toggle" onClick={toggleMenu} aria-label="Toggle Menu">
            <Menu size={28} />
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            variants={menuVariants}
            initial="closed"
            animate="open"
            exit="closed"
            className="mobile-off-canvas"
          >
            <div className="menu-inner">
              <div className="menu-header">
                <a href="https://blithe.social" className="menu-logo" onClick={closeMenu}>
                  <img src={logoText} alt="Blithe" className="nav-logo-text-img" />
                </a>
                <button className="mobile-menu-close" onClick={closeMenu} aria-label="Close Menu">
                  <X size={28} />
                </button>
              </div>

              <div className="mobile-nav-links">
                <div className="links-center">
                  {[
                    { name: 'How it Works', path: 'https://blithe.social/#how-it-works' },
                    { name: 'For Creators', path: 'https://blithe.social/#for-creators' },
                    { name: 'Discover', path: 'https://blithe.social/#discover', isDiscover: true }
                  ].map((link, i) => (
                    <motion.div key={i} variants={itemVariants} className="mobile-nav-item">
                      <a href={link.path} className={`mobile-nav-link ${link.isDiscover ? 'discover' : ''}`} onClick={closeMenu}>
                        {link.name}
                      </a>
                    </motion.div>
                  ))}

                </div>
              </div>

              <motion.div variants={itemVariants} className="menu-footer">
                <div className="footer-content">
                  <p className="footer-label">Connect with us</p>
                  <div className="social-links">
                    <InstagramIcon />
                    <TwitterIcon />
                    <FacebookIcon />
                  </div>
                  <div className="contact-info">
                    <p>hello@blithe.com</p>
                    <p>© 2026 Blithe Studio</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
