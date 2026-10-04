const express = require("express");

const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const academicRoutes = require("./routes/academic");
const attendanceSessionRoutes = require("./routes/attendanceSessions");

const app = express();

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