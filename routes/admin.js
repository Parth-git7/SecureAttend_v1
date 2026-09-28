const express = require("express");
const User = require("../models/User");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");

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


module.exports = router;