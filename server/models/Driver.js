const mongoose = require('mongoose');

const DriverSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // NEW FIELD
  vehicleType: { type: String, enum: ['Auto', 'Rickshaw'], default: 'Auto' },
  vehicleNumber: { type: String, required: true },
  status: { type: String, default: 'OFFLINE' },
  location: { type: String, default: null },
  lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Driver', DriverSchema);