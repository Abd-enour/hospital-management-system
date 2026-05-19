const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { HospitalConfig } = require('./patterns');
const config = HospitalConfig.getInstance();
console.log('Starting:', config.get('hospitalName'), 'v' + config.get('version'));

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/api', require('./routes/index'));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Server error' }); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MediCore HMS → http://localhost:${PORT}`));
module.exports = app;
