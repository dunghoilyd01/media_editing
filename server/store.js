import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'data.json');

const defaultData = { media: [], subtitles: [] };

function read() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    write(defaultData);
    return { ...defaultData };
  }
}

function write(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

export function findAllMedia() {
  const data = read();
  return data.media.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function findMediaByUUID(uuid) {
  const data = read();
  return data.media.find(m => m.uuid === uuid) || null;
}

export function insertMedia(record) {
  const data = read();
  data.media.push({ ...record, created_at: new Date().toISOString() });
  write(data);
  return record;
}

export function deleteMediaByUUID(uuid) {
  const data = read();
  const idx = data.media.findIndex(m => m.uuid === uuid);
  if (idx === -1) return null;
  const [removed] = data.media.splice(idx, 1);
  data.subtitles = data.subtitles.filter(s => s.media_uuid !== uuid);
  write(data);
  return removed;
}

export function findSubtitlesByMedia(uuid) {
  const data = read();
  return data.subtitles
    .filter(s => s.media_uuid === uuid)
    .sort((a, b) => a.sequence - b.sequence);
}

export function replaceSubtitles(uuid, subtitles) {
  const data = read();
  data.subtitles = data.subtitles.filter(s => s.media_uuid !== uuid);
  for (let i = 0; i < subtitles.length; i++) {
    data.subtitles.push({
      id: Date.now() + i + Math.random(),
      media_uuid: uuid,
      sequence: i + 1,
      start_time: subtitles[i].start_time,
      end_time: subtitles[i].end_time,
      text: subtitles[i].text,
      created_at: new Date().toISOString(),
    });
  }
  write(data);
  return subtitles.length;
}
