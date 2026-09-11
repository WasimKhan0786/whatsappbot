const mongoose = require('mongoose');

const locationStateSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'global_location',
  },
  latitude: {
    type: Number,
    default: 28.6139, // Default fallback: Delhi center
  },
  longitude: {
    type: Number,
    default: 77.2090,
  },
  accuracy: {
    type: Number,
    default: 10, // meters
  },
  name: {
    type: String,
    default: "Wasim Khan's Current Location",
    trim: true,
  },
  address: {
    type: String,
    default: 'Connaught Place, New Delhi, India',
    trim: true,
  },
  isLiveTrackingActive: {
    type: Boolean,
    default: true,
  },
  shareWithAll: {
    type: Boolean,
    default: true, // true = share with everyone; false = whitelisted contacts only
  },
  generalLocationDescription: {
    type: String,
    default: 'Currently at office / in meeting',
    trim: true,
  },
  updatedBy: {
    type: String,
    enum: ['phone_gps', 'whatsapp_pin', 'dashboard_manual', 'init_default'],
    default: 'init_default',
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
});

locationStateSchema.statics.getLocation = async function () {
  let state = await this.findOne({ key: 'global_location' });
  if (!state) {
    state = await this.create({
      key: 'global_location',
      latitude: 28.6139,
      longitude: 77.2090,
      accuracy: 15,
      name: "Wasim Khan's Current Location",
      address: 'Connaught Place, New Delhi, India',
      isLiveTrackingActive: true,
      shareWithAll: true,
      generalLocationDescription: 'Currently at office / in meeting',
      updatedBy: 'init_default',
      lastUpdated: new Date(),
    });
  }
  return state;
};

module.exports = mongoose.model('LocationState', locationStateSchema);
