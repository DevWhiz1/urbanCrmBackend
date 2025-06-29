const User = require("../models/users.schema.js");
const bcrypt = require("bcrypt");
const config = require("../config/config");
const jwt = require("jsonwebtoken");
const emailService = require("../service/email.service.js");

const authController = {}

authController.register = async (req, res) => {
  try {
    console.log('BODY RECEIVED:', req.body); 
    const { userName, email, password } = req.body;
    
    // Simple validation
    if (!userName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if email exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 10);
    const token = jwt.sign({ email }, config.secret, { expiresIn: '1h' });

    const user = new User({
      userName,
      email,
      password: hashedPassword,
      accessToken: token,
      role: 'User', // Default role
      status: 'Active'
    });

    await user.save();

    return res.status(201).json({
      message: "Registration successful",
      token,
      user: {
        id: user._id,
        userName: user.userName,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

authController.login = async (req, res) => {
  try {
     console.log('BODY RECEIVED:', req.body); 
    const { email, password } = req.body.email ? req.body.email : req.body;
    const user = await User.findOne({ email });
  // const user = await User.findOne({ email: req.body.email }) 
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      config.secret,
      { expiresIn: '1h' }
    );

    user.accessToken = token;
    await user.save();

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        userName: user.userName,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

authController.verifyOtp = async (req, res) => {
  try {
    let { email, otp } = req.body;

    let user = await usersSchema.findOne({ email, otp });

    if (user !== null) {
      await usersSchema.updateOne({ email }, { $set: { otpVerified: true } });

      const accessToken = jwt.sign(
        { user_id: user._id, email: user.email },
        config.secret
      );
      await usersSchema.updateOne({ email }, { $set: { accessToken } });

      const updatedUser = await usersSchema.findOne({ email });

      return res.status(200).json({
        status: 200,
        message: "OTP Verified Successfully",
        user: { ...updatedUser, accessToken },
      });
    } else {
      return res.status(400).json({ status: 400, message: "Invalid OTP" });
    }
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

authController.sendOtp = async (req, res) => {
  try {
    let { email } = req.body;
    const user = await usersSchema.findOne({ email });

    if (!user) {
      return res.status(404).json({ status: 404, message: "User not found" });
    }

    user.otp = "1234"; 
    await user.save();

    await emailService.sendMail(
      user.email,
      "Otp Verification",
      `Your OTP is: ${user.otp}`
    );

    return res.status(200).json({ status: 200, message: "OTP sent successfully." });
  } catch (error) {
    console.error("Error in sending OTP", error);
    return res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

authController.resetPassword = async (req, res) => {
  try {
    let body = req.body;
    const hashedPassword = await bcrypt.hash(body.password, 10);

    const resetPassword = await usersSchema.updateOne(
      { email: body.email },
      { $set: { password: hashedPassword } }
    );
    
    if (!resetPassword || resetPassword.modifiedCount === 0) {
      return res.status(400).json({ message: "Failed to reset password" });
    }
    
    if (resetPassword) {
      return res.status(200).json({
        status: 200,
        message: "Password Updated Successfully",
      });
    }
    else {
      return res.status(400).json({ status: 400, message: "Error in updating password" });
    }
  } catch (error) {
    console.error('Error verifying otp:', error);
    return res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

module.exports = authController;
