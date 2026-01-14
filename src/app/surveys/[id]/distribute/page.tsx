"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Copy,
  Check,
  Loader2,
  Send,
  Mail,
  CheckCircle,
  Clock,
  Eye,
  Link as LinkIcon,
  Globe,
  Lock,
  Users,
  EyeOff,
  UserCheck,
  Plus,
  X,
  Trash2,
  Edit3,
  FolderPlus,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface Survey {
  id: string;
  title: string;
  published: boolean;
  accessType: string;
  isAnonymous: boolean;
}

interface Invitation {
  id: string;
  email: string;
  sentAt: string;
  openedAt?: string;
  completedAt?: string;
}

interface EmailGroupMember {
  id: string;
  email: string;
  name?: string;
}

interface EmailGroup {
  id: string;
  name: string;
  color?: string;
  members: EmailGroupMember[];
  _count: { members: number };
}

const GROUP_COLORS = [
  "#FF4F01", "#1a1a2e", "#c9c1ed", "#22c55e", "#3b82f6",
  "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6", "#f43f5e",
];

export default function DistributePage() {
  const params = useParams();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [groups, setGroups] = useState<EmailGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [emails, setEmails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  // Group management state
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<EmailGroup | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupColor, setNewGroupColor] = useState(GROUP_COLORS[0]);
  const [newGroupMembers, setNewGroupMembers] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);

  const updateSurvey = async (updates: Partial<Survey>) => {
    if (!survey) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/surveys/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update");
      const updated = await res.json();
      setSurvey(updated);
    } catch {
      setError("Failed to update survey settings");
    } finally {
      setUpdating(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch("/api/groups");
      if (res.ok) {
        setGroups(await res.json());
      }
    } catch {
      console.error("Failed to fetch groups");
    }
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const [surveyRes, invitationsRes] = await Promise.all([
          fetch(`/api/surveys/${params.id}`),
          fetch(`/api/surveys/${params.id}/invitations`),
        ]);

        if (!surveyRes.ok) throw new Error("Survey not found");

        setSurvey(await surveyRes.json());
        if (invitationsRes.ok) {
          setInvitations(await invitationsRes.json());
        }

        await fetchGroups();
      } catch {
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [params.id]);

  const surveyUrl = typeof window !== "undefined"
    ? `${window.location.origin}/s/${params.id}`
    : `/s/${params.id}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(surveyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  const getEmailsFromGroups = () => {
    const emailSet = new Set<string>();
    selectedGroups.forEach((groupId) => {
      const group = groups.find((g) => g.id === groupId);
      if (group) {
        group.members.forEach((m) => emailSet.add(m.email));
      }
    });
    return Array.from(emailSet);
  };

  const sendInvitations = async () => {
    // Combine manual emails and group emails
    const manualEmails = emails
      .split(/[,\n]/)
      .map((e) => e.trim())
      .filter((e) => e && e.includes("@"));

    const groupEmails = getEmailsFromGroups();
    const allEmails = [...new Set([...manualEmails, ...groupEmails])];

    if (allEmails.length === 0) {
      setError("Please enter email addresses or select at least one group");
      return;
    }

    setSending(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/surveys/${params.id}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: allEmails }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send invitations");
      }

      const data = await res.json();
      const successful = data.results.filter((r: { success: boolean }) => r.success).length;
      const failed = data.results.filter((r: { success: boolean }) => !r.success).length;

      if (successful > 0) {
        setSuccessMessage(
          `Successfully sent ${successful} invitation${successful > 1 ? "s" : ""}${
            failed > 0 ? `. ${failed} failed (may need domain verification).` : ""
          }`
        );
        setEmails("");
        setSelectedGroups([]);
        // Refresh invitations
        const invitationsRes = await fetch(`/api/surveys/${params.id}/invitations`);
        if (invitationsRes.ok) {
          setInvitations(await invitationsRes.json());
        }
      } else {
        setError("Failed to send invitations. You may need to verify your domain at resend.com/domains to send to other email addresses.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invitations");
    } finally {
      setSending(false);
    }
  };

  const saveGroup = async () => {
    if (!newGroupName.trim()) {
      setError("Group name is required");
      return;
    }

    const memberEmails = newGroupMembers
      .split(/[,\n]/)
      .map((e) => e.trim())
      .filter((e) => e && e.includes("@"))
      .map((email) => ({ email }));

    setSavingGroup(true);
    setError(null);

    try {
      if (editingGroup) {
        // Update existing group
        const res = await fetch(`/api/groups/${editingGroup.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newGroupName.trim(),
            color: newGroupColor,
            addMembers: memberEmails,
          }),
        });
        if (!res.ok) throw new Error("Failed to update group");
      } else {
        // Create new group
        const res = await fetch("/api/groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newGroupName.trim(),
            color: newGroupColor,
            members: memberEmails,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create group");
        }
      }

      await fetchGroups();
      setShowGroupModal(false);
      setEditingGroup(null);
      setNewGroupName("");
      setNewGroupColor(GROUP_COLORS[0]);
      setNewGroupMembers("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save group");
    } finally {
      setSavingGroup(false);
    }
  };

  const deleteGroup = async (groupId: string) => {
    if (!confirm("Are you sure you want to delete this group?")) return;

    try {
      const res = await fetch(`/api/groups/${groupId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete group");
      await fetchGroups();
      setSelectedGroups((prev) => prev.filter((id) => id !== groupId));
    } catch {
      setError("Failed to delete group");
    }
  };

  const openEditGroup = (group: EmailGroup) => {
    setEditingGroup(group);
    setNewGroupName(group.name);
    setNewGroupColor(group.color || GROUP_COLORS[0]);
    setNewGroupMembers(group.members.map((m) => m.email).join("\n"));
    setShowGroupModal(true);
  };

  const openNewGroup = () => {
    setEditingGroup(null);
    setNewGroupName("");
    setNewGroupColor(GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)]);
    setNewGroupMembers("");
    setShowGroupModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbf5ea] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#6b6b7b]" />
      </div>
    );
  }

  if (!survey) {
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
          <Link href="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const totalSelectedEmails = getEmailsFromGroups().length;

  return (
    <div className="min-h-screen bg-[#fbf5ea]">
      {/* Header */}
      <header className="border-b border-[#dcd6f6] bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/surveys/${survey.id}`}
              className="text-[#6b6b7b] hover:text-[#1a1a2e] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-['Syne'] font-semibold text-lg">
                Distribute Survey
              </h1>
              <div className="flex items-center gap-2">
                <Badge variant={survey.published ? "highlight" : "secondary"}>
                  {survey.published ? "Published" : "Draft"}
                </Badge>
                <span className="text-xs text-[#6b6b7b]">{survey.title}</span>
              </div>
            </div>
          </div>
          <Image
            src="https://cdn.prod.website-files.com/686e52cd9c00136ae69ac4d6/68751c8e13a5456b2330eb95_andus-sun-1.svg"
            alt="Andus Labs"
            width={40}
            height={40}
            className="opacity-80"
          />
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 max-w-3xl">
        {!survey.published && (
          <Card className="mb-6 border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <p className="text-amber-800 text-sm">
                This survey is not published yet. You need to publish it before sending invitations.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Share Link */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="w-5 h-5" />
              Share Link
            </CardTitle>
            <CardDescription>
              {survey.accessType === "INVITE_ONLY"
                ? "Only invited emails can respond to this survey"
                : "Anyone with this link can respond to your survey"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input value={surveyUrl} readOnly className="bg-white" />
              <Button variant="outline" onClick={copyLink}>
                {copied ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>

            {/* Survey Settings */}
            <div className="mt-6 space-y-4">
              {/* Response Type */}
              <div>
                <label className="text-sm font-medium text-[#1a1a2e] mb-2 block">
                  Response Type
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateSurvey({ isAnonymous: true })}
                    disabled={updating}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                      survey.isAnonymous
                        ? "bg-[#FF4F01] text-white border-[#FF4F01]"
                        : "bg-white text-[#6b6b7b] border-[#dcd6f6] hover:border-[#FF4F01]"
                    }`}
                  >
                    <EyeOff className="w-4 h-4" />
                    Anonymous
                  </button>
                  <button
                    onClick={() => updateSurvey({ isAnonymous: false })}
                    disabled={updating}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                      !survey.isAnonymous
                        ? "bg-[#FF4F01] text-white border-[#FF4F01]"
                        : "bg-white text-[#6b6b7b] border-[#dcd6f6] hover:border-[#FF4F01]"
                    }`}
                  >
                    <UserCheck className="w-4 h-4" />
                    Identified
                  </button>
                </div>
                <p className="text-xs text-[#6b6b7b] mt-2">
                  {survey.isAnonymous
                    ? "Responses won't include respondent names or emails"
                    : "Responses will include respondent information when available"}
                </p>
              </div>

              {/* Access Type */}
              <div>
                <label className="text-sm font-medium text-[#1a1a2e] mb-2 block">
                  Access Control
                </label>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => updateSurvey({ accessType: "PUBLIC" })}
                    disabled={updating}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                      survey.accessType === "PUBLIC"
                        ? "bg-[#1a1a2e] text-white border-[#1a1a2e]"
                        : "bg-white text-[#6b6b7b] border-[#dcd6f6] hover:border-[#1a1a2e]"
                    }`}
                  >
                    <Globe className="w-4 h-4" />
                    Public
                  </button>
                  <button
                    onClick={() => updateSurvey({ accessType: "UNLISTED" })}
                    disabled={updating}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                      survey.accessType === "UNLISTED"
                        ? "bg-[#1a1a2e] text-white border-[#1a1a2e]"
                        : "bg-white text-[#6b6b7b] border-[#dcd6f6] hover:border-[#1a1a2e]"
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    Unlisted
                  </button>
                  <button
                    onClick={() => updateSurvey({ accessType: "INVITE_ONLY" })}
                    disabled={updating}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                      survey.accessType === "INVITE_ONLY"
                        ? "bg-[#1a1a2e] text-white border-[#1a1a2e]"
                        : "bg-white text-[#6b6b7b] border-[#dcd6f6] hover:border-[#1a1a2e]"
                    }`}
                  >
                    <Lock className="w-4 h-4" />
                    Invite Only
                  </button>
                </div>
                <p className="text-xs text-[#6b6b7b] mt-2">
                  {survey.accessType === "PUBLIC" && "Anyone can find and respond to this survey"}
                  {survey.accessType === "UNLISTED" && "Only people with the link can respond"}
                  {survey.accessType === "INVITE_ONLY" && "Only invited emails can respond (requires sign-in)"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email Groups */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Email Groups
                </CardTitle>
                <CardDescription>
                  Create reusable groups to quickly send to your team
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={openNewGroup}>
                <Plus className="w-4 h-4 mr-2" />
                New Group
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {groups.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-[#dcd6f6] flex items-center justify-center mx-auto mb-3">
                  <FolderPlus className="w-6 h-6 text-[#1a1a2e]" />
                </div>
                <p className="text-[#6b6b7b] text-sm mb-3">No groups yet</p>
                <Button variant="outline" size="sm" onClick={openNewGroup}>
                  Create your first group
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                      selectedGroups.includes(group.id)
                        ? "border-[#FF4F01] bg-[#FF4F01]/5"
                        : "border-[#dcd6f6] hover:border-[#c9c1ed]"
                    }`}
                    onClick={() => toggleGroup(group.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: group.color || GROUP_COLORS[0] }}
                      />
                      <div>
                        <p className="font-medium text-sm">{group.name}</p>
                        <p className="text-xs text-[#6b6b7b]">
                          {group._count.members} member{group._count.members !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedGroups.includes(group.id) && (
                        <Badge variant="highlight" className="text-xs">
                          Selected
                        </Badge>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditGroup(group);
                        }}
                        className="p-1.5 hover:bg-[#dcd6f6] rounded transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#6b6b7b]" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteGroup(group.id);
                        }}
                        className="p-1.5 hover:bg-red-100 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
                {selectedGroups.length > 0 && (
                  <p className="text-xs text-[#FF4F01] mt-2">
                    {totalSelectedEmails} email{totalSelectedEmails !== 1 ? "s" : ""} selected from groups
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Email Invitations */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Send Invitations
            </CardTitle>
            <CardDescription>
              Add individual emails or use groups above
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder="Enter additional email addresses (separated by commas or new lines)"
              rows={3}
              disabled={!survey.published}
              className="mb-4"
            />

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">
                {successMessage}
              </div>
            )}

            <Button
              onClick={sendInvitations}
              disabled={!survey.published || sending || (!emails.trim() && selectedGroups.length === 0)}
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Invitations
                  {(totalSelectedEmails > 0 || emails.trim()) && (
                    <span className="ml-2 bg-white/20 px-2 py-0.5 rounded text-xs">
                      {totalSelectedEmails + emails.split(/[,\n]/).filter((e) => e.trim() && e.includes("@")).length}
                    </span>
                  )}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Invitation History */}
        <Card>
          <CardHeader>
            <CardTitle>Invitation History</CardTitle>
            <CardDescription>
              {invitations.length} invitation{invitations.length !== 1 ? "s" : ""} sent
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invitations.length === 0 ? (
              <p className="text-[#6b6b7b] text-sm py-4 text-center">
                No invitations sent yet
              </p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {invitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between p-3 bg-[#fbf5ea] rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-sm">{inv.email}</p>
                      <p className="text-xs text-[#6b6b7b]">
                        Sent {new Date(inv.sentAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {inv.completedAt ? (
                        <Badge variant="highlight" className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Completed
                        </Badge>
                      ) : inv.openedAt ? (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          Opened
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Pending
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-['Syne'] font-semibold text-lg">
                  {editingGroup ? "Edit Group" : "Create New Group"}
                </h2>
                <button
                  onClick={() => setShowGroupModal(false)}
                  className="p-2 hover:bg-[#fbf5ea] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Group Name</label>
                  <Input
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="e.g., C-Suite, Engineering, Contractors"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Color</label>
                  <div className="flex gap-2 flex-wrap">
                    {GROUP_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewGroupColor(color)}
                        className={`w-8 h-8 rounded-full transition-all ${
                          newGroupColor === color
                            ? "ring-2 ring-offset-2 ring-[#1a1a2e]"
                            : ""
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {editingGroup ? "Add Members" : "Members"}
                  </label>
                  <Textarea
                    value={newGroupMembers}
                    onChange={(e) => setNewGroupMembers(e.target.value)}
                    placeholder="Enter email addresses (one per line or comma-separated)"
                    rows={5}
                  />
                  {editingGroup && editingGroup.members.length > 0 && (
                    <p className="text-xs text-[#6b6b7b] mt-2">
                      Current members: {editingGroup.members.length}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowGroupModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={saveGroup}
                    disabled={savingGroup || !newGroupName.trim()}
                    className="flex-1"
                  >
                    {savingGroup ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : editingGroup ? (
                      "Save Changes"
                    ) : (
                      "Create Group"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
