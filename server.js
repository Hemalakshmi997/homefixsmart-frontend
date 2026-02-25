const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const MONGODB_URI = 'mongodb+srv://HEMALAKSHMI:HfixSecure2025@homeservice.n0ibamt.mongodb.net/homefix?retryWrites=true&w=majority';
const JWT_SECRET = 'homefix-secret-2025';
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ MongoDB Connected Successfully');
  initializeData();
}).catch(err => {
  console.error('❌ MongoDB Connection Error:', err);
});

// SCHEMAS
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  phone: String,
  address: String,
  createdAt: { type: Date, default: Date.now }
});

const serviceSchema = new mongoose.Schema({
  name: String,
  description: String,
  icon: String,
  basePrice: Number,
  category: String,
  isActive: { type: Boolean, default: true },
  subServices: [{
    name: String,
    description: String,
    price: Number,
    duration: String,
    isActive: { type: Boolean, default: true }
  }],
  createdAt: { type: Date, default: Date.now }
});

const technicianSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  specialization: String,
  experience: String,
  rating: { type: Number, default: 4.5 },
  reviews: { type: Number, default: 0 },
  completedJobs: { type: Number, default: 0 },
  isAvailable: { type: Boolean, default: true },
  cities: [String],
  createdAt: { type: Date, default: Date.now }
});

const bookingSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  serviceId: mongoose.Schema.Types.ObjectId,
  subServiceId: mongoose.Schema.Types.ObjectId,
  technicianId: mongoose.Schema.Types.ObjectId,
  date: String,
  time: String,
  address: String,
  city: String,
  area: String,
  notes: String,
  status: { type: String, default: 'pending' },
  totalAmount: Number,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Service = mongoose.model('Service', serviceSchema);
const Technician = mongoose.model('Technician', technicianSchema);
const Booking = mongoose.model('Booking', bookingSchema);

// AUTH MIDDLEWARE
const auth = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token required' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
};

// ROUTES
app.get('/', (req, res) => {
  res.json({ 
    message: 'HOME FIX SMART SERVICES API',
    tagline: 'ONE CALL TOTAL HOME CARE',
    status: 'running',
    endpoints: {
      auth: '/api/auth/register, /api/auth/login',
      services: '/api/services',
      technicians: '/api/technicians',
      bookings: '/api/bookings'
    }
  });
});

// AUTH ROUTES
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body;
    
    if (!name || !email || !password || !phone || !address) {
      return res.status(400).json({ message: 'All fields required' });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, phone, address });
    await user.save();

    const token = jwt.sign({ userId: user._id, email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      message: 'Registration successful',
      token,
      user: { id: user._id, name, email, phone }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id, email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      message: 'Login successful',
      token,
      user: { id: user._id, name: user.name, email, phone: user.phone }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

// SERVICE ROUTES
app.get('/api/services', async (req, res) => {
  try {
    const services = await Service.find({ isActive: true });
    console.log(`✅ Found ${services.length} services`);
    res.json(services);
  } catch (error) {
    console.error('Services error:', error);
    res.status(500).json({ message: 'Failed to fetch services', error: error.message });
  }
});

// TECHNICIAN ROUTES
app.get('/api/technicians', async (req, res) => {
  try {
    const technicians = await Technician.find({ isAvailable: true });
    console.log(`✅ Found ${technicians.length} technicians`);
    res.json(technicians);
  } catch (error) {
    console.error('Technicians error:', error);
    res.status(500).json({ message: 'Failed to fetch technicians', error: error.message });
  }
});

// BOOKING ROUTES
app.post('/api/bookings', auth, async (req, res) => {
  try {
    const bookingData = {
      userId: req.user.userId,
      ...req.body
    };

    const booking = new Booking(bookingData);
    await booking.save();

    console.log('✅ Booking created:', booking._id);
    res.json({ message: 'Booking created successfully', booking });
  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({ message: 'Booking failed', error: error.message });
  }
});

app.get('/api/bookings', auth, async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user.userId })
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ message: 'Failed to fetch bookings', error: error.message });
  }
});

// INITIALIZE DEFAULT DATA
async function initializeData() {
  try {
    const serviceCount = await Service.countDocuments();
    
    if (serviceCount === 0) {
      console.log('📦 Initializing services...');
      
      const services = [
        {
          name: 'AC Service & Repair',
          description: 'Professional AC services',
          icon: '❄️',
          basePrice: 359,
          category: 'Home Appliances',
          subServices: [
            { name: 'AC Installation', description: 'Professional installation', price: 1500, duration: '2-3 hours', isActive: true },
            { name: 'AC Gas Refill', description: 'Gas refilling service', price: 2500, duration: '1-2 hours', isActive: true },
            { name: 'AC Deep Cleaning', description: 'Complete cleaning', price: 599, duration: '1-2 hours', isActive: true },
            { name: 'AC Repair', description: 'Expert repair', price: 359, duration: '1-2 hours', isActive: true }
          ]
        },
        {
          name: 'Cleaning & Pest Control',
          description: 'Professional cleaning services',
          icon: '🧹',
          basePrice: 239,
          category: 'Home Maintenance',
          subServices: [
            { name: 'Deep Home Cleaning', description: 'Complete home cleaning', price: 2999, duration: '4-6 hours', isActive: true },
            { name: 'Kitchen Cleaning', description: 'Kitchen deep clean', price: 899, duration: '2-3 hours', isActive: true },
            { name: 'Bathroom Cleaning', description: 'Bathroom sanitization', price: 599, duration: '1-2 hours', isActive: true },
            { name: 'Pest Control', description: 'General pest control', price: 1299, duration: '2-3 hours', isActive: true }
          ]
        },
        {
          name: 'Electrician',
          description: 'Certified electricians',
          icon: '⚡',
          basePrice: 179,
          category: 'Home Repair',
          subServices: [
            { name: 'Switch Installation', description: 'Install switches', price: 99, duration: '30 mins', isActive: true },
            { name: 'Fan Installation', description: 'Fan installation', price: 299, duration: '1 hour', isActive: true },
            { name: 'Light Installation', description: 'Light fixtures', price: 199, duration: '1 hour', isActive: true },
            { name: 'Wiring', description: 'Electrical wiring', price: 499, duration: '2-4 hours', isActive: true }
          ]
        },
        {
          name: 'Plumbing',
          description: 'Expert plumbers',
          icon: '🔧',
          basePrice: 215,
          category: 'Home Repair',
          subServices: [
            { name: 'Tap Repair', description: 'Fix leaking taps', price: 149, duration: '30 mins', isActive: true },
            { name: 'Toilet Repair', description: 'Toilet repairs', price: 299, duration: '1 hour', isActive: true },
            { name: 'Pipe Repair', description: 'Pipe leak repair', price: 399, duration: '1-2 hours', isActive: true },
            { name: 'Bathroom Fitting', description: 'Install fittings', price: 599, duration: '2-3 hours', isActive: true }
          ]
        },
        {
          name: 'Painting',
          description: 'Professional painting',
          icon: '🎨',
          basePrice: 599,
          category: 'Home Improvement',
          subServices: [
            { name: '1 BHK Painting', description: 'Complete 1 BHK', price: 8999, duration: '3-4 days', isActive: true },
            { name: '2 BHK Painting', description: 'Complete 2 BHK', price: 14999, duration: '4-5 days', isActive: true },
            { name: '3 BHK Painting', description: 'Complete 3 BHK', price: 21999, duration: '5-7 days', isActive: true }
          ]
        },
        {
          name: 'Carpenter',
          description: 'Skilled carpenters',
          icon: '🪚',
          basePrice: 299,
          category: 'Home Improvement',
          subServices: [
            { name: 'Furniture Assembly', description: 'Assemble furniture', price: 399, duration: '1-2 hours', isActive: true },
            { name: 'Furniture Repair', description: 'Repair furniture', price: 499, duration: '1-2 hours', isActive: true },
            { name: 'Door Installation', description: 'Install doors', price: 799, duration: '2-3 hours', isActive: true }
          ]
        }
      ];

      await Service.insertMany(services);
      console.log('✅ Services initialized successfully');
    } else {
      console.log(`✅ Found ${serviceCount} existing services`);
    }

    const techCount = await Technician.countDocuments();
    
    if (techCount === 0) {
      console.log('📦 Initializing technicians...');
      
      const technicians = [
        { name: 'Rajesh Kumar', email: 'rajesh@homefix.com', phone: '+91 9876543210', specialization: 'Home Appliances', experience: '8 years', rating: 4.8, reviews: 156, completedJobs: 243, cities: ['Bangalore', 'Hyderabad'], isAvailable: true },
        { name: 'Suresh Reddy', email: 'suresh@homefix.com', phone: '+91 9876543211', specialization: 'Home Repair', experience: '6 years', rating: 4.6, reviews: 98, completedJobs: 187, cities: ['Bangalore', 'Chennai'], isAvailable: true },
        { name: 'Amit Sharma', email: 'amit@homefix.com', phone: '+91 9876543212', specialization: 'Home Maintenance', experience: '5 years', rating: 4.7, reviews: 112, completedJobs: 156, cities: ['Mumbai', 'Pune'], isAvailable: true },
        { name: 'Vijay Singh', email: 'vijay@homefix.com', phone: '+91 9876543213', specialization: 'Home Repair', experience: '10 years', rating: 4.9, reviews: 203, completedJobs: 312, cities: ['Delhi', 'Bangalore'], isAvailable: true },
        { name: 'Prakash Rao', email: 'prakash@homefix.com', phone: '+91 9876543214', specialization: 'Home Improvement', experience: '7 years', rating: 4.5, reviews: 87, completedJobs: 134, cities: ['Hyderabad', 'Chennai'], isAvailable: true },
        { name: 'Anil Verma', email: 'anil@homefix.com', phone: '+91 9876543215', specialization: 'All Services', experience: '12 years', rating: 4.9, reviews: 245, completedJobs: 398, cities: ['Bangalore', 'Mumbai', 'Delhi'], isAvailable: true }
      ];

      await Technician.insertMany(technicians);
      console.log('✅ Technicians initialized successfully');
    } else {
      console.log(`✅ Found ${techCount} existing technicians`);
    }

    console.log('✅ Database initialization complete');
  } catch (error) {
    console.error('❌ Initialization error:', error);
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 HOME FIX SMART SERVICES - ONE CALL TOTAL HOME CARE`);
  console.log(`🌐 API URL: http://localhost:${PORT}`);
});

module.exports = app;