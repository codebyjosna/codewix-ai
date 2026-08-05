import { ComponentProps } from "react";

export default function LogoSmall(props: ComponentProps<"svg">) {
  return <img src="/logo.png" alt="Codewix" className="size-[24px]" />;
}
