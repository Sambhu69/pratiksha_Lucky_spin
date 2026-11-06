import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAdminAuth } from '../middleware/auth.js';
import { login, logout, getMe } from '../controllers/authController.js';
import { validateCustomer } from '../controllers/kioskController.js';
import { executeSpin } from '../controllers/spinController.js';

export const router = Router();

// ----------------- Auth Routes -----------------
router.post('/auth/login', asyncHandler(login));
router.post('/auth/logout', asyncHandler(logout));
router.get('/auth/me', requireAdminAuth, asyncHandler(getMe));

// ----------------- Kiosk Routes ----------------
router.post('/kiosk/validate', asyncHandler(validateCustomer));

// ----------------- Spin Routes -----------------
router.post('/spins/execute', asyncHandler(executeSpin));
