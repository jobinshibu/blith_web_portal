import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import './Terms.scss';

const Terms = () => {
  const termsList = [
    "By accepting, holding, or using a ticket, you acknowledge that you have read, understood, and agreed to these Terms & Conditions in full.",
    "Registration or possession of a ticket does not guarantee admission for free events and entry is strictly subject to capacity and availability.",
    "Event access details (where applicable) are personal and non-transferable.",
    "Recording, reproducing, distributing, or sharing any part of the event content without prior written consent is strictly prohibited.",
    "The Organiser reserves the right to deny admission or remove any participant for misconduct, non-compliance, or disruptive behaviour without prior notice and without obligation of refund, unless stated otherwise.",
    "Participants are responsible for meeting all event requirements, including timely attendance, necessary materials, and technical arrangements (if applicable).",
    "Blithe acts solely as a technology platform facilitating event discovery and registrations and is not responsible for event execution, content accuracy, venue arrangements, or technical issues.",
    "The Organiser reserves the right to reschedule, modify, or cancel the event due to unforeseen circumstances.",
    "By registering or purchasing a ticket, you agree to receive event-related communications from Blithe and the Organiser.",
    "Please note that once a ticket is booked in Blithe, it cannot be canceled."
  ];

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
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <FileText size={36} className="terms-icon" />
          </motion.div>
        </div>

        <h1 className="terms-title">Terms & Conditions</h1>
        
        <p className="terms-desc">
          Please read these terms and conditions carefully before booking or attending any event through Blithe.
        </p>

        <div className="terms-list">
          {termsList.map((term, index) => (
            <div key={index} className="terms-item">
              <span className="terms-num">{index + 1}.</span>
              <p className="terms-text">{term}</p>
            </div>
          ))}
        </div>

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
