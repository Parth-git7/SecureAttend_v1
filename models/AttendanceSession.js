const mongoose = require("mongoose");

const attendanceSessionSchema = new mongoose.Schema(
    {
        teacherId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Teacher",
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
            required: true
        },

        status: {
            type: String,
            enum: ["ACTIVE", "CLOSED", "EXPIRED"],
            default: "ACTIVE"
        },

        expiresAt: {
            type: Date,
            required: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "AttendanceSession",
    attendanceSessionSchema
);