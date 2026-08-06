const Counter = require('../models/counter.schema');

/**
 * Generates an atomic sequential business ID in the format: PREFIX-YYYY-######
 * Example: PAY-2026-000001
 * Sequence automatically resets when a new calendar year begins.
 * 
 * @param {string} modulePrefix - The prefix for the module (e.g. 'PAY', 'PROJ', 'EMP')
 * @returns {Promise<string>} The newly generated ID
 */
const generateBusinessId = async (modulePrefix) => {
  const year = new Date().getFullYear();
  
  // Use findOneAndUpdate with upsert: true and $inc to atomically get the next sequence
  // If the document for the current year doesn't exist, upsert creates it and starts sequence at 1
  const counter = await Counter.findOneAndUpdate(
    { module: modulePrefix, year },
    { $inc: { sequence: 1 } },
    { new: true, upsert: true }
  );

  // Pad the sequence to 6 digits (e.g. 000001)
  const sequenceStr = counter.sequence.toString().padStart(6, '0');
  
  return `${modulePrefix}-${year}-${sequenceStr}`;
};

module.exports = generateBusinessId;
