const mongoose = require('mongoose');

const setupInMemoryMock = () => {
  console.log("🛠️  [DB MOCK] Initializing In-Memory DB Mock for Mongoose models...");
  
  const Payment = require('../models/payment.model');
  const DisruptionPayout = require('../models/disruption_payout.model');
  
  const paymentStore = [];
  const payoutStore = [];
  
  // Mock Payment save
  Payment.prototype.save = async function() {
    this.createdAt = new Date();
    this.updatedAt = new Date();
    const idx = paymentStore.findIndex(p => p.eventId === this.eventId);
    if (idx !== -1) {
      paymentStore[idx] = this;
    } else {
      paymentStore.push(this);
    }
    return this;
  };
  
  // Mock Payment.findOne
  Payment.findOne = async function(query) {
    return paymentStore.find(p => {
      for (let k in query) {
        if (p[k] !== query[k]) return false;
      }
      return true;
    }) || null;
  };
  
  // Mock Payment.findOneAndUpdate
  Payment.findOneAndUpdate = async function(query, update) {
    const record = paymentStore.find(p => {
      for (let k in query) {
        if (p[k] !== query[k]) return false;
      }
      return true;
    });
    if (record) {
      Object.assign(record, update);
      return record;
    }
    return null;
  };
  
  // Mock DisruptionPayout save
  DisruptionPayout.prototype.save = async function() {
    this.createdAt = new Date();
    this.updatedAt = new Date();
    payoutStore.push(this);
    return this;
  };
  
  // Mock DisruptionPayout.find
  DisruptionPayout.find = function(query) {
    const results = payoutStore.filter(p => {
      for (let k in query) {
        if (p[k] !== query[k]) return false;
      }
      return true;
    });
    
    // Return chainable mock for sort and limit
    const chain = {
      sort: function(sortQuery) {
        results.sort((a, b) => b.createdAt - a.createdAt);
        return this;
      },
      limit: function(lim) {
        const sliced = results.slice(0, lim);
        return {
          then: function(resolve) {
            resolve(sliced);
          }
        };
      },
      then: function(resolve) {
        resolve(results);
      }
    };
    return chain;
  };
};

const connectDB = async () => {
  try {
    // Disable Mongoose commands buffering to fail fast on connection issues
    mongoose.set('bufferCommands', false);

    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/payment");
    console.log('📦 MongoDB Connected');
  } catch (error) {
    console.error('⚠️ MongoDB Connection Error (Mock mode active):', error.message);
    setupInMemoryMock();
  }
};

module.exports = { connectDB };
