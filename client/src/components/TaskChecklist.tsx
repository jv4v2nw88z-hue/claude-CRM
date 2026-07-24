import { useMemo } from "react";
import { CheckCircle2 } from "lucide-react";
import type { Task } from "../types";
import { daysFromToday } from "../lib/format";
import { TaskChecklistItem } from "./TaskChecklistItem";
import { EmptyState } from "./ui";

interface TaskChecklistProps {
  tasks: Task[];
  onComplete: (taskId: string) => void;
  onSnooze?: (taskId: string) => void;
  showClient?: boolean;
  grouped?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

type GroupKey = "Overdue" | "Today" | "This week" | "Later" | "No due date" | "Completed";

const GROUP_ORDER: GroupKey[] = [
  "Overdue",
  "Today",
  "This week",
  "Later",
  "No due date",
  "Completed",
];

function groupFor(task: Task): GroupKey {
  if (task.status === "DONE") return "Completed";
  if (!task.dueDate) return "No due date";
  const days = daysFromToday(task.dueDate);
  if (days < 0) return "Overdue";
  if (days === 0) return "Today";
  if (days <= 7) return "This week";
  return "Later";
}

export function TaskChecklist({
  tasks,
  onComplete,
  onSnooze,
  showClient = true,
  grouped = true,
  emptyTitle = "Nothing on the list",
  emptyDescription = "No open tasks match this view.",
}: TaskChecklistProps) {
  const groups = useMemo(() => {
    const map = new Map<GroupKey, Task[]>();
    for (const task of tasks) {
      const key = grouped ? groupFor(task) : task.status === "DONE" ? "Completed" : "Later";
      const bucket = map.get(key) ?? [];
      bucket.push(task);
      map.set(key, bucket);
    }
    return GROUP_ORDER.filter((key) => map.has(key)).map((key) => ({
      key,
      tasks: map.get(key) ?? [],
    }));
  }, [tasks, grouped]);

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle2 className="h-8 w-8" />}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  if (!grouped) {
    return (
      <ul className="space-y-2">
        {tasks.map((task) => (
          <TaskChecklistItem
            key={task.id}
            task={task}
            onComplete={onComplete}
            onSnooze={onSnooze}
            showClient={showClient}
          />
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.key}>
          <h3
            className={
              group.key === "Overdue"
                ? "mb-2 text-xs font-semibold uppercase tracking-wide text-red-600"
                : "mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400"
            }
          >
            {group.key}
            <span className="ml-1.5 font-normal normal-case tracking-normal">
              ({group.tasks.length})
            </span>
          </h3>
          <ul className="space-y-2">
            {group.tasks.map((task) => (
              <TaskChecklistItem
                key={task.id}
                task={task}
                onComplete={onComplete}
                onSnooze={onSnooze}
                showClient={showClient}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
