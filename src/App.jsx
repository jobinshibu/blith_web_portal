import React from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar/Navbar'
import Events from './components/Events/Events'
import EventDetails from './components/Events/EventDetails'
import EventBookingPage from './components/Events/EventBookingPage'
import LinkTree from './components/LinkTree/LinkTree'
import Terms from './components/Terms/Terms'
import Footer from './components/Footer/Footer'
import ScrollToTop from './components/ScrollToTop'
import './styles/main.scss'

function App() {
  const location = useLocation();
  const isLinkTree = location.pathname === '/links';

  return (
    <div className="app-container">
      <ScrollToTop />
      {!isLinkTree && <Navbar />}
      <main>
        <Routes>
          <Route path="/" element={<Events />} />
          <Route path="/events" element={<Events />} />
          <Route path="/events/:id" element={<EventDetails />} />
          <Route path="/events/:id/book" element={<EventBookingPage />} />
          <Route path="/links" element={<LinkTree />} />
          <Route path="/terms" element={<Terms />} />
        </Routes>
      </main>
      {!isLinkTree && <Footer />}
    </div>
  )
}

export default App
