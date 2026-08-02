// Static marketing copy for the homepage's landing sections. Kept in one
// module (rather than hardcoded inline in components) so any of these lists
// can later be swapped for a CMS/database-backed fetch without touching the
// section components themselves.

export type HowItWorksStep = {
  title: string;
  description: string;
};

export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    title: "Describe your idea",
    description:
      "Tell Codewix what you want to build in plain English — no specs, wireframes, or boilerplate required.",
  },
  {
    title: "The right AI model is chosen for you",
    description:
      "Codewix automatically matches your project type and complexity to the best-suited AI model behind the scenes.",
  },
  {
    title: "Watch your app come to life",
    description:
      "Real, production-quality React and TypeScript code streams in right in front of you, ready to inspect.",
  },
  {
    title: "Preview, refine, and ship",
    description:
      "Iterate conversationally in the chat, then export your code or deploy your project when it's ready.",
  },
];

export type TechStackItem = {
  name: string;
};

export const SUPPORTED_TECHNOLOGIES: TechStackItem[] = [
  { name: "React" },
  { name: "TypeScript" },
  { name: "Tailwind CSS" },
  { name: "shadcn/ui" },
  { name: "Lucide Icons" },
  { name: "Next.js" },
];

export type WhyCodewixFeature = {
  title: string;
  description: string;
};

export const WHY_CODEWIX_FEATURES: WhyCodewixFeature[] = [
  {
    title: "Real, ownable code",
    description:
      "Every project generates clean React and TypeScript source — not a black box. Export it and take it anywhere.",
  },
  {
    title: "Multiple AI models",
    description:
      "Codewix automatically routes each project to the AI model best suited to its type and complexity.",
  },
  {
    title: "Instant live preview",
    description:
      "See your app rendering as it's generated, so you can course-correct without waiting for a full build.",
  },
  {
    title: "Secure by default",
    description:
      "Authentication, row-level security, and server-side validation are built in from the first line of code.",
  },
  {
    title: "Export & deploy anywhere",
    description:
      "Your project isn't locked to Codewix. Export the source and deploy it on the infrastructure of your choice.",
  },
  {
    title: "Built for iteration",
    description:
      "Keep refining your app conversationally — ask for changes the same way you'd brief a teammate.",
  },
];

export type FaqItem = {
  question: string;
  answer: string;
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "What is Codewix?",
    answer:
      "Codewix turns a plain-English description of an app idea into a real, working React application, generated live in your browser.",
  },
  {
    question: "Which AI models does Codewix use?",
    answer:
      "Codewix automatically selects from a curated set of frontier AI models based on your project's type and complexity, so you never have to think about picking one yourself.",
  },
  {
    question: "Do I own the code that's generated?",
    answer:
      "Yes. Every project is real React and TypeScript source code. There's no lock-in — you can export it and host it wherever you like.",
  },
  {
    question: "Can I keep editing my app after it's generated?",
    answer:
      "Absolutely. Every project has its own chat where you can keep asking for changes, and Codewix will refine the app in place.",
  },
  {
    question: "Is my project data secure?",
    answer:
      "Every project is tied to your account with server-side validation and row-level security on the underlying data, so your projects stay private by default.",
  },
  {
    question: "What kind of apps can I build?",
    answer:
      "Anything from landing pages and dashboards to portfolios, e-commerce storefronts, and internal tools — pick a project type and describe what you need.",
  },
];

export type Testimonial = {
  name: string;
  role: string;
  quote: string;
};

// Early-access user feedback, collected informally ahead of the public
// testimonials pipeline. Replace with a database-backed feed once reviews
// are collected through the product.
export const TESTIMONIALS: Testimonial[] = [
  {
    name: "Aarav Mehta",
    role: "Indie Hacker",
    quote:
      "I described a habit tracker in two sentences and had a working, good-looking app before my coffee got cold.",
  },
  {
    name: "Priya Nair",
    role: "Full-stack Developer",
    quote:
      "The generated code is actually clean. I've kept building on top of a couple of these projects instead of throwing them away.",
  },
  {
    name: "Daniel Osei",
    role: "Startup Founder",
    quote:
      "Being able to iterate on the app just by chatting with it made it easy to get our MVP in front of users the same day.",
  },
  {
    name: "Sofia Ramirez",
    role: "Product Designer",
    quote:
      "I use it to turn rough UI ideas into working prototypes I can actually click through, instead of static mockups.",
  },
  {
    name: "Kenji Watanabe",
    role: "Freelance Developer",
    quote:
      "The automatic model selection is a nice touch — I never have to think about which model fits the job.",
  },
  {
    name: "Emma Clarke",
    role: "Computer Science Student",
    quote:
      "It's the fastest way I've found to go from an idea in a lecture to something real I can show classmates.",
  },
];
