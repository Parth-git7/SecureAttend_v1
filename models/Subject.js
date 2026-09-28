const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        code: {
            type: String,
            required: true,
            trim: true,
            uppercase: true
        }
    },
    {
        timestamps: true
    }
);

subjectSchema.index(
    { code: 1 },
    { unique: true }
);

module.exports = mongoose.model("Subject", subjectSchema);