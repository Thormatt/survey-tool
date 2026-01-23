"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  MousePointer,
  Move,
  ArrowDown,
  Eye,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface PageWithHeatmapData {
  pagePath: string;
  totalDataPoints: number;
  clicks: number;
  moves: number;
  scrolls: number;
  sessions: number;
}

interface HeatmapData {
  pagePath: string;
  heatmaps: Array<{
    type: string;
    totalClicks: number;
    totalMoves: number;
    totalScrolls: number;
    dataPoints: Array<{
      x: number;
      y: number;
      count: number;
      selector?: string;
      scrollDepth?: number;
    }>;
  }>;
  stats: {
    totalSessions: number;
    avgDuration: number | null;
    avgScrollDepth: number | null;
  };
}

interface SiteData {
  name: string;
  domain: string;
}

export default function HeatmapsPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [site, setSite] = useState<SiteData | null>(null);
  const [pages, setPages] = useState<PageWithHeatmapData[]>([]);
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
  const [activeType, setActiveType] = useState<"CLICK" | "MOVE" | "SCROLL">("CLICK");
  const [loading, setLoading] = useState(true);

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
  }, [siteId]);

  useEffect(() => {
    const fetchPages = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/sites/${siteId}/heatmaps`, { method: "POST" });
        const data = await response.json();
        if (response.ok) {
          setPages(data.data);
          if (data.data.length > 0 && !selectedPage) {
            setSelectedPage(data.data[0].pagePath);
          }
        }
      } catch (error) {
        console.error("Failed to fetch pages:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPages();
  }, [siteId, selectedPage]);

  const fetchHeatmapData = useCallback(async () => {
    if (!selectedPage) return;
    try {
      const response = await fetch(
        `/api/sites/${siteId}/heatmaps?pagePath=${encodeURIComponent(selectedPage)}&type=${activeType}`
      );
      const data = await response.json();
      if (response.ok) {
        setHeatmapData(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch heatmap data:", error);
    }
  }, [siteId, selectedPage, activeType]);

  useEffect(() => {
    fetchHeatmapData();
  }, [fetchHeatmapData]);

  const getActiveHeatmap = () => {
    if (!heatmapData) return null;
    return heatmapData.heatmaps.find((h) => h.type === activeType);
  };

  const activeHeatmap = getActiveHeatmap();

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
              <h1 className="font-['Syne'] font-semibold text-lg">Heatmaps</h1>
              <p className="text-sm text-[#6b6b7b]">{site?.name || "Loading..."}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-[#6b6b7b]">Loading heatmap data...</p>
          </div>
        ) : pages.length === 0 ? (
          <Card className="border-dashed max-w-2xl mx-auto">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-[#dcd6f6] flex items-center justify-center mx-auto mb-4">
                <MousePointer className="w-8 h-8 text-[#1a1a2e]" />
              </div>
              <h3 className="font-['Syne'] text-lg font-semibold mb-2">No heatmap data yet</h3>
              <p className="text-[#6b6b7b] mb-6 max-w-md mx-auto">
                Heatmap data will be collected as visitors interact with your site.
              </p>
              <Link href={`/sites/${siteId}/install`}>
                <Button>Check Installation</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Page Selector Sidebar */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Pages</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[60vh] overflow-y-auto">
                    {pages.map((page) => (
                      <button
                        key={page.pagePath}
                        onClick={() => setSelectedPage(page.pagePath)}
                        className={`w-full text-left p-3 border-b border-[#dcd6f6] last:border-b-0 hover:bg-[#f5f0e5] transition-colors ${
                          selectedPage === page.pagePath ? "bg-[#f5f0e5]" : ""
                        }`}
                      >
                        <p className="text-sm font-medium truncate">{page.pagePath}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {page.sessions} sessions
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {page.clicks} clicks
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Heatmap Display */}
            <div className="lg:col-span-3">
              <Card className="mb-4">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Button
                      variant={activeType === "CLICK" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActiveType("CLICK")}
                    >
                      <MousePointer className="w-4 h-4 mr-2" />
                      Clicks
                    </Button>
                    <Button
                      variant={activeType === "MOVE" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActiveType("MOVE")}
                    >
                      <Move className="w-4 h-4 mr-2" />
                      Movement
                    </Button>
                    <Button
                      variant={activeType === "SCROLL" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActiveType("SCROLL")}
                    >
                      <ArrowDown className="w-4 h-4 mr-2" />
                      Scroll
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {selectedPage && heatmapData && (
                <>
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <Card>
                      <CardContent className="p-4 text-center">
                        <p className="text-2xl font-semibold">{heatmapData.stats.totalSessions}</p>
                        <p className="text-sm text-[#6b6b7b]">Sessions</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <p className="text-2xl font-semibold">
                          {heatmapData.stats.avgScrollDepth
                            ? `${Math.round(heatmapData.stats.avgScrollDepth)}%`
                            : "-"}
                        </p>
                        <p className="text-sm text-[#6b6b7b]">Avg Scroll</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <p className="text-2xl font-semibold">
                          {activeHeatmap
                            ? activeType === "CLICK"
                              ? activeHeatmap.totalClicks
                              : activeType === "MOVE"
                              ? activeHeatmap.totalMoves
                              : activeHeatmap.totalScrolls
                            : 0}
                        </p>
                        <p className="text-sm text-[#6b6b7b]">
                          {activeType === "CLICK" ? "Clicks" : activeType === "MOVE" ? "Movements" : "Scrolls"}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Heatmap Preview Area */}
                  <Card>
                    <CardContent className="p-6">
                      {activeHeatmap && activeHeatmap.dataPoints.length > 0 ? (
                        <div className="relative bg-gray-100 rounded-lg min-h-[400px] flex items-center justify-center">
                          <div className="text-center">
                            <Eye className="w-12 h-12 text-[#6b6b7b] mx-auto mb-4" />
                            <p className="text-[#6b6b7b] mb-2">
                              Heatmap visualization would display here
                            </p>
                            <p className="text-sm text-[#6b6b7b]">
                              {activeHeatmap.dataPoints.length} data points collected
                            </p>
                            <p className="text-xs text-[#6b6b7b] mt-4 max-w-md mx-auto">
                              To see the full heatmap overlay, the page would need to be rendered
                              with the heatmap data points visualized on top.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <p className="text-[#6b6b7b]">
                            No {activeType.toLowerCase()} data for this page yet
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
