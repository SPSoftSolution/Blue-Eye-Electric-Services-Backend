import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },

  fileFilter: (_req, file, cb) => {
    const profilePhotoTypes = [
      "image/jpeg",
      "image/png",
    ];

    const validIdTypes = [
      "image/jpeg",
      "image/png",
      "application/pdf",
    ];

    if (file.fieldname === "profilePhoto") {
      if (!profilePhotoTypes.includes(file.mimetype)) {
        return cb(
          new Error(
            "Profile photo must be JPG, JPEG or PNG.",
          ),
        );
      }
    }

    if (file.fieldname === "validId") {
      if (!validIdTypes.includes(file.mimetype)) {
        return cb(
          new Error(
            "Valid ID must be JPG, JPEG, PNG or PDF.",
          ),
        );
      }
    }

    cb(null, true);
  },
});

export default upload;