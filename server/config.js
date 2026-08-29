require('dotenv').config();

const OUTPUT_DIR = process.env.OUTPUT_DIR;
if (!OUTPUT_DIR) {
  throw new Error('OUTPUT_DIR is not set in .env');
}

module.exports = {
  OUTPUT_DIR,
  PORT: process.env.PORT || 3001,
};
