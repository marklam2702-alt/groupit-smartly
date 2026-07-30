import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  AREAS_OF_EXPERTISE,
  GROUP_NAMES,
  INDUSTRY_SECTORS,
  type Expertise,
  type GroupResult,
  type Industry,
} from "@/lib/grouping";
import { Trash2 } from "lucide-react";
import {
  createSession,
  deleteIndividual,
  finishSession,
  reopenSession,
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
};

const HOST_KEY = "groupit.host";

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
      toast.error(e instanceof Error ? e.message : "Invalid session code or creator password");
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
                <CardTitle className="text-base">Return as creator</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Already created a session on another device? Enter the session code and the
                  creator password shown on your creator screen.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    value={hostCode}
                    onChange={(e) => setHostCode(e.target.value.toUpperCase())}
                    placeholder="Session code"
                    maxLength={10}
                  />
                  <Input
                    value={hostPassword}
                    onChange={(e) => setHostPassword(e.target.value)}
                    placeholder="Creator password"
                    autoComplete="off"
                    onKeyDown={(e) => e.key === "Enter" && handleHostLogin()}
                  />
                </div>
                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={busy || !hostCode.trim() || !hostPassword.trim()}
                  onClick={handleHostLogin}
                >
                  Unlock creator access
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return <SessionView code={code} hostToken={hostToken} />;
}

function SessionView({ code, hostToken }: { code: string; hostToken: string | null }) {
  const [session, setSession] = useState<SessionRow | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [nickName, setNickName] = useState("");
  const [industry, setIndustry] = useState<Industry | "">("");
  const [industryOther, setIndustryOther] = useState("");
  const [expertise, setExpertise] = useState<Expertise | "">("");
  const [expertiseOther, setExpertiseOther] = useState("");
  const [busy, setBusy] = useState(false);
  const nickRef = useRef<HTMLInputElement>(null);

  const runFinish = useServerFn(finishSession);
  const runDelete = useServerFn(deleteIndividual);
  const runClear = useServerFn(reopenSession);
  const isHost = !!hostToken;
  const finished = session?.status === "finished";
  const result = session?.result ?? null;
  const groupedIds = new Set(result ? result.groups.flat().map((g) => g.id) : []);

  const loadAll = useCallback(async () => {
    const { data: s } = await supabase
      .from("sessions")
      .select("id, code, status, result")
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
      await runFinish({ data: { code, hostToken } });
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

  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/?code=${code}` : "";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Group It</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Session code{" "}
              <span className="font-mono text-base font-semibold text-foreground">{code}</span>{" "}
              — share it so others can submit from their own device.
              {isHost && " You are the creator."}
            </p>
            {isHost && hostToken && (
              <p className="mt-2 text-sm text-muted-foreground">
                Creator password{" "}
                <span className="font-mono text-foreground">{hostToken}</span>{" "}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(hostToken);
                    toast.success("Creator password copied");
                  }}
                >
                  Copy
                </Button>
                <br />
                Keep it private — use it with the session code to return as creator from another
                device.
              </p>
            )}
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
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Add individual</CardTitle>
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
                    <Label>Industry Sector</Label>
                    <Select value={industry} onValueChange={(v) => setIndustry(v as Industry)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an industry" />
                      </SelectTrigger>
                      <SelectContent>
                        {INDUSTRY_SECTORS.map((i) => (
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
                        placeholder="Please specify industry"
                        maxLength={60}
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Area of Expertise</Label>
                    <Select value={expertise} onValueChange={(v) => setExpertise(v as Expertise)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an area of expertise" />
                      </SelectTrigger>
                      <SelectContent>
                        {AREAS_OF_EXPERTISE.map((i) => (
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
                        placeholder="Please specify area of expertise"
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
          <div className="mt-8 flex justify-center gap-3">
            <Button
              size="lg"
              onClick={handleFinish}
              disabled={busy || rows.length === 0}
              className="min-w-48"
            >
              {finished ? "Run grouping again" : "FINISH"}
            </Button>
          </div>
        )}
        {!isHost && !finished && (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Waiting for the session creator to press FINISH. Results appear here automatically.
          </p>
        )}

        {result && (
          <section className="mt-10">
            <h2 className="mb-4 text-xl font-semibold text-foreground">Result — 4 groups</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {result.groups.map((g, i) => (
                <Card key={i}>
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
                        <li key={s.id} className="rounded-md border border-border p-2">
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
