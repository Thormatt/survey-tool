"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  BarChart3,
  Eye,
  CheckCircle,
  Loader2,
  Share2,
  Trash2,
  AlertTriangle,
  X,
  Copy,
} from "lucide-react";
import Link from "next/link";
import { CopyLinkButton } from "./copy-link-button";

interface Survey {
  id: string;
  title: string;
  description?: string;
  published: boolean;
  createdAt: string;
  questions: {
    id: string;
    type: string;
    title: string;
    required: boolean;
  }[];
  _count: {
    responses: number;
  };
}

export default function SurveyPage() {
  const params = useParams();
  const router = useRouter();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  const deleteSurvey = async () => {
    if (deleteConfirmation.toLowerCase() !== "delete") return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/surveys/${params.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      router.push("/");
    } catch {
      setError("Failed to delete survey");
      setDeleting(false);
    }
  };

  const duplicateSurvey = async () => {
    setDuplicating(true);
    try {
      const res = await fetch(`/api/surveys/${params.id}/duplicate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to duplicate");
      const newSurvey = await res.json();
      router.push(`/surveys/${newSurvey.id}`);
    } catch {
      setError("Failed to duplicate survey");
      setDuplicating(false);
    }
  };

  useEffect(() => {
    async function fetchSurvey() {
      try {
        const response = await fetch(`/api/surveys/${params.id}`);
        if (!response.ok) {
          throw new Error("Survey not found");
        }
        const data = await response.json();
        setSurvey(data);
      } catch (err) {
        setError("Survey not found");
      } finally {
        setLoading(false);
      }
    }

    fetchSurvey();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbf5ea] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#6b6b7b]" />
      </div>
    );
  }

  if (error || !survey) {
    return (
      <div className="min-h-screen bg-[#fbf5ea]">
        <header className="border-b border-[#dcd6f6]">
          <div className="container mx-auto px-6 py-4">
            <Link href="/" className="text-[#6b6b7b] hover:text-[#1a1a2e]">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </div>
        </header>
        <div className="container mx-auto px-6 py-16 text-center">
          <h1 className="font-['Syne'] text-2xl font-bold mb-2">Survey not found</h1>
          <p className="text-[#6b6b7b] mb-6">This survey may have been deleted or doesn't exist.</p>
          <Link href="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const surveyUrl = `/s/${survey.id}`;

  return (
    <div className="min-h-screen bg-[#fbf5ea]">
      {/* Header */}
      <header className="border-b border-[#dcd6f6] bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-[#6b6b7b] hover:text-[#1a1a2e] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-['Syne'] font-semibold text-lg">
                {survey.title}
              </h1>
              <div className="flex items-center gap-2">
                <Badge variant={survey.published ? "highlight" : "secondary"}>
                  {survey.published ? "Published" : "Draft"}
                </Badge>
                <span className="text-xs text-[#6b6b7b]">
                  {survey._count.responses} responses
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={duplicateSurvey}
              disabled={duplicating}
            >
              {duplicating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Copy className="w-4 h-4 mr-2" />
              )}
              Duplicate
            </Button>
            <Link href={`/surveys/${survey.id}/distribute`}>
              <Button variant="outline" size="sm">
                <Share2 className="w-4 h-4 mr-2" />
                Distribute
              </Button>
            </Link>
            <Link href={`/surveys/${survey.id}/results`}>
              <Button variant="outline" size="sm">
                <BarChart3 className="w-4 h-4 mr-2" />
                Results
              </Button>
            </Link>
            <Link href={surveyUrl} target="_blank">
              <Button variant="outline" size="sm">
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 max-w-3xl">
        {/* Success Message */}
        <Card className="mb-8 border-green-200 bg-green-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-['Syne'] font-semibold text-green-900 mb-1">
                  {survey.published
                    ? "Survey Published!"
                    : "Survey Saved as Draft"}
                </h3>
                <p className="text-sm text-green-700 mb-4">
                  {survey.published
                    ? "Your survey is live and ready to collect responses."
                    : "Your survey has been saved. Publish it when you're ready to start collecting responses."}
                </p>
                {survey.published && (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-white px-3 py-2 rounded border border-green-200 text-sm overflow-x-auto">
                      {typeof window !== "undefined"
                        ? `${window.location.origin}${surveyUrl}`
                        : surveyUrl}
                    </code>
                    <CopyLinkButton surveyUrl={surveyUrl} />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Survey Overview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Survey Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[#6b6b7b] mb-4">
              {survey.description || "No description"}
            </p>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-[#fbf5ea] rounded-lg">
                <div className="text-2xl font-['Syne'] font-bold">
                  {survey.questions.length}
                </div>
                <div className="text-xs text-[#6b6b7b]">Questions</div>
              </div>
              <div className="p-4 bg-[#fbf5ea] rounded-lg">
                <div className="text-2xl font-['Syne'] font-bold">
                  {survey._count.responses}
                </div>
                <div className="text-xs text-[#6b6b7b]">Responses</div>
              </div>
              <div className="p-4 bg-[#fbf5ea] rounded-lg">
                <div className="text-2xl font-['Syne'] font-bold">
                  {survey.questions.filter((q) => q.required).length}
                </div>
                <div className="text-xs text-[#6b6b7b]">Required</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Questions List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {survey.questions.map((question, index) => (
              <div
                key={question.id}
                className="flex items-start gap-3 p-3 bg-[#fbf5ea] rounded-lg"
              >
                <span className="w-6 h-6 rounded-full bg-[#dcd6f6] flex items-center justify-center text-xs font-medium">
                  {index + 1}
                </span>
                <div className="flex-1">
                  <p className="font-medium">{question.title || "Untitled"}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {question.type.replace("_", " ")}
                    </Badge>
                    {question.required && (
                      <Badge variant="secondary" className="text-xs">
                        Required
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="mt-6 border-red-200">
          <CardHeader>
            <CardTitle className="text-lg text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Delete this survey</p>
                <p className="text-xs text-[#6b6b7b]">
                  This will permanently delete the survey and all {survey._count.responses} responses.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => setShowDeleteModal(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Survey
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <h2 className="font-['Syne'] font-semibold text-lg">Delete Survey</h2>
                </div>
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmation("");
                  }}
                  className="p-2 hover:bg-[#fbf5ea] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-6">
                <p className="text-[#6b6b7b] text-sm mb-4">
                  This action cannot be undone. This will permanently delete the survey
                  <strong className="text-[#1a1a2e]"> "{survey.title}"</strong> and all
                  {survey._count.responses > 0 ? ` ${survey._count.responses}` : ""} responses.
                </p>
                <p className="text-sm font-medium mb-2">
                  Type <span className="text-red-600 font-mono">delete</span> to confirm:
                </p>
                <Input
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="delete"
                  className="font-mono"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmation("");
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={deleteSurvey}
                  disabled={deleteConfirmation.toLowerCase() !== "delete" || deleting}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Survey
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
