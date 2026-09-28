import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, Loader2, X } from 'lucide-react';
import './DeleteAccountModal.scss';

const DeleteAccountModal = ({
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false,
  user = null
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="delete-modal-overlay" onClick={isDeleting ? undefined : onClose}>
        <motion.div
          className="delete-modal-card"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
        >
          {/* Close button */}
          {!isDeleting && (
            <button
              className="delete-modal-close-btn"
              onClick={onClose}
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>
          )}

          {/* Warning Icon Badge */}
          <div className="delete-modal-icon-badge">
            <div className="icon-pulse"></div>
            <Trash2 size={28} className="trash-icon" />
          </div>

          <h3 id="delete-account-title" className="delete-modal-title">
            Delete Blithe Account?
          </h3>

          <p className="delete-modal-subtitle">
            Are you sure you want to delete your Blithe account?
          </p>

          {user && (
            <div className="delete-modal-user-summary">
              <span className="summary-name">{user.name || 'Account'}</span>
              {(user.email || user.phone || user.phoneNo) && (
                <span className="summary-identifier">
                  {user.phone || user.phoneNo || user.email}
                </span>
              )}
            </div>
          )}

          <div className="delete-modal-notice-box">
            <ul>
              <li>Your customer account and profile will be deactivated.</li>
              <li>You will be logged out of your session on this device.</li>
              <li>Past event bookings and tickets remain archived for venue check-in verification.</li>
            </ul>
          </div>

          {/* Action Buttons: Normal Modal Yes or No */}
          <div className="delete-modal-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={isDeleting}
            >
              No, Keep Account
            </button>

            <button
              type="button"
              className="btn-confirm-delete"
              onClick={onConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 size={16} className="spin-loader" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 size={16} />
                  <span>Yes, Delete Account</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default DeleteAccountModal;
