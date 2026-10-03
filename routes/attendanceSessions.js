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
const { SESSION_DURATION_MIN } = require("../config");
const { distanceMeters } = require("../utils/geo");
const { checkLocation, LOCATION_ERRORS } = require("../utils/location");
const { compareFaces } = require("../utils/face");


const router = express.Router();


// helper : location validator function
function parseLocation(loc) {
    if (!loc || typeof loc !== "object") return null;

    const { latitude, longitude, accuracy } = loc;

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
    if (accuracy !== undefined && (!Number.isFinite(accuracy) || accuracy < 0)) return null;

    return { latitude, longitude, accuracy };
}
// helper : active, non-expired session by id
const findLiveSession = (sessionId) =>
    AttendanceSession.findOne({
        _id: sessionId,
        status: "ACTIVE",
        expiresAt: { $gt: new Date() }
    });

const MAX_FRAMES = 5;

// helper : "data:image/jpeg;base64,..." strings -> Buffers (null if invalid)
function parseFrames(frames) {
    if (!Array.isArray(frames) || !frames.length || frames.length > MAX_FRAMES) return null;
    const buffers = [];
    for (const f of frames) {
        const m = typeof f === "string" && f.match(/^data:image\/jpeg;base64,(.+)$/);
        if (!m) return null;
        buffers.push(Buffer.from(m[1], "base64"));
    }
    return buffers;
}


// Create attendance session
router.post("/", authMiddleware, roleMiddleware("TEACHER"),
    async (req, res) => {
        try {
            const { groupId, subjectId, teacherLocation } = req.body || {};

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

            const location = parseLocation(teacherLocation);
            if (!location) {
                return res.status(400).json({
                    message: "A valid teacher location is required"
                });
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

            
            const expiresAt = new Date(Date.now() + SESSION_DURATION_MIN * 60 * 1000);

            const session = await AttendanceSession.create({
                teacherId: teacher._id,
                academicPeriodId: group.academicPeriodId,
                branchId: group.branchId,
                semesterId: group.semesterId,
                groupId: group._id,
                subjectId,
                teacherLocation : location,
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
router.get("/active", authMiddleware, roleMiddleware("STUDENT"),
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
                    myStatus : record ? record.status : null,
                    myLocationResult: record?.locationCheck?.result || null,
                    myFaceResult: record?.faceCheck?.result || null
                }
            });

        } catch (error) {
            console.error("Get active student session error:", error);
            res.status(500).json({ message: "Server error", error: error.message });
        }
    }
);

// End an attendance session (only by the teacher who started it)
router.patch( "/:sessionId/end", authMiddleware, roleMiddleware("TEACHER"),
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

// STUDENT SUBMITS CODE (NEW WITH LOCATION CHECK)
router.post("/:sessionId/verify", authMiddleware, roleMiddleware("STUDENT"), 
    async(req, res) => {
        try {
            const { sessionId } = req.params ;
            const { roomCode, studentLocation, locationError, frames} = req.body || {} ;

            if ( !mongoose.isValidObjectId(sessionId) ){
                return res.status(400).json({message : "Invalid Session"}) ;
            }
            if ( !roomCode ){
                return res.status(400).json({message : "Room code is required"}) ;
            }

            const location = parseLocation(studentLocation) ;
            if (!location && !LOCATION_ERRORS.includes(locationError)) {
                return res.status(400).json({
                    message : "A valid location or a location error reason is required"
                }) ;
            }

            const faceBuffers = frames === undefined ? [] : parseFrames(frames);
            if (!faceBuffers) {
                return res.status(400).json({ message: "Invalid face frames" });
            }

            const student = await Student.findOne({ userId: req.user.userId }).select("+faceEmbeddings");
            if (!student) return res.status(404).json({ message: "Student profile not found" });

            const session = await findLiveSession(sessionId);
            if (!session) return res.status(404).json({ message: "Session is not active" });


            const record = await AttendanceRecord.findOne({ sessionId, studentId: student._id });
            if (!record) return res.status(400).json({ message: "Join the session first" });

            if (record.status === "PRESENT") {
                return res.status(200).json({ message: "Already marked present", status: "PRESENT" });
            }
            if (record.status === "REVIEW") {
                return res.status(409).json({ message: "Your review is pending with the teacher", status: "REVIEW" });
            }
            if (record.status === "ABSENT") {
                return res.status(409).json({ message: "You were marked absent by the teacher", status: "ABSENT" });
            }


            // Check 1: room code
            if (String(roomCode).trim().toUpperCase() !== session.roomCode) {
                return res.status(400).json({ message: "Incorrect room code" });
            }

            // Check 2: location
            const { result, distance } = checkLocation(session.teacherLocation, location);

            // Check 3: face
            const face = faceBuffers.length
                ? await compareFaces(faceBuffers, student.faceEmbeddings)
                : { result: "NO_FACE", score: null, framesUsed: 0 };

            const passed = result === "PASS" && face.result === "PASS";

            console.log(`[verify] session ${sessionId} student ${student._id} loc=${result} ${distance}m face=${face.result} score=${face.score} frames=${face.framesUsed}`);

            const set = {
                "locationCheck.result": result,
                "locationCheck.distanceMeters": distance,
                "faceCheck.result": face.result,
                "faceCheck.score": face.score,
                "faceCheck.framesUsed": face.framesUsed
            };
            if (location) set.studentLocation = location;
            if (passed) {
                set.status = "PRESENT";
                set.markedAt = new Date();
                set["decision.by"] = "SYSTEM";
                set["decision.at"] = new Date();
            }

            // Atomic: only applies while still JOINED, so it can't overwrite a teacher decision
            const update = await AttendanceRecord.updateOne(
                { _id: record._id, status: "JOINED" },
                { $set: set }
            );

            if (update.matchedCount === 0) {
                const current = await AttendanceRecord.findById(record._id);
                return res.status(409).json({
                    message: "Your attendance status has already been updated",
                    status: current ? current.status : null
                });
            }

            if (passed) {
                return res.status(200).json({
                    message: "Marked present",
                    status: "PRESENT",
                    locationResult: result,
                    faceResult: face.result
                });
            }

            const FACE_MESSAGES = {
                NO_FACE: "We couldn't see your face clearly.",
                FAIL_MISMATCH: "Your face did not match.",
                NO_TEMPLATE: "No face photo is on file for you.",
                ERROR: "Face check is unavailable right now."
            };

            const reasons = [];
            if (result === "NO_LOCATION") reasons.push("Your location could not be accessed.");
            if (result === "FAIL_FAR") reasons.push("You seem too far from the classroom.");
            if (face.result !== "PASS") reasons.push(FACE_MESSAGES[face.result]);

            res.status(200).json({
                message: `${reasons.join(" ")} Retry or send review request.`,
                status: "JOINED",
                locationResult: result,
                faceResult: face.result
            });

        }

        catch (error) {
            console.error("Verify code error:", error);
            res.status(500).json({ message: "Server error", error: error.message });
        }
    }
)


// STUDENT REQUESTS REVIEW (single tap, no body)
router.post("/:sessionId/review-request", authMiddleware, roleMiddleware("STUDENT"), async (req, res) => {
    try {
        const { sessionId } = req.params;
        if (!mongoose.isValidObjectId(sessionId)) {
            return res.status(400).json({ message: "Invalid sessionId" });
        }

        const student = await Student.findOne({ userId: req.user.userId });
        if (!student) return res.status(404).json({ message: "Student profile not found" });

        const session = await findLiveSession(sessionId);
        if (!session) return res.status(404).json({ message: "Session is not active" });

        const record = await AttendanceRecord.findOne({ sessionId, studentId: student._id });
        if (!record) return res.status(400).json({ message: "Join the session first" });


        const update = await AttendanceRecord.updateOne(
            { _id: record._id, status: "JOINED" },
            { $set: { status: "REVIEW", reviewRequestedAt: new Date() } }
        );

        if (update.matchedCount === 0) {
            const current = await AttendanceRecord.findById(record._id);
            return res.status(409).json({
                message: "Your attendance status has already been updated",
                status: current ? current.status : null
            });
        }

        res.status(200).json({ message: "Review requested", status: "REVIEW" });

        } catch (error) {
            console.error("Review request error:", error);
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
        const recordByStudent = new Map(records.map((r) => [String(r.studentId), r]));

        const students = memberships
            .filter((m) => m.studentId && m.studentId.userId)
            .map((m) => {
                const r = recordByStudent.get(String(m.studentId._id));
                return {
                    studentId: m.studentId._id,
                    rollNo: m.studentId.rollNo,
                    name: m.studentId.userId.name,
                    status: r ? r.status : "ABSENT",
                    joined: !!r,
                    locationResult: r?.locationCheck?.result || null,
                    distanceMeters: r?.locationCheck?.distanceMeters ?? null,
                    reviewRequestedAt: r?.reviewRequestedAt || null,
                    decidedBy: r?.decision?.by || null
                };
            })
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

// TEACHER OVERRIDE / REVIEW DECISION (final call)
router.patch("/:sessionId/students/:studentId/attendance", authMiddleware, roleMiddleware("TEACHER"), async (req, res) => {
    try {
        const { sessionId, studentId } = req.params;
        const { status } = req.body || {};

        for (const [field, value] of Object.entries({ sessionId, studentId })) {
            if (!mongoose.isValidObjectId(value)) {
                return res.status(400).json({ message: `Invalid ${field}` });
            }
        }
        if (!["PRESENT", "ABSENT"].includes(status)) {
            return res.status(400).json({ message: "Status must be PRESENT or ABSENT" });
        }

        const teacher = await Teacher.findOne({ userId: req.user.userId });
        if (!teacher) return res.status(404).json({ message: "Teacher profile not found" });

        // Teacher can change statuses until they end the session
        const session = await AttendanceSession.findOne({
            _id: sessionId,
            teacherId: teacher._id,
            status: "ACTIVE"
        });
        if (!session) {
            return res.status(404).json({ message: "Active session not found for this teacher" });
        }

        const member = await StudentGroup.findOne({ studentId, groupId: session.groupId });
        if (!member) {
            return res.status(403).json({ message: "Student is not in this session's group" });
        }

        const now = new Date();
        const update = {
            $set: { status, "decision.by": "TEACHER", "decision.at": now }
        };
        if (status === "PRESENT") update.$set.markedAt = now;
        else update.$unset = { markedAt: 1 };

        const record = await AttendanceRecord.findOneAndUpdate(
            { sessionId, studentId },
            update,
            { upsert: true, new: true, setDefaultsOnInsert: false }
        );

        res.status(200).json({
            message: `Student marked ${status}`,
            studentId,
            status: record.status
        });

    } catch (error) {
        console.error("Attendance override error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

module.exports = router;