const express = require("express");
const mongoose = require("mongoose");
const Branch = require("../models/Branch");
const Semester = require("../models/Semester");
const User = require("../models/User");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const AcademicPeriod = require("../models/AcademicPeriod") ;
const Group = require("../models/Group") ;
const StudentGroup = require("../models/StudentGroup") ;
const Subject = require("../models/Subject");
const GroupSubject = require("../models/GroupSubject");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const multer = require("multer");
const path = require("path");
const { enrollAdminPhoto } = require("../utils/face");  

const bulkUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 100 }
});

const router = express.Router();

router.get(
    "/test",
    authMiddleware,
    roleMiddleware("ADMIN"),
    (req, res) => {
        res.json({
            message: "Admin access granted",
            user: req.user
        });
    }
);


// CREATE STUDENT / TEACHER ACCOUNT
router.post(
    "/users",
    authMiddleware,
    roleMiddleware("ADMIN"),
    async (req, res) => {
        try {
            const {
                name,
                email,
                role,
                rollNo,
                batch,
                employeeCode
            } = req.body || {};

            // Basic validation
            if (!name || !email || !role) {
                return res.status(400).json({
                    message: "Name, email and role are required"
                });
            }

            // Admin can only create students and teachers
            if (!["STUDENT", "TEACHER"].includes(role)) {
                return res.status(400).json({
                    message: "Admin can only create STUDENT or TEACHER accounts"
                });
            }

            const normalizedEmail = email.toLowerCase().trim();

            // Check duplicate email
            const existingUser = await User.findOne({
                email: normalizedEmail
            });

            if (existingUser) {
                return res.status(409).json({
                    message: "A SecureAttend account with this email already exists"
                });
            }


            // STUDENT
            if (role === "STUDENT") {

                if (!rollNo || !batch) {
                    return res.status(400).json({
                        message: "Roll number and batch are required for students"
                    });
                }

                const existingStudent = await Student.findOne({
                    rollNo: rollNo.trim()
                });

                if (existingStudent) {
                    return res.status(409).json({
                        message: "A student with this roll number already exists"
                    });
                }

                // Create User
                const user = await User.create({
                    name: name.trim(),
                    email: normalizedEmail,
                    role: "STUDENT"
                });

                try {
                    // Create Student profile
                    const student = await Student.create({
                        userId: user._id,
                        rollNo: rollNo.trim(),
                        batch: batch.trim()
                    });

                    return res.status(201).json({
                        message: "Student account created successfully",
                        user: {
                            id: user._id,
                            name: user.name,
                            email: user.email,
                            role: user.role
                        },
                        student: {
                            id: student._id,
                            rollNo: student.rollNo,
                            batch: student.batch
                        }
                    });

                } catch (error) {
                    // If Student creation fails, remove the User
                    await User.findByIdAndDelete(user._id);
                    throw error;
                }
            }


            // TEACHER
            if (role === "TEACHER") {

                if (!employeeCode) {
                    return res.status(400).json({
                        message: "Employee code is required for teachers"
                    });
                }

                const existingTeacher = await Teacher.findOne({
                    employeeCode: employeeCode.trim()
                });

                if (existingTeacher) {
                    return res.status(409).json({
                        message: "A teacher with this employee code already exists"
                    });
                }

                // Create User
                const user = await User.create({
                    name: name.trim(),
                    email: normalizedEmail,
                    role: "TEACHER"
                });

                try {
                    // Create Teacher profile
                    const teacher = await Teacher.create({
                        userId: user._id,
                        employeeCode: employeeCode.trim()
                    });

                    return res.status(201).json({
                        message: "Teacher account created successfully",
                        user: {
                            id: user._id,
                            name: user.name,
                            email: user.email,
                            role: user.role
                        },
                        teacher: {
                            id: teacher._id,
                            employeeCode: teacher.employeeCode
                        }
                    });

                } catch (error) {
                    // If Teacher creation fails, remove the User
                    await User.findByIdAndDelete(user._id);
                    throw error;
                }
            }

        } catch (error) {
            console.error("Admin user creation error:", error);

            res.status(500).json({
                message: "Server error",
                error: error.message
            });
        }
    }
);


// academic periods creator
router.post(
    "/academic-periods",
    authMiddleware,
    roleMiddleware("ADMIN"),
    async (req, res) => {
        try {
            const {
                name,
                startDate,
                endDate
            } = req.body || {};

            // Basic validation
            if (!name || !startDate || !endDate) {
                return res.status(400).json({
                    message: "Name, start date and end date are required"
                });
            }

            // Convert dates
            const start = new Date(startDate);
            const end = new Date(endDate);

            // Validate dates
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return res.status(400).json({
                    message: "Invalid start date or end date"
                });
            }

            // Start must be before end
            if (start >= end) {
                return res.status(400).json({
                    message: "Start date must be before end date"
                });
            }

            // Check duplicate name
            const existingPeriod = await AcademicPeriod.findOne({
                name: name.trim()
            });

            if (existingPeriod) {
                return res.status(409).json({
                    message: "An academic period with this name already exists"
                });
            }

            // Create academic period
            const academicPeriod = await AcademicPeriod.create({
                name: name.trim(),
                startDate: start,
                endDate: end
            });

            res.status(201).json({
                message: "Academic period created successfully",
                academicPeriod
            });

        } catch (error) {
            console.error("Academic period creation error:", error);

            res.status(500).json({
                message: "Server error",
                error: error.message
            });
        }
    }
);

// CREATE branch
router.post(
    "/branches",
    authMiddleware,
    roleMiddleware("ADMIN"),
    async (req, res) => {
        try {
            const { name, code } = req.body || {};

            if (!name || !code) {
                return res.status(400).json({
                    message: "Branch name and code are required"
                });
            }

            const trimmedName = String(name).trim();
            const trimmedCode = String(code).trim().toUpperCase();

            if (!trimmedName || !trimmedCode) {
                return res.status(400).json({
                    message: "Branch name and code cannot be empty"
                });
            }

            const existingBranch = await Branch.findOne({ code: trimmedCode });

            if (existingBranch) {
                return res.status(409).json({
                    message: "A branch with this code already exists"
                });
            }

            const branch = await Branch.create({
                name: trimmedName,
                code: trimmedCode
            });

            res.status(201).json({
                message: "Branch created successfully",
                branch
            });

        } catch (error) {
            if (error.code === 11000) {
                return res.status(409).json({
                    message: "A branch with this code already exists"
                });
            }

            console.error("Branch creation error:", error);
            res.status(500).json({ message: "Server error", error: error.message });
        }
    }
);

// CREATE groups
router.post(
    "/groups",
    authMiddleware,
    roleMiddleware("ADMIN"),
    async (req, res) => {
        try {
            const { name, academicPeriodId, branchId, semesterId } = req.body || {};

            if (!name || !academicPeriodId || !branchId || !semesterId) {
                return res.status(400).json({
                    message: "Group name, academic period, branch and semester are required"
                });
            }

            const trimmedName = String(name).trim();
            if (!trimmedName) {
                return res.status(400).json({
                    message: "Group name cannot be empty"
                });
            }

            // Reject malformed ids before hitting the database
            const idChecks = { academicPeriodId, branchId, semesterId };
            for (const [field, value] of Object.entries(idChecks)) {
                if (!mongoose.isValidObjectId(value)) {
                    return res.status(400).json({
                        message: `Invalid ${field}`
                    });
                }
            }

            if (!(await AcademicPeriod.findById(academicPeriodId))) {
                return res.status(404).json({ message: "Academic period not found" });
            }

            if (!(await Branch.findById(branchId))) {
                return res.status(404).json({ message: "Branch not found" });
            }

            if (!(await Semester.findById(semesterId))) {
                return res.status(404).json({ message: "Semester not found" });
            }

            const existingGroup = await Group.findOne({
                name: trimmedName,
                academicPeriodId,
                branchId,
                semesterId
            });

            if (existingGroup) {
                return res.status(409).json({
                    message:
                        "This group already exists for this academic period, branch and semester"
                });
            }

            const group = await Group.create({
                name: trimmedName,
                academicPeriodId,
                branchId,
                semesterId
            });

            res.status(201).json({
                message: "Group created successfully",
                group
            });

        } catch (error) {
            // Two simultaneous requests can both pass findOne; the unique index catches the second
            if (error.code === 11000) {
                return res.status(409).json({
                    message:
                        "This group already exists for this academic period, branch and semester"
                });
            }

            console.error("Group creation error:", error);

            res.status(500).json({
                message: "Server error",
                error: error.message
            });
        }
    }
);

// adding students into groups 
router.post(
    "/groups/:groupId/students",
    authMiddleware,
    roleMiddleware("ADMIN"),
    async (req, res) => {
        try {
            const { groupId } = req.params;
            const { studentId } = req.body || {};

            // Validate studentId
            if (!studentId) {
                return res.status(400).json({
                    message: "Student ID is required"
                });
            }

            // Find the group
            const group = await Group.findById(groupId);

            if (!group) {
                return res.status(404).json({
                    message: "Group not found"
                });
            }

            // Find the student
            const student = await Student.findById(studentId);

            if (!student) {
                return res.status(404).json({
                    message: "Student not found"
                });
            }

            // Check whether this student already has a group
            // in the same academic period
            const groupsInSamePeriod = await Group.find({
                academicPeriodId: group.academicPeriodId
            }).select("_id");

            const groupIds = groupsInSamePeriod.map(
                (group) => group._id
            );

            const existingMembership = await StudentGroup.findOne({
                studentId,
                groupId: { $in: groupIds }
            });

            if (existingMembership) {
                return res.status(409).json({
                    message:
                        "Student already belongs to a group in this academic period"
                });
            }

            // Create membership
            const studentGroup = await StudentGroup.create({
                studentId,
                groupId
            });

            res.status(201).json({
                message: "Student assigned to group successfully",
                studentGroup
            });

        } catch (error) {
            console.error("Student group assignment error:", error);

            res.status(500).json({
                message: "Server error",
                error: error.message
            });
        }
    }
);

// Creating subjects in db
router.post(
    "/subjects",
    authMiddleware,
    roleMiddleware("ADMIN"),
    async (req, res) => {
        try {
            const { name, code } = req.body || {};

            // Validate required fields
            if (!name || !code) {
                return res.status(400).json({
                    message: "Subject name and code are required"
                });
            }

            const trimmedName = name.trim();
            const trimmedCode = code.trim().toUpperCase();

            // Check whether subject code already exists
            const existingSubject = await Subject.findOne({
                code: trimmedCode
            });

            if (existingSubject) {
                return res.status(409).json({
                    message: "A subject with this code already exists"
                });
            }

            // Create subject
            const subject = await Subject.create({
                name: trimmedName,
                code: trimmedCode
            });

            res.status(201).json({
                message: "Subject created successfully",
                subject
            });

        } catch (error) {
            console.error("Subject creation error:", error);

            res.status(500).json({
                message: "Server error",
                error: error.message
            });
        }
    }
);

// Assigning Subjects to groups 
router.post(
    "/groups/:groupId/subjects",
    authMiddleware,
    roleMiddleware("ADMIN"),
    async (req, res) => {
        try {
            const { groupId } = req.params;
            const { subjectId } = req.body || {};

            // Validate subjectId
            if (!subjectId) {
                return res.status(400).json({
                    message: "Subject ID is required"
                });
            }

            // Check group exists
            const group = await Group.findById(groupId);

            if (!group) {
                return res.status(404).json({
                    message: "Group not found"
                });
            }

            // Check subject exists
            const subject = await Subject.findById(subjectId);

            if (!subject) {
                return res.status(404).json({
                    message: "Subject not found"
                });
            }

            // Check if already assigned
            const existingAssignment = await GroupSubject.findOne({
                groupId,
                subjectId
            });

            if (existingAssignment) {
                return res.status(409).json({
                    message: "Subject is already assigned to this group"
                });
            }

            // Create relationship
            const groupSubject = await GroupSubject.create({
                groupId,
                subjectId
            });

            res.status(201).json({
                message: "Subject assigned to group successfully",
                groupSubject
            });

        } catch (error) {
            console.error("Group subject assignment error:", error);

            res.status(500).json({
                message: "Server error",
                error: error.message
            });
        }
    }
);

// UPLOAD student face photo -> store embedding
router.post(
    "/students/:studentId/face-photo",
    authMiddleware,
    roleMiddleware("ADMIN"),
    (req, res, next) => upload.single("photo")(req, res, (err) => {
        if (err) return res.status(400).json({ message: err.message });
        next();
    }),
    async (req, res) => {
        try {
            const { studentId } = req.params;

            if (!mongoose.isValidObjectId(studentId)) {
                return res.status(400).json({ message: "Invalid studentId" });
            }
            if (!req.file || !req.file.mimetype.startsWith("image/")) {
                return res.status(400).json({ message: "An image file (field: photo) is required" });
            }

            const student = await Student.findById(studentId).select("+faceEmbeddings");
            if (!student) {
                return res.status(404).json({ message: "Student not found" });
            }

            const outcome = await enrollAdminPhoto(student, req.file.buffer);
            if (!outcome.ok) {
                return res.status(422).json({ message: outcome.message });
            }

            res.status(200).json({ message: "Face photo saved", detScore: outcome.detScore });

        } catch (error) {
            console.error("Face photo upload error:", error);
            res.status(500).json({ message: "Server error", error: error.message });
        }
    }
);

// BULK face photos: filename (without extension) = roll number
router.post(
    "/students/face-photos",
    authMiddleware,
    roleMiddleware("ADMIN"),
    (req, res, next) => bulkUpload.array("photos", 100)(req, res, (err) => {
        if (err) return res.status(400).json({ message: err.message });
        next();
    }),
    async (req, res) => {
        try {
            if (!req.files || !req.files.length) {
                return res.status(400).json({ message: "No photos uploaded (field: photos)" });
            }

            let saved = 0;
            const failed = [];

            // sequential on purpose: the face service is CPU-bound
            for (const file of req.files) {
                const rollNo = path.parse(file.originalname).name.trim();
                try {
                    if (!file.mimetype.startsWith("image/")) {
                        failed.push({ file: file.originalname, reason: "Not an image" });
                        continue;
                    }

                    const student = await Student.findOne({ rollNo }).select("+faceEmbeddings");
                    if (!student) {
                        failed.push({ file: file.originalname, reason: "No student with this roll number" });
                        continue;
                    }

                    const outcome = await enrollAdminPhoto(student, file.buffer);
                    if (outcome.ok) saved++;
                    else failed.push({ file: file.originalname, reason: outcome.message });

                } catch (err) {
                    failed.push({ file: file.originalname, reason: err.message });
                }
            }

            res.status(200).json({ saved, failedCount: failed.length, failed });

        } catch (error) {
            console.error("Bulk face photo error:", error);
            res.status(500).json({ message: "Server error", error: error.message });
        }
    }
);

////// get requests ///////

// GET all students
router.get(
    "/students",
    authMiddleware,
    roleMiddleware("ADMIN"),
    async (req, res) => {
        try {
            const students = await Student.find()
                .populate("userId", "name email createdAt")
                .sort({ createdAt: -1 });

            res.status(200).json({
                students: students.map((s) => ({
                    studentId: s._id,
                    userId: s.userId._id,
                    name: s.userId.name,
                    email: s.userId.email,
                    rollNo: s.rollNo,
                    batch: s.batch,
                    createdAt: s.userId.createdAt
                }))
            });
        } catch (error) {
            console.error("Get students error:", error);
            res.status(500).json({ message: "Server error", error: error.message });
        }
    }
);

// GET all teachers
router.get(
    "/teachers",
    authMiddleware,
    roleMiddleware("ADMIN"),
    async (req, res) => {
        try {
            const teachers = await Teacher.find()
                .populate("userId", "name email createdAt")
                .sort({ createdAt: -1 });

            res.status(200).json({
                teachers: teachers.map((t) => ({
                    teacherId: t._id,
                    userId: t.userId._id,
                    name: t.userId.name,
                    email: t.userId.email,
                    employeeCode: t.employeeCode,
                    createdAt: t.userId.createdAt
                }))
            });
        } catch (error) {
            console.error("Get teachers error:", error);
            res.status(500).json({ message: "Server error", error: error.message });
        }
    }
);

// GET all subjects
router.get(
    "/subjects",
    authMiddleware,
    roleMiddleware("ADMIN"),
    async (req, res) => {
        try {
            const subjects = await Subject.find().sort({ name: 1 });
            res.status(200).json({ subjects });
        } catch (error) {
            console.error("Get subjects error:", error);
            res.status(500).json({ message: "Server error", error: error.message });
        }
    }
);


// GET groups - optionally filtered by academicPeriodId, branchId, semesterId
router.get(
    "/groups",
    authMiddleware,
    roleMiddleware("ADMIN"),
    async (req, res) => {
        try {
            const filter = {};

            for (const key of ["academicPeriodId", "branchId", "semesterId"]) {
                const value = req.query[key];
                if (value) {
                    if (!mongoose.isValidObjectId(value)) {
                        return res.status(400).json({
                            message: `Invalid ${key}`
                        });
                    }
                    filter[key] = value;
                }
            }

            const groups = await Group.find(filter)
                .populate("academicPeriodId", "name")
                .populate("branchId", "name code")
                .populate("semesterId", "number name")
                .collation({ locale: "en", numericOrdering: true })
                .sort({ name: 1 });

            res.status(200).json({ groups });
        } catch (error) {
            console.error("Get groups error:", error);
            res.status(500).json({ message: "Server error", error: error.message });
        }
    }
);

// GET students in a group
router.get(
    "/groups/:groupId/students",
    authMiddleware,
    roleMiddleware("ADMIN"),
    async (req, res) => {
        try {
            const { groupId } = req.params;

            // Check whether the group exists
            const group = await Group.findById(groupId)
                .populate("academicPeriodId");

            if (!group) {
                return res.status(404).json({
                    message: "Group not found"
                });
            }

            // Find all students belonging to this group
            const memberships = await StudentGroup.find({
                groupId
            }).populate({
                path: "studentId",
                populate: {
                    path: "userId",
                    select: "name email"
                }
            });

            res.status(200).json({
                group: {
                    id: group._id,
                    name: group.name,
                    academicPeriod: group.academicPeriodId
                },
                students: memberships.map((membership) => ({
                    membershipId: membership._id,
                    studentId: membership.studentId._id,
                    rollNo: membership.studentId.rollNo,
                    batch: membership.studentId.batch,
                    name: membership.studentId.userId.name,
                    email: membership.studentId.userId.email
                }))
            });

        } catch (error) {
            console.error("Get group students error:", error);

            res.status(500).json({
                message: "Server error",
                error: error.message
            });
        }
    }
);

// GET all branches
router.get(
    "/branches",
    authMiddleware,
    roleMiddleware("ADMIN"),
    async (req, res) => {
        try {
            const branches = await Branch.find().sort({ name: 1 });
            res.status(200).json({ branches });
        } catch (error) {
            console.error("Get branches error:", error);
            res.status(500).json({ message: "Server error", error: error.message });
        }
    }
);



// DELETE - remove student from group
router.delete(
    "/groups/:groupId/students/:studentId",
    authMiddleware,
    roleMiddleware("ADMIN"),
    async (req, res) => {
        try {
            const { groupId, studentId } = req.params;

            const deleted = await StudentGroup.findOneAndDelete({ groupId, studentId });
            if (!deleted) {
                return res.status(404).json({ message: "Membership not found" });
            }

            res.status(200).json({ message: "Student removed from group successfully" });
        } catch (error) {
            console.error("Remove student from group error:", error);
            res.status(500).json({ message: "Server error", error: error.message });
        }
    }
);

// DELETE - remove subject from group
router.delete(
    "/groups/:groupId/subjects/:subjectId",
    authMiddleware,
    roleMiddleware("ADMIN"),
    async (req, res) => {
        try {
            const { groupId, subjectId } = req.params;

            const deleted = await GroupSubject.findOneAndDelete({ groupId, subjectId });
            if (!deleted) {
                return res.status(404).json({ message: "Assignment not found" });
            }

            res.status(200).json({ message: "Subject removed from group successfully" });
        } catch (error) {
            console.error("Remove subject from group error:", error);
            res.status(500).json({ message: "Server error", error: error.message });
        }
    }
);

// PUT - update user (name/email)
router.put(
    "/users/:userId",
    authMiddleware,
    roleMiddleware("ADMIN"),
    async (req, res) => {
        try {
            const { userId } = req.params;
            const { name, email } = req.body || {};

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            if (name) user.name = name.trim();
            if (email) {
                const normalizedEmail = email.toLowerCase().trim();
                const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: userId } });
                if (existing) {
                    return res.status(409).json({ message: "Email already in use by another account" });
                }
                user.email = normalizedEmail;
            }

            await user.save();

            res.status(200).json({
                message: "User updated successfully",
                user: { id: user._id, name: user.name, email: user.email, role: user.role }
            });
        } catch (error) {
            console.error("Update user error:", error);
            res.status(500).json({ message: "Server error", error: error.message });
        }
    }
);

// DELETE user (and their student/teacher profile)
router.delete(
    "/users/:userId",
    authMiddleware,
    roleMiddleware("ADMIN"),
    async (req, res) => {
        try {
            const { userId } = req.params;

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            if (user.role === "STUDENT") {
                const student = await Student.findOne({ userId });
                if (student) {
                    await StudentGroup.deleteMany({ studentId: student._id });
                    await Student.findByIdAndDelete(student._id);
                }
            }

            if (user.role === "TEACHER") {
                await Teacher.findOneAndDelete({ userId });
            }

            await User.findByIdAndDelete(userId);

            res.status(200).json({ message: "User deleted successfully" });
        } catch (error) {
            console.error("Delete user error:", error);
            res.status(500).json({ message: "Server error", error: error.message });
        }
    }
);

// DELETE subject
router.delete(
    "/subjects/:subjectId",
    authMiddleware,
    roleMiddleware("ADMIN"),
    async (req, res) => {
        try {
            const { subjectId } = req.params;
            const subject = await Subject.findByIdAndDelete(subjectId);
            if (!subject) {
                return res.status(404).json({ message: "Subject not found" });
            }
            // Remove group assignments
            await GroupSubject.deleteMany({ subjectId });
            res.status(200).json({ message: "Subject deleted successfully" });
        } catch (error) {
            console.error("Delete subject error:", error);
            res.status(500).json({ message: "Server error", error: error.message });
        }
    }
);

// DELETE group
router.delete(
    "/groups/:groupId",
    authMiddleware,
    roleMiddleware("ADMIN"),
    async (req, res) => {
        try {
            const { groupId } = req.params;
            const group = await Group.findByIdAndDelete(groupId);
            if (!group) {
                return res.status(404).json({ message: "Group not found" });
            }
            // Remove related assignments
            await StudentGroup.deleteMany({ groupId });
            await GroupSubject.deleteMany({ groupId });
            res.status(200).json({ message: "Group deleted successfully" });
        } catch (error) {
            console.error("Delete group error:", error);
            res.status(500).json({ message: "Server error", error: error.message });
        }
    }
);


module.exports = router;