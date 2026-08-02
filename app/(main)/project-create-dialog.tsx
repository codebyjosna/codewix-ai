"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ProjectCreatingOverlay from "@/components/project-creating-overlay";

const NAME_MAX = 100;
const DESCRIPTION_MIN = 200;
const DESCRIPTION_MAX = 1000;

type ProjectOption = { id: string; name: string; slug: string };

type FieldErrors = {
  projectTypeId?: string;
  name?: string;
  description?: string;
  visibilityId?: string;
};

export default function ProjectCreateDialog({
  open,
  onOpenChange,
  initialDescription,
  screenshotUrl,
  onSignInRequired,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDescription: string;
  screenshotUrl?: string;
  onSignInRequired: () => void;
  onCreated: (result: {
    projectId: string;
    chatId: string;
    lastMessageId: string;
    model: string;
  }) => void;
}) {
  const [types, setTypes] = useState<ProjectOption[]>([]);
  const [visibilities, setVisibilities] = useState<ProjectOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const [projectTypeId, setProjectTypeId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState(initialDescription);
  const [visibilityId, setVisibilityId] = useState("");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  // Refresh dropdown data + reset the form each time the dialog opens.
  useEffect(() => {
    if (!open) return;

    setDescription(initialDescription);
    setName("");
    setFieldErrors({});
    setSubmitError(null);

    let cancelled = false;
    setOptionsLoading(true);
    setOptionsError(null);

    fetch("/api/project-options")
      .then((res) => {
        if (res.status === 401) {
          onSignInRequired();
          return null;
        }
        if (!res.ok) throw new Error("Failed to load project options");
        return res.json();
      })
      .then((data) => {
        if (cancelled || !data) return;
        setTypes(data.types ?? []);
        setVisibilities(data.visibilities ?? []);
        setProjectTypeId(data.types?.[0]?.id ?? "");
        setVisibilityId(data.visibilities?.[0]?.id ?? "");
      })
      .catch(() => {
        if (!cancelled) setOptionsError("Couldn't load project options. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    if (!projectTypeId) errors.projectTypeId = "Select a project type";

    if (!trimmedName) {
      errors.name = "Project name is required";
    } else if (trimmedName.length > NAME_MAX) {
      errors.name = `Project name must be at most ${NAME_MAX} characters`;
    } else if (!/^[a-zA-Z0-9 ]+$/.test(trimmedName)) {
      errors.name = "Only letters, numbers, and spaces are allowed";
    }

    if (trimmedDescription.length < DESCRIPTION_MIN) {
      errors.description = `Description must be at least ${DESCRIPTION_MIN} characters (${trimmedDescription.length}/${DESCRIPTION_MIN})`;
    } else if (trimmedDescription.length > DESCRIPTION_MAX) {
      errors.description = `Description must be at most ${DESCRIPTION_MAX} characters`;
    }

    if (!visibilityId) errors.visibilityId = "Select visibility";

    return errors;
  }

  async function handleCreate() {
    if (isSubmittingRef.current) return;

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    isSubmittingRef.current = true;
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/create-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          projectTypeId,
          visibilityId,
          screenshotUrl,
        }),
      });

      if (response.status === 401) {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
        onOpenChange(false);
        onSignInRequired();
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setSubmitError(data?.error ?? "Failed to create project");
        isSubmittingRef.current = false;
        setIsSubmitting(false);
        return;
      }

      const data = await response.json();
      // Keep the overlay showing - the parent navigates away immediately.
      onCreated(data);
    } catch {
      setSubmitError("Network error - please try again");
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  const descriptionLength = description.trim().length;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (isSubmitting) return;
          onOpenChange(next);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogTitle>Create your project</DialogTitle>
          <DialogDescription>
            Tell us a bit more about what you&apos;re building so we can pick
            the right setup and AI model for it.
          </DialogDescription>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Project type
              </label>
              <Select
                value={projectTypeId}
                onValueChange={(value) => {
                  if (value !== null) setProjectTypeId(value);
                }}
                items={Object.fromEntries(types.map((t) => [t.id, t.name]))}
                disabled={optionsLoading || types.length === 0}
              >
                <SelectTrigger className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-900">
                  <SelectValue placeholder="Select a project type" />
                </SelectTrigger>
                <SelectContent className="w-[--anchor-width] bg-white p-1">
                  {types.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-gray-700">
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.projectTypeId && (
                <p className="mt-1 text-xs text-red-600">
                  {fieldErrors.projectTypeId}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Project name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={NAME_MAX}
                placeholder="My Fruit Business Website"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
              />
              <div className="mt-1 flex items-center justify-between">
                {fieldErrors.name ? (
                  <p className="text-xs text-red-600">{fieldErrors.name}</p>
                ) : (
                  <span className="text-xs text-gray-400">
                    Letters, numbers, and spaces only
                  </span>
                )}
                <span className="shrink-0 text-xs text-gray-400">
                  {name.length}/{NAME_MAX}
                </span>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={DESCRIPTION_MAX}
                rows={5}
                placeholder="Describe what you're building in detail - the more specific, the better we can pick the right AI model..."
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
              />
              <div className="mt-1 flex items-center justify-between">
                {fieldErrors.description ? (
                  <p className="text-xs text-red-600">
                    {fieldErrors.description}
                  </p>
                ) : (
                  <span className="text-xs text-gray-400">
                    Minimum {DESCRIPTION_MIN} characters
                  </span>
                )}
                <span
                  className={`shrink-0 text-xs ${
                    descriptionLength < DESCRIPTION_MIN
                      ? "text-gray-400"
                      : "text-green-600"
                  }`}
                >
                  {descriptionLength}/{DESCRIPTION_MAX}
                </span>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Choose visibility
              </label>
              <Select
                value={visibilityId}
                onValueChange={(value) => {
                  if (value !== null) setVisibilityId(value);
                }}
                items={Object.fromEntries(
                  visibilities.map((v) => [v.id, v.name]),
                )}
                disabled={optionsLoading || visibilities.length === 0}
              >
                <SelectTrigger className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-900">
                  <SelectValue placeholder="Select visibility" />
                </SelectTrigger>
                <SelectContent className="w-[--anchor-width] bg-white p-1">
                  {visibilities.map((v) => (
                    <SelectItem key={v.id} value={v.id} className="text-gray-700">
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.visibilityId && (
                <p className="mt-1 text-xs text-red-600">
                  {fieldErrors.visibilityId}
                </p>
              )}
            </div>

            {optionsError && (
              <p className="text-sm text-red-600">{optionsError}</p>
            )}
            {submitError && (
              <p className="text-sm text-red-600">{submitError}</p>
            )}
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={optionsLoading || Boolean(optionsError)}
              className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-500/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Create Project
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isSubmitting && <ProjectCreatingOverlay />}
    </>
  );
}
