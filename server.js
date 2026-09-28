require("dotenv").config();

const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const bcrypt = require("bcrypt");
const express = require("express");
const mongoose = require("mongoose");

const app = express();

app.use(express.json());
app.use(express.static("public"));
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes) ;


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

