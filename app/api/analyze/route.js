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

    // Run YouTube search AND Google Trends at the same time for speed
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

    const {
      videos,
      videoStats,
      totalResults,
    } = youtubeData;

    // Calculate YouTube metrics
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
    const avgViews = Math.round(totalViews / views.length);
    const maxViews = Math.max(...views);
    const medianViews = [...views].sort((a, b) => a - b)[
      Math.floor(views.length / 2)
    ];

    const totalLikes = likes.reduce((a, b) => a + b, 0);
    const avgLikes = Math.round(totalLikes / likes.length);

    const totalComments = comments.reduce((a, b) => a + b, 0);
    const avgComments = Math.round(totalComments / comments.length);

    // Analyze upload dates
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

    // Competition level
    const competitionCount = totalResults;
    let competitionLevel;
    if (competitionCount > 500000) competitionLevel = "Very High";
    else if (competitionCount > 100000) competitionLevel = "High";
    else if (competitionCount > 10000) competitionLevel = "Medium";
    else competitionLevel = "Low";

    // Title quality analysis
    const titleLower = idea.toLowerCase();
    let titleScore = 5;

    if (/\d/.test(idea)) titleScore += 1;
    const powerWords = [
      "best", "ultimate", "complete", "guide", "how to", "secret",
      "proven", "easy", "fast", "free", "new", "top", "why",
      "amazing", "mistakes", "avoid", "truth", "hack",
    ];
    const powerWordCount = powerWords.filter((w) =>
      titleLower.includes(w)
    ).length;
    titleScore += Math.min(powerWordCount, 2);
    if (idea.length >= 40 && idea.length <= 60) titleScore += 1;
    else if (idea.length < 20 || idea.length > 80) titleScore -= 1;
    if (/[:\-–—|()]/.test(idea)) titleScore += 0.5;
    if (idea.includes("2025") || idea.includes("2026")) titleScore += 0.5;
    titleScore = Math.max(1, Math.min(10, titleScore));

    // Engagement rate
    const engagementRate =
      avgViews > 0 ? ((avgLikes + avgComments) / avgViews) * 100 : 0;

    // ===== SCORING ALGORITHM =====
    let score = 50;

    // Demand signal from YouTube views
    if (avgViews > 500000) score += 15;
    else if (avgViews > 100000) score += 12;
    else if (avgViews > 50000) score += 8;
    else if (avgViews > 10000) score += 4;
    else score -= 5;

    // Competition penalty
    if (competitionCount > 500000) score -= 15;
    else if (competitionCount > 100000) score -= 8;
    else if (competitionCount > 10000) score -= 3;
    else score += 10;

    // Freshness from YouTube uploads
    if (recentVideos > 10) score += 5;
    else if (recentVideos > 5) score += 8;
    else if (recentVideos > 2) score += 3;
    else score -= 5;

    // Engagement rate
    if (engagementRate > 5) score += 10;
    else if (engagementRate > 3) score += 6;
    else if (engagementRate > 1) score += 3;

    // Title quality
    score += (titleScore - 5) * 2;

    // ===== GOOGLE TRENDS BOOST =====
    // This is the new part — trend data now influences the score
    if (trendsData.trend !== "Unknown") {
      if (trendsData.trend === "Rising Fast") score += 12;
      else if (trendsData.trend === "Rising") score += 7;
      else if (trendsData.trend === "Stable") score += 2;
      else if (trendsData.trend === "Declining") score -= 6;
      else if (trendsData.trend === "Declining Fast") score -= 12;

      // High current interest is a good sign
      if (trendsData.currentInterest > 75) score += 5;
      else if (trendsData.currentInterest < 25) score -= 5;
    }

    // Clamp score
    score = Math.max(0, Math.min(100, Math.round(score)));

    // Label and color
    let label, color;
    if (score >= 70) {
      label = "High Potential";
      color = "#22c55e";
    } else if (score >= 40) {
      label = "Worth Trying";
      color = "#eab308";
    } else {
      label = "Risky";
      color = "#ef4444";
    }

    // ===== BUILD INSIGHTS =====
    const insights = [];

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

    if (competitionCount > 100000) {
      insights.push(
        `High competition with ${formatNumber(competitionCount)} total results. You'll need a unique angle to stand out.`
      );
    } else if (competitionCount > 10000) {
      insights.push(
        `Moderate competition with ${formatNumber(competitionCount)} total results. There's room to compete with quality content.`
      );
    } else {
      insights.push(
        `Low competition with only ${formatNumber(competitionCount)} total results. Great opportunity to own this topic.`
      );
    }

    // Google Trends insights — the new stuff!
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
          `Google Trends shows stable search interest — not growing fast, but consistent demand.`
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
            `Current interest is only ${peakRatio}% of its 12-month peak — you may have missed the best window.`
          );
        }
      }
    }

    if (recentVideos > 10) {
      insights.push(
        `${recentVideos} of the top 20 videos were uploaded in the last 90 days — very active topic.`
      );
    } else if (recentVideos > 3) {
      insights.push(
        `${recentVideos} recent videos in the last 90 days — the topic has steady activity.`
      );
    } else {
      insights.push(
        `Only ${recentVideos} video(s) uploaded recently — this topic may be slowing down on YouTube.`
      );
    }

    if (maxViews > 1000000) {
      insights.push(
        `The top video has ${formatNumber(maxViews)} views, proving viral potential exists.`
      );
    } else if (maxViews > 100000) {
      insights.push(
        `The top video reached ${formatNumber(maxViews)} views — solid ceiling for this niche.`
      );
    }

    if (engagementRate > 5) {
      insights.push(
        "High engagement rate across existing videos — audiences are actively interested."
      );
    } else if (engagementRate < 1) {
      insights.push(
        "Low engagement rate suggests passive viewers. Consider a more provocative angle."
      );
    }

    // Title suggestions
    const titleSuggestions = generateTitleSuggestions(idea);

    // Search volume estimate
    let searchVolumeEstimate, searchVolumeRating;
    if (trendsData.trend !== "Unknown" && trendsData.averageInterest > 0) {
      // Use Google Trends data for a better estimate
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
      // Fallback to YouTube result count
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

    // Trend display — now using real Google Trends data
    let trendDirection, trendChange, trendRating;
    if (trendsData.trend !== "Unknown") {
      trendDirection = trendsData.trend;
      trendChange =
        (trendsData.percentChange >= 0 ? "+" : "") +
        trendsData.percentChange +
        "%";
      if (
        trendsData.trend === "Rising Fast" ||
        trendsData.trend === "Rising"
      ) {
        trendRating = "High";
      } else if (trendsData.trend === "Stable") {
        trendRating = "Medium";
      } else {
        trendRating = "Low";
      }
    } else {
      // Fallback to YouTube freshness estimate
      const recentRatio = recentVideos / videos.length;
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

    // Competition rating (inverse — low competition is good)
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
          competitionCount > 1000
            ? formatNumber(competitionCount)
            : competitionCount,
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
    // Extract the core topic for better trend matching
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

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

function generateSummary(score, competition, trend, avgViews) {
  if (score >= 70) {
    return `Strong opportunity! ${
      competition === "Low" || competition === "Medium"
        ? "Competition is manageable"
        : "Despite high competition"
    }, the data shows solid demand with ${
      trend.includes("Rising") ? "growing" : "steady"
    } interest. Videos in this space average ${formatNumber(avgViews)} views.`;
  } else if (score >= 40) {
    return `This topic has potential but comes with challenges. ${
      competition === "High" || competition === "Very High"
        ? "The space is crowded — you'll need a unique angle."
        : "Competition is moderate."
    } Average views sit at ${formatNumber(avgViews)}. ${
      trend.includes("Declining")
        ? "Search interest is declining, so timing matters."
        : "Consider refining your approach."
    }`;
  } else {
    return `This topic carries risk. ${
      avgViews < 10000
        ? "Audience demand appears limited"
        : "Despite some existing views"
    }, ${
      trend.includes("Declining")
        ? "interest is declining according to Google Trends"
        : "growth signals are weak"
    }. Consider pivoting to a related topic with stronger demand.`;
  }
}

function generateTitleSuggestions(idea) {
  const topic = idea.replace(/^(how to|why|what|the|a|an)\s+/i, "").trim();
  return [
    `The Truth About ${capitalize(topic)} That Nobody Tells You`,
    `${capitalize(topic)}: Complete Guide for ${new Date().getFullYear()}`,
    `I Tried ${capitalize(topic)} for 30 Days — Here's What Happened`,
  ];
}

function capitalize(str) {
  return str
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}