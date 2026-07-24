import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
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
import { Trash2 } from "lucide-react";
import {
  AREAS_OF_EXPERTISE,
  INDUSTRY_SECTORS,
  sortIntoGroups,
  type Expertise,
  type Industry,
  type Sample,
} from "@/lib/grouping";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sample Sorter — 4 Balanced Groups" },
      {
        name: "description",
        content:
          "Collect samples with industry and expertise and split them into four balanced, similarity-aware groups.",
      },
      { property: "og:title", content: "Sample Sorter — 4 Balanced Groups" },
      {
        property: "og:description",
        content:
          "Collect samples with industry and expertise and split them into four balanced, similarity-aware groups.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function Page() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [nickName, setNickName] = useState("");
  const [industry, setIndustry] = useState<Industry | "">("");
  const [industryOther, setIndustryOther] = useState("");
  const [expertise, setExpertise] = useState<Expertise | "">("");
  const [expertiseOther, setExpertiseOther] = useState("");
  const [finished, setFinished] = useState(false);
  const nickRef = useRef<HTMLInputElement>(null);

  const canInput =
    nickName.trim().length > 0 &&
    industry !== "" &&
    expertise !== "" &&
    (industry !== "Others" || industryOther.trim().length > 0) &&
    (expertise !== "Others" || expertiseOther.trim().length > 0);

  const canFinish = samples.length >= 10 && samples.length <= 30;

  const handleAdd = () => {
    if (!canInput) return;
    const s: Sample = {
      id: newId(),
      nickName: nickName.trim(),
      industry: industry as Industry,
      industryOther: industry === "Others" ? industryOther.trim() : undefined,
      expertise: expertise as Expertise,
      expertiseOther: expertise === "Others" ? expertiseOther.trim() : undefined,
    };
    setSamples((prev) => [...prev, s]);
    setNickName("");
    setIndustry("");
    setIndustryOther("");
    setExpertise("");
    setExpertiseOther("");
    setFinished(false);
    setTimeout(() => nickRef.current?.focus(), 0);
  };

  const handleRemove = (id: string) => {
    setSamples((prev) => prev.filter((s) => s.id !== id));
    setFinished(false);
  };

  const handleReset = () => {
    setSamples([]);
    setFinished(false);
  };

  const result = useMemo(
    () => (finished ? sortIntoGroups(samples, 4) : null),
    [finished, samples],
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Sample Sorter
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter 10–30 samples, then split them into 4 balanced groups by shared
            expertise and industry.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Input form */}
          <Card>
            <CardHeader>
              <CardTitle>Add sample</CardTitle>
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
                <Select
                  value={industry}
                  onValueChange={(v) => setIndustry(v as Industry)}
                >
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
                <Select
                  value={expertise}
                  onValueChange={(v) => setExpertise(v as Expertise)}
                >
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

              <div className="flex gap-2 pt-2">
                <Button onClick={handleAdd} disabled={!canInput} className="flex-1">
                  Input
                </Button>
                {samples.length > 0 && (
                  <Button variant="outline" onClick={handleReset}>
                    Clear all
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {samples.length} entered · need 10–30 to finish
              </p>
            </CardContent>
          </Card>

          {/* Samples list */}
          <Card>
            <CardHeader>
              <CardTitle>Samples ({samples.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {samples.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No samples yet. Add your first one on the left.
                </p>
              ) : (
                <ul className="space-y-2 max-h-[420px] overflow-auto pr-1">
                  {samples.map((s, idx) => (
                    <li
                      key={s.id}
                      className="flex items-start justify-between gap-2 rounded-md border border-border bg-card p-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            #{idx + 1}
                          </span>
                          <span className="font-medium text-foreground truncate">
                            {s.nickName}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Badge variant="secondary">
                            {s.industry === "Others"
                              ? `Industry: ${s.industryOther}`
                              : s.industry}
                          </Badge>
                          <Badge variant="outline">
                            {s.expertise === "Others"
                              ? `Expertise: ${s.expertiseOther}`
                              : s.expertise}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemove(s.id)}
                        aria-label={`Remove ${s.nickName}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 flex justify-center">
          <Button
            size="lg"
            onClick={() => setFinished(true)}
            disabled={!canFinish}
            className="min-w-48"
          >
            FINISH
          </Button>
        </div>
        {!canFinish && samples.length > 0 && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Enter between 10 and 30 samples to run the sort.
          </p>
        )}

        {result && (
          <section className="mt-10">
            <h2 className="mb-4 text-xl font-semibold text-foreground">
              Result — 4 groups
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {result.groups.map((g, i) => (
                <Card key={i}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Group {i + 1}{" "}
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
                          className="rounded-md border border-border p-2"
                        >
                          <div className="font-medium text-foreground">
                            {s.nickName}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <Badge variant="secondary" className="text-[10px]">
                              {s.industry === "Others"
                                ? s.industryOther
                                : s.industry}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {s.expertise === "Others"
                                ? s.expertiseOther
                                : s.expertise}
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
