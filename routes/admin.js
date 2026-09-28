const express = require("express");
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



// Group creation API, Creating Groups
router.post(
    "/groups",
    authMiddleware,
    roleMiddleware("ADMIN"),
    async (req, res) => {
        try {
            const { name, academicPeriodId } = req.body || {};

            // Validate required fields
            if (!name || !academicPeriodId) {
                return res.status(400).json({
                    message: "Group name and academic period are required"
                });
            }

            // Check whether the academic period exists
            const academicPeriod = await AcademicPeriod.findById(
                academicPeriodId
            );

            if (!academicPeriod) {
                return res.status(404).json({
                    message: "Academic period not found"
                });
            }

            // Check duplicate group inside the same academic period
            const existingGroup = await Group.findOne({
                name: name.trim(),
                academicPeriodId
            });

            if (existingGroup) {
                return res.status(409).json({
                    message:
                        "This group already exists in this academic period"
                });
            }

            // Create group
            const group = await Group.create({
                name: name.trim(),
                academicPeriodId
            });

            res.status(201).json({
                message: "Group created successfully",
                group
            });

        } catch (error) {
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

////// get requests ///////

// get students in a group
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
                    studentId: membership.studentId._id,
                    rollNo: membership.studentId.rollNo,
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



module.exports = router;