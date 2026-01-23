"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Video,
  Search,
  Filter,
  Clock,
  MousePointer,
  AlertCircle,
  Monitor,
  Smartphone,
  Tablet,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Recording {
  id: string;
  visitorId: string;
  sessionToken: string;
  pagePath: string;
  pageTitle: string | null;
  startedAt: string;
  endedAt: string | null;
  duration: number | null;
  eventCount: number;
  clickCount: number;
  scrollDepth: number | null;
  rageClicks: number;
  deadClicks: number;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  screenWidth: number | null;
  screenHeight: number | null;
  country: string | null;
  referrer: string | null;
  status: string;
}

interface SiteData {
  name: string;
  domain: string;
}

export default function RecordingsPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [site, setSite] = useState<SiteData | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [filters, setFilters] = useState({
    pagePath: "",
    device: "",
    minDuration: "",
    startDate: "",
    endDate: "",
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
  });

  const fetchRecordings = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (filters.pagePath) queryParams.set("pagePath", filters.pagePath);
      if (filters.device) queryParams.set("device", filters.device);
      if (filters.minDuration) queryParams.set("minDuration", filters.minDuration);
      if (filters.startDate) queryParams.set("startDate", filters.startDate);
      if (filters.endDate) queryParams.set("endDate", filters.endDate);

      const response = await fetch(`/api/sites/${siteId}/recordings?${queryParams}`);
      const data = await response.json();

      if (response.ok) {
        setRecordings(data.data.items);
        setPagination((prev) => ({ ...prev, total: data.data.total }));
      }
    } catch (error) {
      console.error("Failed to fetch recordings:", error);
    } finally {
      setLoading(false);
    }
  }, [siteId, pagination.page, pagination.limit, filters]);

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
    fetchRecordings();
  }, [fetchRecordings]);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const getDeviceIcon = (device: string | null) => {
    if (!device) return <Monitor className="w-4 h-4" />;
    const d = device.toLowerCase();
    if (d.includes("mobile") || d.includes("phone")) return <Smartphone className="w-4 h-4" />;
    if (d.includes("tablet") || d.includes("ipad")) return <Tablet className="w-4 h-4" />;
    return <Monitor className="w-4 h-4" />;
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

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
                <h1 className="font-['Syne'] font-semibold text-lg">Recordings</h1>
                <p className="text-sm text-[#6b6b7b]">{site?.name || "Loading..."}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 max-w-5xl">
        {filtersOpen && (
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Page Path</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b7b]" />
                    <Input
                      placeholder="Filter by path..."
                      value={filters.pagePath}
                      onChange={(e) => setFilters({ ...filters, pagePath: e.target.value })}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Device</label>
                  <select
                    className="w-full px-3 py-2 border border-[#dcd6f6] rounded-md bg-white text-sm"
                    value={filters.device}
                    onChange={(e) => setFilters({ ...filters, device: e.target.value })}
                  >
                    <option value="">All devices</option>
                    <option value="desktop">Desktop</option>
                    <option value="mobile">Mobile</option>
                    <option value="tablet">Tablet</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Min Duration (sec)</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={filters.minDuration}
                    onChange={(e) => setFilters({ ...filters, minDuration: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Start Date</label>
                  <Input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">End Date</label>
                  <Input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  />
                </div>

              </div>

              <div className="mt-4 flex gap-2">
                <Button size="sm" onClick={() => { setPagination({ ...pagination, page: 1 }); fetchRecordings(); }}>
                  Apply Filters
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setFilters({
                      pagePath: "",
                      device: "",
                      minDuration: "",
                      startDate: "",
                      endDate: "",
                    });
                    setPagination({ ...pagination, page: 1 });
                  }}
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="text-center py-12">
            <p className="text-[#6b6b7b]">Loading recordings...</p>
          </div>
        ) : recordings.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-[#dcd6f6] flex items-center justify-center mx-auto mb-4">
                <Video className="w-8 h-8 text-[#1a1a2e]" />
              </div>
              <h3 className="font-['Syne'] text-lg font-semibold mb-2">No recordings yet</h3>
              <p className="text-[#6b6b7b] mb-6 max-w-md mx-auto">
                Recordings will appear here once visitors start browsing your site.
              </p>
              <Link href={`/sites/${siteId}/install`}>
                <Button>Check Installation</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-3">
              {recordings.map((recording) => (
                <Card key={recording.id} className="hover:border-[#c9c1ed] transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate max-w-md">
                            {recording.pagePath}
                          </span>
                          {recording.rageClicks > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Rage clicks
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-[#6b6b7b]">
                          <span className="flex items-center gap-1">
                            {getDeviceIcon(recording.deviceType)}
                            {recording.browser || "Unknown"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatDuration(recording.duration)}
                          </span>
                          <span className="flex items-center gap-1">
                            <MousePointer className="w-4 h-4" />
                            {recording.clickCount} clicks
                          </span>
                          {recording.scrollDepth && (
                            <span>{Math.round(recording.scrollDepth)}% scrolled</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-[#6b6b7b]">{formatDate(recording.startedAt)}</p>
                        <p className="text-xs text-[#6b6b7b]">{recording.country || "Unknown location"}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                  disabled={pagination.page === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-[#6b6b7b]">
                  Page {pagination.page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                  disabled={pagination.page === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
