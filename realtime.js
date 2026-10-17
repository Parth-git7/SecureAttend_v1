// realtime.js
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const Student = require("./models/Student");
const StudentGroup = require("./models/StudentGroup");
const Teacher = require("./models/Teacher");
const AttendanceSession = require("./models/AttendanceSession");

let io = null;

function initRealtime(server) {
    const origins = (process.env.CORS_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);
    io = new Server(server, { cors: { origin: origins } });

    io.use((socket, next) => {
        try {
            socket.user = jwt.verify(socket.handshake.auth?.token, process.env.JWT_SECRET);
            next();
        } catch {
            next(new Error("unauthorized"));
        }
    });

    io.on("connection", async (socket) => {
        const { userId, role } = socket.user;

        if (role === "STUDENT") {
            try {
                const student = await Student.findOne({ userId }).select("_id");
                if (student) {
                    const memberships = await StudentGroup.find({ studentId: student._id }).select("groupId");
                    memberships.forEach((m) => socket.join(`group:${m.groupId}`));
                }
                socket.emit("ready");
            } catch (err) {
                console.error("socket student join error:", err.message);
            }
        }

        if (role === "TEACHER") {
            socket.on("watch", async (sessionId, ack) => {
                try {
                    const teacher = await Teacher.findOne({ userId }).select("_id");
                    const owns = teacher && (await AttendanceSession.exists({ _id: sessionId, teacherId: teacher._id }));
                    if (owns) socket.join(`session:${sessionId}`);
                    ack?.(!!owns);
                } catch {
                    ack?.(false);
                }
            });
        }
    });
}

// teacher-driven change: students in the group and the teacher refetch
function sessionChanged(session) {
    if (!io) return;
    io.to(`group:${session.groupId}`).emit("session:changed");
    io.to(`session:${session._id}`).emit("roster:changed");
}

// student-driven change: only the teacher needs to refetch
function rosterChanged(sessionId) {
    io?.to(`session:${sessionId}`).emit("roster:changed");
}

module.exports = { initRealtime, sessionChanged, rosterChanged };