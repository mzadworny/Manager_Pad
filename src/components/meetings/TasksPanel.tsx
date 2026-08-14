import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Task } from "@/types";

interface TasksPanelProps {
  meetingId: string;
  tasks: Task[];
  onChange: (tasks: Task[]) => void;
}

async function readError(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error ?? fallback;
}

export function TasksPanel({ meetingId, tasks, onChange }: TasksPanelProps) {
  const [title, setTitle] = useState("");
  const [plannedDate, setPlannedDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

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
          meetingId,
          title: trimmed,
          plannedDate: plannedDate || null,
        }),
      });
      if (!response.ok) {
        throw new Error(await readError(response, "Unable to create task"));
      }
      const payload = (await response.json()) as { task: Task };
      setTitle("");
      setPlannedDate("");
      onChange([...tasks, payload.task]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create task");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleToggle(task: Task) {
    setPendingId(task.id);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completedAt: task.completedAt ? null : new Date().toISOString(),
        }),
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
      onChange(tasks.map((item) => (item.id === payload.task.id ? payload.task : item)));
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
      ) : (
        <ul className="space-y-3">
          {tasks.map((task) => (
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
                  defaultValue={task.title}
                  disabled={pendingId === task.id}
                  onBlur={(event) => {
                    void handleTitleBlur(task, event.target.value);
                  }}
                  className={`border-white/10 bg-transparent text-white ${task.completedAt ? "line-through opacity-60" : ""}`}
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
          ))}
        </ul>
      )}
    </aside>
  );
}
