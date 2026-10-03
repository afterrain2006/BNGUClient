export interface Detection {
  x1: number
  y1: number
  x2: number
  y2: number
  classId: number
  className: string
  confidence: number
  team: 'red' | 'blue' | 'neutral'
}
