import type { BracketSlot, PreCopaDraft, Team } from '@/lib/types'
import type { ThirdAssignment } from '@/lib/bracket'

export type WizardGroup = {
  letter: string
  teams: Team[]
  matches: { id: string; home: Team; away: Team; date: string | null }[]
}

export type WizardData = {
  groups: WizardGroup[]
  template: BracketSlot[]
  matrix: Record<string, ThirdAssignment>
  surpresaTeams: Team[]
  initialDraft: PreCopaDraft
  frozen: boolean // prazo passou OU já enviado → somente leitura
  submitted: boolean
  deadline: string | null
}

export type StepId = string // 'grupo-A'..'grupo-L' | 'chaveamento' | 'finais' | 'revisao'
