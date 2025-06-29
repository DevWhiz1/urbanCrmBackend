const express = require("express");
const paymentController = require("../controllers/payment.controller");
const router = express.Router();

router.post("/create-payment", paymentController.createPayment);
router.get("/get-all-payments", paymentController.getAllPayments);

module.exports = router;