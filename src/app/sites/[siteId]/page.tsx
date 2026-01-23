import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Video,
  MousePointer,
  Users,
  Clock,
  TrendingUp,
  Settings,
  Code,
  LayoutGrid,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ siteId: string }>;
}

async function getSite(siteId: string, userId: string) {
  const site = await db.site.findFirst({
    where: { id: siteId, userId },
    include: {
      pageTargets: {
        orderBy: { priority: "desc" },
        take: 5,
      },
      surveyTriggers: {
        take: 5,
      },
      _count: {
        select: {
          recordings: true,
          pageTargets: true,
          surveyTriggers: true,
          heatmapData: true,
        },
      },
    },
  });

  if (!site) return null;

  // Fetch surveys for triggers
  const surveyIds = [...new Set(site.surveyTriggers.map((t) => t.surveyId))];
  const surveys = await db.survey.findMany({
    where: { id: { in: surveyIds } },
    select: { id: true, title: true },
  });
  const surveyMap = new Map(surveys.map((s) => [s.id, s]));

  // Combine triggers with survey data
  const surveyTriggersWithSurveys = site.surveyTriggers.map((trigger) => ({
    ...trigger,
    survey: surveyMap.get(trigger.surveyId) || { id: trigger.surveyId, title: "Unknown" },
  }));

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalRecordings,
    recordingsThisWeek,
    recordingsThisMonth,
    uniqueVisitors,
    avgDuration,
    topPages,
  ] = await Promise.all([
    db.siteRecording.count({ where: { siteId } }),
    db.siteRecording.count({ where: { siteId, startedAt: { gte: weekAgo } } }),
    db.siteRecording.count({ where: { siteId, startedAt: { gte: monthAgo } } }),
    db.siteRecording.groupBy({ by: ["visitorId"], where: { siteId }, _count: true }),
    db.siteRecording.aggregate({
      where: { siteId, duration: { not: null } },
      _avg: { duration: true },
    }),
    db.siteRecording.groupBy({
      by: ["pagePath"],
      where: { siteId },
      _count: { pagePath: true },
      orderBy: { _count: { pagePath: "desc" } },
      take: 5,
    }),
  ]);

  return {
    ...site,
    surveyTriggers: surveyTriggersWithSurveys,
    stats: {
      totalRecordings,
      recordingsThisWeek,
      recordingsThisMonth,
      uniqueVisitors: uniqueVisitors.length,
      avgDuration: avgDuration._avg.duration || 0,
      topPages: topPages.map((p) => ({ path: p.pagePath, views: p._count.pagePath })),
    },
  };
}

export default async function SiteDashboardPage({ params }: PageProps) {
  const { userId } = await auth();
  if (!userId) {
    return (
      <div className="min-h-screen bg-[#fbf5ea] flex items-center justify-center">
        <p className="text-[#6b6b7b]">Please sign in to view this site.</p>
      </div>
    );
  }

  const { siteId } = await params;
  const site = await getSite(siteId, userId);

  if (!site) {
    notFound();
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="min-h-screen bg-[#fbf5ea]">
      <header className="border-b border-[#dcd6f6]">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/sites" className="text-[#6b6b7b] hover:text-[#1a1a2e] transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-['Syne'] font-semibold text-lg">{site.name}</h1>
                  <Badge variant={site.enabled ? "highlight" : "secondary"}>
                    {site.enabled ? "Active" : "Disabled"}
                  </Badge>
                </div>
                <p className="text-sm text-[#6b6b7b]">{site.domain}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/sites/${siteId}/install`}>
                <Button variant="outline" size="sm">
                  <Code className="w-4 h-4 mr-2" />
                  Install
                </Button>
              </Link>
              <Link href={`/sites/${siteId}/settings`}>
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#dcd6f6] flex items-center justify-center">
                  <Video className="w-6 h-6 text-[#1a1a2e]" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{site.stats.totalRecordings}</p>
                  <p className="text-sm text-[#6b6b7b]">Total Recordings</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#dcd6f6] flex items-center justify-center">
                  <Users className="w-6 h-6 text-[#1a1a2e]" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{site.stats.uniqueVisitors}</p>
                  <p className="text-sm text-[#6b6b7b]">Unique Visitors</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#dcd6f6] flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-[#1a1a2e]" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{site.stats.recordingsThisWeek}</p>
                  <p className="text-sm text-[#6b6b7b]">This Week</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#dcd6f6] flex items-center justify-center">
                  <Clock className="w-6 h-6 text-[#1a1a2e]" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{formatDuration(site.stats.avgDuration)}</p>
                  <p className="text-sm text-[#6b6b7b]">Avg. Duration</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Link href={`/sites/${siteId}/recordings`}>
            <Card className="hover:border-[#c9c1ed] transition-colors cursor-pointer h-full">
              <CardContent className="p-6 text-center">
                <Video className="w-8 h-8 mx-auto mb-3 text-[#1a1a2e]" />
                <h3 className="font-semibold mb-1">Recordings</h3>
                <p className="text-sm text-[#6b6b7b]">{site._count.recordings} sessions</p>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/sites/${siteId}/heatmaps`}>
            <Card className="hover:border-[#c9c1ed] transition-colors cursor-pointer h-full">
              <CardContent className="p-6 text-center">
                <MousePointer className="w-8 h-8 mx-auto mb-3 text-[#1a1a2e]" />
                <h3 className="font-semibold mb-1">Heatmaps</h3>
                <p className="text-sm text-[#6b6b7b]">{site._count.heatmapData} data points</p>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/sites/${siteId}/pages`}>
            <Card className="hover:border-[#c9c1ed] transition-colors cursor-pointer h-full">
              <CardContent className="p-6 text-center">
                <LayoutGrid className="w-8 h-8 mx-auto mb-3 text-[#1a1a2e]" />
                <h3 className="font-semibold mb-1">Page Targeting</h3>
                <p className="text-sm text-[#6b6b7b]">{site._count.pageTargets} targets</p>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/sites/${siteId}/triggers`}>
            <Card className="hover:border-[#c9c1ed] transition-colors cursor-pointer h-full">
              <CardContent className="p-6 text-center">
                <Zap className="w-8 h-8 mx-auto mb-3 text-[#1a1a2e]" />
                <h3 className="font-semibold mb-1">Survey Triggers</h3>
                <p className="text-sm text-[#6b6b7b]">{site._count.surveyTriggers} triggers</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Pages */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top Pages</CardTitle>
            </CardHeader>
            <CardContent>
              {site.stats.topPages.length === 0 ? (
                <p className="text-[#6b6b7b] text-sm">No page data yet</p>
              ) : (
                <div className="space-y-3">
                  {site.stats.topPages.map((page, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm truncate flex-1 mr-4">{page.path}</span>
                      <Badge variant="secondary">{page.views} views</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Triggers */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Survey Triggers</CardTitle>
              <Link href={`/sites/${siteId}/triggers`}>
                <Button variant="ghost" size="sm">
                  View All
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {site.surveyTriggers.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-[#6b6b7b] text-sm mb-3">No triggers configured</p>
                  <Link href={`/sites/${siteId}/triggers`}>
                    <Button size="sm" variant="outline">
                      Add Trigger
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {site.surveyTriggers.map((trigger) => (
                    <div key={trigger.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{trigger.survey.title}</p>
                        <p className="text-xs text-[#6b6b7b]">{trigger.triggerType}</p>
                      </div>
                      <Badge variant={trigger.enabled ? "highlight" : "secondary"}>
                        {trigger.enabled ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
