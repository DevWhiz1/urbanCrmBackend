const Contractor = require('../models/contractor.schema');
const Client = require('../models/client.schema');

const attachUserScope = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    const userId = req.user.userId || req.user.id || req.user._id;

    if (req.user.role === 'Contractor') {
      const contractor = await Contractor.findOne({ user: userId });
      if (contractor) {
        req.contractorId = contractor._id;
      }
    } else if (req.user.role === 'User') {
      const client = await Client.findOne({ user: userId });
      if (client) {
        req.clientId = client._id;
      }
    }

    next();
  } catch (error) {
    console.error('Error attaching user scope:', error);
    next();
  }
};

module.exports = {
  attachUserScope,
};
