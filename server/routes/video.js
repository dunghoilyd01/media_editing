import { Router } from 'express';
import { execSync, execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { uploadVideo } from '../middleware/upload.js';
import { insertMedia, findMediaByUUID, findSubtitlesByMedia, replaceSubtitles, findItemsByMedia, insertItem, deleteItem, findBlurRegionsByMedia, replaceBlurRegions } from '../store.js';

const router = Router();

router.post('/upload', (req, res) => {
  uploadVideo(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const file = req.file;
    const uuid = uuidv4();
    const filepath = file.path;

    let width = 0, height = 0;
    try {
      const probe = execSync(
        `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${filepath}"`,
        { encoding: 'utf-8' }
      ).trim();
      const parts = probe.split(',');
      width = parseInt(parts[0]) || 0;
      height = parseInt(parts[1]) || 0;
    } catch (_) {}

    insertMedia({
      uuid,
      original_name: file.originalname,
      type: 'video',
      mime_type: file.mimetype,
      size: file.size,
      filepath,
      width,
      height,
    });

    res.json({ uuid, originalName: file.originalname, filename: file.filename, size: file.size, width, height });
  });
});

router.get('/subtitles/:uuid', (req, res) => {
  const subs = findSubtitlesByMedia(req.params.uuid);
  res.json(subs);
});

router.post('/subtitles/:uuid', (req, res) => {
  const { subtitles } = req.body;
  if (!Array.isArray(subtitles)) return res.status(400).json({ error: 'subtitles must be an array' });
  const count = replaceSubtitles(req.params.uuid, subtitles);
  res.json({ success: true, count });
});

router.post('/subtitles/upload/:uuid', uploadVideo, (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No subtitle file uploaded' });
  const srtPath = req.file.path;

  try {
    const content = fs.readFileSync(srtPath, 'utf-8');
    const subtitleEntries = parseSRT(content);
    const count = replaceSubtitles(req.params.uuid, subtitleEntries);
    fs.unlinkSync(srtPath);
    res.json({ success: true, count });
  } catch (err) {
    try { fs.unlinkSync(srtPath); } catch (_) {}
    res.status(500).json({ error: err.message });
  }
});

router.get('/items/:uuid', (req, res) => {
  res.json(findItemsByMedia(req.params.uuid));
});

router.post('/items/:uuid', (req, res, next) => {
  try {
    const { timestamp, end_time, x, y, fields } = req.body;
    if (timestamp === undefined) return res.status(400).json({ error: 'timestamp required' });
    const item = insertItem({
      media_uuid: req.params.uuid,
      timestamp,
      end_time: end_time ?? null,
      x: x ?? null,
      y: y ?? null,
      fields: fields || [],
    });
    res.json(item);
  } catch (err) {
    next(err);
  }
});

router.delete('/items/:id', (req, res) => {
  const removed = deleteItem(parseFloat(req.params.id));
  if (!removed) return res.status(404).json({ error: 'Item not found' });
  res.json({ success: true });
});

router.post('/export/subtitles/json/:uuid', (req, res) => {
  const subs = findSubtitlesByMedia(req.params.uuid);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="subtitles-${req.params.uuid}.json"`);
  res.json(subs);
});

router.post('/export/items/json/:uuid', (req, res) => {
  const items = findItemsByMedia(req.params.uuid);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="items-${req.params.uuid}.json"`);
  res.json(items);
});

router.get('/blur/:uuid', (req, res) => {
  res.json(findBlurRegionsByMedia(req.params.uuid));
});

router.post('/blur/:uuid', (req, res) => {
  const { regions } = req.body;
  if (!Array.isArray(regions)) return res.status(400).json({ error: 'regions must be an array' });
  const count = replaceBlurRegions(req.params.uuid, regions);
  res.json({ success: true, count });
});

router.post('/export/video/:uuid', (req, res) => {
  const { subtitles: subtitleData, blur_regions } = req.body;
  const media = findMediaByUUID(req.params.uuid);
  if (!media) return res.status(404).json({ error: 'Media not found' });

  const inputPath = media.filepath;
  const ext = path.extname(inputPath);
  const outputName = `exported-${uuidv4()}${ext}`;
  const outputPath = path.join('uploads/videos', outputName);
  const hasBlur = blur_regions && blur_regions.length > 0;
  const hasSubs = subtitleData && subtitleData.length > 0;

  let srtPath = null;
  if (hasSubs) {
    srtPath = path.join('uploads/videos', `subs-${uuidv4()}.srt`);
    fs.writeFileSync(srtPath, buildSRT(subtitleData));
  }

  // Build the ffmpeg command as an array to avoid shell escaping issues
  const args = ['-i', inputPath];

  if (hasBlur || hasSubs) {
    const chains = [];
    let finalOutput = 'outv';

    if (hasBlur) {
      let prev = '0:v';
      let appliedAny = false;
      for (let i = 0; i < blur_regions.length; i++) {
        const r = blur_regions[i];
        const x = Math.round(parseFloat(r.x));
        const y = Math.round(parseFloat(r.y));
        const w = Math.round(parseFloat(r.width));
        const h = Math.round(parseFloat(r.height));
        const st = parseFloat(r.start_time) || 0;
        const et = parseFloat(r.end_time) || 0;

        if (w < 1 || h < 1) continue;
        if (st >= et) continue;

        const cropLabel = `blur${i}`;
        const outLabel = `v${i}`;

        chains.push(
          `[${prev}]crop=${w}:${h}:${x}:${y},avgblur=40[${cropLabel}]`,
          `[${prev}][${cropLabel}]overlay=${x}:${y}:enable=between(t\\,${st}\\,${et})[${outLabel}]`
        );
        prev = outLabel;
        appliedAny = true;
      }
      if (!appliedAny) return res.status(400).json({ error: 'No valid blur regions to apply' });
      finalOutput = prev;
    }

    if (hasSubs) {
      const escPath = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
      const inputLabel = hasBlur ? `[${finalOutput}]` : '[0:v]';
      chains.push(`${inputLabel}subtitles=${escPath}[outv]`);
      finalOutput = 'outv';
    }

    const filterComplex = chains.join(';');
    args.push('-filter_complex', filterComplex);
    args.push('-map', `[${finalOutput}]`);
    args.push('-map', '0:a?');
  }

  args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-c:a', 'aac', '-b:a', '128k', '-y', outputPath);

  execFile('ffmpeg', args, (execErr, stdout, stderr) => {
    if (srtPath) { try { fs.unlinkSync(srtPath); } catch (_) {} }
    if (execErr) {
      const ffmpegLog = (stderr || '').split('\n').slice(-5).join('\n');
      return res.status(500).json({ error: 'Export failed', details: execErr.message, ffmpegLog });
    }
    res.download(outputPath, `exported-${media.original_name}`, (dlErr) => {
      if (dlErr) res.status(500).json({ error: 'Download failed' });
      setTimeout(() => { try { fs.unlinkSync(outputPath); } catch (_) {} }, 60000);
    });
  });
});

router.get('/stream/:uuid', (req, res) => {
  const media = findMediaByUUID(req.params.uuid);
  if (!media) return res.status(404).json({ error: 'Not found' });
  const filepath = media.filepath;
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'File not found' });

  const stat = fs.statSync(filepath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;
    const stream = fs.createReadStream(filepath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': media.mime_type,
    });
    stream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': media.mime_type,
    });
    fs.createReadStream(filepath).pipe(res);
  }
});

function parseSRT(content) {
  const blocks = content.trim().replace(/\r\n/g, '\n').split(/\n\n+/);
  return blocks.map((block) => {
    const lines = block.trim().split('\n');
    const timeMatch = lines[1] || '';
    const [startStr, endStr] = timeMatch.split(' --> ');
    const text = lines.slice(2).join('\n');
    return {
      start_time: srtTimeToSeconds(startStr),
      end_time: srtTimeToSeconds(endStr),
      text,
    };
  });
}

function srtTimeToSeconds(t) {
  if (!t) return 0;
  const parts = t.trim().replace(',', '.').split(':');
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  }
  return 0;
}

function buildSRT(subtitles) {
  return subtitles.map((s, i) => {
    const start = secondsToSrtTime(s.start_time);
    const end = secondsToSrtTime(s.end_time);
    return `${i + 1}\n${start} --> ${end}\n${s.text}\n`;
  }).join('\n');
}

function secondsToSrtTime(t) {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const sStr = s.toFixed(3).padStart(7, '0');
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${sStr.replace('.', ',')}`;
}

export default router;
