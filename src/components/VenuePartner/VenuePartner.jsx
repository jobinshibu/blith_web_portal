import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Coffee,
  Palette,
  Beer,
  Sun,
  Compass,
  Users,
  Calendar,
  TrendingUp,
  ShieldCheck,
  HeartHandshake,
  ChevronDown,
  ArrowRight,
  ArrowDown,
  MapPin,
  Mail,
  Phone,
  Building2,
  Clock,
  Music,
  BookOpen,
  Smile,
  Send,
  Award,
  Layers
} from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { logEvent } from 'firebase/analytics';
import { db, analytics } from '../../firebase';
import { toast } from 'react-hot-toast';
import './VenuePartner.scss';

const VENUE_CATEGORIES = [
  {
    id: 'cafe',
    title: 'Cafés & Bakeries',
    icon: Coffee,
    tag: 'Cozy & Welcoming',
    description: 'Perfect for intimate book clubs, creative craft sessions, board game afternoons, and relaxed morning mixers.',
    popularTimes: 'Weekday mornings (8am - 11am), weekday afternoons (2pm - 5pm)',
    ideas: ['Book Clubs', 'Watercolor Mornings', 'Silent Reading Parties', 'Coffee Cupping Sessions']
  },
  {
    id: 'studios',
    title: 'Studios & Creative Spaces',
    icon: Palette,
    tag: 'Artistic & Dynamic',
    description: 'Spacious, well-lit spaces ideal for hands-on maker workshops, movement flow, pottery, and creative classes.',
    popularTimes: 'Weekday evenings (6pm - 9pm), weekend afternoons',
    ideas: ['Pottery & Clay', 'Paint & Sip Nights', 'Sound Healing & Yoga', 'Photography Meetups']
  },
  {
    id: 'breweries',
    title: 'Breweries, Bars & Bistros',
    icon: Beer,
    tag: 'Lively & Social',
    description: 'Bustling atmospheres waiting for vibrant energy before the late-night crowds arrive.',
    popularTimes: 'Tuesday & Wednesday evenings (6pm - 9pm), Sunday afternoons',
    ideas: ['Pub Trivia Leagues', 'Acoustic Evenings', 'Cocktail Mixology', 'Stand-up Comedy & Storytelling']
  },
  {
    id: 'rooftops',
    title: 'Rooftops, Gardens & Lawns',
    icon: Sun,
    tag: 'Open-Air & Scenic',
    description: 'Breathtaking outdoor venues designed for golden hour socials, sunset mixers, and community gatherings under the sky.',
    popularTimes: 'Weekend mornings (7am - 10am), Sunset slots (4pm - 7pm)',
    ideas: ['Sunset Acoustic Sets', 'Open-Air Cinema', 'Weekend Flea & Artisan Markets', 'Morning Flow & Brunch']
  },
  {
    id: 'boutique',
    title: 'Boutique & Alternative Spaces',
    icon: Compass,
    tag: 'Unique & Character-Rich',
    description: 'Bookstores, heritage courtyards, ceramic studios, and design shops with an unmistakable character.',
    popularTimes: 'Evenings after closing, specialized weekend slots',
    ideas: ['Author Salons & Poetry', 'Intimate Supper Clubs', 'Design Showcases', 'Listening Sessions']
  }
];

const EXPERIENCE_TYPES = [
  {
    icon: Palette,
    title: 'Hands-On Creative Workshops',
    description: 'Pottery, candle crafting, resin art, floral styling, and culinary masterclasses led by top local artisans.'
  },
  {
    icon: BookOpen,
    title: 'Social Clubs & Special Interests',
    description: 'Book clubs, board game leagues, creative writing circles, and tech founder networking meetups.'
  },
  {
    icon: Music,
    title: 'Acoustic Music & Listening Sessions',
    description: 'Intimate candlelit unplugged sets, vinyl record listening parties, and open mic evenings.'
  },
  {
    icon: Smile,
    title: 'Wellness & Mindfulness',
    description: 'Morning yoga circles paired with coffee, guided meditation, breathwork, and sound healing.'
  },
  {
    icon: Users,
    title: 'Interactive Games & Trivia',
    description: 'Themed pub quiz nights, murder mystery dinners, comedy roasts, and speed friend-making.'
  },
  {
    icon: Layers,
    title: 'Cultural & Supper Clubs',
    description: 'Chef pop-ups, wine & cheese pairings, storytelling jams, and cultural exchange dinners.'
  }
];

const WHY_BLITHE_POINTS = [
  {
    icon: ShieldCheck,
    title: '100% Vetted, Respectful Organizers',
    description: 'We do not allow random parties or reckless organizers. Every host is verified, passionate, and respects your venue guidelines.'
  },
  {
    icon: TrendingUp,
    title: 'Direct Footfall & Spend Uplift',
    description: 'Attendees don’t just attend—they buy food, drinks, coffee, and return as regular loyal patrons week after week.'
  },
  {
    icon: HeartHandshake,
    title: 'Zero Listing Fees or Risk',
    description: 'Listing your space on Blithe is completely free. We work on a collaborative model where we succeed when your space thrives.'
  },
  {
    icon: Calendar,
    title: 'Seamless Ticketing & RSVP Engine',
    description: 'Blithe handles payment processing, attendee ticketing, entry check-ins, and guest reminders smoothly.'
  }
];

const FAQS = [
  {
    q: 'Does it cost anything to list my venue on Blithe?',
    a: 'No! Listing your space on Blithe.Venue is 100% free. There are no upfront fees, subscription charges, or hidden maintenance costs. We only collaborate on ticketing or space usage when events run successfully.'
  },
  {
    q: 'How are event hosts and creators vetted?',
    a: 'Every host on Blithe goes through a curation process. We review their past events, content, audience profile, and format to make sure they align with your space’s brand and noise restrictions.'
  },
  {
    q: 'Do I maintain control over which events happen at my space?',
    a: 'Always. You have 100% control. Whenever a creator or our curation team proposes an event for your venue, you receive the full concept, timing, attendee count, and requirements for your explicit approval before anything is scheduled.'
  },
  {
    q: 'How does food and beverage revenue work?',
    a: 'Events bring in hungry and thirsty patrons! For most venues (cafés, breweries, bistros), you can set minimum spend requirements, curate event-specific tasting menus, or simply serve off your regular menu to attendees.'
  },
  {
    q: 'What days and time slots work best?',
    a: 'The highest-demand slots are typically quiet hours: Tuesday and Wednesday evenings, weekday afternoons (2pm - 5pm), Saturday/Sunday morning workshops, or after-hours spaces. However, you decide which hours to make available.'
  },
  {
    q: 'What happens in case of accidental damage or cleanliness issues?',
    a: 'Blithe hosts are required to leave spaces in the exact condition they found them. We establish clear ground rules with every creator before their session, and our partner support team is always on call.'
  }
];

const CheckIcon = () => (
  <span className="check-dot">
    <svg viewBox="0 0 24 24">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  </span>
);

const VenuePartner = () => {
  const [activeCategory, setActiveCategory] = useState(VENUE_CATEGORIES[0].id);
  const [openFaq, setOpenFaq] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [formData, setFormData] = useState({
    venueName: '',
    contactName: '',
    email: '',
    phone: '',
    cityArea: '',
    venueType: 'Café / Bakery',
    capacity: '',
    availableSlots: '',
    instagramUrl: '',
    notes: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.venueName || !formData.contactName || !formData.email || !formData.phone) {
      toast.error('Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Save to Firestore venue_partners collection
      await addDoc(collection(db, 'venue_partners'), {
        ...formData,
        createdAt: serverTimestamp(),
        source: 'blithe_venue_landing',
        status: 'pending'
      });

      // 2. Track analytics
      try {
        if (analytics) {
          logEvent(analytics, 'venue_partner_inquiry', {
            venue_name: formData.venueName,
            venue_type: formData.venueType,
            city_area: formData.cityArea
          });
        }
      } catch (analyticsErr) {
        console.warn('Analytics event error:', analyticsErr);
      }

      setIsSubmitted(true);
      toast.success('Thank you! Your venue application has been received.');
      setFormData({
        venueName: '',
        contactName: '',
        email: '',
        phone: '',
        cityArea: '',
        venueType: 'Café / Bakery',
        capacity: '',
        availableSlots: '',
        instagramUrl: '',
        notes: ''
      });
    } catch (err) {
      console.error('Error submitting venue partner application:', err);
      toast.error('Something went wrong. Please try again or email us directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="venue-partner-page">
      {/* 1. HERO SECTION */}
      <section className="venue-hero">
        <div className="container hero-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="eyebrow-pill">
              <Sparkles size={13} />
              <span>YOUR SPACE. MORE POSSIBILITIES.</span>
            </div>

            <h1 className="h1 hero-h">
              Turn your empty hours into something <em>worth coming back for.</em>
            </h1>

            <p className="body-lg hero-sub">
              Your space already has the vibe. We help bring the people, creators and experiences that make it come alive. List your venue with Blithe and let us help you fill those quiet hours with events, workshops, meetups and more.
            </p>

            <div className="hero-ctas">
              <button
                className="btn btn-solid"
                onClick={() => scrollToSection('partner-form')}
              >
                <span>Partner With Blithe</span>
                <ArrowRight size={16} />
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => scrollToSection('how-it-works')}
              >
                <span>See How It Works</span>
                <ArrowDown size={15} />
              </button>
            </div>

            <div className="hero-checks-row">
              <div className="hero-check-item">
                <CheckIcon />
                <span>Zero Listing Fees</span>
              </div>
              <div className="hero-check-item">
                <CheckIcon />
                <span>100% Host Vetting</span>
              </div>
              <div className="hero-check-item">
                <CheckIcon />
                <span>You Approve Every Event</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 2. THE PROBLEM */}
      <section className="venue-problem-section">
        <div className="container">
          <motion.div
            className="problem-box"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.45 }}
          >
            <span className="label problem-label">THE REALITY</span>
            <h2 className="h2 problem-heading">
              Your space shouldn't have to wait for the weekend.
            </h2>

            <div className="problem-scenarios-grid">
              <div className="scenario-card">
                <div className="scenario-icon-wrap">☕</div>
                <p>A great café can be quiet on a Tuesday.</p>
              </div>
              <div className="scenario-card">
                <div className="scenario-icon-wrap">🎨</div>
                <p>A beautiful studio can sit empty between classes.</p>
              </div>
              <div className="scenario-card">
                <div className="scenario-icon-wrap">🍻</div>
                <p>A brewery can have tables waiting for people long before the evening crowd arrives.</p>
              </div>
            </div>

            <div className="problem-bridge">
              <p className="bridge-punchline">
                The space is there. The opportunity is there.
              </p>
              <p className="bridge-body">
                You just need the right people to walk through the door. <strong>That's where Blithe comes in.</strong>
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 3. WHAT IS BLITHE.VENUE */}
      {/* <section className="venue-about-section">
        <div className="container">
          <div className="section-header center">
            <span className="label">COMMUNITY & SPACES</span>
            <h2 className="h2">Meet <em>Blithe.Venue</em></h2>
            <p className="body-lg">
              We connect character-rich neighborhood venues with verified creators, experience hosts, and local communities who need a home for their gatherings.
            </p>
          </div>

          <div className="about-features-grid">
            <div className="feature-item">
              <div className="feature-icon-box">
                <Building2 size={22} />
              </div>
              <h3 className="h3">Space Meets Culture</h3>
              <p className="body-sm">Turn underutilized seating into buzzing workshops, acoustic listening circles, book clubs, and art sessions.</p>
            </div>

            <div className="feature-item">
              <div className="feature-icon-box">
                <Users size={22} />
              </div>
              <h3 className="h3">Curated Community</h3>
              <p className="body-sm">We don't bring noisy, destructive crowds. We connect you with mindful organizers and eager attendees who respect your ambiance.</p>
            </div>

            <div className="feature-item">
              <div className="feature-icon-box">
                <TrendingUp size={22} />
              </div>
              <h3 className="h3">Sustainable Growth</h3>
              <p className="body-sm">Drive predictable weekly footfall and high-margin food & beverage sales during traditionally slow time windows.</p>
            </div>
          </div>
        </div>
      </section> */}

      {/* 4. WHY PARTNER */}
      {/* <section className="venue-why-partner">
        <div className="container">
          <div className="section-header">
            <span className="label">WHY PARTNER WITH US</span>
            <h2 className="h2">Why Venue Owners Love Blithe</h2>
            <p className="body-lg">
              Designed to help your space generate revenue, gain word-of-mouth recognition, and build loyal recurring patrons.
            </p>
          </div>

          <div className="why-partner-grid">
            <motion.div className="why-card" whileHover={{ y: -3 }} transition={{ duration: 0.2 }}>
              <div className="why-card-icon">
                <Clock size={24} />
              </div>
              <h3 className="h3">Monetize Quiet Hours</h3>
              <p>Fill non-peak time slots—weekday afternoons, Tuesday nights, or morning windows—without running extra marketing campaigns.</p>
            </motion.div>

            <motion.div className="why-card" whileHover={{ y: -3 }} transition={{ duration: 0.2 }}>
              <div className="why-card-icon">
                <HeartHandshake size={24} />
              </div>
              <h3 className="h3">Lifelong New Patrons</h3>
              <p>Event attendees discover your menu, fall in love with your vibe, and return on weekends with friends, family, and colleagues.</p>
            </motion.div>

            <motion.div className="why-card" whileHover={{ y: -3 }} transition={{ duration: 0.2 }}>
              <div className="why-card-icon">
                <Award size={24} />
              </div>
              <h3 className="h3">Become a Cultural Anchor</h3>
              <p>Stand out from ordinary commercial spots. Position your venue as the creative and social heartbeat of your neighborhood.</p>
            </motion.div>

            <motion.div className="why-card" whileHover={{ y: -3 }} transition={{ duration: 0.2 }}>
              <div className="why-card-icon">
                <ShieldCheck size={24} />
              </div>
              <h3 className="h3">Zero Operational Friction</h3>
              <p>Creators manage the agenda and guest check-ins. Your team simply provides the hospitality and serves your signature offerings.</p>
            </motion.div>
          </div>
        </div>
      </section> */}

      {/* 5. HOW IT WORKS */}
      {/* <section id="how-it-works" className="venue-how-it-works">
        <div className="container">
          <div className="section-header center">
            <span className="label">SIMPLE 4-STEP PROCESS</span>
            <h2 className="h2">How It Works</h2>
            <p className="body-lg">
              From your initial listing to your first bustling event, we make hosting smooth, safe, and rewarding.
            </p>
          </div>

          <div className="steps-timeline">
            <div className="step-card">
              <div className="step-number">01</div>
              <h3 className="h3">Share Your Space & Availability</h3>
              <p>Tell us about your venue's capacity, atmosphere, amenities, and preferred slow hours you'd love to activate.</p>
            </div>

            <div className="step-card">
              <div className="step-number">02</div>
              <h3 className="h3">Get Matched With Vetted Creators</h3>
              <p>We pair your space with experienced hosts and workshop organizers whose concepts naturally fit your brand and atmosphere.</p>
            </div>

            <div className="step-card">
              <div className="step-number">03</div>
              <h3 className="h3">Approve & Host Seamlessly</h3>
              <p>You have full veto power on any event. Once approved, Blithe handles discovery and ticketing while you welcome guests.</p>
            </div>

            <div className="step-card">
              <div className="step-number">04</div>
              <h3 className="h3">Grow Recurring Community Rituals</h3>
              <p>Turn one-off successes into weekly or monthly residencies that keep your calendars booked and tables active.</p>
            </div>
          </div>
        </div>
      </section> */}

      {/* 6. VENUE CATEGORIES */}
      {/* <section className="venue-categories-section">
        <div className="container">
          <div className="section-header">
            <span className="label">VENUE STYLES</span>
            <h2 className="h2">Spaces That Thrive On Blithe</h2>
            <p className="body-lg">
              Whatever your aesthetic or square footage, there's a community looking for a space just like yours.
            </p>
          </div>

          <div className="categories-tab-bar">
            {VENUE_CATEGORIES.map(cat => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  className={`cat-tab-btn ${activeCategory === cat.id ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  <Icon size={16} />
                  <span>{cat.title}</span>
                </button>
              );
            })}
          </div>

          <div className="category-detail-panel">
            {(() => {
              const active = VENUE_CATEGORIES.find(c => c.id === activeCategory) || VENUE_CATEGORIES[0];
              const Icon = active.icon;
              return (
                <div className="category-card-inner">
                  <div className="cat-card-header">
                    <div className="cat-icon-lg">
                      <Icon size={26} />
                    </div>
                    <div>
                      <span className="cat-badge">{active.tag}</span>
                      <h3 className="cat-title">{active.title}</h3>
                    </div>
                  </div>

                  <p className="cat-description">{active.description}</p>

                  <div className="cat-meta-grid">
                    <div className="meta-box">
                      <strong>✨ Best Time Windows</strong>
                      <p>{active.popularTimes}</p>
                    </div>

                    <div className="meta-box">
                      <strong>🎯 Popular Event Concepts</strong>
                      <div className="ideas-pill-list">
                        {active.ideas.map((idea, idx) => (
                          <span key={idx} className="idea-pill">{idea}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </section> */}

      {/* 7. EXPERIENCES */}
      {/* <section className="venue-experiences-section">
        <div className="container">
          <div className="section-header center">
            <span className="label">EVENT FORMATS</span>
            <h2 className="h2">Experiences Powered By Blithe</h2>
            <p className="body-lg">
              From creative hands-on making to soulful acoustic evenings, here is what our hosts bring to life.
            </p>
          </div>

          <div className="experiences-grid">
            {EXPERIENCE_TYPES.map((exp, idx) => {
              const Icon = exp.icon;
              return (
                <div key={idx} className="exp-card">
                  <div className="exp-icon-wrap">
                    <Icon size={22} />
                  </div>
                  <h3 className="h3">{exp.title}</h3>
                  <p>{exp.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section> */}

      {/* 8. WHY BLITHE */}
      {/* <section className="venue-why-blithe-section">
        <div className="container">
          <div className="why-blithe-box">
            <div className="section-header">
              <span className="label">THE BLITHE DIFFERENCE</span>
              <h2 className="h2">Built for Hospitality, Centered on Community</h2>
              <p className="body-lg">
                Unlike impersonal rental marketplaces, Blithe is a partner invested in your long-term neighborhood reputation.
              </p>
            </div>

            <div className="why-blithe-grid">
              {WHY_BLITHE_POINTS.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div key={idx} className="wb-point-card">
                    <div className="wb-icon-box">
                      <Icon size={22} />
                    </div>
                    <div>
                      <h3 className="h3">{item.title}</h3>
                      <p>{item.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section> */}

      {/* 9. SOCIAL PROOF & STATS */}
      {/* <section className="venue-social-proof-section">
        <div className="container">
          <div className="stats-row">
            <div className="stat-card">
              <span className="stat-number">40%+</span>
              <span className="stat-label">Footfall Boost in Slow Hours</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">88%</span>
              <span className="stat-label">Attendees Return as Regulars</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">100%</span>
              <span className="stat-label">Partner Approval on Every Host</span>
            </div>
          </div>

          <div className="testimonials-grid">
            <div className="testimonial-card">
              <p className="quote">
                "Our Tuesday evenings used to be completely dead. Now we host a recurring board game meetup and a book club that consistently brings in 25-30 people buying food and drinks."
              </p>
              <div className="author-info">
                <strong>Priya S.</strong>
                <span>Café & Bistro Owner, Indiranagar</span>
              </div>
            </div>

            <div className="testimonial-card">
              <p className="quote">
                "Blithe respects our space guidelines completely. Every host who comes in has been professional, organized, and leaves the studio spotless."
              </p>
              <div className="author-info">
                <strong>Arun M.</strong>
                <span>Art & Movement Studio Founder</span>
              </div>
            </div>
          </div>
        </div>
      </section> */}

      {/* 10. FAQ */}
      {/* <section className="venue-faq-section">
        <div className="container">
          <div className="section-header center">
            <span className="label">QUESTIONS & ANSWERS</span>
            <h2 className="h2">Frequently Asked Questions</h2>
            <p className="body-lg">
              Everything you need to know about partnering your venue with Blithe.
            </p>
          </div>

          <div className="faq-accordion">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={idx} className={`faq-item ${isOpen ? 'open' : ''}`}>
                  <button 
                    className="faq-question-btn" 
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    aria-expanded={isOpen}
                  >
                    <span>{faq.q}</span>
                    <ChevronDown className={`faq-arrow ${isOpen ? 'rotated' : ''}`} size={18} />
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div 
                        className="faq-answer-wrap"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.22 }}
                      >
                        <p className="faq-answer">{faq.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section> */}

      {/* 11. FINAL CTA / PARTNER APPLICATION FORM */}
      {/* <section id="partner-form" className="venue-form-section">
        <div className="container">
          <div className="form-wrapper">
            <div className="form-header">
              <span className="label">GET STARTED TODAY</span>
              <h2 className="h2">Ready to bring your space to life?</h2>
              <p className="body-lg">
                Fill in your details below and our team will get in touch within 24-48 hours to discuss ideas tailored to your venue.
              </p>
            </div>

            {isSubmitted ? (
              <motion.div 
                className="form-success-card"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div className="success-icon">
                  <CheckIcon />
                </div>
                <h3 className="h2">Application Received!</h3>
                <p>
                  Thank you for your interest in partnering with Blithe. Our community curation team will review your venue details and reach out shortly.
                </p>
                <button 
                  className="btn btn-solid" 
                  onClick={() => setIsSubmitted(false)}
                >
                  Submit Another Space
                </button>
              </motion.div>
            ) : (
              <form className="partner-form" onSubmit={handleSubmit}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Venue Name *</label>
                    <div className="input-with-icon">
                      <Building2 size={16} className="field-icon" />
                      <input 
                        type="text" 
                        name="venueName" 
                        placeholder="e.g. The Roastery Café" 
                        value={formData.venueName} 
                        onChange={handleInputChange} 
                        required 
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Your Name / Role *</label>
                    <div className="input-with-icon">
                      <Users size={16} className="field-icon" />
                      <input 
                        type="text" 
                        name="contactName" 
                        placeholder="e.g. Rahul (Owner / Manager)" 
                        value={formData.contactName} 
                        onChange={handleInputChange} 
                        required 
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Email Address *</label>
                    <div className="input-with-icon">
                      <Mail size={16} className="field-icon" />
                      <input 
                        type="email" 
                        name="email" 
                        placeholder="e.g. hello@yourvenue.com" 
                        value={formData.email} 
                        onChange={handleInputChange} 
                        required 
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Phone / WhatsApp Number *</label>
                    <div className="input-with-icon">
                      <Phone size={16} className="field-icon" />
                      <input 
                        type="tel" 
                        name="phone" 
                        placeholder="e.g. +91 98765 43210" 
                        value={formData.phone} 
                        onChange={handleInputChange} 
                        required 
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>City & Neighborhood *</label>
                    <div className="input-with-icon">
                      <MapPin size={16} className="field-icon" />
                      <input 
                        type="text" 
                        name="cityArea" 
                        placeholder="e.g. Bangalore, Indiranagar" 
                        value={formData.cityArea} 
                        onChange={handleInputChange} 
                        required 
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Venue Type</label>
                    <select 
                      name="venueType" 
                      value={formData.venueType} 
                      onChange={handleInputChange}
                    >
                      <option value="Café / Bakery">Café / Bakery</option>
                      <option value="Studio / Creative Space">Studio / Creative Space</option>
                      <option value="Brewery / Bar / Bistro">Brewery / Bar / Bistro</option>
                      <option value="Rooftop / Lawn">Rooftop / Lawn</option>
                      <option value="Bookstore / Boutique">Bookstore / Boutique</option>
                      <option value="Other">Other Unique Space</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Approximate Seating / Capacity</label>
                    <input 
                      type="text" 
                      name="capacity" 
                      placeholder="e.g. 20-40 people" 
                      value={formData.capacity} 
                      onChange={handleInputChange} 
                    />
                  </div>

                  <div className="form-group">
                    <label>Ideal Off-Peak Times</label>
                    <input 
                      type="text" 
                      name="availableSlots" 
                      placeholder="e.g. Weekday mornings, Tuesday evenings" 
                      value={formData.availableSlots} 
                      onChange={handleInputChange} 
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>Instagram Handle or Website Link</label>
                    <input 
                      type="text" 
                      name="instagramUrl" 
                      placeholder="e.g. @yourvenue or https://yourvenue.com" 
                      value={formData.instagramUrl} 
                      onChange={handleInputChange} 
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>Tell Us About Your Space (Optional)</label>
                    <textarea 
                      name="notes" 
                      rows="3" 
                      placeholder="Any specific vibe, equipment (projector, sound system, terrace), or thoughts you have..."
                      value={formData.notes} 
                      onChange={handleInputChange} 
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button 
                    type="submit" 
                    className="btn btn-solid btn-submit" 
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      'Submitting Application...'
                    ) : (
                      <>
                        <span>Submit Venue Application</span>
                        <Send size={15} />
                      </>
                    )}
                  </button>
                  <p className="form-privacy-note">
                    🔒 We respect your privacy. No spam, ever. We will only contact you regarding venue partnerships.
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      </section> */}
    </div>
  );
};

export default VenuePartner;
