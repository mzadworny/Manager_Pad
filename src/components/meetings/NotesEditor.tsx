import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  ListTodo,
} from "lucide-react";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NotesJson } from "@/types";

interface NotesEditorProps {
  initialContent: NotesJson;
  onChange: (content: NotesJson) => void;
  editable?: boolean;
  className?: string;
  minHeightClass?: string;
}

const NOTES_EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
];

const EDITOR_CLASS =
  "px-3 py-3 text-sm leading-relaxed text-white outline-none [&_a]:text-sky-300 [&_a]:underline [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-0 [&_ul[data-type=taskList]_li]:flex [&_ul[data-type=taskList]_li]:items-start [&_ul[data-type=taskList]_li]:gap-2";

const DEFAULT_MIN_HEIGHT_CLASS = "min-h-[280px]";

function ToolbarButton({
  active,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(event) => {
        // Keep editor selection when using the toolbar.
        event.preventDefault();
      }}
      onClick={onClick}
      className={cn("size-8 text-blue-100/80 hover:text-white", active && "bg-white/15 text-white")}
    >
      {children}
    </Button>
  );
}

function NotesToolbar({ editor }: { editor: Editor }) {
  function promptLink() {
    const previous = editor.getAttributes("link").href as string | undefined;
    const next = window.prompt("Link URL", previous ?? "https://");
    if (next === null) {
      return;
    }
    if (next.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: next.trim() }).run();
  }

  return (
    <div className="flex flex-wrap gap-1 border-b border-white/10 p-2">
      <ToolbarButton
        label="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Ordered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Task list"
        active={editor.isActive("taskList")}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >
        <ListTodo className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Link" active={editor.isActive("link")} onClick={promptLink}>
        <LinkIcon className="size-4" />
      </ToolbarButton>
    </div>
  );
}

export function NotesEditor({
  initialContent,
  onChange,
  editable = true,
  className,
  minHeightClass = DEFAULT_MIN_HEIGHT_CLASS,
}: NotesEditorProps) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editorProps = useMemo(
    () => ({
      attributes: {
        class: cn(EDITOR_CLASS, minHeightClass),
      },
    }),
    [minHeightClass],
  );

  // TipTap SSR: immediatelyRender false yields null until mounted; overload is easy to miss under eslint projectService.
  // Stable extensions/editorProps + empty deps avoid setOptions churn that can fight Backspace/Delete mid-edit.
  const editor = useEditor(
    {
      immediatelyRender: false,
      editable,
      extensions: NOTES_EXTENSIONS,
      content: initialContent,
      editorProps,
      onUpdate: ({ editor: current }) => {
        onChangeRef.current(current.getJSON() as NotesJson);
      },
    },
    [],
  ) as Editor | null;

  useEffect(() => {
    if (!editor) {
      return;
    }
    editor.setEditable(editable);
  }, [editor, editable]);

  if (editor === null) {
    return <p className="p-3 text-sm text-blue-100/70">Loading editor...</p>;
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border border-white/10 bg-white/5", className)}>
      {editable ? <NotesToolbar editor={editor} /> : null}
      <EditorContent editor={editor} />
    </div>
  );
}
