require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Driver = require('./models/Driver');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Needed for Twilio SMS

// --- CONFIGURATION ---
const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI;
const SECRET_KEY = process.env.SECRET_KEY;

// --- THE "CHEAT SHEET" MAP ---
const LOCATION_MAP = {
  '10': 'Main Gate',
  '11': 'Hall 1',
  '12': 'Hall 5',
  '13': 'Health Centre',
  '14': 'Library',
  '15': 'Airstrip'
};

mongoose.connect(MONGO_URI) // Mongoose 6+ no longer needs useNewUrlParser/useUnifiedTopology
  .then(() => {
    console.log("✅ MongoDB Atlas Connected"); 
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error("❌ DB Connection Error:", err.message);
  });

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) return res.sendStatus(401); // Unauthorized

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403); // Forbidden
    req.user = user;
    next();
  });
};

// --- ROUTES ---

// 1. GET: Riders use this to see who is available
app.get('/api/riders', async (req, res) => {
  try {
    // Find only AVAILABLE drivers
    const drivers = await Driver.find({ status: 'AVAILABLE' });
    res.json(drivers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REGISTER & AUTO-LOGIN ROUTE
app.post('/api/register', async (req, res) => {
  const { name, phone, password, vehicleType, vehicleNumber } = req.body;
  
  try {
    // 1. Check if driver exists
    const existingDriver = await Driver.findOne({ phone });
    if (existingDriver) {
      return res.status(400).json({ success: false, message: "Driver already registered with this phone." });
    }

    // 2. Encrypt Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Create Driver
    const driver = new Driver({ 
      name, phone, vehicleType, vehicleNumber, 
      password: hashedPassword 
    });
    await driver.save();

    // 4. GENERATE TOKEN (Crucial Step!)
    const token = jwt.sign(
      { phone: driver.phone, id: driver._id }, 
      SECRET_KEY, 
      { expiresIn: '24h' }
    );
    
    // 5. Return Token and Driver Data
    res.json({ 
      success: true, 
      message: "Welcome!", 
      token, 
      driver: { name: driver.name, phone: driver.phone } 
    });

  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({ success: false, message: "Server Error during registration." });
  }
});

// 2. POST: The "Brain" (Handles SMS & Web Updates)
// Input: { phone: "...", code: "..." }
async function updateDriverLogic(phone, code) {
  // Find Driver
  let driver = await Driver.findOne({ phone });
  
  // ERROR: Driver must be registered first (No more auto-register)
  if (!driver) {
    return { success: false, message: "Driver not registered." };
  }

  let message = "";
  
  // LOGIC SWITCH
  if (code === '0') {
    driver.status = 'OFFLINE';
    driver.location = null;
    message = "You are Offline.";
  } 
  else if (code === '9') {
    driver.status = 'BUSY';
    message = "Status: Busy.";
  } 
  else if (LOCATION_MAP[code]) {
    driver.status = 'AVAILABLE';
    driver.location = LOCATION_MAP[code];
    message = `Updated: ${LOCATION_MAP[code]}`;
  } 
  else {
    return { success: false, message: "Invalid Code.", driver };
  }

  driver.lastUpdated = new Date();
  await driver.save();

  return { success: true, message, driver };
}

// --- 3. ROUTE A: SECURE WEB UPDATE (For React App) ---
// Uses 'authenticateToken' to ensure only logged-in drivers can call this
app.post('/api/update', authenticateToken, async (req, res) => {
  // We get the phone from the TOKEN (secure), not the body
  const phone = req.user.phone; 
  const { code } = req.body;

  try {
    const result = await updateDriverLogic(phone, code);
    
    if (!result.success) {
       return res.status(400).json(result);
    }
    res.json(result);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 4. ROUTE B: SMS UPDATE (For Twilio) ---
// No Token required, relies on Phone Number from SMS
app.post('/api/sms', async (req, res) => {
  console.log("📨 Incoming Data:", req.body); 

  // 1. FLEXIBLE DATA EXTRACTION
  // Check typical keys apps use. Added 'content' for your specific app.
  let phone = req.body.From || req.body.from || req.body.sender || req.body.address;
  let code = req.body.Body || req.body.body || req.body.message || req.body.msg || req.body.content; // <--- ADDED THIS

  // 2. VALIDATION
  if (!phone || !code) {
    console.log("❌ Missing Phone or Code");
    // Send a 200 OK anyway so the Android app stops retrying
    return res.status(200).json({ error: "Missing data" });
  }

  // 3. CLEANUP
  // Remove non-digits (remove + and spaces)
  phone = phone.toString().replace(/\D/g, ''); 
  // Result: "918957766736"

  // OPTIONAL: Standardize format. 
  // If you registered as "8957..." but phone sends "918957...", strip the 91.
  // Uncomment the line below if your database stores numbers WITHOUT 91.
  if (phone.startsWith('91') && phone.length === 12) phone = phone.slice(2);

  code = code.toString().trim();

  try {
    const result = await updateDriverLogic(phone, code);
    
    console.log(`✅ Success: Updated ${phone} to ${code}`);
    res.json({ success: true, message: result.message });

  } catch (err) {
    console.error("❌ Logic Error:", err);
    res.status(500).send("Error");
  }
});

app.post('/api/login', async (req, res) => {
  const { phone, password } = req.body;

  try {
    const driver = await Driver.findOne({ phone });
    if (!driver) return res.status(400).json({ success: false, message: "User not found" });

    // CHECK PASSWORD
    const isMatch = await bcrypt.compare(password, driver.password);
    if (!isMatch) return res.status(400).json({ success: false, message: "Invalid Password" });

    // GENERATE TOKEN (Valid for 24 hours)
    const token = jwt.sign({ phone: driver.phone, id: driver._id }, SECRET_KEY, { expiresIn: '24h' });

    res.json({ success: true, token, driver });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/driver/:phone', async (req, res) => {
  try {
    const driver = await Driver.findOne({ phone: req.params.phone });
    if (driver) {
      res.json({ exists: true, driver });
    } else {
      res.json({ exists: false });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/driver/profile', async (req, res) => {
  const { phone, name, vehicleType, vehicleNumber } = req.body;

  try {
    // 1. Find the driver by the immutable phone number
    const driver = await Driver.findOne({ phone });
    
    if (!driver) {
      return res.status(404).json({ success: false, message: "Driver not found." });
    }

    // 2. Update the allowed fields
    driver.name = name;
    driver.vehicleType = vehicleType;
    driver.vehicleNumber = vehicleNumber;
    
    // 3. Save
    await driver.save();
    
    res.json({ success: true, message: "Profile Updated Successfully!", driver });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});