"use client";

import { MinusSignIcon, PlusSignIcon } from "@hugeicons/core-free-icons";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type {
  ServiceOption,
  ServiceOptionValue,
  ServiceOptionValues,
} from "@/lib/service-app/options";

/**
 * ConfigureScene — "Which options?"
 *
 * The one scene between choosing a service and seeing its price. The app
 * supplies the option definitions; this renders them and reports changes. It
 * inspects `kind`, never an id, so it carries no product semantics.
 *
 * Anything that needs its own search, map, or comparison is not an option —
 * it is a scene. Keep this list short; a configure scene with fifteen rows is
 * a progressive-disclosure failure, not a rendering problem.
 */
export function ConfigureScene({
  options,
  values,
  onChange,
  className,
}: {
  options: readonly ServiceOption[];
  values: ServiceOptionValues;
  onChange: (id: string, value: ServiceOptionValue) => void;
  className?: string;
}) {
  if (options.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {options.map((option) => (
        <OptionRow
          key={option.id}
          option={option}
          value={values[option.id]}
          onChange={onChange}
        />
      ))}
    </div>
  );
}

function OptionRow({
  option,
  value,
  onChange,
}: {
  option: ServiceOption;
  value: ServiceOptionValue | undefined;
  onChange: (id: string, value: ServiceOptionValue) => void;
}) {
  const labelId = `service-option-${option.id}`;

  if (option.kind === "toggle") {
    const checked = value === true;
    return (
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p id={labelId} className="text-[15px] font-medium tracking-tight">
            {option.label}
          </p>
          <OptionDescription text={option.description} />
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-labelledby={labelId}
          onClick={() => onChange(option.id, !checked)}
          className={cn(
            "focus-visible:ring-ring relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
            checked ? "bg-primary" : "bg-accent ring-border ring-1",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "bg-background absolute top-1 size-5 rounded-full shadow-sm transition-[left] motion-reduce:transition-none",
              checked ? "left-6" : "left-1",
            )}
          />
        </button>
      </div>
    );
  }

  if (option.kind === "choice") {
    const selected = typeof value === "string" ? value : "";
    return (
      <fieldset>
        <legend className="text-[15px] font-medium tracking-tight">
          {option.label}
        </legend>
        <OptionDescription text={option.description} />
        <div className="bg-accent mt-2 flex gap-1 rounded-xl p-1" role="group">
          {option.choices.map((choice) => {
            const active = choice.value === selected;
            return (
              <button
                key={choice.value}
                type="button"
                aria-pressed={active}
                onClick={() => onChange(option.id, choice.value)}
                className={cn(
                  "focus-visible:ring-ring min-h-11 flex-1 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  active
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                {choice.label}
                {choice.hint ? (
                  <span className="text-muted-foreground block text-xs font-normal">
                    {choice.hint}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </fieldset>
    );
  }

  if (option.kind === "counter") {
    const min = option.min ?? 0;
    const max = option.max ?? 99;
    const step = option.step ?? 1;
    const current = typeof value === "number" ? value : min;
    return (
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <p id={labelId} className="text-[15px] font-medium tracking-tight">
            {option.label}
          </p>
          <OptionDescription text={option.description} />
        </div>
        <div className="ring-border flex shrink-0 items-center gap-1 rounded-xl ring-1">
          <CounterButton
            label={`Decrease ${option.label}`}
            disabled={current <= min}
            onClick={() => onChange(option.id, Math.max(min, current - step))}
          >
            <Icon icon={MinusSignIcon} size={16} />
          </CounterButton>
          <output
            aria-labelledby={labelId}
            className="w-8 text-center text-[15px] tabular-nums"
          >
            {current}
          </output>
          <CounterButton
            label={`Increase ${option.label}`}
            disabled={current >= max}
            onClick={() => onChange(option.id, Math.min(max, current + step))}
          >
            <Icon icon={PlusSignIcon} size={16} />
          </CounterButton>
        </div>
      </div>
    );
  }

  const text = typeof value === "string" ? value : "";
  const rows = option.kind === "text" ? (option.rows ?? 3) : 3;
  const fieldClass =
    "bg-card ring-border placeholder:text-muted-foreground focus-visible:ring-ring mt-2 w-full rounded-xl px-3 py-2.5 text-[15px] leading-relaxed ring-1 focus-visible:ring-2 focus-visible:outline-none";
  return (
    <div>
      <label
        htmlFor={labelId}
        className="text-[15px] font-medium tracking-tight"
      >
        {option.label}
      </label>
      <OptionDescription text={option.description} />
      {rows === 1 ? (
        <input
          id={labelId}
          type="text"
          value={text}
          maxLength={option.maxLength}
          placeholder={option.placeholder}
          onChange={(event) => onChange(option.id, event.target.value)}
          className={fieldClass}
        />
      ) : (
        <textarea
          id={labelId}
          rows={rows}
          value={text}
          maxLength={option.maxLength}
          placeholder={option.placeholder}
          onChange={(event) => onChange(option.id, event.target.value)}
          className={`${fieldClass} resize-none`}
        />
      )}
    </div>
  );
}

function OptionDescription({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p className="text-muted-foreground mt-0.5 text-sm leading-snug">{text}</p>
  );
}

function CounterButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="focus-visible:ring-ring text-muted-foreground flex size-11 items-center justify-center rounded-xl focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}
