const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true
        },

        rollNo: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        batch: {
            type: String,
            required: true,
            trim: true
        },

        faceTemplate: {
            type: [Number],
            required: false
        }
    },
    { timestamps: true }
);

const Student = mongoose.model("Student", studentSchema);

module.exports = Student;