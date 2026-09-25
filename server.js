require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");

const app = express();

// mongo db connection here 
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB connected");
    })
    .catch((error) => {
        console.log("MongoDB connection failed:", error);
    });

app.get("/", (req, res) => {
    res.json({
        message: "SecureAttend API is running"
    });
});

app.listen(3000, () => {
    console.log("SecureAttend server running on port 3000");
});

