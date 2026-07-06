import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { ConfirmDialog } from '@/shared/components/primitives'
import { useAuth } from '@/shared/rbac/auth-context'
import { supabase } from '@/shared/lib/supabase'
import { cn } from '@/shared/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReactionRow {
  emoji: string
  user_id: string
}

interface JournalEntry {
  id: string
  author_id: string | null
  parent_id: string | null
  entry_type: 'user_note' | 'system_event'
  body: string
  customer_visible: boolean
  system_template: string | null
  deleted_at: string | null
  created_at: string
  reactions: ReactionRow[]
}

const EMOJIS = ['👍', '👎', '❤️', '🎉', '⚠️', '🔄']

const SYSTEM_STYLE: Record<string, { color: string; bg: string }> = {
  PHASE_ADVANCED: { color: 'var(--color-info)', bg: 'var(--color-info-bg)' },
  TASK_COMPLETED: {
    color: 'var(--color-success)',
    bg: 'var(--color-success-bg)',
  },
  TASK_BLOCKED: {
    color: 'var(--color-warning)',
    bg: 'var(--color-warning-bg)',
  },
  INTEGRITY_VALIDATION_PASSED: {
    color: 'var(--color-success)',
    bg: 'var(--color-success-bg)',
  },
  INTEGRITY_VALIDATION_FAILED: {
    color: 'var(--color-danger)',
    bg: 'var(--color-danger-bg)',
  },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function authorLabel(
  authorId: string | null,
  currentUserId: string | null,
  currentUserEmail: string | null,
): string {
  if (authorId && authorId === currentUserId && currentUserEmail) {
    return currentUserEmail
  }
  if (authorId) return `${authorId.slice(0, 8)}…`
  return 'Unknown'
}

function initials(label: string): string {
  const local = label.replace(/@.*/, '')
  const parts = local.split(/[._\-\s]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return local.slice(0, 2).toUpperCase() || '?'
}

function readableTemplate(template: string | null): string {
  if (!template) return 'System'
  return template
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

const TEXTAREA_CLASS =
  'w-full resize-y rounded-lg border border-gray-100 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gold focus:ring-1 focus:ring-gold'

function Composer({
  onSubmit,
  isPending,
}: {
  onSubmit: (body: string, customerVisible: boolean) => void
  isPending: boolean
}) {
  const [body, setBody] = useState('')
  const [customerVisible, setCustomerVisible] = useState(false)
  const [error, setError] = useState(false)

  const submit = () => {
    if (!body.trim()) {
      setError(true)
      return
    }
    onSubmit(body.trim(), customerVisible)
    setBody('')
    setCustomerVisible(false)
    setError(false)
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6">
      <textarea
        value={body}
        onChange={(e) => {
          setBody(e.target.value)
          if (error) setError(false)
        }}
        placeholder="Add a note…"
        className={cn(TEXTAREA_CLASS, 'min-h-[80px]')}
      />
      {error && (
        <p className="mt-1 text-xs text-danger">Note cannot be empty.</p>
      )}
      <div className="mt-3 flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-gray-700">
          <input
            type="checkbox"
            checked={customerVisible}
            onChange={(e) => setCustomerVisible(e.target.checked)}
            className="h-4 w-4 accent-gold"
          />
          Customer visible
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-navy transition-[filter] hover:brightness-95 disabled:opacity-60"
        >
          {isPending ? 'Posting…' : 'Post Note'}
        </button>
      </div>
    </div>
  )
}

function ReplyComposer({
  onSubmit,
  isPending,
}: {
  onSubmit: (body: string) => void
  isPending: boolean
}) {
  const [body, setBody] = useState('')
  return (
    <div className="mt-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a reply…"
        className={cn(TEXTAREA_CLASS, 'min-h-[56px] text-[13px]')}
      />
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={() => {
            if (body.trim()) {
              onSubmit(body.trim())
              setBody('')
            }
          }}
          disabled={isPending || !body.trim()}
          className="rounded-md bg-gold px-3 py-1.5 text-xs font-semibold text-navy transition-[filter] hover:brightness-95 disabled:opacity-60"
        >
          Reply
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Reactions
// ---------------------------------------------------------------------------

function ReactionBar({
  reactions,
  currentUserId,
  onReact,
}: {
  reactions: ReactionRow[]
  currentUserId: string | null
  onReact: (emoji: string, hasReacted: boolean) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)

  const groups = new Map<string, { count: number; mine: boolean }>()
  for (const r of reactions) {
    const g = groups.get(r.emoji) ?? { count: 0, mine: false }
    g.count += 1
    if (r.user_id === currentUserId) g.mine = true
    groups.set(r.emoji, g)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {[...groups.entries()].map(([emoji, g]) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onReact(emoji, g.mine)}
          className={cn(
            'rounded-full border px-2 py-0.5 text-xs transition-colors',
            g.mine
              ? 'border-gold bg-gold-light'
              : 'border-gray-100 bg-gray-50 hover:border-gold',
          )}
        >
          {emoji} {g.count}
        </button>
      ))}
      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className="rounded-full border border-gray-100 bg-gray-50 px-2 py-0.5 text-xs text-muted transition-colors hover:border-gold"
        >
          +
        </button>
        {pickerOpen && (
          <div className="absolute left-0 top-full z-10 mt-1 flex gap-1 rounded-lg border border-gray-100 bg-white p-1.5 shadow-lg">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onReact(emoji, groups.get(emoji)?.mine ?? false)
                  setPickerOpen(false)
                }}
                className="rounded px-1 text-base hover:bg-gray-50"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Entry rendering
// ---------------------------------------------------------------------------

function Avatar({ label, size }: { label: string; size: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-navy-light font-semibold text-gold"
      style={{ width: size, height: size, fontSize: size <= 28 ? 10 : 11 }}
    >
      {initials(label)}
    </div>
  )
}

function SystemEntry({ entry }: { entry: JournalEntry }) {
  const style = entry.system_template
    ? SYSTEM_STYLE[entry.system_template]
    : undefined
  const color = style?.color ?? 'var(--color-muted)'
  const bg = style?.bg ?? 'var(--color-gray-50)'
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <div className="flex items-center gap-2">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs"
          style={{ background: bg, color }}
        >
          ⚙
        </div>
        <span className="rounded bg-gray-50 px-1.5 py-0.5 text-[11px] font-medium text-muted">
          System
        </span>
        <span className="text-[13px] font-medium text-navy">
          {readableTemplate(entry.system_template)}
        </span>
        <span className="ml-auto text-[11.5px] text-muted">
          {timeAgo(entry.created_at)}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-gray-700">{entry.body}</p>
    </div>
  )
}

interface EntryHandlers {
  currentUserId: string | null
  currentUserEmail: string | null
  isAdmin: boolean
  onReact: (entryId: string, emoji: string, hasReacted: boolean) => void
  onReply: (parentId: string, body: string) => void
  onDelete: (entryId: string) => void
  replyPending: boolean
}

function UserEntry({
  entry,
  replies,
  handlers,
  compact = false,
}: {
  entry: JournalEntry
  replies: JournalEntry[]
  handlers: EntryHandlers
  compact?: boolean
}) {
  const [replyOpen, setReplyOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const label = authorLabel(
    entry.author_id,
    handlers.currentUserId,
    handlers.currentUserEmail,
  )
  const canDelete =
    !!handlers.currentUserId &&
    (entry.author_id === handlers.currentUserId || handlers.isAdmin)

  return (
    <div
      className={cn(
        'rounded-xl border border-gray-100 bg-white',
        compact ? 'p-3' : 'p-4',
      )}
    >
      <div className="flex items-center gap-2">
        <Avatar label={label} size={compact ? 28 : 32} />
        <span
          className={cn(
            'truncate font-medium text-navy',
            compact ? 'text-xs' : 'text-[13px]',
          )}
        >
          {label}
        </span>
        <span className="text-[11.5px] text-muted">
          {timeAgo(entry.created_at)}
        </span>
        {entry.customer_visible && (
          <span className="rounded bg-success-subtle px-1.5 py-0.5 text-[10.5px] font-medium text-success">
            Customer Visible
          </span>
        )}
      </div>

      <p
        className={cn(
          'mt-2 leading-relaxed text-gray-700',
          compact ? 'text-[13px]' : 'text-sm',
        )}
      >
        {entry.body}
      </p>

      {!compact && (
        <>
          <div className="mt-3 flex items-center gap-3">
            <ReactionBar
              reactions={entry.reactions}
              currentUserId={handlers.currentUserId}
              onReact={(emoji, hasReacted) =>
                handlers.onReact(entry.id, emoji, hasReacted)
              }
            />
            <button
              type="button"
              onClick={() => setReplyOpen((v) => !v)}
              className="text-xs text-muted transition-colors hover:text-navy"
            >
              Reply
            </button>
            {canDelete && (
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="text-xs text-muted transition-colors hover:text-danger"
              >
                Delete
              </button>
            )}
          </div>

          {replyOpen && (
            <ReplyComposer
              isPending={handlers.replyPending}
              onSubmit={(body) => {
                handlers.onReply(entry.id, body)
                setReplyOpen(false)
              }}
            />
          )}

          {replies.length > 0 && (
            <div className="mt-3 flex flex-col gap-2 border-l-2 border-gray-50 pl-4">
              {replies.map((reply) => (
                <UserEntry
                  key={reply.id}
                  entry={reply}
                  replies={[]}
                  handlers={handlers}
                  compact
                />
              ))}
            </div>
          )}
        </>
      )}

      {compact && canDelete && (
        <div className="mt-1.5">
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="text-[11px] text-muted transition-colors hover:text-danger"
          >
            Delete
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Delete note"
        description="This note will be removed from the journal. This cannot be undone."
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={() => {
          handlers.onDelete(entry.id)
          setConfirmOpen(false)
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}

function Tombstone({
  replies,
  handlers,
}: {
  replies: JournalEntry[]
  handlers: EntryHandlers
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <p className="text-sm italic text-muted">[Deleted]</p>
      {replies.length > 0 && (
        <div className="mt-3 flex flex-col gap-2 border-l-2 border-gray-50 pl-4">
          {replies.map((reply) => (
            <UserEntry
              key={reply.id}
              entry={reply}
              replies={[]}
              handlers={handlers}
              compact
            />
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-6 py-14 text-center">
      <div className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      </div>
      <div className="mb-1.5 text-sm font-semibold text-gray-700">
        No notes yet
      </div>
      <div className="text-[13px] text-muted">Add the first note above</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab
// ---------------------------------------------------------------------------

export function PropertyJournalTab({ propertyId }: { propertyId: string }) {
  const queryClient = useQueryClient()
  const { user, role } = useAuth()
  const currentUserId = user?.id ?? null
  const currentUserEmail = user?.email ?? null
  const isAdmin = role === 'admin'

  const entriesQuery = useQuery({
    queryKey: ['journal', propertyId],
    queryFn: async (): Promise<JournalEntry[]> => {
      const { data, error } = await supabase
        .from('journal_entries')
        .select(
          'id, author_id, parent_id, entry_type, body, customer_visible, system_template, deleted_at, created_at, reactions:journal_entry_reactions(emoji, user_id)',
        )
        .eq('property_id', propertyId)
      if (error) throw error
      return (data ?? []) as unknown as JournalEntry[]
    },
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['journal', propertyId] })

  const postNote = useMutation({
    mutationFn: async ({
      body,
      customerVisible,
      parentId,
    }: {
      body: string
      customerVisible: boolean
      parentId: string | null
    }) => {
      if (!currentUserId) throw new Error('You must be signed in to post.')
      const { error } = await supabase.from('journal_entries').insert({
        property_id: propertyId,
        author_id: currentUserId,
        entry_type: 'user_note',
        body,
        customer_visible: customerVisible,
        parent_id: parentId,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const toggleReaction = useMutation({
    mutationFn: async ({
      entryId,
      emoji,
      hasReacted,
    }: {
      entryId: string
      emoji: string
      hasReacted: boolean
    }) => {
      if (!currentUserId) throw new Error('You must be signed in to react.')
      if (hasReacted) {
        const { error } = await supabase
          .from('journal_entry_reactions')
          .delete()
          .eq('entry_id', entryId)
          .eq('user_id', currentUserId)
          .eq('emoji', emoji)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('journal_entry_reactions')
          .insert({ entry_id: entryId, user_id: currentUserId, emoji })
        if (error) throw error
      }
    },
    onSuccess: invalidate,
  })

  const deleteEntry = useMutation({
    // Soft delete: sets deleted_at (covered by the journal_entries UPDATE policy).
    // Entries with replies render as a tombstone; entries without replies drop out.
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from('journal_entries')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', entryId)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const handlers: EntryHandlers = {
    currentUserId,
    currentUserEmail,
    isAdmin,
    replyPending: postNote.isPending,
    onReact: (entryId, emoji, hasReacted) =>
      toggleReaction.mutate({ entryId, emoji, hasReacted }),
    onReply: (parentId, body) =>
      postNote.mutate({ body, customerVisible: false, parentId }),
    onDelete: (entryId) => deleteEntry.mutate(entryId),
  }

  const all = entriesQuery.data ?? []
  const repliesByParent = new Map<string, JournalEntry[]>()
  for (const e of all) {
    if (e.parent_id && !e.deleted_at) {
      const list = repliesByParent.get(e.parent_id) ?? []
      list.push(e)
      repliesByParent.set(e.parent_id, list)
    }
  }
  for (const list of repliesByParent.values()) {
    list.sort((a, b) => a.created_at.localeCompare(b.created_at))
  }

  const topLevel = all
    .filter((e) => e.parent_id === null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  const visible = topLevel.filter((e) => {
    if (!e.deleted_at) return true
    // deleted top-level: keep only as a tombstone when it still has replies
    return (repliesByParent.get(e.id)?.length ?? 0) > 0
  })

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-4">
      <Composer
        isPending={postNote.isPending}
        onSubmit={(body, customerVisible) =>
          postNote.mutate({ body, customerVisible, parentId: null })
        }
      />

      {entriesQuery.isLoading ? (
        <div className="flex flex-col gap-2">
          <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
          <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((entry) => {
            const replies = repliesByParent.get(entry.id) ?? []
            if (entry.deleted_at) {
              return (
                <Tombstone
                  key={entry.id}
                  replies={replies}
                  handlers={handlers}
                />
              )
            }
            if (entry.entry_type === 'system_event') {
              return <SystemEntry key={entry.id} entry={entry} />
            }
            return (
              <UserEntry
                key={entry.id}
                entry={entry}
                replies={replies}
                handlers={handlers}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
