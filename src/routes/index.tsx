import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { GROUP_NAMES, type GroupResult, type GroupingBasis } from "@/lib/grouping";
import {
  categoriesToRows,
  normalizeCategories,
  rowsToCategories,
  type CategoryConfig,
} from "@/lib/categories";
import { Download, Trash2, Eye, EyeOff, Upload } from "lucide-react";
import {
  createSession,
  deleteIndividual,
  finishSession,
  moveIndividual,

  reopenSession,
  updateCategories,
  updateHostPassword,
  verifyHost,
} from "@/lib/session.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Group It — Shared Sessions, 4 Balanced Groups" },
      {
        name: "description",
        content:
          "Create a session code, collect individuals from any device in real time, then split everyone into four balanced groups.",
      },
      { property: "og:title", content: "Group It — Shared Sessions, 4 Balanced Groups" },
      {
        property: "og:description",
        content:
          "Create a session code, collect individuals from any device in real time, then split everyone into four balanced groups.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

type Row = {
  id: string;
  nick_name: string;
  industry: string;
  industry_other: string | null;
  expertise: string;
  expertise_other: string | null;
  created_at: string;
};

type SessionRow = {
  id: string;
  code: string;
  status: string;
  result: GroupResult | null;
  categories: unknown;
};

const HOST_KEY = "groupit.host";

function SessionQrCode({ url }: { url: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { width: 96, margin: 2, color: { dark: "#000000", light: "#ffffff" } })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [url]);
  if (!dataUrl) return null;
  return (
    <img
      src={dataUrl}
      alt="QR code to join this session"
      className="h-24 w-24 rounded-md border border-border bg-white"
    />
  );
}

function loadHostTokens(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(HOST_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveHostToken(code: string, token: string) {
  const all = loadHostTokens();
  all[code] = token;
  localStorage.setItem(HOST_KEY, JSON.stringify(all));
}

function Page() {
  const [code, setCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [hostCode, setHostCode] = useState("");
  const [hostPassword, setHostPassword] = useState("");
  const [showHostPassword, setShowHostPassword] = useState(false);
  const [hostToken, setHostToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = useServerFn(createSession);
  const claimHost = useServerFn(verifyHost);

  const handleHostLogin = async () => {
    const c = hostCode.trim().toUpperCase();
    const token = hostPassword.trim();
    if (!c || !token) return;
    setBusy(true);
    try {
      const res = await claimHost({ data: { code: c, hostToken: token } });
      saveHostToken(res.code, token);
      setHostToken(token);
      setCode(res.code);
      window.history.replaceState(null, "", `?code=${res.code}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invalid session code or host password");
    } finally {
      setBusy(false);
    }
  };


  const handleCreate = async () => {
    setBusy(true);
    try {
      const res = await create();
      saveHostToken(res.code, res.hostToken);
      setHostToken(res.hostToken);
      setCode(res.code);
      window.history.replaceState(null, "", `?code=${res.code}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create session");
    } finally {
      setBusy(false);
    }
  };

  const enterCode = useCallback(async (raw: string) => {
    const c = raw.trim().toUpperCase();
    if (!c) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("sessions")
        .select("id, code")
        .eq("code", c)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error("Session not found");
        return;
      }
      setHostToken(loadHostTokens()[c] ?? null);
      setCode(c);
      window.history.replaceState(null, "", `?code=${c}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not join session");
    } finally {
      setBusy(false);
    }
  }, []);

  // Auto-join from ?code=
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("code");
    if (c) enterCode(c);
  }, [enterCode]);

  if (!code) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-2xl px-4 py-16">
          <header className="mb-10 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Group It</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Collect individuals from any number of devices, then split them into 4 balanced
              groups.
            </p>
          </header>

          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Create a session</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  You get a session code to share. Only you can run the sort.
                </p>
                <Button onClick={handleCreate} disabled={busy} className="w-full">
                  Create session
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Join a session</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. K7QP2M"
                  maxLength={10}
                  onKeyDown={(e) => e.key === "Enter" && enterCode(joinCode)}
                />
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={busy || !joinCode.trim()}
                  onClick={() => enterCode(joinCode)}
                >
                  Join
                </Button>
              </CardContent>
            </Card>

            <Card className="sm:col-span-2">
              <CardHeader>
              <CardTitle className="text-base">Return as host</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Already created a session on another device? Enter the session code and the
                  host password shown on your host screen.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    value={hostCode}
                    onChange={(e) => setHostCode(e.target.value.toUpperCase())}
                    placeholder="Session code"
                    maxLength={10}
                  />
                  <div className="relative">
                    <Input
                      value={hostPassword}
                      onChange={(e) => setHostPassword(e.target.value)}
                      type={showHostPassword ? "text" : "password"}
                      placeholder="Host password"
                      autoComplete="off"
                      onKeyDown={(e) => e.key === "Enter" && handleHostLogin()}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowHostPassword((v) => !v)}
                      aria-label={showHostPassword ? "Hide password" : "Show password"}
                    >
                      {showHostPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={busy || !hostCode.trim() || !hostPassword.trim()}
                  onClick={handleHostLogin}
                >
                  Unlock host access
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SessionView
      code={code}
      hostToken={hostToken}
      onHostTokenChange={(t) => {
        setHostToken(t);
        if (code) saveHostToken(code, t);
      }}
      onExit={() => {
        setCode(null);
        setHostToken(null);
        setJoinCode("");
        setHostCode("");
        setHostPassword("");
        window.history.replaceState(null, "", window.location.pathname);
      }}
    />
  );
}

function SessionView({
  code,
  hostToken,
  onExit,
  onHostTokenChange,
}: {
  code: string;
  hostToken: string | null;
  onExit: () => void;
  onHostTokenChange: (token: string) => void;
}) {
  const [session, setSession] = useState<SessionRow | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [nickName, setNickName] = useState("");
  const [industry, setIndustry] = useState("");
  const [industryOther, setIndustryOther] = useState("");
  const [expertise, setExpertise] = useState("");
  const [expertiseOther, setExpertiseOther] = useState("");
  const [busy, setBusy] = useState(false);
  const [groupCountChoice, setGroupCountChoice] = useState(4);
  const [basisChoice, setBasisChoice] = useState<GroupingBasis>("first");
  const [showSessionPassword, setShowSessionPassword] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const nickRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const runFinish = useServerFn(finishSession);
  const runChangePassword = useServerFn(updateHostPassword);
  const runDelete = useServerFn(deleteIndividual);
  const runClear = useServerFn(reopenSession);
  const runUpdateCategories = useServerFn(updateCategories);
  const runMove = useServerFn(moveIndividual);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<number | null>(null);

  const isHost = !!hostToken;
  const finished = session?.status === "finished";
  const result = session?.result ?? null;
  const groupCount = result?.groups.length ?? groupCountChoice;
  const groupCountLocked = !!result;
  const basis: GroupingBasis = result?.basis ?? basisChoice;
  const groupedIds = new Set(result ? result.groups.flat().map((g) => g.id) : []);
  const cats: CategoryConfig = normalizeCategories(session?.categories);


  const loadAll = useCallback(async () => {
    const { data: s } = await supabase
      .from("sessions")
      .select("id, code, status, result, categories")
      .eq("code", code)
      .maybeSingle();
    if (!s) return;
    setSession(s as unknown as SessionRow);
    const { data: list } = await supabase
      .from("individuals")
      .select("*")
      .eq("session_id", s.id)
      .order("created_at", { ascending: true });
    setRows((list ?? []) as Row[]);
  }, [code]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Live updates
  useEffect(() => {
    if (!session?.id) return;
    const channel = supabase
      .channel(`session-${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "individuals",
          filter: `session_id=eq.${session.id}`,
        },
        () => loadAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions", filter: `id=eq.${session.id}` },
        () => loadAll(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.id, loadAll]);

  const canInput =
    nickName.trim().length > 0 &&
    industry !== "" &&
    expertise !== "" &&
    (industry !== "Others" || industryOther.trim().length > 0) &&
    (expertise !== "Others" || expertiseOther.trim().length > 0);

  const handleAdd = async () => {
    if (!canInput || !session) return;
    setBusy(true);
    const { error } = await supabase.from("individuals").insert({
      session_id: session.id,
      nick_name: nickName.trim(),
      industry,
      industry_other: industry === "Others" ? industryOther.trim() : null,
      expertise,
      expertise_other: expertise === "Others" ? expertiseOther.trim() : null,
    });
    setBusy(false);
    if (error) {
      toast.error("Could not save — the session may be closed.");
      return;
    }
    toast.success("Saved");
    setNickName("");
    setIndustry("");
    setIndustryOther("");
    setExpertise("");
    setExpertiseOther("");
    loadAll();
    setTimeout(() => nickRef.current?.focus(), 0);
  };

  const handleFinish = async () => {
    if (!hostToken) return;
    setBusy(true);
    try {
      await runFinish({ data: { code, hostToken, groupCount, basis } });
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sort failed");
    } finally {
      setBusy(false);
    }
  };


  const handleDelete = async (id: string) => {
    if (!hostToken) return;
    setBusy(true);
    try {
      await runDelete({ data: { code, hostToken, id } });
      await loadAll();
      toast.success("Removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setBusy(false);
    }
  };

  const handleDropOnGroup = async (toGroup: number) => {
    const id = dragId;
    setDragId(null);
    setDragOverGroup(null);
    if (!id || !hostToken || !result) return;
    const fromGroup = result.groups.findIndex((g) => g.some((m) => m.id === id));
    if (fromGroup === toGroup) return;
    setBusy(true);
    try {
      await runMove({ data: { code, hostToken, id, toGroup } });
      await loadAll();
      toast.success(`Moved to Group ${GROUP_NAMES[toGroup] ?? toGroup + 1}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not move individual");
    } finally {
      setBusy(false);
    }
  };


  const handleClear = async () => {
    if (!hostToken) return;
    setBusy(true);
    try {
      await runClear({ data: { code, hostToken } });
      await loadAll();
      toast.success("Group result cleared");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not clear result");
    } finally {
      setBusy(false);
    }
  };

  const handleChangePassword = async () => {
    if (!hostToken) return;
    const pw = newPassword.trim();
    if (pw.length < 6 || pw.length > 10) {
      toast.error("Password must be 6-10 characters");
      return;
    }
    setBusy(true);
    try {
      const res = await runChangePassword({ data: { code, hostToken, newPassword: pw } });
      onHostTokenChange(res.hostToken);
      setEditingPassword(false);
      setNewPassword("");
      toast.success("Creator password updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update password");
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async () => {
    if (!result) return;
    const XLSX = await import("xlsx");
    const rowsOut: (string | null)[][] = [
      ["", "Group", "Nick Name", cats.first.name, cats.second.name],
    ];
    result.groups.forEach((g, i) => {
      g.forEach((s) => {
        rowsOut.push([
          "",
          GROUP_NAMES[i] ?? String(i + 1),
          s.nickName,
          s.industry === "Others" ? (s.industryOther ?? "Others") : s.industry,
          s.expertise === "Others" ? (s.expertiseOther ?? "Others") : s.expertise,
        ]);
      });
    });
    const ws = XLSX.utils.aoa_to_sheet(rowsOut);
    ws["!cols"] = [{ wch: 10 }, { wch: 12 }, { wch: 20 }, { wch: 42 }, { wch: 46 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `Group_${code}.xlsx`);
  };


  const handleDownloadCategories = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet(categoriesToRows(cats));
    ws["!cols"] = [{ wch: 16 }, { wch: 50 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, "Category.xlsx");
  };

  const handleUploadCategories = async (file: File) => {
    if (!hostToken) return;
    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: true });
      const next = rowsToCategories(rows);
      await runUpdateCategories({ data: { code, hostToken, categories: next } });
      setIndustry("");
      setIndustryOther("");
      setExpertise("");
      setExpertiseOther("");
      await loadAll();
      toast.success("Categories updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read the file");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/?code=${code}` : "";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-4 flex justify-center sm:justify-start">
          <SessionQrCode url={shareUrl} />
        </div>
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Group It</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Session code{" "}
              <span className="font-mono text-base font-semibold text-foreground">{code}</span>{" "}
              — share it so others can submit from their own device.
              {isHost && " You are the host."}
            </p>
            {isHost && hostToken && (
              <div className="mt-2 text-sm text-muted-foreground">
                {editingPassword ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span>New host password</span>
                    <Input
                      className="h-8 w-44"
                      value={newPassword}
                      maxLength={10}
                      onChange={(e) => setNewPassword(e.target.value)}
                      type={showSessionPassword ? "text" : "password"}
                      placeholder="6-10 characters"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowSessionPassword((v) => !v)}
                      aria-label={showSessionPassword ? "Hide password" : "Show password"}
                    >
                      {showSessionPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                    <Button size="sm" disabled={busy} onClick={handleChangePassword}>
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingPassword(false);
                        setNewPassword("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-1">
                    <span>Host password</span>
                    <span className="font-mono text-foreground">
                      {showSessionPassword ? hostToken : "•".repeat(hostToken.length)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowSessionPassword((v) => !v)}
                      aria-label={showSessionPassword ? "Hide password" : "Show password"}
                    >
                      {showSessionPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(hostToken);
                        toast.success("Host password copied");
                      }}
                    >
                      Copy
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setNewPassword("");
                        setEditingPassword(true);
                      }}
                    >
                      Edit
                    </Button>
                  </div>
                )}
                <p className="mt-1">
                  Keep it private — use it with the session code to return as host from another
                  device.
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <SessionQrCode url={shareUrl} />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={finished ? "secondary" : "outline"}>
                {finished ? "Finished" : "Open"}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl);
                  toast.success("Link copied");
                }}
              >
                Copy link
              </Button>
              <Button variant="ghost" size="sm" onClick={onExit}>
                Exit
              </Button>
            </div>
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle>Add individual</CardTitle>
              {isHost && (
                <div className="flex items-center gap-1">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadCategories(f);
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    title="Download category template"
                    aria-label="Download category template"
                    onClick={handleDownloadCategories}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    title="Upload category file"
                    aria-label="Upload category file"
                    disabled={busy}
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">


                  <div className="space-y-2">
                    <Label htmlFor="nick">Nick Name</Label>
                    <Input
                      id="nick"
                      ref={nickRef}
                      value={nickName}
                      onChange={(e) => setNickName(e.target.value)}
                      placeholder="e.g. Alex"
                      maxLength={40}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{cats.first.name}</Label>
                    <Select value={industry} onValueChange={setIndustry}>
                      <SelectTrigger>
                        <SelectValue placeholder={`Select ${cats.first.name.toLowerCase()}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {cats.first.items.map((i) => (
                          <SelectItem key={i} value={i}>
                            {i}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {industry === "Others" && (
                      <Input
                        value={industryOther}
                        onChange={(e) => setIndustryOther(e.target.value)}
                        placeholder="Please specify"
                        maxLength={60}
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>{cats.second.name}</Label>
                    <Select value={expertise} onValueChange={setExpertise}>
                      <SelectTrigger>
                        <SelectValue placeholder={`Select ${cats.second.name.toLowerCase()}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {cats.second.items.map((i) => (
                          <SelectItem key={i} value={i}>
                            {i}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {expertise === "Others" && (
                      <Input
                        value={expertiseOther}
                        onChange={(e) => setExpertiseOther(e.target.value)}
                        placeholder="Please specify"
                        maxLength={60}
                      />
                    )}
                  </div>

              <Button onClick={handleAdd} disabled={!canInput || busy} className="w-full">
                Input
              </Button>

            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Individuals ({rows.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No individuals yet. Entries appear here live as people submit.
                </p>
              ) : (
                <ul className="max-h-[420px] space-y-2 overflow-auto pr-1">
                  {rows.map((s, idx) => {
                    const isNew = !!result && !groupedIds.has(s.id);
                    return (
                      <li
                        key={s.id}
                        className={`flex items-center gap-2 rounded-md border p-3 ${
                          isNew
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "border-border bg-card"
                        }`}
                      >
                        <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                        <span className="truncate font-medium">{s.nick_name}</span>
                        {isNew && (
                          <Badge variant="outline" className="border-emerald-500 text-[10px]">
                            new
                          </Badge>
                        )}
                        {isHost && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ml-auto text-muted-foreground hover:text-destructive"
                            disabled={busy}
                            onClick={() => handleDelete(s.id)}
                            aria-label={`Delete ${s.nick_name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {isHost && (
          <div className="mt-8 flex flex-col items-center gap-2">
            <span className="text-sm font-medium text-foreground">Number of groups</span>
            <div className="flex gap-2">
              {[2, 3, 4].map((n) => (
                <Button
                  key={n}
                  size="sm"
                  variant={groupCount === n ? "default" : "outline"}
                  disabled={groupCountLocked || busy}
                  onClick={() => setGroupCountChoice(n)}
                >
                  {n} ({GROUP_NAMES.slice(0, n).join(", ")})
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {groupCountLocked
                ? "Locked while a result exists — clear the result to change it."
                : "Choose before running the grouping."}
            </p>

            <span className="mt-4 text-sm font-medium text-foreground">Grouping logic</span>
            <div className="flex flex-wrap justify-center gap-2">
              {([
                ["first", `A. Group by ${cats.first.name}`],
                ["second", `B. Group by ${cats.second.name}`],
              ] as Array<[GroupingBasis, string]>).map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  variant={basis === value ? "default" : "outline"}
                  disabled={groupCountLocked || busy}
                  onClick={() => setBasisChoice(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {groupCountLocked
                ? "Locked while a result exists — clear the result to change it."
                : "Choose before running the grouping."}
            </p>
          </div>
        )}

        {isHost && (
          <div className="mt-6 flex flex-wrap justify-center gap-3">

            <Button
              size="lg"
              onClick={handleFinish}
              disabled={busy || rows.length === 0}
              className="min-w-48"
            >
              {finished ? "Run grouping again" : "RUN GROUPING"}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={handleExport}
              disabled={busy || !result}
            >
              <Download className="mr-2 h-4 w-4" />
              Export .xlsx
            </Button>
            <Button
              size="lg"
              variant="destructive"
              onClick={handleClear}
              disabled={busy || !result}
            >
              Clear result
            </Button>
          </div>
        )}
        {!isHost && !finished && (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Waiting for the session host to press RUN GROUPING. Results appear here automatically.
          </p>
        )}

        {result && (
          <section className="mt-10">
            <h2 className="mb-1 text-xl font-semibold text-foreground">
              Result — {result.groups.length} groups
            </h2>
            {isHost && (
              <p className="mb-4 text-sm text-muted-foreground">
                Drag an individual onto another group to move them manually.
              </p>
            )}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

              {result.groups.map((g, i) => (
                <Card
                  key={i}
                  onDragOver={isHost ? (e) => { e.preventDefault(); setDragOverGroup(i); } : undefined}
                  onDragLeave={isHost ? () => setDragOverGroup((p) => (p === i ? null : p)) : undefined}
                  onDrop={isHost ? (e) => { e.preventDefault(); handleDropOnGroup(i); } : undefined}
                  className={isHost && dragOverGroup === i ? "ring-2 ring-primary" : undefined}
                >
                  <CardHeader>
                    <CardTitle className="text-base">
                      Group {GROUP_NAMES[i] ?? i + 1}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        ({g.length} / target {result.targetSizes[i]})
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {g.map((s) => (
                        <li
                          key={s.id}
                          draggable={isHost && !busy}
                          onDragStart={isHost ? () => setDragId(s.id) : undefined}
                          onDragEnd={isHost ? () => { setDragId(null); setDragOverGroup(null); } : undefined}
                          className={`rounded-md border border-border p-2 ${
                            isHost ? "cursor-grab active:cursor-grabbing" : ""
                          } ${dragId === s.id ? "opacity-50" : ""}`}
                        >
                          <div className="font-medium text-foreground">{s.nickName}</div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <Badge variant="secondary" className="text-[10px]">
                              {s.industry === "Others" ? s.industryOther : s.industry}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {s.expertise === "Others" ? s.expertiseOther : s.expertise}
                            </Badge>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}

            </div>
          </section>
        )}
      </div>
    </div>
  );
}
