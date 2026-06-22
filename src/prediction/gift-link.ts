/**
 * Browser-safe re-exports of gift URL / KDF crypto helpers (no PredictClient / RPC).
 * Full gift runtime (PTB builders + simulate reads) lives in `./gift.ts`.
 */
export {
  base64UrlNoPadDecode,
  base64UrlNoPadEncode,
  buildGiftClaimMessage,
  deriveGiftKeypair,
  encodeGiftUrl,
  generateGiftSeed,
  parseGiftUrl,
  signGiftClaim,
} from "./gift.ts";
export type { GiftUrlParts } from "./gift.ts";
