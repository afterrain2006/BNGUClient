import type { CustomDataUpdate } from '@/contracts/ClientUpdate'
import type { RobotConfigFile } from '@/types/robot-config'

interface CustomDataInputDependencies {
  loadConfig(): Promise<RobotConfigFile>
  parse(path: string, bytes: Uint8Array): Promise<unknown>
  apply(robotId: number, value: Record<string, unknown>): void
}

// Serializes each robot's user-defined parser and coalesces high-frequency updates.
// Configuration is selected by the incoming robot ID, never by UI selection.
export function createCustomDataInput(dependencies: CustomDataInputDependencies) {
  let disposed = false
  let generation = 0
  let config: Promise<RobotConfigFile> | undefined
  const pending = new Map<number, CustomDataUpdate>()
  const running = new Set<number>()
  async function drain(robotId: number): Promise<void> {
    const currentGeneration = generation
    running.add(robotId)
    try {
      config ??= dependencies.loadConfig()
      const loaded = await config
      const mapping = Object.values(loaded.robotMappings ?? {}).find(value => value.id === robotId)
      const path = mapping ? loaded.robotTypes?.[mapping.type]?.customDataProto : undefined
      while (!disposed && currentGeneration === generation && pending.has(robotId)) {
        const update = pending.get(robotId)!
        pending.delete(robotId)
        const parsed = path ? await dependencies.parse(path, update.bytes) : null
        if (disposed || currentGeneration !== generation) return
        // The raw stream remains inspectable even when no user parser is configured.
        const value = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
        dependencies.apply(robotId, { ...value, rawBuffer: Array.from(update.bytes), receivedAt: Date.now() })
      }
    } catch (error) {
      if (currentGeneration === generation) pending.delete(robotId)
      console.error('[Custom Data Input] parsing failed', error)
    } finally {
      running.delete(robotId)
      if (!disposed && pending.has(robotId)) void drain(robotId)
    }
  }
  return {
    handle(update: CustomDataUpdate): void {
      if (disposed) return
      pending.set(update.robotId, update)
      if (!running.has(update.robotId)) void drain(update.robotId)
    },
    reset(): void { generation += 1; pending.clear() },
    dispose(): void { disposed = true; generation += 1; pending.clear() }
  }
}
