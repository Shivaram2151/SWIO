const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

const stripe = require("stripe")(
  "sk_test_51OyMzBSIi1hbpR3mZYKOTVPwJXonhG8wnefnUhwzQUUfAZFhr8ZqsQpVd7gLJnxWOzcfk3LJX9b2Q8jTm3elzwas004QYKWvP1"
);

const app = express();
app.use(bodyParser.json());
app.use(cors());

mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
  })
  .then(() => console.log("Connected to Mongo"))
  .catch((err) => console.log(err));

const transactionSchema = new mongoose.Schema({
  name: String,
  amount: String,
  transactionID: String,
});

const storeItems = new Map([[1, { priceInCents: 10000, name: "shiva" }]]);
const Transaction = mongoose.model("Transaction", transactionSchema);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
app.post("/create-checkout-session", async (req, res) => {
  const { amount, name } = req.body;
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: {
              name: name,
              description:
                "Your career opportunities, updated in real-time, right on your desktop.",
            },
            unit_amount: amount, // amount should be in paise
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: "http://localhost:5173/success",
      cancel_url: "http://localhost:5173/Error",
    });
    console.log(session);
    res.json({ url: session.url, session: session });
  } catch (error) {
    console.error("Error creating Checkout Session:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/checkout-session", async (req, res) => {
  try {
    let { sessionId } = req.query;
    if (sessionId.endsWith(".")) {
      sessionId = sessionId.slice(0, -1);
    }
    console.log("Received session ID:", sessionId);

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    res.json(session);
  } catch (error) {
    console.error("Error retrieving checkout session:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

app.post("/save-payment-details", async (req, res) => {
  const { name, amount, transactionID } = req.body;
  const newTransaction = new Transaction({
    name,
    amount,
    transactionID,
  });
  console.log(name, amount, transactionID);
  try {
    await newTransaction.save();
    res.status(200).send("payment details saved successfully");
  } catch (error) {
    console.log(error);
    res.status(500).send("Error saving payment details.." + error);
  }
});

app.get("/transactions", async (req, res) => {
  try {
    const charges = await stripe.charges.list();

    console.log(charges);

    const transactions = charges.data.map((intent) => ({
      id: intent.id,
      amount: intent.amount / 100,
      currency: intent.currency,
      customer: intent.customer,
      description: intent.description,
      status: intent.status,
      created: intent.created,
      name: intent.billing_details.name,
      billings: intent.billing_details ? intent.billing_details : [],
    }));

    res.json(transactions);
  } catch (error) {
    console.error("Error fetching payment transactions from Stripe:", error);
    res.status(500).json({ error: "Failed to fetch payment transactions" });
  }
});
