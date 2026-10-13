import type { RobotUpdate } from '@core/contracts/RobotUpdate'
import type { MatchState, MatchStatus, Team, TeamState, MatchEvent } from '@core/models/match/MatchState'

export interface MatchUpdate {
  scope: 'match'
  status?: Partial<MatchStatus>
  teams?: Partial<Record<Team, Partial<TeamState>>>
  mechanisms?: MatchState['mechanisms']
  event?: MatchEvent
  rune?: MatchState['rune']
  radar?: MatchState['radar']
}

// An opaque, user-defined data stream, after the transport envelope is removed.
export interface CustomDataUpdate {
  scope: 'custom'
  robotId: number
  bytes: Uint8Array
}

export type ClientUpdate = RobotUpdate | MatchUpdate | CustomDataUpdate
