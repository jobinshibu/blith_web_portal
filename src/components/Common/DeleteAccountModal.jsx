import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Loader2, X, ShieldCheck, KeyRound, ArrowRight, RefreshCw, CheckCircle2, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { sendOtpMsg91, verifyOtpMsg91 } from '../../services/otpService';
import './DeleteAccountModal.scss';

const RESEND_COOLDOWN_SECONDS = 30;

const DeleteAccountModal = ({
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false,
  user = null
}) => {
  // Step: 'warning' -> 'otp'
  const [step, setStep] = useState('warning');
  const [otp, setOtp] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [otpError, setOtpError] = useState('');
  const timerRef = useRef(null);
  const inputRef = useRef(null);

  // Extract phone number and country code
  const rawPhone = user?.phone || user?.phoneNo || '';
  const digitsOnly = String(rawPhone).replace(/\D/g, '');
  const phoneNumber = digitsOnly.slice(-10);
  const countryCode = digitsOnly.length > 10 ? digitsOnly.slice(0, digitsOnly.length - 10) : '91';

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [isOpen]);

  // Reset state when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setStep('warning');
      setOtp('');
      setOtpError('');
      setIsSendingOtp(false);
      setIsVerifyingOtp(false);
      setResendTimer(0);
      if (timerRef.current) clearInterval(timerRef.current);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [isOpen]);

  // Focus OTP input when transitioning to OTP step
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 100);
    }
  }, [step]);

  // Countdown timer handler for OTP resend
  const startResendTimer = () => {
    setResendTimer(RESEND_COOLDOWN_SECONDS);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const [verifiedPhoneData, setVerifiedPhoneData] = useState(null);

  // Helper to securely fetch the real, authenticated phone number directly from Firestore DB
  const getSecureVerifiedPhone = async () => {
    if (!user || !user.uid) {
      throw new Error("Unable to identify account. Please log in again.");
    }

    // Always fetch latest data straight from Firestore using user.uid (cannot be tampered with via Inspect Element)
    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('../../firebase');
    const userDocRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userDocRef);

    if (!snap.exists()) {
      throw new Error("User account does not exist.");
    }

    const dbData = snap.data() || {};
    if (dbData.deleted === true) {
      throw new Error("This account is already deleted.");
    }

    const realPhoneRaw = dbData.phoneNo || dbData.phone || user.phoneNo || user.phone || '';
    const cleanDigits = String(realPhoneRaw).replace(/\D/g, '');
    const cleanPhone = cleanDigits.slice(-10);
    const cleanCountry = cleanDigits.length > 10 ? cleanDigits.slice(0, cleanDigits.length - 10) : '91';

    if (!cleanPhone || cleanPhone.length !== 10) {
      throw new Error("No verified 10-digit mobile number found on your account. Please contact support.");
    }

    const result = { phoneNumber: cleanPhone, countryCode: cleanCountry || '91' };
    setVerifiedPhoneData(result);
    return result;
  };

  const handleSendOtp = async () => {
    try {
      setIsSendingOtp(true);
      setOtpError('');

      // Securely fetch the real phone number directly from Firestore
      const securePhone = await getSecureVerifiedPhone();

      const res = await sendOtpMsg91({
        phoneNumber: securePhone.phoneNumber,
        countryCode: securePhone.countryCode
      });

      toast.success(res.message || "OTP sent to your registered mobile number.");
      setStep('otp');
      startResendTimer();
    } catch (err) {
      const msg = err.message || "Failed to send OTP.";
      toast.error(msg);
      setOtpError(msg);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0 || isSendingOtp) return;
    await handleSendOtp();
  };

  const handleVerifyAndConfirmDelete = async () => {
    const trimmedOtp = otp.trim();
    if (!trimmedOtp) {
      setOtpError("Please enter the OTP received.");
      return;
    }

    try {
      setIsVerifyingOtp(true);
      setOtpError('');

      // Always re-verify phone number from the secure Firestore fetch to prevent tampering in memory/DOM
      const securePhone = verifiedPhoneData || (await getSecureVerifiedPhone());

      const res = await verifyOtpMsg91({
        phoneNumber: securePhone.phoneNumber,
        countryCode: securePhone.countryCode,
        otp: trimmedOtp
      });

      if (res.success) {
        toast.success("OTP verified.");
        if (onConfirm) {
          await onConfirm();
        }
      }
    } catch (err) {
      const msg = err.message || "Invalid OTP. Please check and try again.";
      setOtpError(msg);
      toast.error(msg);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  if (!isOpen) return null;

  const isBusy = isSendingOtp || isVerifyingOtp || isDeleting;
  const activeDisplayPhone = verifiedPhoneData?.phoneNumber || phoneNumber;
  const activeDisplayCountry = verifiedPhoneData?.countryCode || countryCode;

  return (
    <AnimatePresence>
      <div className="delete-modal-overlay" onClick={isBusy ? undefined : onClose}>
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
          {!isBusy && (
            <button
              className="delete-modal-close-btn"
              onClick={onClose}
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>
          )}

          {step === 'warning' ? (
            <>
              {/* Warning Icon Badge */}
              <div className="delete-modal-icon-badge">
                <div className="icon-pulse"></div>
                <Trash2 size={28} className="trash-icon" />
              </div>

              <h3 id="delete-account-title" className="delete-modal-title">
                Delete Account?
              </h3>

              <p className="delete-modal-subtitle">
                Are you sure you want to delete your account?
              </p>

              {user && (
                <div className="delete-modal-user-summary">
                  <span className="summary-name">{user.name || 'Account'}</span>
                  {(user.phone || user.phoneNo || user.email) && (
                    <span className="summary-identifier">
                      {user.phone || user.phoneNo || user.email}
                    </span>
                  )}
                </div>
              )}

              <div className="delete-modal-notice-box">
                <ul>
                  <li>Your customer account and profile will be deleted.</li>
                  <li>This action will permanently delete all your bookings and booking history.</li>
                  <li>You will be logged out of your session on this device.</li>
                </ul>

                <div className="delete-otp-info-warning">
                  <ShieldAlert size={16} className="otp-warn-icon" />
                  <span>
                    To protect your account, an SMS verification OTP will be sent to your registered mobile number upon clicking <strong>Delete Account</strong>.
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="delete-modal-actions">
                <button
                  type="button"
                  className="btn-confirm-delete"
                  onClick={handleSendOtp}
                  disabled={isBusy}
                >
                  {isSendingOtp ? (
                    <>
                      <Loader2 size={16} className="spin-loader" />
                      <span>Sending OTP...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      <span>Delete Account</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="btn-keep-account btn-cancel"
                  onClick={onClose}
                  disabled={isBusy}
                >
                  <ShieldCheck size={18} />
                  <span>No, Keep Account</span>
                </button>
              </div>
            </>
          ) : (
            <>
              {/* OTP Verification Step */}
              <div className="delete-modal-icon-badge otp-badge">
                <div className="icon-pulse otp-pulse"></div>
                <KeyRound size={28} className="key-icon" />
              </div>

              <h3 id="delete-account-title" className="delete-modal-title">
                Verify OTP
              </h3>

              <p className="delete-modal-subtitle">
                Enter the OTP sent to <strong>+{activeDisplayCountry} {activeDisplayPhone ? `${activeDisplayPhone.slice(0, 2)}••••${activeDisplayPhone.slice(-4)}` : ''}</strong> to confirm permanent deletion.
              </p>

              <div className="delete-modal-otp-container">
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="Enter OTP"
                  value={otp}
                  onChange={(e) => {
                    setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setOtpError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && otp.trim() && !isBusy) {
                      handleVerifyAndConfirmDelete();
                    }
                  }}
                  disabled={isBusy}
                  className={`delete-otp-input ${otpError ? 'has-error' : ''}`}
                />

                {otpError && (
                  <p className="delete-otp-error-text">{otpError}</p>
                )}

                <div className="delete-otp-resend-row">
                  {resendTimer > 0 ? (
                    <span className="resend-countdown">
                      Resend OTP in <strong>{resendTimer}s</strong>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn-resend-otp"
                      onClick={handleResendOtp}
                      disabled={isBusy}
                    >
                      <RefreshCw size={13} className={isSendingOtp ? 'spin-loader' : ''} />
                      <span>{isSendingOtp ? 'Sending...' : 'Resend OTP'}</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="delete-modal-actions">
                <button
                  type="button"
                  className="btn-confirm-delete"
                  onClick={handleVerifyAndConfirmDelete}
                  disabled={isBusy || !otp.trim()}
                >
                  {isVerifyingOtp || isDeleting ? (
                    <>
                      <Loader2 size={16} className="spin-loader" />
                      <span>{isVerifyingOtp ? 'Verifying OTP...' : 'Deleting...'}</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      <span>Verify & Delete</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="btn-keep-account btn-cancel"
                  onClick={() => {
                    setStep('warning');
                    setOtp('');
                    setOtpError('');
                  }}
                  disabled={isBusy}
                >
                  <span>Back</span>
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default DeleteAccountModal;
