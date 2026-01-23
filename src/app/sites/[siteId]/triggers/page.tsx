"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  Plus,
  Zap,
  Trash2,
  Pencil,
  X,
  Loader2,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Survey {
  id: string;
  title: string;
  published: boolean;
}

interface PageTarget {
  id: string;
  name: string;
  urlPattern: string;
  matchType: string;
}

interface SurveyTrigger {
  id: string;
  triggerType: string;
  triggerValue: string | null;
  triggerSelector: string | null;
  displayMode: string;
  displayPosition: string | null;
  displayDelay: number;
  showOnce: boolean;
  cooldownDays: number;
  percentageShow: number;
  enabled: boolean;
  survey: {
    id: string;
    title: string;
    published: boolean;
  };
  pageTarget: PageTarget | null;
}

interface SiteData {
  name: string;
  domain: string;
}

const TRIGGER_TYPES = [
  { value: "PAGE_LOAD", label: "Page Load", description: "Show when page loads" },
  { value: "EXIT_INTENT", label: "Exit Intent", description: "Show when user is about to leave" },
  { value: "SCROLL_DEPTH", label: "Scroll Depth", description: "Show after scrolling X%" },
  { value: "TIME_ON_PAGE", label: "Time on Page", description: "Show after X seconds" },
  { value: "ELEMENT_CLICK", label: "Element Click", description: "Show when element is clicked" },
  { value: "ELEMENT_VISIBLE", label: "Element Visible", description: "Show when element is visible" },
];

const DISPLAY_MODES = [
  { value: "POPUP", label: "Popup" },
  { value: "SLIDE_IN", label: "Slide In" },
  { value: "EMBEDDED", label: "Embedded" },
  { value: "BANNER", label: "Banner" },
  { value: "FULL_PAGE", label: "Full Page" },
];

export default function TriggersPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [site, setSite] = useState<SiteData | null>(null);
  const [triggers, setTriggers] = useState<SurveyTrigger[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [pageTargets, setPageTargets] = useState<PageTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    surveyId: "",
    pageTargetId: "",
    triggerType: "PAGE_LOAD",
    triggerValue: "",
    triggerSelector: "",
    displayMode: "POPUP",
    displayPosition: "",
    displayDelay: 0,
    showOnce: true,
    cooldownDays: 7,
    percentageShow: 100,
    enabled: true,
  });

  const fetchTriggers = useCallback(async () => {
    try {
      const response = await fetch(`/api/sites/${siteId}/triggers?includeDisabled=true`);
      const data = await response.json();
      if (response.ok) {
        setTriggers(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch triggers:", error);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [siteRes, surveysRes, pagesRes] = await Promise.all([
          fetch(`/api/sites/${siteId}`),
          fetch("/api/surveys"),
          fetch(`/api/sites/${siteId}/pages`),
        ]);

        const [siteData, surveysData, pagesData] = await Promise.all([
          siteRes.json(),
          surveysRes.json(),
          pagesRes.json(),
        ]);

        if (siteRes.ok) {
          setSite({ name: siteData.data.name, domain: siteData.data.domain });
        }
        if (surveysRes.ok) {
          setSurveys(surveysData.data || []);
        }
        if (pagesRes.ok) {
          setPageTargets(pagesData.data || []);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
    };

    fetchData();
    fetchTriggers();
  }, [siteId, fetchTriggers]);

  const resetForm = () => {
    setFormData({
      surveyId: "",
      pageTargetId: "",
      triggerType: "PAGE_LOAD",
      triggerValue: "",
      triggerSelector: "",
      displayMode: "POPUP",
      displayPosition: "",
      displayDelay: 0,
      showOnce: true,
      cooldownDays: 7,
      percentageShow: 100,
      enabled: true,
    });
    setEditingId(null);
    setShowForm(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const url = editingId
        ? `/api/sites/${siteId}/triggers/${editingId}`
        : `/api/sites/${siteId}/triggers`;
      const method = editingId ? "PATCH" : "POST";

      const payload = {
        ...formData,
        pageTargetId: formData.pageTargetId || null,
        triggerValue: formData.triggerValue || null,
        triggerSelector: formData.triggerSelector || null,
        displayPosition: formData.displayPosition || null,
      };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save trigger");
      }

      resetForm();
      fetchTriggers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (trigger: SurveyTrigger) => {
    setFormData({
      surveyId: trigger.survey.id,
      pageTargetId: trigger.pageTarget?.id || "",
      triggerType: trigger.triggerType,
      triggerValue: trigger.triggerValue || "",
      triggerSelector: trigger.triggerSelector || "",
      displayMode: trigger.displayMode,
      displayPosition: trigger.displayPosition || "",
      displayDelay: trigger.displayDelay,
      showOnce: trigger.showOnce,
      cooldownDays: trigger.cooldownDays,
      percentageShow: trigger.percentageShow,
      enabled: trigger.enabled,
    });
    setEditingId(trigger.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this trigger?")) return;

    try {
      const response = await fetch(`/api/sites/${siteId}/triggers/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchTriggers();
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  const needsValue = ["SCROLL_DEPTH", "TIME_ON_PAGE"].includes(formData.triggerType);
  const needsSelector = ["ELEMENT_CLICK", "ELEMENT_VISIBLE"].includes(formData.triggerType);

  return (
    <div className="min-h-screen bg-[#fbf5ea]">
      <header className="border-b border-[#dcd6f6]">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/sites/${siteId}`}
                className="text-[#6b6b7b] hover:text-[#1a1a2e] transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="font-['Syne'] font-semibold text-lg">Survey Triggers</h1>
                <p className="text-sm text-[#6b6b7b]">{site?.name || "Loading..."}</p>
              </div>
            </div>
            {!showForm && (
              <Button size="sm" onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Trigger
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 max-w-4xl">
        {showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{editingId ? "Edit" : "New"} Survey Trigger</CardTitle>
              <CardDescription>
                Configure when and how surveys appear on your site
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="surveyId">Survey</Label>
                    <select
                      id="surveyId"
                      className="w-full px-3 py-2 border border-[#dcd6f6] rounded-md bg-white text-sm"
                      value={formData.surveyId}
                      onChange={(e) => setFormData({ ...formData, surveyId: e.target.value })}
                      required
                    >
                      <option value="">Select a survey...</option>
                      {surveys.map((survey) => (
                        <option key={survey.id} value={survey.id}>
                          {survey.title} {survey.published ? "(Published)" : "(Draft)"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pageTargetId">Page Target (Optional)</Label>
                    <select
                      id="pageTargetId"
                      className="w-full px-3 py-2 border border-[#dcd6f6] rounded-md bg-white text-sm"
                      value={formData.pageTargetId}
                      onChange={(e) => setFormData({ ...formData, pageTargetId: e.target.value })}
                    >
                      <option value="">All pages</option>
                      {pageTargets.map((target) => (
                        <option key={target.id} value={target.id}>
                          {target.name} ({target.urlPattern})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Trigger Type</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {TRIGGER_TYPES.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, triggerType: type.value })}
                        className={`p-3 border rounded-lg text-left transition-colors ${
                          formData.triggerType === type.value
                            ? "border-[#1a1a2e] bg-[#f5f0e5]"
                            : "border-[#dcd6f6] hover:border-[#c9c1ed]"
                        }`}
                      >
                        <p className="text-sm font-medium">{type.label}</p>
                        <p className="text-xs text-[#6b6b7b]">{type.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {needsValue && (
                  <div className="space-y-2">
                    <Label htmlFor="triggerValue">
                      {formData.triggerType === "SCROLL_DEPTH" ? "Scroll Percentage (%)" : "Time (seconds)"}
                    </Label>
                    <Input
                      id="triggerValue"
                      type="number"
                      min={0}
                      placeholder={formData.triggerType === "SCROLL_DEPTH" ? "50" : "30"}
                      value={formData.triggerValue}
                      onChange={(e) => setFormData({ ...formData, triggerValue: e.target.value })}
                    />
                  </div>
                )}

                {needsSelector && (
                  <div className="space-y-2">
                    <Label htmlFor="triggerSelector">CSS Selector</Label>
                    <Input
                      id="triggerSelector"
                      placeholder="e.g., #checkout-btn or .cta-button"
                      value={formData.triggerSelector}
                      onChange={(e) => setFormData({ ...formData, triggerSelector: e.target.value })}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="displayMode">Display Mode</Label>
                    <select
                      id="displayMode"
                      className="w-full px-3 py-2 border border-[#dcd6f6] rounded-md bg-white text-sm"
                      value={formData.displayMode}
                      onChange={(e) => setFormData({ ...formData, displayMode: e.target.value })}
                    >
                      {DISPLAY_MODES.map((mode) => (
                        <option key={mode.value} value={mode.value}>
                          {mode.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="displayDelay">Display Delay (ms)</Label>
                    <Input
                      id="displayDelay"
                      type="number"
                      min={0}
                      value={formData.displayDelay}
                      onChange={(e) =>
                        setFormData({ ...formData, displayDelay: parseInt(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cooldownDays">Cooldown (days)</Label>
                    <Input
                      id="cooldownDays"
                      type="number"
                      min={0}
                      value={formData.cooldownDays}
                      onChange={(e) =>
                        setFormData({ ...formData, cooldownDays: parseInt(e.target.value) || 0 })
                      }
                    />
                    <p className="text-xs text-[#6b6b7b]">Days before showing again to same visitor</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="percentageShow">Show to % of visitors</Label>
                    <Input
                      id="percentageShow"
                      type="number"
                      min={1}
                      max={100}
                      value={formData.percentageShow}
                      onChange={(e) =>
                        setFormData({ ...formData, percentageShow: parseInt(e.target.value) || 100 })
                      }
                    />
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="showOnce"
                      checked={formData.showOnce}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, showOnce: checked as boolean })
                      }
                    />
                    <Label htmlFor="showOnce" className="cursor-pointer">
                      Show only once per session
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="enabled"
                      checked={formData.enabled}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, enabled: checked as boolean })
                      }
                    />
                    <Label htmlFor="enabled" className="cursor-pointer">
                      Active
                    </Label>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : editingId ? (
                      "Update Trigger"
                    ) : (
                      "Create Trigger"
                    )}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="text-center py-12">
            <p className="text-[#6b6b7b]">Loading triggers...</p>
          </div>
        ) : triggers.length === 0 && !showForm ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-[#dcd6f6] flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-[#1a1a2e]" />
              </div>
              <h3 className="font-['Syne'] text-lg font-semibold mb-2">No triggers yet</h3>
              <p className="text-[#6b6b7b] mb-6 max-w-md mx-auto">
                Create triggers to automatically show surveys to your visitors.
              </p>
              {surveys.length === 0 ? (
                <Link href="/surveys/new">
                  <Button>
                    <FileText className="w-4 h-4 mr-2" />
                    Create a Survey First
                  </Button>
                </Link>
              ) : (
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Trigger
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {triggers.map((trigger) => (
              <Card key={trigger.id} className={!trigger.enabled ? "opacity-60" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{trigger.survey.title}</span>
                        <Badge variant={trigger.enabled ? "highlight" : "secondary"}>
                          {trigger.enabled ? "Active" : "Disabled"}
                        </Badge>
                        <Badge variant="outline">{trigger.triggerType}</Badge>
                        <Badge variant="outline">{trigger.displayMode}</Badge>
                      </div>
                      <p className="text-sm text-[#6b6b7b]">
                        {trigger.pageTarget
                          ? `On: ${trigger.pageTarget.name}`
                          : "All pages"}
                        {trigger.triggerValue && ` | Value: ${trigger.triggerValue}`}
                        {trigger.percentageShow < 100 && ` | ${trigger.percentageShow}% of visitors`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(trigger)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDelete(trigger.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
