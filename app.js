const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const academicRoutes = require("./routes/academic");
const attendanceSessionRoutes = require("./routes/attendanceSessions");

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

app.use(
    cors({
        origin: (origin, callback) => {
            // no Origin header = same-origin page, curl, Postman, or server-to-server
            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            callback(null, false);
        },
        allowedHeaders: ["Content-Type", "Authorization"],
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    })
);

app.use(express.json({ limit: "2mb" }));
app.use(express.static("public"));

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/academic", academicRoutes);
app.use("/api/attendance-sessions", attendanceSessionRoutes);

app.get("/", (req, res) => {
    res.json({ message: "SecureAttend API is running" });
});

module.exports = app;