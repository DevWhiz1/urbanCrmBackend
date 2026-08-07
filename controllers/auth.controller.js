const User = require("../models/users.schema.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const emailService = require("../service/email.service.js");

const authController = {}

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",       // HTTPS only in production
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // 'none' for cross-origin
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// ─── Register ─────────────────────────────────────────────────────────────────
authController.register = async (req, res) => {
  try {
    const { userName, email, password, role } = req.body;

    if (!userName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      userName,
      email,
      password: hashedPassword,
      plainPassword: password,
      role: role || 'Client',
      status: 'Active'
    });

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    user.accessToken = token;

    await user.save();

    // Set token in httpOnly cookie
    res.cookie("token", token, cookieOptions);

    return res.status(201).json({
      message: "Registration successful",
      user: {
        id: user._id,
        userName: user.userName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── Login ────────────────────────────────────────────────────────────────────
authController.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email, userName: user.userName, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Set token in httpOnly cookie — never exposed to JavaScript
    res.cookie("token", token, cookieOptions);

    return res.status(200).json({
      message: 'Login successful',
      user: {
        id: user._id,
        userName: user.userName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Get Current User (me) ────────────────────────────────────────────────────
authController.getMe = async (req, res) => {
  try {
    // req.user is populated by authenticateToken middleware
    const user = await User.findById(req.user.userId).select("-password -plainPassword -accessToken");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      user: {
        id: user._id,
        userName: user.userName,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── Logout ───────────────────────────────────────────────────────────────────
authController.logout = async (req, res) => {
  try {
    // Must pass same options as when cookie was set so the browser clears it correctly
    res.clearCookie("token", cookieOptions);
    return res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── Verify OTP ───────────────────────────────────────────────────────────────
authController.verifyOtp = async (req, res) => {
  try {
    let { email, otp } = req.body;

    let user = await User.findOne({ email, otp });

    if (user !== null) {
      await User.updateOne({ email }, { $set: { otpVerified: true } });

      const accessToken = jwt.sign(
        { userId: user._id, email: user.email },
        process.env.JWT_SECRET
      );
      await User.updateOne({ email }, { $set: { accessToken } });

      const updatedUser = await User.findOne({ email });

      return res.status(200).json({
        status: 200,
        message: "OTP Verified Successfully",
        user: { ...updatedUser, accessToken },
      });
    } else {
      return res.status(400).json({ status: 400, message: "Invalid OTP" });
    }
  } catch (error) {
    return res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

// ─── Send OTP ─────────────────────────────────────────────────────────────────
authController.sendOtp = async (req, res) => {
  try {
    let { email } = req.body;
    const user = await User.findOne({ email });

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
    return res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

// ─── Reset Password ───────────────────────────────────────────────────────────
authController.resetPassword = async (req, res) => {
  try {
    let body = req.body;
    const hashedPassword = await bcrypt.hash(body.password, 10);

    const resetPassword = await User.updateOne(
      { email: body.email },
      { $set: { password: hashedPassword } }
    );

    if (!resetPassword || resetPassword.modifiedCount === 0) {
      return res.status(400).json({ message: "Failed to reset password" });
    }

    return res.status(200).json({
      status: 200,
      message: "Password Updated Successfully",
    });
  } catch (error) {
    return res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

module.exports = authController;
