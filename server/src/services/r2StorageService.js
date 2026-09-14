const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const fs = require('fs');

let s3ClientInstance = null;

const DEFAULT_ENDPOINT = process.env.CLOUDFLARE_R2_ENDPOINT || '';
const DEFAULT_BUCKET = process.env.CLOUDFLARE_R2_BUCKET || 'whatsapp-media';

/**
 * Initializes and returns singleton S3Client for Cloudflare R2
 */
function getR2Client() {
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '';
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '';

  if (!accessKeyId || !secretAccessKey) {
    return null;
  }

  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: 'auto',
      endpoint: DEFAULT_ENDPOINT,
      credentials: {
        accessKeyId: accessKeyId.trim(),
        secretAccessKey: secretAccessKey.trim(),
      },
      forcePathStyle: true,
    });
  }
  return s3ClientInstance;
}

/**
 * Uploads a file buffer to Cloudflare R2 storage
 * @param {Buffer} buffer - File buffer
 * @param {string} fileName - Destination file name
 * @param {string} mimeType - MIME type of the file
 * @param {string} [folder='media'] - Subfolder in the bucket
 * @returns {Promise<{ success: boolean, key: string, publicUrl?: string, error?: string }>}
 */
async function uploadMediaToR2(buffer, fileName, mimeType = 'application/octet-stream', folder = 'media') {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    return { success: false, error: 'Invalid buffer provided' };
  }

  const client = getR2Client();
  if (!client) {
    return { success: false, error: 'R2 credentials not configured' };
  }

  const cleanName = String(fileName || `file_${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `${folder}/${Date.now()}_${cleanName}`;

  try {
    const command = new PutObjectCommand({
      Bucket: DEFAULT_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    });

    await client.send(command);
    console.log(`[Cloudflare R2] ☁️ Successfully uploaded file to R2: ${key}`);

    return {
      success: true,
      key,
      url: `${DEFAULT_ENDPOINT}/${DEFAULT_BUCKET}/${key}`,
    };
  } catch (err) {
    console.warn(`[Cloudflare R2] Upload warning for ${key}:`, err.message);

    // Fallback: save to local server uploads directory if R2 is unavailable
    try {
      const localUploadDir = path.resolve(__dirname, '../../uploads');
      if (!fs.existsSync(localUploadDir)) {
        fs.mkdirSync(localUploadDir, { recursive: true });
      }
      const localPath = path.join(localUploadDir, `${Date.now()}_${cleanName}`);
      fs.writeFileSync(localPath, buffer);
      return {
        success: true,
        key: `local/${cleanName}`,
        localPath,
        fallback: true,
        error: err.message,
      };
    } catch (localErr) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = {
  getR2Client,
  uploadMediaToR2,
  DEFAULT_BUCKET,
  DEFAULT_ENDPOINT,
};
