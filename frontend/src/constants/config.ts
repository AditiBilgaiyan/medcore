export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3001";

/**
 * When true, all API calls are served by the in-browser mock API (src/lib/mock)
 * so the frontend runs without the NestJS backend. Set NEXT_PUBLIC_USE_MOCK_API=false
 * to talk to the real API.
 */
export const USE_MOCK_API = process.env.NEXT_PUBLIC_USE_MOCK_API !== "false";

export const APP_NAME = "MedCore HMS";
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
export const CURRENCY = "INR";
export const LOCALE = "en-IN";
