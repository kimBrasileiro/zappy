import { Storage } from '@google-cloud/storage';

// No explicit credentials — on Cloud Run this resolves via Application
// Default Credentials (the runtime service account already granted
// roles/storage.objectAdmin on the bucket below, see
// infra/modules/zappy/storage.tf); locally it falls back to whatever
// `gcloud auth application-default login` has set up, same as every other
// GCP client in this codebase.
const storage = new Storage();

const BUCKET_NAME_ENV = 'GCS_SERVICE_PHOTOS_BUCKET';
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export interface UploadResult {
  url?: string;
  error?: 'missing_bucket' | 'invalid_type' | 'too_large' | 'upload_failed';
}

// Public URL, not a signed one — the bucket's photo prefix is configured
// for public read (same spirit as apps/web/public/*.png static assets,
// just user-uploaded instead of build-time), since these photos are shown
// on the public booking form/page, not behind auth.
export async function uploadServicePhoto(companyId: string, serviceId: string, file: File): Promise<UploadResult> {
  const bucketName = process.env[BUCKET_NAME_ENV];
  if (!bucketName) return { error: 'missing_bucket' };

  const ext = EXTENSION_BY_MIME[file.type];
  if (!ext) return { error: 'invalid_type' };
  if (file.size > MAX_SIZE_BYTES) return { error: 'too_large' };

  const objectName = `${companyId}/${serviceId}-${Date.now()}.${ext}`;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await storage.bucket(bucketName).file(objectName).save(buffer, { contentType: file.type, resumable: false });
    return { url: `https://storage.googleapis.com/${bucketName}/${objectName}` };
  } catch (err) {
    console.error('[storage] service photo upload failed', err);
    return { error: 'upload_failed' };
  }
}
