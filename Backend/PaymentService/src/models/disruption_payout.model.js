const mongoose = require('mongoose');

const disruptionPayoutSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  email: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  disruptedHours: {
    type: Number,
    required: true
  },
  date: {
    type: String,
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['REVIEW', 'PROCESSED', 'FAILED', 'REJECTED'],
    default: 'PROCESSED'
  },
  priority: {
    type: String,
    enum: ['high', 'normal'],
    default: 'normal'
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('DisruptionPayout', disruptionPayoutSchema);
