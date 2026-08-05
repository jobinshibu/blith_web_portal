import React, { Suspense, lazy } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Navbar from './components/Navbar/Navbar'
import Footer from './components/Footer/Footer'
import ScrollToTop from './components/ScrollToTop'
import { initLeadTracking } from './services/leadService'
import './styles/main.scss'

const Events = lazy(() => import('./components/Events/Events'))
const EventDetails = lazy(() => import('./components/Events/EventDetails'))
const EventBookingPage = lazy(() => import('./components/Events/EventBookingPage'))
const BookingSuccess = lazy(() => import('./components/Events/BookingSuccess'))
const TicketView = lazy(() => import('./components/Events/TicketView'))
const LinkTree = lazy(() => import('./components/LinkTree/LinkTree'))
const Terms = lazy(() => import('./components/Terms/Terms'))

function App() {
  const location = useLocation();
  const isLinkTree = location.pathname === '/blithelink' || location.pathname === '/events/blithelink';
  const isTicketView = location.pathname.startsWith('/ticketView') || location.pathname.startsWith('/events/ticketView');
  const isStandalone = isLinkTree || isTicketView;

  React.useEffect(() => {
    initLeadTracking();
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
            <Route path="/ticketView/:eventId/:bookingId" element={<TicketView />} />
            <Route path="/booking-success" element={<BookingSuccess />} />
            <Route path="/blithelink" element={<LinkTree />} />
            <Route path="/terms" element={<Terms />} />
          </Routes>
        </Suspense>
      </main>
      {!isStandalone && <Footer />}
    </div>
  )
}

export default App
