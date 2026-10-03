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

        faceEmbeddings: {
            type: [{
                vector: { type: [Number], required: true },
                source: { type: String, enum: ["ADMIN_PHOTO", "LIVE"], required: true },
                academicPeriodId: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicPeriod" },
                model: { type: String, required: true },
                createdAt: { type: Date, default: Date.now }
            }],
            default: [],
            select: false
        }
    },
    { timestamps: true }
);

const Student = mongoose.model("Student", studentSchema);

module.exports = Student;