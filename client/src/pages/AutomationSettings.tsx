import { useState, type FormEvent } from "react";
import { Bot, Play, Plus, Trash2 } from "lucide-react";
import {
  useAutomationRules,
  useCreateAutomationRule,
  useDeleteAutomationRule,
  useRunAutomationNow,
  useUpdateAutomationRule,
} from "../hooks/queries";
import type { AutomationRule, RuleAnchor, ServiceTierType, TaskType } from "../types";
import { ALL_TIERS, TASK_TYPE_LABELS, TIER_LABELS } from "../lib/format";
import { ConfirmModal } from "../components/ConfirmModal";
import { SlideOverPanel } from "../components/SlideOverPanel";
import { TierBadge } from "../components/TierBadge";
import { Button, Card, EmptyState, ErrorNotice, Field, Skeleton } from "../components/ui";

const ANCHOR_LABELS: Record<RuleAnchor, string> = {
  TIER_CHANGE: "Tier change (or website launch)",
  RETAINER_START: "Retainer start date",
  RETAINER_END: "Retainer end date",
};

/**
 * The pieces of a rule row, shared by the mobile list and the desktop table so
 * the two presentations can never disagree about what a rule says.
 */
function RuleTrigger({ rule }: { rule: AutomationRule }) {
  return (
    <>
      {rule.triggerTier ? (
        <TierBadge tier={rule.triggerTier} />
      ) : (
        <span className="text-xs text-ink/70">Any tier</span>
      )}
      {rule.requiresActiveRetainer && (
        <p className="mt-1 text-xs text-ink/65">Needs active retainer</p>
      )}
    </>
  );
}

function RuleTiming({ rule }: { rule: AutomationRule }) {
  return (
    <>
      {rule.repeatEveryDays ? (
        <>every {rule.repeatEveryDays} days</>
      ) : rule.daysAfterTrigger < 0 ? (
        <>{Math.abs(rule.daysAfterTrigger)} days before</>
      ) : (
        <>{rule.daysAfterTrigger} days after</>
      )}
      <p className="text-xs text-ink/65">{ANCHOR_LABELS[rule.anchor]}</p>
    </>
  );
}

function RuleToggle({ rule, onToggle }: { rule: AutomationRule; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={rule.isActive}
      aria-label={`${rule.isActive ? "Disable" : "Enable"} ${rule.name}`}
      onClick={onToggle}
      // The switch itself stays 36x20 for visual weight; the padding around it
      // is what makes the target 44px on touch.
      className="inline-flex h-11 w-11 items-center justify-center lg:h-auto lg:w-auto"
    >
      <span
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          rule.isActive ? "bg-success" : "bg-fill/40"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-content transition-transform ${
            rule.isActive ? "translate-x-[1.15rem]" : "translate-x-1"
          }`}
        />
      </span>
    </button>
  );
}

export function AutomationSettings() {
  const rulesQuery = useAutomationRules();
  const updateRule = useUpdateAutomationRule();
  const deleteRule = useDeleteAutomationRule();
  const runNow = useRunAutomationNow();

  const [editing, setEditing] = useState<AutomationRule | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<AutomationRule | null>(null);
  const [runResult, setRunResult] = useState<string | null>(null);

  const handleRunNow = async () => {
    const result = await runNow.mutateAsync();
    setRunResult(
      result.tasksCreated.length === 0
        ? "No new tasks — everything already has a reminder open or isn't due yet."
        : `Created ${result.tasksCreated.length} task${result.tasksCreated.length === 1 ? "" : "s"}.`
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Automation Rules</h1>
          <p className="max-w-2xl text-sm text-ink/70">
            These rules run every morning and create the reminder tasks so nobody has to remember
            them. Change the timing here — no code deploy needed.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleRunNow} loading={runNow.isPending}>
            <Play className="h-4 w-4" aria-hidden />
            Run now
          </Button>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            New Rule
          </Button>
        </div>
      </div>

      {runResult && (
        <div className="flex items-start gap-2 rounded-lg border border-accent/30 bg-accent/10 p-3 text-sm text-accent">
          <Bot className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1">{runResult}</span>
          <button
            type="button"
            onClick={() => setRunResult(null)}
            className="text-xs font-medium text-accent hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {rulesQuery.isError && (
        <ErrorNotice
          message={(rulesQuery.error as Error).message}
          onRetry={() => rulesQuery.refetch()}
        />
      )}

      {rulesQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : (rulesQuery.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Bot className="h-8 w-8" />}
          title="No automation rules"
          description="Without rules, nothing reminds you to pitch the next rung of the ladder."
          action={<Button onClick={() => setCreating(true)}>Create a rule</Button>}
        />
      ) : (
        <>
          {/*
            This table's min-content width is ~890px: six columns, and the rule
            name and template can't compress. On a 390px screen no amount of
            overflow-x on the wrapper makes that readable — it just produces a
            page that scrolls sideways. Small screens get a stacked list of the
            same fields instead. The table starts at lg, not md: a tablet is
            768px wide, still narrower than the table needs.
          */}
          <ul className="space-y-3 lg:hidden">
            {rulesQuery.data?.map((rule) => (
              <li key={rule.id} className={`card p-4 ${rule.isActive ? "" : "opacity-60"}`}>
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(rule)}
                    className="min-h-11 flex-1 text-left text-sm font-medium text-ink"
                  >
                    {rule.name}
                  </button>
                  <RuleToggle
                    rule={rule}
                    onToggle={() =>
                      updateRule.mutate({ id: rule.id, data: { isActive: !rule.isActive } })
                    }
                  />
                </div>

                <p className="text-xs text-ink/65">{rule.taskTitleTemplate}</p>

                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <div className="min-w-0">
                    <dt className="text-xs text-ink/65">Trigger</dt>
                    <dd className="mt-0.5">
                      <RuleTrigger rule={rule} />
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-ink/65">Timing</dt>
                    <dd className="mt-0.5 text-ink/70">
                      <RuleTiming rule={rule} />
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-ink/65">Task type</dt>
                    <dd className="mt-0.5 text-ink/70">{TASK_TYPE_LABELS[rule.taskType]}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-ink/65">Tasks generated</dt>
                    <dd className="mt-0.5 text-ink/70">{rule._count?.generatedTasks ?? 0}</dd>
                  </div>
                </dl>

                <div className="mt-3 flex justify-end border-t border-separator/50 pt-1">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(rule)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink/70 hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <Card className="hidden overflow-x-auto lg:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-separator/70 bg-fill/8 text-xs uppercase tracking-wide text-ink/70">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Rule</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Trigger</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Timing</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Task type</th>
                <th scope="col" className="px-4 py-2.5 text-center font-medium">Active</th>
                <th scope="col" className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-separator/50">
              {rulesQuery.data?.map((rule) => (
                <tr key={rule.id} className={rule.isActive ? "" : "opacity-50"}>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setEditing(rule)}
                      className="text-left font-medium text-ink hover:text-accent"
                    >
                      {rule.name}
                    </button>
                    {/* line-clamp rather than truncate: `truncate` sets
                        white-space:nowrap, so the cell's min-content width
                        becomes the full template string and the column refuses
                        to compress. Clamping to one line ellipsises the same way
                        while letting the column shrink. */}
                    <p className="mt-0.5 line-clamp-1 max-w-md text-xs text-ink/65">
                      {rule.taskTitleTemplate}
                    </p>
                    {(rule._count?.generatedTasks ?? 0) > 0 && (
                      <p className="mt-0.5 text-xs text-ink/65">
                        {rule._count?.generatedTasks} task
                        {rule._count?.generatedTasks === 1 ? "" : "s"} generated
                      </p>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <RuleTrigger rule={rule} />
                  </td>

                  <td className="px-4 py-3 text-ink/70">
                    <RuleTiming rule={rule} />
                  </td>

                  <td className="px-4 py-3 text-ink/70">{TASK_TYPE_LABELS[rule.taskType]}</td>

                  <td className="px-4 py-3 text-center">
                    <RuleToggle
                      rule={rule}
                      onToggle={() =>
                        updateRule.mutate({ id: rule.id, data: { isActive: !rule.isActive } })
                      }
                    />
                  </td>

                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(rule)}
                      className="rounded p-2 text-ink/55 hover:bg-danger/10 hover:text-danger"
                      aria-label={`Delete ${rule.name}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </Card>
        </>
      )}

      <RulePanel
        key={editing?.id ?? "new"}
        open={creating || editing !== null}
        rule={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />

      <ConfirmModal
        open={confirmDelete !== null}
        title={`Delete "${confirmDelete?.name}"?`}
        tone="danger"
        confirmLabel="Delete rule"
        loading={deleteRule.isPending}
        body="Tasks this rule already created stay put. If you just want it to stop firing, switch it off instead."
        onConfirm={async () => {
          if (confirmDelete) await deleteRule.mutateAsync(confirmDelete.id);
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function RulePanel({
  open,
  rule,
  onClose,
}: {
  open: boolean;
  rule: AutomationRule | null;
  onClose: () => void;
}) {
  const isEdit = rule !== null;
  const createRule = useCreateAutomationRule();
  const updateRule = useUpdateAutomationRule();

  const [name, setName] = useState(rule?.name ?? "");
  const [triggerTier, setTriggerTier] = useState<string>(rule?.triggerTier ?? "");
  const [anchor, setAnchor] = useState<RuleAnchor>(rule?.anchor ?? "TIER_CHANGE");
  const [daysAfterTrigger, setDaysAfterTrigger] = useState(String(rule?.daysAfterTrigger ?? 30));
  const [repeatEveryDays, setRepeatEveryDays] = useState(
    rule?.repeatEveryDays !== null && rule?.repeatEveryDays !== undefined
      ? String(rule.repeatEveryDays)
      : ""
  );
  const [requiresActiveRetainer, setRequiresActiveRetainer] = useState(
    rule?.requiresActiveRetainer ?? false
  );
  const [taskTitleTemplate, setTaskTitleTemplate] = useState(rule?.taskTitleTemplate ?? "");
  const [taskType, setTaskType] = useState<TaskType>(rule?.taskType ?? "AUTO_UPSELL_PITCH");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload = {
      name: name.trim(),
      triggerTier: triggerTier ? (triggerTier as ServiceTierType) : null,
      anchor,
      daysAfterTrigger: Number(daysAfterTrigger),
      repeatEveryDays: repeatEveryDays ? Number(repeatEveryDays) : null,
      requiresActiveRetainer,
      taskTitleTemplate: taskTitleTemplate.trim(),
      taskType,
    };

    try {
      if (isEdit && rule) {
        await updateRule.mutateAsync({ id: rule.id, data: payload });
      } else {
        await createRule.mutateAsync(payload);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the rule");
    }
  };

  return (
    <SlideOverPanel
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit rule" : "New automation rule"}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="rule-form"
            loading={createRule.isPending || updateRule.isPending}
            disabled={name.trim().length === 0 || taskTitleTemplate.trim().length === 0}
          >
            {isEdit ? "Save rule" : "Create rule"}
          </Button>
        </div>
      }
    >
      <form id="rule-form" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Rule name" htmlFor="rule-name">
          <input
            id="rule-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Pitch Brand Curation"
            autoFocus
          />
        </Field>

        <Field
          label="Trigger tier"
          htmlFor="rule-tier"
          hint="Leave on “Any tier” for rules driven by a retainer rather than a ladder rung."
        >
          <select
            id="rule-tier"
            className="input"
            value={triggerTier}
            onChange={(e) => setTriggerTier(e.target.value)}
          >
            <option value="">Any tier</option>
            {ALL_TIERS.map((tier) => (
              <option key={tier} value={tier}>
                {TIER_LABELS[tier]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Count days from" htmlFor="rule-anchor">
          <select
            id="rule-anchor"
            className="input"
            value={anchor}
            onChange={(e) => setAnchor(e.target.value as RuleAnchor)}
          >
            {(Object.keys(ANCHOR_LABELS) as RuleAnchor[]).map((option) => (
              <option key={option} value={option}>
                {ANCHOR_LABELS[option]}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Days after trigger"
          htmlFor="rule-days"
          hint={
            anchor === "RETAINER_END"
              ? "Use a negative number to fire before the retainer expires (e.g. -14)."
              : "How long to wait before the task appears."
          }
        >
          <input
            id="rule-days"
            type="number"
            className="input"
            value={daysAfterTrigger}
            onChange={(e) => setDaysAfterTrigger(e.target.value)}
          />
        </Field>

        <Field
          label="Repeat every (days)"
          htmlFor="rule-repeat"
          hint="Optional. Set 90 for a quarterly check-in that keeps coming back."
        >
          <input
            id="rule-repeat"
            type="number"
            min="1"
            className="input"
            value={repeatEveryDays}
            onChange={(e) => setRepeatEveryDays(e.target.value)}
          />
        </Field>

        <label className="flex items-center gap-2 text-sm text-ink/80">
          <input
            type="checkbox"
            checked={requiresActiveRetainer}
            onChange={(e) => setRequiresActiveRetainer(e.target.checked)}
            className="h-4 w-4 rounded border-separator text-accent"
          />
          Only fire for clients with an active retainer
        </label>

        <Field
          label="Task title template"
          htmlFor="rule-template"
          hint="Placeholders: {{businessName}} and {{tier}}"
        >
          <input
            id="rule-template"
            className="input"
            value={taskTitleTemplate}
            onChange={(e) => setTaskTitleTemplate(e.target.value)}
            placeholder="Pitch brand curation package to {{businessName}}"
          />
        </Field>

        <Field label="Task type" htmlFor="rule-task-type">
          <select
            id="rule-task-type"
            className="input"
            value={taskType}
            onChange={(e) => setTaskType(e.target.value as TaskType)}
          >
            {(Object.keys(TASK_TYPE_LABELS) as TaskType[]).map((option) => (
              <option key={option} value={option}>
                {TASK_TYPE_LABELS[option]}
              </option>
            ))}
          </select>
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </SlideOverPanel>
  );
}
