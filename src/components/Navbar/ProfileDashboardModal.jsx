import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Phone } from 'lucide-react';
import logoTransparent from '../../assets/logo-transparent.png';

const ProfileDashboardModal = ({ isOpen, onClose, user }) => {
  // Helper to format date
  const formatDate = (dateVal) => {
    if (!dateVal) return 'TBA';
    const d = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="profile-dropdown-card glass"
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="profile-modal-header">
          <div className="profile-avatar-large">
            {user?.profilePic ? (
              <img src={user.profilePic} alt={user.name} />
            ) : (
              <span>{user?.name ? user.name.charAt(0).toUpperCase() : <User size={24} />}</span>
            )}
          </div>
          <div className="profile-title-group">
            <h3>{user?.name || 'User Profile'}</h3>
            {/* <p>Member since {formatDate(user?.createdTime || new Date())}</p> */}
          </div>
        </div>

        {/* Tab Content */}
        <div className="profile-tabs-content">
          <div className="tab-pane-profile">
            {/* User Info Details */}
            <div className="user-details-card">
              <div className="detail-item">
                <User size={16} className="detail-icon" />
                <div>
                  <span className="label">Full Name</span>
                  <span className="value">{user?.name || '—'}</span>
                </div>
              </div>
              <div className="detail-item">
                <Mail size={16} className="detail-icon" />
                <div>
                  <span className="label">Email Address</span>
                  <span className="value">{user?.email || '—'}</span>
                </div>
              </div>
              <div className="detail-item">
                <Phone size={16} className="detail-icon" />
                <div>
                  <span className="label">Mobile Number</span>
                  <span className="value">{user?.phone || user?.phoneNo || '—'}</span>
                </div>
              </div>
            </div>

            {/* App Download Info Banner */}
            <div className="app-download-section">
              <div className="app-download-header">
                <img src={logoTransparent} alt="Blithe App" className="app-logo" />
                <div>
                  <h4>To see more info, download</h4>
                  {/* <p>Scan tickets, browse offline, & receive instant event alerts.</p> */}
                </div>
              </div>
              <div className="download-buttons">
                <a href="https://play.google.com/store/apps/details?id=com.firstlogicmetalab.blith_user_app" target="_blank" rel="noopener noreferrer" className="badge-btn">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3.18 23.76c.3.17.64.24.98.21l12.94-12L13.06 8l-9.88 15.76zM20.5 10.22L17.67 8.6l-3.28 3.03 3.28 3.03 2.85-1.63c.81-.46.81-1.74-.02-2.81zM1.5.65C1.19.99 1 1.47 1 2.08v19.84c0 .61.19 1.09.5 1.43L1.62 23.4 13.06 12 1.62.6 1.5.65zM3.18.24L13.06 4 16.1 7.04 3.18.24z" />
                  </svg>
                  <div>
                    <span className="sub">Get it on</span>
                    <span className="main">Google Play</span>
                  </div>
                </a>
                <a href="https://apps.apple.com/in/app/blithe/id6473627877" target="_blank" rel="noopener noreferrer" className="badge-btn">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  <div>
                    <span className="sub">Download on the</span>
                    <span className="main">App Store</span>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ProfileDashboardModal;
