import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAdminAuth } from '../middleware/auth.js';
import { login, logout, getMe } from '../controllers/authController.js';
import { validateCustomer } from '../controllers/kioskController.js';
import { executeSpin } from '../controllers/spinController.js';
import {
  getMetrics,
  getProbabilityTable,
  getSpins,
  claimSpin,
  adjustRewardInventory,
  updateCampaignStatus,
} from '../controllers/adminController.js';

export const router = Router();

// ----------------- Public Auth Routes -----------------
router.post('/auth/login', asyncHandler(login));
router.post('/auth/logout', asyncHandler(logout));
router.get('/auth/me', requireAdminAuth, asyncHandler(getMe));

// ----------------- Public Kiosk Routes ----------------
router.post('/kiosk/validate', asyncHandler(validateCustomer));

// ----------------- Public Spin Routes -----------------
router.post('/spins/execute', asyncHandler(executeSpin));

// ----------------- Protected Admin Routes -------------
router.get('/admin/metrics', requireAdminAuth, asyncHandler(getMetrics));
router.get('/admin/probability-table', requireAdminAuth, asyncHandler(getProbabilityTable));
router.get('/admin/spins', requireAdminAuth, asyncHandler(getSpins));
router.patch('/admin/spins/:id/claim', requireAdminAuth, asyncHandler(claimSpin));
router.patch('/admin/rewards/:id/inventory', requireAdminAuth, asyncHandler(adjustRewardInventory));
router.patch('/admin/campaign/status', requireAdminAuth, asyncHandler(updateCampaignStatus));
