const mongoose = require("mongoose");

const branchSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        code: { type: String, required: true, trim: true, uppercase: true }
    },
    { timestamps: true }
);

branchSchema.index({ code: 1 }, { unique: true });

module.exports = mongoose.model("Branch", branchSchema);