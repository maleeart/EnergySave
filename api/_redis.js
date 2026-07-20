import { Redis } from "@upstash/redis";

// Upstash ตั้งชื่อ env var ต่างกันตาม product ที่ provision (KV_* หรือ UPSTASH_*)
// รับทั้งสองแบบ จะได้ไม่ต้องมานั่งไล่แก้ตอน deploy
export const redis = () => new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN,
});

export const KEY = "energysave:responses";
