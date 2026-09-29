const express = require("express");


const AttendanceSession = require("../models/AttendanceSession");
const Teacher = require("../models/Teacher");
const Student = require("../models/Student");
const StudentGroup = require("../models/StudentGroup");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const router = express.Router();


// Creating an attendance session
router.post(
    "/",
    authMiddleware,
    roleMiddleware("TEACHER"),
    async (req, res) => {
        try {

            const { groupId, subjectId } = req.body;

            // Check required fields
            if (!groupId || !subjectId) {
                return res.status(400).json({
                    message: "groupId and subjectId are required"
                });
            }

            // Find the Teacher profile linked to the logged-in User
            const teacher = await Teacher.findOne({
                userId: req.user.userId
            });

            if (!teacher) {
                return res.status(404).json({
                    message: "Teacher profile not found"
                });
            }

            // Generate a temporary room code
            const roomCode = Math.random()
                .toString(36)
                .substring(2, 7)
                .toUpperCase();

            // Session expires in 5 minutes for now
            const expiresAt = new Date(
                Date.now() + 5 * 60 * 1000
            );

            // Create attendance session
            const session = await AttendanceSession.create({
                teacherId: teacher._id,
                groupId,
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

            console.error(
                "Create attendance session error:",
                error
            );

            res.status(500).json({
                message: "Server error",
                error: error.message
            });
        }
    }
);


// Get active attendance session for the logged-in student
router.get(
  "/active",
  authMiddleware,
  roleMiddleware("STUDENT"),
  async (req, res) => {
    try {
      // Find the Student profile belonging to the logged-in User
      const student = await Student.findOne({
        userId: req.user.userId
      });

      if (!student) {
        return res.status(404).json({
          message: "Student profile not found"
        });
      }

      // Find which group the student belongs to
      const studentGroup = await StudentGroup.findOne({
        studentId: student._id
      });

      if (!studentGroup) {
        return res.status(404).json({
          message: "Student is not assigned to a group"
        });
      }

      // Find an active, non-expired session for that group
      const session = await AttendanceSession.findOne({
        groupId: studentGroup.groupId,
        status: "ACTIVE",
        expiresAt: { $gt: new Date() }
      })
        .populate("groupId", "name")
        .populate("subjectId", "name code");

      if (!session) {
        return res.status(200).json({
          activeSession: null
        });
      }

      res.status(200).json({
        activeSession: {
          sessionId: session._id,
          group: session.groupId,
          subject: session.subjectId,
          expiresAt: session.expiresAt
        }
      });

    } catch (error) {
      console.error("Get active student session error:", error);

      res.status(500).json({
        message: "Server error",
        error: error.message
      });
    }
  }
);

module.exports = router;