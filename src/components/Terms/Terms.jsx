import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import './Terms.scss';

const Terms = () => {
  return (
    <div className="terms-page container">
      <motion.div 
        className="terms-card glass"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <div className="icon-wrapper">
          <motion.div
            animate={{ scale: [1, 1.05, 1], rotate: [0, 1.5, -1.5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <FileText size={48} className="terms-icon" />
          </motion.div>
        </div>

        <h1 className="terms-title">Terms & Conditions</h1>
        
        <div className="coming-soon-badge">
          <span>Coming Soon</span>
        </div>

        <p className="terms-desc">
          We are currently finalizing our complete standard terms, event regulations, and user cancellation policies to provide the safest and most reliable booking experience.
        </p>

        <p className="terms-note">
          Please check back shortly. All active bookings remain subject to our standard event guidelines and customer protection policies.
        </p>

        <div className="terms-actions">
          <Link to="/" className="home-btn">
            <ArrowLeft size={18} />
            <span>Back to Home</span>
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default Terms;
