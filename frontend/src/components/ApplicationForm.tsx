import { useState, type FormEvent } from "react";
import type { ApplicationDetail, FieldSchemaEntry, FieldType } from "../types";
import type { ApplicationFormInput } from "../api";
import { useToasts, ToastStack } from "./Toast";

const FIELD_TYPES: FieldType[] = ["text", "number", "boolean", "date", "datetime"];

// The user-list table renders every field as an evenly-split column with no horizontal
// scroll — that only stays legible up to this many columns.
const MAX_FIELDS = 12;

interface Props {
  mode: "create" | "edit";
  initial?: ApplicationDetail;
  onSubmit: (input: ApplicationFormInput) => Promise<void>;
}

// A stable id per row (separate from the key/label/type data itself) keeps React's
// reconciliation correct when rows are added or removed out of order — using the
// array index as the key instead lets input state bleed between rows after a removal.
interface FieldRow extends FieldSchemaEntry {
  id: string;
}

function emptyRow(): FieldRow {
  return { id: crypto.randomUUID(), key: "", label: "", type: "text" };
}

function toRows(fields: FieldSchemaEntry[] | undefined): FieldRow[] {
  if (!fields || fields.length === 0) return [emptyRow()];
  return fields.map((f) => ({ ...f, id: crypto.randomUUID() }));
}

export function ApplicationForm({ mode, initial, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [accountId, setAccountId] = useState(initial?.account_id ?? "");
  const [databaseId, setDatabaseId] = useState(initial?.database_id ?? "");
  const [apiToken, setApiToken] = useState("");
  const [tableName, setTableName] = useState(initial?.table_name ?? "users");
  const [rows, setRows] = useState<FieldRow[]>(toRows(initial?.field_schema));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const { toasts, pushToast } = useToasts();

  function fail(message: string) {
    setError(message);
    pushToast(message, "error");
  }

  function updateRow(id: string, patch: Partial<FieldSchemaEntry>) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id === id) return { ...r, ...patch };
        // Only one row can be the primary key — selecting it on this row clears it elsewhere.
        if (patch.primaryKey) return { ...r, primaryKey: false };
        return r;
      })
    );
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  // field_schema order is what drives the user-list table's column order, so dragging a
  // row here reorders it there too.
  function reorderRows(draggedId: string, targetId: string) {
    if (draggedId === targetId) return;
    setRows((prev) => {
      const fromIndex = prev.findIndex((r) => r.id === draggedId);
      const toIndex = prev.findIndex((r) => r.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const trimmedToken = apiToken.trim();
    if (mode === "create" && !trimmedToken) {
      fail("An API token is required to create an application.");
      return;
    }
    const trimmedRows = rows.map((r) => ({ ...r, key: r.key.trim(), label: r.label.trim() }));
    if (trimmedRows.length === 0 || trimmedRows.some((r) => !r.key || !r.label)) {
      fail("Every field needs both a key and a label.");
      return;
    }
    if (trimmedRows.length > MAX_FIELDS) {
      fail(`Applications can have at most ${MAX_FIELDS} fields.`);
      return;
    }
    const editableCount = trimmedRows.filter((r) => r.editable).length;
    const primaryKeyCount = trimmedRows.filter((r) => r.primaryKey).length;
    if (editableCount > 0 && primaryKeyCount !== 1) {
      fail("Mark exactly one field as the primary key to allow editing.");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        account_id: accountId.trim(),
        database_id: databaseId.trim(),
        api_token: trimmedToken || undefined,
        table_name: tableName.trim(),
        field_schema: trimmedRows.map(({ key, label, type, editable, primaryKey }) => ({
          key,
          label,
          type,
          editable: editable || undefined,
          primaryKey: primaryKey || undefined,
        })),
      });
    } catch (err) {
      fail(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="application-form" onSubmit={handleSubmit}>
      <label>
        Application name
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>

      <div className="form-row">
        <label>
          Cloudflare account ID
          <input value={accountId} onChange={(e) => setAccountId(e.target.value)} required />
        </label>
        <label>
          D1 database ID
          <input value={databaseId} onChange={(e) => setDatabaseId(e.target.value)} required />
        </label>
      </div>

      <label>
        D1 API token{mode === "edit" && " (leave blank to keep the current one)"}
        <input
          type="password"
          value={apiToken}
          onChange={(e) => setApiToken(e.target.value)}
          placeholder={mode === "edit" ? "••••••••" : ""}
          autoComplete="off"
        />
      </label>

      <label>
        Table name
        <input
          value={tableName}
          onChange={(e) => setTableName(e.target.value)}
          placeholder="users"
          required
        />
      </label>

      <fieldset className="field-schema-editor">
        <legend>Displayed fields</legend>
        {rows.map((row) => (
          <div
            className={`field-schema-row-wrap ${draggingId === row.id ? "dragging" : ""}`}
            key={row.id}
            // Always preventDefault on dragover — that's what tells the browser this is a
            // valid drop target; gating it on state left a race where the first dragover
            // could fire before React had committed draggingId, silently blocking the drop.
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (draggingId) reorderRows(draggingId, row.id);
              setDraggingId(null);
            }}
          >
            <span
              className="field-drag-handle"
              draggable
              onDragStart={(e) => {
                setDraggingId(row.id);
                e.dataTransfer.effectAllowed = "move";
                // Firefox won't treat the gesture as a real drag (and skips dragover/drop on
                // other elements) unless some data is set on the transfer.
                e.dataTransfer.setData("text/plain", row.id);
              }}
              onDragEnd={() => setDraggingId(null)}
              role="button"
              tabIndex={-1}
              aria-label="Drag to reorder field"
              title="Drag to reorder"
            >
              ⠿
            </span>
            <div className="field-schema-row">
              <input
                className="field-key"
                placeholder="column key"
                value={row.key}
                onChange={(e) => updateRow(row.id, { key: e.target.value })}
              />
              <input
                className="field-label"
                placeholder="column label"
                value={row.label}
                onChange={(e) => updateRow(row.id, { label: e.target.value })}
              />
              <select
                className="field-type"
                value={row.type}
                onChange={(e) => updateRow(row.id, { type: e.target.value as FieldType })}
              >
                {FIELD_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <label className="field-editable">
                <input
                  type="checkbox"
                  checked={row.editable ?? false}
                  onChange={(e) => updateRow(row.id, { editable: e.target.checked })}
                />
                Editable
              </label>
              <label className="field-primary-key">
                <input
                  type="radio"
                  name="primary-key"
                  checked={row.primaryKey ?? false}
                  onChange={() => updateRow(row.id, { primaryKey: true })}
                />
                Primary key
              </label>
              <button
                className="field-remove"
                type="button"
                onClick={() => removeRow(row.id)}
                aria-label="Remove field"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          disabled={rows.length >= MAX_FIELDS}
          onClick={() => setRows((prev) => [...prev, emptyRow()])}
        >
          {rows.length >= MAX_FIELDS ? `Field limit reached (${MAX_FIELDS})` : "Add field"}
        </button>
      </fieldset>

      {error && <p className="form-error">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : mode === "create" ? "Add" : "Save changes"}
      </button>
      <ToastStack toasts={toasts} />
    </form>
  );
}
