import type { PlayerRow, ReportData } from '@shared/types'
import type { CwlGroup, SeasonInfo, WarAttack, WarMember, WarSide } from '../clashking/types'

export const CLAN_TAG = '#2AAAAAAA'
export const ENEMY_TAG = '#2BBBBBBB'
export const ENEMY2_TAG = '#2BBBBBB2'
export const PLAYER_A = '#2CCCCCCC'
export const PLAYER_B = '#2DDDDDDD'
export const PLAYER_C = '#2EEEEEEE'

export function makeAttack(
  attackerTag: string,
  defenderTag: string,
  stars: number,
  destructionPercentage: number
): WarAttack {
  return { attackerTag, defenderTag, stars, destructionPercentage }
}

export function makeMember(
  tag: string,
  name: string,
  townHallLevel: number,
  attacks: WarAttack[] = []
): WarMember {
  return { tag, name, townHallLevel, attacks }
}

function makeSide(tag: string, name: string, members: WarMember[]): WarSide {
  return {
    tag,
    name,
    members,
    attacks: members.reduce((total, member) => total + (member.attacks?.length ?? 0), 0),
    stars: members.reduce(
      (total, member) =>
        total + (member.attacks ?? []).reduce((sum, attack) => sum + attack.stars, 0),
      0
    )
  }
}

export function makeAggregationFixture(): { group: CwlGroup; season: SeasonInfo } {
  const clanSideWar1 = makeSide(CLAN_TAG, 'Raven Clan', [
    makeMember(PLAYER_A, 'Alpha', 15, [makeAttack(PLAYER_A, '#2FFFFFFF', 3, 100)]),
    makeMember(PLAYER_B, 'Bravo', 15, [makeAttack(PLAYER_B, '#2GGGGGGG', 2, 80)]),
    makeMember(PLAYER_C, 'Charlie', 14)
  ])

  const enemySideWar1 = makeSide(ENEMY_TAG, 'Enemy Clan', [
    makeMember('#2FFFFFFF', 'Xray', 16, [makeAttack('#2FFFFFFF', PLAYER_A, 2, 75)]),
    makeMember('#2GGGGGGG', 'Yankee', 14, [makeAttack('#2GGGGGGG', PLAYER_B, 3, 100)]),
    makeMember('#2HHHHHHH', 'Zulu', 15, [makeAttack('#2HHHHHHH', PLAYER_A, 1, 40)])
  ])

  const clanSideWar2 = makeSide(CLAN_TAG, 'Raven Clan', [
    makeMember(PLAYER_A, 'Alpha', 15, [makeAttack(PLAYER_A, '#2RRRRRRR', 1, 50)]),
    makeMember(PLAYER_B, 'Bravo', 15),
    makeMember(PLAYER_C, 'Charlie', 14, [makeAttack(PLAYER_C, '#2QQQQQQQ', 2, 70)])
  ])

  const enemySideWar2 = makeSide(ENEMY2_TAG, 'Second Enemy', [
    makeMember('#2QQQQQQQ', 'Quebec', 16, [makeAttack('#2QQQQQQQ', PLAYER_C, 3, 100)]),
    makeMember('#2RRRRRRR', 'Romeo', 14),
    makeMember('#2SSSSSSS', 'Sierra', 15, [makeAttack('#2SSSSSSS', PLAYER_B, 0, 25)])
  ])

  const group: CwlGroup = {
    state: 'ended',
    season: '2026-08',
    warLeague: { id: 48000022, name: 'Legend League' },
    clans: [
      {
        tag: CLAN_TAG,
        name: 'Raven Clan',
        members: [
          { tag: PLAYER_A, name: 'Alpha', townHallLevel: 15 },
          { tag: PLAYER_B, name: 'Bravo', townHallLevel: 15 },
          { tag: PLAYER_C, name: 'Charlie', townHallLevel: 14 }
        ]
      },
      { tag: ENEMY_TAG, name: 'Enemy Clan' },
      { tag: ENEMY2_TAG, name: 'Second Enemy' }
    ],
    rounds: [
      {
        warTags: [
          {
            state: 'warEnded',
            startTime: '20260804T080000.000Z',
            endTime: '20260805T080000.000Z',
            clan: clanSideWar1,
            opponent: enemySideWar1
          },
          {
            state: 'warEnded',
            startTime: '20260804T080000.000Z',
            endTime: '20260805T080000.000Z',
            clan: clanSideWar2,
            opponent: enemySideWar2
          }
        ]
      }
    ]
  }

  const season: SeasonInfo = {
    season: '2026-08',
    state: 'ended',
    warLeague: { id: 48000022, name: 'Legend League' },
    rank: 2,
    stars: 8,
    destruction: 300,
    rounds: { won: 1, tied: 0, lost: 1 }
  }

  return { group, season }
}

export function makePlayer(overrides: Partial<PlayerRow> = {}): PlayerRow {
  return {
    clanTag: CLAN_TAG,
    clan: 'Raven Clan',
    name: 'Alpha',
    tag: PLAYER_A,
    th: 15,
    warsParticipated: 2,
    attacks: 2,
    missed: 0,
    attackStars: 4,
    avgStars: 2,
    destruction: 150,
    defenses: 2,
    defenseStars: 3,
    avgDefense: 1.5,
    reaches: 1,
    dips: 1,
    ...overrides
  }
}

export function makeReport(overrides: Partial<ReportData> = {}): ReportData {
  const players = [
    makePlayer(),
    makePlayer({
      name: 'Bravo',
      tag: PLAYER_B,
      th: 15,
      warsParticipated: 2,
      attacks: 1,
      missed: 1,
      attackStars: 2,
      avgStars: 2,
      destruction: 80,
      defenses: 1,
      defenseStars: 3,
      avgDefense: 3,
      reaches: 0,
      dips: 1
    })
  ]

  return {
    reportId: '00000000-0000-4000-8000-000000000001',
    season: '2026-08',
    seasonKey: '2026-08',
    seasonLabel: 'August 2026',
    generatedAt: '2026-08-10T12:00:00.000Z',
    clans: [
      {
        tag: CLAN_TAG,
        name: 'Raven Clan',
        season: '2026-08',
        league: 'Legend League',
        rank: 2,
        stars: 8,
        destruction: 300,
        rounds: { won: 1, tied: 0, lost: 1 },
        players: 2
      }
    ],
    players,
    warnings: [],
    stats: {
      clans: 1,
      players: 2,
      attacks: 3,
      missed: 1,
      attackStars: 6,
      defenses: 3,
      avgStars: 2,
      avgDefense: 2
    },
    ...overrides
  }
}
