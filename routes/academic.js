const express = require("express");

const Group = require("../models/Group");
const GroupSubject = require("../models/GroupSubject");
const AcademicPeriod = require("../models/AcademicPeriod");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const StudentGroup = require("../models/StudentGroup");
const Student = require("../models/Student");
const User = require("../models/User");

const router = express.Router();


// Get subject for a group 
router.get(
    "/groups/:groupId/subjects",
    authMiddleware,
    roleMiddleware("ADMIN", "TEACHER"),
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

            // Find subjects assigned to this group
            const groupSubjects = await GroupSubject.find({
                groupId
            }).populate("subjectId");

            res.status(200).json({
                group: {
                    id: group._id,
                    name: group.name,
                    academicPeriod: group.academicPeriodId
                },

                subjects: groupSubjects.map((item) => ({
                    subjectId: item.subjectId._id,
                    name: item.subjectId.name,
                    code: item.subjectId.code
                }))
            });

        } catch (error) {
            console.error("Get group subjects error:", error);

            res.status(500).json({
                message: "Server error",
                error: error.message
            });
        }
    }
);


// get academic periods
router.get(
    "/academic-periods",
    authMiddleware,
    roleMiddleware("ADMIN", "TEACHER"),
    async (req, res) => {
        try {
            const academicPeriods = await AcademicPeriod.find()
                .sort({ startDate: -1 });

            res.status(200).json({
                academicPeriods
            });

        } catch (error) {
            console.error("Get academic periods error:", error);

            res.status(500).json({
                message: "Server error",
                error: error.message
            });
        }
    }
);


// get groups from academic period id
router.get(
    "/academic-periods/:academicPeriodId/groups",
    authMiddleware,
    roleMiddleware("ADMIN", "TEACHER"),
    async (req, res) => {
        try {
            const { academicPeriodId } = req.params;

            // Check whether the academic period exists
            const academicPeriod = await AcademicPeriod.findById(
                academicPeriodId
            );

            if (!academicPeriod) {
                return res.status(404).json({
                    message: "Academic period not found"
                });
            }

            // Find groups belonging to this academic period
            const groups = await Group.find({
                academicPeriodId
            }).sort({ name: 1 });

            res.status(200).json({
                academicPeriod: {
                    id: academicPeriod._id,
                    name: academicPeriod.name,
                    status: academicPeriod.status
                },
                groups
            });

        } catch (error) {
            console.error("Get academic period groups error:", error);

            res.status(500).json({
                message: "Server error",
                error: error.message
            });
        }
    }
);

// get students of a group 
router.get(
    "/groups/:groupId/students",
    authMiddleware,
    roleMiddleware("TEACHER"),
    async(req, res) => {
        try {
            const { groupId } = req.params ;
            const studentGroups = await StudentGroup.find({ groupId }) ;
            const students = [] ;

            for (const studentGroup of studentGroups){
                const student = await Student.findById(studentGroup.studentId)
                .populate("userId", "name email") ;

                if (student){
                    students.push({
                        studentId : student._id,
                        rollNo : student.rollNo, 
                        name : student.userId.name, 
                        email : student.userId.email
                    }) ;
                }
            }

            res.json({
                groupId, 
                students
            }) ;
        }
        catch (error) {
            console.error("Get group students error:", error);

            res.status(500).json({
                message: "Server error",
                error: error.message
            });
        }
    }
);

module.exports = router;