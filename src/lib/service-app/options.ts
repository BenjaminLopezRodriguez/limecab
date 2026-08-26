/**
 * Generic option model for the `configure` scene.
 *
 * The app supplies the definitions; the kit renders them. Four kinds cover
 * what on-demand services actually configure: a switch, a small exclusive
 * choice, a count, and a free-text note. Anything that needs more than these
 * is a scene of its own, not a fifth kind.
 */

export type ServiceOptionValue = boolean | string | number;

export type ServiceOption =
  | {
      id: string;
      kind: "toggle";
      label: string;
      description?: string;
      defaultValue?: boolean;
    }
  | {
      id: string;
      kind: "choice";
      label: string;
      description?: string;
      choices: { value: string; label: string; hint?: string }[];
      defaultValue?: string;
    }
  | {
      id: string;
      kind: "counter";
      label: string;
      description?: string;
      min?: number;
      max?: number;
      step?: number;
      defaultValue?: number;
    }
  | {
      id: string;
      kind: "text";
      label: string;
      description?: string;
      placeholder?: string;
      maxLength?: number;
      /** Visible lines. Short fields (a name, a phone) are 1; notes stay 3. */
      rows?: number;
      defaultValue?: string;
    };

export type ServiceOptionValues = Record<string, ServiceOptionValue>;

export function defaultOptionValues(
  options: readonly ServiceOption[],
): ServiceOptionValues {
  const values: ServiceOptionValues = {};
  for (const option of options) {
    switch (option.kind) {
      case "toggle":
        values[option.id] = option.defaultValue ?? false;
        break;
      case "choice":
        values[option.id] =
          option.defaultValue ?? option.choices[0]?.value ?? "";
        break;
      case "counter":
        values[option.id] = option.defaultValue ?? option.min ?? 0;
        break;
      case "text":
        values[option.id] = option.defaultValue ?? "";
        break;
    }
  }
  return values;
}

/** Human-readable summary of the chosen options, for a quote or a receipt. */
export function summarizeOptions(
  options: readonly ServiceOption[],
  values: ServiceOptionValues,
): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = [];
  for (const option of options) {
    const value = values[option.id];
    if (value === undefined) continue;
    switch (option.kind) {
      case "toggle":
        if (value === true) lines.push({ label: option.label, value: "Yes" });
        break;
      case "choice": {
        const choice = option.choices.find((entry) => entry.value === value);
        if (choice) lines.push({ label: option.label, value: choice.label });
        break;
      }
      case "counter":
        lines.push({ label: option.label, value: String(value) });
        break;
      case "text":
        if (typeof value === "string" && value.trim()) {
          lines.push({ label: option.label, value: value.trim() });
        }
        break;
    }
  }
  return lines;
}
