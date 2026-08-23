import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatMeetingDate } from "@/lib/utils";
import type { Meeting, Task } from "@/types";

interface TasksPanelProps {
  employeeId: string;
  /** Meeting capture: origin on add, close-stamp on complete. Omit on the person overview. */
  meetingId?: string;
  meetings: Meeting[];
  tasks: Task[];
  onChange: (tasks: Task[]) => void;
}

async function readError(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error ?? fallback;
}

function sortPersonTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const aDone = a.completedAt ? 1 : 0;
    const bDone = b.completedAt ? 1 : 0;
    if (aDone !== bDone) {
      return aDone - bDone;
    }
    const aPlanned = a.plannedDate ?? "9999-12-31";
    const bPlanned = b.plannedDate ?? "9999-12-31";
    if (aPlanned !== bPlanned) {
      return aPlanned.localeCompare(bPlanned);
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
}

function taskHint(task: Task, meetingsById: Map<string, Meeting>): string | null {
  if (task.completedMeetingId) {
    const closedIn = meetingsById.get(task.completedMeetingId);
    return closedIn ? `Closed in ${formatMeetingDate(closedIn.meetingDate)}` : "Closed in a meeting";
  }
  if (task.meetingId) {
    const origin = meetingsById.get(task.meetingId);
    return origin ? `From ${formatMeetingDate(origin.meetingDate)}` : null;
  }
  return null;
}

export function TasksPanel({ employeeId, meetingId, meetings, tasks, onChange }: TasksPanelProps) {
  const [title, setTitle] = useState("");
  const [plannedDate, setPlannedDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const meetingsById = useMemo(() => new Map(meetings.map((meeting) => [meeting.id, meeting])), [meetings]);
  const openTasks = tasks.filter((task) => task.completedAt == null);
  const closedTasks = tasks.filter((task) => task.completedAt != null);
  const showFollowUpSections = Boolean(meetingId);

  async function handleAdd() {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Title is required");
      return;
    }
    if (isAdding) {
      return;
    }
    setIsAdding(true);
    setError(null);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmed,
          plannedDate: plannedDate || null,
          ...(meetingId ? { meetingId } : { employeeId }),
        }),
      });
      if (!response.ok) {
        throw new Error(await readError(response, "Unable to create task"));
      }
      const payload = (await response.json()) as { task: Task };
      setTitle("");
      setPlannedDate("");
      onChange(sortPersonTasks([...tasks, payload.task]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create task");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleToggle(task: Task) {
    const completing = !task.completedAt;
    const completedAt = completing ? new Date().toISOString() : null;
    const body: { completedAt: string | null; completedMeetingId?: string } = { completedAt };
    if (completing && meetingId) {
      body.completedMeetingId = meetingId;
    }
    setPendingId(task.id);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(await readError(response, "Unable to update task"));
      }
      const payload = (await response.json()) as { task: Task };
      onChange(sortPersonTasks(tasks.map((item) => (item.id === payload.task.id ? payload.task : item))));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update task");
    } finally {
      setPendingId(null);
    }
  }

  async function handleTitleBlur(task: Task, nextTitle: string) {
    const trimmed = nextTitle.trim();
    if (!trimmed || trimmed === task.title) {
      return;
    }
    setPendingId(task.id);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!response.ok) {
        throw new Error(await readError(response, "Unable to update task"));
      }
      const payload = (await response.json()) as { task: Task };
      onChange(tasks.map((item) => (item.id === payload.task.id ? payload.task : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update task");
    } finally {
      setPendingId(null);
    }
  }

  async function handlePlannedDateChange(task: Task, nextDate: string) {
    setPendingId(task.id);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plannedDate: nextDate || null }),
      });
      if (!response.ok) {
        throw new Error(await readError(response, "Unable to update task"));
      }
      const payload = (await response.json()) as { task: Task };
      onChange(sortPersonTasks(tasks.map((item) => (item.id === payload.task.id ? payload.task : item))));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update task");
    } finally {
      setPendingId(null);
    }
  }

  async function handleDelete(taskId: string) {
    setPendingId(taskId);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(await readError(response, "Unable to delete task"));
      }
      onChange(tasks.filter((task) => task.id !== taskId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete task");
    } finally {
      setPendingId(null);
    }
  }

  function renderTask(task: Task) {
    const hint = taskHint(task, meetingsById);
    return (
      <li key={task.id} className="space-y-2 rounded-md border border-white/10 bg-black/20 p-3">
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={Boolean(task.completedAt)}
            disabled={pendingId === task.id}
            onChange={() => {
              void handleToggle(task);
            }}
            className="mt-1 size-4 accent-sky-400"
            aria-label={`Mark ${task.title} ${task.completedAt ? "open" : "done"}`}
          />
          <Input
            key={task.id}
            defaultValue={task.title}
            disabled={pendingId === task.id}
            onBlur={(event) => {
              void handleTitleBlur(task, event.target.value);
            }}
            className={cn("border-white/10 bg-transparent text-white", task.completedAt && "line-through opacity-60")}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={`Delete ${task.title}`}
            disabled={pendingId === task.id}
            onClick={() => {
              void handleDelete(task.id);
            }}
          >
            <Trash2 className="size-4 text-red-300" />
          </Button>
        </div>
        {hint ? <p className="text-xs text-blue-100/50">{hint}</p> : null}
        <Input
          type="date"
          value={task.plannedDate ?? ""}
          disabled={pendingId === task.id}
          onChange={(event) => {
            void handlePlannedDateChange(task, event.target.value);
          }}
          className="border-white/10 bg-transparent text-white"
        />
      </li>
    );
  }

  return (
    <aside className="space-y-4 rounded-lg border border-white/10 bg-white/5 p-4">
      <h2 className="text-lg font-semibold text-white">Tasks</h2>

      <div className="space-y-2">
        <Input
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
          placeholder="Task title"
          className="border-white/20 bg-white/5 text-white placeholder:text-blue-100/40"
        />
        <Input
          type="date"
          value={plannedDate}
          onChange={(event) => {
            setPlannedDate(event.target.value);
          }}
          className="border-white/20 bg-white/5 text-white"
        />
        {error ? <p className="text-xs text-red-400">{error}</p> : null}
        <Button type="button" className="w-full" onClick={() => void handleAdd()} disabled={isAdding}>
          <Plus className="size-4" />
          {isAdding ? "Adding..." : "Add task"}
        </Button>
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-blue-100/70">No tasks yet.</p>
      ) : showFollowUpSections ? (
        <div className="space-y-4">
          {openTasks.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium tracking-wide text-blue-100/50 uppercase">Open</p>
              <ul className="space-y-3">{openTasks.map(renderTask)}</ul>
            </div>
          ) : null}
          {closedTasks.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium tracking-wide text-blue-100/50 uppercase">Closed in this meeting</p>
              <ul className="space-y-3">{closedTasks.map(renderTask)}</ul>
            </div>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-3">{tasks.map(renderTask)}</ul>
      )}
    </aside>
  );
}
