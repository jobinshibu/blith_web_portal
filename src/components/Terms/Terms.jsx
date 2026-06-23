import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import './Terms.scss';

const Terms = () => {
  const [termsText, setTermsText] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTerms = async () => {
      try {
        const docRef = doc(db, 'settings', 'event');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && data.tAndC) {
            setTermsText(data.tAndC);
          }
        }
      } catch (err) {
        console.error("Error fetching Terms & Conditions:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTerms();
  }, []);

  const parseTerms = (text) => {
    if (!text) return [];
    if (text.includes('\n')) {
      return text.split('\n').map(t => t.trim()).filter(Boolean);
    }
    const parts = text.split(/(?=\d+\.\s+)/);
    if (parts.length > 1) {
      return parts.map(t => t.trim()).filter(Boolean);
    }
    return [text.trim()];
  };

  const cleanTermText = (text) => {
    if (!text) return '';
    return text.replace(/^\d+\.\s*/, '');
  };

  const termsList = parseTerms(termsText);

  if (loading) {
    return (
      <div className="terms-page container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <h2 style={{ color: '#7C3AED' }}>Loading terms & conditions...</h2>
      </div>
    );
  }

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
          {termsList.length > 0 ? (
            termsList.map((term, index) => (
              <div key={index} className="terms-item">
                <span className="terms-num">{index + 1}.</span>
                <p className="terms-text">{cleanTermText(term)}</p>
              </div>
            ))
          ) : (
            <p className="terms-text" style={{ textAlign: 'center' }}>No terms and conditions specified.</p>
          )}
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
