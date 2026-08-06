import { ComponentProps } from "react";

export default function LogoSmall(props: ComponentProps<"svg">) {
  // L13: add explicit width/height to avoid CLS and satisfy
  // @next/next/no-img-element (kept as <img> since it's a static public asset,
  // not suitable for next/image optimization at this tiny size).
  return (
    <img
      src="/logo.png"
      alt="Codewix"
      width={24}
      height={24}
      className="size-[24px]"
    />
  );
}
