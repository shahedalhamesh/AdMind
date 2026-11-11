import { useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Icon } from "@iconify/react";

interface RequestItem {
  id: string;
  title: string;
  type: string;
  status: string;
  date: string;
}

const inputClass =
  "min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30";
const textareaClass =
  "w-full rounded-lg border border-input bg-background px-3 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30";
const selectClass =
  "min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";

export default function Mybrand() {
  // Brand profile state
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string>("Maison Cocoa");
  const [industry, setIndustry] = useState<string>("Food and beverage");
  const [description, setDescription] = useState<string>(
    "Artisanal chocolate maker crafting organic, single-origin truffles and seasonal gift boxes."
  );
  const [audience, setAudience] = useState<string>(
    "Fine food lovers, gift buyers, and eco-conscious consumers looking for premium treats."
  );
  const [goal, setGoal] = useState<string>("Generate more sales");
  const [priorities, setPriorities] = useState<string>("seasonal gift boxes, signature truffles");
  const [brandVoice, setBrandVoice] = useState<string>("warm, artisanal, refined, welcoming");
  const [cta, setCta] = useState<string>("Shop the collection, discover the story");
  const [restrictions, setRestrictions] = useState<string>("");
  const [isSaved, setIsSaved] = useState<boolean>(false);

  // Requests state
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [requestSearch, setRequestSearch] = useState<string>("");
  const [requestStatusFilter, setRequestStatusFilter] = useState<string>("All statuses");
  const [requestTypeFilter, setRequestTypeFilter] = useState<string>("All request types");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile completeness (required fields only)
  const requiredFields = [businessName, industry, description, audience, goal];
  const filledCount = requiredFields.filter((v) => v.trim() !== "").length;
  const completeness = Math.round((filledCount / requiredFields.length) * 100);
  const isComplete = completeness === 100;

  const handleLogoChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = (e?: FormEvent): void => {
    e?.preventDefault();
    // Later: send the data to the Laravel API here.
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleReset = (): void => {
    setBusinessName("");
    setIndustry("");
    setDescription("");
    setAudience("");
    setGoal("");
    setPriorities("");
    setBrandVoice("");
    setCta("");
    setRestrictions("");
    setLogoPreview(null);
  };

  const handleCreateRequest = (): void => {
    const newRequest: RequestItem = {
      id: Date.now().toString(36),
      title: `Campaign assets for ${businessName || "your brand"}`,
      type: "New Campaign",
      status: "Submitted",
      date: new Date().toLocaleDateString(),
    };
    setRequests((prev) => [newRequest, ...prev]);
  };

  const filteredRequests = requests.filter((req) => {
    const matchesSearch = req.title.toLowerCase().includes(requestSearch.toLowerCase());
    const matchesStatus = requestStatusFilter === "All statuses" || req.status === requestStatusFilter;
    const matchesType = requestTypeFilter === "All request types" || req.type === requestTypeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Page heading */}
      <header className="flex flex-col gap-5 border-b border-border pb-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Icon icon="lucide:store" className="text-xl" />
          </span>
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight">Build your brand workspace</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Share the details your agency needs to create work that feels like {businessName || "your brand"}.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold transition-colors hover:bg-muted cursor-pointer"
          >
            <Icon icon="lucide:circle-help" className="text-lg text-primary" />
            Need help?
          </button>
          <button
            type="button"
            onClick={() => handleSaveProfile()}
            className="flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 cursor-pointer"
          >
            <Icon icon="lucide:save" className="text-lg" />
            {isSaved ? "Saved!" : "Save as draft"}
          </button>
        </div>
      </header>

      <section aria-labelledby="brand-profile-title" className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Left column */}
        <div className="space-y-5">
          {/* Brand profile */}
          <article className="rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <Icon icon="lucide:building-2" className="text-base" />
                  </span>
                  <h2 id="brand-profile-title" className="font-heading text-lg font-semibold">
                    Brand profile
                  </h2>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  These details are visible only to your authorized agency team.
                </p>
              </div>
              <span className="flex w-fit items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <Icon icon={isComplete ? "lucide:circle-check" : "lucide:clock-3"} className="text-sm" />
                {isComplete ? "Profile complete" : "Profile incomplete"}
              </span>
            </div>

            <form onSubmit={handleSaveProfile} className="p-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-[150px_minmax(0,1fr)]">
                {/* Logo */}
                <div>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="group relative flex aspect-square cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted p-4 text-center transition-colors hover:bg-card"
                  >
                    {logoPreview ? (
                      <>
                        <img src={logoPreview} alt="Logo preview" className="h-full w-full rounded-lg object-contain" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                          <span className="text-xs font-semibold text-white">Change logo</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-primary">
                          <Icon icon="lucide:upload-cloud" className="text-xl" />
                        </span>
                        <span className="mt-3 text-xs font-semibold">Upload logo</span>
                        <span className="mt-1 text-xs text-muted-foreground">PNG or JPG</span>
                      </>
                    )}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleLogoChange}
                      accept="image/*"
                      className="hidden"
                      aria-label="Upload business logo"
                    />
                  </div>
                </div>

                {/* Basic info */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold">
                      Business name <span className="text-destructive">*</span>
                    </span>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g. Maison Cocoa"
                      className={inputClass}
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold">
                      Industry <span className="text-destructive">*</span>
                    </span>
                    <select
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      className={selectClass}
                      required
                    >
                      <option value="">Select your industry</option>
                      <option value="Food and beverage">Food and beverage</option>
                      <option value="Retail">Retail</option>
                      <option value="Hospitality">Hospitality</option>
                      <option value="Fashion and beauty">Fashion and beauty</option>
                    </select>
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-sm font-semibold">
                      Short business description <span className="text-destructive">*</span>
                    </span>
                    <textarea
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Tell us what your business does, what makes it special, and the products or services you offer."
                      className={textareaClass}
                      required
                    />
                    <span className="mt-1.5 block text-xs text-muted-foreground">
                      A short introduction helps the agency understand your brand quickly.
                    </span>
                  </label>
                </div>
              </div>

              {/* Customers and goals */}
              <div className="mt-6 border-t border-border pt-5">
                <h3 className="font-heading text-base font-semibold">Your customers and goals</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Help your agency make relevant content, campaigns, and recommendations.
                </p>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold">
                      Who is your target audience? <span className="text-destructive">*</span>
                    </span>
                    <textarea
                      rows={3}
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                      placeholder="Describe your ideal customers, their interests, and location."
                      className={textareaClass}
                      required
                    />
                  </label>

                  <div>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold">
                        Primary marketing goal <span className="text-destructive">*</span>
                      </span>
                      <select
                        value={goal}
                        onChange={(e) => setGoal(e.target.value)}
                        className={selectClass}
                        required
                      >
                        <option value="">Select a primary goal</option>
                        <option value="Increase brand awareness">Increase brand awareness</option>
                        <option value="Generate more sales">Generate more sales</option>
                        <option value="Grow social community">Grow social community</option>
                        <option value="Launch a new product">Launch a new product</option>
                      </select>
                    </label>

                    <label className="mt-4 block">
                      <span className="mb-2 block text-sm font-semibold">Products or services to prioritize</span>
                      <input
                        type="text"
                        value={priorities}
                        onChange={(e) => setPriorities(e.target.value)}
                        placeholder="e.g. seasonal gift boxes, signature truffles"
                        className={inputClass}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Brand guidelines */}
              <div className="mt-6 border-t border-border pt-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-heading text-base font-semibold">Brand guidelines</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Add what your agency should know about your tone, visuals, and restrictions.
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">Optional now — easy to update later</span>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold">Brand voice</span>
                    <input
                      type="text"
                      value={brandVoice}
                      onChange={(e) => setBrandVoice(e.target.value)}
                      placeholder="e.g. warm, artisanal, refined, welcoming"
                      className={inputClass}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold">Preferred calls to action</span>
                    <input
                      type="text"
                      value={cta}
                      onChange={(e) => setCta(e.target.value)}
                      placeholder="e.g. Shop the collection, discover the story"
                      className={inputClass}
                    />
                  </label>

                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm font-semibold">Content restrictions or important notes</span>
                    <textarea
                      rows={3}
                      value={restrictions}
                      onChange={(e) => setRestrictions(e.target.value)}
                      placeholder="Tell us about words, topics, visuals, offers, or claims to avoid."
                      className={textareaClass}
                    />
                  </label>
                </div>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted cursor-pointer"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 cursor-pointer"
                >
                  <Icon icon="lucide:check" className="text-lg" />
                  {isSaved ? "Saved successfully!" : "Save brand profile"}
                </button>
              </div>
            </form>
          </article>

          {/* My Requests */}
          <section aria-labelledby="requests-title" className="rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-primary">
                    <Icon icon="lucide:inbox" className="text-base" />
                  </span>
                  <h2 id="requests-title" className="font-heading text-lg font-semibold">
                    My Requests
                  </h2>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create a request when you need new marketing work or an agency update.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCreateRequest}
                className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 cursor-pointer"
              >
                <Icon icon="lucide:plus" className="text-lg" />
                Create new request
              </button>
            </div>

            <div className="p-5">
              <div className="flex flex-col gap-3 md:flex-row">
                <label className="relative block flex-1">
                  <Icon
                    icon="lucide:search"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-muted-foreground"
                  />
                  <input
                    type="search"
                    value={requestSearch}
                    onChange={(e) => setRequestSearch(e.target.value)}
                    placeholder="Search your requests"
                    className="min-h-11 w-full rounded-lg border border-input bg-background py-2 pl-10 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
                  />
                </label>
                <select
                  value={requestStatusFilter}
                  onChange={(e) => setRequestStatusFilter(e.target.value)}
                  className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
                >
                  <option value="All statuses">All statuses</option>
                  <option value="Draft">Draft</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Waiting for Client">Waiting for Client</option>
                </select>
                <select
                  value={requestTypeFilter}
                  onChange={(e) => setRequestTypeFilter(e.target.value)}
                  className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
                >
                  <option value="All request types">All request types</option>
                  <option value="Social Media Post">Social Media Post</option>
                  <option value="Reel or Video">Reel or Video</option>
                  <option value="New Campaign">New Campaign</option>
                  <option value="Brand Update">Brand Update</option>
                </select>
              </div>

              {filteredRequests.length === 0 ? (
                <div className="mt-5 flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted px-6 py-10 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-card text-primary">
                    <Icon icon="lucide:file-plus-2" className="text-2xl" />
                  </span>
                  <p className="mt-4 text-sm font-semibold">No requests yet</p>
                  <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                    Use a request to ask for a campaign, a new social post, a revision, a report, or support from your
                    agency.
                  </p>
                  <button
                    type="button"
                    onClick={handleCreateRequest}
                    className="mt-5 flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold transition-colors hover:bg-background cursor-pointer"
                  >
                    <Icon icon="lucide:plus" className="text-lg text-primary" />
                    Start your first request
                  </button>
                </div>
              ) : (
                <div className="mt-5 overflow-x-auto rounded-lg border border-border bg-background">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="border-b border-border bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Request</th>
                        <th className="px-4 py-3 font-semibold">Type</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRequests.map((req) => (
                        <tr key={req.id} className="border-b border-border last:border-b-0 hover:bg-muted">
                          <td className="px-4 py-3 font-semibold">{req.title}</td>
                          <td className="px-4 py-3 text-muted-foreground">{req.type}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-tertiary/20 px-2.5 py-1 text-xs font-semibold text-tertiary">
                              {req.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{req.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right column */}
        <aside className="space-y-5">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-heading text-base font-semibold">Profile completion</h2>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {filledCount} of {requiredFields.length} required fields
              </span>
              <span className="font-semibold">{completeness}%</span>
            </div>
            <div
              className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={completeness}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${completeness}%` }}
              ></div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Icon icon="lucide:lightbulb" className="text-lg text-primary" />
              <h2 className="font-heading text-base font-semibold">Tips for a strong profile</h2>
            </div>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
              <li className="flex gap-2">
                <Icon icon="lucide:check" className="mt-1 shrink-0 text-primary" />
                Describe your audience with interests and location.
              </li>
              <li className="flex gap-2">
                <Icon icon="lucide:check" className="mt-1 shrink-0 text-primary" />
                List the products you want promoted first.
              </li>
              <li className="flex gap-2">
                <Icon icon="lucide:check" className="mt-1 shrink-0 text-primary" />
                Mention words or claims your agency should avoid.
              </li>
            </ul>
          </div>
        </aside>
      </section>
    </div>
  );
}