'use client'

import { useEffect, useMemo, useReducer, useRef, useState, useTransition } from 'react'
import { WizardStepper } from './WizardStepper'
import { GroupStep } from './GroupStep'
import { ThirdsStep } from './ThirdsStep'
import { BracketStep } from './BracketStep'
import { FinaisStep } from './FinaisStep'
import { RevisaoStep } from './RevisaoStep'
import { computeGroupStandings } from '@/lib/standings'
import {
  computeBracketSlots,
  deriveFinais,
  detectStale,
  prunePicks,
  rankAllThirds,
  seedR32,
} from '@/lib/bracket'
import { salvarRascunhoPreCopa, enviarPreCopa, reabrirPreCopa } from '@/actions/preCopa'
import type { GroupMatchScore, PreCopaDraft, StandingRow, Team } from '@/lib/types'
import type { StepId, WizardData } from './types'

type Scores = Record<string, { casa: number | null; fora: number | null }>
type State = { scores: Scores; bracket: Record<string, string>; surpresa: string | null }

type Action =
  | { type: 'SET_SCORE'; id: string; casa: number | null; fora: number | null }
  | { type: 'SET_BRACKET'; bracket: Record<string, string> }
  | { type: 'SET_SURPRESA'; team: string }
  | { type: 'HYDRATE'; state: State }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_SCORE':
      return { ...state, scores: { ...state.scores, [action.id]: { casa: action.casa, fora: action.fora } } }
    case 'SET_BRACKET':
      return { ...state, bracket: action.bracket }
    case 'SET_SURPRESA':
      return { ...state, surpresa: action.team }
    case 'HYDRATE':
      return action.state
    default:
      return state
  }
}

const LS_KEY = 'precopa-draft'

export function PreCopaWizard({ data, initialStep }: { data: WizardData; initialStep: StepId }) {
  const stepsOrder: StepId[] = useMemo(
    () => [...data.groups.map((g) => `grupo-${g.letter}`), 'terceiros', 'chaveamento', 'finais', 'revisao'],
    [data.groups],
  )

  const [step, setStep] = useState<StepId>(
    stepsOrder.includes(initialStep) ? initialStep : stepsOrder[0],
  )
  const [submitted, setSubmitted] = useState(data.submitted)
  const frozen = data.frozen || submitted

  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const init: State = {
      scores: { ...data.initialDraft.scores },
      bracket: { ...data.initialDraft.bracket },
      surpresa: data.initialDraft.finais.surpresa,
    }
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(LS_KEY)
        if (raw) {
          const local = JSON.parse(raw) as State
          // server vence em dados completos; local recupera placares parciais
          init.scores = { ...local.scores, ...init.scores }
        }
      } catch {
        /* ignore */
      }
    }
    return init
  })

  // ── Metadados de times (nome → escudo) ──
  const teamsMeta = useMemo(() => {
    const m: Record<string, Team> = {}
    for (const g of data.groups) for (const t of g.teams) m[t.name] = t
    for (const t of data.surpresaTeams) m[t.name] = m[t.name] ?? t
    return m
  }, [data.groups, data.surpresaTeams])

  // ── Classificação derivada por grupo (recalcula a cada placar) ──
  const standingsByGroup = useMemo(() => {
    const out: Record<string, StandingRow[]> = {}
    for (const g of data.groups) {
      const teams = g.teams.map((t) => t.name)
      const matches: GroupMatchScore[] = g.matches.map((mt) => {
        const s = state.scores[mt.id]
        return { home: mt.home.name, away: mt.away.name, homeGoals: s?.casa ?? null, awayGoals: s?.fora ?? null }
      })
      out[g.letter] = computeGroupStandings(teams, matches)
    }
    return out
  }, [data.groups, state.scores])

  // ── Quantos 3ºs avançam (nº de slots de 3º no template do R32) ──
  const thirdAdvanceCount = useMemo(() => {
    let n = 0
    for (const s of data.template) {
      if (s.round !== 'R32') continue
      if (s.source_home?.trim().toUpperCase().startsWith('3')) n++
      if (s.source_away?.trim().toUpperCase().startsWith('3')) n++
    }
    return n || 8
  }, [data.template])

  // ── Ranking ao vivo dos 3ºs colocados (aba "3 Lugares") ──
  const rankedThirds = useMemo(
    () => rankAllThirds(standingsByGroup, thirdAdvanceCount),
    [standingsByGroup, thirdAdvanceCount],
  )

  // ── Semeadura do R32 a partir da classificação ──
  const { r32, matrixHit } = useMemo(
    () => seedR32(standingsByGroup, data.template, data.matrix),
    [standingsByGroup, data.template, data.matrix],
  )

  const slots = useMemo(
    () => computeBracketSlots(data.template, r32, state.bracket),
    [data.template, r32, state.bracket],
  )
  const staleSet = useMemo(() => detectStale(slots, state.bracket), [slots, state.bracket])
  const derivedFinais = useMemo(
    () => deriveFinais(data.template, slots, state.bracket),
    [data.template, slots, state.bracket],
  )

  // Poda automática quando a semeadura muda (placar alterou a classificação).
  useEffect(() => {
    if (frozen) return
    const pruned = prunePicks(data.template, r32, state.bracket)
    if (Object.keys(pruned).length !== Object.keys(state.bracket).length) {
      dispatch({ type: 'SET_BRACKET', bracket: pruned })
    }
  }, [r32, data.template, state.bracket, frozen])

  // ── Payload corrente (campeão/vice/3º vêm da chave; surpresa é independente) ──
  const payload: PreCopaDraft = useMemo(
    () => ({
      scores: state.scores,
      bracket: state.bracket,
      finais: {
        campeao: derivedFinais.campeao,
        vice: derivedFinais.vice,
        terceiro: derivedFinais.terceiro,
        surpresa: state.surpresa,
      },
    }),
    [state.scores, state.bracket, derivedFinais, state.surpresa],
  )
  const payloadRef = useRef(payload)
  payloadRef.current = payload

  // ── Autosave (debounce) + mirror localStorage ──
  const [, startSave] = useTransition()
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const firstRender = useRef(true)

  function flushSave() {
    if (frozen) return
    setSaveState('saving')
    startSave(async () => {
      const res = await salvarRascunhoPreCopa(payloadRef.current)
      setSaveState(res.ok ? 'saved' : 'error')
    })
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(LS_KEY, JSON.stringify(state))
      } catch {
        /* ignore */
      }
    }
    if (frozen) return
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    const t = setTimeout(flushSave, 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  // ── Navegação ──
  function goStep(s: StepId) {
    if (!frozen) flushSave()
    setStep(s)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('step', s)
      window.history.replaceState(null, '', url.toString())
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const idx = stepsOrder.indexOf(step)
  const goPrev = () => idx > 0 && goStep(stepsOrder[idx - 1])
  const goNext = () => idx < stepsOrder.length - 1 && goStep(stepsOrder[idx + 1])

  // ── Bracket pick (com poda em cascata) ──
  function onPick(slotKey: string, team: string) {
    if (frozen) return
    const pruned = prunePicks(data.template, r32, { ...state.bracket, [slotKey]: team })
    dispatch({ type: 'SET_BRACKET', bracket: pruned })
  }

  // ── Completude ──
  const scoresTotal = data.groups.reduce((n, g) => n + g.matches.length, 0)
  const scoresFilled = data.groups.reduce(
    (n, g) => n + g.matches.filter((m) => { const s = state.scores[m.id]; return s && s.casa != null && s.fora != null }).length,
    0,
  )
  const groupDone = useMemo(() => {
    const out: Record<string, boolean> = {}
    for (const g of data.groups) {
      out[g.letter] = g.matches.every((m) => { const s = state.scores[m.id]; return s && s.casa != null && s.fora != null })
    }
    return out
  }, [data.groups, state.scores])
  const bracketDone = data.template.filter((s) => state.bracket[s.slot_key]).length
  const bracketTotal = data.template.length
  const finaisDone = !!(derivedFinais.campeao && derivedFinais.vice && derivedFinais.terceiro && state.surpresa)

  // ── Envio final ──
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState<string | null>(null)
  function onSubmit() {
    setSubmitting(true)
    setSubmitMsg(null)
    startSave(async () => {
      const res = await enviarPreCopa(payloadRef.current)
      setSubmitting(false)
      if (res.ok) {
        setSubmitted(true)
        try {
          window.localStorage.removeItem(LS_KEY)
        } catch {
          /* ignore */
        }
      } else {
        setSubmitMsg(res.message)
      }
    })
  }

  // ── Reabrir para edição (só antes do prazo) ──
  const [reopening, setReopening] = useState(false)
  function onReabrir() {
    setReopening(true)
    setSubmitMsg(null)
    startSave(async () => {
      const res = await reabrirPreCopa()
      setReopening(false)
      if (res.ok) {
        setSubmitted(false)
      } else {
        setSubmitMsg(res.message)
      }
    })
  }

  // ── Render do passo atual ──
  let body: React.ReactNode = null
  if (step.startsWith('grupo-')) {
    const letter = step.slice('grupo-'.length)
    const gIndex = data.groups.findIndex((g) => g.letter === letter)
    const group = data.groups[gIndex]
    if (group) {
      const isLast = gIndex === data.groups.length - 1
      body = (
        <GroupStep
          group={group}
          index={gIndex}
          total={data.groups.length}
          rows={standingsByGroup[letter] ?? []}
          teamsMeta={teamsMeta}
          scores={state.scores}
          onScore={(id, casa, fora) => dispatch({ type: 'SET_SCORE', id, casa, fora })}
          disabled={frozen}
          onPrev={gIndex > 0 ? goPrev : undefined}
          onNext={goNext}
          nextLabel={isLast ? 'Ver 3ºs colocados →' : 'Próximo grupo →'}
        />
      )
    }
  } else if (step === 'terceiros') {
    body = (
      <ThirdsStep
        ranked={rankedThirds}
        advanceCount={thirdAdvanceCount}
        teamsMeta={teamsMeta}
        groupsComplete={data.groups.every((g) => groupDone[g.letter])}
        onPrev={goPrev}
        onNext={goNext}
      />
    )
  } else if (step === 'chaveamento') {
    body = (
      <BracketStep
        template={data.template}
        slots={slots}
        picks={state.bracket}
        teamsMeta={teamsMeta}
        onPick={onPick}
        staleSet={staleSet}
        matrixHit={matrixHit}
        disabled={frozen}
        onPrev={goPrev}
        onNext={goNext}
      />
    )
  } else if (step === 'finais') {
    body = (
      <FinaisStep
        campeao={derivedFinais.campeao}
        vice={derivedFinais.vice}
        terceiro={derivedFinais.terceiro}
        surpresa={state.surpresa}
        surpresaTeams={data.surpresaTeams}
        teamsMeta={teamsMeta}
        onSurpresa={(team) => dispatch({ type: 'SET_SURPRESA', team })}
        disabled={frozen}
        onPrev={goPrev}
        onNext={goNext}
        onEditChave={() => goStep('chaveamento')}
      />
    )
  } else if (step === 'revisao') {
    body = (
      <RevisaoStep
        scoresFilled={scoresFilled}
        scoresTotal={scoresTotal}
        bracketDone={bracketDone}
        bracketTotal={bracketTotal}
        finaisDone={finaisDone}
        deadline={data.deadline}
        frozen={data.frozen}
        submitted={submitted}
        submitting={submitting}
        reopening={reopening}
        message={submitMsg}
        onSubmit={onSubmit}
        onReabrir={onReabrir}
        onPrev={goPrev}
      />
    )
  }

  return (
    <div className="pb-8">
      {frozen && !submitted && (
        <div className="mb-5 rounded-xl border border-white/10 bg-surface px-4 py-2.5 text-center font-sans text-xs uppercase tracking-[0.15em] text-cream/55">
          🔒 Pré-Copa congelada — somente leitura
        </div>
      )}

      <WizardStepper
        groups={data.groups.map((g) => g.letter)}
        step={step}
        onStep={goStep}
        groupDone={groupDone}
        terceirosDone={data.groups.every((g) => groupDone[g.letter])}
        bracketDone={bracketDone === bracketTotal}
        finaisDone={finaisDone}
      />

      {body}

      {/* Indicador de autosave */}
      {!frozen && (
        <p className="mt-4 text-center font-sans text-[11px] uppercase tracking-[0.15em] text-cream/35">
          {saveState === 'saving'
            ? 'Salvando…'
            : saveState === 'saved'
              ? 'Rascunho salvo ✓'
              : saveState === 'error'
                ? 'Falha ao salvar — tente de novo'
                : 'Rascunho automático ativo'}
        </p>
      )}
    </div>
  )
}

export default PreCopaWizard
