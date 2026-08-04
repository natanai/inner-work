import type { Cognition } from './model'

const PREFIX = 'IWCOMMIT:'

export type CommitSelection = {
  strategyId: string | null
  specialId: string | null
  target: string | null
  playForPrivate: boolean
}

type CommitInput = Omit<CommitSelection, 'playForPrivate'> & { playForPrivate?: boolean }

export function parseCommit(value: string | null | undefined): CommitSelection {
  if (!value) return { strategyId: null, specialId: null, target: null, playForPrivate: false }
  if (!value.startsWith(PREFIX)) {
    return value.startsWith('SA')
      ? { strategyId: null, specialId: value, target: null, playForPrivate: false }
      : { strategyId: value, specialId: null, target: null, playForPrivate: false }
  }

  try {
    const parsed = JSON.parse(value.slice(PREFIX.length)) as Partial<CommitSelection>
    return {
      strategyId: typeof parsed.strategyId === 'string' ? parsed.strategyId : null,
      specialId: typeof parsed.specialId === 'string' ? parsed.specialId : null,
      target: typeof parsed.target === 'string' ? parsed.target : null,
      playForPrivate: parsed.playForPrivate === true,
    }
  } catch {
    return { strategyId: null, specialId: null, target: null, playForPrivate: false }
  }
}

export function encodeCommit(selection: CommitInput): string | null {
  const normalized: CommitSelection = { ...selection, playForPrivate: selection.playForPrivate === true }
  if (!normalized.strategyId && !normalized.specialId) return null
  if (normalized.strategyId && !normalized.specialId && !normalized.target && !normalized.playForPrivate) return normalized.strategyId
  if (!normalized.strategyId && normalized.specialId && !normalized.target && !normalized.playForPrivate) return normalized.specialId
  return `${PREFIX}${JSON.stringify(normalized)}`
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
  const requiresStrategy = commit.specialId === 'SA2' || commit.specialId === 'SA7'
  const specialId = requiresStrategy && !strategyId ? null : commit.specialId
  const target = specialId === 'SA7' && commit.strategyId !== strategyId ? null : specialId ? commit.target : null
  const playForPrivate = specialId === 'SA2'
  return encodeCommit({ strategyId, specialId, target, playForPrivate })
}

export function setPrivateOrdinaryCommit(current: string | null, strategyId: string | null): string | null {
  const commit = parseCommit(current)
  return encodeCommit({
    strategyId,
    specialId: commit.specialId === 'SA2' ? 'SA2' : null,
    target: null,
    playForPrivate: Boolean(strategyId),
  })
}

export function setSpecialCommit(current: string | null, specialId: string | null, target: string | null = null): string | null {
  const commit = parseCommit(current)
  return encodeCommit({
    ...commit,
    specialId,
    target: specialId ? target : null,
    playForPrivate: specialId === 'SA2',
  })
}

export function clearCommittedCard(current: string | null, cardId: string): string | null {
  const commit = parseCommit(current)
  if (commit.strategyId === cardId) {
    const specialRequiresStrategy = commit.specialId === 'SA2' || commit.specialId === 'SA7'
    return encodeCommit({
      strategyId: null,
      specialId: specialRequiresStrategy ? null : commit.specialId,
      target: specialRequiresStrategy ? null : commit.target,
      playForPrivate: false,
    })
  }
  if (commit.specialId === cardId) return encodeCommit({ ...commit, specialId: null, target: null, playForPrivate: false })
  return current
}
