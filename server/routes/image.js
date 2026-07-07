import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { uploadImage } from '../middleware/upload.js';
import { insertMedia, findMediaByUUID, findAllMedia } from '../store.js';

const router = Router();

router.post('/upload', (req, res) => {
  uploadImage(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const file = req.file;
    const uuid = uuidv4();
    const filepath = file.path;

    try {
      const metadata = await sharp(filepath).metadata();
      insertMedia({
        uuid,
        original_name: file.originalname,
        type: 'image',
        mime_type: file.mimetype,
        size: file.size,
        filepath,
        width: metadata.width,
        height: metadata.height,
      });
      res.json({
        uuid,
        originalName: file.originalname,
        filename: file.filename,
        size: file.size,
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
      });
    } catch (dbErr) {
      res.status(500).json({ error: 'Processing error', details: dbErr.message });
    }
  });
});

router.post('/process/:uuid', async (req, res) => {
  const { blur, rotate, crop, flip, format } = req.body;
  const media = findMediaByUUID(req.params.uuid);
  if (!media) return res.status(404).json({ error: 'Media not found' });

  const inputPath = media.filepath;
  const outputName = `processed-${uuidv4()}${path.extname(inputPath)}`;
  const outputPath = path.join('uploads/images', outputName);

  try {
    let pipeline = sharp(inputPath);

    if (rotate !== undefined) {
      pipeline = pipeline.rotate(rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
    }

    if (flip) {
      if (flip === 'horizontal') pipeline = pipeline.flop();
      if (flip === 'vertical') pipeline = pipeline.flip();
    }

    if (crop) {
      pipeline = pipeline.extract({
        left: Math.round(crop.x),
        top: Math.round(crop.y),
        width: Math.round(crop.width),
        height: Math.round(crop.height),
      });
    }

    if (blur && Array.isArray(blur) && blur.length > 0) {
      const metadata = await sharp(inputPath).metadata();
      const compositeOps = [];
      for (const region of blur) {
        const rw = Math.round(region.width);
        const rh = Math.round(region.height);
        const rx = Math.round(region.x);
        const ry = Math.round(region.y);
        if (rw > 0 && rh > 0) {
          const blurred = await sharp(inputPath)
            .extract({ left: rx, top: ry, width: rw, height: rh })
            .blur(20)
            .toBuffer();
          compositeOps.push({ input: blurred, top: ry, left: rx });
        }
      }
      if (compositeOps.length > 0) {
        pipeline = sharp(inputPath).composite(compositeOps);
      }
    }

    if (format) {
      pipeline = pipeline.toFormat(format);
    }

    await pipeline.toFile(outputPath);

    res.download(outputPath, (dlErr) => {
      if (dlErr) res.status(500).json({ error: 'Download failed' });
      setTimeout(() => {
        try { fs.unlinkSync(outputPath); } catch (_) {}
      }, 60000);
    });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

router.get('/download/:uuid', (req, res) => {
  const media = findMediaByUUID(req.params.uuid);
  if (!media) return res.status(404).json({ error: 'Not found' });
  const filepath = media.filepath;
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'File not found' });
  res.download(filepath, media.original_name);
});

router.get('/list', (req, res) => {
  const all = findAllMedia();
  res.json(all.filter(m => m.type === 'image'));
});

export default router;
