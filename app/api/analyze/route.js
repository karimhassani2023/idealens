import { NextResponse } from "next/server";
import googleTrends from "google-trends-api";

export async function POST(request) {
  try {
    const { idea } = await request.json();

    if (!idea || !idea.trim()) {
      return NextResponse.json(
        { error: "Please provide a video idea" },
        { status: 400 }
      );
    }

    const API_KEY = process.env.YOUTUBE_API_KEY;

    if (!API_KEY) {
      return NextResponse.json(
        { error: "YouTube API key not configured" },
        { status: 500 }
      );
    }

    // Run YouTube search AND Google Trends at the same time
    const [youtubeData, trendsData] = await Promise.all([
      fetchYouTubeData(idea, API_KEY),
      fetchTrendsData(idea),
    ]);

    if (youtubeData.error) {
      return NextResponse.json(
        { error: youtubeData.error },
        { status: 500 }
      );
    }

    const { videos, videoStats, totalResults } = youtubeData;

    // ===== CALCULATE RAW METRICS =====
    const views = videoStats.map(
      (v) => parseInt(v.statistics.viewCount) || 0
    );
    const likes = videoStats.map(
      (v) => parseInt(v.statistics.likeCount) || 0
    );
    const comments = videoStats.map(
      (v) => parseInt(v.statistics.commentCount) || 0
    );

    const totalViews = views.reduce((a, b) => a + b, 0);
    const avgViews = views.length > 0 ? Math.round(totalViews / views.length) : 0;
    const maxViews = views.length > 0 ? Math.max(...views) : 0;
    const sortedViews = [...views].sort((a, b) => a - b);
    const medianViews = sortedViews[Math.floor(sortedViews.length / 2)] || 0;

    const totalLikes = likes.reduce((a, b) => a + b, 0);
    const avgLikes = likes.length > 0 ? Math.round(totalLikes / likes.length) : 0;

    const totalComments = comments.reduce((a, b) => a + b, 0);
    const avgComments = comments.length > 0 ? Math.round(totalComments / comments.length) : 0;

    const engagementRate =
      avgViews > 0 ? ((avgLikes + avgComments) / avgViews) * 100 : 0;

    // Upload date analysis
    const now = new Date();
    const uploadDates = videos.map(
      (v) => new Date(v.snippet.publishedAt)
    );
    const avgDaysAgo = Math.round(
      uploadDates.reduce(
        (sum, date) => sum + (now - date) / (1000 * 60 * 60 * 24),
        0
      ) / uploadDates.length
    );
    const recentVideos = uploadDates.filter(
      (d) => (now - d) / (1000 * 60 * 60 * 24) < 90
    ).length;

    // View distribution — detect if views are spread evenly or dominated by one video
    const viewGini = calculateGini(views);
    // Gini close to 0 = evenly spread (healthy), close to 1 = one video dominates

    // ===== CATEGORY SCORES (each 0-100) =====

    // --- DEMAND SCORE (how much audience interest exists) ---
    let demandScore = 0;
    if (avgViews > 1000000) demandScore = 100;
    else if (avgViews > 500000) demandScore = 90;
    else if (avgViews > 200000) demandScore = 80;
    else if (avgViews > 100000) demandScore = 70;
    else if (avgViews > 50000) demandScore = 60;
    else if (avgViews > 20000) demandScore = 50;
    else if (avgViews > 10000) demandScore = 40;
    else if (avgViews > 5000) demandScore = 30;
    else if (avgViews > 1000) demandScore = 20;
    else demandScore = 10;

    // Boost demand if median views are also strong (not just one viral outlier)
    if (medianViews > 50000) demandScore = Math.min(100, demandScore + 10);
    else if (medianViews < avgViews * 0.1) demandScore = Math.max(0, demandScore - 10);

    // Use Google Trends average interest to refine demand
    if (trendsData.trend !== "Unknown" && trendsData.averageInterest > 0) {
      if (trendsData.averageInterest > 70) demandScore = Math.min(100, demandScore + 10);
      else if (trendsData.averageInterest > 40) demandScore = Math.min(100, demandScore + 5);
      else if (trendsData.averageInterest < 15) demandScore = Math.max(0, demandScore - 10);
    }

    // --- COMPETITION SCORE (lower competition = higher score) ---
    let competitionScore = 0;
    if (totalResults < 1000) competitionScore = 95;
    else if (totalResults < 5000) competitionScore = 85;
    else if (totalResults < 10000) competitionScore = 75;
    else if (totalResults < 50000) competitionScore = 60;
    else if (totalResults < 100000) competitionScore = 45;
    else if (totalResults < 500000) competitionScore = 30;
    else if (totalResults < 1000000) competitionScore = 15;
    else competitionScore = 5;

    // If view distribution is very uneven (one big creator dominates), there may still be room
    if (viewGini > 0.7 && competitionScore < 50) {
      competitionScore = Math.min(100, competitionScore + 15);
    }

    // If most top videos are old, competition is "stale" — opportunity for fresh content
    if (avgDaysAgo > 365 && competitionScore < 60) {
      competitionScore = Math.min(100, competitionScore + 10);
    }

    // --- TREND SCORE (is interest growing or shrinking?) ---
    let trendScore = 50; // default to neutral
    if (trendsData.trend !== "Unknown") {
      if (trendsData.percentChange > 30) trendScore = 100;
      else if (trendsData.percentChange > 15) trendScore = 85;
      else if (trendsData.percentChange > 5) trendScore = 70;
      else if (trendsData.percentChange > -5) trendScore = 50;
      else if (trendsData.percentChange > -15) trendScore = 30;
      else if (trendsData.percentChange > -30) trendScore = 15;
      else trendScore = 5;

      // Near-peak bonus
      if (trendsData.currentInterest > 0 && trendsData.peakInterest > 0) {
        const peakRatio = trendsData.currentInterest / trendsData.peakInterest;
        if (peakRatio >= 0.8) trendScore = Math.min(100, trendScore + 10);
        else if (peakRatio < 0.3) trendScore = Math.max(0, trendScore - 10);
      }
    } else {
      // Fallback: use YouTube upload freshness
      const recentRatio = videos.length > 0 ? recentVideos / videos.length : 0;
      if (recentRatio > 0.6) trendScore = 75;
      else if (recentRatio > 0.3) trendScore = 50;
      else trendScore = 25;
    }

    // --- ENGAGEMENT SCORE (are people interacting with content?) ---
    let engagementScore = 0;
    if (engagementRate > 8) engagementScore = 100;
    else if (engagementRate > 5) engagementScore = 85;
    else if (engagementRate > 3) engagementScore = 70;
    else if (engagementRate > 2) engagementScore = 55;
    else if (engagementRate > 1) engagementScore = 40;
    else if (engagementRate > 0.5) engagementScore = 25;
    else engagementScore = 10;

    // --- TITLE SCORE ---
    const titleAnalysis = analyzeTitleQuality(idea);
    const titleScore = titleAnalysis.score;
    const titleScoreNormalized = titleScore * 10; // convert 0-10 to 0-100

    // --- OPPORTUNITY GAP BONUS ---
    // High demand + low competition = golden opportunity
    let opportunityBonus = 0;
    if (demandScore >= 60 && competitionScore >= 70) {
      opportunityBonus = 15; // strong gap
    } else if (demandScore >= 50 && competitionScore >= 60) {
      opportunityBonus = 8; // moderate gap
    } else if (demandScore < 30 && competitionScore < 30) {
      opportunityBonus = -10; // low demand AND high competition — worst case
    }

    // ===== WEIGHTED FINAL SCORE =====
    // Weights: demand 30%, competition 25%, trends 20%, engagement 15%, title 10%
    const weightedScore =
      demandScore * 0.3 +
      competitionScore * 0.25 +
      trendScore * 0.2 +
      engagementScore * 0.15 +
      titleScoreNormalized * 0.1 +
      opportunityBonus;

    const score = Math.max(0, Math.min(100, Math.round(weightedScore)));

    // ===== LABEL AND COLOR =====
    let label, color;
    if (score >= 75) {
      label = "High Potential";
      color = "#22c55e";
    } else if (score >= 55) {
      label = "Promising";
      color = "#84cc16";
    } else if (score >= 40) {
      label = "Worth Trying";
      color = "#eab308";
    } else if (score >= 25) {
      label = "Risky";
      color = "#f97316";
    } else {
      label = "Not Recommended";
      color = "#ef4444";
    }

    // ===== COMPETITION LEVEL =====
    let competitionLevel;
    if (totalResults > 500000) competitionLevel = "Very High";
    else if (totalResults > 100000) competitionLevel = "High";
    else if (totalResults > 10000) competitionLevel = "Medium";
    else competitionLevel = "Low";

    // ===== BUILD INSIGHTS =====
    const insights = [];

    // Demand insight
    if (avgViews > 100000) {
      insights.push(
        `Videos on this topic average ${formatNumber(avgViews)} views — strong audience demand.`
      );
    } else if (avgViews > 10000) {
      insights.push(
        `Videos on this topic average ${formatNumber(avgViews)} views — moderate audience interest.`
      );
    } else {
      insights.push(
        `Videos on this topic average only ${formatNumber(avgViews)} views — limited demand.`
      );
    }

    // View distribution insight
    if (viewGini > 0.7) {
      insights.push(
        `Views are concentrated in a few big videos. Smaller creators have room to capture underserved viewers.`
      );
    } else if (viewGini < 0.3) {
      insights.push(
        `Views are spread evenly across videos — a healthy topic with consistent demand.`
      );
    }

    // Competition insight
    if (totalResults > 100000) {
      insights.push(
        `High competition with ${formatNumber(totalResults)} total results. You'll need a unique angle to stand out.`
      );
    } else if (totalResults > 10000) {
      insights.push(
        `Moderate competition with ${formatNumber(totalResults)} total results. There's room to compete with quality content.`
      );
    } else {
      insights.push(
        `Low competition with only ${formatNumber(totalResults)} total results. Great opportunity to own this topic.`
      );
    }

    // Stale competition insight
    if (avgDaysAgo > 365) {
      insights.push(
        `Most top videos are over a year old — fresh content could easily outrank them.`
      );
    } else if (avgDaysAgo > 180) {
      insights.push(
        `Many top videos are 6+ months old. A well-made new video has a good chance of ranking.`
      );
    }

    // Google Trends insights
    if (trendsData.trend !== "Unknown") {
      if (trendsData.percentChange > 15) {
        insights.push(
          `Google Trends shows search interest is up ${trendsData.percentChange}% over the past 3 months — this topic is heating up.`
        );
      } else if (trendsData.percentChange > 5) {
        insights.push(
          `Google Trends shows a healthy ${trendsData.percentChange}% increase in search interest recently.`
        );
      } else if (trendsData.percentChange > -5) {
        insights.push(
          `Google Trends shows stable search interest — consistent demand but not growing.`
        );
      } else {
        insights.push(
          `Google Trends shows search interest is down ${Math.abs(trendsData.percentChange)}% — consider whether this topic is losing relevance.`
        );
      }

      if (trendsData.currentInterest > 0 && trendsData.peakInterest > 0) {
        const peakRatio = Math.round(
          (trendsData.currentInterest / trendsData.peakInterest) * 100
        );
        if (peakRatio >= 80) {
          insights.push(
            `Current interest is near its 12-month peak — great timing to publish.`
          );
        } else if (peakRatio < 40) {
          insights.push(
            `Current interest is only ${peakRatio}% of its 12-month peak — you may have missed the optimal window.`
          );
        }
      }
    }

    // Opportunity gap insight
    if (demandScore >= 60 && competitionScore >= 70) {
      insights.push(
        `Opportunity gap detected: high demand meets low competition. This is a sweet spot.`
      );
    } else if (demandScore < 30 && competitionScore < 30) {
      insights.push(
        `Warning: low demand combined with high competition — this is the hardest scenario to succeed in.`
      );
    }

    // Engagement insight
    if (engagementRate > 5) {
      insights.push(
        "High engagement rate across existing videos — audiences are actively interacting with this content."
      );
    } else if (engagementRate < 1) {
      insights.push(
        "Low engagement rate suggests passive viewers. Consider a more provocative or personal angle."
      );
    }

    // Viral ceiling insight
    if (maxViews > 1000000) {
      insights.push(
        `The top video has ${formatNumber(maxViews)} views, proving viral potential exists.`
      );
    } else if (maxViews > 100000) {
      insights.push(
        `The top video reached ${formatNumber(maxViews)} views — solid ceiling for this niche.`
      );
    }

    // Title feedback
    if (titleAnalysis.tips.length > 0) {
      insights.push(`Title tip: ${titleAnalysis.tips[0]}`);
    }

    // ===== TITLE SUGGESTIONS =====
    const titleSuggestions = generateTitleSuggestions(idea);

    // ===== SEARCH VOLUME ESTIMATE =====
    let searchVolumeEstimate, searchVolumeRating;
    if (trendsData.trend !== "Unknown" && trendsData.averageInterest > 0) {
      if (trendsData.averageInterest > 70) {
        searchVolumeEstimate = "Very High";
        searchVolumeRating = "High";
      } else if (trendsData.averageInterest > 45) {
        searchVolumeEstimate = "High";
        searchVolumeRating = "High";
      } else if (trendsData.averageInterest > 25) {
        searchVolumeEstimate = "Medium";
        searchVolumeRating = "Medium";
      } else {
        searchVolumeEstimate = "Low";
        searchVolumeRating = "Low";
      }
    } else {
      if (totalResults > 500000) {
        searchVolumeEstimate = "Very High";
        searchVolumeRating = "High";
      } else if (totalResults > 100000) {
        searchVolumeEstimate = "High";
        searchVolumeRating = "High";
      } else if (totalResults > 10000) {
        searchVolumeEstimate = "Medium";
        searchVolumeRating = "Medium";
      } else {
        searchVolumeEstimate = "Low";
        searchVolumeRating = "Low";
      }
    }

    // ===== TREND DISPLAY =====
    let trendDirection, trendChange, trendRating;
    if (trendsData.trend !== "Unknown") {
      trendDirection = trendsData.trend;
      trendChange =
        (trendsData.percentChange >= 0 ? "+" : "") +
        trendsData.percentChange +
        "%";
      if (trendsData.trend.includes("Rising")) trendRating = "High";
      else if (trendsData.trend === "Stable") trendRating = "Medium";
      else trendRating = "Low";
    } else {
      const recentRatio = videos.length > 0 ? recentVideos / videos.length : 0;
      if (recentRatio > 0.6) {
        trendDirection = "Likely Rising";
        trendChange = `${recentVideos} recent`;
        trendRating = "High";
      } else if (recentRatio > 0.3) {
        trendDirection = "Likely Stable";
        trendChange = `${recentVideos} recent`;
        trendRating = "Medium";
      } else {
        trendDirection = "Likely Declining";
        trendChange = `${recentVideos} recent`;
        trendRating = "Low";
      }
    }

    // Competition rating (inverse)
    let competitionRating;
    if (competitionLevel === "Low") competitionRating = "High";
    else if (competitionLevel === "Medium") competitionRating = "Medium";
    else competitionRating = "Low";

    // Title rating
    let titleRating;
    if (titleScore >= 7) titleRating = "High";
    else if (titleScore >= 5) titleRating = "Medium";
    else titleRating = "Low";

    return NextResponse.json({
      score,
      label,
      color,
      summary: generateSummary(
        score,
        competitionLevel,
        trendsData.trend !== "Unknown" ? trendsData.trend : trendDirection,
        avgViews
      ),
      searchVolume: {
        value: searchVolumeEstimate,
        rating: searchVolumeRating,
      },
      competition: {
        value: competitionLevel,
        rating: competitionRating,
        count:
          totalResults > 1000
            ? formatNumber(totalResults)
            : totalResults,
      },
      trendDirection: {
        value: trendDirection,
        rating: trendRating,
        change: trendChange,
      },
      titleScore: {
        value: `${titleScore.toFixed(1)}/10`,
        rating: titleRating,
      },
      insights,
      titleSuggestions,
      trendData: trendsData.dataPoints || [],
      // Include category breakdown so users can see what's strong/weak
      breakdown: {
        demand: demandScore,
        competition: competitionScore,
        trend: trendScore,
        engagement: engagementScore,
        title: titleScoreNormalized,
      },
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

// ===== HELPER FUNCTIONS =====

async function fetchYouTubeData(idea, apiKey) {
  try {
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
      idea
    )}&type=video&maxResults=20&order=relevance&key=${apiKey}`;

    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    if (searchData.error) {
      return { error: "YouTube API error: " + searchData.error.message };
    }

    const videos = searchData.items || [];
    const totalResults = searchData.pageInfo?.totalResults || 0;

    if (videos.length === 0) {
      return { error: "No videos found for this topic" };
    }

    const videoIds = videos.map((v) => v.id.videoId).join(",");
    const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${videoIds}&key=${apiKey}`;

    const statsResponse = await fetch(statsUrl);
    const statsData = await statsResponse.json();

    return {
      videos,
      videoStats: statsData.items || [],
      totalResults,
    };
  } catch (error) {
    return { error: "Failed to fetch YouTube data" };
  }
}

async function fetchTrendsData(idea) {
  try {
    const keyword = idea
      .replace(
        /^(how to|why|what is|what are|the best|best|top|ultimate guide to)\s+/i,
        ""
      )
      .trim();

    const results = await googleTrends.interestOverTime({
      keyword: keyword,
      startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      endTime: new Date(),
      geo: "",
    });

    const parsed = JSON.parse(results);
    const timelineData = parsed.default?.timelineData || [];

    if (timelineData.length === 0) {
      return {
        trend: "Unknown",
        percentChange: 0,
        averageInterest: 0,
        currentInterest: 0,
        peakInterest: 0,
        dataPoints: [],
      };
    }

    const values = timelineData.map((point) => point.value[0]);
    const currentInterest = values[values.length - 1];
    const peakInterest = Math.max(...values);
    const averageInterest = Math.round(
      values.reduce((a, b) => a + b, 0) / values.length
    );

    const recentMonths = values.slice(-12);
    const previousMonths = values.slice(-24, -12);

    const recentAvg =
      recentMonths.length > 0
        ? recentMonths.reduce((a, b) => a + b, 0) / recentMonths.length
        : 0;
    const previousAvg =
      previousMonths.length > 0
        ? previousMonths.reduce((a, b) => a + b, 0) / previousMonths.length
        : 0;

    let percentChange = 0;
    if (previousAvg > 0) {
      percentChange = Math.round(
        ((recentAvg - previousAvg) / previousAvg) * 100
      );
    }

    let trend;
    if (percentChange > 15) trend = "Rising Fast";
    else if (percentChange > 5) trend = "Rising";
    else if (percentChange > -5) trend = "Stable";
    else if (percentChange > -15) trend = "Declining";
    else trend = "Declining Fast";

    const dataPoints = timelineData.slice(-26).map((point) => ({
      date: point.formattedTime,
      value: point.value[0],
    }));

    return {
      trend,
      percentChange,
      averageInterest,
      currentInterest,
      peakInterest,
      dataPoints,
    };
  } catch (error) {
    console.error("Trends fetch error:", error);
    return {
      trend: "Unknown",
      percentChange: 0,
      averageInterest: 0,
      currentInterest: 0,
      peakInterest: 0,
      dataPoints: [],
    };
  }
}

function calculateGini(values) {
  // Gini coefficient: 0 = perfect equality, 1 = maximum inequality
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const total = sorted.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;

  let sumOfDifferences = 0;
  for (let i = 0; i < n; i++) {
    sumOfDifferences += (2 * (i + 1) - n - 1) * sorted[i];
  }
  return sumOfDifferences / (n * total);
}

function analyzeTitleQuality(title) {
  const lower = title.toLowerCase();
  let score = 5;
  const tips = [];

  // Numbers boost clickability
  if (/\d/.test(title)) {
    score += 1;
  } else {
    tips.push(
      "Adding a number (like '5 Ways...' or '...in 30 Days') tends to boost click-through rates."
    );
  }

  // Power words
  const powerWords = [
    "best", "ultimate", "complete", "guide", "how to", "secret",
    "proven", "easy", "fast", "free", "new", "top", "why",
    "amazing", "mistakes", "avoid", "truth", "hack", "simple",
    "step by step", "beginner", "advanced", "real", "honest",
  ];
  const foundPower = powerWords.filter((w) => lower.includes(w));
  score += Math.min(foundPower.length, 2);
  if (foundPower.length === 0) {
    tips.push(
      "Consider adding a power word like 'best', 'complete', 'proven', or 'ultimate' to make the title more compelling."
    );
  }

  // Optimal length (40-60 chars)
  if (title.length >= 40 && title.length <= 60) {
    score += 1;
  } else if (title.length < 25) {
    score -= 1;
    tips.push(
      "Your title is quite short. Titles between 40-60 characters tend to perform best on YouTube."
    );
  } else if (title.length > 80) {
    score -= 1;
    tips.push(
      "Your title is long and may get cut off in search results. Try to keep it under 60 characters."
    );
  }

  // Structure indicators
  if (/[:\-–—|()]/.test(title)) score += 0.5;

  // Current year
  const currentYear = new Date().getFullYear();
  if (
    title.includes(String(currentYear)) ||
    title.includes(String(currentYear + 1))
  ) {
    score += 0.5;
  } else {
    tips.push(
      `Adding the year (${currentYear}) can signal freshness and boost clicks from searchers wanting current info.`
    );
  }

  // Emotional hooks
  const emotionalWords = [
    "never", "always", "stop", "don't", "warning", "shocking",
    "changed", "transformed", "finally", "actually",
  ];
  const foundEmotional = emotionalWords.filter((w) => lower.includes(w));
  if (foundEmotional.length > 0) score += 0.5;

  // Question format (can work well)
  if (title.includes("?")) score += 0.5;

  score = Math.max(1, Math.min(10, Math.round(score * 10) / 10));

  return { score, tips };
}

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

function generateSummary(score, competition, trend, avgViews) {
  if (score >= 75) {
    return `Strong opportunity! ${
      competition === "Low" || competition === "Medium"
        ? "Competition is manageable"
        : "Despite high competition"
    }, the data shows solid demand with ${
      trend.includes("Rising") ? "growing" : "steady"
    } interest. Videos in this space average ${formatNumber(avgViews)} views.`;
  } else if (score >= 55) {
    return `Promising topic with good fundamentals. ${
      trend.includes("Rising")
        ? "Growing search interest works in your favor."
        : "Demand is steady."
    } Average views of ${formatNumber(avgViews)} across existing content. A strong angle could push this into high-potential territory.`;
  } else if (score >= 40) {
    return `This topic has potential but comes with challenges. ${
      competition === "High" || competition === "Very High"
        ? "The space is crowded — you'll need a unique angle."
        : "Competition is moderate."
    } Average views sit at ${formatNumber(avgViews)}. ${
      trend.includes("Declining")
        ? "Declining search interest adds risk."
        : "Consider refining your approach."
    }`;
  } else if (score >= 25) {
    return `This topic is risky. ${
      avgViews < 10000
        ? "Audience demand appears limited"
        : "While some videos have done well"
    }, ${
      trend.includes("Declining")
        ? "declining interest makes timing unfavorable"
        : "the opportunity-to-effort ratio is low"
    }. Consider a more specific sub-niche or a different topic.`;
  } else {
    return `Not recommended. ${
      avgViews < 5000
        ? "Very low audience demand"
        : "Despite some existing content"
    }, the data suggests this topic is unlikely to generate meaningful views. ${
      trend.includes("Declining")
        ? "Search interest is actively declining."
        : "The market signals are weak."
    } Pivot to a related topic with stronger indicators.`;
  }
}

function generateTitleSuggestions(idea) {
  const topic = idea.replace(/^(how to|why|what|the|a|an)\s+/i, "").trim();
  const year = new Date().getFullYear();
  return [
    `The Truth About ${capitalize(topic)} That Nobody Tells You`,
    `${capitalize(topic)}: Complete Guide for ${year}`,
    `I Tried ${capitalize(topic)} for 30 Days — Here's What Happened`,
  ];
}

function capitalize(str) {
  return str
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}