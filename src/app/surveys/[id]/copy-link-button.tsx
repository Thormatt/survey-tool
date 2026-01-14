"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

export function CopyLinkButton({ surveyUrl }: { surveyUrl: string }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    const fullUrl = `${window.location.origin}${surveyUrl}`;
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="outline" size="sm" onClick={copyToClipboard}>
      {copied ? (
        <>
          <Check className="w-4 h-4 mr-2" />
          Copied!
        </>
      ) : (
        <>
          <Copy className="w-4 h-4 mr-2" />
          Copy
        </>
      )}
    </Button>
  );
}
