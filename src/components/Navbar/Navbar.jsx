import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import logoText from '../../assets/logo-text.png';
import ProfileDashboardModal from './ProfileDashboardModal';
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
  const [currentUser, setCurrentUser] = useState(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const location = useLocation();

  const isEventsPage = location.pathname === '/' || location.pathname === '/events' || location.pathname === '/events/';

  const loadUser = () => {
    try {
      const cachedDetails = sessionStorage.getItem('blithe_checkout_attendee');
      if (cachedDetails) {
        setCurrentUser(JSON.parse(cachedDetails));
      } else {
        setCurrentUser(null);
      }
    } catch (err) {
      console.warn("[Navbar] Failed to load session user:", err);
    }
  };

  useEffect(() => {
    loadUser();

    const handleSessionChange = () => {
      loadUser();
    };

    window.addEventListener('session-user-changed', handleSessionChange);
    return () => {
      window.removeEventListener('session-user-changed', handleSessionChange);
    };
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.nav-profile-wrapper')) {
        setIsProfileOpen(false);
      }
    };
    if (isProfileOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isProfileOpen]);

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

  const handleLogout = () => {
    sessionStorage.removeItem('blithe_checkout_attendee');
    setCurrentUser(null);
    setIsProfileOpen(false);
    window.dispatchEvent(new CustomEvent('session-user-changed'));
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
          <a href="/about.html#how-it-works" className="nav-link">How it Works</a>
          <a href="/about.html#for-creators" className="nav-link">For Creators</a>
          <a href="/about.html#discover" className="nav-link">Discover</a>
          <a href="/teams" className="nav-link">Team</a>
          <a href="/about.html" className="nav-link">About Us</a>
          {!isEventsPage && <Link to="/events" className="nav-pill">Explore Events</Link>}
          {currentUser && (
            <div className="nav-profile-wrapper">
              <button className="nav-profile-trigger" onClick={() => setIsProfileOpen(!isProfileOpen)} aria-label="Open Profile">
                {currentUser.profilePic ? (
                  <img src={currentUser.profilePic} alt={currentUser.fetchedUserName || currentUser.name} className="nav-avatar-img" />
                ) : (
                  <span className="nav-avatar-initial">
                    {(currentUser.fetchedUserName || currentUser.name) ? (currentUser.fetchedUserName || currentUser.name).charAt(0).toUpperCase() : <User size={14} />}
                  </span>
                )}
              </button>
              {isProfileOpen && (
                <ProfileDashboardModal
                  isOpen={isProfileOpen}
                  onClose={() => setIsProfileOpen(false)}
                  onLogout={handleLogout}
                  user={{ ...currentUser, name: currentUser.fetchedUserName !== undefined ? currentUser.fetchedUserName : currentUser.name }}
                />
              )}
            </div>
          )}
        </div>

        <div className="mobile-actions-group">
          {!isEventsPage && (
            <Link to="/events" className="nav-pill mobile-explore-btn" onClick={closeMenu}>
              Explore Events
            </Link>
          )}
          {currentUser && (
            <div className="nav-profile-wrapper">
              <button className="nav-profile-trigger mobile-avatar-trigger" onClick={() => setIsProfileOpen(!isProfileOpen)} aria-label="Open Profile">
                {currentUser.profilePic ? (
                  <img src={currentUser.profilePic} alt={currentUser.fetchedUserName || currentUser.name} className="nav-avatar-img" />
                ) : (
                  <span className="nav-avatar-initial">
                    {(currentUser.fetchedUserName || currentUser.name) ? (currentUser.fetchedUserName || currentUser.name).charAt(0).toUpperCase() : <User size={12} />}
                  </span>
                )}
              </button>
              {isProfileOpen && (
                <ProfileDashboardModal
                  isOpen={isProfileOpen}
                  onClose={() => setIsProfileOpen(false)}
                  onLogout={handleLogout}
                  user={{ ...currentUser, name: currentUser.fetchedUserName !== undefined ? currentUser.fetchedUserName : currentUser.name }}
                />
              )}
            </div>
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
                    { name: 'How it Works', path: '/about.html#how-it-works' },
                    { name: 'For Creators', path: '/about.html#for-creators' },
                    { name: 'Discover', path: '/about.html#discover', isDiscover: true },
                    { name: 'Team', path: '/teams' },
                    { name: 'About Us', path: '/about.html' }
                  ].map((link, i) => (
                    <motion.div key={i} variants={itemVariants} className="mobile-nav-item">
                      <a href={link.path} className={`mobile-nav-link ${link.isDiscover ? 'discover' : ''}`} onClick={closeMenu}>
                        {link.name}
                      </a>
                    </motion.div>
                  ))}
                  {currentUser && (
                    <motion.div variants={itemVariants} className="mobile-nav-item">
                      <button
                        className="mobile-nav-link discover"
                        onClick={() => {
                          closeMenu();
                          setIsProfileOpen(true);
                        }}
                        style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        My Profile Dashboard
                      </button>
                    </motion.div>
                  )}
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
                    <p>hello@blithe.social</p>
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
