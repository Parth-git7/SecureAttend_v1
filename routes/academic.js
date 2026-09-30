const express = require("express");
const mongoose = require("mongoose");
const Branch = require("../models/Branch");
const Group = require("../models/Group");
const GroupSubject = require("../models/GroupSubject");
const AcademicPeriod = require("../models/AcademicPeriod");
const Semester = require("../models/Semester");

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


// get academic periods (+ which one is "current" academic period)
router.get(
    "/academic-periods",
    authMiddleware,
    roleMiddleware("ADMIN", "TEACHER"),
    async (req, res) => {
        try {
            const academicPeriods = await AcademicPeriod.find()
                .sort({ startDate: -1 });

            const now = new Date();
            const current =
                academicPeriods.find(
                    (p) => p.startDate <= now && now <= p.endDate
                ) ||
                academicPeriods[0] ||
                null;

            res.status(200).json({
                academicPeriods,
                currentPeriodId: current ? current._id : null
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

// get groups from academic period id (optional ?branchId=&semesterId=)
router.get(
    "/academic-periods/:academicPeriodId/groups",
    authMiddleware,
    roleMiddleware("ADMIN", "TEACHER"),
    async (req, res) => {
        try {
            const { academicPeriodId } = req.params;
            const { branchId, semesterId } = req.query;

            for (const [key, value] of Object.entries({ academicPeriodId, branchId, semesterId })) {
                if (value && !mongoose.isValidObjectId(value)) {
                    return res.status(400).json({ message: `Invalid ${key}` });
                }
            }

            const academicPeriod = await AcademicPeriod.findById(academicPeriodId);

            if (!academicPeriod) {
                return res.status(404).json({
                    message: "Academic period not found"
                });
            }

            const filter = { academicPeriodId };
            if (branchId) filter.branchId = branchId;
            if (semesterId) filter.semesterId = semesterId;

            const groups = await Group.find(filter)
                .collation({ locale: "en", numericOrdering: true })
                .sort({ name: 1 });

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

// GET students of a group 
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

// GET all (seeded) semesters
router.get(
    "/semesters",
    authMiddleware,
    roleMiddleware("ADMIN", "TEACHER"),
    async (req, res) => {
        try {
            const semesters = await Semester.find().sort({ number: 1 });
            res.status(200).json({ semesters });
        } catch (error) {
            console.error("Get semesters error:", error);
            res.status(500).json({ message: "Server error", error: error.message });
        }
    }
);

// GET branches that actually have groups in this academic period
router.get(
    "/academic-periods/:academicPeriodId/branches",
    authMiddleware,
    roleMiddleware("ADMIN", "TEACHER"),
    async (req, res) => {
        try {
            const { academicPeriodId } = req.params;

            if (!mongoose.isValidObjectId(academicPeriodId)) {
                return res.status(400).json({ message: "Invalid academicPeriodId" });
            }

            const branchIds = await Group.distinct("branchId", { academicPeriodId });

            const branches = await Branch.find({ _id: { $in: branchIds } })
                .sort({ name: 1 });

            res.status(200).json({ branches });

        } catch (error) {
            console.error("Get period branches error:", error);
            res.status(500).json({ message: "Server error", error: error.message });
        }
    }
);

// GET semesters that actually have groups for period + branch
router.get(
    "/academic-periods/:academicPeriodId/semesters",
    authMiddleware,
    roleMiddleware("ADMIN", "TEACHER"),
    async (req, res) => {
        try {
            const { academicPeriodId } = req.params;
            const { branchId } = req.query;

            for (const [key, value] of Object.entries({ academicPeriodId, branchId })) {
                if (value && !mongoose.isValidObjectId(value)) {
                    return res.status(400).json({ message: `Invalid ${key}` });
                }
            }

            const filter = { academicPeriodId };
            if (branchId) filter.branchId = branchId;

            const semesterIds = await Group.distinct("semesterId", filter);

            const semesters = await Semester.find({ _id: { $in: semesterIds } })
                .sort({ number: 1 });

            res.status(200).json({ semesters });

        } catch (error) {
            console.error("Get period semesters error:", error);
            res.status(500).json({ message: "Server error", error: error.message });
        }
    }
);

module.exports = router;

