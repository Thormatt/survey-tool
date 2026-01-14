"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, BarChart3, TrendingUp, Users, FileText, Loader2 } from "lucide-react";
import Link from "next/link";

interface AnalyticsData {
  totalSurveys: number;
  publishedSurveys: number;
  totalResponses: number;
  responsesThisWeek: number;
  recentSurveys: {
    id: string;
    title: string;
    responseCount: number;
    published: boolean;
    createdAt: string;
  }[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const response = await fetch("/api/analytics");
        if (!response.ok) throw new Error("Failed to fetch analytics");
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError("Failed to load analytics");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbf5ea] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#6b6b7b]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#fbf5ea] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  const hasData = data && data.totalSurveys > 0;

  return (
    <div className="min-h-screen bg-[#fbf5ea]">
      {/* Header */}
      <header className="border-b border-[#dcd6f6]">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-[#6b6b7b] hover:text-[#1a1a2e] transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="font-['Syne'] font-semibold text-lg">Analytics</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 max-w-6xl">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[#6b6b7b]">Total Surveys</CardTitle>
              <FileText className="w-4 h-4 text-[#6b6b7b]" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-['Syne'] font-bold">{data?.totalSurveys ?? 0}</div>
              <p className="text-xs text-[#6b6b7b] mt-1">
                {data?.publishedSurveys ?? 0} published
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[#6b6b7b]">Total Responses</CardTitle>
              <Users className="w-4 h-4 text-[#6b6b7b]" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-['Syne'] font-bold">{data?.totalResponses ?? 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[#6b6b7b]">Avg. per Survey</CardTitle>
              <TrendingUp className="w-4 h-4 text-[#6b6b7b]" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-['Syne'] font-bold">
                {data && data.totalSurveys > 0
                  ? (data.totalResponses / data.totalSurveys).toFixed(1)
                  : "—"}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[#6b6b7b]">This Week</CardTitle>
              <BarChart3 className="w-4 h-4 text-[#6b6b7b]" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-['Syne'] font-bold">{data?.responsesThisWeek ?? 0}</div>
              <p className="text-xs text-[#6b6b7b] mt-1">responses</p>
            </CardContent>
          </Card>
        </div>

        {hasData ? (
          /* Recent Surveys */
          <Card>
            <CardHeader>
              <CardTitle className="font-['Syne']">Recent Surveys</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.recentSurveys.map((survey) => (
                  <Link
                    key={survey.id}
                    href={`/surveys/${survey.id}`}
                    className="flex items-center justify-between p-4 rounded-lg border border-[#dcd6f6] hover:border-[#c9c1ed] hover:bg-white/50 transition-all"
                  >
                    <div>
                      <h3 className="font-medium">{survey.title}</h3>
                      <p className="text-sm text-[#6b6b7b]">
                        {new Date(survey.createdAt).toLocaleDateString()}
                        {!survey.published && " • Draft"}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-['Syne'] font-bold">{survey.responseCount}</div>
                      <p className="text-xs text-[#6b6b7b]">responses</p>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Empty State */
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-[#dcd6f6] flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-8 h-8 text-[#1a1a2e]" />
              </div>
              <h3 className="font-['Syne'] text-lg font-semibold mb-2">No data yet</h3>
              <p className="text-[#6b6b7b] mb-6 max-w-md mx-auto">
                Create and publish a survey to start seeing analytics here.
              </p>
              <Link href="/surveys/new">
                <Button>Create a Survey</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
