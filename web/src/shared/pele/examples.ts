import officialExamples from './officialExamples.json'

export interface PeleExample {
  label: string
  source: string
}

export interface PeleExampleGroup {
  type: string
  title: string
  label: string
  beta: boolean
  representativeIndex: number
  examples: PeleExample[]
}

export const PELE_EXAMPLE_GROUPS = officialExamples as PeleExampleGroup[]
