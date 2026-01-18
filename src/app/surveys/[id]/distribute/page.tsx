"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
  Lock,
  Users,
  EyeOff,
  UserCheck,
  Plus,
  X,
  Trash2,
  Edit3,
  FolderPlus,
  Bell,
  Code,
  Square,
  MousePointerClick,
  MessageSquare,
  Puzzle,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

// Animation variants
const pageVariants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.3, staggerChildren: 0.1 },
  },
};

const cardVariants = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 25 },
  },
};

const successVariants = {
  initial: { opacity: 0, scale: 0.8, y: 20 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 400, damping: 25 },
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    y: -20,
    transition: { duration: 0.2 },
  },
};

interface Question {
  id: string;
  type: string;
}

interface Survey {
  id: string;
  title: string;
  published: boolean;
  accessType: string;
  isAnonymous: boolean;
  questions?: Question[];
  reminderEnabled?: boolean;
  reminderIntervalDays?: number;
  reminderMaxCount?: number;
}

// Calculate estimated time based on question count (~30 sec per question)
function calculateTimeEstimate(questionCount: number): string {
  if (questionCount === 0) return "1 minute";
  if (questionCount <= 2) return "1 minute";
  if (questionCount <= 5) return "2 minutes";
  if (questionCount <= 8) return "3 minutes";
  if (questionCount <= 12) return "4 minutes";
  if (questionCount <= 16) return "5 minutes";
  return `${Math.ceil(questionCount / 3)} minutes`;
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

  // Email customization state
  const [emailSubject, setEmailSubject] = useState("");
  const [senderName, setSenderName] = useState("Survey Team");
  const [customMessage, setCustomMessage] = useState("");
  const [emailTitle, setEmailTitle] = useState("");
  const [ctaButtonText, setCtaButtonText] = useState("Take Survey →");
  const [timeEstimate, setTimeEstimate] = useState("");
  const [showEmailPreview, setShowEmailPreview] = useState(false);

  // Embed code state
  const [embedType, setEmbedType] = useState<"iframe" | "popup" | "slidein" | "widget" | "exit-intent">("iframe");
  const [embedWidth, setEmbedWidth] = useState("100%");
  const [embedHeight, setEmbedHeight] = useState("600");
  const [embedBgColor, setEmbedBgColor] = useState("#fbf5ea");
  const [embedAccentColor, setEmbedAccentColor] = useState("#FF4F01");
  const [embedHideTitle, setEmbedHideTitle] = useState(false);
  const [embedHideDescription, setEmbedHideDescription] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  // Popup/Modal options
  const [popupButtonText, setPopupButtonText] = useState("Take Survey");
  const [popupButtonStyle, setPopupButtonStyle] = useState<"filled" | "outline">("filled");
  // Slide-in options
  const [slideinPosition, setSlideinPosition] = useState<"bottom-right" | "bottom-left">("bottom-right");
  const [slideinButtonText, setSlideinButtonText] = useState("Feedback");
  // Exit intent options
  const [exitIntentDelay, setExitIntentDelay] = useState("5");
  const [exitIntentShowOnce, setExitIntentShowOnce] = useState(true);

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

        const surveyData = await surveyRes.json();
        setSurvey(surveyData);

        // Set calculated time estimate based on question count
        const questionCount = surveyData.questions?.length || 0;
        setTimeEstimate(calculateTimeEstimate(questionCount));

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

  // Generate embed URL with customization params
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const embedUrl = `${baseUrl}/embed/${params.id}?bg=${encodeURIComponent(embedBgColor)}&accent=${encodeURIComponent(embedAccentColor)}${embedHideTitle ? "&hideTitle=true" : ""}${embedHideDescription ? "&hideDescription=true" : ""}`;

  // Generate embed code based on type
  const getEmbedCode = () => {
    switch (embedType) {
      case "iframe":
        return `<iframe
  src="${embedUrl}"
  width="${embedWidth}"
  height="${embedHeight}"
  frameborder="0"
  style="border: none; border-radius: 8px;"
  allow="clipboard-write"
></iframe>

<script>
// Auto-resize iframe based on content
window.addEventListener('message', function(e) {
  if (e.data.type === 'survey:resize') {
    const iframe = document.querySelector('iframe[src*="${params.id}"]');
    if (iframe) iframe.style.height = e.data.height + 'px';
  }
});
</script>`;

      case "popup":
        return `<!-- Survey Popup Button -->
<button
  onclick="openSurveyPopup()"
  style="
    background: ${popupButtonStyle === 'filled' ? embedAccentColor : 'transparent'};
    color: ${popupButtonStyle === 'filled' ? '#fff' : embedAccentColor};
    border: 2px solid ${embedAccentColor};
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    font-size: 16px;
  "
>${popupButtonText}</button>

<script>
function openSurveyPopup() {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'survey-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.onclick = function(e) { if(e.target === overlay) closeSurveyPopup(); };

  // Create modal container
  const modal = document.createElement('div');
  modal.style.cssText = 'background:#fff;border-radius:16px;max-width:600px;width:100%;max-height:90vh;overflow:hidden;position:relative;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);';

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '&times;';
  closeBtn.style.cssText = 'position:absolute;top:12px;right:12px;background:none;border:none;font-size:28px;cursor:pointer;color:#666;z-index:10;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:50%;';
  closeBtn.onmouseover = function() { this.style.background = '#f0f0f0'; };
  closeBtn.onmouseout = function() { this.style.background = 'none'; };
  closeBtn.onclick = closeSurveyPopup;

  // Iframe
  const iframe = document.createElement('iframe');
  iframe.src = '${embedUrl}';
  iframe.style.cssText = 'width:100%;height:600px;border:none;';
  iframe.allow = 'clipboard-write';

  modal.appendChild(closeBtn);
  modal.appendChild(iframe);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  // Listen for completion
  window.addEventListener('message', function handler(e) {
    if (e.data.type === 'survey:completed') {
      setTimeout(closeSurveyPopup, 2000);
      window.removeEventListener('message', handler);
    }
    if (e.data.type === 'survey:resize') {
      iframe.style.height = Math.min(e.data.height, window.innerHeight * 0.85) + 'px';
    }
  });
}

function closeSurveyPopup() {
  const overlay = document.getElementById('survey-overlay');
  if (overlay) {
    overlay.remove();
    document.body.style.overflow = '';
  }
}
</script>`;

      case "slidein":
        return `<!-- Floating Feedback Button with Slide-in Survey -->
<style>
#survey-floating-btn {
  position: fixed;
  ${slideinPosition === 'bottom-right' ? 'right: 20px;' : 'left: 20px;'}
  bottom: 20px;
  background: ${embedAccentColor};
  color: #fff;
  border: none;
  padding: 12px 20px;
  border-radius: 50px;
  font-weight: 600;
  cursor: pointer;
  font-size: 14px;
  box-shadow: 0 4px 14px rgba(0,0,0,0.15);
  z-index: 9998;
  transition: transform 0.2s, box-shadow 0.2s;
}
#survey-floating-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.2);
}
#survey-slidein {
  position: fixed;
  ${slideinPosition === 'bottom-right' ? 'right: 20px;' : 'left: 20px;'}
  bottom: 80px;
  width: 380px;
  max-width: calc(100vw - 40px);
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
  z-index: 9999;
  overflow: hidden;
  transform: translateY(20px);
  opacity: 0;
  visibility: hidden;
  transition: transform 0.3s ease, opacity 0.3s ease, visibility 0.3s;
}
#survey-slidein.open {
  transform: translateY(0);
  opacity: 1;
  visibility: visible;
}
#survey-slidein-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
}
#survey-slidein-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 4px 8px;
  border-radius: 4px;
}
#survey-slidein-close:hover { background: #f0f0f0; }
</style>

<button id="survey-floating-btn" onclick="toggleSurveySlideIn()">
  💬 ${slideinButtonText}
</button>

<div id="survey-slidein">
  <div id="survey-slidein-header">
    <span style="font-weight:600;font-size:14px;">Share your feedback</span>
    <button id="survey-slidein-close" onclick="toggleSurveySlideIn()">&times;</button>
  </div>
  <iframe
    src="${embedUrl}"
    style="width:100%;height:500px;border:none;"
    allow="clipboard-write"
  ></iframe>
</div>

<script>
let surveySlideInOpen = false;
function toggleSurveySlideIn() {
  surveySlideInOpen = !surveySlideInOpen;
  document.getElementById('survey-slidein').classList.toggle('open', surveySlideInOpen);
}
// Close on completion
window.addEventListener('message', function(e) {
  if (e.data.type === 'survey:completed') {
    setTimeout(function() {
      surveySlideInOpen = false;
      document.getElementById('survey-slidein').classList.remove('open');
    }, 2000);
  }
});
</script>`;

      case "widget":
        return `<!-- Survey Widget - Renders inline -->
<div id="survey-widget-${params.id}"></div>

<script>
(function() {
  const container = document.getElementById('survey-widget-${params.id}');
  if (!container) return;

  // Create iframe
  const iframe = document.createElement('iframe');
  iframe.src = '${embedUrl}';
  iframe.style.cssText = 'width:100%;border:none;border-radius:8px;min-height:400px;';
  iframe.allow = 'clipboard-write';
  container.appendChild(iframe);

  // Auto-resize
  window.addEventListener('message', function(e) {
    if (e.data.type === 'survey:resize') {
      iframe.style.height = e.data.height + 'px';
    }
  });
})();
</script>

<!-- Alternative: Script tag version -->
<!--
<script
  src="${baseUrl}/widget.js"
  data-survey-id="${params.id}"
  data-bg="${encodeURIComponent(embedBgColor)}"
  data-accent="${encodeURIComponent(embedAccentColor)}"
  ${embedHideTitle ? 'data-hide-title="true"' : ''}
  ${embedHideDescription ? 'data-hide-description="true"' : ''}
></script>
-->`;

      case "exit-intent":
        return `<!-- Exit Intent Survey Popup (Like Hotjar) -->
<script>
(function() {
  const SURVEY_ID = '${params.id}';
  const STORAGE_KEY = 'survey_shown_' + SURVEY_ID;
  const SHOW_ONCE = ${exitIntentShowOnce};
  const MIN_TIME_ON_PAGE = ${exitIntentDelay} * 1000; // seconds to ms

  let hasShown = false;
  let pageLoadTime = Date.now();

  // Check if already shown (if show once is enabled)
  if (SHOW_ONCE && localStorage.getItem(STORAGE_KEY)) {
    return;
  }

  function showSurveyPopup() {
    if (hasShown) return;
    if (Date.now() - pageLoadTime < MIN_TIME_ON_PAGE) return;

    hasShown = true;
    if (SHOW_ONCE) {
      localStorage.setItem(STORAGE_KEY, 'true');
    }

    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'survey-exit-overlay';
    overlay.style.cssText = \`
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: fadeIn 0.3s ease;
    \`;

    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = \`
      background: #fff;
      border-radius: 16px;
      max-width: 500px;
      width: 100%;
      max-height: 90vh;
      overflow: hidden;
      position: relative;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4);
      animation: slideUp 0.3s ease;
    \`;

    // Header with message
    const header = document.createElement('div');
    header.style.cssText = \`
      background: linear-gradient(135deg, ${embedAccentColor}, ${embedAccentColor}dd);
      color: #fff;
      padding: 20px 24px;
      text-align: center;
    \`;
    header.innerHTML = \`
      <h3 style="margin:0 0 8px;font-size:20px;font-weight:700;">Wait! Before you go...</h3>
      <p style="margin:0;opacity:0.9;font-size:14px;">We'd love your quick feedback</p>
    \`;

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = \`
      position: absolute;
      top: 12px;
      right: 12px;
      background: rgba(255,255,255,0.2);
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #fff;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: background 0.2s;
    \`;
    closeBtn.onmouseover = function() { this.style.background = 'rgba(255,255,255,0.3)'; };
    closeBtn.onmouseout = function() { this.style.background = 'rgba(255,255,255,0.2)'; };
    closeBtn.onclick = closeSurvey;

    // Iframe container
    const iframeContainer = document.createElement('div');
    iframeContainer.style.cssText = 'padding: 0;';

    const iframe = document.createElement('iframe');
    iframe.src = '${embedUrl}';
    iframe.style.cssText = 'width:100%;height:450px;border:none;';
    iframe.allow = 'clipboard-write';

    iframeContainer.appendChild(iframe);
    modal.appendChild(header);
    modal.appendChild(closeBtn);
    modal.appendChild(iframeContainer);
    overlay.appendChild(modal);

    // Add animation styles
    const style = document.createElement('style');
    style.textContent = \`
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(30px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
    \`;
    document.head.appendChild(style);

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    // Close on overlay click
    overlay.onclick = function(e) {
      if (e.target === overlay) closeSurvey();
    };

    // Listen for completion
    window.addEventListener('message', function handler(e) {
      if (e.data.type === 'survey:completed') {
        setTimeout(closeSurvey, 2000);
      }
      if (e.data.type === 'survey:resize') {
        iframe.style.height = Math.min(e.data.height, window.innerHeight * 0.7) + 'px';
      }
    });
  }

  function closeSurvey() {
    const overlay = document.getElementById('survey-exit-overlay');
    if (overlay) {
      overlay.style.animation = 'fadeIn 0.2s ease reverse';
      setTimeout(function() {
        overlay.remove();
        document.body.style.overflow = '';
      }, 200);
    }
  }

  // Exit intent detection (mouse leaves viewport at top)
  document.addEventListener('mouseout', function(e) {
    if (e.clientY < 10 && e.relatedTarget === null) {
      showSurveyPopup();
    }
  });

  // Mobile: detect back button / page visibility change
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') {
      // User is leaving - we can't show popup here but can track
    }
  });

  // Also show after extended time on page (optional engagement trigger)
  setTimeout(function() {
    if (!hasShown && Date.now() - pageLoadTime > 60000) { // 60 seconds
      // Uncomment below to also show after 60s on page
      // showSurveyPopup();
    }
  }, 60000);
})();
</script>`;

      default:
        return "";
    }
  };

  const embedCode = getEmbedCode();

  const copyEmbedCode = async () => {
    await navigator.clipboard.writeText(embedCode);
    setEmbedCopied(true);
    setTimeout(() => setEmbedCopied(false), 2000);
  };

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
        body: JSON.stringify({
          emails: allEmails,
          subject: emailSubject || undefined,
          senderName: senderName || undefined,
          customMessage: customMessage || undefined,
          emailTitle: emailTitle || undefined,
          ctaButtonText: ctaButtonText !== "Take Survey →" ? ctaButtonText : undefined,
          timeEstimate: timeEstimate !== "2-3 minutes" ? timeEstimate : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send invitations");
      }

      const data = await res.json();
      const successful = data.results.filter((r: { success: boolean }) => r.success).length;
      const failedResults = data.results.filter((r: { success: boolean }) => !r.success);

      if (successful > 0) {
        setSuccessMessage(
          `Successfully sent ${successful} invitation${successful > 1 ? "s" : ""}${
            failedResults.length > 0 ? `. ${failedResults.length} failed.` : ""
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
        // Show the actual error from Resend
        const firstError = failedResults[0]?.error || "Unknown error";
        setError(`Failed to send invitations: ${firstError}`);
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
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="w-8 h-8 text-[#FF4F01] mx-auto mb-3" />
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-[#6b6b7b] text-sm"
          >
            Loading distribution options...
          </motion.p>
        </motion.div>
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

      <motion.div
        className="container mx-auto px-6 py-8 max-w-3xl"
        variants={pageVariants}
        initial="initial"
        animate="animate"
      >
        <AnimatePresence>
          {!survey.published && (
            <motion.div
              variants={cardVariants}
              initial="initial"
              animate="animate"
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="mb-6 border-amber-200 bg-amber-50">
                <CardContent className="p-4">
                  <p className="text-amber-800 text-sm">
                    This survey is not published yet. You need to publish it before sending invitations.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Share Link */}
        <motion.div variants={cardVariants}>
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
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button variant="outline" onClick={copyLink}>
                    <AnimatePresence mode="wait">
                      {copied ? (
                        <motion.div
                          key="check"
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          exit={{ scale: 0, rotate: 180 }}
                          transition={{ type: "spring", stiffness: 500, damping: 25 }}
                        >
                          <Check className="w-4 h-4 text-green-500" />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="copy"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                        >
                          <Copy className="w-4 h-4" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Button>
                </motion.div>
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
                    onClick={() => updateSurvey({ accessType: "UNLISTED" })}
                    disabled={updating}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                      survey.accessType === "UNLISTED"
                        ? "bg-[#1a1a2e] text-white border-[#1a1a2e]"
                        : "bg-white text-[#6b6b7b] border-[#dcd6f6] hover:border-[#1a1a2e]"
                    }`}
                  >
                    <LinkIcon className="w-4 h-4" />
                    Anyone with Link
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
                  {survey.accessType === "UNLISTED" && "Anyone with the link can respond"}
                  {survey.accessType === "INVITE_ONLY" && "Only invited emails can respond (requires sign-in)"}
                </p>
              </div>

              {/* Reminder Settings - Only show for INVITE_ONLY surveys */}
              {survey.accessType === "INVITE_ONLY" && (
                <div className="pt-4 border-t border-[#dcd6f6]">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-[#1a1a2e] flex items-center gap-2">
                      <Bell className="w-4 h-4" />
                      Automatic Reminders
                    </label>
                    <button
                      onClick={() => updateSurvey({ reminderEnabled: !survey.reminderEnabled })}
                      disabled={updating}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        survey.reminderEnabled ? "bg-[#FF4F01]" : "bg-[#dcd6f6]"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          survey.reminderEnabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  {survey.reminderEnabled && (
                    <div className="space-y-3 pl-6">
                      <div className="flex items-center gap-3">
                        <label className="text-sm text-[#6b6b7b] min-w-[120px]">Send reminder every</label>
                        <select
                          value={survey.reminderIntervalDays || 3}
                          onChange={(e) => updateSurvey({ reminderIntervalDays: parseInt(e.target.value) })}
                          disabled={updating}
                          className="px-3 py-1.5 rounded-lg border border-[#dcd6f6] text-sm bg-white"
                        >
                          <option value={1}>1 day</option>
                          <option value={2}>2 days</option>
                          <option value={3}>3 days</option>
                          <option value={5}>5 days</option>
                          <option value={7}>7 days</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="text-sm text-[#6b6b7b] min-w-[120px]">Maximum reminders</label>
                        <select
                          value={survey.reminderMaxCount || 2}
                          onChange={(e) => updateSurvey({ reminderMaxCount: parseInt(e.target.value) })}
                          disabled={updating}
                          className="px-3 py-1.5 rounded-lg border border-[#dcd6f6] text-sm bg-white"
                        >
                          <option value={1}>1 reminder</option>
                          <option value={2}>2 reminders</option>
                          <option value={3}>3 reminders</option>
                          <option value={5}>5 reminders</option>
                        </select>
                      </div>
                      <p className="text-xs text-[#6b6b7b]">
                        Reminders are sent automatically to invitees who haven&apos;t responded yet.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Embed Code */}
        <motion.div variants={cardVariants}>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="w-5 h-5" />
                Embed Code
              </CardTitle>
              <CardDescription>
                Embed this survey on your website or app
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Embed Type Tabs */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "iframe", label: "Inline", icon: Square, desc: "Embed directly on page" },
                    { id: "popup", label: "Popup", icon: MousePointerClick, desc: "Button opens modal" },
                    { id: "slidein", label: "Slide-in", icon: MessageSquare, desc: "Floating feedback button" },
                    { id: "widget", label: "Widget", icon: Puzzle, desc: "JavaScript widget" },
                    { id: "exit-intent", label: "Exit Intent", icon: LogOut, desc: "Show when leaving" },
                  ].map(({ id, label, icon: Icon, desc }) => (
                    <button
                      key={id}
                      onClick={() => setEmbedType(id as typeof embedType)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-left ${
                        embedType === id
                          ? "bg-[#FF4F01] text-white border-[#FF4F01]"
                          : "bg-white text-[#6b6b7b] border-[#dcd6f6] hover:border-[#FF4F01]"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <div>
                        <p className="text-sm font-medium">{label}</p>
                        <p className={`text-xs ${embedType === id ? "text-white/80" : "text-[#9b9bab]"}`}>{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Common Options: Colors */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Background Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={embedBgColor}
                        onChange={(e) => setEmbedBgColor(e.target.value)}
                        className="w-10 h-10 rounded border border-[#dcd6f6] cursor-pointer"
                      />
                      <Input
                        value={embedBgColor}
                        onChange={(e) => setEmbedBgColor(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Accent Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={embedAccentColor}
                        onChange={(e) => setEmbedAccentColor(e.target.value)}
                        className="w-10 h-10 rounded border border-[#dcd6f6] cursor-pointer"
                      />
                      <Input
                        value={embedAccentColor}
                        onChange={(e) => setEmbedAccentColor(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Type-Specific Options */}
                {embedType === "iframe" && (
                  <div className="space-y-4 p-4 bg-[#fbf5ea] rounded-lg">
                    <p className="text-sm font-medium text-[#1a1a2e]">Inline Embed Options</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-[#6b6b7b] mb-1 block">Width</label>
                        <Input
                          value={embedWidth}
                          onChange={(e) => setEmbedWidth(e.target.value)}
                          placeholder="100%"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-[#6b6b7b] mb-1 block">Height (px)</label>
                        <Input
                          value={embedHeight}
                          onChange={(e) => setEmbedHeight(e.target.value)}
                          placeholder="600"
                        />
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={embedHideTitle}
                          onChange={(e) => setEmbedHideTitle(e.target.checked)}
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-sm">Hide title</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={embedHideDescription}
                          onChange={(e) => setEmbedHideDescription(e.target.checked)}
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-sm">Hide description</span>
                      </label>
                    </div>
                  </div>
                )}

                {embedType === "popup" && (
                  <div className="space-y-4 p-4 bg-[#fbf5ea] rounded-lg">
                    <p className="text-sm font-medium text-[#1a1a2e]">Popup Button Options</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-[#6b6b7b] mb-1 block">Button Text</label>
                        <Input
                          value={popupButtonText}
                          onChange={(e) => setPopupButtonText(e.target.value)}
                          placeholder="Take Survey"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-[#6b6b7b] mb-1 block">Button Style</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setPopupButtonStyle("filled")}
                            className={`flex-1 py-2 px-3 rounded border text-sm transition-all ${
                              popupButtonStyle === "filled"
                                ? "bg-[#1a1a2e] text-white border-[#1a1a2e]"
                                : "bg-white border-[#dcd6f6]"
                            }`}
                          >
                            Filled
                          </button>
                          <button
                            onClick={() => setPopupButtonStyle("outline")}
                            className={`flex-1 py-2 px-3 rounded border text-sm transition-all ${
                              popupButtonStyle === "outline"
                                ? "bg-[#1a1a2e] text-white border-[#1a1a2e]"
                                : "bg-white border-[#dcd6f6]"
                            }`}
                          >
                            Outline
                          </button>
                        </div>
                      </div>
                    </div>
                    {/* Preview */}
                    <div className="pt-2">
                      <p className="text-xs text-[#6b6b7b] mb-2">Preview:</p>
                      <button
                        style={{
                          background: popupButtonStyle === "filled" ? embedAccentColor : "transparent",
                          color: popupButtonStyle === "filled" ? "#fff" : embedAccentColor,
                          border: `2px solid ${embedAccentColor}`,
                          padding: "10px 20px",
                          borderRadius: "8px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {popupButtonText}
                      </button>
                    </div>
                  </div>
                )}

                {embedType === "slidein" && (
                  <div className="space-y-4 p-4 bg-[#fbf5ea] rounded-lg">
                    <p className="text-sm font-medium text-[#1a1a2e]">Floating Button Options</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-[#6b6b7b] mb-1 block">Button Text</label>
                        <Input
                          value={slideinButtonText}
                          onChange={(e) => setSlideinButtonText(e.target.value)}
                          placeholder="Feedback"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-[#6b6b7b] mb-1 block">Position</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSlideinPosition("bottom-right")}
                            className={`flex-1 py-2 px-3 rounded border text-sm transition-all ${
                              slideinPosition === "bottom-right"
                                ? "bg-[#1a1a2e] text-white border-[#1a1a2e]"
                                : "bg-white border-[#dcd6f6]"
                            }`}
                          >
                            ↘ Right
                          </button>
                          <button
                            onClick={() => setSlideinPosition("bottom-left")}
                            className={`flex-1 py-2 px-3 rounded border text-sm transition-all ${
                              slideinPosition === "bottom-left"
                                ? "bg-[#1a1a2e] text-white border-[#1a1a2e]"
                                : "bg-white border-[#dcd6f6]"
                            }`}
                          >
                            ↙ Left
                          </button>
                        </div>
                      </div>
                    </div>
                    {/* Preview */}
                    <div className="pt-2">
                      <p className="text-xs text-[#6b6b7b] mb-2">Preview:</p>
                      <button
                        style={{
                          background: embedAccentColor,
                          color: "#fff",
                          padding: "10px 18px",
                          borderRadius: "50px",
                          fontWeight: 600,
                          fontSize: "14px",
                          border: "none",
                          boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
                          cursor: "pointer",
                        }}
                      >
                        💬 {slideinButtonText}
                      </button>
                    </div>
                  </div>
                )}

                {embedType === "widget" && (
                  <div className="space-y-4 p-4 bg-[#fbf5ea] rounded-lg">
                    <p className="text-sm font-medium text-[#1a1a2e]">Widget Options</p>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={embedHideTitle}
                          onChange={(e) => setEmbedHideTitle(e.target.checked)}
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-sm">Hide title</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={embedHideDescription}
                          onChange={(e) => setEmbedHideDescription(e.target.checked)}
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-sm">Hide description</span>
                      </label>
                    </div>
                    <p className="text-xs text-[#6b6b7b]">
                      The widget auto-resizes based on survey content and adapts to container width.
                    </p>
                  </div>
                )}

                {embedType === "exit-intent" && (
                  <div className="space-y-4 p-4 bg-[#fbf5ea] rounded-lg">
                    <p className="text-sm font-medium text-[#1a1a2e]">Exit Intent Options</p>
                    <p className="text-xs text-[#6b6b7b]">
                      Shows the survey when visitors move their mouse to leave the page (like Hotjar).
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-[#6b6b7b] mb-1 block">Min. time on page (seconds)</label>
                        <Input
                          value={exitIntentDelay}
                          onChange={(e) => setExitIntentDelay(e.target.value)}
                          placeholder="5"
                          type="number"
                          min="0"
                        />
                      </div>
                      <div className="flex items-end pb-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={exitIntentShowOnce}
                            onChange={(e) => setExitIntentShowOnce(e.target.checked)}
                            className="w-4 h-4 rounded"
                          />
                          <span className="text-sm">Show only once per visitor</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Embed Code Preview */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Generated Code</label>
                  <div className="relative">
                    <pre className="bg-[#1a1a2e] text-white p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap max-h-80">
                      <code>{embedCode}</code>
                    </pre>
                    <motion.div
                      className="absolute top-2 right-2"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={copyEmbedCode}
                        className="bg-white/10 hover:bg-white/20 text-white"
                      >
                        <AnimatePresence mode="wait">
                          {embedCopied ? (
                            <motion.div
                              key="check"
                              initial={{ scale: 0, rotate: -180 }}
                              animate={{ scale: 1, rotate: 0 }}
                              exit={{ scale: 0, rotate: 180 }}
                              transition={{ type: "spring", stiffness: 500, damping: 25 }}
                              className="flex items-center gap-1"
                            >
                              <Check className="w-4 h-4 text-green-400" />
                              <span>Copied!</span>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="copy"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              className="flex items-center gap-1"
                            >
                              <Copy className="w-4 h-4" />
                              <span>Copy</span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </Button>
                    </motion.div>
                  </div>
                </div>

                {/* Preview Link */}
                <div className="flex items-center gap-2 pt-2">
                  <Link href={`/embed/${params.id}`} target="_blank">
                    <Button variant="outline" size="sm">
                      <Eye className="w-4 h-4 mr-2" />
                      Preview Embed
                    </Button>
                  </Link>
                  <p className="text-xs text-[#6b6b7b]">
                    Opens the embeddable version in a new tab
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

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

        {/* Email Preview & Customization */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Email Template
                </CardTitle>
                <CardDescription>
                  Customize and preview your invitation email
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEmailPreview(!showEmailPreview)}
              >
                {showEmailPreview ? "Hide Preview" : "Show Preview"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Customization Fields */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Subject Line</label>
                  <Input
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder={`You're invited: ${survey.title}`}
                  />
                  <p className="text-xs text-[#6b6b7b] mt-1">
                    Leave blank for default
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Email Title</label>
                  <Input
                    value={emailTitle}
                    onChange={(e) => setEmailTitle(e.target.value)}
                    placeholder={survey.title}
                  />
                  <p className="text-xs text-[#6b6b7b] mt-1">
                    The headline in the email body
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Sender Name</label>
                  <Input
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="Survey Team"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Custom Message (optional)</label>
                  <Textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Add a personal note to your invitation..."
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Button Text</label>
                    <Input
                      value={ctaButtonText}
                      onChange={(e) => setCtaButtonText(e.target.value)}
                      placeholder="Take Survey →"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Time Estimate</label>
                    <Input
                      value={timeEstimate}
                      onChange={(e) => setTimeEstimate(e.target.value)}
                      placeholder="2-3 minutes"
                    />
                    <p className="text-xs text-[#6b6b7b] mt-1">
                      Auto-calculated from {survey.questions?.length || 0} questions
                    </p>
                  </div>
                </div>
              </div>

              {/* Preview Panel */}
              {showEmailPreview && (
                <div className="border rounded-lg overflow-hidden bg-[#1a1a2e]">
                  <div className="p-2 bg-[#2d2d44] border-b border-white/10 flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/80" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                      <div className="w-3 h-3 rounded-full bg-green-500/80" />
                    </div>
                    <span className="text-white/50 text-xs ml-2">Email Preview</span>
                  </div>
                  <div className="p-4 max-h-[400px] overflow-y-auto">
                    {/* Logo */}
                    <div className="flex justify-center mb-4">
                      <Image
                        src="https://cdn.prod.website-files.com/686e52cd9c00136ae69ac4d6/68751c8e13a5456b2330eb95_andus-sun-1.svg"
                        alt="Andus Labs"
                        width={32}
                        height={32}
                      />
                    </div>
                    {/* Mini email preview */}
                    <div className="bg-white rounded-lg overflow-hidden shadow-lg">
                      <div className="h-1.5 bg-gradient-to-r from-[#FF4F01] to-[#ff7033]" />
                      <div className="p-4">
                        <p className="text-[10px] uppercase tracking-wider text-[#FF4F01] font-semibold mb-1">
                          Survey Invitation
                        </p>
                        <h3 className="font-['Syne'] font-bold text-sm text-[#1a1a2e] mb-2">
                          {emailTitle || survey.title}
                        </h3>
                        {customMessage && (
                          <p className="text-xs text-[#4a4a5a] mb-2 p-2 bg-[#f3f4f6] rounded">
                            {customMessage}
                          </p>
                        )}
                        <p className="text-xs text-[#6b6b7b] mb-3">
                          {senderName || "Survey Team"} has invited you to share your feedback.
                        </p>
                        <div className="inline-block bg-gradient-to-r from-[#FF4F01] to-[#e54600] text-white text-xs font-semibold px-4 py-2 rounded-lg">
                          {ctaButtonText || "Take Survey →"}
                        </div>
                        <p className="text-[10px] text-[#9ca3af] mt-3">
                          ⏱ Takes about {timeEstimate || "2-3 minutes"}
                        </p>
                      </div>
                    </div>
                    <p className="text-center text-white/30 text-[10px] mt-3">
                      Powered by Andus Labs
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        </motion.div>

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
      </motion.div>

      {/* Group Modal */}
      <AnimatePresence>
        {showGroupModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
            >
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
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
