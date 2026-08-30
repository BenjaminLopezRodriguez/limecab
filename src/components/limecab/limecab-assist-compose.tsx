"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import {
  Image01Icon,
  Location01Icon,
  PlusSignIcon,
  Route01Icon,
  UserAdd01Icon,
  AtIcon,
} from "@hugeicons/core-free-icons";

import { AdaptiveSurface } from "@/components/service-app/adaptive-surface";
import {
  ChoiceCopy,
  ChoiceGlyph,
  ChoiceList,
  ChoiceRow,
} from "@/components/service-app/choice-list";
import { AssistTextcon } from "@/components/limecab/assist-textcon";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import {
  ASSIST_PLUGIN_MENTIONS,
  filterMentions,
  type AssistComposeDraft,
  type AssistMention,
} from "@/lib/limecab/assist-compose";
import {
  assistQueryFromPhoto,
  classifyPhotoFilename,
  type AssistPhotoClassification,
} from "@/lib/limecab/assist-photo";
import { cn } from "@/lib/utils";

function revokePreviewUrl(url: string | null | undefined) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}

type ComposeStep = "menu" | "person" | "plugins";

/**
 * "+" on the Assist omni bar — one interruption with photo, stops / person,
 * and ChatGPT-style plugin @-tags. Parent stays mounted underneath.
 */
export function AssistComposeSurface({
  open,
  onOpenChange,
  draft,
  onDraftChange,
  onInsertMentionTrigger,
  onApplyMention,
  onQuerySeed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: AssistComposeDraft;
  onDraftChange: (next: AssistComposeDraft) => void;
  onInsertMentionTrigger: () => void;
  onApplyMention: (mention: AssistMention) => void;
  /** Seed the omni-bar after a photo classifies as a shop list. */
  onQuerySeed?: (query: string) => void;
}) {
  const [step, setStep] = useState<ComposeStep>("menu");
  const [personName, setPersonName] = useState(draft.recipientName ?? "");
  const [photoNote, setPhotoNote] = useState<"idle" | "looking" | "failed">("idle");
  const fileRef = useRef<HTMLInputElement>(null);
  const classifyAbort = useRef<AbortController | null>(null);

  const close = () => {
    classifyAbort.current?.abort();
    classifyAbort.current = null;
    setStep("menu");
    setPhotoNote("idle");
    onOpenChange(false);
  };

  const pickPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      setPhotoNote("failed");
      return;
    }
    revokePreviewUrl(draft.photoPreviewUrl);
    const previewUrl = URL.createObjectURL(file);
    onDraftChange({
      ...draft,
      photoName: file.name,
      photoUrl: null,
      photoPreviewUrl: previewUrl,
      photoClassification: null,
    });
    void classifyPickedPhoto(file, previewUrl);
  };

  const classifyPickedPhoto = async (file: File, previewUrl: string) => {
    classifyAbort.current?.abort();
    const ac = new AbortController();
    classifyAbort.current = ac;
    setPhotoNote("looking");
    try {
      const result = await classifyAssistPhoto(file, ac.signal);
      if (ac.signal.aborted) return;
      const classification =
        result.classification ?? classifyPhotoFilename(file.name);
      onDraftChange({
        ...draft,
        photoName: file.name,
        photoUrl: result.blobUrl,
        photoPreviewUrl: previewUrl,
        photoClassification: classification,
      });
      if (classification) {
        onQuerySeed?.(
          result.preparedPrompt || assistQueryFromPhoto(classification),
        );
        close();
        return;
      }
      setPhotoNote("failed");
    } catch {
      if (ac.signal.aborted) return;
      const fallback = classifyPhotoFilename(file.name);
      onDraftChange({
        ...draft,
        photoName: file.name,
        photoUrl: null,
        photoPreviewUrl: previewUrl,
        photoClassification: fallback,
      });
      if (fallback) {
        onQuerySeed?.(assistQueryFromPhoto(fallback));
        close();
        return;
      }
      setPhotoNote("failed");
    }
  };

  const title =
    step === "person"
      ? "Who is this for?"
      : step === "plugins"
        ? "Tag a plugin"
        : "Add to request";

  return (
    <AdaptiveSurface.Interrupt
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
        else onOpenChange(true);
      }}
      id="assist-compose"
      label={title}
      description={
        step === "menu"
          ? "Photo, stops, someone else, or an @ plugin."
          : undefined
      }
    >
      {step === "menu" ? (
        <ChoiceList>
          <ComposeRow
            icon={<Icon icon={Image01Icon} size={24} />}
            label={draft.photoName ? "Replace photo" : "Upload photo"}
            secondary={
              photoNote === "looking"
                ? "Uploading and looking…"
                : draft.photoClassification?.items[0]?.label
                  ? draft.photoClassification.items[0].label
                  : draft.photoName
                    ? draft.photoName
                    : "Reference for shop or help"
            }
            onClick={() => {
              if (photoNote === "looking") return;
              fileRef.current?.click();
            }}
          />
          <ComposeRow
            icon={<Icon icon={Route01Icon} size={24} />}
            label={draft.wantsStops ? "Stops added" : "Add stops"}
            secondary="Multi-stop when this becomes a ride"
            onClick={() => {
              if (photoNote === "looking") return;
              onDraftChange({ ...draft, wantsStops: true });
              close();
            }}
          />
          <ComposeRow
            icon={<Icon icon={UserAdd01Icon} size={24} />}
            label={
              draft.recipientName
                ? `For ${draft.recipientName}`
                : "For someone else"
            }
            secondary="Tag who this request is for"
            onClick={() => {
              if (photoNote === "looking") return;
              setPersonName(draft.recipientName ?? "");
              setStep("person");
            }}
          />
          <ComposeRow
            icon={<Icon icon={AtIcon} size={24} />}
            label="Tag a plugin"
            secondary="@shop, @ride, @send…"
            onClick={() => {
              if (photoNote === "looking") return;
              setStep("plugins");
            }}
          />
        </ChoiceList>
      ) : null}

      {step === "person" ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const name = personName.trim();
            if (!name) return;
            onDraftChange({ ...draft, recipientName: name });
            close();
          }}
        >
          <Input
            value={personName}
            onChange={(event) => setPersonName(event.target.value)}
            aria-label="Person’s name"
            placeholder="Name"
            autoFocus
            className="h-12"
            maxLength={64}
          />
          <Button type="submit" className="h-12 w-full" disabled={!personName.trim()}>
            Add person
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground h-11 w-full"
            onClick={() => setStep("menu")}
          >
            Back
          </Button>
        </form>
      ) : null}

      {step === "plugins" ? (
        <div className="flex flex-col gap-3">
          <ChoiceList>
            {ASSIST_PLUGIN_MENTIONS.map((mention) => (
              <ComposeRow
                key={mention.id}
                icon={
                  mention.service ? (
                    <AssistTextcon id={mention.service} />
                  ) : (
                    <Icon icon={AtIcon} size={24} />
                  )
                }
                label={`@${mention.id}`}
                secondary={mention.hint ?? mention.label}
                onClick={() => {
                  onApplyMention(mention);
                  close();
                }}
              />
            ))}
          </ChoiceList>
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full"
            onClick={() => {
              onInsertMentionTrigger();
              close();
            }}
          >
            Type with @
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground h-11 w-full"
            onClick={() => setStep("menu")}
          >
            Back
          </Button>
        </div>
      ) : null}

      {photoNote !== "idle" ? (
        <p role="status" className="text-muted-foreground text-sm leading-relaxed">
          {photoNote === "looking"
            ? "Uploading and looking at the photo…"
            : draft.photoUrl
              ? `Saved ${draft.photoName}. Couldn't identify it — type what to buy.`
              : draft.photoName
                ? `Attached ${draft.photoName} for this session. Couldn't identify it — type what to buy.`
                : "This build couldn't store that photo."}
        </p>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        disabled={photoNote === "looking"}
        onChange={pickPhoto}
      />
    </AdaptiveSurface.Interrupt>
  );
}

function ComposeRow({
  icon,
  label,
  secondary,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  secondary: string;
  onClick: () => void;
}) {
  return (
    <ChoiceRow onClick={onClick}>
      <ChoiceGlyph>{icon}</ChoiceGlyph>
      <ChoiceCopy title={label} detail={secondary} />
    </ChoiceRow>
  );
}

/** Lime + button that opens the compose sheet without submitting search. */
export function AssistComposePlusButton({
  onPress,
  size = 18,
  className,
}: {
  onPress: () => void;
  size?: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label="Add to request"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onPress();
      }}
      className={cn(
        "text-lime flex size-10 shrink-0 items-center justify-center rounded-full",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        "touch-manipulation active:bg-accent/60",
        className,
      )}
    >
      <Icon icon={PlusSignIcon} size={size} />
    </button>
  );
}

/** Chips for photo / stops / person sitting under the omni field. */
export function AssistComposeChips({
  draft,
  onClearPhoto,
  onClearStops,
  onClearPerson,
}: {
  draft: AssistComposeDraft;
  onClearPhoto: () => void;
  onClearStops: () => void;
  onClearPerson: () => void;
}) {
  if (!draft.photoName && !draft.wantsStops && !draft.recipientName) {
    return null;
  }
  const photoLabel =
    draft.photoClassification?.items[0]?.label?.trim() || "Photo";
  return (
    <ul className="mt-2 flex flex-wrap gap-2 px-1" aria-label="Request extras">
      {draft.photoName ? (
        <PhotoChip
          previewUrl={draft.photoPreviewUrl}
          label={photoLabel}
          onClear={onClearPhoto}
        />
      ) : null}
      {draft.wantsStops ? (
        <Chip label="Stops" onClear={onClearStops} />
      ) : null}
      {draft.recipientName ? (
        <Chip label={`For ${draft.recipientName}`} onClear={onClearPerson} />
      ) : null}
    </ul>
  );
}

/** Square thumbnail chip — preview URL preferred; never the giant filename. */
function PhotoChip({
  previewUrl,
  label,
  onClear,
}: {
  previewUrl: string | null;
  label: string;
  onClear: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClear}
        className="bg-card ring-border text-foreground inline-flex items-center gap-1.5 rounded-xl py-1 pr-2 pl-1 text-[13px] font-medium ring-1"
        aria-label={`Remove ${label}`}
      >
        <span className="bg-muted relative size-9 shrink-0 overflow-hidden rounded-lg">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob:/data: preview
            <img
              src={previewUrl}
              alt=""
              className="size-full object-cover"
              draggable={false}
            />
          ) : (
            <span className="text-muted-foreground flex size-full items-center justify-center">
              <Icon icon={Image01Icon} size={16} />
            </span>
          )}
        </span>
        <span className="max-w-[7rem] truncate capitalize">{label}</span>
        <span aria-hidden="true" className="text-muted-foreground">
          ×
        </span>
      </button>
    </li>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClear}
        className="bg-card ring-border text-foreground inline-flex max-w-full items-center gap-1.5 rounded-full py-1.5 pr-2.5 pl-3 text-[13px] font-medium ring-1"
        aria-label={`Remove ${label}`}
      >
        <span className="truncate">{label}</span>
        <span aria-hidden="true" className="text-muted-foreground">
          ×
        </span>
      </button>
    </li>
  );
}

/** Autocomplete list while the caret sits in an `@…` token. */
export function AssistMentionMenu({
  query,
  active,
  listId,
  setActive,
  onChoose,
}: {
  query: string;
  active: number;
  listId: string;
  setActive: (index: number) => void;
  onChoose: (mention: AssistMention) => void;
}) {
  const options = filterMentions(query);
  if (options.length === 0) {
    return (
      <p className="text-muted-foreground mt-3 px-2 text-[13px] leading-relaxed">
        Keep typing a plugin or place — e.g. @shop or @the-grande-hotel.
      </p>
    );
  }
  return (
    <ul
      id={listId}
      role="listbox"
      aria-label="Plugins and places"
      className="-mx-2 mt-3 overflow-hidden"
    >
      {options.map((mention, index) => (
        <li
          key={`${mention.kind}:${mention.id}`}
          id={`${listId}-${index}`}
          role="option"
          aria-selected={index === active}
        >
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onChoose(mention)}
            onMouseEnter={() => setActive(index)}
            className={cn(
              "flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 py-2 text-left",
              index === active && "bg-accent",
            )}
          >
            <span
              aria-hidden="true"
              className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-full"
            >
              {mention.kind === "plugin" && mention.service ? (
                <AssistTextcon id={mention.service} />
              ) : (
                <Icon icon={Location01Icon} size={18} />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium tracking-tight">
                @{mention.id}
              </span>
              <span className="text-muted-foreground block truncate text-sm">
                {mention.hint ?? mention.label}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

async function classifyAssistPhoto(
  file: File,
  signal: AbortSignal,
): Promise<{
  classification: AssistPhotoClassification | null;
  blobUrl: string | null;
  preparedPrompt: string | null;
}> {
  const body = new FormData();
  body.set("image", file);
  const res = await fetch("/api/assist/classify", {
    method: "POST",
    body,
    signal,
  });
  if (!res.ok) {
    return { classification: null, blobUrl: null, preparedPrompt: null };
  }
  const json = (await res.json()) as {
    classification?: AssistPhotoClassification | null;
    blobUrl?: string | null;
    preparedPrompt?: string | null;
  };
  return {
    classification: json.classification ?? null,
    blobUrl: json.blobUrl ?? null,
    preparedPrompt: json.preparedPrompt ?? null,
  };
}
