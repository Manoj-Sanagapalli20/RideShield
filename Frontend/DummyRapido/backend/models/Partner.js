const mongoose = require('mongoose');

const partnerSchema = new mongoose.Schema({
  partnerId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  address: { type: String, required: true },
  password: { type: String, required: true },
  upi: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Partner', partnerSchema);
