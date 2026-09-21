const db = require('../src/db');

console.log('🔄 Running standalone SQLite seed script for NexRide...');
db.initSeedData(true);
console.log('✨ NexRide SQLite database seeded successfully!');
process.exit(0);
