const mongoose = require("mongoose");

const groupSubjectSchema = new mongoose.Schema(
    {
        groupId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Group",
            required: true
        },

        subjectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Subject",
            required: true
        }
    },
    {
        timestamps: true
    }
);

// A subject can only be assigned once to a particular group
groupSubjectSchema.index(
    { groupId: 1, subjectId: 1 },
    { unique: true }
);

module.exports = mongoose.model("GroupSubject", groupSubjectSchema);