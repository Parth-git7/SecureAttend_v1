const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema(
    {
        name: { 
            type: String,
            required: true, 
            trim: true 
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
        }
    },
    { timestamps: true }
);

// "3G1" may exist in different branches, but only once per period + branch + semester
groupSchema.index(
    { academicPeriodId: 1, branchId: 1, semesterId: 1, name: 1 },
    { unique: true }
);

module.exports = mongoose.model("Group", groupSchema);