import { z } from 'zod'

export const PlayerRowSchema = z.object({
  clanTag: z.string(),
  clan: z.string(),
  name: z.string(),
  tag: z.string(),
  th: z.number().finite(),
  warsParticipated: z.number().finite(),
  attacks: z.number().finite(),
  missed: z.number().finite(),
  attackStars: z.number().finite(),
  avgStars: z.number().finite(),
  destruction: z.number().finite(),
  defenses: z.number().finite(),
  defenseStars: z.number().finite(),
  avgDefense: z.number().finite(),
  reaches: z.number().finite(),
  dips: z.number().finite()
})

export const RosterClanSchema = z.object({
  tag: z.string().min(1),
  name: z.string(),
  league: z.string().nullable()
})

export const RosterDraftSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(120),
  folderId: z.string().min(1).nullable(),
  sourceReportItemId: z.string().min(1).nullable(),
  sourceReportName: z.string().max(200),
  seasonLabel: z.string().max(100),
  seasonKey: z.string().max(100).nullable().optional(),
  clans: z.array(RosterClanSchema).optional(),
  extraPlayers: z.array(PlayerRowSchema).optional(),
  players: z.array(PlayerRowSchema)
})

export const LibraryNameSchema = z.string().trim().min(1).max(120)
export const FolderNameSchema = z.string().trim().min(1).max(80)
export const IdSchema = z.string().min(1).max(200)
