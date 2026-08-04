const { uploadToCloudinary } = require('../utils/cloudinary');

const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file provided' });
    }

    const result = await uploadToCloudinary(req.file.buffer, 'crm_uploads');

    res.status(200).json({
      url: result.secure_url,
      public_id: result.public_id,
      format: result.format,
    });
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ message: 'Error uploading file' });
  }
};

module.exports = { uploadFile };
