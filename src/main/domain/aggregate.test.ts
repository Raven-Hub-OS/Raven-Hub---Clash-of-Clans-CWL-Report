import { describe, expect, it } from 'vitest'
import type { CwlGroup } from '../clashking/types'
import { aggregateClan, buildReportStats } from './aggregate'
import {
  CLAN_TAG,
  makeAggregationFixture,
  makeAttack,
  makeMember,
  PLAYER_A,
  PLAYER_C
} from './testFixtures'

function run(group?: CwlGroup): ReturnType<typeof aggregateClan> {
  const fixture = makeAggregationFixture()
  return aggregateClan({
    clanTag: CLAN_TAG,
    season: fixture.season,
    group: group ?? fixture.group
  })
}

describe('aggregateClan', () => {
  it('aggregates attack and defense statistics per player', () => {
    const result = run()

    expect(result.clan).toMatchObject({
      tag: CLAN_TAG,
      name: 'Raven Clan',
      season: '2026-08',
      league: 'Legend League',
      rank: 2,
      players: 3
    })
    expect(result.warnings).toEqual([])

    expect(result.players.map((player) => player.name)).toEqual(['Alpha', 'Bravo', 'Charlie'])

    const alpha = result.players[0]
    expect(alpha).toMatchObject({
      clan: 'Raven Clan',
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
      dips: 1
    })

    const bravo = result.players[1]
    expect(bravo).toMatchObject({
      warsParticipated: 2,
      attacks: 1,
      missed: 1,
      attackStars: 2,
      avgStars: 2,
      destruction: 80,
      defenses: 2,
      defenseStars: 3,
      avgDefense: 1.5,
      reaches: 0,
      dips: 1
    })

    const charlie = result.players[2]
    expect(charlie).toMatchObject({
      th: 14,
      warsParticipated: 2,
      attacks: 1,
      missed: 1,
      attackStars: 2,
      destruction: 70,
      defenses: 1,
      defenseStars: 3,
      avgDefense: 3,
      reaches: 1,
      dips: 0
    })
  })

  it('accepts the current API spelling townhallLevel', () => {
    const fixture = makeAggregationFixture()

    for (const round of fixture.group.rounds) {
      for (const rawWar of round.warTags) {
        const war = rawWar as {
          clan: { members: Array<Record<string, unknown>> }
          opponent: { members: Array<Record<string, unknown>> }
        }
        for (const member of [...war.clan.members, ...war.opponent.members]) {
          member.townhallLevel = member.townHallLevel
          delete member.townHallLevel
        }
      }
    }

    const result = run(fixture.group)

    expect(result.players).toHaveLength(3)
    expect(result.warnings).toEqual([])
    expect(result.players[0]).toMatchObject({ th: 15, reaches: 1, dips: 1 })
  })

  it('derives defense totals from opponent attacks on the player tag', () => {
    const result = run()
    const alpha = result.players.find((player) => player.tag === PLAYER_A)

    // Xray hit Alpha for 2 stars and Zulu hit Alpha for 1 star.
    expect(alpha?.defenses).toBe(2)
    expect(alpha?.defenseStars).toBe(3)
  })

  it('ignores duplicate war objects', () => {
    const fixture = makeAggregationFixture()
    const war = fixture.group.rounds[0].warTags[0]
    fixture.group.rounds.push({ warTags: [war] })

    const result = run(fixture.group)

    expect(result.players.find((player) => player.tag === PLAYER_A)?.attacks).toBe(2)
    expect(result.warnings.some((warning) => warning.kind === 'partial-war')).toBe(false)
  })

  it('skips wars that have not ended and warns about them', () => {
    const fixture = makeAggregationFixture()
    const war = fixture.group.rounds[0].warTags[1] as Record<string, unknown>
    war.state = 'inWar'

    const result = run(fixture.group)

    const alpha = result.players.find((player) => player.tag === PLAYER_A)
    expect(alpha?.attacks).toBe(1)
    expect(alpha?.warsParticipated).toBe(1)
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        kind: 'partial-war',
        detail: '1 war skipped'
      })
    )
  })

  it('warns when ClashKing still reports the group as ongoing', () => {
    const fixture = makeAggregationFixture()
    fixture.group.state = 'inWar'

    const result = run(fixture.group)

    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        kind: 'partial-war',
        detail: 'Group state: inWar'
      })
    )
  })

  it('uses the Town Hall from the most recent war for reaches and dips', () => {
    const fixture = makeAggregationFixture()
    fixture.group.rounds[0].warTags.push({
      state: 'warEnded',
      startTime: '20260810T080000.000Z',
      endTime: '20260811T080000.000Z',
      clan: {
        tag: CLAN_TAG,
        name: 'Raven Clan',
        attacks: 1,
        stars: 3,
        members: [
          makeMember(PLAYER_C, 'Charlie', 16, [makeAttack(PLAYER_C, '#2TTTTTTT', 3, 100)])
        ]
      },
      opponent: {
        tag: '#2BBBBBB3',
        name: 'Third Enemy',
        attacks: 0,
        stars: 0,
        members: [makeMember('#2TTTTTTT', 'Tango', 15)]
      }
    })

    const result = run(fixture.group)
    const charlie = result.players.find((player) => player.tag === PLAYER_C)

    expect(charlie?.th).toBe(16)
    // Charlie attacked a TH16 (reach) earlier and a TH15 (dip) in this war.
    expect(charlie?.reaches).toBe(1)
    expect(charlie?.dips).toBe(1)
  })

  it('warns when an attack cannot be matched to a defender', () => {
    const fixture = makeAggregationFixture()
    const war = fixture.group.rounds[0].warTags[0] as {
      clan: { members: Array<{ attacks: unknown[] }> }
    }
    war.clan.members[0].attacks.push(makeAttack(PLAYER_A, '#2ZZZZZZZ', 3, 100))

    const result = run(fixture.group)

    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        kind: 'incomplete-data',
        detail: '1 attack unmatched'
      })
    )
  })

  it('counts a war with no usable members as skipped', () => {
    const fixture = makeAggregationFixture()
    fixture.group.rounds[0].warTags.push({
      state: 'warEnded',
      startTime: '20260809T080000.000Z',
      endTime: '20260810T080000.000Z',
      clan: { tag: CLAN_TAG, name: 'Raven Clan', members: [] },
      opponent: { tag: '#2BBBBBB4', name: 'Empty Enemy', members: [] }
    })

    const result = run(fixture.group)

    expect(result.warnings).toContainEqual(
      expect.objectContaining({ kind: 'partial-war', detail: '1 war skipped' })
    )
  })

  it('warns when the season has no player data', () => {
    const fixture = makeAggregationFixture()
    fixture.group.rounds = []

    const result = run(fixture.group)

    expect(result.players).toEqual([])
    expect(result.warnings).toContainEqual(expect.objectContaining({ kind: 'no-players' }))
  })
})

describe('buildReportStats', () => {
  it('sums player rows and computes weighted averages', () => {
    const players = run().players
    const stats = buildReportStats(players, 1)

    expect(stats).toEqual({
      clans: 1,
      players: 3,
      attacks: 4,
      missed: 2,
      attackStars: 8,
      defenses: 5,
      avgStars: 2,
      avgDefense: 1.8
    })
  })

  it('returns zero averages when there is no activity', () => {
    expect(buildReportStats([], 0)).toEqual({
      clans: 0,
      players: 0,
      attacks: 0,
      missed: 0,
      attackStars: 0,
      defenses: 0,
      avgStars: 0,
      avgDefense: 0
    })
  })
})
