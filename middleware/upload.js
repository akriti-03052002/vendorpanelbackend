const multer = require("multer");

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg"
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error("Only PDF, PNG and JPG files are allowed."));
  }

  cb(null, true);
};

// Files are held in memory just long enough for the controller to hand
// them to Cloudinary (see config/cloudinary.js) — nothing is written to
// local disk, which doesn't survive a deploy on Render anyway. Where each
// file ends up (which partner's folder, bills subfolder, ...) is decided
// by the controller, so KYC documents, admin-on-behalf uploads and
// settlement bills all share the same rules here.
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE }
});

module.exports = { uploadDocument: upload, uploadDocumentAsAdmin: upload, uploadBill: upload };
