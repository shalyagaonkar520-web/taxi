// Vehicle Tier Configurations & Pricing Matrix
const VEHICLE_TIERS = {
  UberGo: {
    id: 'UberGo',
    name: 'Uber Go',
    tagline: 'Affordable, compact rides',
    capacity: 4,
    baseFare: 3.50,
    perKmRate: 1.20,
    perMinRate: 0.25,
    minFare: 7.00,
    icon: 'car-compact',
    image: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=120&auto=format&fit=crop&q=80',
    speedMultiplier: 1.0
  },
  UberX: {
    id: 'UberX',
    name: 'UberX',
    tagline: 'Everyday comfortable rides',
    capacity: 4,
    baseFare: 4.50,
    perKmRate: 1.65,
    perMinRate: 0.35,
    minFare: 8.50,
    icon: 'car',
    image: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=120&auto=format&fit=crop&q=80',
    speedMultiplier: 1.0
  },
  UberComfort: {
    id: 'UberComfort',
    name: 'Uber Comfort',
    tagline: 'Newer cars with extra legroom',
    capacity: 4,
    baseFare: 6.00,
    perKmRate: 2.10,
    perMinRate: 0.45,
    minFare: 12.00,
    icon: 'car-luxury',
    image: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=120&auto=format&fit=crop&q=80',
    speedMultiplier: 1.05
  },
  UberXL: {
    id: 'UberXL',
    name: 'UberXL',
    tagline: 'Spacious SUVs for up to 6 riders',
    capacity: 6,
    baseFare: 8.00,
    perKmRate: 2.60,
    perMinRate: 0.55,
    minFare: 15.00,
    icon: 'suv',
    image: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=120&auto=format&fit=crop&q=80',
    speedMultiplier: 0.95
  },
  UberBlack: {
    id: 'UberBlack',
    name: 'Uber Black',
    tagline: 'Premium rides in luxury vehicles',
    capacity: 4,
    baseFare: 12.00,
    perKmRate: 3.40,
    perMinRate: 0.80,
    minFare: 22.00,
    icon: 'luxury',
    image: 'https://images.unsplash.com/photo-1563720223185-11003d516935?w=120&auto=format&fit=crop&q=80',
    speedMultiplier: 1.1
  },
  UberMoto: {
    id: 'UberMoto',
    name: 'Uber Moto / Bike',
    tagline: 'Fastest way through city traffic',
    capacity: 1,
    baseFare: 1.80,
    perKmRate: 0.80,
    perMinRate: 0.15,
    minFare: 4.00,
    icon: 'bike',
    image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=120&auto=format&fit=crop&q=80',
    speedMultiplier: 1.25
  },
  UberAuto: {
    id: 'UberAuto',
    name: 'Uber Auto',
    tagline: 'Iconic 3-wheeler city rides',
    capacity: 3,
    baseFare: 2.20,
    perKmRate: 0.95,
    perMinRate: 0.20,
    minFare: 5.00,
    icon: 'rickshaw',
    image: 'https://images.unsplash.com/photo-1596707328905-242b3bfb0981?w=120&auto=format&fit=crop&q=80',
    speedMultiplier: 0.9
  }
};

const BOOKING_FEE = 1.50;

/**
 * Calculate fare for a given distance and duration
 */
function calculateFare({ category = 'UberX', distanceKm = 1, durationMin = 5, surgeMultiplier = 1.0 }) {
  const tier = VEHICLE_TIERS[category] || VEHICLE_TIERS.UberX;
  
  const rawFare = tier.baseFare + 
    (distanceKm * tier.perKmRate) + 
    (durationMin * tier.perMinRate);
  
  const subtotal = rawFare * (surgeMultiplier || 1.0);
  const total = Math.max(tier.minFare, subtotal + BOOKING_FEE);
  
  return {
    category,
    tierName: tier.name,
    distanceKm: Number(distanceKm.toFixed(2)),
    durationMin: Math.ceil(durationMin),
    baseFare: tier.baseFare,
    distanceFare: Number((distanceKm * tier.perKmRate).toFixed(2)),
    timeFare: Number((durationMin * tier.perMinRate).toFixed(2)),
    bookingFee: BOOKING_FEE,
    surgeMultiplier: Number(surgeMultiplier.toFixed(1)),
    totalFare: Number(total.toFixed(2)),
    currency: '$'
  };
}

/**
 * Get fare quotes across all vehicle tiers for given distance/duration
 */
function getFareQuotes({ distanceKm, durationMin, surgeMultiplier = 1.0 }) {
  return Object.keys(VEHICLE_TIERS).map(categoryKey => {
    const tier = VEHICLE_TIERS[categoryKey];
    const adjustedDuration = Math.ceil(durationMin / (tier.speedMultiplier || 1.0));
    const fareDetails = calculateFare({
      category: categoryKey,
      distanceKm,
      durationMin: adjustedDuration,
      surgeMultiplier
    });

    return {
      ...tier,
      ...fareDetails,
      etaMin: Math.floor(2 + Math.random() * 5)
    };
  });
}

module.exports = {
  VEHICLE_TIERS,
  BOOKING_FEE,
  calculateFare,
  getFareQuotes
};
