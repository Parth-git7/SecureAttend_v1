const { FACE_THRESHOLD, FACE_SERVICE_URL } = require("../config");

const MIN_DET_SCORE = 0.5;
const MIN_VALID_FRAMES = 2;

async function embedFrames(buffers) {
    const form = new FormData();
    buffers.forEach((buf, i) =>
        form.append("files", new Blob([buf], { type: "image/jpeg" }), `frame${i}.jpg`)
    );

    const res = await fetch(`${FACE_SERVICE_URL}/embed`, {
        method: "POST",
        headers: { "x-service-key": process.env.FACE_SERVICE_SECRET || "" },
        body: form
    });
    if (!res.ok) throw new Error(`Face service error ${res.status}`);
    return res.json();
}

// vectors are L2-normalized, so dot product = cosine similarity
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);

const median = (nums) => {
    const s = [...nums].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

async function compareFaces(buffers, storedEmbeddings) {
    try {
        const { model, results } = await embedFrames(buffers);

        const templates = storedEmbeddings.filter((e) => e.model === model);
        if (!templates.length) {
            return { result: "NO_TEMPLATE", score: null, framesUsed: 0 };
        }

        const scores = results
            .filter((r) => r.embedding && r.detScore >= MIN_DET_SCORE)
            .map((r) => Math.max(...templates.map((t) => dot(r.embedding, t.vector))));

        if (scores.length < MIN_VALID_FRAMES) {
            return { result: "NO_FACE", score: null, framesUsed: scores.length };
        }

        const score = Math.round(median(scores) * 10000) / 10000;
        return {
            result: score >= FACE_THRESHOLD ? "PASS" : "FAIL_MISMATCH",
            score,
            framesUsed: scores.length
        };
    } catch (err) {
        console.error("Face compare error:", err.message);
        return { result: "ERROR", score: null, framesUsed: 0 };
    }
}

// Validates one admin photo and stores its embedding on the student.
// `student` must be loaded with .select("+faceEmbeddings")
async function enrollAdminPhoto(student, buffer) {
    const { model, results } = await embedFrames([buffer]);
    const r = results[0];

    if (!r.embedding) return { ok: false, message: "No face detected in the photo" };
    if (r.faces !== 1) return { ok: false, message: "Photo must contain exactly one face" };
    if (r.detScore < 0.6) return { ok: false, message: "Photo quality too low. Use a clear, front-facing photo" };

    student.faceEmbeddings = student.faceEmbeddings.filter((e) => e.source !== "ADMIN_PHOTO");
    student.faceEmbeddings.push({ vector: r.embedding, source: "ADMIN_PHOTO", model });
    await student.save();

    return { ok: true, detScore: r.detScore };
}

module.exports = { embedFrames, compareFaces, dot, enrollAdminPhoto };