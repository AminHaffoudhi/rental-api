import {
  BookingStatus,
  EquipmentApprovalStatus,
  PaymentStatus,
  ReviewStatus,
  ReviewType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

const OWNER_ACTIVE_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.PAYMENT_PENDING,
  BookingStatus.PAID,
  BookingStatus.PICKUP_SCHEDULED,
  BookingStatus.IN_TRANSIT,
  BookingStatus.ACTIVE,
  BookingStatus.RETURN_SCHEDULED,
  BookingStatus.RETURNING,
  BookingStatus.INSPECTING,
];

function ownerNet(totalPrice: number, platformFee: number): number {
  return Math.round((totalPrice - platformFee) * 100) / 100;
}

function monthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function buildLastMonths(count: number): { key: string; label: string }[] {
  const now = new Date();
  const months: { key: string; label: string }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: monthKey(d),
      label: d.toLocaleString("en-US", { month: "short" }),
    });
  }
  return months;
}

function buildLastDays(count: number): { key: string; label: string }[] {
  const days: { key: string; label: string }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({
      key,
      label: d.toLocaleString("en-US", { weekday: "short", day: "numeric" }),
    });
  }
  return days;
}

export async function getOwnerDashboard(ownerId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const trendStart = new Date(now);
  trendStart.setDate(trendStart.getDate() - 29);
  trendStart.setHours(0, 0, 0, 0);

  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [
    equipmentRows,
    bookingsByStatusRaw,
    completedBookings,
    recentOwnerBookings,
    reviewAggregate,
    bookingsSinceTrend,
  ] = await Promise.all([
    prisma.equipment.findMany({
      where: { ownerId },
      select: {
        id: true,
        title: true,
        images: true,
        isAvailable: true,
        approvalStatus: true,
        categoryId: true,
        category: { select: { id: true, name: true } },
      },
    }),
    prisma.booking.groupBy({
      by: ["status"],
      where: { ownerId },
      _count: { id: true },
    }),
    prisma.booking.findMany({
      where: {
        ownerId,
        status: BookingStatus.COMPLETED,
        createdAt: { gte: sixMonthsAgo },
      },
      select: {
        id: true,
        equipmentId: true,
        totalPrice: true,
        platformFee: true,
        createdAt: true,
        payment: { select: { status: true } },
      },
    }),
    prisma.booking.findMany({
      where: { ownerId },
      select: {
        id: true,
        status: true,
        totalPrice: true,
        platformFee: true,
        createdAt: true,
        payment: { select: { status: true } },
      },
    }),
    prisma.review.aggregate({
      where: {
        status: ReviewStatus.APPROVED,
        OR: [
          { revieweeId: ownerId, type: ReviewType.OWNER },
          { type: ReviewType.EQUIPMENT, equipment: { ownerId } },
        ],
      },
      _avg: { rating: true },
      _count: { id: true },
    }),
    prisma.booking.findMany({
      where: { ownerId, createdAt: { gte: trendStart } },
      select: { createdAt: true },
    }),
  ]);

  const allCompleted = recentOwnerBookings.filter((b) => b.status === BookingStatus.COMPLETED);

  let totalGross = 0;
  let totalNet = 0;
  let monthGross = 0;
  let monthNet = 0;
  let lastMonthGross = 0;
  let pendingPayout = 0;

  for (const b of allCompleted) {
    const gross = b.totalPrice;
    const net = ownerNet(b.totalPrice, b.platformFee);
    totalGross += gross;
    totalNet += net;
    const created = new Date(b.createdAt);
    if (created >= monthStart) {
      monthGross += gross;
      monthNet += net;
    } else if (created >= lastMonthStart && created <= lastMonthEnd) {
      lastMonthGross += gross;
    }
    if (b.payment?.status === PaymentStatus.PENDING) {
      pendingPayout += net;
    }
  }

  const monthChangePct =
    lastMonthGross > 0
      ? Math.round(((monthGross - lastMonthGross) / lastMonthGross) * 1000) / 10
      : monthGross > 0
        ? 100
        : null;

  const listingsBreakdown = {
    total: equipmentRows.length,
    pending: equipmentRows.filter((e) => e.approvalStatus === EquipmentApprovalStatus.PENDING)
      .length,
    approved: equipmentRows.filter((e) => e.approvalStatus === EquipmentApprovalStatus.APPROVED)
      .length,
    rejected: equipmentRows.filter((e) => e.approvalStatus === EquipmentApprovalStatus.REJECTED)
      .length,
    live: equipmentRows.filter(
      (e) => e.approvalStatus === EquipmentApprovalStatus.APPROVED && e.isAvailable
    ).length,
    hidden: equipmentRows.filter(
      (e) => e.approvalStatus === EquipmentApprovalStatus.APPROVED && !e.isAvailable
    ).length,
  };

  const categoryMap = new Map<string, { categoryId: string; categoryName: string; count: number }>();
  for (const e of equipmentRows) {
    const existing = categoryMap.get(e.categoryId);
    if (existing) {
      existing.count += 1;
    } else {
      categoryMap.set(e.categoryId, {
        categoryId: e.categoryId,
        categoryName: e.category.name,
        count: 1,
      });
    }
  }

  const equipmentRevenue = new Map<
    string,
    { id: string; title: string; image: string | null; bookings: number; revenueGross: number; revenueNet: number }
  >();
  for (const e of equipmentRows) {
    equipmentRevenue.set(e.id, {
      id: e.id,
      title: e.title,
      image: e.images[0] ?? null,
      bookings: 0,
      revenueGross: 0,
      revenueNet: 0,
    });
  }

  const earningsMonthMap = new Map<string, { gross: number; net: number; bookings: number }>();
  for (const m of buildLastMonths(6)) {
    earningsMonthMap.set(m.key, { gross: 0, net: 0, bookings: 0 });
  }

  for (const b of completedBookings) {
    const key = monthKey(new Date(b.createdAt));
    const bucket = earningsMonthMap.get(key);
    if (bucket) {
      bucket.gross += b.totalPrice;
      bucket.net += ownerNet(b.totalPrice, b.platformFee);
      bucket.bookings += 1;
    }
    const eq = equipmentRevenue.get(b.equipmentId);
    if (eq) {
      eq.bookings += 1;
      eq.revenueGross += b.totalPrice;
      eq.revenueNet += ownerNet(b.totalPrice, b.platformFee);
    }
  }

  const earningsByMonth = buildLastMonths(6).map((m) => {
    const v = earningsMonthMap.get(m.key)!;
    return {
      month: m.key,
      label: m.label,
      gross: Math.round(v.gross * 100) / 100,
      net: Math.round(v.net * 100) / 100,
      bookings: v.bookings,
    };
  });

  const trendMap = new Map<string, number>();
  for (const d of buildLastDays(30)) {
    trendMap.set(d.key, 0);
  }
  for (const b of bookingsSinceTrend) {
    const key = new Date(b.createdAt).toISOString().slice(0, 10);
    if (trendMap.has(key)) {
      trendMap.set(key, (trendMap.get(key) ?? 0) + 1);
    }
  }

  const bookingsTrend = buildLastDays(30).map((d) => ({
    date: d.key,
    label: d.label,
    count: trendMap.get(d.key) ?? 0,
  }));

  const topEquipment = [...equipmentRevenue.values()]
    .filter((e) => e.bookings > 0)
    .sort((a, b) => b.revenueNet - a.revenueNet)
    .slice(0, 5)
    .map((e) => ({
      ...e,
      revenueGross: Math.round(e.revenueGross * 100) / 100,
      revenueNet: Math.round(e.revenueNet * 100) / 100,
    }));

  const pendingRequests = recentOwnerBookings.filter(
    (b) => b.status === BookingStatus.PENDING
  ).length;

  const activeRentals = recentOwnerBookings.filter((b) =>
    OWNER_ACTIVE_STATUSES.includes(b.status)
  ).length;

  const avgRaw = reviewAggregate._avg.rating;

  return {
    summary: {
      totalEarningsGross: Math.round(totalGross * 100) / 100,
      totalEarningsNet: Math.round(totalNet * 100) / 100,
      earningsThisMonthGross: Math.round(monthGross * 100) / 100,
      earningsThisMonthNet: Math.round(monthNet * 100) / 100,
      monthOverMonthChangePct: monthChangePct,
      pendingPayout: Math.round(pendingPayout * 100) / 100,
      totalListings: listingsBreakdown.total,
      liveListings: listingsBreakdown.live,
      pendingApprovalListings: listingsBreakdown.pending,
      totalBookings: recentOwnerBookings.length,
      pendingRequests,
      activeRentals,
      completedBookings: allCompleted.length,
      avgRating: avgRaw !== null ? Math.round(avgRaw * 10) / 10 : null,
      totalReviews: reviewAggregate._count.id,
    },
    listingsBreakdown,
    bookingsByStatus: bookingsByStatusRaw.map((row) => ({
      status: row.status,
      count: row._count.id,
    })),
    earningsByMonth,
    bookingsTrend,
    topEquipment,
    equipmentByCategory: [...categoryMap.values()].sort((a, b) => b.count - a.count),
  };
}
