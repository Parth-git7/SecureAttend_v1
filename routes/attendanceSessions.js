const express = require("express");
const mongoose = require("mongoose");

const AttendanceSession = require("../models/AttendanceSession");
const Teacher = require("../models/Teacher");
const Student = require("../models/Student");
const StudentGroup = require("../models/StudentGroup");
const Group = require("../models/Group");
const GroupSubject = require("../models/GroupSubject");
const AttendanceRecord = require("../models/AttendanceRecord");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const router = express.Router();

// Create attendance session
router.post(
    "/",
    authMiddleware,
    roleMiddleware("TEACHER"),
    async (req, res) => {
        try {
            const { groupId, subjectId } = req.body || {};

            if (!groupId || !subjectId) {
                return res.status(400).json({
                    message: "groupId and subjectId are required"
                });
            }

            for (const [field, value] of Object.entries({ groupId, subjectId })) {
                if (!mongoose.isValidObjectId(value)) {
                    return res.status(400).json({ message: `Invalid ${field}` });
                }
            }

            const teacher = await Teacher.findOne({ userId: req.user.userId });
            if (!teacher) {
                return res.status(404).json({ message: "Teacher profile not found" });
            }

            const group = await Group.findById(groupId);
            if (!group) {
                return res.status(404).json({ message: "Group not found" });
            }

            const assignment = await GroupSubject.findOne({ groupId, subjectId });
            if (!assignment) {
                return res.status(400).json({
                    message: "Subject is not assigned to this group"
                });
            }

            const roomCode = Math.random()
                .toString(36)
                .substring(2, 7)
                .toUpperCase();

            const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

            const session = await AttendanceSession.create({
                teacherId: teacher._id,
                academicPeriodId: group.academicPeriodId,
                branchId: group.branchId,
                semesterId: group.semesterId,
                groupId: group._id,
                subjectId,
                roomCode,
                status: "ACTIVE",
                expiresAt
            });

            res.status(201).json({
                message: "Attendance session created",
                session
            });

        } catch (error) {
            console.error("Create attendance session error:", error);
            res.status(500).json({ message: "Server error", error: error.message });
        }
    }
);

// GET Active session for the logged-in student
router.get(
    "/active",
    authMiddleware,
    roleMiddleware("STUDENT"),
    async (req, res) => {
        try {
            const student = await Student.findOne({ userId: req.user.userId });
            if (!student) {
                return res.status(404).json({ message: "Student profile not found" });
            }

            const memberships = await StudentGroup.find({ studentId: student._id });
            if (!memberships.length) {
                return res.status(404).json({
                    message: "Student is not assigned to a group"
                });
            }

            const session = await AttendanceSession.findOne({
                groupId: { $in: memberships.map((m) => m.groupId) },
                status: "ACTIVE",
                expiresAt: { $gt: new Date() }
            })
                .sort({ createdAt: -1 })
                .populate("groupId", "name")
                .populate("subjectId", "name code");

            if (!session) {
                return res.status(200).json({ activeSession: null });
            }

            const record = await AttendanceRecord.findOne({
                sessionId: session._id,
                studentId: student._id
            });

            res.status(200).json({
                activeSession: {
                    sessionId: session._id,
                    group: session.groupId,
                    subject: session.subjectId,
                    expiresAt: session.expiresAt,
                    myStatus : record ? record.status : null
                }
            });

        } catch (error) {
            console.error("Get active student session error:", error);
            res.status(500).json({ message: "Server error", error: error.message });
        }
    }
);

// End an attendance session (only by the teacher who started it)
router.patch(
    "/:sessionId/end",
    authMiddleware,
    roleMiddleware("TEACHER"),
    async (req, res) => {
        try {
            const { sessionId } = req.params;

            if (!mongoose.isValidObjectId(sessionId)) {
                return res.status(400).json({ message: "Invalid sessionId" });
            }

            const teacher = await Teacher.findOne({ userId: req.user.userId });
            if (!teacher) {
                return res.status(404).json({ message: "Teacher profile not found" });
            }

            // Atomic: only matches if the session is this teacher's and still ACTIVE
            const session = await AttendanceSession.findOneAndUpdate(
                { _id: sessionId, teacherId: teacher._id, status: "ACTIVE" },
                { $set: { status: "ENDED" } },
                { new: true }
            );

            if (!session) {
                return res.status(404).json({
                    message: "Active session not found for this teacher"
                });
            }

            res.status(200).json({
                message: "Attendance session ended",
                session
            });

        } catch (error) {
            console.error("End attendance session error:", error);
            res.status(500).json({ message: "Server error", error: error.message });
        }
    }
);


// helper: active, non-expired session by id
const findLiveSession = (sessionId) =>
    AttendanceSession.findOne({
        _id: sessionId,
        status: "ACTIVE",
        expiresAt: { $gt: new Date() }
    });

// STUDENT JOINS
router.post("/:sessionId/join", authMiddleware, roleMiddleware("STUDENT"), async (req, res) => {
    try {
        const { sessionId } = req.params;
        if (!mongoose.isValidObjectId(sessionId)) {
            return res.status(400).json({ message: "Invalid sessionId" });
        }

        const student = await Student.findOne({ userId: req.user.userId });
        if (!student) return res.status(404).json({ message: "Student profile not found" });

        const session = await findLiveSession(sessionId);
        if (!session) return res.status(404).json({ message: "Session is not active" });

        const member = await StudentGroup.findOne({ studentId: student._id, groupId: session.groupId });
        if (!member) return res.status(403).json({ message: "You are not in this group" });

        let record;
        try {
            record = await AttendanceRecord.create({ sessionId, studentId: student._id });
        } catch (err) {
            if (err.code !== 11000) throw err;
            record = await AttendanceRecord.findOne({ sessionId, studentId: student._id }); // already joined
        }

        res.status(200).json({ message: "Joined", status: record.status });
    } catch (error) {
        console.error("Join session error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

// STUDENT SUBMITS CODE
router.post("/:sessionId/verify", authMiddleware, roleMiddleware("STUDENT"), async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { roomCode } = req.body || {};

        if (!mongoose.isValidObjectId(sessionId)) {
            return res.status(400).json({ message: "Invalid sessionId" });
        }
        if (!roomCode) return res.status(400).json({ message: "Room code is required" });

        const student = await Student.findOne({ userId: req.user.userId });
        if (!student) return res.status(404).json({ message: "Student profile not found" });

        const session = await findLiveSession(sessionId);
        if (!session) return res.status(404).json({ message: "Session is not active" });

        const record = await AttendanceRecord.findOne({ sessionId, studentId: student._id });
        if (!record) return res.status(400).json({ message: "Join the session first" });

        if (record.status === "PRESENT") {
            return res.status(200).json({ message: "Already marked present", status: "PRESENT" });
        }

        if (String(roomCode).trim().toUpperCase() !== session.roomCode) {
            return res.status(400).json({ message: "Incorrect room code" });
        }

        await AttendanceRecord.updateOne(
            { _id: record._id, status: "JOINED" },
            { $set: { status: "PRESENT", markedAt: new Date() } }
        );

        res.status(200).json({ message: "Marked present", status: "PRESENT" });
    } catch (error) {
        console.error("Verify code error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

// TEACHER ROSTER (polled)
router.get("/:sessionId/roster", authMiddleware, roleMiddleware("TEACHER"), async (req, res) => {
    try {
        const { sessionId } = req.params;
        if (!mongoose.isValidObjectId(sessionId)) {
            return res.status(400).json({ message: "Invalid sessionId" });
        }

        const teacher = await Teacher.findOne({ userId: req.user.userId });
        if (!teacher) return res.status(404).json({ message: "Teacher profile not found" });

        const session = await AttendanceSession.findOne({ _id: sessionId, teacherId: teacher._id });
        if (!session) return res.status(404).json({ message: "Session not found" });

        const memberships = await StudentGroup.find({ groupId: session.groupId }).populate({
            path: "studentId",
            populate: { path: "userId", select: "name" }
        });

        const records = await AttendanceRecord.find({ sessionId });
        const statusByStudent = new Map(records.map((r) => [String(r.studentId), r.status]));

        const students = memberships
            .filter((m) => m.studentId && m.studentId.userId)
            .map((m) => ({
                studentId: m.studentId._id,
                rollNo: m.studentId.rollNo,
                name: m.studentId.userId.name,
                status: statusByStudent.get(String(m.studentId._id)) || "ABSENT"
            }))
            .sort((a, b) => a.rollNo.localeCompare(b.rollNo));

        res.status(200).json({
            session: { id: session._id, status: session.status, expiresAt: session.expiresAt },
            students
        });
    } catch (error) {
        console.error("Roster error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});


module.exports = router;