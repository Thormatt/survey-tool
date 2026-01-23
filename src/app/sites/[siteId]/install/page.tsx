"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Copy, Check, Code, Globe, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface SiteData {
  id: string;
  name: string;
  domain: string;
  recordingEnabled: boolean;
  heatmapsEnabled: boolean;
  consentRequired: boolean;
}

export default function InstallPage() {
  const params = useParams();
  const siteId = params.siteId as string;
  const [site, setSite] = useState<SiteData | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSite = async () => {
      try {
        const response = await fetch(`/api/sites/${siteId}`);
        const data = await response.json();
        if (response.ok) {
          setSite(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch site:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSite();
  }, [siteId]);

  const getTrackingScript = () => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return `<!-- Survey Tool Tracking Script -->
<script>
  (function(w,d,s,o,f,js,fjs){
    w['SurveyToolObject']=o;w[o]=w[o]||function(){
    (w[o].q=w[o].q||[]).push(arguments)};w[o].l=1*new Date();
    js=d.createElement(s);fjs=d.getElementsByTagName(s)[0];
    js.async=1;js.src=f;fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','st','${baseUrl}/sdk/tracker.js'));
  st('init', '${siteId}');
</script>`;
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(getTrackingScript());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbf5ea] flex items-center justify-center">
        <p className="text-[#6b6b7b]">Loading...</p>
      </div>
    );
  }

  if (!site) {
    return (
      <div className="min-h-screen bg-[#fbf5ea] flex items-center justify-center">
        <p className="text-[#6b6b7b]">Site not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fbf5ea]">
      <header className="border-b border-[#dcd6f6]">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/sites/${siteId}`}
              className="text-[#6b6b7b] hover:text-[#1a1a2e] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-['Syne'] font-semibold text-lg">Install Tracking</h1>
              <p className="text-sm text-[#6b6b7b]">{site.name}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 max-w-3xl">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Site Configuration
            </CardTitle>
            <CardDescription>Your site is configured with the following settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{site.domain}</Badge>
              {site.recordingEnabled && (
                <Badge variant="highlight">Session Recording</Badge>
              )}
              {site.heatmapsEnabled && (
                <Badge variant="highlight">Heatmaps</Badge>
              )}
              {site.consentRequired && (
                <Badge variant="secondary">Consent Required</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="w-5 h-5" />
              Tracking Script
            </CardTitle>
            <CardDescription>
              Copy and paste this script into your website&apos;s HTML, just before the closing
              &lt;/head&gt; tag
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <pre className="bg-[#1a1a2e] text-[#fbf5ea] p-4 rounded-lg text-sm overflow-x-auto">
                <code>{getTrackingScript()}</code>
              </pre>
              <Button
                size="sm"
                variant="outline"
                className="absolute top-2 right-2"
                onClick={copyToClipboard}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Installation Checklist
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#dcd6f6] flex items-center justify-center text-sm font-semibold">
                  1
                </div>
                <div>
                  <p className="font-medium">Copy the tracking script</p>
                  <p className="text-sm text-[#6b6b7b]">
                    Click the copy button above to copy the script to your clipboard
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#dcd6f6] flex items-center justify-center text-sm font-semibold">
                  2
                </div>
                <div>
                  <p className="font-medium">Add to your website</p>
                  <p className="text-sm text-[#6b6b7b]">
                    Paste the script in your HTML, just before the closing &lt;/head&gt; tag.
                    For frameworks like Next.js, add it to your layout or _document file.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#dcd6f6] flex items-center justify-center text-sm font-semibold">
                  3
                </div>
                <div>
                  <p className="font-medium">Deploy your changes</p>
                  <p className="text-sm text-[#6b6b7b]">
                    Deploy your website with the new tracking script
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#dcd6f6] flex items-center justify-center text-sm font-semibold">
                  4
                </div>
                <div>
                  <p className="font-medium">Verify installation</p>
                  <p className="text-sm text-[#6b6b7b]">
                    Visit your website and check the browser console for confirmation.
                    Recordings will appear in your dashboard within a few minutes.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex gap-4">
          <Link href={`/sites/${siteId}`} className="flex-1">
            <Button variant="outline" className="w-full">
              Go to Dashboard
            </Button>
          </Link>
          <Link href={`/sites/${siteId}/pages`} className="flex-1">
            <Button className="w-full">Configure Page Targeting</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
