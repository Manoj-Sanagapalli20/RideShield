const mongoose = require('mongoose'); 

const dailyLogSchema = new mongoose.Schema({
  partner: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true },
  date: { type: String, required: true },
  totalRides: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },
  hourlyActivity: [
    {
      timeSlot: String,
      isOnline: Boolean,
      ridesAccepted: Number,
      earnings: Number
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('DailyLog', dailyLogSchema);
