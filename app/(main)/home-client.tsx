/* eslint-disable @next/next/no-img-element */
"use client";

import Fieldset from "@/components/fieldset";
import ArrowRightIcon from "@/components/icons/arrow-right";
import LoadingButton from "@/components/loading-button";
import Spinner from "@/components/spinner";
import { useRouter } from "next/navigation";
import { use, useState, useRef, useEffect, useMemo } from "react";

import { Context } from "./providers";
import SiteHeader from "@/components/site-header";
import { useS3Upload } from "next-s3-upload";
import UploadIcon from "@/components/icons/upload-icon";
import { SUGGESTED_PROMPTS } from "@/lib/constants";
import { useCurrentUser, type CurrentUser } from "@/hooks/use-current-user";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import ProjectCreateDialog from "./project-create-dialog";
import FeatureHighlightsBar from "@/components/home/feature-highlights-bar";
import HowItWorks from "@/components/home/how-it-works";
import SupportedTechnologies from "@/components/home/supported-technologies";
import WhyCodewix from "@/components/home/why-codewix";
import ExampleProjects from "@/components/home/example-projects";
import PopularTemplates, {
  type ProjectTypeOption,
} from "@/components/home/popular-templates";
import FaqSection from "@/components/home/faq-section";
import TestimonialsSection from "@/components/home/testimonials-section";
import PlatformStats from "@/components/home/platform-stats";
import CtaBanner from "@/components/home/cta-banner";
import SiteFooter from "@/components/home/site-footer";

export default function HomeClient({
  initialUser,
  stats,
  projectTypes,
}: {
  initialUser: CurrentUser | null;
  stats: { appCount: number; userCount: number };
  projectTypes: ProjectTypeOption[];
}) {
  const { setStreamPromise } = use(Context);
  const router = useRouter();
  const { user, loaded: authLoaded } = useCurrentUser(initialUser);

  const [prompt, setPrompt] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState<string | undefined>(
    undefined,
  );
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const [signInDialogOpen, setSignInDialogOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const { uploadToS3 } = useS3Upload();

  function handleProjectCreated(result: {
    projectId: string;
    chatId: string;
    lastMessageId: string;
    model: string;
  }) {
    const streamPromise = fetch("/api/get-next-completion-stream-promise", {
      method: "POST",
      body: JSON.stringify({
        messageId: result.lastMessageId,
        model: result.model,
      }),
    }).then((res) => {
      if (!res.body) {
        throw new Error("No body on response");
      }
      return res.body;
    });

    setStreamPromise(streamPromise);
    router.push(`/chats/${result.chatId}`);
  }

  const handleScreenshotUpload = async (event: any) => {
    if (prompt.length === 0) setPrompt("Build this");
    setScreenshotLoading(true);
    let file = event.target.files[0];
    const { url } = await uploadToS3(file);
    setScreenshotUrl(url);
    setScreenshotLoading(false);
  };

  const textareaResizePrompt = useMemo(
    () =>
      prompt
        .split("\n")
        .map((text) => (text === "" ? "a" : text))
        .join("\n"),
    [prompt],
  );

  function focusHeroPrompt(description?: string) {
    if (description !== undefined) setPrompt(description);
    document.getElementById("hero")?.scrollIntoView({ behavior: "smooth" });
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 400);
  }

  return (
    <>
      <div
        id="hero"
        className="relative flex min-h-screen shrink-0 grow flex-col overflow-hidden bg-gradient-to-br from-[#1e1b4b] via-[#1e3a8a] to-[#4c1d95]"
      >
      <div className="animate-gradient-shift pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-600 via-fuchsia-600 to-cyan-500 opacity-70" />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-float-orb absolute -top-24 -left-24 h-96 w-96 rounded-full bg-cyan-400/40 blur-[100px]" />
        <div className="animate-float-orb-slow absolute top-1/4 -right-24 h-[28rem] w-[28rem] rounded-full bg-fuchsia-500/40 blur-[110px]" />
        <div className="animate-float-orb-delay absolute -bottom-32 left-1/3 h-[26rem] w-[26rem] rounded-full bg-blue-500/40 blur-[100px]" />
      </div>

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="isolate flex h-full grow flex-col">
        <SiteHeader initialUser={initialUser} />

        <div className="mt-10 flex grow flex-col items-center px-4 lg:mt-16">
          <h1 className="mt-4 text-balance text-center text-4xl leading-none text-white drop-shadow-sm md:text-[64px] lg:mt-8">
            Turn your <span className="text-cyan-300">idea</span>
            <br className="hidden md:block" /> into an{" "}
            <span className="text-cyan-300">app</span>
          </h1>

          <form
            className="relative w-full max-w-2xl pt-6 lg:pt-12"
            onSubmit={(event) => {
              event.preventDefault();

              // Auth check hasn't resolved yet; the submit button is
              // disabled in this state, but guard here too just in case.
              if (!authLoaded) return;

              if (!user) {
                setSignInDialogOpen(true);
                return;
              }

              if (prompt.trim().length === 0) return;

              setProjectDialogOpen(true);
            }}
          >
            <Fieldset>
              <div className="relative flex w-full max-w-2xl rounded-xl border border-white/40 bg-white/90 pb-10 shadow-2xl shadow-black/20 backdrop-blur-xl">
                <div className="w-full">
                  {screenshotLoading && (
                    <div className="relative mx-3 mt-3">
                      <div className="rounded-xl">
                        <div className="group mb-2 flex h-16 w-[68px] animate-pulse items-center justify-center rounded bg-gray-200">
                          <Spinner />
                        </div>
                      </div>
                    </div>
                  )}
                  {screenshotUrl && (
                    <div className="relative mx-3 mt-3">
                      <div className="rounded-xl">
                        <img
                          alt="screenshot"
                          src={screenshotUrl}
                          className="group relative mb-2 h-16 w-[68px] rounded object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        id="x-circle-icon"
                        className="absolute -right-3 -top-4 left-14 z-10 size-5 rounded-full bg-white text-gray-900 hover:text-gray-500"
                        onClick={() => {
                          setScreenshotUrl(undefined);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                          }
                        }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="size-6"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                          />
                        </svg>
                      </button>
                    </div>
                  )}
                  <div className="relative max-h-48 overflow-hidden">
                    <div className="p-3">
                      <p className="invisible max-h-48 w-full overflow-hidden whitespace-pre-wrap">
                        {textareaResizePrompt}
                      </p>
                    </div>
                    <textarea
                      ref={textareaRef}
                      placeholder="Build me a budgeting app..."
                      required
                      name="prompt"
                      rows={2}
                      className="peer absolute bottom-1 left-0 right-1 top-1 resize-none overflow-y-auto bg-transparent px-4 py-2 placeholder-gray-500 focus-visible:outline-none disabled:opacity-50"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onPaste={(e) => {
                        // Clean up pasted text
                        e.preventDefault();
                        const pastedText = e.clipboardData.getData("text");

                        // Normalize line endings and clean up whitespace
                        const cleanedText = pastedText
                          .replace(/\r\n/g, "\n") // Convert Windows line endings
                          .replace(/\r/g, "\n") // Convert old Mac line endings
                          .replace(/\n{3,}/g, "\n\n") // Max 2 consecutive newlines
                          .trim(); // Remove leading/trailing whitespace

                        // Insert the cleaned text at cursor position
                        const textarea = e.target as HTMLTextAreaElement;
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const newValue =
                          prompt.slice(0, start) +
                          cleanedText +
                          prompt.slice(end);

                        setPrompt(newValue);

                        // Set cursor position after the pasted text
                        setTimeout(() => {
                          if (textareaRef.current) {
                            textareaRef.current.selectionStart =
                              start + cleanedText.length;
                            textareaRef.current.selectionEnd =
                              start + cleanedText.length;
                          }
                        }, 0);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          const target = event.target;
                          if (!(target instanceof HTMLTextAreaElement)) return;
                          target.closest("form")?.requestSubmit();
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="absolute bottom-2 left-3 right-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <label
                        htmlFor="screenshot"
                        className="flex cursor-pointer gap-2 text-sm text-gray-400 hover:underline"
                      >
                        <div className="flex size-6 items-center justify-center rounded bg-black hover:bg-gray-700">
                          <UploadIcon className="size-4" />
                        </div>
                        <div className="flex items-center justify-center transition hover:text-gray-700">
                          Attach
                        </div>
                      </label>
                      <input
                        // name="screenshot"
                        id="screenshot"
                        type="file"
                        accept="image/png, image/jpeg, image/webp"
                        onChange={handleScreenshotUpload}
                        className="hidden"
                        ref={fileInputRef}
                      />
                    </div>
                  </div>

                  <div className="relative flex shrink-0 has-[:disabled]:opacity-50">
                    <div className="pointer-events-none absolute inset-0 -bottom-[1px] rounded bg-blue-500" />

                    {authLoaded ? (
                      <LoadingButton
                        className="relative inline-flex size-6 items-center justify-center rounded bg-blue-500 font-medium text-white shadow-lg outline-blue-300 hover:bg-blue-500/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-90"
                        type="submit"
                        disabled={screenshotLoading || prompt.length === 0}
                      >
                        <ArrowRightIcon />
                      </LoadingButton>
                    ) : (
                      <Skeleton className="relative size-6 rounded bg-white/40" />
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex w-full flex-wrap justify-between gap-2.5">
                {SUGGESTED_PROMPTS.map((v) => (
                  <button
                    key={v.title}
                    type="button"
                    onClick={() => {
                      setPrompt(v.description);
                      // Refocus the textarea after setting the prompt
                      setTimeout(() => {
                        textareaRef.current?.focus();
                        // Position cursor at the end
                        if (textareaRef.current) {
                          textareaRef.current.selectionStart =
                            textareaRef.current.value.length;
                          textareaRef.current.selectionEnd =
                            textareaRef.current.value.length;
                        }
                      }, 0);
                    }}
                    className="rounded bg-gray-100 px-2.5 py-1.5 text-xs tracking-[0%] text-gray-700 transition-colors hover:bg-gray-200"
                  >
                    {v.title}
                  </button>
                ))}
              </div>
            </Fieldset>
          </form>
        </div>
      </div>
      </div>

      <AlertDialog open={signInDialogOpen} onOpenChange={setSignInDialogOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Sign in to build your app</AlertDialogTitle>
          <AlertDialogDescription>
            You need to sign in first to create your app. Your prompt won&apos;t
            be lost — sign in and you can pick up right where you left off.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <AlertDialogAction
              className="bg-gray-900 hover:bg-gray-800"
              onClick={() => router.push("/signin")}
            >
              Sign in
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ProjectCreateDialog
        open={projectDialogOpen}
        onOpenChange={setProjectDialogOpen}
        buildPrompt={prompt}
        screenshotUrl={screenshotUrl}
        onSignInRequired={() => setSignInDialogOpen(true)}
        onCreated={handleProjectCreated}
      />

      <FeatureHighlightsBar />
      <HowItWorks />
      <SupportedTechnologies />
      <WhyCodewix />
      <ExampleProjects onSelectExample={(description) => focusHeroPrompt(description)} />
      <PopularTemplates
        templates={projectTypes}
        onSelectTemplate={(template) =>
          focusHeroPrompt(`Build a ${template.name.toLowerCase()}: `)
        }
      />
      <FaqSection />
      <TestimonialsSection />
      <PlatformStats appCount={stats.appCount} userCount={stats.userCount} />
      <CtaBanner />
      <SiteFooter />
    </>
  );
}
