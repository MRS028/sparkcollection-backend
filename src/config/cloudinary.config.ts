/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from "http-status-codes";
import { v2 as cloudinary } from "cloudinary";
// import stream from "stream";
// import AppError from "../errorHelpers/AppError";
import { envVars } from "./env";
import AppError from "../errorHelpers/AppError";

cloudinary.config({
  cloud_name: envVars.CLOUDINARY_CLOUD_NAME,
  api_key: envVars.CLOUDINARY_API_KEY,
  api_secret: envVars.CLOUDINARY_API_SECRET,
});

export const deleteFromCloudinary = async (url: string) => {
  try {
    const regex = /\/v\d+\/(.*?)\.(jpg|jpeg|png|gif|webp|bmp|tiff|svg)$/i;
    const match = url.match(regex);

    if (match && match[1]) {
      const publicId = match[1];
      await cloudinary.uploader.destroy(publicId);
    //   console.log(`Deleted image with public ID: ${publicId}`);
    }
  } catch (error: any) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Something went wrong with Cloudinary",
      error.message,
    );
  }
};

export const cloudinaryUpload = cloudinary;

// const uploadToCloudinary = cloudinary.uploader.upload()

//

//Multer storage cloudinary
//Amader folder -> image -> form data -> File -> Multer -> storage in cloudinary -> url ->  req.file  -> url  -> mongoose -> mongodb
