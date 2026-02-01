"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { ArticleReader } from "@/components/article-reader";

interface Article {
  id: string;
  title: string;
  source: string;
  readTime: string;
  content: string;
}

const mockArticles: Article[] = [
  {
    id: "1",
    title: "The Future of Renewable Energy in Urban Planning",
    source: "The Guardian",
    readTime: "6 min",
    content: `Cities around the world are reimagining their relationship with energy. As urban populations continue to grow, planners are integrating renewable energy sources directly into the fabric of city infrastructure.

Solar panels are no longer confined to rooftops. They're being woven into building facades, bus shelters, and even sidewalks. Wind turbines, once relegated to remote hillsides, are being designed at smaller scales suitable for urban environments.

The shift represents more than just technological progress. It signals a fundamental change in how we think about cities—not as energy consumers, but as energy producers. Barcelona, Copenhagen, and Singapore are leading the way, with ambitious plans to generate significant portions of their electricity within city limits.

The economic implications are substantial. Local energy production reduces transmission losses and creates jobs within communities. It also provides resilience against grid failures and price fluctuations in global energy markets.

Critics point to the intermittent nature of renewable sources and the challenges of energy storage. However, advances in battery technology and smart grid management are addressing these concerns at an accelerating pace.

The transition won't happen overnight. It requires coordinated policy, significant investment, and changes in building codes and zoning regulations. But the direction is clear: the cities of the future will power themselves.`
  },
  {
    id: "2",
    title: "How Sleep Affects Memory Formation",
    source: "Scientific American",
    readTime: "8 min",
    content: `Sleep is not merely a period of rest—it's an active process essential for consolidating memories and learning. Recent neuroscience research has revealed the intricate mechanisms by which sleep transforms our daily experiences into lasting memories.

During deep sleep, the brain replays the day's events at high speed. Neural patterns that fired during waking hours are reactivated, strengthening the synaptic connections that encode memories. This process, called memory consolidation, explains why a good night's sleep often helps us solve problems that seemed intractable the day before.

REM sleep plays a different but equally important role. During this phase, the brain integrates new information with existing knowledge, finding connections and patterns that weren't apparent during waking hours. This is why creative insights often emerge after sleep.

Sleep deprivation has profound effects on memory. Even a single night of poor sleep can impair the hippocampus's ability to form new memories. Chronic sleep loss is associated with long-term cognitive decline and increased risk of neurodegenerative diseases.

The implications extend beyond individual health. In a society that often valorizes working long hours and sleeping little, understanding sleep's role in learning and memory argues for a fundamental shift in how we structure work and education.

Researchers recommend 7-9 hours of sleep for adults, with consistent sleep and wake times. The quality of sleep matters as much as quantity—a quiet, dark, cool environment promotes the deep sleep stages most important for memory consolidation.`
  },
  {
    id: "3",
    title: "The Economics of Remote Work",
    source: "The Economist",
    readTime: "5 min",
    content: `The pandemic accelerated a shift that was already underway. Remote work, once a perk offered by progressive employers, has become a standard expectation for millions of knowledge workers. The economic implications are still unfolding.

For workers, remote work offers flexibility and eliminates commuting costs. Studies suggest productivity often increases, at least for tasks requiring deep concentration. However, collaboration and spontaneous innovation may suffer without in-person interaction.

For employers, the calculus is complex. Real estate costs can be reduced, but investments in technology and home office stipends offset some savings. The ability to hire from a global talent pool is attractive, but managing distributed teams requires new skills and tools.

Cities are grappling with reduced demand for office space and changes in commuting patterns. Commercial real estate markets in major urban centers face uncertainty, while smaller cities and suburbs see increased interest from remote workers seeking lower costs of living.

The environmental impact is mixed. Reduced commuting decreases carbon emissions, but increased home energy use and the carbon footprint of video conferencing infrastructure partially offset these gains.

What seems clear is that hybrid arrangements—combining remote and in-office work—will be the norm for many organizations. The optimal balance remains an open question, likely varying by industry, role, and individual preference.`
  },
  {
    id: "4",
    title: "Understanding Inflation in the Modern Economy",
    source: "Financial Times",
    readTime: "7 min",
    content: `Inflation has returned to public consciousness after decades of relative price stability. Understanding its causes and consequences is essential for navigating the current economic environment.

At its core, inflation represents a decrease in purchasing power—the same amount of money buys fewer goods and services over time. Moderate inflation is considered normal and even healthy for an economy, encouraging spending and investment rather than hoarding cash.

The recent surge in inflation has multiple causes. Supply chain disruptions reduced the availability of goods while demand remained strong. Energy prices spiked due to geopolitical tensions. Labor markets tightened, pushing up wages.

Central banks respond to inflation primarily through interest rates. Higher rates make borrowing more expensive, cooling demand and theoretically reducing price pressures. However, this tool is blunt—it affects all sectors of the economy, potentially triggering recession.

The distributional effects of inflation are uneven. Those on fixed incomes or with savings in cash see their purchasing power erode. Borrowers with fixed-rate debt effectively see their obligations shrink in real terms. Asset owners often benefit as property and stock prices rise.

Managing inflation requires balancing multiple objectives: price stability, employment, and economic growth. There are no easy answers, only tradeoffs that reflect society's priorities and values.`
  },
  {
    id: "5",
    title: "The Science of Habit Formation",
    source: "Psychology Today",
    readTime: "4 min",
    content: `Habits shape our lives more than we realize. Research suggests that roughly 40% of our daily actions are habitual—performed without conscious decision-making. Understanding how habits form and change can help us build better routines.

The habit loop consists of three components: cue, routine, and reward. A cue triggers the behavior, the routine is the behavior itself, and the reward reinforces the pattern. Over time, this loop becomes automatic, encoded in the basal ganglia rather than the prefrontal cortex.

Forming new habits requires consistency. Research suggests it takes an average of 66 days for a new behavior to become automatic, though this varies widely depending on the complexity of the habit and the individual.

Breaking bad habits is often harder than forming good ones. The neural pathways don't disappear—they're merely overwritten by new patterns. This is why old habits can resurface during times of stress, when we revert to automatic behaviors.

Successful habit change often involves modifying the environment. Removing cues for unwanted behaviors and adding cues for desired ones reduces reliance on willpower, which is a limited resource.

Small changes compound over time. A 1% improvement daily leads to being 37 times better over a year. The key is starting small and building gradually, allowing habits to take root before adding complexity.`
  },
  {
    id: "6",
    title: "Climate Adaptation Strategies for Coastal Cities",
    source: "Nature",
    readTime: "9 min",
    content: `Sea levels are rising, and coastal cities must adapt. While mitigation efforts to reduce emissions remain essential, the changes already locked into the climate system require immediate action to protect vulnerable communities.

The approaches vary by context. Some cities are building sea walls and flood barriers—hard infrastructure designed to keep water out. Others are embracing softer solutions: restoring wetlands and mangroves that absorb storm surge, creating permeable surfaces that reduce runoff.

Managed retreat is the most controversial option. Moving people and infrastructure away from vulnerable coastlines acknowledges the limits of protection but raises difficult questions about property rights, cultural attachment to place, and who bears the costs.

The economic stakes are enormous. Coastal cities generate a disproportionate share of global GDP. Miami, Shanghai, Mumbai, and dozens of other major urban centers face significant risks from flooding and storm damage.

Adaptation planning requires long time horizons—infrastructure built today will need to function for decades. Yet climate projections carry uncertainty, making it difficult to know exactly what conditions to prepare for.

Equity concerns are paramount. Low-income communities often occupy the most flood-prone areas and have the fewest resources to adapt. Effective adaptation strategies must address these disparities, ensuring that protection isn't only for those who can afford it.`
  },
];

export default function ArticlesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  const filteredArticles = searchQuery
    ? mockArticles.filter(
        (article) =>
          article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          article.source.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : mockArticles;

  if (selectedArticle) {
    return (
      <ArticleReader
        article={selectedArticle}
        onBack={() => setSelectedArticle(null)}
      />
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <header className="mb-10 text-center">
          <h1 className="text-2xl font-semibold text-foreground mb-1">
            Articles
          </h1>
          <p className="text-muted-foreground">
            Just the words, nothing else.
          </p>
        </header>

        <form
          onSubmit={(e) => {
            e.preventDefault();
          }}
          className="mb-10"
        >
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search articles..."
              className="w-full bg-card border border-border rounded-full pl-12 pr-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-muted-foreground transition-colors"
            />
          </div>
        </form>

        <div className="space-y-3">
          {filteredArticles.map((article) => (
            <button
              key={article.id}
              onClick={() => setSelectedArticle(article)}
              className="w-full text-left p-4 bg-card rounded-2xl border border-border hover:border-muted-foreground/50 transition-colors"
            >
              <h3 className="text-foreground leading-snug mb-2">
                {article.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {article.source} · {article.readTime}
              </p>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
