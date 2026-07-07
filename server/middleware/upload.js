import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/videos'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/images'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const videoTypes = ['video/mp4', 'video/webm', 'video/avi', 'video/mov', 'video/mkv', 'video/quicktime'];
const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/tiff', 'image/bmp', 'image/svg+xml', 'image/avif'];

function fileFilter(typeMap) {
  return (req, file, cb) => {
    if (typeMap.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
    }
  };
}

export const uploadVideo = multer({
  storage: videoStorage,
  fileFilter: fileFilter(videoTypes),
  limits: { fileSize: 500 * 1024 * 1024 },
}).single('file');

export const uploadImage = multer({
  storage: imageStorage,
  fileFilter: fileFilter(imageTypes),
  limits: { fileSize: 50 * 1024 * 1024 },
}).single('file');
