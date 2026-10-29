import path from "path";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { cloudinaryUpload } from "./cloudinary.config";

const storage = new CloudinaryStorage({
  cloudinary: cloudinaryUpload,
  params: {
    public_id: (req, file) => {
      const name = path
        .parse(file.originalname)
        .name.toLowerCase()
        .replace(/\s+/g, "-") // replace spaces with dashes
        .replace(/[^a-z0-9-]/g, ""); // remove invalid characters

      const uniqueFileName = `${Math.random().toString(36).substring(2)}-${Date.now()}-${name}`;

      return uniqueFileName;
    },
  },
});

export const multerUpload = multer({ storage: storage });
