import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { saveFile, deleteFile, validateFile, type UploadedFile } from "../services/file.service";

/**
 * Pre-baked file upload router — mounted at /api/upload by src/index.ts.
 *
 * Mobile flow (see coding_guidelines "File uploads / media persistence"):
 *   1. expo-image-picker / expo-document-picker gives a local `file://` URI.
 *   2. Build FormData: form.append("file", { uri, name, type }) and
 *      POST `${API_URL}/api/upload` (optionally `?folder=avatars`).
 *   3. Response { success, url, key, type, filename } — store `url` (+ `key`
 *      for later deletion) in your DB. Render with <Image source={{ uri: url }}/>.
 *
 * Files are streamed straight to S3 from memory — nothing touches pod disk, so
 * uploads survive pod restarts (bytes in S3, URL in your external Postgres).
 *
 * Robustness: we accept the file under ANY field name (not just "file"), so a
 * client that posts `image`/`media`/`photo` still works, and we translate
 * multer errors into clean JSON instead of letting them bubble to a 500.
 */

const router = Router();

// Memory storage: file lives in RAM as a Buffer, then goes straight to S3.
// Never written to the pod filesystem.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// upload.any() captures the file regardless of the form field name. We pick the
// first file part. multer errors (e.g. LIMIT_FILE_SIZE) are caught and returned
// as a clean 400 rather than crashing the request.
function acceptAnyFile(req: Request, res: Response, next: NextFunction) {
    upload.any()(req, res, (err: unknown) => {
        if (err) {
            const code = (err as { code?: string }).code;
            const message =
                code === "LIMIT_FILE_SIZE" ? "File too large. Maximum size: 50MB" : "Could not read uploaded file.";
            console.warn(`[upload] multer error (${code ?? "unknown"}): ${(err as Error)?.message}`);
            res.status(400).json({ error: message });
            return;
        }
        next();
    });
}

/**
 * POST /api/upload
 * multipart/form-data with a file part (any field name). Optional `?folder=`.
 */
router.post("/", acceptAnyFile, async (req: Request, res: Response) => {
    try {
        const files = (req.files as Express.Multer.File[] | undefined) ?? [];
        const f = files[0];

        if (!f) {
            // Help future debugging: surface what actually arrived.
            console.warn(
                `[upload] no file part. content-type="${req.headers["content-type"] ?? ""}" ` +
                    `fields=${JSON.stringify(Object.keys(req.body ?? {}))}`
            );
            res.status(400).json({
                error: "No file provided. Send multipart/form-data with a file part (field name 'file').",
            });
            return;
        }

        const uploadedFile: UploadedFile = {
            originalname: f.originalname,
            mimetype: f.mimetype,
            size: f.size,
            buffer: f.buffer,
        };

        const validation = validateFile(uploadedFile);
        if (!validation.valid) {
            res.status(400).json({ error: validation.error });
            return;
        }

        const folder = (req.query.folder as string) || "media";
        const result = await saveFile(uploadedFile, folder);

        res.json({ success: true, ...result });
    } catch (error) {
        console.error("[upload] Upload failed:", error);
        res.status(500).json({ error: "Upload failed" });
    }
});

/**
 * DELETE /api/upload
 * JSON body { key } — the S3 key returned from the upload response.
 */
router.delete("/", async (req: Request, res: Response) => {
    try {
        const { key } = req.body ?? {};
        if (!key) {
            res.status(400).json({ error: "No file key provided" });
            return;
        }

        const success = await deleteFile(key);
        if (success) {
            res.json({ success: true, message: "File deleted" });
        } else {
            res.status(500).json({ error: "Failed to delete file" });
        }
    } catch (error) {
        console.error("[upload] Delete failed:", error);
        res.status(500).json({ error: "Delete failed" });
    }
});

export default router;
