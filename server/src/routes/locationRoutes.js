const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');

// GET /api/location/current
router.get('/current', locationController.getCurrentLocation);

// POST /api/location/update
router.post('/update', locationController.updateLocation);

// PUT /api/location/settings
router.put('/settings', locationController.updateSettings);

// POST /api/location/reverse-geocode
router.post('/reverse-geocode', locationController.reverseGeocodeCoordinates);

module.exports = router;
