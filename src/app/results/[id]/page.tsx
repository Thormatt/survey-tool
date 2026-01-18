"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SkeletonResultsPage } from "@/components/ui/skeleton";
import {
  Loader2,
  Users,
  MessageSquare,
  Calendar,
  TrendingUp,
  BarChart3,
  ExternalLink,
  Radio,
  Wifi,
} from "lucide-react";
import Link from "next/link";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  AreaChart,
  Area,
} from "recharts";

interface Answer {
  id: string;
  questionId: string;
  value: unknown;
  response: {
    completedAt: string;
  };
}

interface Question {
  id: string;
  type: string;
  title: string;
  description?: string;
  required: boolean;
  options?: string[];
  answers: Answer[];
}

interface Survey {
  id: string;
  title: string;
  description?: string;
  isAnonymous: boolean;
  createdAt: string;
  questions: Question[];
  _count: {
    responses: number;
  };
}

// Beautiful color palette
const COLORS = [
  "#FF4F01", // Brand orange
  "#1a1a2e", // Dark navy
  "#c9c1ed", // Light purple
  "#dcd6f6", // Lighter purple
  "#6b6b7b", // Gray
  "#FF7A33", // Light orange
  "#2d2d44", // Medium navy
  "#a99de0", // Medium purple
];

export default function PublicResultsPage() {
  const params = useParams();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [newResponsesCount, setNewResponsesCount] = useState(0);
  const [showNotification, setShowNotification] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Handle real-time updates
  const handleRealtimeUpdate = useCallback((updatedSurvey: Survey, newResponses: number) => {
    setSurvey(updatedSurvey);
    if (newResponses > 0) {
      setNewResponsesCount((prev) => prev + newResponses);
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 5000);
    }
  }, []);

  // Connect to SSE for real-time updates
  useEffect(() => {
    if (loading || !survey) return;

    const connect = () => {
      const eventSource = new EventSource(`/api/surveys/${params.id}/results/public/stream`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "connected") {
            setIsConnected(true);
          } else if (data.type === "update" && data.survey) {
            handleRealtimeUpdate(data.survey, data.newResponses || 0);
          }
        } catch (err) {
          console.error("Error parsing SSE:", err);
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        eventSource.close();
        // Reconnect after 3 seconds
        setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [loading, survey, params.id, handleRealtimeUpdate]);

  useEffect(() => {
    async function fetchResults() {
      try {
        const response = await fetch(`/api/surveys/${params.id}/results/public`);
        if (!response.ok) {
          throw new Error("Results not found");
        }
        const data = await response.json();
        setSurvey(data);
      } catch {
        setError("Failed to load results");
      } finally {
        setLoading(false);
      }
    }

    fetchResults();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbf5ea] p-6">
        <div className="max-w-6xl mx-auto">
          <SkeletonResultsPage />
        </div>
      </div>
    );
  }

  if (error || !survey) {
    return (
      <div className="min-h-screen bg-[#fbf5ea]">
        <header className="border-b border-[#dcd6f6]">
          <div className="container mx-auto px-6 py-4">
            <Link href="/" className="font-['Syne'] font-bold text-xl">
              SurveyTool
            </Link>
          </div>
        </header>
        <div className="container mx-auto px-6 py-16 text-center">
          <h1 className="font-['Syne'] text-2xl font-bold mb-2">
            {error || "Results not found"}
          </h1>
          <p className="text-[#6b6b7b]">
            This survey results page may have been removed or is not publicly available.
          </p>
        </div>
      </div>
    );
  }

  // Calculate overview statistics
  const completionRate = survey.questions.length > 0
    ? (survey.questions.reduce((acc, q) => acc + q.answers.length, 0) /
        (survey.questions.length * survey._count.responses)) * 100
    : 0;

  const avgRating = survey.questions
    .filter((q) => q.type === "RATING")
    .reduce((acc, q) => {
      const values = q.answers.map((a) => Number(a.value)).filter((v) => !isNaN(v));
      return values.length > 0 ? acc + values.reduce((a, b) => a + b, 0) / values.length : acc;
    }, 0);

  const ratingQuestions = survey.questions.filter((q) => q.type === "RATING").length;

  return (
    <div className="min-h-screen bg-[#fbf5ea]">
      {/* New Response Notification */}
      {showNotification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="bg-[#FF4F01] text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3">
            <Radio className="w-5 h-5 animate-pulse" />
            <span className="font-semibold text-lg">
              +{newResponsesCount} new response{newResponsesCount !== 1 ? "s" : ""}!
            </span>
            <button
              onClick={() => setShowNotification(false)}
              className="ml-2 hover:bg-white/20 rounded-full p-1 text-xl"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-[#dcd6f6] bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-[#6b6b7b] mb-1">
              <span>Survey Results</span>
              <Badge variant="outline" className="text-xs">Public View</Badge>
              {/* Live indicator */}
              {isConnected && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                  <Wifi className="w-3 h-3" />
                  <span>Live</span>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                </div>
              )}
            </div>
            <h1 className="font-['Syne'] font-semibold text-lg">
              {survey.title}
            </h1>
          </div>
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-[#6b6b7b] hover:text-[#1a1a2e] transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Create your own survey
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 max-w-5xl">
        {/* Description */}
        {survey.description && (
          <p className="text-[#6b6b7b] mb-8 text-center max-w-2xl mx-auto">
            {survey.description}
          </p>
        )}

        {/* Hero Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-[#FF4F01] to-[#FF7A33] text-white">
            <CardContent className="p-6">
              <Users className="w-8 h-8 mb-3 opacity-80" />
              <div className="text-4xl font-['Syne'] font-bold">
                {survey._count.responses}
              </div>
              <div className="text-sm opacity-80">Total Responses</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-[#1a1a2e] to-[#2d2d44] text-white">
            <CardContent className="p-6">
              <MessageSquare className="w-8 h-8 mb-3 opacity-80" />
              <div className="text-4xl font-['Syne'] font-bold">
                {survey.questions.length}
              </div>
              <div className="text-sm opacity-80">Questions</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-[#c9c1ed] to-[#dcd6f6]">
            <CardContent className="p-6">
              <TrendingUp className="w-8 h-8 mb-3 text-[#1a1a2e] opacity-80" />
              <div className="text-4xl font-['Syne'] font-bold text-[#1a1a2e]">
                {isNaN(completionRate) ? "—" : `${completionRate.toFixed(0)}%`}
              </div>
              <div className="text-sm text-[#1a1a2e] opacity-80">Completion Rate</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <BarChart3 className="w-8 h-8 mb-3 text-[#FF4F01]" />
              <div className="text-4xl font-['Syne'] font-bold">
                {ratingQuestions > 0 ? (avgRating / ratingQuestions).toFixed(1) : "—"}
              </div>
              <div className="text-sm text-[#6b6b7b]">Avg. Rating</div>
            </CardContent>
          </Card>
        </div>

        {/* Response Timeline */}
        {survey._count.responses > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="font-['Syne'] flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Response Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponseTimeline survey={survey} />
            </CardContent>
          </Card>
        )}

        {survey._count.responses === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-[#dcd6f6] flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-[#1a1a2e]" />
              </div>
              <h3 className="font-['Syne'] text-lg font-semibold mb-2">
                No responses yet
              </h3>
              <p className="text-[#6b6b7b]">
                This survey hasn&apos;t received any responses yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {survey.questions.map((question, index) => (
              <QuestionResults
                key={question.id}
                question={question}
                index={index}
                totalResponses={survey._count.responses}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 py-8 border-t border-[#dcd6f6]">
          <div className="text-center">
            <p className="text-sm text-[#6b6b7b] mb-4">
              Survey created on {new Date(survey.createdAt).toLocaleDateString()}
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-[#FF4F01] hover:text-[#FF7A33] font-medium transition-colors"
            >
              Create your own survey
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResponseTimeline({ survey }: { survey: Survey }) {
  // Group responses by date
  const responsesByDate = new Map<string, number>();

  survey.questions.forEach((question) => {
    question.answers.forEach((answer) => {
      const date = new Date(answer.response.completedAt).toLocaleDateString();
      responsesByDate.set(date, (responsesByDate.get(date) || 0) + 1);
    });
  });

  // Normalize by number of questions
  const data = Array.from(responsesByDate.entries())
    .map(([date, count]) => ({
      date,
      responses: Math.round(count / survey.questions.length),
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-14); // Last 14 days

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorResponses" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#FF4F01" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#FF4F01" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#dcd6f6" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: "#6b6b7b" }}
          tickFormatter={(value) => {
            const date = new Date(value);
            return `${date.getMonth() + 1}/${date.getDate()}`;
          }}
        />
        <YAxis tick={{ fontSize: 12, fill: "#6b6b7b" }} />
        <Tooltip
          contentStyle={{
            backgroundColor: "white",
            border: "1px solid #dcd6f6",
            borderRadius: "8px",
          }}
        />
        <Area
          type="monotone"
          dataKey="responses"
          stroke="#FF4F01"
          strokeWidth={2}
          fill="url(#colorResponses)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function QuestionResults({
  question,
  index,
  totalResponses,
}: {
  question: Question;
  index: number;
  totalResponses: number;
}) {
  const answerCount = question.answers.length;
  const responseRate = totalResponses > 0 ? (answerCount / totalResponses) * 100 : 0;

  // For choice questions, calculate distribution
  const getChoiceDistribution = () => {
    if (!question.options) return [];

    const counts: Record<string, number> = {};
    question.options.forEach((opt) => (counts[opt] = 0));

    question.answers.forEach((answer) => {
      if (question.type === "MULTIPLE_CHOICE" && Array.isArray(answer.value)) {
        (answer.value as string[]).forEach((v) => {
          if (counts[v] !== undefined) counts[v]++;
        });
      } else if (typeof answer.value === "string") {
        if (counts[answer.value] !== undefined) counts[answer.value]++;
      }
    });

    return question.options.map((opt, i) => ({
      name: opt,
      value: counts[opt],
      percentage: answerCount > 0 ? (counts[opt] / answerCount) * 100 : 0,
      fill: COLORS[i % COLORS.length],
    }));
  };

  // For rating/scale questions, calculate distribution
  const getRatingDistribution = () => {
    const maxValue = question.type === "RATING" ? 5 : 10;
    const distribution = Array.from({ length: maxValue }, (_, i) => ({
      rating: i + 1,
      count: 0,
    }));

    question.answers.forEach((answer) => {
      const value = Number(answer.value);
      if (!isNaN(value) && value >= 1 && value <= maxValue) {
        distribution[value - 1].count++;
      }
    });

    return distribution;
  };

  const getRatingStats = () => {
    const values = question.answers
      .map((a) => Number(a.value))
      .filter((v) => !isNaN(v));
    if (values.length === 0) return { average: 0, min: 0, max: 0 };
    return {
      average: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
    };
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-white to-[#fbf5ea]">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF4F01] to-[#FF7A33] flex items-center justify-center text-white font-bold shrink-0">
            {index + 1}
          </span>
          <div className="flex-1">
            <CardTitle className="text-lg">{question.title}</CardTitle>
            {question.description && (
              <CardDescription className="mt-1">{question.description}</CardDescription>
            )}
            <div className="flex items-center gap-3 mt-3">
              <Badge variant="outline" className="text-xs">
                {question.type.replace("_", " ")}
              </Badge>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-[#f5f3ff] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#FF4F01] rounded-full transition-all duration-500"
                    style={{ width: `${responseRate}%` }}
                  />
                </div>
                <span className="text-xs text-[#6b6b7b]">
                  {answerCount}/{totalResponses} ({responseRate.toFixed(0)}%)
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {/* Single Choice - Pie Chart */}
        {question.type === "SINGLE_CHOICE" && question.options && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={getChoiceDistribution()}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {getChoiceDistribution().map((entry, i) => (
                      <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [`${value} responses`, ""]}
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #dcd6f6",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {getChoiceDistribution().map((item, i) => (
                <div key={item.name} className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <div className="flex-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-[#6b6b7b]">
                        {item.value} ({item.percentage.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-[#f5f3ff] rounded-full overflow-hidden mt-1">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${item.percentage}%`,
                          backgroundColor: COLORS[i % COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Multiple Choice - Bar Chart */}
        {question.type === "MULTIPLE_CHOICE" && question.options && (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={getChoiceDistribution()} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dcd6f6" />
                <XAxis type="number" tick={{ fontSize: 12, fill: "#6b6b7b" }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 12, fill: "#6b6b7b" }}
                  width={120}
                />
                <Tooltip
                  formatter={(value) => [`${value} selections`]}
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #dcd6f6",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {getChoiceDistribution().map((entry, i) => (
                    <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Rating - Radial Gauge + Bar Distribution */}
        {question.type === "RATING" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col items-center justify-center">
              <div className="relative">
                <ResponsiveContainer width={200} height={200}>
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="60%"
                    outerRadius="100%"
                    barSize={20}
                    data={[
                      {
                        name: "Average",
                        value: getRatingStats().average,
                        fill: "#FF4F01",
                      },
                    ]}
                    startAngle={180}
                    endAngle={0}
                  >
                    <RadialBar background dataKey="value" cornerRadius={10} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-4xl font-['Syne'] font-bold text-[#FF4F01]">
                    {getRatingStats().average.toFixed(1)}
                  </div>
                  <div className="text-sm text-[#6b6b7b]">out of 5</div>
                </div>
              </div>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getRatingDistribution()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dcd6f6" />
                  <XAxis dataKey="rating" tick={{ fontSize: 12, fill: "#6b6b7b" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#6b6b7b" }} />
                  <Tooltip
                    formatter={(value) => [`${value} responses`]}
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #dcd6f6",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="count" fill="#FF4F01" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Scale - Bar Distribution */}
        {question.type === "SCALE" && (
          <div>
            <div className="text-center mb-6">
              <div className="text-5xl font-['Syne'] font-bold text-[#1a1a2e]">
                {getRatingStats().average.toFixed(1)}
              </div>
              <div className="text-sm text-[#6b6b7b]">Average score out of 10</div>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getRatingDistribution()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dcd6f6" />
                  <XAxis dataKey="rating" tick={{ fontSize: 12, fill: "#6b6b7b" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#6b6b7b" }} />
                  <Tooltip
                    formatter={(value) => [`${value} responses`]}
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #dcd6f6",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {getRatingDistribution().map((entry, i) => (
                      <Cell
                        key={`cell-${i}`}
                        fill={entry.rating <= 3 ? "#ef4444" : entry.rating <= 6 ? "#f59e0b" : "#22c55e"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Text responses - Beautiful cards (limited for privacy) */}
        {(question.type === "SHORT_TEXT" ||
          question.type === "LONG_TEXT" ||
          question.type === "EMAIL" ||
          question.type === "NUMBER" ||
          question.type === "DATE") && (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {question.answers.length === 0 ? (
              <p className="text-[#6b6b7b] text-sm italic text-center py-8">No responses yet</p>
            ) : (
              question.answers.map((answer, i) => (
                <div
                  key={answer.id}
                  className="p-4 bg-gradient-to-r from-white to-[#fbf5ea] rounded-xl border border-[#dcd6f6] hover:shadow-md transition-shadow"
                >
                  <p className="text-[#1a1a2e]">{String(answer.value)}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-6 h-6 rounded-full bg-[#dcd6f6] flex items-center justify-center text-xs font-medium">
                      {i + 1}
                    </div>
                    <p className="text-xs text-[#6b6b7b]">
                      {new Date(answer.response.completedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
