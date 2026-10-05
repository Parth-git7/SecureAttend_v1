require("dotenv").config();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const Teacher = require("../models/Teacher");
const Student = require("../models/Student");
const StudentGroup = require("../models/StudentGroup");
const GroupSubject = require("../models/GroupSubject");
const User = require("../models/User");
const AttendanceRecord = require("../models/AttendanceRecord");

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";
let passed = 0, failed = 0;

const tokenFor = (user) =>
    jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "10m" });

async function call(token, method, path, body) {
    const res = await fetch(`${BASE}/api/attendance-sessions${path}`, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
}

function check(name, res, expectedStatus, expectedCode) {
    const ok = res.status === expectedStatus && (!expectedCode || res.data.code === expectedCode);
    ok ? passed++ : failed++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}  (got ${res.status}${res.data.code ? " " + res.data.code : ""}, want ${expectedStatus}${expectedCode ? " " + expectedCode : ""})`);
    if (!ok) console.log("      ", JSON.stringify(res.data));
}

(async () => {
    await mongoose.connect(process.env.MONGO_URI);

    // auto-discover: a group that has a subject AND at least one student
    let groupId, subjectId, student;
    for (const gs of await GroupSubject.find()) {
        const sg = await StudentGroup.findOne({ groupId: gs.groupId });
        if (sg) {
            groupId = gs.groupId; subjectId = gs.subjectId;
            student = await Student.findById(sg.studentId);
            break;
        }
    }
    const teacher = await Teacher.findOne();
    if (!groupId || !student || !teacher) {
        console.log("Need at least 1 teacher and 1 group with a subject and a student.");
        process.exit(1);
    }

    const T = tokenFor(await User.findById(teacher.userId));
    const S = tokenFor(await User.findById(student.userId));
    const location = { latitude: 30.9, longitude: 75.85, accuracy: 10 };

    const created = await call(T, "POST", "/", { groupId, subjectId, teacherLocation: location });
    check("create session -> LOBBY", created, 201);
    const id = created.data.session._id;
    const roomCode = created.data.session.roomCode;
    console.log("      phase:", created.data.session.phase);

    check("stop before start", await call(T, "POST", `/${id}/stop-attendance`), 409, "INVALID_PHASE");
    check("student join in lobby", await call(S, "POST", `/${id}/join`), 200);
    check("verify before start", await call(S, "POST", `/${id}/verify`, { roomCode, locationError: "DENIED" }), 409, "ATTENDANCE_NOT_OPEN");
    check("start attendance", await call(T, "POST", `/${id}/start-attendance`), 200);
    check("start twice", await call(T, "POST", `/${id}/start-attendance`), 409, "INVALID_PHASE");
    check("join after start", await call(S, "POST", `/${id}/join`), 409, "JOIN_CLOSED");
    check("verify while open (passes phase guard)", await call(S, "POST", `/${id}/verify`, { roomCode, locationError: "DENIED" }), 200);
    check("stop attendance", await call(T, "POST", `/${id}/stop-attendance`), 200);
    check("verify after stop", await call(S, "POST", `/${id}/verify`, { roomCode, locationError: "DENIED" }), 409, "ATTENDANCE_NOT_OPEN");
    check("roster shows phase", await call(T, "GET", `/${id}/roster`), 200);
    check("end session", await call(T, "PATCH", `/${id}/end`), 200);
    check("end twice", await call(T, "PATCH", `/${id}/end`), 404);
    const members = await StudentGroup.countDocuments({ groupId });
    const records = await AttendanceRecord.find({ sessionId: id });
    const stillJoined = records.filter((r) => r.status === "JOINED").length;
    const ok = records.length === members && stillJoined === 0;
    ok ? passed++ : failed++;
    console.log(`${ok ? "PASS" : "FAIL"}  records finalized  (records ${records.length}, group members ${members}, still JOINED ${stillJoined})`);

    console.log(`\n${passed} passed, ${failed} failed`);
    await mongoose.disconnect();
    process.exit(failed ? 1 : 0);
})();