const mongoose = require("mongoose");

const studentGroupSchema = new mongoose.Schema(
    {
        studentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Student",
            required: true
        },

        groupId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Group",
            required: true
        }
    },
    {
        timestamps: true
    }
);

// A student can only belong to one group within a given academic period.
studentGroupSchema.index(
    { studentId: 1, groupId: 1 },
    { unique: true }
);

module.exports = mongoose.model("StudentGroup", studentGroupSchema);