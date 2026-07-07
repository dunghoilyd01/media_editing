import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const MEDIA_FILE = path.join(DATA_DIR, 'media.json');
const LEGACY_FILE = path.join(__dirname, 'data.json');

const defaultMedia = [];
const defaultVideo = { subtitles: [], items: [], blur_regions: [] };

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readMedia() {
  ensureDir();
  try {
    return JSON.parse(fs.readFileSync(MEDIA_FILE, 'utf-8'));
  } catch {
    writeMedia(defaultMedia);
    return [];
  }
}

function writeMedia(media) {
  ensureDir();
  fs.writeFileSync(MEDIA_FILE, JSON.stringify(media, null, 2));
}

function videoPath(uuid) {
  return path.join(DATA_DIR, `${uuid}.json`);
}

function readVideo(uuid) {
  ensureDir();
  try {
    return JSON.parse(fs.readFileSync(videoPath(uuid), 'utf-8'));
  } catch {
    const data = { ...defaultVideo };
    writeVideo(uuid, data);
    return data;
  }
}

function writeVideo(uuid, data) {
  ensureDir();
  fs.writeFileSync(videoPath(uuid), JSON.stringify(data, null, 2));
}

function deleteVideoFile(uuid) {
  const fp = videoPath(uuid);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
}

function migrateFromLegacy() {
  if (!fs.existsSync(LEGACY_FILE)) return;
  try {
    const legacy = JSON.parse(fs.readFileSync(LEGACY_FILE, 'utf-8'));

    if (Array.isArray(legacy.objects)) {
      if (!Array.isArray(legacy.items)) legacy.items = [];
      for (const obj of legacy.objects) {
        legacy.items.push({
          media_uuid: obj.media_uuid,
          timestamp: obj.timestamp ?? obj.start_time ?? 0,
          end_time: obj.end_time ?? null,
          x: obj.x ?? null,
          y: obj.y ?? null,
          fields: obj.fields || [],
          id: obj.id ?? Date.now() + Math.random(),
          created_at: obj.created_at || new Date().toISOString(),
        });
      }
      delete legacy.objects;
    }

    const allUuids = new Set();

    if (Array.isArray(legacy.media)) {
      const mediaList = [];
      for (const m of legacy.media) {
        if (m.uuid) {
          allUuids.add(m.uuid);
          mediaList.push(m);
        }
      }
      writeMedia(mediaList);
    }

    if (Array.isArray(legacy.subtitles) || Array.isArray(legacy.items) || Array.isArray(legacy.blur_regions)) {
      const videoMap = {};
      for (const uuid of allUuids) {
        videoMap[uuid] = { subtitles: [], items: [], blur_regions: [] };
      }

      if (Array.isArray(legacy.subtitles)) {
        for (const s of legacy.subtitles) {
          if (s.media_uuid && videoMap[s.media_uuid]) {
            videoMap[s.media_uuid].subtitles.push(s);
          }
        }
      }

      if (Array.isArray(legacy.items)) {
        for (const i of legacy.items) {
          if (i.media_uuid && videoMap[i.media_uuid]) {
            videoMap[i.media_uuid].items.push(i);
          }
        }
      }

      if (Array.isArray(legacy.blur_regions)) {
        for (const b of legacy.blur_regions) {
          if (b.media_uuid && videoMap[b.media_uuid]) {
            videoMap[b.media_uuid].blur_regions.push(b);
          }
        }
      }

      for (const [uuid, data] of Object.entries(videoMap)) {
        writeVideo(uuid, data);
      }
    }

    fs.renameSync(LEGACY_FILE, LEGACY_FILE + '.bak');
    console.log('Migrated legacy data.json to per-video files in', DATA_DIR);
  } catch (err) {
    console.error('Migration failed:', err);
  }
}

migrateFromLegacy();

export function findAllMedia() {
  return readMedia().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function findMediaByUUID(uuid) {
  return readMedia().find(m => m.uuid === uuid) || null;
}

export function insertMedia(record) {
  const media = readMedia();
  const entry = { ...record, created_at: new Date().toISOString() };
  media.push(entry);
  writeMedia(media);
  writeVideo(record.uuid, { ...defaultVideo });
  return entry;
}

export function deleteMediaByUUID(uuid) {
  const media = readMedia();
  const idx = media.findIndex(m => m.uuid === uuid);
  if (idx === -1) return null;
  const [removed] = media.splice(idx, 1);
  writeMedia(media);
  deleteVideoFile(uuid);
  return removed;
}

export function findSubtitlesByMedia(uuid) {
  const data = readVideo(uuid);
  return (data.subtitles || []).sort((a, b) => a.sequence - b.sequence);
}

export function replaceSubtitles(uuid, subtitles) {
  const data = readVideo(uuid);
  data.subtitles = subtitles.map((s, i) => ({
    id: Date.now() + i + Math.random(),
    media_uuid: uuid,
    sequence: i + 1,
    start_time: s.start_time,
    end_time: s.end_time,
    text: s.text,
    created_at: new Date().toISOString(),
  }));
  writeVideo(uuid, data);
  return subtitles.length;
}

export function findItemsByMedia(uuid) {
  const data = readVideo(uuid);
  return (data.items || []).sort((a, b) => a.timestamp - b.timestamp);
}

export function insertItem(record) {
  const data = readVideo(record.media_uuid);
  const item = { ...record, id: Date.now() + Math.random(), created_at: new Date().toISOString() };
  if (!Array.isArray(data.items)) data.items = [];
  data.items.push(item);
  writeVideo(record.media_uuid, data);
  return item;
}

export function deleteItem(id) {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && f !== 'media.json');
  for (const file of files) {
    const uuid = file.replace('.json', '');
    const data = readVideo(uuid);
    const idx = (data.items || []).findIndex(i => i.id === id);
    if (idx !== -1) {
      const [removed] = data.items.splice(idx, 1);
      writeVideo(uuid, data);
      return removed;
    }
  }
  return null;
}

export function findBlurRegionsByMedia(uuid) {
  const data = readVideo(uuid);
  return (data.blur_regions || []).sort((a, b) => a.start_time - b.start_time);
}

export function replaceBlurRegions(uuid, regions) {
  const data = readVideo(uuid);
  data.blur_regions = regions.map((r, i) => ({
    id: r.id ?? Date.now() + i + Math.random(),
    media_uuid: uuid,
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
    start_time: r.start_time,
    end_time: r.end_time,
    created_at: new Date().toISOString(),
  }));
  writeVideo(uuid, data);
  return regions.length;
}
