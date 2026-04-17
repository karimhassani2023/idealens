import { NextResponse } from "next/server";

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

    // Step 1: Search YouTube for videos matching this idea
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
      idea
    )}&type=video&maxResults=20&order=relevance&key=${API_KEY}`;

    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    if (searchData.error) {
      return NextResponse.json(
        { error: "YouTube API error: " + searchData.error.message },
        { status: 500 }
      );
    }

    const videos = searchData.items || [];
    const totalResults = searchData.pageInfo?.totalResults || 0;

    if (videos.length === 0) {
      return NextResponse.json(
        { error: "No videos found for this topic" },
        { status: 404 }
      );
    }

    // Step 2: Get detailed stats for these videos (views, likes, comments)
    const videoIds = videos.map((v) => v.id.videoId).join(",");
    const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${videoIds}&key=${API_KEY}`;

    const statsResponse = await fetch(statsUrl);
    const statsData = await statsResponse.json();
    const videoStats = statsData.items || [];

    // Step 3: Calculate metrics
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
    const medianViews = views.sort((a, b) => a - b)[Math.floor(views.length / 2)];

    const totalLikes = likes.reduce((a, b) => a + b, 0);
    const avgLikes = Math.round(totalLikes / likes.length);

    const totalComments = comments.reduce((a, b) => a + b, 0);
    const avgComments = Math.round(totalComments / comments.length);

    // Step 4: Analyze upload dates to gauge freshness
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

    // Step 5: Analyze competition level
    const competitionCount = totalResults;
    let competitionLevel;
    if (competitionCount > 500000) {
      competitionLevel = "Very High";
    } else if (competitionCount > 100000) {
      competitionLevel = "High";
    } else if (competitionCount > 10000) {
      competitionLevel = "Medium";
    } else {
      competitionLevel = "Low";
    }

    // Step 6: Analyze title quality
    const titleLower = idea.toLowerCase();
    let titleScore = 5;

    // Check for numbers (listicles perform well)
    if (/\d/.test(idea)) titleScore += 1;
    // Check for power words
    const powerWords = [
      "best", "ultimate", "complete", "guide", "how to", "secret",
      "proven", "easy", "fast", "free", "new", "top", "why",
      "amazing", "mistakes", "avoid", "truth", "hack",
    ];
    const powerWordCount = powerWords.filter((w) =>
      titleLower.includes(w)
    ).length;
    titleScore += Math.min(powerWordCount, 2);
    // Check length (optimal is 40-60 chars)
    if (idea.length >= 40 && idea.length <= 60) {
      titleScore += 1;
    } else if (idea.length < 20 || idea.length > 80) {
      titleScore -= 1;
    }
    // Check for specificity (colons, dashes, parentheses suggest structure)
    if (/[:\-–—|()]/.test(idea)) titleScore += 0.5;
    // Check for current year
    if (idea.includes("2025") || idea.includes("2026")) titleScore += 0.5;

    titleScore = Math.max(1, Math.min(10, titleScore));

    // Step 7: Calculate overall score (0-100)
    let score = 50; // Start neutral

    // Demand signal: high average views = strong demand
    if (avgViews > 500000) score += 15;
    else if (avgViews > 100000) score += 12;
    else if (avgViews > 50000) score += 8;
    else if (avgViews > 10000) score += 4;
    else score -= 5;

    // Competition penalty: too many results = harder to rank
    if (competitionCount > 500000) score -= 15;
    else if (competitionCount > 100000) score -= 8;
    else if (competitionCount > 10000) score -= 3;
    else score += 10;

    // Freshness: recent uploads = active topic
    if (recentVideos > 10) score += 5;
    else if (recentVideos > 5) score += 8;
    else if (recentVideos > 2) score += 3;
    else score -= 5;

    // Engagement ratio
    const engagementRate =
      avgViews > 0 ? ((avgLikes + avgComments) / avgViews) * 100 : 0;
    if (engagementRate > 5) score += 10;
    else if (engagementRate > 3) score += 6;
    else if (engagementRate > 1) score += 3;

    // Title quality boost
    score += (titleScore - 5) * 2;

    // Clamp score between 0 and 100
    score = Math.max(0, Math.min(100, Math.round(score)));

    // Step 8: Determine label and color
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

    // Step 9: Build insights
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

    if (recentVideos > 10) {
      insights.push(
        `${recentVideos} of the top 20 videos were uploaded in the last 90 days — this topic is very active right now.`
      );
    } else if (recentVideos > 3) {
      insights.push(
        `${recentVideos} recent videos in the last 90 days — the topic has steady activity.`
      );
    } else {
      insights.push(
        `Only ${recentVideos} video(s) uploaded recently — this topic may be losing momentum.`
      );
    }

    if (maxViews > 1000000) {
      insights.push(
        `The top video has ${formatNumber(maxViews)} views, proving viral potential exists for this topic.`
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

    // Step 10: Generate title suggestions based on top performers
    const topTitles = videos
      .slice(0, 5)
      .map((v) => v.snippet.title);

    const titleSuggestions = generateTitleSuggestions(idea, topTitles);

    // Step 11: Build search volume estimate
    // (YouTube API doesn't give exact search volume, so we estimate from results)
    let searchVolumeEstimate;
    let searchVolumeRating;
    if (totalResults > 500000) {
      searchVolumeEstimate = "Very High";
      searchVolumeRating = "High";
    } else if (totalResults > 100000) {
      searchVolumeEstimate = "High";
      searchVolumeRating = "High";
    } else if (totalResults > 10000) {
      searchVolumeEstimate = "Medium";
      searchVolumeRating = "Medium";
    } else if (totalResults > 1000) {
      searchVolumeEstimate = "Low";
      searchVolumeRating = "Low";
    } else {
      searchVolumeEstimate = "Very Low";
      searchVolumeRating = "Low";
    }

    // Step 12: Determine trend direction from upload freshness
    let trendDirection, trendChange, trendRating;
    const recentRatio = recentVideos / videos.length;
    if (recentRatio > 0.6) {
      trendDirection = "Rising";
      trendChange = `${recentVideos} recent`;
      trendRating = "High";
    } else if (recentRatio > 0.3) {
      trendDirection = "Stable";
      trendChange = `${recentVideos} recent`;
      trendRating = "Medium";
    } else {
      trendDirection = "Declining";
      trendChange = `${recentVideos} recent`;
      trendRating = "Low";
    }

    // Build competition rating (inverse — low competition is good)
    let competitionRating;
    if (competitionLevel === "Low") competitionRating = "High";
    else if (competitionLevel === "Medium") competitionRating = "Medium";
    else competitionRating = "Low";

    // Build title rating
    let titleRating;
    if (titleScore >= 7) titleRating = "High";
    else if (titleScore >= 5) titleRating = "Medium";
    else titleRating = "Low";

    return NextResponse.json({
      score,
      label,
      color,
      summary: generateSummary(score, competitionLevel, trendDirection, avgViews),
      searchVolume: {
        value: searchVolumeEstimate,
        rating: searchVolumeRating,
      },
      competition: {
        value: competitionLevel,
        rating: competitionRating,
        count: competitionCount > 1000 ? formatNumber(competitionCount) : competitionCount,
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
      rawStats: {
        avgViews,
        maxViews,
        medianViews,
        avgLikes,
        avgComments,
        avgDaysAgo,
        recentVideos,
        totalResults,
        engagementRate: engagementRate.toFixed(2),
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
      trend === "Rising" ? "growing" : "steady"
    } interest. Videos in this space average ${formatNumber(avgViews)} views.`;
  } else if (score >= 40) {
    return `This topic has potential but comes with challenges. ${
      competition === "High" || competition === "Very High"
        ? "The space is crowded — you'll need a unique angle."
        : "Competition is moderate."
    } Average views sit at ${formatNumber(avgViews)}. Consider refining your approach.`;
  } else {
    return `This topic carries risk. ${
      avgViews < 10000
        ? "Audience demand appears limited"
        : "Despite some existing views"
    }, ${
      trend === "Declining"
        ? "interest is declining"
        : "growth signals are weak"
    }. Consider pivoting to a related topic with stronger demand.`;
  }
}

function generateTitleSuggestions(idea, topTitles) {
  // Generate variations based on proven title patterns
  const suggestions = [];
  const topic = idea.replace(/^(how to|why|what|the|a|an)\s+/i, "").trim();

  suggestions.push(`The Truth About ${capitalize(topic)} That Nobody Tells You`);
  suggestions.push(
    `${capitalize(topic)}: Complete Guide for ${new Date().getFullYear()}`
  );
  suggestions.push(`I Tried ${capitalize(topic)} for 30 Days — Here's What Happened`);

  return suggestions;
}

function capitalize(str) {
  return str
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}