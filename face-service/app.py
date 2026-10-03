import os
import cv2
import numpy as np
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from insightface.app import FaceAnalysis
import time

SECRET = os.environ.get("FACE_SERVICE_SECRET", "")
MODEL = "buffalo_l"

fa = FaceAnalysis(
    name=MODEL,
    allowed_modules=["detection", "recognition"],
    providers=["CPUExecutionProvider"],
)
fa.prepare(ctx_id=-1, det_size=(320, 320))

# warm-up so the first real request isn't slow
fa.get(np.zeros((320, 320, 3), dtype=np.uint8))

app = FastAPI()


def embed_one(data: bytes):
    t = time.time()
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    t_decode = time.time() - t
    if img is None:
        return {"faces": 0, "error": "bad_image"}

    t = time.time()
    faces = fa.get(img)
    t_infer = time.time() - t
    print(f"[frame] {len(data)//1024} KB, {img.shape[1]}x{img.shape[0]}, decode {t_decode:.2f}s, infer {t_infer:.2f}s, faces {len(faces)}", flush=True)

    if not faces:
        return {"faces": 0}
    # largest face wins (classmates may be in the background)
    face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    return {
        "faces": len(faces),
        "detScore": float(face.det_score),
        "embedding": face.normed_embedding.tolist(),
    }


@app.post("/embed")
def embed(files: list[UploadFile] = File(...), x_service_key: str = Header(default="")):
    if SECRET and x_service_key != SECRET:
        raise HTTPException(status_code=401)
    t0 = time.time()
    results = [embed_one(f.file.read()) for f in files]
    print(f"[embed] {len(files)} frames in {time.time() - t0:.2f}s", flush=True)
    return {"model": MODEL, "results": results}