const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");

const router = express.Router();
const googleClient = new OAuth2Client( process.env.GOOGLE_CLIENT_ID );


// login using password
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check that both fields were provided
        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        // Find user
        const normalizedEmail = email.toLowerCase().trim(); 
        const user = await User.findOne({ email: normalizedEmail });

        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        if (!user.passwordHash) {
            return res.status(401).json({
                message: "This account does not have password login enabled"
            });
        }

        // Compare password
        const isMatch = await bcrypt.compare(
            password,
            user.passwordHash
        );


        if (!isMatch) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        // Create JWT
        const token = jwt.sign(
            {
                userId: user._id,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1h"
            }
        );

        // Login successful
        res.json({
            message: "Login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
});


// login using google OAuth
router.post("/google", async (req, res) => {
    try {
        const { credential } = req.body;

        if (!credential) {
            return res.status(400).json({
                message: "Google credential is required"
            });
        }

        // Verify Google ID token
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();

        const googleEmail = payload.email;
        const googleId = payload.sub;
        const emailVerified = payload.email_verified;

        if (!emailVerified) {
            return res.status(401).json({
                message: "Google email is not verified"
            });
        }

        // Find pre-created SecureAttend account
        const user = await User.findOne({
            email: googleEmail.toLowerCase()
        });

        if (!user) {
            return res.status(403).json({
                message: "No SecureAttend account exists for this Google account"
            });
        }
        if (user.googleId && user.googleId !== googleId) {
            return res.status(403).json({
                message: "This SecureAttend account is already linked to another Google account"
            });
        }

        if (!user.googleId) {
            user.googleId = googleId;
            await user.save();
        }

        
        // Create SecureAttend JWT
        const token = jwt.sign(
            {
                userId: user._id,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1h"
            }
        );

        res.json({
            message: "Google login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Google login error:", error);

        res.status(401).json({
            message: "Invalid Google credential"
        });
    }
});



module.exports = router;