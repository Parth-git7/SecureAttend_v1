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
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Group", groupSchema);