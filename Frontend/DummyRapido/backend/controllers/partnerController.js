const Partner = require('../models/Partner');
const DailyLog = require('../models/DailyLog');

exports.registerPartner = async (req, res) => {
  try {
    const { name, phone, email, address, password, upi } = req.body;
    
    // Check if partner already exists
    const existingPartner = await Partner.findOne({ $or: [{ phone }, { email }] });
    if (existingPartner) {
      return res.status(400).json({ message: "Phone or Email already registered" });
    }

    // Generate unique 5-digit ID
    let partnerId;
    let isUnique = false;
    while (!isUnique) {
      partnerId = Math.floor(10000 + Math.random() * 90000).toString();
      const checkId = await Partner.findOne({ partnerId });
      if (!checkId) isUnique = true;
    }

    const newPartner = new Partner({ partnerId, name, phone, email, address, password, upi });
    await newPartner.save();
    res.status(201).json({ message: "Partner registered successfully", partner: newPartner });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.loginPartner = async (req, res) => {
  try {
    const { phone, password } = req.body;
    const partner = await Partner.findOne({ phone, password });
    if (!partner) return res.status(401).json({ message: "Invalid phone or password" });
    res.status(200).json({ message: "Login successful", partner });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getPartnerProfile = async (req, res) => {
  try {
    const { partnerId } = req.params;
    const partner = await Partner.findOne({ partnerId }).select("-password");
    if (!partner) return res.status(404).json({ message: "Partner not found" });
    res.status(200).json({ partner });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.loginWithPartnerId = async (req, res) => {
  try {
    const { partnerId, password } = req.body;
    
    // Optional password validation since it's a dummy app, 
    // but looking for partnerId is the main goal here.
    const query = { partnerId };
    if (password) query.password = password;

    const partner = await Partner.findOne(query);
    if (!partner) return res.status(401).json({ message: "Invalid Partner ID" });
    
    res.status(200).json({ message: "Login successful", partner });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.saveDailyLog = async (req, res) => {
  try {
    const { partnerId, date, totalRides, totalEarnings, hourlyActivity } = req.body;
    
    // Validate partner ID
    const partner = await Partner.findById(partnerId);
    if (!partner) return res.status(404).json({ message: "Partner not found" });

    const log = await DailyLog.findOneAndUpdate(
      { partner: partnerId, date },
      { totalRides, totalEarnings, hourlyActivity },
      { new: true, upsert: true }
    );

    res.status(200).json({ message: "Daily activity saved successfully", log });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getDailyLog = async (req, res) => {
  try {
    const { partnerId, date } = req.params;
    
    // We look up the partner first since DailyLog ties to ObjectId
    const partner = await Partner.findOne({ partnerId });
    let log = null;
    
    if (partner) {
        log = await DailyLog.findOne({ partner: partner._id, date });
    }
    
    if (!log) {
      return res.status(200).json({ 
        log: { 
          partner: partnerId, 
          date, 
          totalRides: 0, 
          totalEarnings: 0, 
          hourlyActivity: [
            { timeSlot: "10:00", isOnline: true, ridesAccepted: 0, earnings: 0 },
            { timeSlot: "11:00", isOnline: true, ridesAccepted: 0, earnings: 0 },
            { timeSlot: "12:00", isOnline: false, ridesAccepted: 0, earnings: 0 },
            { timeSlot: "14:00", isOnline: true, ridesAccepted: 0, earnings: 0 },
            { timeSlot: "15:00", isOnline: true, ridesAccepted: 0, earnings: 0 },
            { timeSlot: "16:00", isOnline: true, ridesAccepted: 0, earnings: 0 },
            { timeSlot: "17:00", isOnline: true, ridesAccepted: 0, earnings: 0 },
            { timeSlot: "18:00", isOnline: true, ridesAccepted: 0, earnings: 0 }
          ] 
        } 
      });
    }
    
    res.status(200).json({ log });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
