const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage for chat media
const mediaStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'chatapp/media',
    resource_type: 'auto',
    allowed_formats: ['jpg','jpeg','png','gif','webp','mp4','mov','mp3','wav','ogg','pdf','doc','docx','zip'],
  },
});

// Storage for avatars
const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'chatapp/avatars',
    allowed_formats: ['jpg','jpeg','png','webp'],
    transformation: [{ width: 200, height: 200, crop: 'fill' }],
  },
});

const upload       = multer({ storage: mediaStorage,  limits: { fileSize: 50 * 1024 * 1024 } });
const uploadAvatar = multer({ storage: avatarStorage, limits: { fileSize: 5  * 1024 * 1024 } });

module.exports = { cloudinary, upload, uploadAvatar };