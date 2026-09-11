const {
  getCurrentLocation,
  updateLocationCoordinates,
  reverseGeocode,
} = require('../services/locationService');
const LocationState = require('../models/LocationState');

/**
 * GET /api/location/current
 * Fetch current live location and privacy settings
 */
exports.getCurrentLocation = async (req, res) => {
  try {
    const location = await getCurrentLocation();
    res.json({
      success: true,
      data: location,
    });
  } catch (error) {
    console.error('[LocationController] Error getting location:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve location state',
      error: error.message,
    });
  }
};

/**
 * POST /api/location/update
 * Receive GPS coordinates from mobile phone GPS webapp or dashboard
 */
exports.updateLocation = async (req, res) => {
  try {
    const { latitude, longitude, accuracy, address, name, updatedBy } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required',
      });
    }

    const updated = await updateLocationCoordinates({
      latitude,
      longitude,
      accuracy: accuracy || 10,
      address,
      name,
      updatedBy: updatedBy || 'phone_gps',
    });

    res.json({
      success: true,
      message: 'Location updated successfully',
      data: updated,
    });
  } catch (error) {
    console.error('[LocationController] Error updating location:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update location',
      error: error.message,
    });
  }
};

/**
 * PUT /api/location/settings
 * Update location sharing rules and privacy toggles
 */
exports.updateSettings = async (req, res) => {
  try {
    const {
      isLiveTrackingActive,
      shareWithAll,
      generalLocationDescription,
      name,
      address,
      latitude,
      longitude,
    } = req.body;

    const state = await LocationState.getLocation();

    if (typeof isLiveTrackingActive === 'boolean') {
      state.isLiveTrackingActive = isLiveTrackingActive;
    }
    if (typeof shareWithAll === 'boolean') {
      state.shareWithAll = shareWithAll;
    }
    if (generalLocationDescription !== undefined) {
      state.generalLocationDescription = generalLocationDescription.trim();
    }
    if (name !== undefined && name.trim() !== '') {
      state.name = name.trim();
    }
    if (address !== undefined && address.trim() !== '') {
      state.address = address.trim();
    }
    if (latitude !== undefined && longitude !== undefined) {
      state.latitude = parseFloat(latitude);
      state.longitude = parseFloat(longitude);
      state.updatedBy = 'dashboard_manual';
      state.lastUpdated = new Date();
    }

    await state.save();

    res.json({
      success: true,
      message: 'Location settings updated successfully',
      data: state,
    });
  } catch (error) {
    console.error('[LocationController] Error updating location settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update location settings',
      error: error.message,
    });
  }
};

/**
 * POST /api/location/reverse-geocode
 * Helper endpoint to reverse geocode lat/lng
 */
exports.reverseGeocodeCoordinates = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, message: 'Missing coordinates' });
    }
    const address = await reverseGeocode(parseFloat(latitude), parseFloat(longitude));
    res.json({ success: true, address });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
