import os
import cv2
import numpy as np
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from insightface.app import FaceAnalysis

SECRET = os.environ.get("FACE_SERVICE_SECRET", "")
MODEL = "buffalo_l"

fa = FaceAnalysis(name=MODEL, providers=["CPUExecutionProvider"])
fa.prepare(ctx_id=-1, det_size=(640, 640))

app = FastAPI()


def embed_one(data: bytes):
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        return {"faces": 0, "error": "bad_image"}
    faces = fa.get(img)
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
    return {"model": MODEL, "results": [embed_one(f.file.read()) for f in files]}