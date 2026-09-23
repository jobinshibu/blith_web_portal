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
  Layers,
  CheckCircle2
} from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { logEvent } from 'firebase/analytics';
import { db, analytics } from '../../firebase';
import { toast } from 'react-hot-toast';
import './VenuePartner.scss';

// CHANGED: 7. Venue Categories - High-resolution curated imagery, authentic tags and gathering ideas
const VENUE_CATEGORIES = [
  {
    id: 'cafe',
    title: 'Cafés',
    icon: Coffee,
    tag: 'Cozy & Welcoming',
    image: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?q=80&w=900&auto=format&fit=crop',
    description: 'Perfect for intimate book clubs, creative craft sessions, board game afternoons, and relaxed morning mixers.',
    ideas: ['Book Clubs', 'Watercolor Mornings', 'Silent Reading Parties', 'Coffee Tastings']
  },
  {
    id: 'studios',
    title: 'Studios & Creative Spaces',
    icon: Palette,
    tag: 'Artistic & Dynamic',
    image: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=900&auto=format&fit=crop',
    description: 'Spacious, well-lit spaces ideal for hands-on maker workshops, movement flow, pottery, and creative classes.',
    ideas: ['Pottery & Clay Sessions', 'Paint & Sip Gatherings', 'Movement & Sound Healing', 'Craft Making']
  },
  {
    id: 'breweries',
    title: 'Breweries, Bars & Bistros',
    icon: Beer,
    tag: 'Lively & Social',
    image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=900&auto=format&fit=crop',
    description: 'Social atmospheres ready for vibrant community energy before peak evening crowds arrive.',
    ideas: ['Pub Trivia Evenings', 'Acoustic Sets', 'Cocktail Mixology', 'Storytelling & Comedy']
  },
  {
    id: 'rooftops',
    title: 'Rooftops, Gardens & Lawns',
    icon: Sun,
    tag: 'Open-Air & Scenic',
    image: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=900&auto=format&fit=crop',
    description: 'Open-air venues designed for golden hour socials, sunset acoustic sessions, and gatherings under the sky.',
    ideas: ['Sunset Acoustic Sets', 'Open-Air Cinema', 'Artisan Pop-ups', 'Morning Flow & Brunch']
  },
  {
    id: 'boutique',
    title: 'Boutique & Alternative Spaces',
    icon: Compass,
    tag: 'Unique & Character-Rich',
    image: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?q=80&w=900&auto=format&fit=crop',
    description: 'Bookstores, courtyards, ceramic studios, and design shops with an unmistakable local character.',
    ideas: ['Author Salons & Poetry', 'Intimate Supper Circles', 'Design Showcases', 'Listening Parties']
  }
];

// CHANGED: 7. Experiences - Visual community event formats with warm photography and concise captions
const EXPERIENCE_TYPES = [
  {
    icon: Palette,
    title: 'Hands-On Creative Workshops',
    description: 'Pottery, painting, resin craft, candle making, and floral styling led by local makers.',
    image: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?q=80&w=700&auto=format&fit=crop'
  },
  {
    icon: BookOpen,
    title: 'Social Clubs & Special Interests',
    description: 'Book circles, creative writing meetups, design jams, and conversational clubs.',
    image: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?q=80&w=700&auto=format&fit=crop'
  },
  {
    icon: Music,
    title: 'Acoustic Music & Listening Sessions',
    description: 'Intimate candlelit unplugged sets, indie listening parties, and open mic evenings.',
    image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=700&auto=format&fit=crop'
  },
  {
    icon: Smile,
    title: 'Wellness & Morning Meetups',
    description: 'Morning movement paired with coffee, guided meditation, breathwork, and sound baths.',
    image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=700&auto=format&fit=crop'
  },
  {
    icon: Users,
    title: 'Board Games & Trivia Gatherings',
    description: 'Themed quiz nights, tabletop strategy games, and friendly community socials.',
    image: 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?q=80&w=700&auto=format&fit=crop'
  },
  {
    icon: Layers,
    title: 'Cultural & Tasting Circles',
    description: 'Chef pop-ups, coffee tastings, storytelling circles, and cultural exchange dinners.',
    image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=700&auto=format&fit=crop'
  }
];

// CHANGED: 8. Why Blithe - Restrained, community-led strengths focusing on genuine support and curation
const WHY_BLITHE_POINTS = [
  {
    icon: HeartHandshake,
    title: 'Thoughtful Community Match',
    description: 'We connect your venue with creative hosts whose ideas naturally fit your atmosphere and neighborhood vibe.'
  },
  {
    icon: Users,
    title: 'Engaged Local Audiences',
    description: 'Blithe connects with curious locals who appreciate distinctive venues and love returning to places they discover.'
  },
  {
    icon: Calendar,
    title: 'Flexible & On Your Terms',
    description: 'You stay in full control of your venue calendar and decide which dates and times work best for your team.'
  },
  {
    icon: Sparkles,
    title: 'Seamless Event Support',
    description: 'From event discovery to guest RSVP coordination, we help make every gathering straightforward and rewarding.'
  }
];

// CHANGED: 9. FAQ - Accessible, grounded questions without fabricated terms
const FAQS = [
  {
    q: 'How does listing my venue with Blithe work?',
    a: 'Simply share details about your space using our partner form. Our team will connect with you to learn about your venue, the atmosphere you love, and the quiet hours you would like to bring to life.'
  },
  {
    q: 'What types of spaces work well on Blithe?',
    a: 'We work with a diverse variety of spaces—including cafés, bakeries, art studios, breweries, rooftops, boutique bookstores, and garden venues. If you have room and character, there is an experience that can fit.'
  },
  {
    q: 'Do I get to choose when events happen in my space?',
    a: 'Yes, absolutely. You retain full control over your schedule. You decide which days, hours, and formats fit comfortably into your normal operations.'
  },
  {
    q: 'What kind of events take place at Blithe venues?',
    a: 'Events range from intimate book clubs and maker craft workshops to acoustic listening sessions, wellness meetups, and trivia nights. Every gathering is tailored to respect the host space.'
  },
  {
    q: 'How do organisors connect with my space?',
    a: 'We coordinate with vetted local organisors to match their gathering concepts with your available slots and house preferences.'
  }
];

const VenuePartner = () => {
  const [selectedCatId, setSelectedCatId] = useState('cafe');
  const [openFaq, setOpenFaq] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    venueName: '',
    email: '',
    phone: '',
    cityArea: '',
    instagramUrl: '',
    notes: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const handleFaqKeyDown = (e, index) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleFaq(index);
    }
  };

  // CHANGED: 10. Smooth navigation accounting for fixed navbar height
  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      const navOffset = 84;
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - navOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  const handleSelectCategoryForForm = () => {
    scrollToSection('partner-form');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.venueName.trim() || !formData.email.trim() || !formData.phone.trim() || !formData.cityArea.trim()) {
      toast.error('Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('http://localhost:8000/venue-mail-api.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.status === 'success') {
        setIsSubmitted(true);
        toast.success('Your application has been submitted and the test email was sent successfully!');
        setFormData({
          venueName: '',
          email: '',
          phone: '',
          cityArea: '',
          instagramUrl: '',
          notes: ''
        });
      } else {
        toast.error('Failed to send email: ' + result.message);
      }
    } catch (error) {
      console.error('Error sending mail:', error);
      toast.error('An error occurred while sending the email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="venue-partner-page">
      {/* ─── 1. HERO SECTION (CHANGED: Professional layout with generous spacing and community photography) ─── */}
      <section className="venue-hero">
        <div className="section-container">
          <div className="hero-content-wrapper">
            <motion.div
              className="hero-inner"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
            >
              <div className="eyebrow-pill">
                <Sparkles size={13} aria-hidden="true" />
                <span>YOUR SPACE. MORE POSSIBILITIES.</span>
              </div>

              <h1 className="h1 hero-h">
                Turn your empty hours into something <em>worth coming back for.</em>
              </h1>

              <p className="body-lg hero-sub">
                Your space already has the vibe. We help bring the people, organisors and experiences that make it come alive.
              </p>
              <p className="body-lg hero-sub secondary">
                List your venue with Blithe and let us help you fill those quiet hours with events, workshops, meetups and more.
              </p>

              <div className="hero-ctas">
                <button
                  type="button"
                  className="btn btn-solid"
                  onClick={() => scrollToSection('partner-form')}
                >
                  <span>Partner With Blithe</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => scrollToSection('how-it-works')}
                >
                  <span>See How It Works</span>
                  <ArrowDown size={15} aria-hidden="true" />
                </button>
              </div>
            </motion.div>

            <motion.div
              className="hero-visual"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className="hero-image-card">
                <img
                  src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1000&auto=format&fit=crop"
                  alt="Community workshop gathering in a welcoming local venue"
                  loading="eager"
                />
                <div className="image-caption-pill">
                  <Users size={14} aria-hidden="true" />
                  <span>Spaces that come alive with community</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── 2. THE PROBLEM (CHANGED: Exact client copy, soft lavender container, approachable layout) ─── */}
      <section className="venue-problem-section">
        <div className="section-container">
          <motion.div
            className="problem-box"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.4 }}
          >
            <span className="label problem-label">THE REALITY</span>
            <h2 className="h2 problem-heading">
              Your space shouldn't have to wait for the weekend.
            </h2>

            <div className="problem-scenarios-grid">
              <div className="scenario-card">
                <div className="scenario-icon-wrap" aria-hidden="true">☕</div>
                <p>A great café can be quiet on a Tuesday.</p>
              </div>
              <div className="scenario-card">
                <div className="scenario-icon-wrap" aria-hidden="true">🎨</div>
                <p>A beautiful studio can sit empty between classes.</p>
              </div>
              <div className="scenario-card">
                <div className="scenario-icon-wrap" aria-hidden="true">🍻</div>
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

      {/* ─── 3. WHAT IS BLITHE.VENUE (CHANGED: Exact client copy, clean text & photo composition) ─── */}
      <section className="venue-about-section">
        <div className="section-container">
          <div className="about-composition-grid">
            <div className="about-text-column">
              <span className="label">INTRODUCING</span>
              <h2 className="h2">Meet Blithe.Venue</h2>
              <p className="body-lg about-lead">
                Blithe.Venue connects spaces that have room with people who have something to bring to them.
              </p>
              <p className="about-desc">
                From creative workshops and wellness sessions to community meetups and experiences, we help organisors discover spaces that fit their events, and help venues turn their quieter hours into opportunities.
              </p>
              <div className="about-punchline-box">
                <p className="punchline-text">
                  More events. More footfall. More life in your space.
                </p>
              </div>
            </div>

            <div className="about-image-column">
              <div className="about-image-card">
                <img
                  src="https://images.unsplash.com/photo-1543269865-cbf427effbad?q=80&w=900&auto=format&fit=crop"
                  alt="Organisors and attendees enjoying an experience in a partner venue"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 4. WHY PARTNER (CHANGED: Conversational headings, restrained benefits without corporate jargon) ─── */}
      <section className="venue-why-partner">
        <div className="section-container">
          <div className="section-header center">
            <span className="label">WHY HOST WITH US</span>
            <h2 className="h2">Why Partner With Blithe</h2>
            <p className="body-lg">
              Opening your doors to community experiences brings warmth, energy, and connection into your everyday space.
            </p>
          </div>

          <div className="why-partner-grid">
            <motion.div className="why-card" whileHover={{ y: -4 }} transition={{ duration: 0.18 }}>
              <div className="why-card-icon" aria-hidden="true">
                <Clock size={22} />
              </div>
              <h3 className="h3">Make more of your quiet hours</h3>
              <p>Turn slower weekday mornings, afternoons, or off-peak evenings into active windows filled with creative gatherings.</p>
            </motion.div>

            <motion.div className="why-card" whileHover={{ y: -4 }} transition={{ duration: 0.18 }}>
              <div className="why-card-icon" aria-hidden="true">
                <Users size={22} />
              </div>
              <h3 className="h3">Welcome people who may come back</h3>
              <p>Introduce your venue to workshop attendees and club members who discover their new favourite local spot.</p>
            </motion.div>

            <motion.div className="why-card" whileHover={{ y: -4 }} transition={{ duration: 0.18 }}>
              <div className="why-card-icon" aria-hidden="true">
                <HeartHandshake size={22} />
              </div>
              <h3 className="h3">Bring your neighbourhood together</h3>
              <p>Position your space as a welcoming community anchor where locals meet, learn new crafts, and connect.</p>
            </motion.div>

            <motion.div className="why-card" whileHover={{ y: -4 }} transition={{ duration: 0.18 }}>
              <div className="why-card-icon" aria-hidden="true">
                <Smile size={22} />
              </div>
              <h3 className="h3">A little help along the way</h3>
              <p>Organisors manage their attendees and workshop agendas, allowing your team to simply provide warm hospitality.</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── 5. HOW IT WORKS (CHANGED: Clear 4-step sequence with short, grounded operational explanations) ─── */}
      <section id="how-it-works" className="venue-how-it-works">
        <div className="section-container">
          <div className="section-header center">
            <span className="label">THE PROCESS</span>
            <h2 className="h2">How It Works</h2>
            <p className="body-lg">
              From your initial space details to your first bustling gathering, we make hosting straightforward.
            </p>
          </div>

          <div className="steps-timeline">
            <div className="step-card">
              <div className="step-number" aria-hidden="true">01</div>
              <h3 className="h3">Share your space</h3>
              <p>Tell us about your venue, the atmosphere you love, and the times of week that could use more energy.</p>
            </div>

            <div className="step-card">
              <div className="step-number" aria-hidden="true">02</div>
              <h3 className="h3">Connect with organisors</h3>
              <p>Discover local organisors, workshop hosts, and community leaders looking for a home for their ideas.</p>
            </div>

            <div className="step-card">
              <div className="step-number" aria-hidden="true">03</div>
              <h3 className="h3">Host on your terms</h3>
              <p>Coordinate timing, event details, and house guidelines so every gathering feels natural in your space.</p>
            </div>

            <div className="step-card">
              <div className="step-number" aria-hidden="true">04</div>
              <h3 className="h3">Build ongoing community</h3>
              <p>Turn one-off sessions into regular rituals that keep your calendar active and your tables full.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 6. VENUE CATEGORIES (CHANGED: Simplified visual split showcase with photography, no unconfirmed formulas) ─── */}
      <section className="venue-categories-section">
        <div className="section-container">
          <div className="section-header">
            <span className="label">VENUE STYLES</span>
            <h2 className="h2">Spaces That Thrive On Blithe</h2>
            <p className="body-lg">
              Explore how different types of spaces host workshops, socials, and community gatherings.
            </p>
          </div>

          <div className="venue-showcase-layout">
            {/* Left: Category Selector List */}
            <div className="showcase-nav-column" role="tablist" aria-label="Venue category tabs">
              {VENUE_CATEGORIES.map((cat, index) => {
                const Icon = cat.icon;
                const isSelected = selectedCatId === cat.id;
                const indexStr = String(index + 1).padStart(2, '0');

                return (
                  <div key={cat.id} className="nav-item-wrapper">
                    <button
                      className={`showcase-nav-card ${isSelected ? 'active' : ''}`}
                      onClick={() => setSelectedCatId(cat.id)}
                      type="button"
                      role="tab"
                      id={`tab-${cat.id}`}
                      aria-selected={isSelected}
                      aria-controls={`panel-${cat.id}`}
                    >
                      <div className="nav-left">
                        <div className="nav-icon-box" aria-hidden="true">
                          <Icon size={18} />
                        </div>
                        <div className="nav-text">
                          <div className="nav-title-row">
                            <span className="nav-index">{indexStr}</span>
                            <h4 className="nav-title">{cat.title}</h4>
                          </div>
                          <span className="nav-tag">{cat.tag}</span>
                        </div>
                      </div>
                      <div className="nav-indicator" aria-hidden="true">
                        <ArrowRight size={15} />
                      </div>
                    </button>

                    {/* Mobile-only inline details */}
                    <AnimatePresence>
                      {isSelected && (
                        <motion.div
                          className="mobile-inline-canvas"
                          id={`panel-${cat.id}`}
                          role="tabpanel"
                          aria-labelledby={`tab-${cat.id}`}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="canvas-image-wrap">
                            <img src={cat.image} alt={cat.title} loading="lazy" />
                            <span className="canvas-badge">{cat.tag}</span>
                          </div>

                          <div className="canvas-header-block">
                            <h3 className="canvas-title">{cat.title}</h3>
                            <p className="canvas-desc">{cat.description}</p>
                          </div>

                          <div className="canvas-ideas-box">
                            <span className="spec-label">SUITABLE GATHERINGS & EXPERIENCES</span>
                            <div className="ideas-pill-list">
                              {cat.ideas.map((idea, idx) => (
                                <span key={idx} className="idea-pill">{idea}</span>
                              ))}
                            </div>
                          </div>

                          <button
                            type="button"
                            className="btn btn-solid btn-partner-cat"
                            onClick={() => handleSelectCategoryForForm(cat)}
                          >
                            <span>Tell Us About Your Space</span>
                            <ArrowRight size={15} aria-hidden="true" />
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* Right: Desktop Visual Showcase Card */}
            <div className="showcase-canvas-column desktop-only">
              {(() => {
                const activeCat = VENUE_CATEGORIES.find(c => c.id === selectedCatId) || VENUE_CATEGORIES[0];
                const Icon = activeCat.icon;

                return (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeCat.id}
                      className="experience-canvas-card"
                      id={`panel-${activeCat.id}`}
                      role="tabpanel"
                      aria-labelledby={`tab-${activeCat.id}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="canvas-top-photo-wrap">
                        <img src={activeCat.image} alt={activeCat.title} loading="lazy" />
                        <div className="canvas-photo-overlay">
                          <span className="canvas-badge">{activeCat.tag}</span>
                        </div>
                      </div>

                      <div className="canvas-body-content">
                        <div className="canvas-top-bar">
                          <div className="canvas-main-icon" aria-hidden="true">
                            <Icon size={22} />
                          </div>
                          <h3 className="canvas-title">{activeCat.title}</h3>
                        </div>

                        <p className="canvas-desc">{activeCat.description}</p>

                        <div className="spec-card">
                          <div className="spec-label">
                            <Sparkles size={14} aria-hidden="true" />
                            <span>SUITABLE GATHERINGS & EXPERIENCES</span>
                          </div>
                          <div className="ideas-pill-list">
                            {activeCat.ideas.map((idea, idx) => (
                              <span key={idx} className="idea-pill">{idea}</span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="canvas-footer-cta">
                        <button
                          type="button"
                          className="btn btn-solid btn-partner-cat"
                          onClick={() => handleSelectCategoryForForm(activeCat)}
                        >
                          <span>Tell Us About Your Space</span>
                          <ArrowRight size={15} aria-hidden="true" />
                        </button>
                        <p className="canvas-footer-note">Flexible scheduling • Community led • You set the rules</p>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                );
              })()}
            </div>
          </div>
        </div>
      </section>

      {/* ─── 7. EXPERIENCES (CHANGED: Visual photography grid replacing repetitive icon cards) ─── */}
      <section className="venue-experiences-section">
        <div className="section-container">
          <div className="section-header center">
            <span className="label">COMMUNITY FORMATS</span>
            <h2 className="h2">Experiences Powered By Blithe</h2>
            <p className="body-lg">
              From creative workshops to soulful acoustic sessions, here is what local organisors bring to life.
            </p>
          </div>

          <div className="experiences-visual-grid">
            {EXPERIENCE_TYPES.map((exp, idx) => {
              const Icon = exp.icon;
              return (
                <motion.div
                  key={idx}
                  className="exp-visual-card"
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="exp-img-wrapper">
                    <img src={exp.image} alt={exp.title} loading="lazy" />
                    <div className="exp-icon-overlay" aria-hidden="true">
                      <Icon size={18} />
                    </div>
                  </div>
                  <div className="exp-info">
                    <h3 className="h3">{exp.title}</h3>
                    <p>{exp.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── 8. WHY BLITHE (CHANGED: Restrained focus on curation, support, and community connection) ─── */}
      <section className="venue-why-blithe">
        <div className="section-container">
          <div className="section-header center">
            <span className="label">THE BLITHE DIFFERENCE</span>
            <h2 className="h2">Why Venues Choose Blithe</h2>
            <p className="body-lg">
              We are dedicated to building meaningful community gatherings that respect and celebrate your venue.
            </p>
          </div>

          <div className="why-blithe-grid">
            {WHY_BLITHE_POINTS.map((pt, idx) => {
              const Icon = pt.icon;
              return (
                <motion.div
                  key={idx}
                  className="blithe-point-card"
                  whileHover={{ y: -3 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="point-icon-box" aria-hidden="true">
                    <Icon size={22} />
                  </div>
                  <h3 className="h3">{pt.title}</h3>
                  <p>{pt.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── 9. SOCIAL PROOF (CHANGED: Restrained authentic community statement without fake statistics) ─── */}
      <section className="venue-social-proof-section">
        <div className="section-container">
          <div className="social-proof-card">
            <span className="proof-eyebrow">OUR VISION FOR SPACES</span>
            <blockquote className="proof-quote">
              "Great neighborhood venues are more than just four walls—they are the social living rooms of our cities. Blithe helps connect those spaces with the people and experiences that make them thrive."
            </blockquote>
            <p className="proof-author">— The Blithe Community Team</p>
          </div>
        </div>
      </section>

      {/* ─── 10. FAQ (CHANGED: Accessible keyboard-navigable accordion with grounded answers) ─── */}
      <section className="venue-faq-section">
        <div className="section-container">
          <div className="section-header center">
            <span className="label">COMMONLY ASKED</span>
            <h2 className="h2">Frequently Asked Questions</h2>
            <p className="body-lg">
              Have questions about partnering with Blithe? Here is what you need to know.
            </p>
          </div>

          <div className="faq-accordion-wrap">
            {FAQS.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={index}
                  className={`faq-item ${isOpen ? 'open' : ''}`}
                >
                  <button
                    type="button"
                    className="faq-question-btn"
                    onClick={() => toggleFaq(index)}
                    onKeyDown={(e) => handleFaqKeyDown(e, index)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${index}`}
                    id={`faq-btn-${index}`}
                  >
                    <span className="faq-q-text">{faq.q}</span>
                    <ChevronDown size={18} className="faq-chevron" aria-hidden="true" />
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        id={`faq-answer-${index}`}
                        role="region"
                        aria-labelledby={`faq-btn-${index}`}
                        className="faq-answer-pane"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <p>{faq.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── 11. FINAL CTA / PARTNER FORM (CHANGED: Client copy "Let's bring more life to your space", full Firestore integration) ─── */}
      <section id="partner-form" className="venue-final-form-section">
        <div className="section-container">
          <div className="form-section-header center">
            <div className="eyebrow-pill center-pill">
              <Sparkles size={13} aria-hidden="true" />
              <span>START HOSTING WITH BLITHE</span>
            </div>
            <h2 className="h2">Let’s bring more life to your space.</h2>
            <p className="body-lg">
              Tell us a little about your venue and the possibilities you’d like to explore.
            </p>
          </div>

          <div className="partner-form-container">
            {isSubmitted ? (
              <div className="form-success-card" role="alert">
                <CheckCircle2 size={44} className="success-icon" aria-hidden="true" />
                <h3 className="h3">Thank You for Reaching Out!</h3>
                <p>We have received your venue details. A member of the Blithe community team will get in touch shortly to discuss hosting possibilities.</p>
                <button
                  type="button"
                  className="btn btn-solid"
                  onClick={() => setIsSubmitted(false)}
                >
                  Submit Another Venue
                </button>
              </div>
            ) : (
              <form className="venue-partner-form" onSubmit={handleSubmit} noValidate>
                <div className="form-row-2">
                  <div className="form-group">
                    <label htmlFor="venueName">Venue Name *</label>
                    <div className="input-wrap">
                      <Building2 size={16} aria-hidden="true" />
                      <input
                        type="text"
                        id="venueName"
                        name="venueName"
                        placeholder="e.g. The Daily Artisan Café"
                        value={formData.venueName}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="cityArea">City & Locality *</label>
                    <div className="input-wrap">
                      <MapPin size={16} aria-hidden="true" />
                      <input
                        type="text"
                        id="cityArea"
                        name="cityArea"
                        placeholder="e.g. Indiranagar, Bangalore"
                        value={formData.cityArea}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label htmlFor="email">Email Address *</label>
                    <div className="input-wrap">
                      <Mail size={16} aria-hidden="true" />
                      <input
                        type="email"
                        id="email"
                        name="email"
                        placeholder="e.g. maya@thedailycafe.in"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="phone">Phone / WhatsApp *</label>
                    <div className="input-wrap">
                      <Phone size={16} aria-hidden="true" />
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        placeholder="e.g. +91 98765 43210"
                        value={formData.phone}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="instagramUrl">Instagram Handle or Website (Optional)</label>
                  <input
                    type="text"
                    id="instagramUrl"
                    name="instagramUrl"
                    placeholder="e.g. @thedailycafe or https://thedailycafe.in"
                    value={formData.instagramUrl}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="notes">Tell Us About Your Space & Ideas (Optional)</label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows="3"
                    placeholder="Share any special amenities (e.g. projector, outdoor lawn, sound setup) or gathering ideas you’d love to host..."
                    value={formData.notes}
                    onChange={handleInputChange}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-solid btn-submit-partner"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <span>Sending Application...</span>
                  ) : (
                    <>
                      <span>Partner With Blithe</span>
                      <Send size={16} aria-hidden="true" />
                    </>
                  )}
                </button>

                <p className="form-disclaimer">
                  By submitting, you allow Blithe to reach out regarding venue partnerships. No listing fees or obligations.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default VenuePartner;
