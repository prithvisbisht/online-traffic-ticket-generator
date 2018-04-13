const mongoose = require('mongoose');

const plateNumberSchema = mongoose.Schema({ 
	plateNumber : String,
	owner: String,
	email: String
});

const PlateNumber = module.exports = mongoose.model('PlateNumber', plateNumberSchema);