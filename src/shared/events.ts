/**
 * shared/events.ts
 * Provider-independent normalized event contract.
 * Keep all provider-specific payloads OUT of rendering modules.
 */
import { z } from 'zod';

// ── Event types ────────────────────────────────────────────
export const EventTypeSchema = z.enum([
  'chat',
  'like',
  'follow',
  'gift',
  'connection_change',
  'operator_command',
  'vote',
]);
export type EventType = z.infer<typeof EventTypeSchema>;

export const ProviderSchema = z.enum(['simulator', 'tiktok', 'operator']);
export type Provider = z.infer<typeof ProviderSchema>;

// ── Payloads ────────────────────────────────────────────────
export const ChatPayloadSchema = z.object({
  text: z.string().max(200),
  isCommand: z.boolean().default(false),
});

export const LikePayloadSchema = z.object({
  count: z.number().int().min(1).max(10_000),
  isCumulative: z.boolean(),
});

export const FollowPayloadSchema = z.object({});

export const GiftPayloadSchema = z.object({
  giftId: z.string().max(64),
  giftName: z.string().max(64),
  streakCount: z.number().int().min(1),
  isStreakEnd: z.boolean(),
});

export const ConnectionChangePayloadSchema = z.object({
  state: z.enum(['connected', 'disconnected', 'error', 'reconnecting']),
  message: z.string().max(200).optional(),
});

export const OperatorCommandPayloadSchema = z.object({
  command: z.enum([
    'disable_interactions',
    'enable_interactions',
    'scene_change',
    'palette_change',
    'emergency_stop',
  ]),
  params: z.record(z.unknown()).optional(),
});

export const VotePayloadSchema = z.object({
  choice: z.string().max(32),
});

// ── Normalized event ─────────────────────────────────────────
export const NormalizedEventSchema = z.object({
  /** Internal unique ID (never from provider) */
  id: z.string(),
  /** Optional provider-side event ID for deduplication */
  providerEventId: z.string().optional(),
  provider: ProviderSchema,
  /** Timestamp this service received the event */
  receivedAt: z.number(),
  /** Optional provider timestamp */
  providerTimestamp: z.number().optional(),
  type: EventTypeSchema,
  /** Opaque user ID if available */
  userId: z.string().max(128).optional(),
  /** Bounded safe display name */
  displayName: z.string().max(32).optional(),
  payload: z.union([
    ChatPayloadSchema,
    LikePayloadSchema,
    FollowPayloadSchema,
    GiftPayloadSchema,
    ConnectionChangePayloadSchema,
    OperatorCommandPayloadSchema,
    VotePayloadSchema,
  ]),
});

export type NormalizedEvent = z.infer<typeof NormalizedEventSchema>;

// ── WebSocket message envelope ───────────────────────────────
export const WsMessageSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('state_snapshot'), payload: z.unknown() }),
  z.object({ kind: z.literal('state_patch'), payload: z.unknown() }),
  z.object({ kind: z.literal('event'), payload: NormalizedEventSchema }),
  z.object({ kind: z.literal('command'), payload: z.unknown() }),
  z.object({ kind: z.literal('audio_action'), action: z.enum(['next', 'prev']) }),
  z.object({ kind: z.literal('diagnostics'), payload: z.unknown() }),
  z.object({ kind: z.literal('error'), payload: z.object({ message: z.string() }) }),
]);

export type WsMessage = z.infer<typeof WsMessageSchema>;
