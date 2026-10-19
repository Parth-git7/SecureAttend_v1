require("dotenv").config();
const fs = require("fs");
const { embedFrames } = require("../utils/face");

(async () => {
    const [img, n = "150"] = process.argv.slice(2);
    const buf = fs.readFileSync(img);
    const N = Number(n);
    const t0 = Date.now();
    const times = await Promise.all(
        Array.from({ length: N }, async () => {
            const s = Date.now();
            await embedFrames([buf]);
            return Date.now() - s;
        })
    );
    times.sort((a, b) => a - b);
    console.log(
        `total ${((Date.now() - t0) / 1000).toFixed(1)}s | p50 ${times[N >> 1]}ms | ` +
        `p95 ${times[Math.floor(N * 0.95)]}ms | max ${times[N - 1]}ms`
    );
})();