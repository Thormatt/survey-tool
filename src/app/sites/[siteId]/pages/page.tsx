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
  LayoutGrid,
  Trash2,
  Pencil,
  X,
  Loader2,
  Video,
  MousePointer,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface PageTarget {
  id: string;
  name: string;
  urlPattern: string;
  matchType: string;
  recordingEnabled: boolean | null;
  heatmapsEnabled: boolean | null;
  priority: number;
  enabled: boolean;
  _count: {
    surveyTriggers: number;
  };
}

interface SiteData {
  name: string;
  domain: string;
}

const MATCH_TYPES = [
  { value: "EXACT", label: "Exact Match", description: "URL must match exactly" },
  { value: "STARTS_WITH", label: "Starts With", description: "URL must start with this pattern" },
  { value: "CONTAINS", label: "Contains", description: "URL must contain this pattern" },
  { value: "GLOB", label: "Glob Pattern", description: "Use * for wildcards (e.g., /blog/*)" },
  { value: "REGEX", label: "Regular Expression", description: "Advanced pattern matching" },
];

export default function PagesPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [site, setSite] = useState<SiteData | null>(null);
  const [pageTargets, setPageTargets] = useState<PageTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    urlPattern: "",
    matchType: "GLOB",
    recordingEnabled: true,
    heatmapsEnabled: true,
    priority: 0,
    enabled: true,
  });

  const fetchPageTargets = useCallback(async () => {
    try {
      const response = await fetch(`/api/sites/${siteId}/pages`);
      const data = await response.json();
      if (response.ok) {
        setPageTargets(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch page targets:", error);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    const fetchSite = async () => {
      try {
        const response = await fetch(`/api/sites/${siteId}`);
        const data = await response.json();
        if (response.ok) {
          setSite({ name: data.data.name, domain: data.data.domain });
        }
      } catch (error) {
        console.error("Failed to fetch site:", error);
      }
    };
    fetchSite();
    fetchPageTargets();
  }, [siteId, fetchPageTargets]);

  const resetForm = () => {
    setFormData({
      name: "",
      urlPattern: "",
      matchType: "GLOB",
      recordingEnabled: true,
      heatmapsEnabled: true,
      priority: 0,
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
        ? `/api/sites/${siteId}/pages/${editingId}`
        : `/api/sites/${siteId}/pages`;
      const method = editingId ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save page target");
      }

      resetForm();
      fetchPageTargets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (target: PageTarget) => {
    setFormData({
      name: target.name,
      urlPattern: target.urlPattern,
      matchType: target.matchType,
      recordingEnabled: target.recordingEnabled ?? true,
      heatmapsEnabled: target.heatmapsEnabled ?? true,
      priority: target.priority,
      enabled: target.enabled,
    });
    setEditingId(target.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this page target?")) return;

    try {
      const response = await fetch(`/api/sites/${siteId}/pages/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchPageTargets();
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

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
                <h1 className="font-['Syne'] font-semibold text-lg">Page Targeting</h1>
                <p className="text-sm text-[#6b6b7b]">{site?.name || "Loading..."}</p>
              </div>
            </div>
            {!showForm && (
              <Button size="sm" onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Page Target
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 max-w-4xl">
        {showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{editingId ? "Edit" : "New"} Page Target</CardTitle>
              <CardDescription>
                Define URL patterns to target specific pages for recordings, heatmaps, or surveys
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
                    <Label htmlFor="name">Target Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Blog Pages"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Input
                      id="priority"
                      type="number"
                      min={0}
                      max={100}
                      value={formData.priority}
                      onChange={(e) =>
                        setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })
                      }
                    />
                    <p className="text-xs text-[#6b6b7b]">Higher priority targets match first</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="urlPattern">URL Pattern</Label>
                  <Input
                    id="urlPattern"
                    placeholder="e.g., /blog/* or /products/[0-9]+"
                    value={formData.urlPattern}
                    onChange={(e) => setFormData({ ...formData, urlPattern: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Match Type</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {MATCH_TYPES.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, matchType: type.value })}
                        className={`p-3 border rounded-lg text-left transition-colors ${
                          formData.matchType === type.value
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

                <div className="flex items-center gap-6">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="recordingEnabled"
                      checked={formData.recordingEnabled}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, recordingEnabled: checked as boolean })
                      }
                    />
                    <Label htmlFor="recordingEnabled" className="cursor-pointer">
                      <Video className="w-4 h-4 inline mr-1" />
                      Enable Recordings
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="heatmapsEnabled"
                      checked={formData.heatmapsEnabled}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, heatmapsEnabled: checked as boolean })
                      }
                    />
                    <Label htmlFor="heatmapsEnabled" className="cursor-pointer">
                      <MousePointer className="w-4 h-4 inline mr-1" />
                      Enable Heatmaps
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
                      "Update Target"
                    ) : (
                      "Create Target"
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
            <p className="text-[#6b6b7b]">Loading page targets...</p>
          </div>
        ) : pageTargets.length === 0 && !showForm ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-[#dcd6f6] flex items-center justify-center mx-auto mb-4">
                <LayoutGrid className="w-8 h-8 text-[#1a1a2e]" />
              </div>
              <h3 className="font-['Syne'] text-lg font-semibold mb-2">No page targets yet</h3>
              <p className="text-[#6b6b7b] mb-6 max-w-md mx-auto">
                Create page targets to control which pages are recorded or tracked.
              </p>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Target
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pageTargets.map((target) => (
              <Card key={target.id} className={!target.enabled ? "opacity-60" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{target.name}</span>
                        <Badge variant={target.enabled ? "highlight" : "secondary"}>
                          {target.enabled ? "Active" : "Disabled"}
                        </Badge>
                        <Badge variant="outline">{target.matchType}</Badge>
                        {target.recordingEnabled && (
                          <Badge variant="outline" className="text-xs">
                            <Video className="w-3 h-3 mr-1" />
                            Rec
                          </Badge>
                        )}
                        {target.heatmapsEnabled && (
                          <Badge variant="outline" className="text-xs">
                            <MousePointer className="w-3 h-3 mr-1" />
                            Heat
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-[#6b6b7b] font-mono">{target.urlPattern}</p>
                      <p className="text-xs text-[#6b6b7b] mt-1">
                        Priority: {target.priority} | {target._count.surveyTriggers} trigger(s)
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(target)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDelete(target.id)}
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
