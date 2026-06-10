import React from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Navbar from './components/Navbar/Navbar'
import Events from './components/Events/Events'
import EventDetails from './components/Events/EventDetails'
import EventBookingPage from './components/Events/EventBookingPage'
import BookingSuccess from './components/Events/BookingSuccess'
import LinkTree from './components/LinkTree/LinkTree'
import Terms from './components/Terms/Terms'
import Footer from './components/Footer/Footer'
import ScrollToTop from './components/ScrollToTop'
import './styles/main.scss'

function App() {
  const location = useLocation();
  const isLinkTree = location.pathname === '/blithelink' || location.pathname === '/events/blithelink';

  return (
    <div className="app-container">
      <Toaster position="top-center" reverseOrder={false} />
      <ScrollToTop />
      {!isLinkTree && <Navbar />}
      <main>
        <Routes>
          <Route path="/" element={<Events />} />
          <Route path="/events" element={<Events />} />
          <Route path="/events/blithelink" element={<LinkTree />} />
          <Route path="/events/booking-success" element={<BookingSuccess />} />
          <Route path="/events/terms" element={<Terms />} />
          <Route path="/events/:id" element={<EventDetails />} />
          <Route path="/events/:id/book" element={<EventBookingPage />} />
          <Route path="/booking-success" element={<BookingSuccess />} />
          <Route path="/blithelink" element={<LinkTree />} />
          <Route path="/terms" element={<Terms />} />
        </Routes>
      </main>
      {!isLinkTree && <Footer />}
    </div>
  )
}

export default App
