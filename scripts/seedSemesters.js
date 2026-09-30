require("dotenv").config();
const mongoose = require("mongoose");
const Semester = require("../models/Semester");

(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    for (let n = 1; n <= 10; n++) {
        await Semester.updateOne(
            { number: n },
            { $setOnInsert: { number: n, name: `Semester ${n}` } },
            { upsert: true }
        );
    }
    console.log("Semesters seeded");
    await mongoose.disconnect();
})();