import React, { Suspense, lazy } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Navbar from './components/Navbar/Navbar'
import Footer from './components/Footer/Footer'
import ScrollToTop from './components/ScrollToTop'
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'
import { initLeadTracking } from './services/leadService'
import './styles/main.scss'

// Preload primary Events component immediately to eliminate router suspense waterfall
const eventsImportPromise = import('./components/Events/Events');
const Events = lazy(() => eventsImportPromise);
const EventDetails = lazy(() => import('./components/Events/EventDetails'))
const EventBookingPage = lazy(() => import('./components/Events/EventBookingPage'))
const BookingSuccess = lazy(() => import('./components/Events/BookingSuccess'))
const TicketView = lazy(() => import('./components/Events/TicketView'))
const LinkTree = lazy(() => import('./components/LinkTree/LinkTree'))
const Terms = lazy(() => import('./components/Terms/Terms'))
const VenuePartner = lazy(() => import('./components/VenuePartner/VenuePartner'))
const DeleteAccount = lazy(() => import('./components/DeleteAccount/DeleteAccount'))

import { useNetworkStatus } from './hooks/useNetworkStatus'

function App() {
  useNetworkStatus();
  const location = useLocation();
  const isLinkTree = location.pathname === '/blithelink' || location.pathname === '/events/blithelink';
  const isTicketView = location.pathname.startsWith('/ticketView') || location.pathname.startsWith('/events/ticketView');
  const isStandalone = isLinkTree || isTicketView;

  React.useEffect(() => {
    initLeadTracking();

    // Ensure an auth session exists on entire site entry (e.g. landing via ads or direct)
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        try {
          const cred = await signInAnonymously(auth);
          console.log('[Auth] Anonymous session initialized on site entry:', cred.user.uid);
        } catch (err) {
          console.warn('[Auth] Anonymous sign-in failed on site entry:', err);
        }
      } else {
        console.log('[Auth] Active session found on site entry:', user.uid, 'isAnonymous:', user.isAnonymous);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="app-container">
      <Toaster position="top-center" reverseOrder={false} />
      <ScrollToTop />
      {!isStandalone && <Navbar />}
      <main>
        <Suspense fallback={<div className="loading-fallback" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}></div>}>
          <Routes>
            <Route path="/" element={<Events />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/blithelink" element={<LinkTree />} />
            <Route path="/events/booking-success" element={<BookingSuccess />} />
            <Route path="/events/ticketView/:eventId/:bookingId" element={<TicketView />} />
            <Route path="/events/terms" element={<Terms />} />
            <Route path="/events/:id" element={<EventDetails />} />
            <Route path="/events/:id/book" element={<EventBookingPage />} />
            <Route path="/:id/book" element={<EventBookingPage />} />
            <Route path="/ticketView/:eventId/:bookingId" element={<TicketView />} />
            <Route path="/booking-success" element={<BookingSuccess />} />
            <Route path="/blithelink" element={<LinkTree />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/venue" element={<VenuePartner />} />
            <Route path="/venues" element={<VenuePartner />} />
            <Route path="/events/venue" element={<VenuePartner />} />
            <Route path="/events/venues" element={<VenuePartner />} />
            <Route path="/delete-account" element={<DeleteAccount />} />
            <Route path="/events/delete-account" element={<DeleteAccount />} />
          </Routes>
        </Suspense>
      </main>
      {!isStandalone && <Footer />}
    </div>
  )
}

export default App

