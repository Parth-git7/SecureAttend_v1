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
        teacherLocation: {
            latitude: {
                type: Number,
                min: -90,
                max: 90
            },
            longitude: {
                type: Number,
                min: -180,
                max: 180
            },
            accuracy: {
                type: Number,
                min: 0
            }
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

        phase: {
            type: String,
            enum: ["LOBBY", "ATTENDANCE_OPEN", "ATTENDANCE_CLOSED", "ENDED"],
            default: "LOBBY"
        },

        attendanceStartedAt: { type: Date },
        attendanceStoppedAt: { type: Date },
        endedAt: { type: Date }
            },
            { timestamps: true }
        );

attendanceSessionSchema.index({ groupId: 1, phase: 1, expiresAt: 1 });

module.exports = mongoose.model(
    "AttendanceSession",
    attendanceSessionSchema
);