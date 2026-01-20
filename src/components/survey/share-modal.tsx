"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Users,
  Mail,
  Loader2,
  Trash2,
  Crown,
  Edit3,
  Eye,
  Copy,
  Check,
} from "lucide-react";

interface Collaborator {
  id: string;
  userId: string;
  email: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
  acceptedAt: string | null;
}

interface PendingInvite {
  id: string;
  email: string;
  role: "EDITOR" | "VIEWER";
  expiresAt: string;
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  surveyId: string;
  surveyTitle: string;
  isOwner: boolean;
}

const roleIcons = {
  OWNER: <Crown className="w-3 h-3" />,
  EDITOR: <Edit3 className="w-3 h-3" />,
  VIEWER: <Eye className="w-3 h-3" />,
};

const roleColors = {
  OWNER: "bg-amber-100 text-amber-700 border-amber-200",
  EDITOR: "bg-blue-100 text-blue-700 border-blue-200",
  VIEWER: "bg-gray-100 text-gray-700 border-gray-200",
};

export function ShareModal({
  isOpen,
  onClose,
  surveyId,
  surveyTitle,
  isOwner,
}: ShareModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"EDITOR" | "VIEWER">("EDITOR");
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch collaborators when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchCollaborators();
    }
  }, [isOpen, surveyId]);

  const fetchCollaborators = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/surveys/${surveyId}/collaborators`);
      if (!response.ok) throw new Error("Failed to load collaborators");
      const data = await response.json();
      setCollaborators(data.collaborators || []);
      setPendingInvites(data.pendingInvites || []);
      setOwnerId(data.ownerId);
    } catch (err) {
      setError("Failed to load collaborators");
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setInviting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/surveys/${surveyId}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to invite");
      }

      setSuccess(data.message || "Invitation sent!");
      setEmail("");
      fetchCollaborators();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite");
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateRole = async (collaboratorId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/surveys/${surveyId}/collaborators`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collaboratorId, role: newRole }),
      });

      if (!response.ok) throw new Error("Failed to update role");
      fetchCollaborators();
    } catch (err) {
      setError("Failed to update role");
    }
  };

  const handleRemove = async (
    type: "collaborator" | "invitation",
    id: string
  ) => {
    try {
      const param =
        type === "collaborator" ? `collaboratorId=${id}` : `invitationId=${id}`;
      const response = await fetch(
        `/api/surveys/${surveyId}/collaborators?${param}`,
        { method: "DELETE" }
      );

      if (!response.ok) throw new Error("Failed to remove");
      fetchCollaborators();
    } catch (err) {
      setError("Failed to remove");
    }
  };

  const copyShareLink = () => {
    const link = `${window.location.origin}/surveys/${surveyId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#6b6b7b]" />
              <h2 className="text-lg font-semibold">Share Survey</h2>
            </div>
            <button
              onClick={onClose}
              className="text-[#6b6b7b] hover:text-[#1a1a2e] p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 overflow-y-auto max-h-[60vh]">
            {/* Survey info */}
            <p className="text-sm text-[#6b6b7b] mb-4">
              Sharing <span className="font-medium text-[#1a1a2e]">{surveyTitle}</span>
            </p>

            {/* Copy link section */}
            <div className="mb-6">
              <label className="text-sm font-medium text-[#1a1a2e] mb-2 block">
                Survey Link
              </label>
              <div className="flex gap-2">
                <Input
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/surveys/${surveyId}`}
                  readOnly
                  className="flex-1 bg-gray-50 text-sm"
                />
                <Button
                  variant="outline"
                  onClick={copyShareLink}
                  className="flex items-center gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Invite form - only for owner */}
            {isOwner && (
              <form onSubmit={handleInvite} className="mb-6">
                <label className="text-sm font-medium text-[#1a1a2e] mb-2 block">
                  Invite Collaborator
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b7b]" />
                    <Input
                      type="email"
                      placeholder="Enter email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as "EDITOR" | "VIEWER")}
                    className="px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    <option value="EDITOR">Editor</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                  <Button type="submit" disabled={inviting || !email.trim()}>
                    {inviting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Invite"
                    )}
                  </Button>
                </div>
              </form>
            )}

            {/* Messages */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-lg">
                {success}
              </div>
            )}

            {/* Collaborators list */}
            <div>
              <label className="text-sm font-medium text-[#1a1a2e] mb-2 block">
                Team Members
              </label>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#6b6b7b]" />
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Owner (from survey.userId, not in collaborators) */}
                  {ownerId && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                          <Crown className="w-4 h-4 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Owner</p>
                          <p className="text-xs text-[#6b6b7b]">
                            Full access
                          </p>
                        </div>
                      </div>
                      <Badge className={roleColors.OWNER}>
                        {roleIcons.OWNER}
                        <span className="ml-1">Owner</span>
                      </Badge>
                    </div>
                  )}

                  {/* Collaborators */}
                  {collaborators.map((collab) => (
                    <div
                      key={collab.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-medium">
                          {collab.email[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{collab.email}</p>
                          <p className="text-xs text-[#6b6b7b]">
                            {collab.acceptedAt ? "Active" : "Pending"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isOwner ? (
                          <>
                            <select
                              value={collab.role}
                              onChange={(e) =>
                                handleUpdateRole(collab.id, e.target.value)
                              }
                              className="px-2 py-1 text-xs border rounded bg-white"
                            >
                              <option value="EDITOR">Editor</option>
                              <option value="VIEWER">Viewer</option>
                            </select>
                            <button
                              onClick={() => handleRemove("collaborator", collab.id)}
                              className="p-1 text-[#6b6b7b] hover:text-red-500"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <Badge className={roleColors[collab.role]}>
                            {roleIcons[collab.role]}
                            <span className="ml-1">{collab.role}</span>
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Pending invites */}
                  {pendingInvites.length > 0 && (
                    <>
                      <div className="pt-2">
                        <p className="text-xs font-medium text-[#6b6b7b] uppercase tracking-wider mb-2">
                          Pending Invitations
                        </p>
                      </div>
                      {pendingInvites.map((invite) => (
                        <div
                          key={invite.id}
                          className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
                              <Mail className="w-4 h-4 text-yellow-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{invite.email}</p>
                              <p className="text-xs text-[#6b6b7b]">
                                Expires{" "}
                                {new Date(invite.expiresAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {invite.role}
                            </Badge>
                            {isOwner && (
                              <button
                                onClick={() => handleRemove("invitation", invite.id)}
                                className="p-1 text-[#6b6b7b] hover:text-red-500"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {collaborators.length === 0 && pendingInvites.length === 0 && (
                    <p className="text-sm text-[#6b6b7b] py-4 text-center">
                      No collaborators yet. Invite team members to collaborate on this survey.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t bg-gray-50">
            <div className="flex items-center justify-between text-xs text-[#6b6b7b]">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Edit3 className="w-3 h-3" /> Editor: Can edit survey
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="w-3 h-3" /> Viewer: View only
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
