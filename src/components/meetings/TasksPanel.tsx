import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTask, softDeleteTask, updateTask } from "@/lib/meeting-mock-store";
import type { Task } from "@/types";

interface TasksPanelProps {
  meetingId: string;
  tasks: Task[];
  onChange: (tasks: Task[]) => void;
}

export function TasksPanel({ meetingId, tasks, onChange }: TasksPanelProps) {
  const [title, setTitle] = useState("");
  const [plannedDate, setPlannedDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Title is required");
      return;
    }
    const created = createTask({
      meetingId,
      title: trimmed,
      plannedDate: plannedDate || null,
    });
    if (!created) {
      setError("Unable to create task");
      return;
    }
    setTitle("");
    setPlannedDate("");
    setError(null);
    onChange([...tasks, created]);
  }

  function handleToggle(task: Task) {
    const updated = updateTask(task.id, {
      completedAt: task.completedAt ? null : new Date().toISOString(),
    });
    if (!updated) {
      return;
    }
    onChange(tasks.map((item) => (item.id === updated.id ? updated : item)));
  }

  function handleTitleBlur(task: Task, nextTitle: string) {
    const trimmed = nextTitle.trim();
    if (!trimmed || trimmed === task.title) {
      return;
    }
    const updated = updateTask(task.id, { title: trimmed });
    if (!updated) {
      return;
    }
    onChange(tasks.map((item) => (item.id === updated.id ? updated : item)));
  }

  function handlePlannedDateChange(task: Task, nextDate: string) {
    const updated = updateTask(task.id, { plannedDate: nextDate || null });
    if (!updated) {
      return;
    }
    onChange(tasks.map((item) => (item.id === updated.id ? updated : item)));
  }

  function handleDelete(taskId: string) {
    if (!softDeleteTask(taskId)) {
      return;
    }
    onChange(tasks.filter((task) => task.id !== taskId));
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
        <Button type="button" className="w-full" onClick={handleAdd}>
          <Plus className="size-4" />
          Add task
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
                  onChange={() => {
                    handleToggle(task);
                  }}
                  className="mt-1 size-4 accent-sky-400"
                  aria-label={`Mark ${task.title} ${task.completedAt ? "open" : "done"}`}
                />
                <Input
                  defaultValue={task.title}
                  onBlur={(event) => {
                    handleTitleBlur(task, event.target.value);
                  }}
                  className={`border-white/10 bg-transparent text-white ${task.completedAt ? "line-through opacity-60" : ""}`}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Delete ${task.title}`}
                  onClick={() => {
                    handleDelete(task.id);
                  }}
                >
                  <Trash2 className="size-4 text-red-300" />
                </Button>
              </div>
              <Input
                type="date"
                value={task.plannedDate ?? ""}
                onChange={(event) => {
                  handlePlannedDateChange(task, event.target.value);
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
