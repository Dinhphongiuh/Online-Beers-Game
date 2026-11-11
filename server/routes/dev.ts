/** Dev Mode API: admin-only access to features still in development. */
import { Router } from 'express';
import { requirePermission } from '../http/roles.ts';
import { PERMISSIONS } from '../../shared/roles.ts';
import { DEV_FEATURES } from '../../shared/devFeatures.ts';

export const devRouter = Router();

// GET /api/dev/features - list in-development features (permission dev_mode.access)
devRouter.get('/api/dev/features', requirePermission(PERMISSIONS.DEV_MODE), (_req, res) => {
  res.json({ features: DEV_FEATURES });
});
