import { NextResponse } from "next/server";
import googleTrends from "google-trends-api";

export async function POST(request) {
  try {
    const { keyword } = await request.json();

    if (!keyword || !keyword.trim()) {
      return NextResponse.json(
        { error: "Please provide a keyword" },
        { status: 400 }
      );
    }

    // Get interest over the last 12 months
    const results = await googleTrends.interestOverTime({
      keyword: keyword.trim(),
      startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
      endTime: new Date(),
      geo: "", // worldwide
    });

    const parsed = JSON.parse(results);
    const timelineData = parsed.default?.timelineData || [];

    if (timelineData.length === 0) {
      return NextResponse.json({
        trend: "Unknown",
        percentChange: 0,
        averageInterest: 0,
        currentInterest: 0,
        peakInterest: 0,
        dataPoints: [],
      });
    }

    // Extract the interest values
    const values = timelineData.map((point) => point.value[0]);

    // Calculate key metrics
    const currentInterest = values[values.length - 1];
    const peakInterest = Math.max(...values);
    const averageInterest = Math.round(
      values.reduce((a, b) => a + b, 0) / values.length
    );

    // Compare last 3 months vs previous 3 months to determine trend
    const recentMonths = values.slice(-12); // roughly last 3 months (weekly data)
    const previousMonths = values.slice(-24, -12); // 3 months before that

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

    // Determine trend direction
    let trend;
    if (percentChange > 15) {
      trend = "Rising Fast";
    } else if (percentChange > 5) {
      trend = "Rising";
    } else if (percentChange > -5) {
      trend = "Stable";
    } else if (percentChange > -15) {
      trend = "Declining";
    } else {
      trend = "Declining Fast";
    }

    // Build sparkline data points (last 6 months, simplified)
    const dataPoints = timelineData.slice(-26).map((point) => ({
      date: point.formattedTime,
      value: point.value[0],
    }));

    return NextResponse.json({
      trend,
      percentChange,
      averageInterest,
      currentInterest,
      peakInterest,
      dataPoints,
    });
  } catch (error) {
    console.error("Google Trends error:", error);

    // Google Trends can be flaky — return a fallback instead of failing
    return NextResponse.json({
      trend: "Unknown",
      percentChange: 0,
      averageInterest: 0,
      currentInterest: 0,
      peakInterest: 0,
      dataPoints: [],
      note: "Trend data temporarily unavailable",
    });
  }
}