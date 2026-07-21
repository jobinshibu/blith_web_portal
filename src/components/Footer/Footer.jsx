import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { submitContactMessage } from '../../services/contactService';
import logoText from '../../assets/logo-text.png';
import './Footer.scss';

const Footer = () => {
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
  const [contactStatus, setContactStatus] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContactChange = (e) => {
    setContactForm({ ...contactForm, [e.target.name]: e.target.value });
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setContactStatus({ type: '', message: '' });
    
    if (!contactForm.name || !contactForm.email || !contactForm.message) {
      setContactStatus({ type: 'error', message: 'Please fill in all fields' });
      setIsSubmitting(false);
      return;
    }
    
    try {
      await submitContactMessage(contactForm);
      setContactStatus({ type: 'success', message: 'Message sent successfully! Please check your email.' });
      setContactForm({ name: '', email: '', message: '' });
    } catch (error) {
      setContactStatus({ type: 'error', message: error.message || 'Failed to send message. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <footer className="footer-container">
      <div className="footer-grid">
        {/* BRAND */}
        <div className="fg-brand">
          <Link to="/" className="logo-footer">
            <img src={logoText} alt="Blithe" style={{ mixBlendMode: 'multiply' }} />
          </Link>

          <p>
            The risk-free platform for creators to host events and seekers to find experiences based on their mood.
          </p>

          {/* SOCIAL ICONS (TOP) */}
          <div className="social-icons">
            <a href="https://www.facebook.com/profile.php?id=61573572029723" target="_blank" rel="noreferrer" className="social-icon">
              <svg viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </a>
            <a href="https://in.linkedin.com/company/blithe-social" target="_blank" rel="noreferrer" className="social-icon">
              <svg viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
            <a href="https://www.instagram.com/blithe.social" target="_blank" rel="noreferrer" className="social-icon">
              <svg viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324z" />
              </svg>
            </a>
            <a href="https://x.com/blithe_social" target="_blank" rel="noreferrer" className="social-icon">
              <svg viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a href="https://www.youtube.com/@Blithe.Social/shorts" target="_blank" rel="noreferrer" className="social-icon">
              <svg viewBox="0 0 24 24">
                <path d="M23.5 6.2a2.9 2.9 0 0 0-2-2C19.8 3.7 12 3.7 12 3.7s-7.8 0-9.5.5a2.9 2.9 0 0 0-2 2A30 30 0 0 0 0 12a30 30 0 0 0 .5 5.8 2.9 2.9 0 0 0 2 2c1.7.5 9.5.5 9.5.5s7.8 0 9.5-.5a2.9 2.9 0 0 0 2-2A30 30 0 0 0 24 12a30 30 0 0 0-.5-5.8zM9.7 15.5v-7l6.2 3.5-6.2 3.5z" />
              </svg>
            </a>
          </div>
        </div>

        {/* NAV */}
        <div className="fg-col">
          <h5>Explore</h5>
          <ul>
            <li><a href="https://blithe.social/#how-it-works">How it Works</a></li>
            <li><a href="https://blithe.social/#for-creators">For Creators</a></li>
            <li><a href="https://blithe.social/#discover">Discover</a></li>
            <li><a href="https://blithe.social/#testimonials">Testimonials</a></li>
          </ul>
        </div>

        {/* MORE */}
        <div className="fg-col">
          <h5>More</h5>
          <ul>
            <li><a href="https://blithe.social/#start">Start Hosting</a></li>
            <li><a href="https://blithe.social/teams">Team</a></li>
          </ul>
        </div>

        {/* LEGAL */}
        <div className="fg-col">
          <h5>Legal</h5>
          <ul>
            <li><a href="https://blithe.social/terms-and-conditions.php" target="_blank" rel="noreferrer">Terms</a></li>
            <li><a href="https://blithe.social/Privacy-Policy.php" target="_blank" rel="noreferrer">Privacy</a></li>
          </ul>
        </div>

        {/* SOCIAL LINKS (BOTTOM SECTION - RESTORED) */}
        <div className="fg-col">
          <h5>Social</h5>
          <ul>
            <li><a href="https://www.facebook.com/profile.php?id=61573572029723" target="_blank" rel="noreferrer">Facebook</a></li>
            <li><a href="https://in.linkedin.com/company/blithe-social" target="_blank" rel="noreferrer">LinkedIn</a></li>
            <li><a href="https://www.instagram.com/blithe.social" target="_blank" rel="noreferrer">Instagram</a></li>
            <li><a href="https://x.com/blithe_social" target="_blank" rel="noreferrer">Twitter</a></li>
            <li><a href="https://www.youtube.com/@Blithe.Social/shorts" target="_blank" rel="noreferrer">YouTube</a></li>
          </ul>
        </div>

        {/* CONTACT US (NEW) */}
        <div className="fg-col contact-col">
          <h5>Contact Us</h5>
          <form className="footer-contact-form" onSubmit={handleContactSubmit}>
            <input 
              type="text" 
              name="name" 
              placeholder="Your Name" 
              value={contactForm.name}
              onChange={handleContactChange}
              required
            />
            <input 
              type="email" 
              name="email" 
              placeholder="Your Email" 
              value={contactForm.email}
              onChange={handleContactChange}
              required
            />
            <textarea 
              name="message" 
              placeholder="Your Message" 
              rows="3"
              value={contactForm.message}
              onChange={handleContactChange}
              required
            ></textarea>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Sending...' : 'Send Message'}
            </button>
            {contactStatus.message && (
              <p className={`contact-status ${contactStatus.type}`}>
                {contactStatus.message}
              </p>
            )}
          </form>
        </div>
      </div>

      {/* BOTTOM */}
      <div className="footer-btm">
        <p>© {new Date().getFullYear()} Blithe. All rights reserved.</p>
        <div className="footer-btm-links">
          <a href="https://blithe.social/#how-it-works">Explore</a>
          <a href="https://blithe.social/#start">Start</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
