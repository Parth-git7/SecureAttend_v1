const mongoose = require("mongoose");

const attendanceSessionSchema = new mongoose.Schema(
    {
        teacherId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Teacher",
            required: true
        },

        academicPeriodId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AcademicPeriod",
            required: true
        },

        branchId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Branch",
            required: true
        },

        semesterId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Semester",
            required: true
        },

        groupId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Group",
            required: true
        },

        subjectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Subject",
            required: true
        },
        roomCode: {
            type: String,
            required: true,
            uppercase: true,
            trim: true
        },

        expiresAt: {
            type: Date,
            required: true
        },

        status: {
            type: String,
            enum: ["ACTIVE", "ENDED"],
            default: "ACTIVE"
        }
    },
    { timestamps: true }
);

attendanceSessionSchema.index({ groupId: 1, status: 1, expiresAt: 1 });

module.exports = mongoose.model(
    "AttendanceSession",
    attendanceSessionSchema
);