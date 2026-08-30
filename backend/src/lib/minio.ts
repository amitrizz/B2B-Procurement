import * as Minio from 'minio';

const endPoint = process.env.MINIO_ENDPOINT || '127.0.0.1';
const port = parseInt(process.env.MINIO_PORT || '9000');
const useSSL = process.env.MINIO_USE_SSL === 'true';
const accessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const secretKey = process.env.MINIO_SECRET_KEY || 'minioadmin';

export const minioClient = new Minio.Client({
  endPoint,
  port,
  useSSL,
  accessKey,
  secretKey,
});

export const BUCKET_NAME = process.env.MINIO_BUCKET_NAME || 'b2b-uploads';

// Initialize bucket
export async function initMinio() {
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      await minioClient.makeBucket(BUCKET_NAME);
      console.log(`Bucket ${BUCKET_NAME} created successfully in MinIO.`);
    }
  } catch (error) {
    console.error('Error initializing MinIO bucket:', error);
  }
}
