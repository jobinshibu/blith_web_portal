import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar/Navbar'
import Events from './components/Events/Events'
import EventDetails from './components/Events/EventDetails'
import EventBookingPage from './components/Events/EventBookingPage'
import Footer from './components/Footer/Footer'
import ScrollToTop from './components/ScrollToTop'
import './styles/main.scss'

function App() {
  return (
    <div className="app-container">
      <ScrollToTop />
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Events />} />
          <Route path="/events" element={<Events />} />
          <Route path="/events/:id" element={<EventDetails />} />
          <Route path="/events/:id/book" element={<EventBookingPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

export default App
