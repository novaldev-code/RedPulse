import { v2 as cloudinary, type UploadApiResponse, type UploadApiErrorResponse } from "cloudinary";

let configured = false;

function ensureCloudinaryConfig() {
  if (configured) {
    return;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? "";
  const apiKey = process.env.CLOUDINARY_API_KEY ?? "";
  const apiSecret = process.env.CLOUDINARY_API_SECRET ?? "";

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary media upload is not configured.");
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true
  });

  configured = true;
}

export function isSupportedMediaMimeType(mimeType: string) {
  return mimeType.startsWith("image/") || mimeType.startsWith("video/");
}

export async function uploadPostMedia(file: Express.Multer.File, userId: string, sortOrder: number) {
  ensureCloudinaryConfig();

  const resourceType = file.mimetype.startsWith("video/") ? "video" : "image";

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        folder: "redpulse/posts",
        resource_type: resourceType,
        public_id: `${userId}_${Date.now()}_${sortOrder}`,
        overwrite: false
      },
      (error: UploadApiErrorResponse | undefined, response: UploadApiResponse | undefined) => {
        if (error) {
          reject(error);
          return;
        }

        if (!response) {
          reject(new Error("Cloudinary did not return an upload response."));
          return;
        }

        resolve(response);
      }
    );

    upload.end(file.buffer);
  });

  return {
    url: result.secure_url,
    type: resourceType as "image" | "video",
    sortOrder
  };
}
