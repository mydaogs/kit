"use client";

import { Button } from "@mydaogs/ui";
import { toast } from "./sonner";
import type { GetComponentProps } from "./types";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

interface CopyToClipboardBtnProps {
  value: string;
  size?: GetComponentProps<typeof Button>["size"];
  variant?: GetComponentProps<typeof Button>["variant"];
}

export const CopyToClipboardBtn = ({
  value,
  size = "side",
  variant = "side",
}: CopyToClipboardBtnProps) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      toast("Copied!");
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 1000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <Button variant={variant} size={size} onClick={handleCopy}>
      {isCopied ? <Check /> : <Copy />}
    </Button>
  );
};
