import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

/**
 * S3-backed file storage for generated mobile apps.
 *
 * WHY THIS EXISTS — PERSISTENCE:
 *   Mobile apps pick files with expo-image-picker / DocumentPicker and get a
 *   local `file://` URI. That URI is EPHEMERAL — it dies with the app session
 *   and means nothing on any other device or after a pod restart. To make a
 *   file persistent you MUST upload its bytes here (POST /api/upload), get back
 *   a permanent public S3 `url` + `key`, and store the `url`/`key` in your
 *   database. The pod's local disk is never touched, so pod kill/restart loses
 *   nothing: bytes live in S3, the URL lives in your (external) Postgres.
 *
 * VALIDATION PHILOSOPHY (intentionally permissive):
 *   This is a per-project sandbox: every key is namespaced under the project id
 *   and capped at MAX_FILE_SIZE. Over-strict MIME allow-lists were the #1 cause
 *   of spurious 400s (iOS photos arrive as `image/heic`; some pickers send
 *   `application/octet-stream` or no type at all). So we accept any file under
 *   the size cap, and *infer* a correct Content-Type from the extension when the
 *   client's mimetype is missing or generic — otherwise images would be stored
 *   as octet-stream and refuse to render inline in <Image>.
 */

const AWS_S3_BUCKET = "joylo-storage";
const AWS_REGION = "eu-west-1";

const CDN_BASE = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com`;

// S3Client is created lazily on first use so that missing credentials are caught
// at request time (with a clear error) rather than silently at module load.
let _s3Client: S3Client | null = null;
function getS3Client(): S3Client {
    if (_s3Client) return _s3Client;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    if (!accessKeyId || !secretAccessKey) {
        throw new Error("AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set");
    }
    _s3Client = new S3Client({
        region: AWS_REGION,
        credentials: { accessKeyId, secretAccessKey },
    });
    return _s3Client;
}

function getProjectId(): string {
    // JOYLO_PROJECT_ID is injected into the container env at deploy time and
    // inherited by this backend process. Files are namespaced under it so one
    // project can never read or overwrite another project's uploads.
    const projectId = process.env.JOYLO_PROJECT_ID;
    return projectId && projectId.trim() ? projectId.trim() : "unknown";
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB (stays under the 64m ingress body limit)

// Extension → Content-Type. Used to (a) classify the file and (b) recover a
// real content type when the client sends none / a generic one, so the object
// renders inline instead of downloading. Extend freely — unknowns still upload.
const EXT_CONTENT_TYPE: Record<string, string> = {
    // images
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
    webp: "image/webp", svg: "image/svg+xml", bmp: "image/bmp", tiff: "image/tiff",
    tif: "image/tiff", heic: "image/heic", heif: "image/heif", avif: "image/avif",
    ico: "image/x-icon",
    // videos
    mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", m4v: "video/x-m4v",
    avi: "video/x-msvideo", mkv: "video/x-matroska", "3gp": "video/3gpp",
    // audio
    mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", aac: "audio/aac", ogg: "audio/ogg",
    // documents
    pdf: "application/pdf", doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain", csv: "text/csv", json: "application/json", zip: "application/zip",
};

const GENERIC_TYPES = new Set(["", "application/octet-stream", "binary/octet-stream"]);

export type FileType = "image" | "video" | "audio" | "document";

export interface UploadedFile {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
}

export interface FileValidationResult {
    valid: boolean;
    error?: string;
}

export interface SavedFile {
    url: string;
    key: string;
    type: FileType;
    filename: string;
    contentType: string;
}

function extOf(name: string): string {
    const m = /\.([a-zA-Z0-9]+)$/.exec(name || "");
    return m ? m[1].toLowerCase() : "";
}

/** Best-effort real content type: trust a specific client mimetype, else infer from extension. */
function resolveContentType(file: UploadedFile): string {
    const mt = (file.mimetype || "").toLowerCase().trim();
    if (mt && !GENERIC_TYPES.has(mt)) return mt;
    const inferred = EXT_CONTENT_TYPE[extOf(file.originalname)];
    return inferred || "application/octet-stream";
}

function classify(contentType: string): FileType {
    if (contentType.startsWith("video/")) return "video";
    if (contentType.startsWith("audio/")) return "audio";
    if (contentType.startsWith("image/")) return "image";
    return "document";
}

/**
 * Permissive validation: only the size cap and a non-empty body are hard
 * requirements. Type is never a reason to reject — see "VALIDATION PHILOSOPHY".
 */
export function validateFile(file: UploadedFile): FileValidationResult {
    if (!file || !file.buffer || file.size <= 0) {
        return { valid: false, error: "Empty file." };
    }
    if (file.size > MAX_FILE_SIZE) {
        return { valid: false, error: "File too large. Maximum size: 50MB" };
    }
    return { valid: true };
}

export async function saveFile(file: UploadedFile, folder: string = "media"): Promise<SavedFile> {
    const projectId = getProjectId();
    const safeName = `${Date.now()}-${(file.originalname || "file").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "")}`;
    // Keep folder segment safe so a caller-supplied `?folder=` can't escape the
    // project's prefix or inject path traversal.
    const safeFolder = String(folder).replace(/[^a-zA-Z0-9._-]/g, "") || "media";
    const key = `generated_projects/${projectId}/uploads/${safeFolder}/${safeName}`;
    const contentType = resolveContentType(file);
    const type = classify(contentType);

    const client = getS3Client();

    try {
        const command = new PutObjectCommand({
            Bucket: AWS_S3_BUCKET,
            Key: key,
            Body: file.buffer,
            ContentType: contentType,
            ACL: "public-read",
        });

        await client.send(command);
        console.log(`[file.service] Uploaded to S3: ${key} (${contentType}, ${file.size}B)`);

        return {
            url: `${CDN_BASE}/${key}`,
            key,
            type,
            filename: safeName,
            contentType,
        };
    } catch (error) {
        console.error("[file.service] Failed to upload to S3:", error);
        throw new Error("Failed to upload file to storage");
    }
}

export async function deleteFile(key: string): Promise<boolean> {
    try {
        const client = getS3Client();
        const command = new DeleteObjectCommand({ Bucket: AWS_S3_BUCKET, Key: key });
        await client.send(command);
        console.log(`[file.service] Deleted from S3: ${key}`);
        return true;
    } catch (error) {
        console.error("[file.service] Failed to delete from S3:", error);
        return false;
    }
}

/**
 * Replace a stored file. Delete and upload are not atomic: old-file deletion is
 * best-effort. If deletion fails the old file remains, and if the upload then
 * fails both files may exist simultaneously. Callers must handle partial-failure states.
 */
export async function replaceFile(
    oldKey: string | null | undefined,
    newFile: UploadedFile,
    folder: string = "media"
): Promise<SavedFile> {
    if (oldKey) {
        await deleteFile(oldKey);
    }
    return saveFile(newFile, folder);
}
