/**
 * Dummy Event Data for Meta Pixel Integration Testing
 * Used to test ViewContent, InitiateCheckout, and Purchase Meta Pixel events.
 */

export const DUMMY_TEST_EVENT = {
  id: 'dummy-pixel-test',
  eventName: 'Meta Pixel Integration Test Event 🚀',
  title: 'Meta Pixel Integration Test Event 🚀',
  category: 'Tech & Innovation',
  description: `This is a dedicated Dummy Event created specifically to test and verify Meta Pixel tracking (ID: 1933447620923074).

Features for testing:
• PageView event tracking on page load
• ViewContent event tracking when viewing event details
• InitiateCheckout event tracking when entering the booking page
• Purchase event tracking on booking confirmation
• Custom Meta Pixel event triggers for testing Pixel Helper / Meta Events Manager`,
  venue: 'Blithe Meta Lab Virtual Arena',
  location: 'Bengaluru, KA, India',
  price: 499,
  displayPrice: '₹499',
  isPriceOnwards: true,
  eventType: 'Hybrid',
  ageRestriction: false,
  minAge: 18,
  language: 'English, Hindi',
  tags: ['MetaPixel', 'PixelTest', 'BlitheApp', 'DemoEvent'],
  platformFee: 25,
  soldOut: false,
  image: [
    'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&auto=format&fit=crop&q=80'
  ],
  extraImages: [
    'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&auto=format&fit=crop&q=80'
  ],
  tickets: [
    {
      id: 'ticket-vip-pixel',
      name: 'VIP Meta Pixel Tester Pass',
      actualPrice: 999,
      discountedPrice: 499,
      quantity: 100,
      description: 'Includes full Meta Pixel event payload inspection & test booking access.'
    },
    {
      id: 'ticket-gen-pixel',
      name: 'Standard Developer Pass',
      actualPrice: 299,
      discountedPrice: 199,
      quantity: 200,
      description: 'General test ticket for verifying Pixel event firing.'
    }
  ],
  termsAndConditions: '1. This is a dummy event for testing Meta Pixel tracking.\n2. No real monetary payment will be processed if test mode is selected.\n3. Verify pixel events using Meta Pixel Helper extension or Facebook Events Manager.',
  eventStartDate: {
    toDate: () => new Date(Date.now() + 86400000 * 2), // 2 days from now
    seconds: Math.floor((Date.now() + 86400000 * 2) / 1000)
  },
  eventEndDate: {
    toDate: () => new Date(Date.now() + 86400000 * 2 + 14400000), // +4 hours
    seconds: Math.floor((Date.now() + 86400000 * 2 + 14400000) / 1000)
  }
};
