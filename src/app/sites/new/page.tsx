"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Loader2, Globe, Video, MousePointer, Shield, Settings } from "lucide-react";
import Link from "next/link";

export default function NewSitePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    domain: "",
    recordingEnabled: true,
    heatmapsEnabled: true,
    consentRequired: true,
    consentText: "We use session recordings to improve your experience. By continuing, you agree to our privacy policy.",
    samplingRate: 100,
    retentionDays: 30,
    maskInputs: true,
    maskSelectors: [] as string[],
  });

  const [advancedOpen, setAdvancedOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create site");
      }

      router.push(`/sites/${data.data.id}/install`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fbf5ea]">
      <header className="border-b border-[#dcd6f6]">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/sites" className="text-[#6b6b7b] hover:text-[#1a1a2e] transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="font-['Syne'] font-semibold text-lg">Add New Site</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Globe className="w-5 h-5" />
                Site Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Site Name</Label>
                <Input
                  id="name"
                  placeholder="My Website"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="domain">Domain</Label>
                <Input
                  id="domain"
                  placeholder="example.com"
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  required
                />
                <p className="text-xs text-[#6b6b7b]">
                  Enter without https:// - just the domain name
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Video className="w-5 h-5" />
                Tracking Features
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="recordingEnabled"
                  checked={formData.recordingEnabled}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, recordingEnabled: checked as boolean })
                  }
                />
                <div className="space-y-1">
                  <Label htmlFor="recordingEnabled" className="cursor-pointer">
                    Session Recordings
                  </Label>
                  <p className="text-xs text-[#6b6b7b]">
                    Record visitor sessions to replay and analyze user behavior
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="heatmapsEnabled"
                  checked={formData.heatmapsEnabled}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, heatmapsEnabled: checked as boolean })
                  }
                />
                <div className="space-y-1">
                  <Label htmlFor="heatmapsEnabled" className="cursor-pointer">
                    <div className="flex items-center gap-2">
                      <MousePointer className="w-4 h-4" />
                      Heatmaps
                    </div>
                  </Label>
                  <p className="text-xs text-[#6b6b7b]">
                    Generate click and scroll heatmaps to visualize engagement
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="w-5 h-5" />
                Privacy & Consent
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="consentRequired"
                  checked={formData.consentRequired}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, consentRequired: checked as boolean })
                  }
                />
                <div className="space-y-1">
                  <Label htmlFor="consentRequired" className="cursor-pointer">
                    Require Consent
                  </Label>
                  <p className="text-xs text-[#6b6b7b]">
                    Ask visitors for consent before recording (GDPR compliant)
                  </p>
                </div>
              </div>

              {formData.consentRequired && (
                <div className="space-y-2 pl-6">
                  <Label htmlFor="consentText">Consent Message</Label>
                  <Textarea
                    id="consentText"
                    placeholder="Your consent message..."
                    value={formData.consentText || ""}
                    onChange={(e) => setFormData({ ...formData, consentText: e.target.value })}
                    rows={3}
                  />
                </div>
              )}

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="maskInputs"
                  checked={formData.maskInputs}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, maskInputs: checked as boolean })
                  }
                />
                <div className="space-y-1">
                  <Label htmlFor="maskInputs" className="cursor-pointer">
                    Mask Input Fields
                  </Label>
                  <p className="text-xs text-[#6b6b7b]">
                    Automatically hide sensitive data in password and text inputs
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div>
            <button
              type="button"
              onClick={() => setAdvancedOpen(!advancedOpen)}
              className="flex items-center gap-2 text-sm text-[#6b6b7b] hover:text-[#1a1a2e] transition-colors"
            >
              <Settings className="w-4 h-4" />
              {advancedOpen ? "Hide" : "Show"} Advanced Settings
            </button>
          </div>

          {advancedOpen && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings className="w-5 h-5" />
                  Advanced Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="samplingRate">Sampling Rate (%)</Label>
                  <Input
                    id="samplingRate"
                    type="number"
                    min={1}
                    max={100}
                    value={formData.samplingRate}
                    onChange={(e) =>
                      setFormData({ ...formData, samplingRate: parseInt(e.target.value) || 100 })
                    }
                  />
                  <p className="text-xs text-[#6b6b7b]">
                    Percentage of sessions to record (100 = all sessions)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="retentionDays">Data Retention (days)</Label>
                  <Input
                    id="retentionDays"
                    type="number"
                    min={1}
                    max={365}
                    value={formData.retentionDays}
                    onChange={(e) =>
                      setFormData({ ...formData, retentionDays: parseInt(e.target.value) || 30 })
                    }
                  />
                  <p className="text-xs text-[#6b6b7b]">
                    How long to keep recording data before automatic deletion
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-4">
            <Link href="/sites" className="flex-1">
              <Button type="button" variant="outline" className="w-full">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Site"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
