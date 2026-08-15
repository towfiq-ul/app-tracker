import { useEffect, useState } from "react";
import type { FieldSchemaEntry } from "../types";
import { updateApplicationUserField, ApiError } from "../api";
import { useToasts, ToastStack } from "./Toast";

function isTruthy(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

function formatCell(value: unknown, type: FieldSchemaEntry["type"]) {
  if (value === null || value === undefined || value === "") return <span className="cell-empty">—</span>;

  if (type === "boolean") {
    const truthy = isTruthy(value);
    return <span className={`pill ${truthy ? "pill-good" : "pill-bad"}`}>{truthy ? "Active" : "Inactive"}</span>;
  }

  if (type === "date" || type === "datetime") {
    const date = new Date(value as string);
    if (Number.isNaN(date.getTime())) return String(value);
    return type === "date" ? date.toLocaleDateString() : date.toLocaleString();
  }

  return String(value);
}

// <input type="date"|"datetime-local"> need "yyyy-MM-dd"/"yyyy-MM-ddTHH:mm" — neither
// matches the ISO/SQL strings a target DB actually stores, so convert on the way in...
function toDateInputValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function toDateTimeInputValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 16);
}
// ...and back to an ISO string on the way out, in commit()'s date/datetime branch below.

// Textareas don't grow with their content on their own — reset to "auto" first so a
// shrinking edit (e.g. deleting text) actually shrinks the box back down too, not just grows.
function autoResizeTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

interface Props {
  appId: number;
  fields: FieldSchemaEntry[];
  rows: Record<string, unknown>[];
}

export function UserTable({ appId, fields, rows }: Props) {
  const [localRows, setLocalRows] = useState(rows);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [cellErrors, setCellErrors] = useState<Record<string, string>>({});
  const { toasts, pushToast } = useToasts();

  useEffect(() => {
    setLocalRows(rows);
    setPending({});
    setCellErrors({});
  }, [rows]);

  const primaryKeyField = fields.find((f) => f.primaryKey);

  async function commit(rowIndex: number, field: FieldSchemaEntry, nextValue: unknown) {
    if (!primaryKeyField) return;
    const cellId = `${rowIndex}:${field.key}`;
    const row = localRows[rowIndex];
    const primaryKeyValue = row[primaryKeyField.key];
    const previousValue = row[field.key];
    if (nextValue === previousValue) return;

    setLocalRows((prev) => prev.map((r, i) => (i === rowIndex ? { ...r, [field.key]: nextValue } : r)));
    setPending((prev) => ({ ...prev, [cellId]: true }));
    setCellErrors((prev) => {
      const next = { ...prev };
      delete next[cellId];
      return next;
    });

    try {
      await updateApplicationUserField(appId, field.key, nextValue, primaryKeyValue);
      pushToast(`${field.label} saved.`, "success");
    } catch (err) {
      // The remote write didn't happen — roll the optimistic edit back.
      setLocalRows((prev) => prev.map((r, i) => (i === rowIndex ? { ...r, [field.key]: previousValue } : r)));
      const message = err instanceof ApiError ? err.message : "Update failed.";
      setCellErrors((prev) => ({ ...prev, [cellId]: message }));
      pushToast(`${field.label} failed to save: ${message}`, "error");
    } finally {
      setPending((prev) => {
        const next = { ...prev };
        delete next[cellId];
        return next;
      });
    }
  }

  function renderCell(row: Record<string, unknown>, rowIndex: number, field: FieldSchemaEntry) {
    const value = row[field.key];

    if (!field.editable || !primaryKeyField) return formatCell(value, field.type);

    const cellId = `${rowIndex}:${field.key}`;
    const isPending = pending[cellId];
    const cellError = cellErrors[cellId];

    if (field.type === "boolean") {
      const truthy = isTruthy(value);
      return (
        <div className="editable-cell">
          <button
            type="button"
            role="switch"
            aria-checked={truthy}
            className={`toggle-switch ${truthy ? "toggle-on" : "toggle-off"}`}
            disabled={isPending}
            onClick={() => commit(rowIndex, field, !truthy)}
          >
            <span className="toggle-knob" />
          </button>
          {cellError && (
            <span className="cell-error" title={cellError}>
              ⚠
            </span>
          )}
        </div>
      );
    }

    if (field.type === "date" || field.type === "datetime") {
      const inputType = field.type === "date" ? "date" : "datetime-local";
      const inputValue = field.type === "date" ? toDateInputValue(value) : toDateTimeInputValue(value);
      return (
        <div className="editable-cell">
          <input
            key={`${cellId}:${inputValue}`}
            type={inputType}
            className="cell-input"
            defaultValue={inputValue}
            disabled={isPending}
            onBlur={(e) => {
              const raw = e.target.value;
              if (!raw) return;
              const parsed = new Date(raw);
              if (Number.isNaN(parsed.getTime())) return;
              commit(rowIndex, field, parsed.toISOString());
            }}
          />
          {cellError && (
            <span className="cell-error" title={cellError}>
              ⚠
            </span>
          )}
        </div>
      );
    }

    const textValue = value === null || value === undefined ? "" : String(value);

    if (field.type === "number") {
      return (
        <div className="editable-cell">
          <input
            key={`${cellId}:${textValue}`}
            type="number"
            className="cell-input"
            defaultValue={textValue}
            disabled={isPending}
            onBlur={(e) => commit(rowIndex, field, Number(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
          {cellError && (
            <span className="cell-error" title={cellError}>
              ⚠
            </span>
          )}
        </div>
      );
    }

    // A single-line <input> clips long text with no way to see the rest without scrolling
    // inside it — a <textarea> that grows with its content wraps instead, the same way a
    // read-only cell does, so the full value is always visible.
    return (
      <div className="editable-cell">
        <textarea
          key={`${cellId}:${textValue}`}
          ref={autoResizeTextarea}
          className="cell-input cell-textarea"
          rows={1}
          defaultValue={textValue}
          disabled={isPending}
          onInput={(e) => autoResizeTextarea(e.currentTarget)}
          onBlur={(e) => commit(rowIndex, field, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />
        {cellError && (
          <span className="cell-error" title={cellError}>
            ⚠
          </span>
        )}
      </div>
    );
  }

  if (localRows.length === 0)
    return (
      <>
        <p className="page-status">No users found.</p>
        <ToastStack toasts={toasts} />
      </>
    );

  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="col-sl">SL</th>
              {fields.map((field) => (
                <th key={field.key}>{field.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {localRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td className="col-sl">{rowIndex + 1}</td>
                {fields.map((field) => (
                  <td key={field.key}>{renderCell(row, rowIndex, field)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ToastStack toasts={toasts} />
    </>
  );
}
