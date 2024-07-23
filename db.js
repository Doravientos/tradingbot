// Initialize Mongoose
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();
mongoose.connect(`mongodb://${process.env.DB_URL}/${process.env.DB_NAME}`, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const contractAddressSchema = new mongoose.Schema({
  userId: {
    type: Number,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
  marketCap: {
    type: Number,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const SettingSchema = new mongoose.Schema({
  MC: Number,
  Buy: Number,
});

const SellSchema = new mongoose.Schema({
  multiplier: Number,
  percentage: Number,
});

const StrategySchema = new mongoose.Schema({
  settings: [SettingSchema],
  sell: [SellSchema],
});

// Define the main schema
const UserSchema = new mongoose.Schema({
  userId: Number,
  privateKey: String,
  strategy: [StrategySchema],
});


// Create the model
const User = mongoose.model("User", UserSchema);

const ContractAddress = mongoose.model(
  "ContractAddress",
  contractAddressSchema
);

module.exports = { ContractAddress, User };
