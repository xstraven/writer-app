import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Settings, Wand2, Undo2, RefreshCcw, GitBranch, Trash2, Plus, BookText, Info } from "lucide-react";

/**
 * AI-Assisted Story Writer — Mock UI (Development Guide)
 * ------------------------------------------------------------------
 * This single-file React mock prioritizes layout, interactions, and
 * state shape you can wire to your LLM backend later. No persistence.
 *
 * Key Ideas represented here
 * - Draft editor composed of semantic “chunks” (user or LLM generated)
 * - Hovering a chunk highlights it and exposes a per-chunk action menu
 * - Instruction box under editor, then action buttons (Generate, etc.)
 * - Right sidebar: model settings + Context (Synopsis, Lorebook)
 * - Lightweight state model for chunks + history (for revert/branch)
 * - Slots where you’ll integrate API calls (TODO comments)
 */

// ------------------------------------------
// Types
// ------------------------------------------

type Chunk = {
  id: string;
  text: string;
  author: "user" | "llm";
  timestamp: number;
};

// Minimal revision history entry — expand as needed
interface HistoryEntry {
  id: string;
  action: "generate" | "regenerate" | "revert" | "delete" | "branch" | "edit";
  before: Chunk[];
  after: Chunk[];
  at: number;
}

// ------------------------------------------
// Helpers
// ------------------------------------------
const uid = () => Math.random().toString(36).slice(2, 9);

const SAMPLE_CHUNKS: Chunk[] = [
  { id: uid(), text: "The storm arrived on cat feet, all hush and pressure.", author: "user", timestamp: Date.now() - 600000 },
  { id: uid(), text: "Streetlights haloed in the drizzle; Mira kept walking.", author: "llm", timestamp: Date.now() - 540000 },
  { id: uid(), text: "She rehearsed the lie she hoped she wouldn’t need.", author: "user", timestamp: Date.now() - 480000 },
];

// ------------------------------------------
// Main Component
// ------------------------------------------
export default function StoryWriterMock() {
  // Draft state as ordered chunks
  const [chunks, setChunks] = useState<Chunk[]>(SAMPLE_CHUNKS);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [instruction, setInstruction] = useState<string>("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>("");

  // Model settings (right sidebar)
  const [temperature, setTemperature] = useState<number>(0.8);
  const [maxTokens, setMaxTokens] = useState<number>(256);
  const [synopsis, setSynopsis] = useState<string>(
    "Mira, a courier in a rain-soaked coastal city, discovers a message that could end a quiet war."
  );

  type LoreItem = { id: string; title: string; body: string };
  const [lorebook, setLorebook] = useState<LoreItem[]>([
    { id: uid(), title: "Mira", body: "Protagonist. Courier with a strict moral code; hates lying." },
    { id: uid(), title: "The Quiet War", body: "Conflict fought with disinformation and blackmail; few know it exists." },
  ]);

  const draftText = useMemo(() => chunks.map(c => c.text).join(" "), [chunks]);

  // ------------------------------------------
  // Command handlers (wire to backend later)
  // ------------------------------------------

  const pushHistory = (action: HistoryEntry["action"], before: Chunk[], after: Chunk[]) => {
    setHistory(h => [
      { id: uid(), action, before, after, at: Date.now() },
      ...h,
    ]);
  };

  const handleGenerate = () => {
    // TODO: Call LLM with { instruction, temperature, maxTokens, context: { synopsis, lorebook, draft: chunks } }
    const newChunk: Chunk = {
      id: uid(),
      text: "A siren wailed, distant and thin, and the city held its breath.",
      author: "llm",
      timestamp: Date.now(),
    };
    const before = [...chunks];
    const after = [...chunks, newChunk];
    pushHistory("generate", before, after);
    setChunks(after);
    setInstruction("");
  };

  const handleRegenerateLast = () => {
    if (chunks.length === 0) return;
    // TODO: Send the last chunk + draft context to LLM and replace response
    const before = [...chunks];
    const regenerated: Chunk = {
      ...chunks[chunks.length - 1],
      id: uid(),
      text: "Thunder stitched the sky; Mira quickened, resolve hardening.",
      author: "llm",
      timestamp: Date.now(),
    };
    const after = [...chunks.slice(0, -1), regenerated];
    pushHistory("regenerate", before, after);
    setChunks(after);
  };

  const handleRevert = () => {
    const last = history.find(Boolean);
    if (!last) return;
    setChunks(last.before);
    setHistory(h => h.slice(1));
  };

  const handleDeleteChunk = (id: string) => {
    const before = [...chunks];
    const after = chunks.filter(c => c.id !== id);
    pushHistory("delete", before, after);
    setChunks(after);
  };

  const handleBranchFrom = (id: string) => {
    // TODO: Implement real branching (e.g., fork draft into a new tab/route)
    const index = chunks.findIndex(c => c.id === id);
    const before = [...chunks];
    const after = before.slice(0, index + 1);
    pushHistory("branch", before, after);
    setChunks(after);
    // You could also open a modal prompting for branch name, etc.
    alert("Branched from selected chunk — this demo just trims to that point.");
  };

  // --- Editing Handlers ---
  const startEdit = (id: string) => {
    const chunk = chunks.find(c => c.id === id);
    if (!chunk) return;
    setEditingId(id);
    setEditingText(chunk.text);
  };

  const saveEdit = () => {
    if (!editingId) return;
    const before = [...chunks];
    const after = chunks.map(c => (c.id === editingId ? { ...c, text: editingText, timestamp: Date.now() } : c));
    pushHistory("edit", before, after);
    setChunks(after);
    setEditingId(null);
    setEditingText("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText("");
  };

  const handleAddUserText = () => {
    const newChunk: Chunk = { id: uid(), text: "[Your new sentence here]", author: "user", timestamp: Date.now() };
    const before = [...chunks];
    const after = [...chunks, newChunk];
    pushHistory("generate", before, after);
    setChunks(after);
  };

  // ------------------------------------------
  // UI
  // ------------------------------------------

  return (
    <div className="w-full min-h-screen bg-neutral-50 text-neutral-900">
      {/* Top Bar */}
      <div className="sticky top-0 z-20 backdrop-blur bg-white/70 border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            <span className="font-semibold">Story Studio (Mock)</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Info className="h-4 w-4" />
            <span>Prototype UI · No persistence</span>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Editor Column */}
        <div className="lg:col-span-8 space-y-4">
          {/* Draft Editor */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Draft</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[44vh] rounded-2xl border bg-white p-4">
                <div className="space-y-3">
                  {chunks.map((c, idx) => (
                    <div
                      key={c.id}
                      onDoubleClick={() => startEdit(c.id)}
                      onMouseEnter={() => setHoveredId(c.id)}
                      onMouseLeave={(prev) => setHoveredId(prev === c.id ? null : prev)}
                      className={[
                        "relative group rounded-xl px-3 py-2 transition-colors",
                        hoveredId === c.id ? "bg-amber-50" : "bg-white",
                        c.author === "llm" ? "border border-dashed" : "border",
                      ].join(" ")}
                    >
                      <div className="text-sm text-neutral-500 mb-1">
                        {c.author === "llm" ? "LLM" : "You"} • Chunk {idx + 1}
                      </div>
                      {editingId === c.id ? (
                        <div className="space-y-2">
                          <Textarea
                            autoFocus
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            className="min-h-[96px]"
                            onKeyDown={(e) => {
                              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") saveEdit();
                              if (e.key === "Escape") cancelEdit();
                            }}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={saveEdit}>Save</Button>
                            <Button size="sm" variant="ghost" onClick={cancelEdit}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <p className="leading-relaxed">{c.text}</p>
                      )}

                      {/* Hover menu */}
                      <div className="absolute -top-3 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center gap-1 bg-white border shadow-sm rounded-full px-1 py-1">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="More">
                                <Settings className="h-4 w-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-48 p-1">
                              <Button variant="ghost" className="w-full justify-start" onClick={() => startEdit(c.id)}>
                                ✏️ Edit chunk
                              </Button>
                              <Button variant="ghost" className="w-full justify-start" onClick={() => handleDeleteChunk(c.id)}>
                                <Trash2 className="h-4 w-4 mr-2" /> Delete chunk
                              </Button>
                              <Button variant="ghost" className="w-full justify-start" onClick={() => handleBranchFrom(c.id)}>
                                <GitBranch className="h-4 w-4 mr-2" /> Branch from here
                              </Button>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Quick-add user text for demo */}
                  <Button onClick={handleAddUserText} variant="secondary" className="mt-1">
                    <Plus className="h-4 w-4 mr-2" /> Add user text chunk (demo)
                  </Button>
                </div>
              </ScrollArea>

              {/* Instruction Box */}
              <div className="mt-4">
                <Label htmlFor="instruction" className="text-sm text-neutral-600">Instruction to model</Label>
                <Textarea
                  id="instruction"
                  placeholder="e.g., Continue in a tense, noir voice. Focus on atmosphere; add subtle foreshadowing."
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  className="mt-2 resize-y min-h-[72px]"
                />
              </div>

              {/* Command Bar */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button onClick={handleGenerate}>
                  <Wand2 className="h-4 w-4 mr-2" /> Generate continuation
                </Button>
                <Button variant="outline" onClick={handleRegenerateLast}>
                  <RefreshCcw className="h-4 w-4 mr-2" /> Regenerate last chunk
                </Button>
                <Button variant="ghost" onClick={handleRevert} disabled={history.length === 0}>
                  <Undo2 className="h-4 w-4 mr-2" /> Revert last action
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          {/* Generation Settings */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Generation Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="temp">Temperature</Label>
                  <span className="text-sm text-neutral-500">{temperature.toFixed(2)}</span>
                </div>
                <Slider
                  id="temp"
                  min={0}
                  max={1}
                  step={0.01}
                  value={[temperature]}
                  onValueChange={(v) => setTemperature(v[0])}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="maxtokens">Max tokens</Label>
                <Input
                  id="maxtokens"
                  type="number"
                  min={1}
                  max={8192}
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(Number(e.target.value))}
                  className="mt-2"
                />
              </div>

              <Separator />

              <Tabs defaultValue="synopsis">
                <TabsList className="grid grid-cols-2">
                  <TabsTrigger value="synopsis">Synopsis</TabsTrigger>
                  <TabsTrigger value="lorebook">Lorebook</TabsTrigger>
                </TabsList>

                <TabsContent value="synopsis" className="mt-3">
                  <Textarea
                    value={synopsis}
                    onChange={(e) => setSynopsis(e.target.value)}
                    className="min-h-[140px]"
                    placeholder="Short summary of the story to guide the model…"
                  />
                </TabsContent>

                <TabsContent value="lorebook" className="mt-3">
                  <ScrollArea className="h-[200px] rounded-lg border p-2 bg-white">
                    <div className="space-y-2">
                      {lorebook.map((item) => (
                        <Card key={item.id} className="border shadow-none">
                          <CardHeader className="py-2 px-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <BookText className="h-4 w-4" /> {item.title}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0 px-3 pb-3">
                            <p className="text-sm text-neutral-700 leading-relaxed">{item.body}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                  <Button
                    variant="secondary"
                    className="mt-2"
                    onClick={() => setLorebook((lb) => [...lb, { id: uid(), title: "New entry", body: "Describe character, place, or rule." }])}
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add lore entry
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Developer Notes */}
      <div className="max-w-7xl mx-auto px-4 pb-10">
        <Card className="shadow-none border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Developer Notes / Integration Guide</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-neutral-700 space-y-3 leading-relaxed">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Chunk model:</strong> Store the draft as an ordered array of chunks <code>{`{id, text, author, timestamp}`}</code>. Prefer immutable updates and preserve full
                <em>before/after</em> snapshots for undo/redo. Include an <code>edit</code> action that records text changes per chunk.
              </li>
              <li>
                <strong>Hover actions:</strong> On mouse enter/leave, toggle <code>hoveredId</code>. Use a positioned popover for actions (delete/branch). Persist deletes
                with history entries; branching should fork a new draft (path, tab, or workspace) seeded with chunks up to the branch point.
              </li>
              <li>
                <strong>Generation calls:</strong> Build the LLM request from: <code>instruction</code>, <code>temperature</code>, <code>maxTokens</code>, <code>synopsis</code>, <code>lorebook</code>, and
                the current <code>chunks</code>. Return a new chunk and append. For regeneration, replace the last chunk. For revert, restore the most recent <code>before</code>.
              </li>
              <li>
                <strong>Cursor semantics:</strong> Optional: track a cursor location to allow “continue from cursor” vs. end-of-draft continuity.
              </li>
              <li>
                <strong>Lorebook lookups:</strong> At generation time, you may select relevant lore entries with keyword/embedding search and include them in the prompt.
              </li>
              <li>
                <strong>Streaming UX:</strong> When calling the model, stream tokens into a provisional chunk with a typing indicator; finalize on completion.
              </li>
              <li>
                <strong>Conflict handling:</strong> If the user edits earlier chunks, mark subsequent LLM chunks as “stale” and prompt to regenerate downstream sections.
              </li>
              <li>
                <strong>Autosave:</strong> Debounce draft edits and persist to local storage or your backend; version drafts per branch id.
              </li>
              <li>
                <strong>Keyboard shortcuts:</strong> ⌘/Ctrl+Enter = Generate; ⌘/Ctrl+Shift+R = Regenerate last; ⌘/Ctrl+Z = Revert last action; while editing a chunk, ⌘/Ctrl+Enter = Save, Esc = Cancel.
              </li>
              <li>
                <strong>Access control:</strong> If you plan collaboration, model “chunk locks” while someone is editing.
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
