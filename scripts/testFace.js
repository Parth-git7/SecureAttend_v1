require("dotenv").config();
const fs = require("fs");
const { embedFrames, dot } = require("../utils/face");

(async () => {
    const [refPath, ...others] = process.argv.slice(2);
    const { results } = await embedFrames([refPath, ...others].map((p) => fs.readFileSync(p)));
    const ref = results[0].embedding;
    results.slice(1).forEach((r, i) =>
        console.log(others[i], r.embedding ? dot(ref, r.embedding).toFixed(3) : "no face", "det:", r.detScore?.toFixed(2))
    );
})();