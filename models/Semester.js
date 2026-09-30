const mongoose = require("mongoose");

const semesterSchema = new mongoose.Schema(
    {
        number: { type: Number, required: true, min: 1, max: 10 },
        name: { type: String, required: true, trim: true }
    },
    { timestamps: true }
);

semesterSchema.index({ number: 1 }, { unique: true });

module.exports = mongoose.model("Semester", semesterSchema);