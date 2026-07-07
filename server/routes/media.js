import { Router } from 'express';
import fs from 'fs';
import { findAllMedia, deleteMediaByUUID } from '../store.js';

const router = Router();

router.get('/list', (req, res) => {
  res.json(findAllMedia());
});

router.delete('/:uuid', (req, res) => {
  const removed = deleteMediaByUUID(req.params.uuid);
  if (!removed) return res.status(404).json({ error: 'Not found' });
  try { fs.unlinkSync(removed.filepath); } catch (_) {}
  res.json({ success: true });
});

export default router;
