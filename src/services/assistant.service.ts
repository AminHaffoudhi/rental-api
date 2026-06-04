import { BookingStatus, EquipmentApprovalStatus, ReviewStatus, ReviewType, Role } from "@prisma/client";
import { CLIENT_URL } from "@/config/env";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import * as bookingService from "@/services/booking.service";
import * as ownerDashboardService from "@/services/ownerDashboard.service";
import type { AssistantChatInput, AssistantLanguage } from "@/validators/assistant.validator";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = process.env.CLAUDE_MODEL?.trim() || "claude-sonnet-4-20250514";

export type ChatMessage = { role: "user" | "assistant"; content: string };

const LANGUAGE_NAMES: Record<AssistantLanguage, string> = {
  en: "English",
  fr: "French",
  ar: "Arabic",
};

const OWNER_SUGGESTION_FALLBACKS: Record<AssistantLanguage, string[]> = {
  en: [
    "Summarize my earnings and what changed this month",
    "Which listings should I improve or reprice?",
    "Do I have pending booking requests?",
    "When should I raise or lower my daily rates?",
  ],
  fr: [
    "Résumez mes revenus et l'évolution ce mois-ci",
    "Quelles annonces dois-je améliorer ou retarifer ?",
    "Ai-je des demandes de réservation en attente ?",
    "Quand augmenter ou baisser mes tarifs journaliers ?",
  ],
  ar: [
    "لخّص أرباحي وما تغيّر هذا الشهر",
    "أي إعلانات يجب تحسينها أو تعديل أسعارها؟",
    "هل لدي طلبات حجز معلقة؟",
    "متى أرفع أو أخفض الأسعار اليومية؟",
  ],
};

export function parseAssistantLanguage(raw: unknown): AssistantLanguage {
  if (raw === "fr" || raw === "ar" || raw === "en") return raw;
  return "en";
}

function languageRule(language: AssistantLanguage): string {
  const name = LANGUAGE_NAMES[language];
  return `Always write in ${name}. All replies and suggestion prompts must be in ${name}, even if the data labels are in English.`;
}

function equipmentLink(id: string): string {
  return `${CLIENT_URL.replace(/\/+$/, "")}/equipment/${id}`;
}

function ownerLink(id: string): string {
  return `${CLIENT_URL.replace(/\/+$/, "")}/users/${id}`;
}

function searchCategoryLink(slug: string): string {
  return `${CLIENT_URL.replace(/\/+$/, "")}/search?category=${encodeURIComponent(slug)}`;
}

function isClaudeConfigured(): boolean {
  return Boolean(process.env.CLAUDE_API_KEY?.trim());
}

async function callClaude(system: string, messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.CLAUDE_API_KEY?.trim();
  if (!apiKey) {
    throw new ValidationError(
      "AI assistant is not configured. Add CLAUDE_API_KEY to the server environment."
    );
  }

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      max_tokens: 2048,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new ValidationError(
      `AI service error (${res.status}). ${errText.slice(0, 200) || "Try again later."}`
    );
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = data.content?.find((c) => c.type === "text")?.text?.trim();
  if (!text) {
    throw new ValidationError("AI returned an empty response.");
  }
  return text;
}

async function buildRenterContext(userId: string): Promise<string> {
  const [topRated, popular, topOwners, categories, bookings] = await Promise.all([
    prisma.equipment.findMany({
      where: {
        approvalStatus: EquipmentApprovalStatus.APPROVED,
        isAvailable: true,
        reviews: { some: { status: ReviewStatus.APPROVED, type: ReviewType.EQUIPMENT } },
      },
      select: {
        id: true,
        title: true,
        dailyRate: true,
        location: true,
        category: { select: { name: true, slug: true } },
        owner: { select: { id: true, name: true, kycStatus: true } },
        reviews: {
          where: { status: ReviewStatus.APPROVED, type: ReviewType.EQUIPMENT },
          select: { rating: true },
        },
        _count: { select: { bookings: true } },
      },
      take: 40,
    }),
    prisma.equipment.findMany({
      where: {
        approvalStatus: EquipmentApprovalStatus.APPROVED,
        isAvailable: true,
      },
      select: {
        id: true,
        title: true,
        dailyRate: true,
        location: true,
        category: { select: { name: true, slug: true } },
        owner: { select: { id: true, name: true } },
        _count: { select: { bookings: true } },
      },
      orderBy: { bookings: { _count: "desc" } },
      take: 12,
    }),
    prisma.user.findMany({
      where: {
        role: { in: [Role.OWNER, Role.BOTH] },
        equipment: {
          some: { approvalStatus: EquipmentApprovalStatus.APPROVED, isAvailable: true },
        },
      },
      select: {
        id: true,
        name: true,
        kycStatus: true,
        _count: {
          select: {
            equipment: {
              where: { approvalStatus: EquipmentApprovalStatus.APPROVED },
            },
          },
        },
        equipment: {
          where: { approvalStatus: EquipmentApprovalStatus.APPROVED, isAvailable: true },
          select: {
            reviews: {
              where: { status: ReviewStatus.APPROVED, type: ReviewType.EQUIPMENT },
              select: { rating: true },
            },
          },
          take: 20,
        },
      },
      take: 15,
    }),
    prisma.equipmentCategory.findMany({
      where: { isActive: true },
      select: { name: true, slug: true, description: true },
      orderBy: { sortOrder: "asc" },
    }),
    bookingService.getMyBookings(userId).catch(() => ({ asRenter: [], asOwner: [] })),
  ]);

  const rated = topRated
    .map((e) => {
      const ratings = e.reviews.map((r) => r.rating);
      const avg =
        ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
      return { ...e, avgRating: avg, reviewCount: ratings.length };
    })
    .filter((e) => e.avgRating !== null)
    .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0))
    .slice(0, 10);

  const ownersRanked = topOwners
    .map((o) => {
      const allRatings = o.equipment.flatMap((eq) => eq.reviews.map((r) => r.rating));
      const avg =
        allRatings.length > 0
          ? Math.round((allRatings.reduce((a, b) => a + b, 0) / allRatings.length) * 10) / 10
          : null;
      return {
        id: o.id,
        name: o.name,
        verified: o.kycStatus === "APPROVED",
        listingCount: o._count.equipment,
        avgRating: avg,
        profileUrl: ownerLink(o.id),
      };
    })
    .sort((a, b) => b.listingCount - a.listingCount)
    .slice(0, 8);

  const renterBookings = bookings.asRenter
    .filter((b) =>
      ["PENDING", "CONFIRMED", "PAID", "ACTIVE", "COMPLETED"].includes(b.status)
    )
    .slice(0, 5)
    .map((b) => ({
      status: b.status,
      equipment: b.equipment.title,
      equipmentUrl: equipmentLink(b.equipment.id),
      start: b.startDate,
      end: b.endDate,
    }));

  return JSON.stringify(
    {
      platform: "Ekri equipment rental (Tunisia)",
      links: {
        search: `${CLIENT_URL}/search`,
        note: "Always use full URLs from equipmentUrl, profileUrl, or searchCategoryUrl fields when recommending items.",
      },
      topRatedEquipment: rated.map((e) => ({
        title: e.title,
        dailyRateTnd: e.dailyRate,
        location: e.location,
        category: e.category.name,
        avgRating: e.avgRating,
        reviewCount: e.reviewCount,
        bookingsCount: e._count.bookings,
        equipmentUrl: equipmentLink(e.id),
        ownerName: e.owner.name,
        ownerVerified: e.owner.kycStatus === "APPROVED",
        ownerProfileUrl: ownerLink(e.owner.id),
        searchCategoryUrl: searchCategoryLink(e.category.slug),
      })),
      mostBookedEquipment: popular.map((e) => ({
        title: e.title,
        dailyRateTnd: e.dailyRate,
        location: e.location,
        bookingsCount: e._count.bookings,
        equipmentUrl: equipmentLink(e.id),
        ownerProfileUrl: ownerLink(e.owner.id),
      })),
      establishedOwners: ownersRanked,
      categories: categories.map((c) => ({
        name: c.name,
        slug: c.slug,
        description: c.description,
        searchUrl: searchCategoryLink(c.slug),
      })),
      userRecentBookings: renterBookings,
    },
    null,
    2
  );
}

async function buildOwnerContext(ownerId: string): Promise<string> {
  const [dashboard, listings, bookings] = await Promise.all([
    ownerDashboardService.getOwnerDashboard(ownerId),
    prisma.equipment.findMany({
      where: { ownerId },
      select: {
        id: true,
        title: true,
        dailyRate: true,
        weeklyRate: true,
        isAvailable: true,
        approvalStatus: true,
        location: true,
        category: { select: { name: true } },
        _count: { select: { bookings: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    bookingService.getMyBookings(ownerId),
  ]);

  const pending = bookings.asOwner.filter((b) => b.status === BookingStatus.PENDING);
  const active = bookings.asOwner.filter((b) =>
    ["CONFIRMED", "PAID", "ACTIVE", "PICKUP_SCHEDULED", "IN_TRANSIT"].includes(b.status)
  );

  return JSON.stringify(
    {
      summary: dashboard.summary,
      listingsBreakdown: dashboard.listingsBreakdown,
      earningsByMonth: dashboard.earningsByMonth,
      bookingsByStatus: dashboard.bookingsByStatus,
      topEquipment: dashboard.topEquipment.map((e) => ({
        ...e,
        equipmentUrl: equipmentLink(e.id),
      })),
      equipmentByCategory: dashboard.equipmentByCategory,
      listings: listings.map((e) => ({
        id: e.id,
        title: e.title,
        dailyRateTnd: e.dailyRate,
        weeklyRateTnd: e.weeklyRate,
        isLive: e.approvalStatus === "APPROVED" && e.isAvailable,
        approvalStatus: e.approvalStatus,
        location: e.location,
        category: e.category.name,
        bookingsCount: e._count.bookings,
        editUrl: `${CLIENT_URL}/dashboard/listings?highlight=${e.id}`,
        publicUrl:
          e.approvalStatus === "APPROVED" ? equipmentLink(e.id) : null,
      })),
      pendingBookingRequests: pending.slice(0, 8).map((b) => ({
        id: b.id,
        renter: b.renter.name,
        equipment: b.equipment.title,
        totalTnd: b.totalPrice,
        start: b.startDate,
        end: b.endDate,
        manageUrl: `${CLIENT_URL}/dashboard/bookings`,
      })),
      activeRentals: active.length,
      dashboardUrls: {
        overview: `${CLIENT_URL}/dashboard`,
        bookings: `${CLIENT_URL}/dashboard/bookings`,
        earnings: `${CLIENT_URL}/dashboard/earnings`,
        listings: `${CLIENT_URL}/dashboard/listings`,
        newListing: `${CLIENT_URL}/equipment/new`,
      },
    },
    null,
    2
  );
}

const RENTER_SYSTEM = `You are Ekri's rental assistant for renters in Tunisia. You help users discover quality equipment, trusted owners, and popular categories.

Rules:
- Use ONLY the JSON context data for facts about listings, owners, prices, and ratings.
- When recommending equipment or owners, include markdown links using the exact URLs from context (equipmentUrl, ownerProfileUrl, searchCategoryUrl, profileUrl).
- Format links like: [Equipment title](equipmentUrl) or [Owner name](profileUrl).
- Compare options: quality (ratings/reviews), popularity (bookingsCount), price (dailyRateTnd), location, verified owners.
- Be concise, friendly, and actionable. Use bullet lists for comparisons.
- If data is empty, suggest browsing ${CLIENT_URL}/search and filtering by category.
- Do not invent listings, prices, or owners not in context.
- Do not share private emails or internal admin data.`;

const OWNER_SYSTEM = `You are Ekri's AI business coach for equipment owners in Tunisia. You help owners grow revenue, manage listings, pricing, and bookings.

Rules:
- Use ONLY the JSON context for their stats, listings, earnings, and bookings.
- Give practical advice on: pricing (daily/weekly rates vs market), listing visibility (isLive), pending approvals, responding to booking requests, earnings trends, month-over-month change, top performers, rejected/pending listings.
- Include markdown links to dashboard pages from dashboardUrls and listing publicUrl/editUrl when relevant.
- Format links like: [My earnings](url).
- Use clear structure: ## for main sections, ### for subsections, bullet lists with "- ". Use **bold** for key numbers and listing names—not raw markdown symbols without pairing.
- Prioritize urgent items: pendingBookingRequests, pendingPayout, listings pending review.
- Be specific with numbers from summary and earningsByMonth.
- Do not invent metrics. If context is sparse, suggest concrete next steps (complete KYC, add photos, adjust rates).
- Do not execute actions—only advise.`;

export async function chatRenter(userId: string, input: AssistantChatInput): Promise<string> {
  const language = input.language ?? "en";
  const context = await buildRenterContext(userId);
  const system = `${languageRule(language)}\n\n${RENTER_SYSTEM}\n\n--- LIVE MARKETPLACE DATA ---\n${context}`;
  return callClaude(system, input.messages);
}

export async function chatOwner(
  userId: string,
  role: Role,
  input: AssistantChatInput
): Promise<string> {
  if (role !== Role.OWNER && role !== Role.BOTH && role !== Role.ADMIN) {
    throw new ForbiddenError("AI owner coach is only available for equipment owners");
  }
  const language = input.language ?? "en";
  const context = await buildOwnerContext(userId);
  const system = `${languageRule(language)}\n\n${OWNER_SYSTEM}\n\n--- YOUR BUSINESS DATA ---\n${context}`;
  return callClaude(system, input.messages);
}

export async function getOwnerSuggestions(
  userId: string,
  role: Role,
  language: AssistantLanguage = "en"
): Promise<string[]> {
  if (role !== Role.OWNER && role !== Role.BOTH && role !== Role.ADMIN) {
    throw new ForbiddenError("AI suggestions are only available for equipment owners");
  }

  if (!isClaudeConfigured()) {
    return OWNER_SUGGESTION_FALLBACKS[language];
  }

  const langName = LANGUAGE_NAMES[language];
  const context = await buildOwnerContext(userId);
  const reply = await callClaude(
    `${languageRule(language)}\n\n${OWNER_SYSTEM}\n\nReturn exactly 4 short suggestion prompts (one line each) in ${langName} that the owner could ask you, based on their data. Output ONLY a JSON array of strings, no markdown.`,
    [{ role: "user", content: `Data:\n${context}` }]
  );

  try {
    const parsed = JSON.parse(reply) as unknown;
    if (Array.isArray(parsed) && parsed.every((s) => typeof s === "string")) {
      const items = parsed.slice(0, 4);
      return items.length > 0 ? items : OWNER_SUGGESTION_FALLBACKS[language];
    }
  } catch {
    /* fall through */
  }

  const lines = reply
    .split("\n")
    .map((l) => l.replace(/^[-*\d.]+\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 4);

  return lines.length ? lines : OWNER_SUGGESTION_FALLBACKS[language];
}

export function assistantStatus(): { enabled: boolean; model: string } {
  return { enabled: isClaudeConfigured(), model: DEFAULT_MODEL };
}
