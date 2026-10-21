import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Trash2, 
  ArrowLeft, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  Mail, 
  Phone, 
  HelpCircle,
  Loader2,
  ShieldAlert
} from 'lucide-react';
import toast from 'react-hot-toast';
import { findActiveUserByIdentifier, softDeleteUser } from '../../services/userService';
import DeleteAccountModal from '../Common/DeleteAccountModal';
import './DeleteAccount.scss';

const DeleteAccount = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [searchIdentifier, setSearchIdentifier] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [foundUser, setFoundUser] = useState(null);

  // Modal & Deletion states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [deletedUserInfo, setDeletedUserInfo] = useState(null);

  // Ownership verification states for unauthenticated requests
  const [verificationInput, setVerificationInput] = useState('');
  const [isOwnershipVerified, setIsOwnershipVerified] = useState(false);
  const [verificationError, setVerificationError] = useState('');

  // Load session user if logged in
  useEffect(() => {
    try {
      const cached = localStorage.getItem('blithe_checkout_attendee') || sessionStorage.getItem('blithe_checkout_attendee');
      if (cached) {
        const parsed = JSON.parse(cached);
        setCurrentUser(parsed);
      }
    } catch (e) {
      console.warn("[DeleteAccount] Failed to parse session user:", e);
    }
  }, []);

  // Helper to mask identifier (email or phone) for privacy
  const maskIdentifier = (str) => {
    if (!str) return '—';
    if (str.includes('@')) {
      const [name, domain] = str.split('@');
      if (name.length <= 2) return `*@${domain}`;
      return `${name.charAt(0)}${'*'.repeat(name.length - 2)}${name.slice(-1)}@${domain}`;
    }
    const digits = str.replace(/\D/g, '');
    if (digits.length >= 10) {
      return `+${digits.slice(0, 2)} ******${digits.slice(-4)}`;
    }
    return '******' + str.slice(-4);
  };

  const handleSearchAccount = async (e) => {
    e.preventDefault();
    setSearchError('');
    setFoundUser(null);
    setIsOwnershipVerified(false);
    setVerificationInput('');
    setVerificationError('');

    const trimmed = searchIdentifier.trim();
    if (!trimmed) {
      setSearchError('Please enter your registered mobile number or email.');
      return;
    }

    try {
      setIsSearching(true);
      const user = await findActiveUserByIdentifier(trimmed);
      if (!user) {
        setSearchError('No active Blithe account was found with the provided details. It may already have been deleted or the details may be incorrect.');
      } else {
        setFoundUser(user);
      }
    } catch (err) {
      console.error("[DeleteAccount] Search failed:", err);
      setSearchError(err.message || 'An error occurred while finding your account. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleVerifyOwnership = (e) => {
    e.preventDefault();
    setVerificationError('');
    if (!foundUser) return;

    const val = verificationInput.trim().toLowerCase();
    if (!val) {
      setVerificationError('Please enter your matching credential for verification.');
      return;
    }

    const searchedIsEmail = searchIdentifier.includes('@');
    if (searchedIsEmail) {
      // Must verify with phone
      const inputDigits = val.replace(/\D/g, '').slice(-10);
      const userPhoneDigits = String(foundUser.phoneNo || '').replace(/\D/g, '').slice(-10);
      if (inputDigits && inputDigits === userPhoneDigits) {
        setIsOwnershipVerified(true);
        setVerificationError('');
        toast.success('Account ownership verified successfully.');
      } else {
        setVerificationError('The mobile number provided does not match our records for this account.');
      }
    } else {
      // Must verify with email
      const userEmail = String(foundUser.email || '').trim().toLowerCase();
      if (val === userEmail) {
        setIsOwnershipVerified(true);
        setVerificationError('');
        toast.success('Account ownership verified successfully.');
      } else {
        setVerificationError('The email address provided does not match our records for this account.');
      }
    }
  };

  const targetUser = currentUser || foundUser;

  const handleConfirmDelete = async () => {
    if (!targetUser || !targetUser.uid) {
      toast.error('No account selected for deletion.');
      return;
    }

    // Security Check: Enforce ownership verification for unauthenticated users
    if (!currentUser && !isOwnershipVerified) {
      toast.error('Account ownership verification is required before deletion can be processed.');
      return;
    }

    try {
      setIsDeleting(true);
      await softDeleteUser(targetUser.uid);

      // If the logged in user was the deleted user, clear storage
      if (currentUser && currentUser.uid === targetUser.uid) {
        localStorage.removeItem('blithe_checkout_attendee');
        sessionStorage.removeItem('blithe_checkout_attendee');
        window.dispatchEvent(new CustomEvent('session-user-changed'));
        setCurrentUser(null);
      }

      setDeletedUserInfo(targetUser);
      setIsSuccess(true);
      setIsDeleteModalOpen(false);
      setFoundUser(null);
      setSearchIdentifier('');
      setIsOwnershipVerified(false);
      setVerificationInput('');
      toast.success('Your Blithe account has been successfully deleted.');
    } catch (err) {
      console.error("[DeleteAccount] Error during deletion:", err);
      toast.error(err.message || 'Failed to delete account. Please try again or contact support.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="delete-account-page container">
      <motion.div
        className="delete-account-card glass"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {/* Top Icon Badge */}
        <div className="icon-wrapper">
          <motion.div
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ShieldAlert size={36} className="header-icon" />
          </motion.div>
        </div>

        <h1 className="page-title">Delete Account</h1>
        <p className="page-desc">
          We believe in giving you complete control over your personal data. You can delete your customer account below at any time.
        </p>

        {/* SUCCESS VIEW */}
        {isSuccess ? (
          <div className="success-container">
            <div className="success-icon-badge">
              <CheckCircle2 size={44} className="check-icon" />
            </div>
            <h2 className="success-title">Account Successfully Deleted</h2>
            <p className="success-text">
              The account for <strong>{deletedUserInfo?.name || 'Customer'}</strong> has been deleted.
              You have been logged out, and all associated bookings and profile records have been permanently removed.
            </p>
            <div className="success-notice">
              <p>
                Your account and booking data have been removed from our systems in accordance with your request.
              </p>
            </div>
            <Link to="/" className="home-btn primary">
              <ArrowLeft size={18} />
              <span>Back to Home</span>
            </Link>
          </div>
        ) : (
          <>
            {/* SCENARIO 1: LOGGED-IN CUSTOMER */}
            {currentUser ? (
              <div className="account-section">
                <div className="active-user-box">
                  <div className="user-avatar-pill">
                    <User size={20} />
                  </div>
                  <div className="user-meta">
                    <span className="user-role-tag">Active Session</span>
                    <h3 className="user-name">{currentUser.name || 'User'}</h3>
                    <div className="user-contacts">
                      {currentUser.phone && (
                        <span><Phone size={13} /> {currentUser.phone}</span>
                      )}
                      {currentUser.email && (
                        <span><Mail size={13} /> {currentUser.email}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="account-action-row">
                  <button
                    type="button"
                    className="trigger-delete-btn"
                    onClick={() => setIsDeleteModalOpen(true)}
                  >
                    <Trash2 size={16} />
                    <span>Delete My Account</span>
                  </button>
                </div>
              </div>
            ) : (
              /* SCENARIO 2: NOT LOGGED IN - LOOKUP VIA MOBILE OR EMAIL */
              <div className="lookup-section">
                <form className="lookup-form" onSubmit={handleSearchAccount}>
                  <label htmlFor="searchIdentifier" className="form-label">
                    Enter your registered Mobile Number or Email Address:
                  </label>
                  <div className="input-group">
                    <div className="input-icon">
                      <Search size={18} />
                    </div>
                    <input
                      id="searchIdentifier"
                      type="text"
                      className="identifier-input"
                      placeholder="e.g. 9876543210 or yourname@gmail.com"
                      value={searchIdentifier}
                      onChange={(e) => {
                        setSearchIdentifier(e.target.value);
                        setSearchError('');
                      }}
                      disabled={isSearching}
                      required
                    />
                    <button
                      type="submit"
                      className="lookup-btn"
                      disabled={isSearching || !searchIdentifier.trim()}
                    >
                      {isSearching ? (
                        <>
                          <Loader2 size={16} className="spin-icon" />
                          <span>Finding...</span>
                        </>
                      ) : (
                        <span>Find Account</span>
                      )}
                    </button>
                  </div>
                </form>

                {searchError && (
                  <div className="lookup-error-banner">
                    <AlertCircle size={16} />
                    <span>{searchError}</span>
                  </div>
                )}

                {/* Found Account Preview Card */}
                {foundUser && (
                  <motion.div
                    className="found-user-card"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="found-user-info">
                      <div className="user-badge">
                        <User size={18} />
                      </div>
                      <div>
                        <h4>{foundUser.name || 'Account Found'}</h4>
                        <p>
                          {foundUser.phoneNo && (
                            <span>Phone: {maskIdentifier(foundUser.phoneNo)}</span>
                          )}
                          {foundUser.email && (
                            <span> • Email: {maskIdentifier(foundUser.email)}</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {!isOwnershipVerified ? (
                      <div className="ownership-verification-box" style={{ marginTop: '16px', padding: '16px', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                          Security Verification: Please confirm your registered {searchIdentifier.includes('@') ? '10-digit mobile number' : 'email address'} to verify ownership before deleting:
                        </p>
                        <form onSubmit={handleVerifyOwnership} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <input
                            type={searchIdentifier.includes('@') ? 'tel' : 'email'}
                            value={verificationInput}
                            onChange={(e) => {
                              setVerificationInput(e.target.value);
                              setVerificationError('');
                            }}
                            placeholder={searchIdentifier.includes('@') ? 'Enter registered 10-digit phone' : 'Enter registered email'}
                            className="identifier-input"
                            style={{ flex: '1', minWidth: '220px' }}
                            required
                          />
                          <button type="submit" className="lookup-btn" style={{ whiteSpace: 'nowrap' }}>
                            Verify Ownership
                          </button>
                        </form>
                        {verificationError && (
                          <p style={{ color: '#EF4444', fontSize: '0.8rem', marginTop: '6px' }}>
                            {verificationError}
                          </p>
                        )}
                      </div>
                    ) : (
                      <>
                        <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '6px', color: '#059669', fontSize: '0.875rem', fontWeight: 500 }}>
                          <CheckCircle2 size={16} />
                          <span>Ownership verified. You may now proceed with account deletion.</span>
                        </div>

                        <button
                          type="button"
                          className="trigger-delete-btn"
                          onClick={() => setIsDeleteModalOpen(true)}
                          style={{ marginTop: '16px' }}
                        >
                          <Trash2 size={16} />
                          <span>Delete This Account</span>
                        </button>
                      </>
                    )}
                  </motion.div>
                )}
              </div>
            )}

            {/* Information & Policies */}
            <div className="deletion-info-accordion">
              <div className="info-item">
                <h4>
                  <HelpCircle size={16} className="info-icon" />
                  What happens when I delete my account?
                </h4>
                <p>
                  Deleting your account permanently removes your customer profile and personal details. You will be signed out on all devices immediately and will not be able to log in or retrieve account information.
                </p>
              </div>

              <div className="info-item">
                <h4>
                  <HelpCircle size={16} className="info-icon" />
                  What happens to my bookings and booking history?
                </h4>
                <p>
                  This action will permanently delete all your bookings, tickets, and booking history. Once deleted, this information cannot be recovered or restored.
                </p>
              </div>

              <div className="info-item">
                <h4>
                  <HelpCircle size={16} className="info-icon" />
                  Need support or have questions?
                </h4>
                <p>
                  If you have questions regarding your data or wish to cancel an active booking before deleting, please reach out to our team at{' '}
                  <a href="mailto:hello@blithe.social" className="support-link">
                    hello@blithe.social
                  </a>.
                </p>
              </div>
            </div>

            <div className="back-home-wrap">
              <Link to="/" className="home-btn secondary">
                <ArrowLeft size={16} />
                <span>Back to Home</span>
              </Link>
            </div>
          </>
        )}
      </motion.div>

      {/* Confirmation Modal: Normal Modal Yes/No */}
      <DeleteAccountModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
        user={targetUser}
      />
    </div>
  );
};

export default DeleteAccount;
