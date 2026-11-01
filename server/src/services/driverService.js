const { v4: uuidv4 } = require('uuid');

/**
 * Driver dashboard features (summary, earnings, cash-out, heatmap, quests, KYC,
 * destination mode). They are mixed into the Database class so they share its
 * JSON / PostgreSQL state and persistence.
 *
 * Note: several figures here (weekly chart, demo trips, heatmap zones, default quests/KYC)
 * are illustrative demo data until real analytics exist.
 */
class DriverMethods {
  resolveDriver(id) {
    if (!id) return null;
    return this.getDriverById(id) || this.getDrivers().find(d => d.email === id) || null;
  }

  getDriverSummary(driverId) {
    const driver = this.resolveDriver(driverId);
    if (!driver) return null;

    const todayRides = this.getRides().filter(
      r => r.driverId === driver.id && r.status === 'COMPLETED'
    );

    const todayEarnings = Number((todayRides.reduce((sum, r) => sum + (r.fare * 0.8) + (r.tip || 0), 0) + (driver.earningsToday || 184.20)).toFixed(2));
    const completedTrips = (driver.totalTrips || 1420) + todayRides.length;

    return {
      driverId: driver.id,
      name: driver.name,
      rating: driver.rating || 4.96,
      status: driver.status || 'ONLINE',
      approvalStatus: 'APPROVED',
      acceptanceRate: driver.acceptanceRate || 98,
      cancellationRate: 2,
      today: {
        earnings: todayEarnings,
        trips: todayRides.length > 0 ? todayRides.length : 8,
        onlineHours: 5.4,
        acceptanceRate: driver.acceptanceRate || 98,
        sessionSeconds: 19440
      },
      walletBalance: driver.walletBalance || 840.0,
      vehicle: driver.vehicle
    };
  }

  getDriverEarnings(driverId, range = 'week') {
    const driver = this.resolveDriver(driverId);
    const summary = this.getDriverSummary(driverId);

    const weekChart = [
      { day: 'Mon', amount: 145.50, trips: 7 },
      { day: 'Tue', amount: 182.00, trips: 9 },
      { day: 'Wed', amount: 138.25, trips: 6 },
      { day: 'Thu', amount: 210.00, trips: 10 },
      { day: 'Fri', amount: 265.80, trips: 12 },
      { day: 'Sat', amount: 310.50, trips: 14 },
      { day: 'Sun', amount: summary.today.earnings, trips: summary.today.trips }
    ];

    const dayChart = [
      { time: '06:00', amount: 22.50 },
      { time: '08:00', amount: 48.00 },
      { time: '10:00', amount: 35.20 },
      { time: '12:00', amount: 18.50 },
      { time: '14:00', amount: 29.00 },
      { time: '16:00', amount: 42.00 },
      { time: '18:00', amount: 55.40 },
      { time: '20:00', amount: 38.00 }
    ];

    // Get payouts
    const payouts = this.getExtras().payouts.filter(p => p.driverId === driver.id).slice(0, 10);
    if (payouts.length === 0) {
      payouts.push(
        { id: 'pay-01', driverId: driver.id, amount: 450.00, method: 'INSTANT_BANK', status: 'COMPLETED', timestamp: new Date(Date.now() - 86400000 * 2).toISOString() },
        { id: 'pay-02', driverId: driver.id, amount: 620.00, method: 'UPI_FAST', status: 'COMPLETED', timestamp: new Date(Date.now() - 86400000 * 5).toISOString() }
      );
    }

    const mockTrips = [
      {
        id: 'trip-901',
        fare: 28.50,
        surgeBonus: 5.70,
        tip: 4.00,
        commission: 5.70,
        net: 32.50,
        paymentMethod: 'ONLINE',
        pickup: 'MG Road Metro Station',
        destination: 'Indiranagar 100ft Road',
        distanceKm: 4.8,
        durationMin: 18,
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
      },
      {
        id: 'trip-902',
        fare: 44.00,
        surgeBonus: 8.80,
        tip: 5.00,
        commission: 8.80,
        net: 49.00,
        paymentMethod: 'CASH',
        pickup: 'Koramangala 5th Block',
        destination: 'Whitefield ITPL Gate 2',
        distanceKm: 14.2,
        durationMin: 42,
        createdAt: new Date(Date.now() - 3600000 * 4).toISOString()
      },
      {
        id: 'trip-903',
        fare: 18.00,
        surgeBonus: 0.00,
        tip: 2.00,
        commission: 3.60,
        net: 16.40,
        paymentMethod: 'ONLINE',
        pickup: 'UB City Mall',
        destination: 'Richmond Town',
        distanceKm: 2.5,
        durationMin: 12,
        createdAt: new Date(Date.now() - 3600000 * 6).toISOString()
      }
    ];

    const completedDbRides = this.getRides().filter(r => r.driverId === driver.id && r.status === 'COMPLETED');
    const allTrips = [...completedDbRides.map(r => ({
      id: r.id,
      fare: r.fare,
      surgeBonus: Number((r.fare * 0.15).toFixed(2)),
      tip: r.tip || 0,
      commission: Number((r.fare * 0.20).toFixed(2)),
      net: Number(((r.fare * 0.8) + (r.tip || 0)).toFixed(2)),
      paymentMethod: r.paymentMethod || 'ONLINE',
      pickup: r.pickup?.address || 'Pickup Point',
      destination: r.destination?.address || 'Destination Point',
      distanceKm: r.distanceKm || 5.0,
      durationMin: r.durationMin || 20,
      createdAt: r.completedAt || r.createdAt
    })), ...mockTrips];

    const totalGross = allTrips.reduce((s, t) => s + t.fare, 0);
    const totalNet = allTrips.reduce((s, t) => s + t.net, 0);
    const cashEarnings = allTrips.filter(t => t.paymentMethod === 'CASH').reduce((s, t) => s + t.net, 0);
    const onlineEarnings = allTrips.filter(t => t.paymentMethod !== 'CASH').reduce((s, t) => s + t.net, 0);

    return {
      range,
      driverId: driver.id,
      summary: {
        totalNet: Number(totalNet.toFixed(2)),
        totalGross: Number(totalGross.toFixed(2)),
        cashEarnings: Number(cashEarnings.toFixed(2)),
        onlineEarnings: Number(onlineEarnings.toFixed(2)),
        walletBalance: driver.walletBalance,
        tripsCount: allTrips.length
      },
      chartData: range === 'day' ? dayChart : weekChart,
      trips: allTrips,
      payouts
    };
  }

  recordCashout(driverId, amount, method = 'INSTANT_BANK') {
    const driver = this.resolveDriver(driverId);
    if (!driver) throw new Error('Driver not found');
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) throw new Error('Invalid cashout amount');
    if ((driver.walletBalance || 0) < numAmount) throw new Error('Insufficient wallet balance');

    const payoutId = `pay-${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString();
    const newBal = Number(((driver.walletBalance || 0) - numAmount).toFixed(2));

    this.updateUser(driver.id, { walletBalance: newBal });
    this.getExtras().payouts.unshift({
      id: payoutId,
      driverId: driver.id,
      amount: numAmount,
      method,
      status: 'COMPLETED',
      timestamp: now
    });
    this.addTransaction({
      userId: driver.id,
      amount: -numAmount,
      type: 'DEBIT',
      description: `Instant Cash-Out via ${method}`
    });

    return {
      success: true,
      payoutId,
      amount: numAmount,
      method,
      status: 'COMPLETED',
      remainingBalance: newBal,
      timestamp: now
    };
  }

  getDriverHeatmap() {
    return [
      {
        id: 'surge-mg-road',
        name: 'Downtown Commercial Hub',
        lat: 12.9750,
        lng: 77.6090,
        radius: 1300,
        surgeMultiplier: 2.2,
        demandLevel: 'SURGE',
        color: '#EF4444',
        ridesPending: 18,
        description: '+2.2x Surge pricing active due to high evening transit demand'
      },
      {
        id: 'surge-indiranagar',
        name: 'Indiranagar 100ft Corridor',
        lat: 12.9784,
        lng: 77.6408,
        radius: 1100,
        surgeMultiplier: 1.8,
        demandLevel: 'VERY_HIGH',
        color: '#F97316',
        ridesPending: 12,
        description: '+1.8x High dinner & social transit requests'
      },
      {
        id: 'surge-koramangala',
        name: 'Koramangala Tech District',
        lat: 12.9352,
        lng: 77.6245,
        radius: 1200,
        surgeMultiplier: 1.6,
        demandLevel: 'HIGH',
        color: '#EAB308',
        ridesPending: 9,
        description: '+1.6x Startups & residential zone'
      },
      {
        id: 'surge-whitefield',
        name: 'Whitefield Tech Park Gate',
        lat: 12.9698,
        lng: 77.7500,
        radius: 1500,
        surgeMultiplier: 1.5,
        demandLevel: 'HIGH',
        color: '#3B82F6',
        ridesPending: 14,
        description: '+1.5x IT campus shift departures'
      },
      {
        id: 'surge-airport',
        name: 'Airport Express Highway',
        lat: 13.0358,
        lng: 77.5970,
        radius: 1600,
        surgeMultiplier: 2.5,
        demandLevel: 'SURGE',
        color: '#DC2626',
        ridesPending: 22,
        description: '+2.5x Airport outbound flights cluster'
      }
    ];
  }

  getDriverQuests(driverId) {
    const driver = this.resolveDriver(driverId);
    const existing = this.getExtras().quests[driver.id];
    if (existing) return existing;

    const initialQuests = {
      driverId: driver.id,
      streakDays: 6,
      referralCode: `NEX-${driver.name.split(' ')[0].toUpperCase()}77`,
      referralEarnings: 300,
      referralsCount: 3,
      peakHourBonuses: [
        { time: '08:00 - 11:00 AM', label: 'Morning Rush', bonus: '+$5.00 / trip', status: 'COMPLETED' },
        { time: '05:00 - 09:00 PM', label: 'Evening Peak', bonus: '+$7.50 / trip', status: 'ACTIVE' },
        { time: '11:00 PM - 03:00 AM', label: 'Night Owl Extra', bonus: '+$10.00 / trip', status: 'UPCOMING' }
      ],
      quests: [
        {
          id: 'quest-daily-10',
          title: 'Daily Hero Sprint',
          description: 'Complete 10 rides today between 06:00 - 23:59',
          reward: 35.00,
          current: 7,
          target: 10,
          unit: 'rides',
          expiresIn: '4h 12m',
          completed: false,
          claimed: false
        },
        {
          id: 'quest-peak-5',
          title: 'Peak-Hour Master',
          description: 'Complete 5 trips during 5:00 PM - 9:00 PM peak hours',
          reward: 25.00,
          current: 5,
          target: 5,
          unit: 'rides',
          expiresIn: '2h 45m',
          completed: true,
          claimed: false
        },
        {
          id: 'quest-weekend-25',
          title: 'Weekend Warrior',
          description: 'Complete 25 rides over Friday through Sunday',
          reward: 80.00,
          current: 19,
          target: 25,
          unit: 'rides',
          expiresIn: '1d 6h',
          completed: false,
          claimed: false
        }
      ]
    };

    this.getExtras().quests[driver.id] = initialQuests;
    this.saveData();
    return initialQuests;
  }

  claimQuest(driverId, questId) {
    const data = this.getDriverQuests(driverId);
    const quest = data.quests.find(q => q.id === questId);
    if (!quest) throw new Error('Quest not found');
    if (!quest.completed) throw new Error('Quest target not yet reached');
    if (quest.claimed) throw new Error('Quest reward already claimed');

    quest.claimed = true;

    // Award bonus to driver balance
    const driver = this.resolveDriver(driverId);
    const newBal = Number(((driver.walletBalance || 0) + quest.reward).toFixed(2));
    this.updateUser(driver.id, { walletBalance: newBal });
    this.addTransaction({ userId: driver.id, amount: quest.reward, type: 'QUEST_BONUS', description: `Quest reward: ${quest.title}` });

    return { success: true, reward: quest.reward, newBalance: newBal, quest };
  }

  getDriverKyc(driverId) {
    const driver = this.resolveDriver(driverId);
    const existing = this.getExtras().kyc[driver.id];
    if (existing) return existing;

    const initialKyc = {
      driverId: driver.id,
      overallStatus: 'VERIFIED',
      documents: {
        license: {
          title: 'Commercial Driving License',
          docNumber: 'DL-042023008912',
          status: 'VERIFIED',
          expiryDate: '2028-11-15',
          daysUntilExpiry: 786,
          isExpiringSoon: false,
          fileUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400'
        },
        rc: {
          title: 'Vehicle Registration Certificate (RC)',
          docNumber: driver.vehicle?.licensePlate || 'KA-01-EQ-7892',
          status: 'VERIFIED',
          expiryDate: '2027-08-30',
          daysUntilExpiry: 345,
          isExpiringSoon: false,
          fileUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400'
        },
        insurance: {
          title: 'Commercial Ride-Hailing Insurance',
          docNumber: 'POL-COMM-998231',
          status: 'VERIFIED',
          expiryDate: '2026-10-25',
          daysUntilExpiry: 36,
          isExpiringSoon: true,
          fileUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=400'
        }
      },
      payoutDetails: {
        bankName: 'Silicon City National Bank',
        accountNumber: '••••••••4892',
        routingNumber: '021000021',
        upiId: `${driver.email.split('@')[0]}@okhdfcbank`,
        preferredMethod: 'INSTANT_BANK'
      }
    };

    this.getExtras().kyc[driver.id] = initialKyc;
    this.saveData();
    return initialKyc;
  }

  updateDriverKyc(driverId, docType, fileData) {
    const kyc = this.getDriverKyc(driverId);
    if (kyc.documents[docType]) {
      kyc.documents[docType] = {
        ...kyc.documents[docType],
        ...fileData,
        status: 'VERIFIED',
        updatedAt: new Date().toISOString()
      };
      this.saveData();
    }
    return kyc;
  }

  getDriverDestination(driverId) {
    const driver = this.resolveDriver(driverId);
    return this.getExtras().destination[driver.id] || { enabled: false, destination: null };
  }

  setDriverDestination(driverId, { enabled, destination }) {
    const driver = this.resolveDriver(driverId);
    const value = { enabled: Boolean(enabled), destination: destination || null };
    this.getExtras().destination[driver.id] = value;
    this.saveData();
    return value;
  }
}

module.exports = { DriverMethods };
