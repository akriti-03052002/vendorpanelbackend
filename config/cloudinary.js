const path = require("path");
const { Readable } = require("stream");
const { pipeline } = require("stream/promises");
const cloudinary = require("cloudinary").v2;

/* ============================================================
   FILE STORAGE — CLOUDINARY
   KYC documents, settlement bills and generated partner agreements all
   live on Cloudinary — nothing is ever written to the server's own disk
   (Render's is wiped on every deploy).

   Everything is uploaded as type "authenticated": the file has no public
   URL, and can only be fetched with a URL signed by our API secret. The
   browser never sees a Cloudinary URL at all — the existing
   /download routes stay the only way in, so their auth and permission
   checks keep applying; they just stream from Cloudinary instead of disk.
============================================================ */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const ROOT_FOLDER = "spotx-partner-panel/partners";

// PDFs go up as "raw" so Cloudinary stores and returns the exact bytes
// (as "image" it would treat them as a transformable, rasterisable asset).
const resourceTypeFor = (mimeType) => (mimeType && mimeType.startsWith("image/") ? "image" : "raw");

const uniqueName = () => Date.now() + "-" + Math.round(Math.random() * 1e9);

/**
 * Uploads a file buffer and returns the `file` sub-document shape shared by
 * PartnerDocument and PartnerSettlementBill.
 *
 * @param {Buffer} buffer
 * @param {object} options
 * @param {string} options.partnerId
 * @param {string} options.originalName
 * @param {string} options.mimeType
 * @param {string} [options.subfolder] e.g. "bills"
 * @param {string} [options.name] base name for the asset (defaults to a unique one)
 */
const uploadFile = async (buffer, { partnerId, originalName, mimeType, subfolder, name }) => {
  const resourceType = resourceTypeFor(mimeType);
  const folder = [ROOT_FOLDER, String(partnerId), subfolder].filter(Boolean).join("/");

  // A "raw" asset's public_id is its full filename, so the extension has to
  // be part of it; for "image" Cloudinary tracks the format separately.
  const ext = resourceType === "raw" ? path.extname(originalName || "").toLowerCase() : "";
  const publicId = `${folder}/${name || uniqueName()}${ext}`;

  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { public_id: publicId, resource_type: resourceType, type: "authenticated", overwrite: false },
      (error, uploaded) => (error ? reject(error) : resolve(uploaded))
    );

    stream.end(buffer);
  });

  return {
    storageProvider: "cloudinary",
    objectKey: result.public_id,
    originalName,
    mimeType,
    size: result.bytes
  };
};

// Short-lived URL only ever used server-side, by sendStoredFile below.
const signedUrlFor = (file) => {
  const resourceType = resourceTypeFor(file.mimeType);

  // Cloudinary accounts refuse to serve PDFs from the normal delivery CDN
  // by default ("deny or ACL failure", even when signed), so raw files are
  // fetched through the signed API download endpoint instead.
  if (resourceType === "raw") {
    return cloudinary.utils.private_download_url(file.objectKey, "", {
      resource_type: "raw",
      type: "authenticated",
      expires_at: Math.floor(Date.now() / 1000) + 60
    });
  }

  return cloudinary.url(file.objectKey, {
    resource_type: "image",
    type: "authenticated",
    sign_url: true,
    secure: true
  });
};

/**
 * Streams a stored file from Cloudinary as the response to a /download
 * route.
 */
const sendStoredFile = async (res, file) => {
  // Rows from before the Cloudinary move pointed at local disk, which no
  // longer exists — there is nothing to serve for them.
  if (file.storageProvider !== "cloudinary") {
    return res.status(404).json({ success: false, message: "File not found on server." });
  }

  const upstream = await fetch(signedUrlFor(file));

  if (!upstream.ok) {
    console.error(`sendStoredFile: Cloudinary returned ${upstream.status} for ${file.objectKey}`, upstream.headers.get("x-cld-error") || "");
    return res.status(upstream.status === 404 ? 404 : 502).json({ success: false, message: "File not found on server." });
  }

  // The frontend previews straight from this response's blob, so the
  // Content-Type has to be the real one rather than whatever "raw" reports.
  res.type(file.mimeType || "application/octet-stream");
  res.attachment(file.originalName || "document");

  const length = upstream.headers.get("content-length");
  if (length) res.setHeader("Content-Length", length);

  return pipeline(Readable.fromWeb(upstream.body), res);
};

module.exports = { cloudinary, uploadFile, sendStoredFile };
