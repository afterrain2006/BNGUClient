import type { RobotState } from '@/domain/robot/RobotState'
import type { RobotBuff, RobotPenalty, RobotSystems } from '@/domain/robot/RobotEffects'

// A protocol-independent, incremental patch for one robot.
export interface RobotUpdate {
  robotId: number
  pose?: {
    position?: Partial<RobotState['pose']['position']>
    yaw?: RobotState['pose']['yaw']
  }
  combat?: Partial<RobotState['combat']>
  operational?: Partial<RobotState['operational']>
  configuration?: Partial<RobotState['configuration']>
  modules?: Partial<RobotState['modules']>
  injury?: Partial<RobotState['injury']>
  respawn?: Partial<RobotState['respawn']>
  buff?: RobotBuff
  penalty?: RobotPenalty
  systems?: RobotSystems
}
