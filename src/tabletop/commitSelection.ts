import type { Cognition } from './model'

const PREFIX = 'IWCOMMIT:'

export type CommitSelection = {
  strategyId: string | null
  specialId: string | null
  target: string | null
}

export function parseCommit(value: string | null | undefined): CommitSelection {
  if (!value) return { strategyId: null, specialId: null, target: null }
  if (!value.startsWith(PREFIX)) {
    return value.startsWith('SA')
      ? { strategyId: null, specialId: value, target: null }
      : { strategyId: value, specialId: null, target: null }
  }

  try {
    const parsed = JSON.parse(value.slice(PREFIX.length)) as Partial<CommitSelection>
    return {
      strategyId: typeof parsed.strategyId === 'string' ? parsed.strategyId : null,
      specialId: typeof parsed.specialId === 'string' ? parsed.specialId : null,
      target: typeof parsed.target === 'string' ? parsed.target : null,
    }
  } catch {
    return { strategyId: null, specialId: null, target: null }
  }
}

export function encodeCommit(selection: CommitSelection): string | null {
  if (!selection.strategyId && !selection.specialId) return null
  if (selection.strategyId && !selection.specialId && !selection.target) return selection.strategyId
  if (!selection.strategyId && selection.specialId && !selection.target) return selection.specialId
  return `${PREFIX}${JSON.stringify(selection)}`
}

export function cardIsCommitted(cognition: Pick<Cognition, 'selected'>, cardId: string): boolean {
  const commit = parseCommit(cognition.selected)
  return commit.strategyId === cardId || commit.specialId === cardId
}

export function committedStrategyId(cognition: Pick<Cognition, 'selected'>): string | null {
  return parseCommit(cognition.selected).strategyId
}

export function committedSpecialId(cognition: Pick<Cognition, 'selected'>): string | null {
  return parseCommit(cognition.selected).specialId
}

export function setOrdinaryCommit(current: string | null, strategyId: string | null): string | null {
  const commit = parseCommit(current)
  const target = commit.specialId === 'SA7' && commit.strategyId !== strategyId ? null : commit.target
  return encodeCommit({ ...commit, strategyId, target })
}

export function setSpecialCommit(current: string | null, specialId: string | null, target: string | null = null): string | null {
  const commit = parseCommit(current)
  return encodeCommit({ ...commit, specialId, target: specialId ? target : null })
}

export function clearCommittedCard(current: string | null, cardId: string): string | null {
  const commit = parseCommit(current)
  if (commit.strategyId === cardId) return encodeCommit({ ...commit, strategyId: null, target: commit.specialId === 'SA7' ? null : commit.target })
  if (commit.specialId === cardId) return encodeCommit({ ...commit, specialId: null, target: null })
  return current
}
