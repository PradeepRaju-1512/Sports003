var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import "dotenv/config";
import path2 from "path";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import multer2 from "multer";
import { createServer as createViteServer } from "vite";

// server/db/index.ts
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

// server/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  announcements: () => announcements,
  auctionBids: () => auctionBids,
  auctionFranchises: () => auctionFranchises,
  auctionPlayers: () => auctionPlayers,
  auctionRegistrations: () => auctionRegistrations,
  auctionRounds: () => auctionRounds,
  auctionTeamRegistrations: () => auctionTeamRegistrations,
  auctions: () => auctions,
  auditLogs: () => auditLogs,
  batchHostelPoints: () => batchHostelPoints,
  bookings: () => bookings,
  captainWatchlists: () => captainWatchlists,
  clubActivities: () => clubActivities,
  clubMemberships: () => clubMemberships,
  contingents: () => contingents,
  equipment: () => equipment,
  equipmentTransactions: () => equipmentTransactions,
  facilities: () => facilities,
  facilityConfig: () => facilityConfig,
  fantasyEntries: () => fantasyEntries,
  fantasyLeagues: () => fantasyLeagues,
  idempotencyKeys: () => idempotencyKeys,
  interIiitTrials: () => interIiitTrials,
  matchEvents: () => matchEvents,
  matches: () => matches,
  notifications: () => notifications,
  pickupGames: () => pickupGames,
  pickupParticipants: () => pickupParticipants,
  playerMatchStats: () => playerMatchStats,
  playerProfiles: () => playerProfiles,
  roleRequests: () => roleRequests,
  roles: () => roles,
  rtmEligibility: () => rtmEligibility,
  siteSettings: () => siteSettings,
  sports: () => sports,
  sportsClubs: () => sportsClubs,
  standings: () => standings,
  teamRosters: () => teamRosters,
  teams: () => teams,
  tournamentMedia: () => tournamentMedia,
  tournamentSports: () => tournamentSports,
  tournaments: () => tournaments,
  userRoles: () => userRoles,
  users: () => users
});
import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  doublePrecision,
  uniqueIndex,
  index
} from "drizzle-orm/pg-core";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  college: text("college").notNull().default("IIITT"),
  rollNumber: text("roll_number"),
  batch: text("batch").notNull().default("1ST"),
  // 1ST | 2ND | 3RD | 4TH | MTECH | STAFF | FACULTY
  programType: text("program_type").notNull().default("BTECH"),
  // BTECH | MTECH
  currentSemester: integer("current_semester").notNull().default(1),
  lastIncrementedTerm: text("last_incremented_term"),
  isGraduated: boolean("is_graduated").notNull().default(false),
  gender: text("gender").notNull().default("BOYS"),
  // BOYS | GIRLS
  hostel: text("hostel"),
  avatarUrl: text("avatar_url"),
  qrCodeToken: text("qr_code_token").notNull().unique(),
  accountType: text("account_type").notNull().default("STUDENT"),
  // STUDENT | STAFF | FACULTY | SYSTEM
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var playerProfiles = pgTable("player_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").unique().references(() => users.id, { onDelete: "set null" }),
  displayName: text("display_name").notNull(),
  college: text("college").notNull().default("IIITT"),
  batch: text("batch").notNull(),
  programType: text("program_type").notNull().default("BTECH"),
  currentSemester: integer("current_semester").notNull().default(1),
  isGraduated: boolean("is_graduated").notNull().default(false),
  gender: text("gender").notNull().default("BOYS"),
  branch: text("branch"),
  rollNumber: text("roll_number"),
  bio: text("bio"),
  preferredSports: jsonb("preferred_sports").$type().notNull().default([]),
  avatarUrl: text("avatar_url"),
  visibility: text("visibility").notNull().default("PUBLIC"),
  // PUBLIC | IIITT_ONLY | PRIVATE
  isClaimed: boolean("is_claimed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  label: text("label").notNull(),
  level: integer("level").notNull(),
  description: text("description")
});
var userRoles = pgTable(
  "user_roles",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    roleCode: text("role_code").notNull(),
    clubId: integer("club_id"),
    batchScope: text("batch_scope"),
    // 1ST | 2ND | 3RD | 4TH | MTECH | ALL | null
    scopeLabel: text("scope_label"),
    // Optional metadata e.g. Boys | Girls | Track
    tournamentId: integer("tournament_id"),
    auctionId: integer("auction_id"),
    matchId: integer("match_id"),
    grantedBy: integer("granted_by").references(() => users.id, { onDelete: "set null" }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("idx_user_roles_user_active").on(t.userId, t.active)]
);
var roleRequests = pgTable(
  "role_requests",
  {
    id: serial("id").primaryKey(),
    requesterUserId: integer("requester_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    targetUserId: integer("target_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    requestedRole: text("requested_role").notNull(),
    // CLUB_SECRETARY | CLUB_COORDINATOR | MATCH_SCORER
    action: text("action").notNull().default("APPOINT"),
    // APPOINT | REMOVE
    clubId: integer("club_id"),
    batchScope: text("batch_scope"),
    scopeLabel: text("scope_label"),
    matchId: integer("match_id"),
    auctionId: integer("auction_id"),
    reason: text("reason"),
    status: text("status").notNull().default("PENDING"),
    // PENDING | APPROVED | REJECTED
    reviewedBy: integer("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewNotes: text("review_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true })
  },
  (t) => [index("idx_role_requests_status_created").on(t.status, t.createdAt)]
);
var sports = pgTable("sports", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  // football, cricket, volleyball, kho_kho, kabaddi, badminton, table_tennis, carrom, chess, throwball
  name: text("name").notNull(),
  category: text("category").notNull(),
  // OUTDOOR_TEAM | INDOOR
  isOfficialClub: boolean("is_official_club").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0)
});
var sportsClubs = pgTable("sports_clubs", {
  id: serial("id").primaryKey(),
  sportId: integer("sport_id").notNull().unique().references(() => sports.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  tagline: text("tagline"),
  description: text("description"),
  bannerUrl: text("banner_url").notNull(),
  practiceSchedule: text("practice_schedule"),
  inductionOpen: boolean("induction_open").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var clubMemberships = pgTable(
  "club_memberships",
  {
    id: serial("id").primaryKey(),
    clubId: integer("club_id").notNull().references(() => sportsClubs.id, { onDelete: "cascade" }),
    playerProfileId: integer("player_profile_id").notNull().references(() => playerProfiles.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("MEMBER"),
    // SECRETARY | COORDINATOR | MEMBER
    batchScope: text("batch_scope"),
    scopeLabel: text("scope_label"),
    // Optional metadata e.g. Boys | Girls | Open | Track
    status: text("status").notNull().default("APPLIED"),
    // APPLIED | TRIAL_ATTENDED | INDUCTED | REJECTED
    trialNotes: text("trial_notes"),
    evaluationScore: integer("evaluation_score"),
    evaluatedBy: integer("evaluated_by").references(() => users.id, { onDelete: "set null" }),
    approvedBy: integer("approved_by").references(() => users.id, { onDelete: "set null" }),
    inductedAt: timestamp("inducted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    uniqueIndex("uq_club_member_profile").on(t.clubId, t.playerProfileId),
    index("idx_club_memberships_profile_status").on(t.playerProfileId, t.status)
  ]
);
var clubActivities = pgTable(
  "club_activities",
  {
    id: serial("id").primaryKey(),
    clubId: integer("club_id").notNull().references(() => sportsClubs.id, { onDelete: "cascade" }),
    activityType: text("activity_type").notNull(),
    // PRACTICE | INDUCTION | MEETING | INTER_IIIT | EXTERNAL_MATCH | OTHER
    customTypeLabel: text("custom_type_label"),
    targetBatch: text("target_batch").notNull().default("ALL"),
    // 1ST | 2ND | 3RD | 4TH | MTECH | ALL
    category: text("category").notNull().default("OPEN"),
    // BOYS | GIRLS | OPEN
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    venue: text("venue").notNull(),
    notes: text("notes"),
    selectedSquadJson: jsonb("selected_squad_json").$type().notNull().default([]),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("idx_club_activities_club_time").on(t.clubId, t.scheduledAt)]
);
var tournaments = pgTable(
  "tournaments",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    academicYear: integer("academic_year").notNull(),
    semester: text("semester").notNull().default("ODD"),
    // ODD | EVEN | ANNUAL
    tournamentType: text("tournament_type").notNull().default("FLAGSHIP"),
    // FLAGSHIP | INTER_HOSTEL | OPEN | INTRA_CLUB | PROTHYMOS
    format: text("format").notNull().default("GROUP_KNOCKOUT"),
    // KNOCKOUT | LEAGUE | ROUND_ROBIN | GROUP_KNOCKOUT | BEST_OF_SERIES
    rosterMode: text("roster_mode").notNull().default("CAPTAIN_SUBMISSION"),
    // AUCTION | CAPTAIN_SUBMISSION
    splitMode: text("split_mode").notNull().default("COMBINED"),
    // COMBINED | SEPARATE_BOYS_GIRLS
    status: text("status").notNull().default("ACTIVE"),
    // DRAFT | ACTIVE | COMPLETED | ARCHIVED
    completenessStatus: text("completeness_status").notNull().default("COMPLETE"),
    // RESULTS_ONLY | PARTIAL | COMPLETE | VERIFIED
    isCurrent: boolean("is_current").notNull().default(false),
    posterUrl: text("poster_url"),
    description: text("description"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    verifiedBy: integer("verified_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("idx_tournaments_status_year").on(t.status, t.academicYear)]
);
var tournamentSports = pgTable(
  "tournament_sports",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
    sportId: integer("sport_id").notNull().references(() => sports.id, { onDelete: "cascade" }),
    format: text("format").notNull().default("GROUP_KNOCKOUT"),
    minSquadSize: integer("min_squad_size").notNull().default(1),
    maxSquadSize: integer("max_squad_size").notNull().default(15),
    registrationDeadline: timestamp("registration_deadline", { withTimezone: true }),
    winnerTeamId: integer("winner_team_id"),
    runnerUp1TeamId: integer("runner_up_1_team_id"),
    runnerUp2TeamId: integer("runner_up_2_team_id"),
    configJson: jsonb("config_json").$type().notNull().default({})
  },
  (t) => [uniqueIndex("uq_tournament_sport").on(t.tournamentId, t.sportId)]
);
var teams = pgTable(
  "teams",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
    sportId: integer("sport_id").notNull().references(() => sports.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    shortCode: text("short_code").notNull(),
    accentColor: text("accent_color").notNull().default("#B91C1C"),
    logoUrl: text("logo_url"),
    captainUserId: integer("captain_user_id").references(() => users.id, { onDelete: "set null" }),
    franchiseId: integer("franchise_id"),
    track: text("track").notNull().default("COMBINED"),
    // COMBINED | BOYS | GIRLS
    submissionStatus: text("submission_status").notNull().default("DRAFT"),
    // DRAFT | SUBMITTED | APPROVED | CHANGES_REQUESTED | REJECTED | LOCKED
    reviewNotes: text("review_notes"),
    reviewedBy: integer("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("idx_teams_tournament_sport").on(t.tournamentId, t.sportId),
    index("idx_teams_captain").on(t.captainUserId)
  ]
);
var teamRosters = pgTable(
  "team_rosters",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
    playerProfileId: integer("player_profile_id").notNull().references(() => playerProfiles.id, { onDelete: "cascade" }),
    playingRole: text("playing_role"),
    jerseyNumber: integer("jersey_number"),
    playerClass: text("player_class").notNull().default("OPEN"),
    // CLUB | NON_CLUB | OPEN
    soldPrice: integer("sold_price"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [uniqueIndex("uq_team_player").on(t.teamId, t.playerProfileId)]
);
var standings = pgTable(
  "standings",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
    sportId: integer("sport_id").notNull().references(() => sports.id, { onDelete: "cascade" }),
    teamId: integer("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
    played: integer("played").notNull().default(0),
    won: integer("won").notNull().default(0),
    lost: integer("lost").notNull().default(0),
    drawn: integer("drawn").notNull().default(0),
    points: integer("points").notNull().default(0),
    nrr: doublePrecision("nrr").notNull().default(0),
    goalDiff: integer("goal_diff").notNull().default(0),
    goalsFor: integer("goals_for").notNull().default(0),
    goalsAgainst: integer("goals_against").notNull().default(0),
    setsWon: integer("sets_won").notNull().default(0),
    setsLost: integer("sets_lost").notNull().default(0),
    rank: integer("rank").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [uniqueIndex("uq_standing_team").on(t.tournamentId, t.sportId, t.teamId)]
);
var matches = pgTable(
  "matches",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
    sportId: integer("sport_id").notNull().references(() => sports.id, { onDelete: "cascade" }),
    roundLabel: text("round_label").notNull().default("League Match"),
    // Opening Match | Group A | Quarter-Final | Semi-Final | Final
    matchOrder: integer("match_order").notNull().default(1),
    track: text("track").notNull().default("COMBINED"),
    // COMBINED | BOYS | GIRLS
    teamAId: integer("team_a_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
    teamBId: integer("team_b_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
    venue: text("venue").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("UPCOMING"),
    // UPCOMING | LIVE | COMPLETED
    scorerUserId: integer("scorer_user_id").references(() => users.id, { onDelete: "set null" }),
    lineupAJson: jsonb("lineup_a_json").$type().notNull().default([]),
    lineupBJson: jsonb("lineup_b_json").$type().notNull().default([]),
    configJson: jsonb("config_json").$type().notNull().default({}),
    scoreSummary: text("score_summary"),
    resultNote: text("result_note"),
    winnerTeamId: integer("winner_team_id").references(() => teams.id, { onDelete: "set null" }),
    version: integer("version").notNull().default(1),
    verifiedBy: integer("verified_by").references(() => users.id, { onDelete: "set null" }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("idx_matches_status_time").on(t.status, t.scheduledAt),
    index("idx_matches_tournament_sport").on(t.tournamentId, t.sportId),
    index("idx_matches_scorer").on(t.scorerUserId)
  ]
);
var matchEvents = pgTable(
  "match_events",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    matchClockMs: integer("match_clock_ms"),
    eventType: text("event_type").notNull(),
    payloadJson: jsonb("payload_json").$type().notNull(),
    voided: boolean("voided").notNull().default(false),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [uniqueIndex("uq_match_event_seq").on(t.matchId, t.seq)]
);
var playerMatchStats = pgTable(
  "player_match_stats",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
    playerProfileId: integer("player_profile_id").notNull().references(() => playerProfiles.id, { onDelete: "cascade" }),
    teamId: integer("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
    sportId: integer("sport_id").notNull().references(() => sports.id, { onDelete: "cascade" }),
    statsJson: jsonb("stats_json").$type().notNull().default({}),
    isMvp: boolean("is_mvp").notNull().default(false),
    verified: boolean("verified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [uniqueIndex("uq_player_match_stat").on(t.matchId, t.playerProfileId)]
);
var tournamentMedia = pgTable("tournament_media", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  mediaType: text("media_type").notNull().default("IMAGE"),
  // IMAGE | PDF | SCORECARD_SCAN
  fileUrl: text("file_url").notNull(),
  uploadedBy: integer("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var auctions = pgTable("auctions", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").references(() => tournaments.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  seasonYear: integer("season_year").notNull(),
  status: text("status").notNull().default("DRAFT"),
  // DRAFT | REGISTRATION_OPEN | FROZEN | LIVE | COMPLETED | PUBLISHED
  registrationDeadline: timestamp("registration_deadline", { withTimezone: true }),
  clubBasePrice: integer("club_base_price").notNull().default(500),
  nonClubBasePrice: integer("non_club_base_price").notNull().default(200),
  sportBasePricesJson: jsonb("sport_base_prices_json").$type().notNull().default({}),
  defaultIncrement: integer("default_increment").notNull().default(100),
  jumpIncrement: integer("jump_increment").notNull().default(500),
  bidSlabsJson: jsonb("bid_slabs_json").$type().notNull().default([
    { upTo: 2e3, increment: 100 },
    { upTo: 5e3, increment: 250 },
    { upTo: null, increment: 500 }
  ]),
  activeSportId: integer("active_sport_id").references(() => sports.id, { onDelete: "set null" }),
  splitMode: text("split_mode").notNull().default("COMBINED"),
  // COMBINED | SEPARATE_BOYS_GIRLS
  activeTrack: text("active_track").notNull().default("COMBINED"),
  // COMBINED | BOYS | GIRLS
  activeRoundId: integer("active_round_id"),
  activePlayerId: integer("active_player_id"),
  projectorMode: text("projector_mode").notNull().default("STAGE"),
  // STAGE | SOLD | UNSOLD | STANDINGS | PAUSED
  projectorPaused: boolean("projector_paused").notNull().default(false),
  rtmEnabled: boolean("rtm_enabled").notNull().default(false),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var auctionRounds = pgTable("auction_rounds", {
  id: serial("id").primaryKey(),
  auctionId: integer("auction_id").notNull().references(() => auctions.id, { onDelete: "cascade" }),
  sportId: integer("sport_id").references(() => sports.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  roundOrder: integer("round_order").notNull().default(1),
  roundType: text("round_type").notNull().default("MAIN"),
  // MAIN | ACCELERATED | UNSOLD | RTM
  active: boolean("active").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var auctionFranchises = pgTable(
  "auction_franchises",
  {
    id: serial("id").primaryKey(),
    auctionId: integer("auction_id").notNull().references(() => auctions.id, { onDelete: "cascade" }),
    sportId: integer("sport_id").notNull().references(() => sports.id, { onDelete: "cascade" }),
    slotNumber: integer("slot_number").notNull(),
    // 1..8 for keyboard hotkeys
    track: text("track").notNull().default("COMBINED"),
    // COMBINED | BOYS | GIRLS
    name: text("name").notNull(),
    shortCode: text("short_code").notNull(),
    accentColor: text("accent_color").notNull().default("#D97706"),
    logoUrl: text("logo_url"),
    captainUserId: integer("captain_user_id").references(() => users.id, { onDelete: "set null" }),
    tournamentTeamId: integer("tournament_team_id").references(() => teams.id, { onDelete: "set null" }),
    startingPurse: integer("starting_purse").notNull().default(2e4),
    remainingPurse: integer("remaining_purse").notNull().default(2e4),
    minSquad: integer("min_squad").notNull().default(11),
    maxSquad: integer("max_squad").notNull().default(15),
    minClubQuota: integer("min_club_quota").notNull().default(3),
    minNonClubQuota: integer("min_non_club_quota").notNull().default(4),
    status: text("status").notNull().default("APPROVED"),
    // PENDING_APPROVAL | APPROVED | CHANGES_REQUESTED | REJECTED
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("idx_auction_franchises_scope").on(t.auctionId, t.sportId, t.status)]
);
var auctionTeamRegistrations = pgTable("auction_team_registrations", {
  id: serial("id").primaryKey(),
  auctionId: integer("auction_id").notNull().references(() => auctions.id, { onDelete: "cascade" }),
  sportId: integer("sport_id").notNull().references(() => sports.id, { onDelete: "cascade" }),
  submittedByUserId: integer("submitted_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  teamName: text("team_name").notNull(),
  shortCode: text("short_code").notNull(),
  track: text("track").notNull().default("COMBINED"),
  // COMBINED | BOYS | GIRLS
  accentColor: text("accent_color").notNull().default("#D97706"),
  captainUserId: integer("captain_user_id").references(() => users.id, { onDelete: "set null" }),
  memberUserIdsJson: jsonb("member_user_ids_json").$type().notNull().default([]),
  rosterNotes: text("roster_notes"),
  status: text("status").notNull().default("PENDING_APPROVAL"),
  // PENDING_APPROVAL | APPROVED | CHANGES_REQUESTED | REJECTED
  franchiseId: integer("franchise_id").references(() => auctionFranchises.id, {
    onDelete: "set null"
  }),
  reviewedByUserId: integer("reviewed_by_user_id").references(() => users.id, {
    onDelete: "set null"
  }),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true })
});
var auctionRegistrations = pgTable(
  "auction_registrations",
  {
    id: serial("id").primaryKey(),
    auctionId: integer("auction_id").notNull().references(() => auctions.id, { onDelete: "cascade" }),
    sportId: integer("sport_id").notNull().references(() => sports.id, { onDelete: "cascade" }),
    roundId: integer("round_id").references(() => auctionRounds.id, { onDelete: "set null" }),
    track: text("track").notNull().default("COMBINED"),
    // COMBINED | BOYS | GIRLS
    playerProfileId: integer("player_profile_id").notNull().references(() => playerProfiles.id, { onDelete: "cascade" }),
    positionsJson: jsonb("positions_json").$type().notNull().default([]),
    playerClass: text("player_class").notNull().default("NON_CLUB"),
    // CLUB | NON_CLUB
    tier: text("tier").notNull().default("STANDARD"),
    // MARQUEE | TIER_1 | STANDARD
    basePrice: integer("base_price").notNull().default(200),
    experience: text("experience"),
    achievements: text("achievements"),
    photoUrl: text("photo_url"),
    status: text("status").notNull().default("ELIGIBLE"),
    // REGISTERED | ELIGIBLE | IN_AUCTION | SOLD | UNSOLD | INELIGIBLE
    soldFranchiseId: integer("sold_franchise_id").references(() => auctionFranchises.id, {
      onDelete: "set null"
    }),
    soldPrice: integer("sold_price"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    uniqueIndex("uq_auction_sport_player").on(t.auctionId, t.sportId, t.playerProfileId),
    index("idx_auction_regs_scope").on(t.auctionId, t.sportId, t.status)
  ]
);
var auctionPlayers = auctionRegistrations;
var auctionBids = pgTable(
  "auction_bids",
  {
    id: serial("id").primaryKey(),
    auctionId: integer("auction_id").notNull().references(() => auctions.id, { onDelete: "cascade" }),
    sportId: integer("sport_id").notNull().references(() => sports.id, { onDelete: "cascade" }),
    auctionPlayerId: integer("auction_player_id").notNull().references(() => auctionRegistrations.id, { onDelete: "cascade" }),
    franchiseId: integer("franchise_id").references(() => auctionFranchises.id, {
      onDelete: "set null"
    }),
    amount: integer("amount").notNull(),
    bidType: text("bid_type").notNull(),
    // INCREMENT | JUMP | CUSTOM | RTM | SOLD | UNSOLD
    undone: boolean("undone").notNull().default(false),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("idx_auction_bids_player_undone_id").on(t.auctionPlayerId, t.undone, t.id)]
);
var rtmEligibility = pgTable("rtm_eligibility", {
  id: serial("id").primaryKey(),
  seasonYear: integer("season_year").notNull(),
  sportId: integer("sport_id").notNull().references(() => sports.id, { onDelete: "cascade" }),
  playerProfileId: integer("player_profile_id").notNull().references(() => playerProfiles.id, { onDelete: "cascade" }),
  previousFranchiseId: integer("previous_franchise_id").references(() => auctionFranchises.id, {
    onDelete: "set null"
  }),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var captainWatchlists = pgTable(
  "captain_watchlists",
  {
    id: serial("id").primaryKey(),
    franchiseId: integer("franchise_id").notNull().references(() => auctionFranchises.id, { onDelete: "cascade" }),
    auctionPlayerId: integer("auction_player_id").notNull().references(() => auctionRegistrations.id, { onDelete: "cascade" }),
    priorityNote: text("priority_note"),
    maxTargetBid: integer("max_target_bid")
  },
  (t) => [uniqueIndex("uq_watchlist_entry").on(t.franchiseId, t.auctionPlayerId)]
);
var facilities = pgTable("facilities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  sportId: integer("sport_id").references(() => sports.id, { onDelete: "set null" }),
  status: text("status").notNull().default("OPEN"),
  // OPEN | OCCUPIED | CLOSED | MAINTENANCE | WEATHER_CLOSURE
  location: text("location"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var facilityConfig = pgTable("facility_config", {
  id: serial("id").primaryKey(),
  facilityId: integer("facility_id").notNull().unique().references(() => facilities.id, { onDelete: "cascade" }),
  bookingMode: text("booking_mode").notNull().default("DIRECT_BOOKING"),
  // DIRECT_BOOKING | APPROVAL_REQUIRED | STAFF_MANAGED | CAPACITY_BASED
  maxCapacity: integer("max_capacity").notNull().default(1),
  slotDurationMins: integer("slot_duration_mins").notNull().default(60),
  dailyUserLimit: integer("daily_user_limit").notNull().default(1),
  noShowBanHours: integer("no_show_ban_hours").notNull().default(48)
});
var bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  facilityId: integer("facility_id").notNull().references(() => facilities.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clubId: integer("club_id").references(() => sportsClubs.id, { onDelete: "set null" }),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("APPROVED"),
  // PENDING_APPROVAL | APPROVED | REJECTED | CHECKED_IN | COMPLETED | CANCELLED | NO_SHOW
  notes: text("notes"),
  approvedBy: integer("approved_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var equipment = pgTable("equipment", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sportId: integer("sport_id").references(() => sports.id, { onDelete: "set null" }),
  itemType: text("item_type").notNull().default("TRACKED_ASSET"),
  // TRACKED_ASSET | BULK_CONSUMABLE
  qrCode: text("qr_code").unique(),
  totalQty: integer("total_qty").notNull().default(1),
  availableQty: integer("available_qty").notNull().default(1),
  condition: text("condition").notNull().default("AVAILABLE"),
  // AVAILABLE | ISSUED | DAMAGED | LOST | MAINTENANCE
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var equipmentTransactions = pgTable("equipment_transactions", {
  id: serial("id").primaryKey(),
  equipmentId: integer("equipment_id").notNull().references(() => equipment.id, { onDelete: "cascade" }),
  borrowerUserId: integer("borrower_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  issuedBy: integer("issued_by").references(() => users.id, { onDelete: "set null" }),
  qty: integer("qty").notNull().default(1),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  returnedAt: timestamp("returned_at", { withTimezone: true }),
  returnCondition: text("return_condition"),
  notes: text("notes")
});
var pickupGames = pgTable("pickup_games", {
  id: serial("id").primaryKey(),
  hostUserId: integer("host_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sportId: integer("sport_id").notNull().references(() => sports.id, { onDelete: "cascade" }),
  venue: text("venue").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  maxPlayers: integer("max_players").notNull(),
  skillLevel: text("skill_level").notNull().default("OPEN"),
  preferredPosition: text("preferred_position"),
  requiresApproval: boolean("requires_approval").notNull().default(false),
  status: text("status").notNull().default("OPEN"),
  // OPEN | FULL | EXPIRED | CANCELLED
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var pickupParticipants = pgTable(
  "pickup_participants",
  {
    id: serial("id").primaryKey(),
    pickupGameId: integer("pickup_game_id").notNull().references(() => pickupGames.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("JOINED"),
    // JOINED | WAITLISTED | PENDING
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [uniqueIndex("uq_pickup_user").on(t.pickupGameId, t.userId)]
);
var batchHostelPoints = pgTable("batch_hostel_points", {
  id: serial("id").primaryKey(),
  academicYear: integer("academic_year").notNull(),
  entityType: text("entity_type").notNull(),
  // BATCH | HOSTEL
  entityName: text("entity_name").notNull(),
  goldMedals: integer("gold_medals").notNull().default(0),
  silverMedals: integer("silver_medals").notNull().default(0),
  bronzeMedals: integer("bronze_medals").notNull().default(0),
  totalPoints: integer("total_points").notNull().default(0)
});
var fantasyLeagues = pgTable("fantasy_leagues", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  budgetLimit: integer("budget_limit").notNull().default(100),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var fantasyEntries = pgTable("fantasy_entries", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").notNull().references(() => fantasyLeagues.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  selectedPlayerIds: jsonb("selected_player_ids").$type().notNull().default([]),
  captainPlayerId: integer("captain_player_id"),
  totalPoints: doublePrecision("total_points").notNull().default(0),
  lockedAt: timestamp("locked_at", { withTimezone: true })
});
var interIiitTrials = pgTable("inter_iiit_trials", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  sportId: integer("sport_id").notNull().references(() => sports.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  venue: text("venue").notNull(),
  eligibilityNotes: text("eligibility_notes"),
  status: text("status").notNull().default("OPEN"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var contingents = pgTable("contingents", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  sportId: integer("sport_id").notNull().references(() => sports.id, { onDelete: "cascade" }),
  hostInstitute: text("host_institute").notNull(),
  status: text("status").notNull().default("TRIALS"),
  // TRIALS | SHORTLISTED | FACULTY_APPROVED | COMPLETED
  approvedByFacultyId: integer("approved_by_faculty_id").references(() => users.id, {
    onDelete: "set null"
  }),
  travelDetails: text("travel_details"),
  accommodationDetails: text("accommodation_details"),
  medalResult: text("medal_result"),
  rosterJson: jsonb("roster_json").$type().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var announcements = pgTable(
  "announcements",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    isUrgentBanner: boolean("is_urgent_banner").notNull().default(false),
    // If true, title MUST be <= 5 words
    active: boolean("active").notNull().default(true),
    clubId: integer("club_id").references(() => sportsClubs.id, { onDelete: "cascade" }),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("idx_announcements_active_urgent").on(t.active, t.isUrgentBanner)]
);
var notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    message: text("message").notNull(),
    linkUrl: text("link_url"),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("idx_notifications_user_read").on(t.userId, t.isRead)]
);
var siteSettings = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  valueJson: jsonb("value_json").$type().notNull(),
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
var auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    actorUserId: integer("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    metadataJson: jsonb("metadata_json").$type().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("idx_audit_entity").on(t.entityType, t.entityId)]
);
var idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: serial("id").primaryKey(),
    scope: text("scope").notNull(),
    key: text("key").notNull(),
    actorUserId: integer("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    statusCode: integer("status_code").notNull(),
    responseJson: jsonb("response_json").$type().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [uniqueIndex("uq_idempotency_scope_key").on(t.scope, t.key)]
);

// server/db/index.ts
var { Pool } = pg;
var databaseUrl = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/iiitt_sports";
var isLocalhost = databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1") || databaseUrl.includes("::1");
var pool = new Pool({
  connectionString: databaseUrl,
  ssl: isLocalhost ? false : { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 3e4,
  connectionTimeoutMillis: 1e4
});
var db = drizzle(pool, { schema: schema_exports });
async function verifyDatabaseConnection() {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    return true;
  } catch (err) {
    console.error("[DB] Connection verification failed:", err.message);
    if (process.env.NODE_ENV === "production") {
      console.error("[DB] Fatal: Exiting because NODE_ENV=production requires live PostgreSQL.");
      process.exit(1);
    }
    return false;
  }
}

// server/middleware/auth.ts
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { eq, and } from "drizzle-orm";
var SESSION_COOKIE_NAME = "iiitt_session";
var OAUTH_STATE_COOKIE_NAME = "iiitt_oauth_state";
var EPHEMERAL_DEV_SECRET = crypto.randomBytes(32).toString("hex");
function isDemoSwitcherEnabled() {
  return process.env.ENABLE_DEMO_SWITCHER === "true" && process.env.NODE_ENV !== "production";
}
function isTestLoginEnabled() {
  return process.env.ENABLE_DEMO_SWITCHER === "true" || process.env.NODE_ENV !== "production";
}
function isGoogleOAuthConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()
  );
}
function getSessionSecret() {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is missing or weak in production.");
  }
  return configured || EPHEMERAL_DEV_SECRET;
}
function signSessionToken(userId) {
  return jwt.sign({ uid: userId }, getSessionSecret(), { expiresIn: "7d" });
}
function setSessionCookie(res, userId) {
  const token = signSessionToken(userId);
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1e3,
    path: "/"
  });
}
function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
}
function setOAuthStateCookie(res, state) {
  res.cookie(OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60 * 1e3,
    path: "/api/auth/google"
  });
}
function clearOAuthStateCookie(res) {
  res.clearCookie(OAUTH_STATE_COOKIE_NAME, { path: "/api/auth/google" });
}
async function loadActorById(userId) {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return null;
  const activeRoles = await db.select({
    id: userRoles.id,
    roleCode: userRoles.roleCode,
    clubId: userRoles.clubId,
    batchScope: userRoles.batchScope,
    tournamentId: userRoles.tournamentId,
    auctionId: userRoles.auctionId,
    matchId: userRoles.matchId
  }).from(userRoles).where(and(eq(userRoles.userId, u.id), eq(userRoles.active, true)));
  const [profile] = await db.select({ id: playerProfiles.id }).from(playerProfiles).where(eq(playerProfiles.userId, u.id)).limit(1);
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    college: u.college ?? "IIITT",
    rollNumber: u.rollNumber,
    batch: u.batch,
    programType: u.programType ?? "BTECH",
    currentSemester: u.currentSemester ?? 1,
    isGraduated: Boolean(u.isGraduated),
    gender: u.gender ?? "BOYS",
    hostel: u.hostel,
    avatarUrl: u.avatarUrl,
    qrCodeToken: u.qrCodeToken,
    accountType: u.accountType,
    onboardingComplete: u.onboardingComplete,
    playerProfileId: profile?.id ?? null,
    roles: activeRoles
  };
}
async function findOrProvisionGoogleUser(input) {
  const email = input.email.trim().toLowerCase();
  const isIIITT = email.endsWith("@iiitt.ac.in");
  let [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!existing && !isIIITT) {
    return null;
  }
  if (!existing) {
    const localPart = email.split("@")[0];
    const inferredRoll = /^\d{6,}$/.test(localPart) ? localPart : null;
    const qrToken = `IIITT-QR-${inferredRoll ?? crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    existing = await db.transaction(async (tx) => {
      const [created] = await tx.insert(users).values({
        email,
        name: input.name.trim() || localPart,
        rollNumber: inferredRoll,
        batch: "1ST",
        avatarUrl: input.avatarUrl ?? null,
        qrCodeToken: qrToken,
        accountType: "STUDENT",
        onboardingComplete: false
      }).returning();
      await tx.insert(userRoles).values({
        userId: created.id,
        roleCode: "STUDENT",
        grantedBy: created.id
      });
      if (inferredRoll) {
        const [unclaimed] = await tx.select().from(playerProfiles).where(eq(playerProfiles.rollNumber, inferredRoll)).limit(1);
        if (unclaimed && !unclaimed.userId) {
          await tx.update(playerProfiles).set({ userId: created.id, isClaimed: true }).where(eq(playerProfiles.id, unclaimed.id));
          return created;
        }
      }
      await tx.insert(playerProfiles).values({
        userId: created.id,
        displayName: created.name,
        batch: created.batch,
        rollNumber: inferredRoll,
        avatarUrl: created.avatarUrl,
        visibility: "PUBLIC",
        isClaimed: true
      });
      return created;
    });
  }
  return loadActorById(existing.id);
}
async function attachSession(req, _res, next) {
  req.actor = null;
  try {
    const token = req.cookies?.[SESSION_COOKIE_NAME];
    if (!token || typeof token !== "string") {
      return next();
    }
    const decoded = jwt.verify(token, getSessionSecret());
    if (decoded && typeof decoded.uid === "number") {
      req.actor = await loadActorById(decoded.uid);
    }
  } catch {
    req.actor = null;
  }
  next();
}
function requireAuth(req, res, next) {
  if (!req.actor) {
    res.status(401).json({ error: "Authentication required. Please sign in with your @iiitt.ac.in account." });
    return;
  }
  next();
}

// server/lib/sse.ts
var MAX_SSE_PER_USER = 4;
var MAX_SSE_PER_IP = 10;
var clients = /* @__PURE__ */ new Set();
var nextClientId = 1;
function registerSseStream(req, res, userId) {
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  if (userId !== null) {
    const userClients = Array.from(clients).filter((c) => c.userId === userId);
    while (userClients.length >= MAX_SSE_PER_USER) {
      const oldest = userClients.shift();
      if (oldest) {
        oldest.cleanup();
        try {
          oldest.res.end();
        } catch {
        }
      }
    }
  } else {
    const ipClients = Array.from(clients).filter((c) => c.userId === null && c.ip === ip);
    while (ipClients.length >= MAX_SSE_PER_IP) {
      const oldest = ipClients.shift();
      if (oldest) {
        oldest.cleanup();
        try {
          oldest.res.end();
        } catch {
        }
      }
    }
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  req.socket?.setKeepAlive?.(true);
  req.socket?.setNoDelay?.(true);
  res.flushHeaders?.();
  const heartbeat = setInterval(() => {
    try {
      res.write(`event: HEARTBEAT
data: ${JSON.stringify({ ts: Date.now() })}

`);
    } catch {
      cleanup();
    }
  }, 25e3);
  const client = {
    id: nextClientId++,
    res,
    userId,
    ip,
    cleanup: () => {
    }
  };
  const cleanup = () => {
    clearInterval(heartbeat);
    clients.delete(client);
  };
  client.cleanup = cleanup;
  clients.add(client);
  res.write(`event: CONNECTED
data: ${JSON.stringify({ ok: true, ts: Date.now() })}

`);
  req.on("close", cleanup);
  req.on("error", cleanup);
}
function broadcastSse(eventType, payload, targetUserIds) {
  const data = `event: ${eventType}
data: ${JSON.stringify(payload)}

`;
  for (const client of clients) {
    if (targetUserIds && (client.userId === null || !targetUserIds.includes(client.userId))) {
      continue;
    }
    try {
      client.res.write(data);
    } catch {
      client.cleanup();
    }
  }
}
function closeAllSseStreams() {
  for (const client of clients) {
    client.cleanup();
    try {
      client.res.end();
    } catch {
    }
  }
  clients.clear();
}

// server/lib/http.ts
import { and as and2, eq as eq2 } from "drizzle-orm";
function asyncHandler(fn) {
  return (req, res, next) => {
    try {
      const maybePromise = fn(req, res, next);
      if (maybePromise && typeof maybePromise.catch === "function") {
        maybePromise.catch(next);
      }
    } catch (err) {
      next(err);
    }
  };
}
function wrapAsyncRouter(router10) {
  const methods = ["get", "post", "put", "patch", "delete"];
  for (const method of methods) {
    const orig = router10[method].bind(router10);
    router10[method] = (path3, ...handlers) => {
      const wrapped = handlers.map(
        (h) => typeof h === "function" && h.length < 4 ? asyncHandler(h) : h
      );
      return orig(path3, ...wrapped);
    };
  }
  return router10;
}
function parsePositiveIntId(raw) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}
function extractIdempotencyKey(req) {
  const headerKey = req.header("X-Idempotency-Key");
  const bodyKey = req.body && typeof req.body === "object" ? req.body.idempotencyKey : void 0;
  const raw = typeof headerKey === "string" && headerKey.trim() ? headerKey.trim() : typeof bodyKey === "string" && bodyKey.trim() ? bodyKey.trim() : null;
  if (!raw || raw.length < 4 || raw.length > 120) return null;
  return raw;
}
async function findIdempotencyRecord(tx, scope, key) {
  const [existing] = await tx.select({
    statusCode: idempotencyKeys.statusCode,
    responseJson: idempotencyKeys.responseJson
  }).from(idempotencyKeys).where(and2(eq2(idempotencyKeys.scope, scope), eq2(idempotencyKeys.key, key))).limit(1);
  return existing ?? null;
}
async function saveIdempotencyRecord(tx, input) {
  await tx.insert(idempotencyKeys).values({
    scope: input.scope,
    key: input.key,
    actorUserId: input.actorUserId,
    statusCode: input.statusCode,
    responseJson: input.responseJson
  }).onConflictDoNothing();
}

// server/lib/security.ts
var WEAK_SECRET_PATTERNS = [
  "change-me",
  "changeme",
  "replace_with",
  "secret",
  "default",
  "example",
  "password",
  "iiitt",
  "placeholder",
  "12345678"
];
function isWeakSessionSecret(secret) {
  const trimmed = (secret || "").trim();
  if (trimmed.length < 32) return true;
  const lower = trimmed.toLowerCase();
  if (WEAK_SECRET_PATTERNS.some((p) => lower.includes(p))) return true;
  if (new Set(trimmed.split("")).size < 10) return true;
  return false;
}
function validateProductionSessionSecret() {
  if (process.env.NODE_ENV !== "production") return;
  const configured = process.env.SESSION_SECRET?.trim();
  if (isWeakSessionSecret(configured)) {
    console.error(
      "FATAL: SESSION_SECRET must be set to a strong, high-entropy value of at least 32 characters in production."
    );
    process.exit(1);
  }
}
function validateProductionDemoConfig() {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.ENABLE_DEMO_SWITCHER === "true") {
    console.error(
      "FATAL: ENABLE_DEMO_SWITCHER must not be enabled in production."
    );
    process.exit(1);
  }
}
function validateProductionDeployConfig() {
  if (process.env.NODE_ENV !== "production") return;
  const corsOrigin = (process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGIN || "").trim();
  if (!corsOrigin) {
    console.error(
      "FATAL: CORS_ORIGIN must be explicitly set in production."
    );
    process.exit(1);
  }
  const hasGoogleClient = Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() || process.env.GOOGLE_CLIENT_SECRET?.trim()
  );
  if (hasGoogleClient && !process.env.GOOGLE_REDIRECT_URI?.trim()) {
    console.error(
      "FATAL: GOOGLE_REDIRECT_URI must be explicitly set when Google OAuth is configured in production."
    );
    process.exit(1);
  }
}
function parseTrustProxySetting() {
  const raw = process.env.TRUST_PROXY?.trim();
  if (!raw) {
    return process.env.NODE_ENV === "production" ? 1 : false;
  }
  if (raw === "false" || raw === "0") return false;
  if (raw === "true") return true;
  const asNum = Number(raw);
  if (Number.isInteger(asNum) && asNum >= 0) return asNum;
  return raw;
}
function buildCorsOptions() {
  const explicitOrigins = new Set(
    (process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean)
  );
  const isProd2 = process.env.NODE_ENV === "production";
  return (req, callback) => {
    const origin = req.headers.origin;
    const baseOpts = {
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Idempotency-Key",
        "X-Requested-With"
      ]
    };
    if (!origin) {
      callback(null, { ...baseOpts, origin: true });
      return;
    }
    if (explicitOrigins.has(origin)) {
      callback(null, { ...baseOpts, origin: true });
      return;
    }
    try {
      const parsed = new URL(origin);
      const reqHost = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim().toLowerCase();
      if (reqHost && parsed.host.toLowerCase() === reqHost) {
        callback(null, { ...baseOpts, origin: true });
        return;
      }
      if (!isProd2 && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")) {
        callback(null, { ...baseOpts, origin: true });
        return;
      }
    } catch {
    }
    callback(null, { ...baseOpts, origin: false });
  };
}
var HIGH_BURST_ROLES = /* @__PURE__ */ new Set([
  "SPORTS_SECRETARY",
  "FACULTY_ADVISOR",
  "AUCTION_OPERATOR",
  "MATCH_SCORER"
]);
function createRateLimiter(options) {
  const buckets = /* @__PURE__ */ new Map();
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }, Math.max(options.windowMs, 3e4));
  cleanupTimer.unref();
  return (req, res, next) => {
    const actor = req.actor;
    const isPrivileged = Boolean(
      actor && actor.roles.some((r) => HIGH_BURST_ROLES.has(r.roleCode))
    );
    if (isPrivileged && options.exemptPrivileged) {
      next();
      return;
    }
    const limit = isPrivileged && options.privilegedMaxRequests ? options.privilegedMaxRequests : options.maxRequests;
    const identityKey = actor ? `uid:${actor.id}` : `ip:${req.ip || req.socket.remoteAddress || "unknown"}`;
    const key = `${options.keyPrefix}:${identityKey}`;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    res.setHeader("X-RateLimit-Limit", String(limit));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, limit - bucket.count)));
    if (bucket.count > limit) {
      res.status(429).json({
        error: "Too many requests. Please wait a moment and try again."
      });
      return;
    }
    next();
  };
}
function detectImageMimeFromBuffer(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 255 && buf[1] === 216 && buf[2] === 255) {
    return "image/jpeg";
  }
  if (buf[0] === 137 && buf[1] === 80 && buf[2] === 78 && buf[3] === 71 && buf[4] === 13 && buf[5] === 10 && buf[6] === 26 && buf[7] === 10) {
    return "image/png";
  }
  if (buf[0] === 71 && buf[1] === 73 && buf[2] === 70 && buf[3] === 56 && (buf[4] === 55 || buf[4] === 57) && buf[5] === 97) {
    return "image/gif";
  }
  if (buf[0] === 82 && buf[1] === 73 && buf[2] === 70 && buf[3] === 70 && buf[8] === 87 && buf[9] === 69 && buf[10] === 66 && buf[11] === 80) {
    return "image/webp";
  }
  return null;
}
function detectAllowedUploadMime(buf) {
  const img = detectImageMimeFromBuffer(buf);
  if (img) return img;
  if (buf.length >= 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }
  return null;
}

// server/lib/storage.ts
import fs from "fs";
import path from "path";
import crypto2 from "crypto";
import multer from "multer";
var configuredUploadDir = process.env.UPLOAD_DIR?.trim();
var UPLOADS_DIR = configuredUploadDir ? path.resolve(configuredUploadDir) : path.resolve(process.cwd(), "uploads");
var PLAYER_UPLOADS_DIR = configuredUploadDir ? path.join(UPLOADS_DIR, "players") : path.resolve(process.cwd(), "public/uploads/players");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(PLAYER_UPLOADS_DIR)) {
  fs.mkdirSync(PLAYER_UPLOADS_DIR, { recursive: true });
}
function getS3Config() {
  const bucket = process.env.S3_BUCKET?.trim();
  const endpoint = process.env.S3_ENDPOINT?.trim()?.replace(/\/+$/, "");
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) return null;
  const region = process.env.S3_REGION?.trim() || "auto";
  const publicUrl = process.env.S3_PUBLIC_URL?.trim()?.replace(/\/+$/, "") || `${endpoint}/${bucket}`;
  return { bucket, endpoint, region, accessKeyId, secretAccessKey, publicUrl };
}
function validateStorageConfig() {
  if (process.env.NODE_ENV !== "production") return;
  if (!getS3Config() && !configuredUploadDir) {
    console.warn(
      "[STORAGE WARNING] Neither S3 object storage nor UPLOAD_DIR is configured in production; uploads will use ephemeral local disk."
    );
  }
}
var ALLOWED_MIMES = /* @__PURE__ */ new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf"
]);
var MIME_TO_EXT = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "application/pdf": ".pdf"
};
var uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  // 2 MB strict limit
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      const err = new Error("Unsupported file type. Allowed: JPEG, PNG, WebP, GIF, PDF.");
      err.status = 400;
      cb(err);
      return;
    }
    cb(null, true);
  }
});
function sha256Hex(data) {
  return crypto2.createHash("sha256").update(data).digest("hex");
}
function hmacSha256(key, data) {
  return crypto2.createHmac("sha256", key).update(data).digest();
}
async function putObjectS3(cfg, objectKey, buffer, contentType) {
  const url = new URL(`${cfg.endpoint}/${cfg.bucket}/${objectKey}`);
  const now = /* @__PURE__ */ new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(buffer);
  const canonicalHeaders = `content-type:${contentType}
host:${url.host}
x-amz-content-sha256:${payloadHash}
x-amz-date:${amzDate}
`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    "PUT",
    url.pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join("\n");
  const credentialScope = `${dateStamp}/${cfg.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join("\n");
  const kDate = hmacSha256(`AWS4${cfg.secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, cfg.region);
  const kService = hmacSha256(kRegion, "s3");
  const kSigning = hmacSha256(kService, "aws4_request");
  const signature = crypto2.createHmac("sha256", kSigning).update(stringToSign).digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const resp = await fetch(url.toString(), {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authorization
    },
    body: new Uint8Array(buffer)
  });
  if (!resp.ok) {
    throw new Error(`Object storage upload failed with status ${resp.status}.`);
  }
  return `${cfg.publicUrl}/${objectKey}`;
}
async function saveValidatedUpload(buffer, subdir) {
  const detectedMime = detectAllowedUploadMime(buffer);
  if (!detectedMime) {
    const err = new Error(
      "File signature rejected. Only valid JPEG, PNG, WebP, GIF, or PDF files are allowed."
    );
    err.status = 400;
    throw err;
  }
  if (subdir === "players" && detectedMime === "application/pdf") {
    const err = new Error("Player portrait upload must be an image (JPEG, PNG, WebP, or GIF).");
    err.status = 400;
    throw err;
  }
  const ext = MIME_TO_EXT[detectedMime] ?? ".bin";
  const filename = `${Date.now()}-${crypto2.randomBytes(6).toString("hex")}${ext}`;
  const s3 = getS3Config();
  if (s3) {
    const objectKey = subdir ? `${subdir}/${filename}` : filename;
    const url = await putObjectS3(s3, objectKey, buffer, detectedMime);
    return {
      filename,
      url,
      mimeType: detectedMime,
      size: buffer.length
    };
  }
  const targetDir = subdir === "players" ? PLAYER_UPLOADS_DIR : UPLOADS_DIR;
  const fullPath = path.join(targetDir, filename);
  fs.writeFileSync(fullPath, buffer);
  return {
    filename,
    url: subdir === "players" ? `/uploads/players/${filename}` : `/uploads/${filename}`,
    mimeType: detectedMime,
    size: buffer.length
  };
}

// server/routes/auth.ts
import crypto3 from "crypto";
import { Router } from "express";
import { eq as eq3, asc, or, sql } from "drizzle-orm";
import { z } from "zod";

// shared/academic.ts
var FIXED_COLLEGE = "IIITT";
function maxSemesterForProgram(programType) {
  return programType === "MTECH" ? 4 : 8;
}
function deriveBatchFromSemester(programType, semester) {
  if (programType === "MTECH") return "MTECH";
  if (semester <= 2) return "1ST";
  if (semester <= 4) return "2ND";
  if (semester <= 6) return "3RD";
  return "4TH";
}
function defaultSemesterForBatch(batch) {
  switch (batch) {
    case "1ST":
      return 1;
    case "2ND":
      return 3;
    case "3RD":
      return 5;
    case "4TH":
      return 7;
    case "MTECH":
      return 1;
    default:
      return 1;
  }
}
function computeSemesterRollover(student, term) {
  if (student.accountType !== "STUDENT") {
    return { action: "SKIP", reason: "NON_STUDENT" };
  }
  if (student.lastIncrementedTerm === term) {
    return { action: "SKIP", reason: "ALREADY_ROLLED" };
  }
  if (student.isGraduated) {
    return { action: "SKIP", reason: "ALREADY_GRADUATED" };
  }
  const prog = student.programType === "MTECH" ? "MTECH" : "BTECH";
  const cap = maxSemesterForProgram(prog);
  const current = Math.max(1, student.currentSemester || 1);
  if (current >= cap) {
    return {
      action: "GRADUATE",
      nextSemester: cap,
      nextBatch: deriveBatchFromSemester(prog, cap),
      isGraduated: true,
      lastIncrementedTerm: term
    };
  }
  const nextSemester = current + 1;
  return {
    action: "ADVANCE",
    nextSemester,
    nextBatch: deriveBatchFromSemester(prog, nextSemester),
    isGraduated: false,
    lastIncrementedTerm: term
  };
}

// server/routes/auth.ts
var router = Router();
router.get("/me", async (req, res) => {
  const demoEnabled = isDemoSwitcherEnabled();
  let demoPersonas = [];
  if (demoEnabled) {
    const ROLE_PRIORITY = {
      FACULTY_ADVISOR: 1,
      SPORTS_SECRETARY: 2,
      SUPER_ADMIN: 3,
      CLUB_SECRETARY: 4,
      CLUB_COORDINATOR: 5,
      MATCH_SCORER: 6,
      AUCTION_OPERATOR: 7,
      AUCTIONEER: 8,
      CAPTAIN: 9,
      EQUIPMENT_STAFF: 10,
      TOURNAMENT_MANAGER: 11,
      CLUB_MEMBER: 12,
      STUDENT: 99
    };
    const allUsers = await db.select().from(users).orderBy(asc(users.id));
    const allRoles = await db.select().from(userRoles).where(eq3(userRoles.active, true));
    demoPersonas = allUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      batch: u.batch,
      roles: Array.from(
        new Set(
          allRoles.filter((r) => r.userId === u.id).sort((a, b) => (ROLE_PRIORITY[a.roleCode] ?? 50) - (ROLE_PRIORITY[b.roleCode] ?? 50)).map((r) => r.roleCode)
        )
      )
    }));
  }
  res.json({
    user: req.actor,
    demoSwitcherEnabled: demoEnabled,
    testLoginEnabled: isTestLoginEnabled(),
    googleOAuthEnabled: isGoogleOAuthConfigured(),
    demoPersonas
  });
});
router.post("/login", async (req, res) => {
  if (!isTestLoginEnabled()) {
    res.status(403).json({
      error: "Test username/password login is disabled in this environment."
    });
    return;
  }
  const schema = z.object({
    username: z.string().trim().min(1, "Username or email is required.").max(160),
    password: z.string().min(1, "Password cannot be empty.").max(200),
    roleCode: z.enum([
      "STUDENT",
      "SPORTS_SECRETARY",
      "FACULTY_ADVISOR",
      "CLUB_SECRETARY",
      "CLUB_COORDINATOR",
      "MATCH_SCORER",
      "AUCTION_OPERATOR",
      "CAPTAIN"
    ]).optional()
  });
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const normalizedInput = {
    username: body.username ?? body.email ?? body.identifier ?? "",
    password: body.password ?? "",
    roleCode: body.roleCode || void 0
  };
  const parsed = schema.safeParse(normalizedInput);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid login credentials." });
    return;
  }
  const raw = parsed.data.username.trim();
  const lower = raw.toLowerCase();
  const candidateEmails = raw.includes("@") ? [lower] : [lower, `${lower}@iiitt.ac.in`];
  const [existing] = await db.select().from(users).where(
    or(
      ...candidateEmails.map((em) => sql`lower(${users.email}) = ${em}`),
      sql`lower(coalesce(${users.rollNumber}, '')) = ${lower}`,
      sql`lower(${users.name}) = ${lower}`
    )
  ).limit(1);
  if (existing) {
    const actor2 = await loadActorById(existing.id);
    if (!actor2) {
      res.status(404).json({ error: "Matched user account could not be loaded." });
      return;
    }
    setSessionCookie(res, actor2.id);
    res.json({ user: actor2, created: false });
    return;
  }
  const localPart = (raw.includes("@") ? lower.split("@")[0] : lower).replace(/[^a-z0-9._-]/g, "_").replace(/^_+|_+$/g, "") || `user_${crypto3.randomBytes(3).toString("hex")}`;
  const email = raw.includes("@") ? lower : `${localPart}@iiitt.ac.in`;
  const displayName = raw.includes("@") ? raw.split("@")[0] : raw;
  const inferredRoll = /^\d{6,}$/.test(localPart) ? localPart : localPart.toUpperCase().slice(0, 16);
  const selectedRole = parsed.data.roleCode ?? "STUDENT";
  const isFaculty = selectedRole === "FACULTY_ADVISOR";
  const batchValue = isFaculty ? "FACULTY" : "2ND";
  const accountType = isFaculty ? "FACULTY" : "STUDENT";
  const qrToken = `IIITT-QR-${inferredRoll}-${crypto3.randomBytes(2).toString("hex").toUpperCase()}`;
  const created = await db.transaction(async (tx) => {
    const [newUser] = await tx.insert(users).values({
      email,
      name: displayName,
      rollNumber: inferredRoll,
      batch: batchValue,
      hostel: isFaculty ? "Faculty Quarters" : "Bhavani Hostel",
      qrCodeToken: qrToken,
      accountType,
      onboardingComplete: true
    }).returning();
    await tx.insert(userRoles).values({
      userId: newUser.id,
      roleCode: isFaculty ? "FACULTY_ADVISOR" : "STUDENT",
      grantedBy: newUser.id
    });
    if (selectedRole !== "STUDENT" && !isFaculty) {
      let scopedClubId = null;
      let scopedBatch = null;
      if (selectedRole === "CLUB_SECRETARY" || selectedRole === "CLUB_COORDINATOR") {
        const [cricketClub] = await tx.select({ id: sportsClubs.id }).from(sportsClubs).where(eq3(sportsClubs.slug, "cricket")).limit(1);
        const [fallbackClub] = cricketClub ? [cricketClub] : await tx.select({ id: sportsClubs.id }).from(sportsClubs).limit(1);
        scopedClubId = fallbackClub?.id ?? null;
        if (selectedRole === "CLUB_COORDINATOR") {
          scopedBatch = "2ND";
        }
      }
      await tx.insert(userRoles).values({
        userId: newUser.id,
        roleCode: selectedRole,
        clubId: scopedClubId,
        batchScope: scopedBatch,
        grantedBy: newUser.id
      });
    }
    await tx.insert(playerProfiles).values({
      userId: newUser.id,
      displayName: newUser.name,
      batch: batchValue,
      branch: isFaculty ? "PED" : "CSE",
      rollNumber: inferredRoll,
      bio: `Test account (${selectedRole})`,
      visibility: "PUBLIC",
      isClaimed: true,
      preferredSports: ["cricket", "football"]
    });
    return newUser;
  });
  const actor = await loadActorById(created.id);
  setSessionCookie(res, created.id);
  res.status(201).json({ user: actor, created: true });
});
router.post("/demo-switch", async (req, res) => {
  if (!isDemoSwitcherEnabled()) {
    res.status(403).json({ error: "Demo switcher is disabled in this environment." });
    return;
  }
  const parsed = z.object({ userId: z.number().int().positive().nullable() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid demo switch payload." });
    return;
  }
  if (parsed.data.userId === null) {
    clearSessionCookie(res);
    res.json({ user: null });
    return;
  }
  const actor = await loadActorById(parsed.data.userId);
  if (!actor) {
    res.status(404).json({ error: "Persona user not found." });
    return;
  }
  setSessionCookie(res, actor.id);
  res.json({ user: actor });
});
router.get("/google", (req, res) => {
  if (!isGoogleOAuthConfigured()) {
    res.redirect("/?authError=oauth_unconfigured");
    return;
  }
  const state = crypto3.randomBytes(24).toString("hex");
  setOAuthStateCookie(res, state);
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim() || (process.env.NODE_ENV === "production" ? "" : `${req.protocol}://${req.get("host")}/api/auth/google/callback`);
  if (!redirectUri) {
    res.redirect("/?authError=oauth_unconfigured");
    return;
  }
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID.trim(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account"
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});
router.get("/google/callback", async (req, res) => {
  if (!isGoogleOAuthConfigured()) {
    res.redirect("/?authError=oauth_unconfigured");
    return;
  }
  const code = String(req.query.code ?? "");
  const state = String(req.query.state ?? "");
  const expectedState = req.cookies?.[OAUTH_STATE_COOKIE_NAME];
  clearOAuthStateCookie(res);
  if (!code || !state || !expectedState || state !== expectedState) {
    res.redirect("/?authError=invalid_state");
    return;
  }
  try {
    const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim() || `${req.protocol}://${req.get("host")}/api/auth/google/callback`;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID.trim(),
        client_secret: process.env.GOOGLE_CLIENT_SECRET.trim(),
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });
    if (!tokenRes.ok) {
      res.redirect("/?authError=token_exchange_failed");
      return;
    }
    const tokenJson = await tokenRes.json();
    if (!tokenJson.access_token) {
      res.redirect("/?authError=token_exchange_failed");
      return;
    }
    const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` }
    });
    if (!infoRes.ok) {
      res.redirect("/?authError=userinfo_failed");
      return;
    }
    const info = await infoRes.json();
    if (!info.email || info.email_verified === false) {
      res.redirect("/?authError=userinfo_failed");
      return;
    }
    const actor = await findOrProvisionGoogleUser({
      email: info.email,
      name: info.name || info.email.split("@")[0],
      avatarUrl: info.picture ?? null
    });
    if (!actor) {
      res.redirect("/?authError=domain_not_allowed");
      return;
    }
    setSessionCookie(res, actor.id);
    res.redirect("/");
  } catch {
    res.redirect("/?authError=oauth_failed");
  }
});
router.post("/google", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    res.status(403).json({
      error: "Direct email sign-in is disabled in production. Use Google OAuth."
    });
    return;
  }
  const schema = z.object({
    email: z.string().email(),
    name: z.string().min(2).max(120),
    avatarUrl: z.string().url().optional().nullable()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid Google auth payload." });
    return;
  }
  const actor = await findOrProvisionGoogleUser(parsed.data);
  if (!actor) {
    res.status(403).json({
      error: "Access restricted to @iiitt.ac.in Google accounts or provisioned campus staff."
    });
    return;
  }
  setSessionCookie(res, actor.id);
  res.json({ user: actor });
});
router.post("/onboarding", requireAuth, async (req, res) => {
  const schema = z.object({
    name: z.string().min(2).max(120),
    rollNumber: z.string().min(2).max(32).optional().nullable(),
    batch: z.enum(["1ST", "2ND", "3RD", "4TH", "MTECH"]),
    branch: z.string().trim().min(2).max(40).default("CSE"),
    currentSemester: z.number().int().min(1).max(8).optional(),
    gender: z.enum(["BOYS", "GIRLS"]).default("BOYS"),
    hostel: z.string().max(80).optional().nullable(),
    avatarUrl: z.string().max(400).optional().nullable()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please provide valid onboarding fields (Name, Batch, Branch, and Semester)." });
    return;
  }
  const programType = parsed.data.batch === "MTECH" ? "MTECH" : "BTECH";
  const cap = maxSemesterForProgram(programType);
  const semester = parsed.data.currentSemester ?? defaultSemesterForBatch(parsed.data.batch);
  if (semester < 1 || semester > cap) {
    res.status(400).json({
      error: `${programType === "MTECH" ? "M.Tech" : "B.Tech"} semester must be between 1 and ${cap}.`
    });
    return;
  }
  const consistentBatch = deriveBatchFromSemester(programType, semester);
  const actor = req.actor;
  await db.transaction(async (tx) => {
    await tx.update(users).set({
      name: parsed.data.name.trim(),
      college: FIXED_COLLEGE,
      rollNumber: parsed.data.rollNumber?.trim() || actor.rollNumber,
      batch: consistentBatch,
      programType,
      currentSemester: semester,
      isGraduated: false,
      gender: parsed.data.gender,
      hostel: parsed.data.hostel?.trim() || null,
      avatarUrl: parsed.data.avatarUrl || actor.avatarUrl,
      onboardingComplete: true
    }).where(eq3(users.id, actor.id));
    await tx.update(playerProfiles).set({
      displayName: parsed.data.name.trim(),
      college: FIXED_COLLEGE,
      batch: consistentBatch,
      programType,
      currentSemester: semester,
      isGraduated: false,
      gender: parsed.data.gender,
      branch: parsed.data.branch.trim().toUpperCase(),
      rollNumber: parsed.data.rollNumber?.trim() || actor.rollNumber,
      avatarUrl: parsed.data.avatarUrl || actor.avatarUrl
    }).where(eq3(playerProfiles.userId, actor.id));
  });
  const updated = await loadActorById(actor.id);
  res.json({ user: updated });
});
router.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});
var auth_default = router;

// server/routes/bootstrap.ts
import { Router as Router2 } from "express";
import { and as and3, desc, eq as eq4, gt, isNull, or as or2, sql as sql2 } from "drizzle-orm";
import { z as z2 } from "zod";

// server/middleware/rbac.ts
function hasRole(actor, roleCode) {
  if (!actor) return false;
  return actor.roles.some((r) => r.roleCode === roleCode);
}
function hasGlobalSportsAuthority(actor) {
  return hasRole(actor, "FACULTY_ADVISOR") || hasRole(actor, "SPORTS_SECRETARY");
}
function isFacultyAdvisor(actor) {
  return hasRole(actor, "FACULTY_ADVISOR");
}
function canManageClubActivity(actor, clubId, targetBatch) {
  if (!actor) return false;
  if (hasGlobalSportsAuthority(actor)) return true;
  if (actor.roles.some((r) => r.roleCode === "CLUB_SECRETARY" && r.clubId === clubId)) {
    return true;
  }
  return actor.roles.some(
    (r) => r.roleCode === "CLUB_COORDINATOR" && r.clubId === clubId && (!targetBatch || r.batchScope === "ALL" || r.batchScope === targetBatch)
  );
}
function canEvaluateClubTrial(actor, clubId, applicantBatch) {
  return canManageClubActivity(actor, clubId, applicantBatch);
}
function canDecideClubInduction(actor, clubId) {
  if (!actor) return false;
  if (hasGlobalSportsAuthority(actor)) return true;
  return actor.roles.some((r) => r.roleCode === "CLUB_SECRETARY" && r.clubId === clubId);
}
function canScoreMatch(actor, matchScorerUserId) {
  if (!actor) return false;
  if (hasGlobalSportsAuthority(actor)) return true;
  return matchScorerUserId !== null && actor.id === matchScorerUserId;
}
function canOperateAuction(actor, auctionId) {
  if (!actor) return false;
  if (hasGlobalSportsAuthority(actor)) return true;
  return actor.roles.some(
    (r) => (r.roleCode === "AUCTION_OPERATOR" || r.roleCode === "AUCTIONEER") && (r.auctionId === null || !auctionId || r.auctionId === auctionId)
  );
}
function canPostNotice(actor, clubId) {
  if (!actor) return false;
  if (hasGlobalSportsAuthority(actor) || hasRole(actor, "EQUIPMENT_STAFF")) return true;
  if (clubId) {
    return actor.roles.some((r) => r.roleCode === "CLUB_SECRETARY" && r.clubId === clubId);
  }
  return false;
}

// server/lib/audit.ts
async function recordAuditLog(tx, actorUserId, action, entityType, entityId, metadataJson = {}) {
  await tx.insert(auditLogs).values({
    actorUserId,
    action,
    entityType,
    entityId: String(entityId),
    metadataJson
  });
}

// shared/validation.ts
function validateUrgentBannerWords(text2) {
  const words = text2.trim().split(/\s+/).filter((w) => w.length > 0);
  return {
    valid: words.length > 0 && words.length <= 5,
    wordCount: words.length
  };
}
function computeMaxAllowedBid(input) {
  if (input.currentSquadCount >= input.maxSquad) {
    return {
      eligible: false,
      reason: "Max squad size reached",
      maxAllowedBid: 0,
      requiredReserve: 0
    };
  }
  const afterSquad = input.currentSquadCount + 1;
  const afterClub = input.currentClubCount + (input.candidateClass === "CLUB" ? 1 : 0);
  const afterNonClub = input.currentNonClubCount + (input.candidateClass === "NON_CLUB" ? 1 : 0);
  const slotsStillNeeded = Math.max(0, input.minSquad - afterSquad);
  const clubDeficit = Math.max(0, input.minClubQuota - afterClub);
  const nonClubDeficit = Math.max(0, input.minNonClubQuota - afterNonClub);
  const maxRemainingSlots = input.maxSquad - afterSquad;
  if (clubDeficit + nonClubDeficit > maxRemainingSlots) {
    return {
      eligible: false,
      reason: "Would violate mandatory CLUB / NON_CLUB quota",
      maxAllowedBid: 0,
      requiredReserve: 0
    };
  }
  const generalExtraSlots = Math.max(0, slotsStillNeeded - (clubDeficit + nonClubDeficit));
  const minAnyBase = Math.min(input.clubBasePrice, input.nonClubBasePrice);
  const requiredReserve = clubDeficit * input.clubBasePrice + nonClubDeficit * input.nonClubBasePrice + generalExtraSlots * minAnyBase;
  const maxAllowedBid = Math.max(0, input.remainingPurse - requiredReserve);
  return {
    eligible: maxAllowedBid > 0,
    reason: maxAllowedBid <= 0 ? "Insufficient purse after mandatory reserves" : null,
    maxAllowedBid,
    requiredReserve
  };
}

// server/routes/bootstrap.ts
var router2 = Router2();
var uploadLimiter = createRateLimiter({
  windowMs: 6e4,
  maxRequests: 25,
  privilegedMaxRequests: 100,
  keyPrefix: "upload"
});
router2.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, uptime: Math.round(process.uptime()), db: "connected" });
  } catch {
    res.status(503).json({ ok: false, uptime: Math.round(process.uptime()), db: "disconnected" });
  }
});
var PUBLIC_BOOTSTRAP_CACHE_TTL_MS = 750;
var publicBootstrapCache = null;
function invalidateBootstrapCache() {
  publicBootstrapCache = null;
}
router2.get("/bootstrap", async (req, res) => {
  if (!req.actor && publicBootstrapCache && Date.now() < publicBootstrapCache.expiresAtMs) {
    res.json(publicBootstrapCache.payload);
    return;
  }
  const settingsRows = await db.select().from(siteSettings);
  const settingsMap = Object.fromEntries(settingsRows.map((s) => [s.key, s.valueJson]));
  const now = /* @__PURE__ */ new Date();
  const activeNotices = await db.select().from(announcements).where(
    and3(
      eq4(announcements.active, true),
      or2(isNull(announcements.expiresAt), gt(announcements.expiresAt, now))
    )
  ).orderBy(desc(announcements.isUrgentBanner), desc(announcements.createdAt)).limit(12);
  const urgentBanner = activeNotices.find((a) => a.isUrgentBanner) ?? null;
  const briefNotices = activeNotices.filter((a) => !a.isUrgentBanner).slice(0, 5);
  const liveMatches = await db.select({ id: matches.id }).from(matches).where(eq4(matches.status, "LIVE"));
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const currentYear = now.getFullYear();
  const [exactOnThisDay] = await db.select({
    id: matches.id,
    roundLabel: matches.roundLabel,
    scoreSummary: matches.scoreSummary,
    resultNote: matches.resultNote,
    scheduledAt: matches.scheduledAt,
    tournamentName: tournaments.name,
    academicYear: tournaments.academicYear,
    sportName: sports.name,
    teamAId: matches.teamAId,
    teamBId: matches.teamBId
  }).from(matches).innerJoin(tournaments, eq4(matches.tournamentId, tournaments.id)).innerJoin(sports, eq4(matches.sportId, sports.id)).where(
    and3(
      eq4(tournaments.status, "ARCHIVED"),
      sql2`EXTRACT(MONTH FROM ${matches.scheduledAt}) = ${month}`,
      sql2`EXTRACT(DAY FROM ${matches.scheduledAt}) = ${day}`,
      sql2`EXTRACT(YEAR FROM ${matches.scheduledAt}) < ${currentYear}`
    )
  ).orderBy(desc(tournaments.academicYear)).limit(1);
  const onThisDayMatch = exactOnThisDay ?? (await db.select({
    id: matches.id,
    roundLabel: matches.roundLabel,
    scoreSummary: matches.scoreSummary,
    resultNote: matches.resultNote,
    scheduledAt: matches.scheduledAt,
    tournamentName: tournaments.name,
    academicYear: tournaments.academicYear,
    sportName: sports.name,
    teamAId: matches.teamAId,
    teamBId: matches.teamBId
  }).from(matches).innerJoin(tournaments, eq4(matches.tournamentId, tournaments.id)).innerJoin(sports, eq4(matches.sportId, sports.id)).where(eq4(tournaments.status, "ARCHIVED")).orderBy(desc(tournaments.academicYear)).limit(1))[0] ?? null;
  let unreadNotificationsCount = 0;
  if (req.actor) {
    const [countRow] = await db.select({ count: sql2`count(*)::int` }).from(notifications).where(and3(eq4(notifications.userId, req.actor.id), eq4(notifications.isRead, false)));
    unreadNotificationsCount = countRow?.count ?? 0;
  }
  const payload = {
    settings: {
      showAuctionInNav: Boolean(settingsMap.showAuctionInNav),
      showLiveAuctionInNav: Boolean(settingsMap.showLiveAuctionInNav),
      currentTournamentId: settingsMap.currentTournamentId ?? null,
      overviewConfig: settingsMap.overviewConfig ?? {
        headline: "IIITT Sports Calendar",
        summary: "Official campus tournaments and athletics.",
        upcomingTournaments: []
      }
    },
    urgentBanner,
    briefNotices,
    liveMatchCount: liveMatches.length,
    hasLiveMatches: liveMatches.length > 0,
    onThisDay: onThisDayMatch,
    unreadNotificationsCount
  };
  if (!req.actor) {
    publicBootstrapCache = {
      expiresAtMs: Date.now() + PUBLIC_BOOTSTRAP_CACHE_TTL_MS,
      payload
    };
  }
  res.json(payload);
});
router2.get("/notifications", requireAuth, async (req, res) => {
  const rows = await db.select().from(notifications).where(eq4(notifications.userId, req.actor.id)).orderBy(desc(notifications.createdAt)).limit(40);
  res.json({ notifications: rows });
});
router2.post("/notifications/:id/read", requireAuth, async (req, res) => {
  const id = parsePositiveIntId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid notification ID." });
    return;
  }
  await db.update(notifications).set({ isRead: true }).where(and3(eq4(notifications.id, id), eq4(notifications.userId, req.actor.id)));
  res.json({ ok: true });
});
router2.post("/notifications/read-all", requireAuth, async (req, res) => {
  await db.update(notifications).set({ isRead: true }).where(eq4(notifications.userId, req.actor.id));
  res.json({ ok: true });
});
router2.patch("/settings/overview", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can update Overview." });
    return;
  }
  const schema = z2.object({
    headline: z2.string().min(3).max(160),
    summary: z2.string().min(3).max(500),
    upcomingTournaments: z2.array(
      z2.object({
        name: z2.string().min(2).max(120),
        window: z2.string().min(2).max(100),
        mode: z2.string().min(2).max(60)
      })
    ),
    notifyEveryone: z2.boolean().default(false)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid Overview update payload." });
    return;
  }
  const { notifyEveryone, ...config } = parsed.data;
  await db.transaction(async (tx) => {
    await tx.insert(siteSettings).values({ key: "overviewConfig", valueJson: config, updatedBy: req.actor.id }).onConflictDoUpdate({
      target: siteSettings.key,
      set: { valueJson: config, updatedBy: req.actor.id, updatedAt: /* @__PURE__ */ new Date() }
    });
    if (notifyEveryone) {
      const allUsers = await tx.select({ id: users.id }).from(users);
      if (allUsers.length > 0) {
        await tx.insert(notifications).values(
          allUsers.map((u) => ({
            userId: u.id,
            title: "Sports Overview Updated",
            message: `${config.headline} \u2014 check upcoming tournament dates.`,
            linkUrl: "/overview"
          }))
        );
      }
    }
    await recordAuditLog(tx, req.actor.id, "UPDATE_OVERVIEW", "site_settings", "overviewConfig", {
      notifyEveryone
    });
  });
  invalidateBootstrapCache();
  if (notifyEveryone) {
    broadcastSse("NOTIFICATION", { title: "Sports Overview Updated" });
  }
  res.json({ ok: true, overviewConfig: config });
});
router2.patch("/settings/nav", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can toggle navigation." });
    return;
  }
  const schema = z2.object({
    showAuctionInNav: z2.boolean().optional(),
    showLiveAuctionInNav: z2.boolean().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid nav toggle payload." });
    return;
  }
  await db.transaction(async (tx) => {
    if (parsed.data.showAuctionInNav !== void 0) {
      await tx.insert(siteSettings).values({ key: "showAuctionInNav", valueJson: parsed.data.showAuctionInNav, updatedBy: req.actor.id }).onConflictDoUpdate({
        target: siteSettings.key,
        set: { valueJson: parsed.data.showAuctionInNav, updatedBy: req.actor.id, updatedAt: /* @__PURE__ */ new Date() }
      });
    }
    if (parsed.data.showLiveAuctionInNav !== void 0) {
      await tx.insert(siteSettings).values({ key: "showLiveAuctionInNav", valueJson: parsed.data.showLiveAuctionInNav, updatedBy: req.actor.id }).onConflictDoUpdate({
        target: siteSettings.key,
        set: { valueJson: parsed.data.showLiveAuctionInNav, updatedBy: req.actor.id, updatedAt: /* @__PURE__ */ new Date() }
      });
    }
    await recordAuditLog(tx, req.actor.id, "UPDATE_NAV_FLAGS", "site_settings", "nav", parsed.data);
  });
  invalidateBootstrapCache();
  broadcastSse("NAV_UPDATED", parsed.data);
  res.json({ ok: true });
});
router2.post("/announcements", requireAuth, async (req, res) => {
  const schema = z2.object({
    title: z2.string().min(2).max(160),
    body: z2.string().min(2).max(1e3),
    isUrgentBanner: z2.boolean().default(false),
    clubId: z2.number().int().positive().nullable().optional(),
    expiresAt: z2.string().datetime().nullable().optional(),
    notifyEveryone: z2.boolean().default(false)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid announcement payload." });
    return;
  }
  if (!canPostNotice(req.actor, parsed.data.clubId ?? null)) {
    res.status(403).json({ error: "You are not authorized to publish notices." });
    return;
  }
  if (parsed.data.isUrgentBanner) {
    if (!hasGlobalSportsAuthority(req.actor)) {
      res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can set the top alert banner." });
      return;
    }
    const wordCheck = validateUrgentBannerWords(parsed.data.title);
    if (!wordCheck.valid) {
      res.status(400).json({
        error: `Urgent top alert banner must be 1 to 5 words maximum (received ${wordCheck.wordCount}).`
      });
      return;
    }
  }
  const created = await db.transaction(async (tx) => {
    if (parsed.data.isUrgentBanner) {
      await tx.update(announcements).set({ active: false }).where(eq4(announcements.isUrgentBanner, true));
    }
    const [row] = await tx.insert(announcements).values({
      title: parsed.data.title.trim(),
      body: parsed.data.body.trim(),
      isUrgentBanner: parsed.data.isUrgentBanner,
      clubId: parsed.data.clubId ?? null,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      active: true,
      createdBy: req.actor.id
    }).returning();
    if (parsed.data.notifyEveryone) {
      const allUsers = await tx.select({ id: users.id }).from(users);
      if (allUsers.length > 0) {
        await tx.insert(notifications).values(
          allUsers.map((u) => ({
            userId: u.id,
            title: row.title,
            message: row.body,
            linkUrl: "/"
          }))
        );
      }
    }
    await recordAuditLog(tx, req.actor.id, "CREATE_ANNOUNCEMENT", "announcements", row.id, {
      isUrgentBanner: row.isUrgentBanner
    });
    return row;
  });
  invalidateBootstrapCache();
  broadcastSse("NOTICE_UPDATED", { announcement: created });
  res.status(201).json({ announcement: created });
});
router2.put("/urgent-banner", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can update the top alert banner." });
    return;
  }
  const schema = z2.object({
    title: z2.string().min(1).max(160),
    body: z2.string().max(1e3).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Provide banner text (1 to 5 words)." });
    return;
  }
  const wordCheck = validateUrgentBannerWords(parsed.data.title);
  if (!wordCheck.valid) {
    res.status(400).json({
      error: `Urgent top alert banner must be 1 to 5 words maximum (received ${wordCheck.wordCount}).`
    });
    return;
  }
  const title = parsed.data.title.trim();
  const body = parsed.data.body?.trim() || title;
  const created = await db.transaction(async (tx) => {
    await tx.update(announcements).set({ active: false }).where(eq4(announcements.isUrgentBanner, true));
    const [row] = await tx.insert(announcements).values({
      title,
      body,
      isUrgentBanner: true,
      clubId: null,
      active: true,
      createdBy: req.actor.id
    }).returning();
    await recordAuditLog(tx, req.actor.id, "UPDATE_URGENT_BANNER", "announcements", row.id, {
      title
    });
    return row;
  });
  invalidateBootstrapCache();
  broadcastSse("NOTICE_UPDATED", { announcement: created });
  res.json({ urgentBanner: created });
});
router2.delete("/urgent-banner", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can clear the top alert banner." });
    return;
  }
  await db.transaction(async (tx) => {
    await tx.update(announcements).set({ active: false }).where(and3(eq4(announcements.isUrgentBanner, true), eq4(announcements.active, true)));
    await recordAuditLog(tx, req.actor.id, "CLEAR_URGENT_BANNER", "announcements", "urgent_banner", {});
  });
  invalidateBootstrapCache();
  broadcastSse("NOTICE_UPDATED", { clearedUrgentBanner: true });
  res.json({ ok: true, urgentBanner: null });
});
router2.patch("/announcements/:id", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Unauthorized to toggle announcements." });
    return;
  }
  const id = parsePositiveIntId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid announcement ID." });
    return;
  }
  const schema = z2.object({ active: z2.boolean() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload." });
    return;
  }
  const [updated] = await db.update(announcements).set({ active: parsed.data.active }).where(eq4(announcements.id, id)).returning();
  invalidateBootstrapCache();
  broadcastSse("NOTICE_UPDATED", { id, active: parsed.data.active });
  res.json({ announcement: updated });
});
router2.post("/upload", requireAuth, uploadLimiter, uploadMiddleware.single("file"), async (req, res, next) => {
  if (!req.file || !req.file.buffer) {
    res.status(400).json({ error: "No file uploaded." });
    return;
  }
  try {
    const saved = await saveValidatedUpload(req.file.buffer);
    res.status(201).json({
      url: saved.url,
      mimeType: saved.mimeType,
      size: saved.size
    });
  } catch (err) {
    next(err);
  }
});
var bootstrap_default = router2;

// server/routes/clubs.ts
import { Router as Router3 } from "express";
import { and as and5, asc as asc2, eq as eq6, inArray as inArray2, notInArray as notInArray2 } from "drizzle-orm";
import { z as z3 } from "zod";

// server/lib/clubLeadership.ts
import { and as and4, eq as eq5, inArray, notInArray } from "drizzle-orm";
var NON_STUDENT_ROLES = ["FACULTY_ADVISOR", "EQUIPMENT_STAFF", "SUPER_ADMIN"];
async function getExcludedNonStudentIds() {
  const nonStudentAccounts = await db.select({ id: users.id }).from(users).where(notInArray(users.accountType, ["STUDENT"]));
  const nonStudentRoleHolders = await db.select({ userId: userRoles.userId }).from(userRoles).where(and4(eq5(userRoles.active, true), inArray(userRoles.roleCode, NON_STUDENT_ROLES)));
  return Array.from(
    /* @__PURE__ */ new Set([
      ...nonStudentAccounts.map((u) => u.id),
      ...nonStudentRoleHolders.map((r) => r.userId)
    ])
  );
}
async function assertStudentCandidate(userId) {
  const [u] = await db.select().from(users).where(eq5(users.id, userId)).limit(1);
  if (!u || u.accountType !== "STUDENT") {
    return "Selected account is not an eligible student account.";
  }
  const activeRoles = await db.select({ roleCode: userRoles.roleCode }).from(userRoles).where(and4(eq5(userRoles.userId, userId), eq5(userRoles.active, true)));
  if (activeRoles.some((r) => NON_STUDENT_ROLES.includes(r.roleCode))) {
    return "Faculty, ground staff, and system admin accounts cannot be selected for student roles.";
  }
  return null;
}
async function canActorActAsClubSecretary(actor, clubId) {
  if (!actor) return false;
  if (canDecideClubInduction(actor, clubId)) return true;
  const [secMembership] = await db.select({ id: clubMemberships.id }).from(clubMemberships).innerJoin(playerProfiles, eq5(clubMemberships.playerProfileId, playerProfiles.id)).where(
    and4(
      eq5(clubMemberships.clubId, clubId),
      eq5(clubMemberships.role, "SECRETARY"),
      eq5(clubMemberships.status, "INDUCTED"),
      eq5(playerProfiles.userId, actor.id)
    )
  ).limit(1);
  if (secMembership) return true;
  if (actor.playerProfileId) {
    const [profileSec] = await db.select({ id: clubMemberships.id }).from(clubMemberships).where(
      and4(
        eq5(clubMemberships.clubId, clubId),
        eq5(clubMemberships.role, "SECRETARY"),
        eq5(clubMemberships.status, "INDUCTED"),
        eq5(clubMemberships.playerProfileId, actor.playerProfileId)
      )
    ).limit(1);
    if (profileSec) return true;
  }
  return false;
}
async function canActorManageClubBatch(actor, clubId, targetBatch) {
  if (!actor) return false;
  if (canManageClubActivity(actor, clubId, targetBatch)) return true;
  if (await canActorActAsClubSecretary(actor, clubId)) return true;
  const coordRows = await db.select({ batchScope: clubMemberships.batchScope }).from(clubMemberships).innerJoin(playerProfiles, eq5(clubMemberships.playerProfileId, playerProfiles.id)).where(
    and4(
      eq5(clubMemberships.clubId, clubId),
      eq5(clubMemberships.role, "COORDINATOR"),
      eq5(clubMemberships.status, "INDUCTED"),
      eq5(playerProfiles.userId, actor.id)
    )
  );
  return coordRows.some(
    (c) => !targetBatch || c.batchScope === "ALL" || c.batchScope === targetBatch
  );
}
async function ensureStudentPlayerProfileId(executor, userId) {
  const [prof] = await executor.select({ id: playerProfiles.id }).from(playerProfiles).where(eq5(playerProfiles.userId, userId)).limit(1);
  if (prof) return prof.id;
  const [u] = await executor.select().from(users).where(eq5(users.id, userId)).limit(1);
  if (!u || u.accountType !== "STUDENT") return null;
  const [created] = await executor.insert(playerProfiles).values({
    userId: u.id,
    displayName: u.name,
    batch: u.batch,
    rollNumber: u.rollNumber,
    avatarUrl: u.avatarUrl,
    visibility: "PUBLIC",
    isClaimed: true
  }).returning({ id: playerProfiles.id });
  return created?.id ?? null;
}
async function appointClubCoordinator(executor, params) {
  const profileId = await ensureStudentPlayerProfileId(executor, params.targetUserId);
  if (!profileId) {
    return { ok: false, status: 400, error: "Target user must have a student player profile." };
  }
  const cleanLabel = params.scopeLabel?.trim() || null;
  const [existing] = await executor.select().from(clubMemberships).where(
    and4(
      eq5(clubMemberships.clubId, params.clubId),
      eq5(clubMemberships.playerProfileId, profileId)
    )
  ).limit(1);
  if (existing && existing.role === "SECRETARY" && existing.status === "INDUCTED") {
    return {
      ok: false,
      status: 409,
      error: "This student is already the Club Secretary for this club."
    };
  }
  const [membership] = existing ? await executor.update(clubMemberships).set({
    role: "COORDINATOR",
    batchScope: params.batchScope,
    scopeLabel: cleanLabel,
    status: "INDUCTED",
    approvedBy: params.actorId,
    inductedAt: existing.inductedAt ?? /* @__PURE__ */ new Date()
  }).where(eq5(clubMemberships.id, existing.id)).returning() : await executor.insert(clubMemberships).values({
    clubId: params.clubId,
    playerProfileId: profileId,
    role: "COORDINATOR",
    batchScope: params.batchScope,
    scopeLabel: cleanLabel,
    status: "INDUCTED",
    approvedBy: params.actorId,
    inductedAt: /* @__PURE__ */ new Date()
  }).returning();
  await executor.update(userRoles).set({ active: false }).where(
    and4(
      eq5(userRoles.userId, params.targetUserId),
      eq5(userRoles.roleCode, "CLUB_COORDINATOR"),
      eq5(userRoles.clubId, params.clubId),
      eq5(userRoles.active, true)
    )
  );
  await executor.insert(userRoles).values({
    userId: params.targetUserId,
    roleCode: "CLUB_COORDINATOR",
    clubId: params.clubId,
    batchScope: params.batchScope,
    scopeLabel: cleanLabel,
    grantedBy: params.actorId
  });
  return { ok: true, membership };
}
async function removeClubCoordinator(executor, params) {
  let targetRow;
  if (params.membershipId) {
    [targetRow] = await executor.select({
      membershipId: clubMemberships.id,
      userId: playerProfiles.userId,
      batchScope: clubMemberships.batchScope,
      displayName: playerProfiles.displayName
    }).from(clubMemberships).innerJoin(playerProfiles, eq5(clubMemberships.playerProfileId, playerProfiles.id)).where(
      and4(
        eq5(clubMemberships.id, params.membershipId),
        eq5(clubMemberships.clubId, params.clubId),
        eq5(clubMemberships.role, "COORDINATOR")
      )
    ).limit(1);
  } else if (params.targetUserId) {
    const conditions = [
      eq5(clubMemberships.clubId, params.clubId),
      eq5(clubMemberships.role, "COORDINATOR"),
      eq5(playerProfiles.userId, params.targetUserId)
    ];
    if (params.batchScope) {
      conditions.push(eq5(clubMemberships.batchScope, params.batchScope));
    }
    [targetRow] = await executor.select({
      membershipId: clubMemberships.id,
      userId: playerProfiles.userId,
      batchScope: clubMemberships.batchScope,
      displayName: playerProfiles.displayName
    }).from(clubMemberships).innerJoin(playerProfiles, eq5(clubMemberships.playerProfileId, playerProfiles.id)).where(and4(...conditions)).limit(1);
  }
  if (!targetRow) {
    if (params.targetUserId) {
      const roleConds = [
        eq5(userRoles.userId, params.targetUserId),
        eq5(userRoles.roleCode, "CLUB_COORDINATOR"),
        eq5(userRoles.clubId, params.clubId),
        eq5(userRoles.active, true)
      ];
      if (params.batchScope) {
        roleConds.push(eq5(userRoles.batchScope, params.batchScope));
      }
      await executor.update(userRoles).set({ active: false }).where(and4(...roleConds));
    }
    return null;
  }
  await executor.update(clubMemberships).set({ role: "MEMBER", batchScope: null, scopeLabel: null }).where(eq5(clubMemberships.id, targetRow.membershipId));
  if (targetRow.userId) {
    const roleConds = [
      eq5(userRoles.userId, targetRow.userId),
      eq5(userRoles.roleCode, "CLUB_COORDINATOR"),
      eq5(userRoles.clubId, params.clubId),
      eq5(userRoles.active, true)
    ];
    if (targetRow.batchScope) {
      roleConds.push(eq5(userRoles.batchScope, targetRow.batchScope));
    }
    await executor.update(userRoles).set({ active: false }).where(and4(...roleConds));
  }
  return {
    membershipId: targetRow.membershipId,
    targetUserId: targetRow.userId,
    batchScope: targetRow.batchScope,
    displayName: targetRow.displayName
  };
}

// server/routes/clubs.ts
var router3 = Router3();
router3.get("/", async (_req, res) => {
  const clubRows = await db.select({
    id: sportsClubs.id,
    slug: sportsClubs.slug,
    name: sportsClubs.name,
    tagline: sportsClubs.tagline,
    bannerUrl: sportsClubs.bannerUrl,
    practiceSchedule: sportsClubs.practiceSchedule,
    inductionOpen: sportsClubs.inductionOpen,
    sportName: sports.name,
    category: sports.category,
    displayOrder: sports.displayOrder
  }).from(sportsClubs).innerJoin(sports, eq6(sportsClubs.sportId, sports.id)).orderBy(asc2(sports.displayOrder));
  const memberCounts = await db.select({
    clubId: clubMemberships.clubId,
    status: clubMemberships.status
  }).from(clubMemberships);
  const upcomingCountRows = await db.select({
    clubId: clubActivities.clubId,
    scheduledAt: clubActivities.scheduledAt
  }).from(clubActivities);
  const nowMs = Date.now();
  const enriched = clubRows.map((c) => ({
    ...c,
    inductedCount: memberCounts.filter((m) => m.clubId === c.id && m.status === "INDUCTED").length,
    upcomingActivitiesCount: upcomingCountRows.filter(
      (a) => a.clubId === c.id && new Date(a.scheduledAt).getTime() >= nowMs - 3600 * 1e3
    ).length
  }));
  res.json({
    outdoorClubs: enriched.filter((c) => c.category === "OUTDOOR_TEAM"),
    indoorClubs: enriched.filter((c) => c.category === "INDOOR"),
    clubs: enriched
  });
});
router3.get("/:slug", async (req, res) => {
  const [club] = await db.select({
    id: sportsClubs.id,
    sportId: sportsClubs.sportId,
    slug: sportsClubs.slug,
    name: sportsClubs.name,
    tagline: sportsClubs.tagline,
    description: sportsClubs.description,
    bannerUrl: sportsClubs.bannerUrl,
    practiceSchedule: sportsClubs.practiceSchedule,
    inductionOpen: sportsClubs.inductionOpen,
    sportName: sports.name,
    category: sports.category
  }).from(sportsClubs).innerJoin(sports, eq6(sportsClubs.sportId, sports.id)).where(eq6(sportsClubs.slug, String(req.params.slug))).limit(1);
  if (!club) {
    res.status(404).json({ error: "Sports club not found." });
    return;
  }
  const activities = await db.select().from(clubActivities).where(eq6(clubActivities.clubId, club.id)).orderBy(asc2(clubActivities.scheduledAt));
  const membershipRows = await db.select({
    id: clubMemberships.id,
    playerProfileId: clubMemberships.playerProfileId,
    role: clubMemberships.role,
    batchScope: clubMemberships.batchScope,
    scopeLabel: clubMemberships.scopeLabel,
    status: clubMemberships.status,
    trialNotes: clubMemberships.trialNotes,
    evaluationScore: clubMemberships.evaluationScore,
    inductedAt: clubMemberships.inductedAt,
    createdAt: clubMemberships.createdAt,
    displayName: playerProfiles.displayName,
    batch: playerProfiles.batch,
    branch: playerProfiles.branch,
    avatarUrl: playerProfiles.avatarUrl,
    userId: playerProfiles.userId
  }).from(clubMemberships).innerJoin(playerProfiles, eq6(clubMemberships.playerProfileId, playerProfiles.id)).where(eq6(clubMemberships.clubId, club.id)).orderBy(asc2(clubMemberships.id));
  const secretary = membershipRows.find((m) => m.role === "SECRETARY" && m.status === "INDUCTED") ?? null;
  const isMembershipSecretary = Boolean(
    req.actor && membershipRows.some(
      (m) => m.role === "SECRETARY" && m.status === "INDUCTED" && (m.userId === req.actor.id || req.actor.playerProfileId && m.playerProfileId === req.actor.playerProfileId)
    )
  );
  const isMembershipCoordinator = Boolean(
    req.actor && membershipRows.some(
      (m) => m.role === "COORDINATOR" && m.status === "INDUCTED" && (m.userId === req.actor.id || req.actor.playerProfileId && m.playerProfileId === req.actor.playerProfileId)
    )
  );
  const canDecide = await canActorActAsClubSecretary(req.actor, club.id) || isMembershipSecretary;
  const canManage = canManageClubActivity(req.actor, club.id) || canDecide || isMembershipCoordinator;
  const sanitizePublicMember = (m) => {
    const { trialNotes: _tn, evaluationScore: _es, userId: _uid, ...publicFields } = m;
    return publicFields;
  };
  const publicSecretary = secretary ? sanitizePublicMember(secretary) : null;
  const coordinators = membershipRows.filter((m) => m.role === "COORDINATOR" && m.status === "INDUCTED").map(sanitizePublicMember);
  const inductedMembers = membershipRows.filter((m) => m.status === "INDUCTED").map(sanitizePublicMember);
  const sanitizedActivities = req.actor ? activities : activities.map((act) => {
    if (!Array.isArray(act.selectedSquadJson)) return act;
    return {
      ...act,
      selectedSquadJson: act.selectedSquadJson.map((entry) => {
        if (!entry || typeof entry !== "object") return entry;
        const { rollNumber: _rn, userId: _uid, ...rest } = entry;
        return rest;
      })
    };
  });
  const myApplication = req.actor?.playerProfileId ? membershipRows.find((m) => m.playerProfileId === req.actor.playerProfileId) ?? null : null;
  const inductionQueue = canManage ? membershipRows.filter((m) => m.status !== "INDUCTED") : myApplication ? [myApplication] : [];
  res.json({
    club,
    activities: sanitizedActivities,
    secretary: publicSecretary,
    coordinators,
    inductedMembers,
    myApplication,
    inductionQueue,
    permissions: {
      canManageActivities: canManage,
      canEvaluateTrials: canManage,
      canDecideInductions: canDecide,
      canManageLeadership: canDecide,
      canPublishExternalSelection: canDecide
    }
  });
});
var activitySchema = z3.object({
  activityType: z3.enum([
    "PRACTICE",
    "INDUCTION",
    "MEETING",
    "INTER_IIIT",
    "EXTERNAL_MATCH",
    "OTHER"
  ]),
  customTypeLabel: z3.string().max(80).optional().nullable(),
  targetBatch: z3.enum(["1ST", "2ND", "3RD", "4TH", "MTECH", "ALL"]),
  category: z3.enum(["BOYS", "GIRLS", "OPEN"]),
  scheduledAt: z3.string().datetime(),
  venue: z3.string().min(2).max(160),
  notes: z3.string().max(400).optional().nullable(),
  selectedPlayerProfileIds: z3.array(z3.number().int().positive()).max(50).optional().default([])
});
router3.post("/:slug/activities", requireAuth, async (req, res) => {
  const [club] = await db.select().from(sportsClubs).where(eq6(sportsClubs.slug, String(req.params.slug))).limit(1);
  if (!club) {
    res.status(404).json({ error: "Club not found." });
    return;
  }
  const parsed = activitySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid club activity details. Ensure valid ISO date/time and venue." });
    return;
  }
  if (parsed.data.activityType === "OTHER" && !parsed.data.customTypeLabel?.trim()) {
    res.status(400).json({ error: "Custom activity label is required when Type is 'Other'." });
    return;
  }
  const uniqueSquadIds = Array.from(new Set(parsed.data.selectedPlayerProfileIds ?? []));
  const isExternalTeamSelection = parsed.data.activityType === "INTER_IIIT" || parsed.data.activityType === "EXTERNAL_MATCH" || uniqueSquadIds.length > 0;
  if (isExternalTeamSelection) {
    if (!await canActorActAsClubSecretary(req.actor, club.id)) {
      res.status(403).json({
        error: "Only the Club Secretary, Sports Secretary, or Faculty Advisor can publish external or Inter-IIIT team selections."
      });
      return;
    }
  } else if (!await canActorManageClubBatch(req.actor, club.id, parsed.data.targetBatch)) {
    res.status(403).json({
      error: `Unauthorized: You cannot schedule ${parsed.data.targetBatch} activities for ${club.name}.`
    });
    return;
  }
  let resolvedSquad = [];
  if (uniqueSquadIds.length > 0) {
    const excludedIds = await getExcludedNonStudentIds();
    const conds = [inArray2(playerProfiles.id, uniqueSquadIds), eq6(users.accountType, "STUDENT")];
    if (excludedIds.length > 0) {
      conds.push(notInArray2(users.id, excludedIds));
    }
    const candidateRows = await db.select({
      userId: users.id,
      playerProfileId: playerProfiles.id,
      name: playerProfiles.displayName,
      rollNumber: users.rollNumber,
      batch: playerProfiles.batch,
      branch: playerProfiles.branch
    }).from(playerProfiles).innerJoin(users, eq6(playerProfiles.userId, users.id)).where(and5(...conds));
    if (candidateRows.length !== uniqueSquadIds.length) {
      res.status(400).json({
        error: "One or more selected squad players are not eligible student accounts."
      });
      return;
    }
    const inductedRows = await db.select({ playerProfileId: clubMemberships.playerProfileId }).from(clubMemberships).where(
      and5(
        eq6(clubMemberships.clubId, club.id),
        eq6(clubMemberships.status, "INDUCTED"),
        inArray2(clubMemberships.playerProfileId, uniqueSquadIds)
      )
    );
    const inductedSet = new Set(inductedRows.map((r) => r.playerProfileId));
    const rowByProfileId = new Map(candidateRows.map((r) => [r.playerProfileId, r]));
    resolvedSquad = uniqueSquadIds.map((pid) => rowByProfileId.get(pid)).filter((r) => Boolean(r)).map((r) => ({
      userId: r.userId,
      playerProfileId: r.playerProfileId,
      name: r.name,
      rollNumber: r.rollNumber,
      batch: r.batch,
      branch: r.branch,
      isClubMember: inductedSet.has(r.playerProfileId)
    }));
  }
  const { created, recipientUserIds } = await db.transaction(async (tx) => {
    const [act] = await tx.insert(clubActivities).values({
      clubId: club.id,
      activityType: parsed.data.activityType,
      customTypeLabel: parsed.data.activityType === "OTHER" ? parsed.data.customTypeLabel?.trim() || null : null,
      targetBatch: parsed.data.targetBatch,
      category: parsed.data.category,
      scheduledAt: new Date(parsed.data.scheduledAt),
      venue: parsed.data.venue.trim(),
      notes: parsed.data.notes?.trim() || null,
      selectedSquadJson: resolvedSquad,
      createdBy: req.actor.id
    }).returning();
    const eligibleStatuses = parsed.data.activityType === "INDUCTION" ? ["INDUCTED", "APPLIED", "TRIAL_ATTENDED"] : ["INDUCTED"];
    const memberRows = await tx.select({ userId: playerProfiles.userId, batch: playerProfiles.batch }).from(clubMemberships).innerJoin(playerProfiles, eq6(clubMemberships.playerProfileId, playerProfiles.id)).where(
      and5(
        eq6(clubMemberships.clubId, club.id),
        inArray2(clubMemberships.status, eligibleStatuses)
      )
    );
    const clubMemberTargetIds = memberRows.filter(
      (m) => m.userId !== null && m.userId !== req.actor.id && (parsed.data.targetBatch === "ALL" || m.batch === parsed.data.targetBatch)
    ).map((m) => m.userId);
    const squadUserIdSet = new Set(
      resolvedSquad.map((s) => s.userId).filter((uid) => uid !== req.actor.id)
    );
    const targetIds = Array.from(/* @__PURE__ */ new Set([...clubMemberTargetIds, ...squadUserIdSet]));
    const typeDisplay = act.activityType === "OTHER" && act.customTypeLabel ? act.customTypeLabel : act.activityType === "INTER_IIIT" ? "Inter-IIIT Selection" : act.activityType === "EXTERNAL_MATCH" ? "External Match Selection" : act.activityType;
    if (targetIds.length > 0) {
      await tx.insert(notifications).values(
        targetIds.map((uid) => ({
          userId: uid,
          title: squadUserIdSet.has(uid) ? `${club.name}: Selected for ${typeDisplay}` : `${club.name}: ${typeDisplay}`,
          message: squadUserIdSet.has(uid) ? `You have been named in the ${act.category} squad at ${act.venue}.` : `${act.targetBatch} \u2022 ${act.category} at ${act.venue}`,
          linkUrl: `/clubs/${club.slug}`
        }))
      );
    }
    await recordAuditLog(tx, req.actor.id, "CREATE_CLUB_ACTIVITY", "club_activities", act.id, {
      clubSlug: club.slug,
      notifiedCount: targetIds.length,
      squadCount: resolvedSquad.length
    });
    return { created: act, recipientUserIds: targetIds };
  });
  broadcastSse("CLUB_ACTIVITY", { clubSlug: club.slug, activity: created });
  if (recipientUserIds.length > 0) {
    broadcastSse("NOTIFICATION", { clubSlug: club.slug }, recipientUserIds);
  }
  res.status(201).json({ activity: created, notifiedCount: recipientUserIds.length });
});
router3.patch("/:slug/activities/:activityId", requireAuth, async (req, res) => {
  const [club] = await db.select().from(sportsClubs).where(eq6(sportsClubs.slug, String(req.params.slug))).limit(1);
  if (!club) {
    res.status(404).json({ error: "Club not found." });
    return;
  }
  const parsed = activitySchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid activity update payload." });
    return;
  }
  const activityId = parsePositiveIntId(req.params.activityId);
  if (!activityId) {
    res.status(400).json({ error: "Invalid activity ID." });
    return;
  }
  const [existing] = await db.select().from(clubActivities).where(and5(eq6(clubActivities.id, activityId), eq6(clubActivities.clubId, club.id))).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Activity not found." });
    return;
  }
  const nextTargetBatch = parsed.data.targetBatch ?? existing.targetBatch;
  const canManageExisting = await canActorManageClubBatch(req.actor, club.id, existing.targetBatch);
  const canManageTarget = await canActorManageClubBatch(req.actor, club.id, nextTargetBatch);
  if (!canManageExisting || !canManageTarget) {
    res.status(403).json({ error: "Unauthorized to edit this activity." });
    return;
  }
  const existingSquad = Array.isArray(existing.selectedSquadJson) ? existing.selectedSquadJson : [];
  const isSecretaryOnlyActivity = existing.activityType === "INTER_IIIT" || existing.activityType === "EXTERNAL_MATCH" || parsed.data.activityType === "INTER_IIIT" || parsed.data.activityType === "EXTERNAL_MATCH" || existingSquad.length > 0 || (parsed.data.selectedPlayerProfileIds?.length ?? 0) > 0;
  if (isSecretaryOnlyActivity && !await canActorActAsClubSecretary(req.actor, club.id)) {
    res.status(403).json({
      error: "Only the Club Secretary or Sports Secretary can edit Inter-IIIT / External Match activities or team selections."
    });
    return;
  }
  const [updated] = await db.update(clubActivities).set({
    ...parsed.data.activityType ? { activityType: parsed.data.activityType } : {},
    ...parsed.data.customTypeLabel !== void 0 ? { customTypeLabel: parsed.data.customTypeLabel } : {},
    ...parsed.data.targetBatch ? { targetBatch: parsed.data.targetBatch } : {},
    ...parsed.data.category ? { category: parsed.data.category } : {},
    ...parsed.data.scheduledAt ? { scheduledAt: new Date(parsed.data.scheduledAt) } : {},
    ...parsed.data.venue ? { venue: parsed.data.venue.trim() } : {},
    ...parsed.data.notes !== void 0 ? { notes: parsed.data.notes } : {}
  }).where(eq6(clubActivities.id, activityId)).returning();
  broadcastSse("CLUB_ACTIVITY", { clubSlug: club.slug, activity: updated });
  res.json({ activity: updated });
});
router3.delete("/:slug/activities/:activityId", requireAuth, async (req, res) => {
  const [club] = await db.select().from(sportsClubs).where(eq6(sportsClubs.slug, String(req.params.slug))).limit(1);
  if (!club) {
    res.status(404).json({ error: "Club not found." });
    return;
  }
  const activityId = parsePositiveIntId(req.params.activityId);
  if (!activityId) {
    res.status(400).json({ error: "Invalid activity ID." });
    return;
  }
  const [existing] = await db.select().from(clubActivities).where(and5(eq6(clubActivities.id, activityId), eq6(clubActivities.clubId, club.id))).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Activity not found." });
    return;
  }
  if (!await canActorManageClubBatch(req.actor, club.id, existing.targetBatch)) {
    res.status(403).json({ error: "Unauthorized to delete this activity." });
    return;
  }
  const existingSquad = Array.isArray(existing.selectedSquadJson) ? existing.selectedSquadJson : [];
  if ((existing.activityType === "INTER_IIIT" || existing.activityType === "EXTERNAL_MATCH" || existingSquad.length > 0) && !await canActorActAsClubSecretary(req.actor, club.id)) {
    res.status(403).json({
      error: "Only the Club Secretary or Sports Secretary can delete Inter-IIIT / External Match activities or team selections."
    });
    return;
  }
  await db.delete(clubActivities).where(eq6(clubActivities.id, activityId));
  broadcastSse("CLUB_ACTIVITY", { clubSlug: club.slug, deletedId: activityId });
  res.json({ ok: true });
});
router3.post("/:slug/toggle-induction", requireAuth, async (req, res) => {
  const [club] = await db.select().from(sportsClubs).where(eq6(sportsClubs.slug, String(req.params.slug))).limit(1);
  if (!club) {
    res.status(404).json({ error: "Club not found." });
    return;
  }
  if (!await canActorActAsClubSecretary(req.actor, club.id)) {
    res.status(403).json({ error: "Only the Club Secretary or Sports Secretary can open/close inductions." });
    return;
  }
  const schema = z3.object({ inductionOpen: z3.boolean() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload." });
    return;
  }
  const [updated] = await db.update(sportsClubs).set({ inductionOpen: parsed.data.inductionOpen }).where(eq6(sportsClubs.id, club.id)).returning();
  res.json({ club: updated });
});
async function handleApplyInduction(req, res) {
  const [club] = await db.select().from(sportsClubs).where(eq6(sportsClubs.slug, String(req.params.slug))).limit(1);
  if (!club) {
    res.status(404).json({ error: "Club not found." });
    return;
  }
  if (!club.inductionOpen) {
    res.status(400).json({ error: "Inductions are currently closed for this club." });
    return;
  }
  let playerProfileId = req.actor?.playerProfileId ?? null;
  if (!playerProfileId && req.actor && req.actor.accountType === "STUDENT") {
    const [createdProfile] = await db.insert(playerProfiles).values({
      userId: req.actor.id,
      displayName: req.actor.name,
      batch: req.actor.batch,
      rollNumber: req.actor.rollNumber,
      avatarUrl: req.actor.avatarUrl,
      visibility: "PUBLIC",
      isClaimed: true
    }).returning({ id: playerProfiles.id });
    playerProfileId = createdProfile?.id ?? null;
  }
  if (!playerProfileId) {
    res.status(403).json({ error: "Only students with a player profile can apply for club induction." });
    return;
  }
  const result = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(clubMemberships).where(
      and5(
        eq6(clubMemberships.clubId, club.id),
        eq6(clubMemberships.playerProfileId, playerProfileId)
      )
    ).limit(1);
    if (existing && existing.status !== "REJECTED") {
      return { ok: false, status: 409, error: `Already applied or inducted in this club (status: ${existing.status}).` };
    }
    if (existing) {
      const [reapplied] = await tx.update(clubMemberships).set({
        status: "APPLIED",
        trialNotes: null,
        evaluationScore: null,
        evaluatedBy: null,
        approvedBy: null,
        inductedAt: null
      }).where(
        and5(
          eq6(clubMemberships.id, existing.id),
          eq6(clubMemberships.status, "REJECTED")
        )
      ).returning();
      if (!reapplied) {
        return { ok: false, status: 409, error: "Induction state changed concurrently; please refresh." };
      }
      return { ok: true, membership: reapplied };
    }
    const [inserted] = await tx.insert(clubMemberships).values({
      clubId: club.id,
      playerProfileId,
      role: "MEMBER",
      status: "APPLIED"
    }).returning();
    return { ok: true, membership: inserted };
  });
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.status(201).json({ membership: result.membership });
}
router3.post("/:slug/inductions/apply", requireAuth, handleApplyInduction);
router3.post("/:slug/induction-apply", requireAuth, handleApplyInduction);
router3.patch("/:slug/inductions/:membershipId/trial", requireAuth, async (req, res) => {
  const [club] = await db.select().from(sportsClubs).where(eq6(sportsClubs.slug, String(req.params.slug))).limit(1);
  if (!club) {
    res.status(404).json({ error: "Club not found." });
    return;
  }
  const membershipId = parsePositiveIntId(req.params.membershipId);
  if (!membershipId) {
    res.status(400).json({ error: "Invalid induction record ID." });
    return;
  }
  const [target] = await db.select({
    membership: clubMemberships,
    batch: playerProfiles.batch
  }).from(clubMemberships).innerJoin(playerProfiles, eq6(clubMemberships.playerProfileId, playerProfiles.id)).where(and5(eq6(clubMemberships.id, membershipId), eq6(clubMemberships.clubId, club.id))).limit(1);
  if (!target) {
    res.status(404).json({ error: "Induction record not found." });
    return;
  }
  if (!canEvaluateClubTrial(req.actor, club.id, target.batch) && !await canActorManageClubBatch(req.actor, club.id, target.batch)) {
    res.status(403).json({
      error: `Unauthorized: Only ${target.batch}-year coordinator, Club Secretary, or Sports Secretary can record this trial.`
    });
    return;
  }
  const schema = z3.object({
    trialNotes: z3.string().min(2).max(500),
    evaluationScore: z3.number().int().min(1).max(10).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Provide valid trial evaluation notes." });
    return;
  }
  if (target.membership.status !== "APPLIED") {
    res.status(409).json({
      error: `Trial attendance can only be recorded when status is APPLIED (current: ${target.membership.status}).`
    });
    return;
  }
  const [updated] = await db.transaction(async (tx) => {
    return tx.update(clubMemberships).set({
      status: "TRIAL_ATTENDED",
      trialNotes: parsed.data.trialNotes.trim(),
      evaluationScore: parsed.data.evaluationScore ?? null,
      evaluatedBy: req.actor.id
    }).where(
      and5(
        eq6(clubMemberships.id, membershipId),
        eq6(clubMemberships.status, "APPLIED")
      )
    ).returning();
  });
  if (!updated) {
    res.status(409).json({
      error: "Trial attendance transition conflict: status is no longer APPLIED."
    });
    return;
  }
  res.json({ membership: updated });
});
async function handleInductionDecision(req, res) {
  const [club] = await db.select().from(sportsClubs).where(eq6(sportsClubs.slug, String(req.params.slug))).limit(1);
  if (!club) {
    res.status(404).json({ error: "Club not found." });
    return;
  }
  if (!await canActorActAsClubSecretary(req.actor, club.id)) {
    res.status(403).json({ error: "Only the Club Secretary or Sports Secretary can approve/reject inductions." });
    return;
  }
  const schema = z3.object({
    decision: z3.enum(["INDUCTED", "REJECTED"]),
    notes: z3.string().max(300).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid decision payload." });
    return;
  }
  const membershipId = parsePositiveIntId(req.params.membershipId);
  if (!membershipId) {
    res.status(400).json({ error: "Invalid induction record ID." });
    return;
  }
  const [target] = await db.select({
    membership: clubMemberships,
    userId: playerProfiles.userId
  }).from(clubMemberships).innerJoin(playerProfiles, eq6(clubMemberships.playerProfileId, playerProfiles.id)).where(and5(eq6(clubMemberships.id, membershipId), eq6(clubMemberships.clubId, club.id))).limit(1);
  if (!target) {
    res.status(404).json({ error: "Induction application not found." });
    return;
  }
  if (target.membership.status === "INDUCTED" || target.membership.status === "REJECTED") {
    res.status(409).json({
      error: `Induction application is already finalized as ${target.membership.status} and cannot be changed.`
    });
    return;
  }
  const expectedPriorStatus = target.membership.status;
  if (expectedPriorStatus === "APPLIED" && parsed.data.decision === "INDUCTED") {
    res.status(400).json({
      error: "Invalid induction transition: APPLIED -> INDUCTED is not allowed. Candidate must be marked TRIAL_ATTENDED first."
    });
    return;
  }
  if (expectedPriorStatus !== "TRIAL_ATTENDED" && expectedPriorStatus !== "APPLIED") {
    res.status(400).json({
      error: `Invalid induction transition from ${expectedPriorStatus}.`
    });
    return;
  }
  const txResult = await db.transaction(async (tx) => {
    const [row] = await tx.update(clubMemberships).set({
      status: parsed.data.decision,
      approvedBy: req.actor.id,
      inductedAt: parsed.data.decision === "INDUCTED" ? /* @__PURE__ */ new Date() : null,
      ...parsed.data.notes ? { trialNotes: parsed.data.notes } : {}
    }).where(
      and5(
        eq6(clubMemberships.id, membershipId),
        eq6(clubMemberships.status, expectedPriorStatus)
      )
    ).returning();
    if (!row) {
      return {
        ok: false,
        status: 409,
        error: "Induction status changed concurrently; please refresh."
      };
    }
    if (parsed.data.decision === "INDUCTED" && target.userId) {
      const [existingRole] = await tx.select({ id: userRoles.id }).from(userRoles).where(
        and5(
          eq6(userRoles.userId, target.userId),
          eq6(userRoles.roleCode, "CLUB_MEMBER"),
          eq6(userRoles.clubId, club.id),
          eq6(userRoles.active, true)
        )
      ).limit(1);
      if (!existingRole) {
        await tx.insert(userRoles).values({
          userId: target.userId,
          roleCode: "CLUB_MEMBER",
          clubId: club.id,
          grantedBy: req.actor.id
        });
      }
    }
    if (target.userId) {
      await tx.insert(notifications).values({
        userId: target.userId,
        title: `${club.name} Induction ${parsed.data.decision === "INDUCTED" ? "Approved" : "Update"}`,
        message: parsed.data.decision === "INDUCTED" ? `Congratulations! You are now an inducted member of ${club.name}.` : `Your induction application for ${club.name} was not selected this cycle.`,
        linkUrl: `/clubs/${club.slug}`
      });
    }
    await recordAuditLog(tx, req.actor.id, `INDUCTION_${parsed.data.decision}`, "club_memberships", membershipId, {
      clubSlug: club.slug
    });
    return { ok: true, membership: row };
  });
  if (!txResult.ok) {
    res.status(txResult.status).json({ error: txResult.error });
    return;
  }
  if (target.userId) {
    broadcastSse("NOTIFICATION", { clubSlug: club.slug }, [target.userId]);
  }
  res.json({ membership: txResult.membership });
}
router3.patch("/:slug/inductions/:membershipId/decision", requireAuth, handleInductionDecision);
router3.patch("/:slug/inductions/:membershipId", requireAuth, handleInductionDecision);
router3.post("/:slug/coordinators", requireAuth, async (req, res) => {
  const [club] = await db.select().from(sportsClubs).where(eq6(sportsClubs.slug, String(req.params.slug))).limit(1);
  if (!club) {
    res.status(404).json({ error: "Club not found." });
    return;
  }
  if (!await canActorActAsClubSecretary(req.actor, club.id)) {
    res.status(403).json({
      error: "Only the Club Secretary, Sports Secretary, or Faculty Advisor can appoint batch coordinators."
    });
    return;
  }
  const schema = z3.object({
    userId: z3.number().int().positive(),
    batchScope: z3.enum(["1ST", "2ND", "3RD", "4TH", "MTECH", "ALL"]),
    scopeLabel: z3.string().max(40).nullable().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid coordinator appointment payload." });
    return;
  }
  const candidateErr = await assertStudentCandidate(parsed.data.userId);
  if (candidateErr) {
    res.status(400).json({ error: candidateErr });
    return;
  }
  const cleanLabel = parsed.data.scopeLabel?.trim() || null;
  const outcome = await db.transaction(async (tx) => {
    const result = await appointClubCoordinator(tx, {
      clubId: club.id,
      targetUserId: parsed.data.userId,
      batchScope: parsed.data.batchScope,
      scopeLabel: cleanLabel,
      actorId: req.actor.id
    });
    if (!result.ok) return result;
    await tx.insert(notifications).values({
      userId: parsed.data.userId,
      title: `${club.name}: Batch Coordinator Appointed`,
      message: `${parsed.data.batchScope} Year${cleanLabel ? ` (${cleanLabel})` : ""} coordinator access granted.`,
      linkUrl: `/clubs/${club.slug}`
    });
    await recordAuditLog(
      tx,
      req.actor.id,
      "APPOINT_CLUB_COORDINATOR",
      "club_memberships",
      result.membership.id,
      {
        clubSlug: club.slug,
        targetUserId: parsed.data.userId,
        batchScope: parsed.data.batchScope,
        scopeLabel: cleanLabel
      }
    );
    return result;
  });
  if (!outcome.ok) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }
  broadcastSse("NOTIFICATION", { clubSlug: club.slug }, [parsed.data.userId]);
  res.status(201).json({ membership: outcome.membership });
});
router3.delete("/:slug/coordinators/:membershipId", requireAuth, async (req, res) => {
  const [club] = await db.select().from(sportsClubs).where(eq6(sportsClubs.slug, String(req.params.slug))).limit(1);
  if (!club) {
    res.status(404).json({ error: "Club not found." });
    return;
  }
  if (!await canActorActAsClubSecretary(req.actor, club.id)) {
    res.status(403).json({
      error: "Only the Club Secretary, Sports Secretary, or Faculty Advisor can remove batch coordinators."
    });
    return;
  }
  const membershipId = parsePositiveIntId(req.params.membershipId);
  if (!membershipId) {
    res.status(400).json({ error: "Invalid induction record ID." });
    return;
  }
  if (!Number.isInteger(membershipId) || membershipId <= 0) {
    res.status(400).json({ error: "Invalid coordinator membership ID." });
    return;
  }
  const removed = await db.transaction(async (tx) => {
    const resRow = await removeClubCoordinator(tx, { clubId: club.id, membershipId });
    if (!resRow) return null;
    if (resRow.targetUserId) {
      await tx.insert(notifications).values({
        userId: resRow.targetUserId,
        title: `${club.name}: Coordinator Role Updated`,
        message: `You are no longer listed as ${resRow.batchScope ?? ""} batch coordinator for ${club.name}.`,
        linkUrl: `/clubs/${club.slug}`
      });
    }
    await recordAuditLog(
      tx,
      req.actor.id,
      "REMOVE_CLUB_COORDINATOR",
      "club_memberships",
      membershipId,
      {
        clubSlug: club.slug,
        targetUserId: resRow.targetUserId,
        batchScope: resRow.batchScope
      }
    );
    return resRow;
  });
  if (!removed) {
    res.status(404).json({ error: "Coordinator record not found for this club." });
    return;
  }
  if (removed.targetUserId) {
    broadcastSse("NOTIFICATION", { clubSlug: club.slug }, [removed.targetUserId]);
  }
  res.json({ ok: true, removed });
});
router3.delete("/:slug/members/:membershipId", requireAuth, async (req, res) => {
  const [club] = await db.select().from(sportsClubs).where(eq6(sportsClubs.slug, String(req.params.slug))).limit(1);
  if (!club) {
    res.status(404).json({ error: "Club not found." });
    return;
  }
  if (!await canActorActAsClubSecretary(req.actor, club.id)) {
    res.status(403).json({
      error: "Only the Club Secretary, Sports Secretary, or Faculty Advisor can remove club members."
    });
    return;
  }
  const membershipId = parsePositiveIntId(req.params.membershipId);
  if (!membershipId) {
    res.status(400).json({ error: "Invalid induction record ID." });
    return;
  }
  if (!Number.isInteger(membershipId) || membershipId <= 0) {
    res.status(400).json({ error: "Invalid membership ID." });
    return;
  }
  const [target] = await db.select({
    membership: clubMemberships,
    userId: playerProfiles.userId,
    displayName: playerProfiles.displayName
  }).from(clubMemberships).innerJoin(playerProfiles, eq6(clubMemberships.playerProfileId, playerProfiles.id)).where(and5(eq6(clubMemberships.id, membershipId), eq6(clubMemberships.clubId, club.id))).limit(1);
  if (!target) {
    res.status(404).json({ error: "Club membership record not found." });
    return;
  }
  if (target.membership.role === "SECRETARY" && !hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({
      error: "Only the Sports Secretary or Faculty Advisor can remove an active Club Secretary."
    });
    return;
  }
  await db.transaction(async (tx) => {
    await tx.delete(clubMemberships).where(eq6(clubMemberships.id, membershipId));
    if (target.userId) {
      const rolesToDeactivate = target.membership.role === "SECRETARY" ? ["CLUB_MEMBER", "CLUB_COORDINATOR", "CLUB_SECRETARY"] : ["CLUB_MEMBER", "CLUB_COORDINATOR"];
      await tx.update(userRoles).set({ active: false }).where(
        and5(
          eq6(userRoles.userId, target.userId),
          eq6(userRoles.clubId, club.id),
          inArray2(userRoles.roleCode, rolesToDeactivate),
          eq6(userRoles.active, true)
        )
      );
      await tx.insert(notifications).values({
        userId: target.userId,
        title: `${club.name}: Membership Updated`,
        message: `Your membership in ${club.name} was removed by ${req.actor.name}.`,
        linkUrl: `/clubs/${club.slug}`
      });
    }
    await recordAuditLog(
      tx,
      req.actor.id,
      "REMOVE_CLUB_MEMBER",
      "club_memberships",
      membershipId,
      {
        clubSlug: club.slug,
        removedUserId: target.userId,
        removedName: target.displayName,
        previousRole: target.membership.role
      }
    );
  });
  if (target.userId) {
    broadcastSse("NOTIFICATION", { clubSlug: club.slug }, [target.userId]);
  }
  res.json({ ok: true, removedMembershipId: membershipId });
});
var clubs_default = router3;

// server/routes/roles.ts
import { Router as Router4 } from "express";
import { and as and6, asc as asc3, desc as desc3, eq as eq7, ilike, inArray as inArray3, isNull as isNull2, ne, notInArray as notInArray3, or as or3 } from "drizzle-orm";
import { z as z4 } from "zod";
var router4 = Router4();
router4.get("/directory", requireAuth, async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const batchFilter = String(req.query.batch ?? "").trim();
  const branchFilter = String(req.query.branch ?? "").trim();
  const excludedIds = await getExcludedNonStudentIds();
  const baseConditions = [eq7(users.accountType, "STUDENT")];
  if (excludedIds.length > 0) {
    baseConditions.push(notInArray3(users.id, excludedIds));
  }
  const conditions = [...baseConditions];
  if (batchFilter) {
    conditions.push(eq7(users.batch, batchFilter));
  }
  if (branchFilter) {
    conditions.push(ilike(playerProfiles.branch, branchFilter));
  }
  if (q) {
    conditions.push(
      or3(
        ilike(users.name, `%${q}%`),
        ilike(users.rollNumber, `%${q}%`),
        ilike(users.batch, `%${q}%`),
        ilike(playerProfiles.branch, `%${q}%`),
        ilike(users.email, `%${q}%`)
      )
    );
  }
  const [rows, facetRows] = await Promise.all([
    db.select({
      userId: users.id,
      playerProfileId: playerProfiles.id,
      name: users.name,
      rollNumber: users.rollNumber,
      batch: users.batch,
      branch: playerProfiles.branch
    }).from(users).innerJoin(playerProfiles, eq7(playerProfiles.userId, users.id)).where(and6(...conditions)).orderBy(asc3(users.name)).limit(30),
    db.select({
      batch: users.batch,
      branch: playerProfiles.branch
    }).from(users).innerJoin(playerProfiles, eq7(playerProfiles.userId, users.id)).where(and6(...baseConditions))
  ]);
  const batches = Array.from(new Set(facetRows.map((f) => f.batch).filter(Boolean))).sort();
  const branches = Array.from(
    new Set(facetRows.map((f) => f.branch).filter((b) => Boolean(b)))
  ).sort();
  res.json({ students: rows, batches, branches });
});
router4.get("/requests", requireAuth, async (req, res) => {
  const actor = req.actor;
  const isGlobal = hasGlobalSportsAuthority(actor);
  let secretaryClubIds = [];
  if (!isGlobal) {
    const roleClubIds = actor.roles.filter((r) => r.roleCode === "CLUB_SECRETARY" && r.clubId !== null).map((r) => r.clubId);
    const membershipClubs = actor.playerProfileId ? await db.select({ clubId: clubMemberships.clubId }).from(clubMemberships).where(
      and6(
        eq7(clubMemberships.playerProfileId, actor.playerProfileId),
        eq7(clubMemberships.role, "SECRETARY"),
        eq7(clubMemberships.status, "INDUCTED")
      )
    ) : [];
    secretaryClubIds = Array.from(/* @__PURE__ */ new Set([...roleClubIds, ...membershipClubs.map((m) => m.clubId)]));
  }
  const scopeFilter = isGlobal ? void 0 : secretaryClubIds.length > 0 ? or3(
    inArray3(roleRequests.clubId, secretaryClubIds),
    eq7(roleRequests.requesterUserId, actor.id),
    eq7(roleRequests.targetUserId, actor.id)
  ) : or3(eq7(roleRequests.requesterUserId, actor.id), eq7(roleRequests.targetUserId, actor.id));
  const rows = await db.select({
    id: roleRequests.id,
    requesterUserId: roleRequests.requesterUserId,
    targetUserId: roleRequests.targetUserId,
    requestedRole: roleRequests.requestedRole,
    action: roleRequests.action,
    clubId: roleRequests.clubId,
    batchScope: roleRequests.batchScope,
    scopeLabel: roleRequests.scopeLabel,
    matchId: roleRequests.matchId,
    auctionId: roleRequests.auctionId,
    reason: roleRequests.reason,
    status: roleRequests.status,
    reviewNotes: roleRequests.reviewNotes,
    createdAt: roleRequests.createdAt,
    reviewedAt: roleRequests.reviewedAt
  }).from(roleRequests).where(scopeFilter).orderBy(desc3(roleRequests.createdAt));
  const allUsers = await db.select({ id: users.id, name: users.name, rollNumber: users.rollNumber, batch: users.batch }).from(users);
  const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u]));
  const allClubs = await db.select({ id: sportsClubs.id, name: sportsClubs.name }).from(sportsClubs);
  const clubMap = Object.fromEntries(allClubs.map((c) => [c.id, c]));
  const matchIds = Array.from(new Set(rows.map((r) => r.matchId).filter((id) => id !== null)));
  const matchLabelMap = {};
  if (matchIds.length > 0) {
    const matchRows = await db.select({
      id: matches.id,
      status: matches.status,
      roundLabel: matches.roundLabel,
      sportId: matches.sportId,
      teamAId: matches.teamAId,
      teamBId: matches.teamBId
    }).from(matches).where(inArray3(matches.id, matchIds));
    const allSports = await db.select({ id: sports.id, name: sports.name }).from(sports);
    const sportNameMap = Object.fromEntries(allSports.map((s) => [s.id, s.name]));
    const teamIds = Array.from(new Set(matchRows.flatMap((m) => [m.teamAId, m.teamBId])));
    const teamRows = teamIds.length > 0 ? await db.select({ id: teams.id, shortCode: teams.shortCode }).from(teams).where(inArray3(teams.id, teamIds)) : [];
    const teamCodeMap = Object.fromEntries(teamRows.map((t) => [t.id, t.shortCode]));
    for (const m of matchRows) {
      matchLabelMap[m.id] = `[${m.status}] ${sportNameMap[m.sportId] ?? "Sport"}: ${teamCodeMap[m.teamAId] ?? "T1"} vs ${teamCodeMap[m.teamBId] ?? "T2"} (${m.roundLabel})`;
    }
  }
  res.json({
    requests: rows.map((r) => ({
      ...r,
      requester: userMap[r.requesterUserId] ?? null,
      target: userMap[r.targetUserId] ?? null,
      clubName: r.clubId ? clubMap[r.clubId]?.name ?? null : null,
      matchLabel: r.matchId ? matchLabelMap[r.matchId] ?? `Match #${r.matchId}` : null
    }))
  });
});
router4.post("/requests", requireAuth, async (req, res) => {
  const schema = z4.object({
    targetUserId: z4.number().int().positive(),
    requestedRole: z4.enum(["CLUB_SECRETARY", "CLUB_COORDINATOR", "MATCH_SCORER", "AUCTION_OPERATOR"]),
    action: z4.enum(["APPOINT", "REMOVE"]),
    clubId: z4.number().int().positive().nullable().optional(),
    batchScope: z4.enum(["1ST", "2ND", "3RD", "4TH", "MTECH", "ALL"]).nullable().optional(),
    scopeLabel: z4.string().max(40).nullable().optional(),
    matchId: z4.number().int().positive().nullable().optional(),
    auctionId: z4.number().int().positive().nullable().optional(),
    reason: z4.string().min(3).max(300)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid role request payload." });
    return;
  }
  if ((parsed.data.requestedRole === "CLUB_SECRETARY" || parsed.data.requestedRole === "CLUB_COORDINATOR") && !parsed.data.clubId) {
    res.status(400).json({ error: "Club selection is required for Club Secretary / Coordinator requests." });
    return;
  }
  if (parsed.data.requestedRole === "CLUB_COORDINATOR" && !parsed.data.batchScope) {
    res.status(400).json({ error: "Explicit batchScope (1ST, 2ND, 3RD, 4TH, MTECH, or ALL) is required for Club Coordinator requests." });
    return;
  }
  if (parsed.data.clubId) {
    const [clubRow] = await db.select({ id: sportsClubs.id }).from(sportsClubs).where(eq7(sportsClubs.id, parsed.data.clubId)).limit(1);
    if (!clubRow) {
      res.status(404).json({ error: "Referenced sports club not found." });
      return;
    }
  }
  if (parsed.data.matchId) {
    const [matchRow] = await db.select({ id: matches.id }).from(matches).where(eq7(matches.id, parsed.data.matchId)).limit(1);
    if (!matchRow) {
      res.status(404).json({ error: "Referenced match not found." });
      return;
    }
  }
  let resolvedAuctionId = parsed.data.auctionId ?? null;
  if (parsed.data.requestedRole === "AUCTION_OPERATOR") {
    if (resolvedAuctionId) {
      const [aucRow] = await db.select({ id: auctions.id }).from(auctions).where(eq7(auctions.id, resolvedAuctionId)).limit(1);
      if (!aucRow) {
        res.status(404).json({ error: "Referenced auction not found." });
        return;
      }
    } else {
      const recentAuctions = await db.select({ id: auctions.id }).from(auctions).orderBy(desc3(auctions.id)).limit(2);
      if (recentAuctions.length !== 1) {
        res.status(400).json({ error: "Explicit auctionId is required for Auction Operator requests." });
        return;
      }
      resolvedAuctionId = recentAuctions[0].id;
    }
  } else if (resolvedAuctionId) {
    const [aucRow] = await db.select({ id: auctions.id }).from(auctions).where(eq7(auctions.id, resolvedAuctionId)).limit(1);
    if (!aucRow) {
      res.status(404).json({ error: "Referenced auction not found." });
      return;
    }
  }
  const candidateErr = await assertStudentCandidate(parsed.data.targetUserId);
  if (candidateErr) {
    res.status(400).json({ error: candidateErr });
    return;
  }
  const [created] = await db.insert(roleRequests).values({
    requesterUserId: req.actor.id,
    targetUserId: parsed.data.targetUserId,
    requestedRole: parsed.data.requestedRole,
    action: parsed.data.action,
    clubId: parsed.data.clubId ?? null,
    batchScope: parsed.data.batchScope ?? null,
    scopeLabel: parsed.data.requestedRole === "CLUB_COORDINATOR" ? parsed.data.scopeLabel?.trim() || null : null,
    matchId: parsed.data.matchId ?? null,
    auctionId: resolvedAuctionId,
    reason: parsed.data.reason.trim(),
    status: "PENDING"
  }).returning();
  res.status(201).json({ request: created });
});
router4.patch("/requests/:id/review", requireAuth, async (req, res) => {
  const requestId = parsePositiveIntId(req.params.id);
  if (!requestId) {
    res.status(400).json({ error: "Invalid role request ID." });
    return;
  }
  const schema = z4.object({
    decision: z4.enum(["APPROVED", "REJECTED"]),
    reviewNotes: z4.string().max(300).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid review payload." });
    return;
  }
  try {
    const result = await db.transaction(async (tx) => {
      const [reqRow] = await tx.select().from(roleRequests).where(eq7(roleRequests.id, requestId)).for("update").limit(1);
      if (!reqRow) {
        throw Object.assign(new Error("Role request not found."), { status: 404 });
      }
      if (reqRow.status !== "PENDING") {
        throw Object.assign(new Error("Role request has already been reviewed."), { status: 409 });
      }
      const isGlobal = hasGlobalSportsAuthority(req.actor);
      const isClubSecForClub = reqRow.requestedRole === "CLUB_COORDINATOR" && reqRow.clubId !== null && await canActorActAsClubSecretary(req.actor, reqRow.clubId);
      if (reqRow.requestedRole === "MATCH_SCORER" && !isGlobal) {
        throw Object.assign(
          new Error("Match Scorers can only be appointed or removed by the Sports Secretary."),
          { status: 403 }
        );
      }
      if (reqRow.requestedRole === "AUCTION_OPERATOR" && !isGlobal) {
        throw Object.assign(
          new Error("Auction Operators can only be appointed or removed by the Sports Secretary."),
          { status: 403 }
        );
      }
      if (reqRow.requestedRole === "CLUB_SECRETARY" && !isGlobal) {
        throw Object.assign(
          new Error("Club Secretaries can only be appointed or removed by the Sports Secretary."),
          { status: 403 }
        );
      }
      if (reqRow.requestedRole === "CLUB_COORDINATOR" && !isGlobal && !isClubSecForClub) {
        throw Object.assign(
          new Error("Only the Sports Secretary or that Club's Secretary can review Coordinators."),
          { status: 403 }
        );
      }
      const [reviewed] = await tx.update(roleRequests).set({
        status: parsed.data.decision,
        reviewedBy: req.actor.id,
        reviewNotes: parsed.data.reviewNotes?.trim() || null,
        reviewedAt: /* @__PURE__ */ new Date()
      }).where(and6(eq7(roleRequests.id, requestId), eq7(roleRequests.status, "PENDING"))).returning();
      if (!reviewed) {
        throw Object.assign(new Error("Role request has already been reviewed."), { status: 409 });
      }
      if (parsed.data.decision === "APPROVED") {
        if (reqRow.action === "APPOINT") {
          if (reqRow.requestedRole === "CLUB_COORDINATOR" && reqRow.clubId) {
            if (!reqRow.batchScope) {
              throw Object.assign(new Error("Explicit batchScope is required for Club Coordinator."), {
                status: 400
              });
            }
            const coordRes = await appointClubCoordinator(tx, {
              clubId: reqRow.clubId,
              targetUserId: reqRow.targetUserId,
              batchScope: reqRow.batchScope,
              scopeLabel: reqRow.scopeLabel,
              actorId: req.actor.id
            });
            if (!coordRes.ok) {
              throw Object.assign(new Error(coordRes.error), { status: coordRes.status });
            }
          } else {
            let effectiveAuctionId = reqRow.auctionId;
            if (reqRow.requestedRole === "AUCTION_OPERATOR" && !effectiveAuctionId) {
              const recentAuctions = await tx.select({ id: auctions.id }).from(auctions).orderBy(desc3(auctions.id)).limit(2);
              if (recentAuctions.length !== 1) {
                throw Object.assign(
                  new Error("Auction Operator appointment requires an explicit auctionId."),
                  { status: 400 }
                );
              }
              effectiveAuctionId = recentAuctions[0].id;
            }
            if (reqRow.clubId && reqRow.requestedRole === "CLUB_SECRETARY") {
              await tx.update(userRoles).set({ active: false }).where(
                and6(
                  eq7(userRoles.clubId, reqRow.clubId),
                  eq7(userRoles.roleCode, "CLUB_SECRETARY"),
                  eq7(userRoles.active, true),
                  ne(userRoles.userId, reqRow.targetUserId)
                )
              );
            }
            const existingSameRole = await tx.select({ id: userRoles.id }).from(userRoles).where(
              and6(
                eq7(userRoles.userId, reqRow.targetUserId),
                eq7(userRoles.roleCode, reqRow.requestedRole),
                eq7(userRoles.active, true),
                reqRow.clubId !== null ? eq7(userRoles.clubId, reqRow.clubId) : isNull2(userRoles.clubId),
                reqRow.matchId !== null ? eq7(userRoles.matchId, reqRow.matchId) : isNull2(userRoles.matchId),
                reqRow.batchScope !== null ? eq7(userRoles.batchScope, reqRow.batchScope) : isNull2(userRoles.batchScope),
                effectiveAuctionId !== null ? eq7(userRoles.auctionId, effectiveAuctionId) : isNull2(userRoles.auctionId)
              )
            ).limit(1);
            if (existingSameRole.length === 0) {
              await tx.insert(userRoles).values({
                userId: reqRow.targetUserId,
                roleCode: reqRow.requestedRole,
                clubId: reqRow.clubId,
                batchScope: reqRow.batchScope,
                scopeLabel: reqRow.scopeLabel,
                matchId: reqRow.matchId,
                auctionId: effectiveAuctionId,
                grantedBy: req.actor.id
              });
            }
            if (reqRow.requestedRole === "MATCH_SCORER" && reqRow.matchId) {
              await tx.update(matches).set({ scorerUserId: reqRow.targetUserId }).where(eq7(matches.id, reqRow.matchId));
            }
            if (reqRow.clubId && reqRow.requestedRole === "CLUB_SECRETARY") {
              const profileId = await ensureStudentPlayerProfileId(tx, reqRow.targetUserId);
              if (profileId) {
                await tx.update(clubMemberships).set({ role: "MEMBER", batchScope: null, scopeLabel: null }).where(
                  and6(
                    eq7(clubMemberships.clubId, reqRow.clubId),
                    eq7(clubMemberships.role, "SECRETARY"),
                    ne(clubMemberships.playerProfileId, profileId)
                  )
                );
                await tx.insert(clubMemberships).values({
                  clubId: reqRow.clubId,
                  playerProfileId: profileId,
                  role: "SECRETARY",
                  batchScope: reqRow.batchScope,
                  status: "INDUCTED",
                  approvedBy: req.actor.id,
                  inductedAt: /* @__PURE__ */ new Date()
                }).onConflictDoUpdate({
                  target: [clubMemberships.clubId, clubMemberships.playerProfileId],
                  set: {
                    role: "SECRETARY",
                    batchScope: reqRow.batchScope,
                    scopeLabel: null,
                    status: "INDUCTED",
                    approvedBy: req.actor.id
                  }
                });
              }
            }
          }
        } else {
          if (reqRow.requestedRole === "CLUB_COORDINATOR" && reqRow.clubId) {
            await removeClubCoordinator(tx, {
              clubId: reqRow.clubId,
              targetUserId: reqRow.targetUserId,
              batchScope: reqRow.batchScope
            });
          } else {
            const conditions = [
              eq7(userRoles.userId, reqRow.targetUserId),
              eq7(userRoles.roleCode, reqRow.requestedRole),
              eq7(userRoles.active, true)
            ];
            if (reqRow.clubId) conditions.push(eq7(userRoles.clubId, reqRow.clubId));
            if (reqRow.matchId) conditions.push(eq7(userRoles.matchId, reqRow.matchId));
            if (reqRow.auctionId) conditions.push(eq7(userRoles.auctionId, reqRow.auctionId));
            await tx.update(userRoles).set({ active: false }).where(and6(...conditions));
            if (reqRow.requestedRole === "MATCH_SCORER" && reqRow.matchId) {
              await tx.update(matches).set({ scorerUserId: null }).where(
                and6(
                  eq7(matches.id, reqRow.matchId),
                  eq7(matches.scorerUserId, reqRow.targetUserId)
                )
              );
            }
            if (reqRow.clubId && reqRow.requestedRole === "CLUB_SECRETARY") {
              const [prof] = await tx.select({ id: playerProfiles.id }).from(playerProfiles).where(eq7(playerProfiles.userId, reqRow.targetUserId)).limit(1);
              if (prof) {
                await tx.update(clubMemberships).set({ role: "MEMBER", batchScope: null, scopeLabel: null }).where(
                  and6(
                    eq7(clubMemberships.clubId, reqRow.clubId),
                    eq7(clubMemberships.playerProfileId, prof.id),
                    eq7(clubMemberships.role, "SECRETARY")
                  )
                );
              }
            }
          }
        }
        await tx.insert(notifications).values({
          userId: reqRow.targetUserId,
          title: `Role ${reqRow.action === "APPOINT" ? "Appointed" : "Removed"}: ${reqRow.requestedRole}`,
          message: `Approved by ${req.actor.name}.`,
          linkUrl: reqRow.requestedRole === "MATCH_SCORER" ? reqRow.matchId ? `/scorer?matchId=${reqRow.matchId}` : "/scorer" : "/roles"
        });
      }
      await recordAuditLog(tx, req.actor.id, `ROLE_REQUEST_${parsed.data.decision}`, "role_requests", requestId, {
        targetUserId: reqRow.targetUserId,
        role: reqRow.requestedRole,
        action: reqRow.action,
        matchId: reqRow.matchId,
        auctionId: reqRow.auctionId
      });
      return { reviewed, reqRow };
    });
    if (parsed.data.decision === "APPROVED") {
      broadcastSse("NOTIFICATION", { role: result.reqRow.requestedRole, matchId: result.reqRow.matchId }, [result.reqRow.targetUserId]);
      broadcastSse("NAV_UPDATED", { role: result.reqRow.requestedRole, targetUserId: result.reqRow.targetUserId });
      if (result.reqRow.requestedRole === "MATCH_SCORER" && result.reqRow.matchId) {
        broadcastSse("MATCH_STATUS", { matchId: result.reqRow.matchId });
      }
    }
    res.json({ request: result.reviewed });
  } catch (err) {
    const status = err?.status;
    if (status && status < 500) {
      res.status(status).json({ error: err.message });
      return;
    }
    throw err;
  }
});
router4.post("/handover-secretary", requireAuth, async (req, res) => {
  if (!isFacultyAdvisor(req.actor)) {
    res.status(403).json({ error: "Only the Faculty Advisor / PED can hand over Sports Secretary authority." });
    return;
  }
  const schema = z4.object({ newSecretaryUserId: z4.number().int().positive() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid user selected." });
    return;
  }
  const candidateErr = await assertStudentCandidate(parsed.data.newSecretaryUserId);
  if (candidateErr) {
    res.status(400).json({ error: candidateErr });
    return;
  }
  await db.transaction(async (tx) => {
    await tx.update(userRoles).set({ active: false }).where(and6(eq7(userRoles.roleCode, "SPORTS_SECRETARY"), eq7(userRoles.active, true)));
    await tx.insert(userRoles).values({
      userId: parsed.data.newSecretaryUserId,
      roleCode: "SPORTS_SECRETARY",
      grantedBy: req.actor.id
    });
    await tx.insert(notifications).values({
      userId: parsed.data.newSecretaryUserId,
      title: "Sports Secretary Handover Complete",
      message: `${req.actor.name} has transferred Institute Sports Secretary access to your account.`,
      linkUrl: "/roles"
    });
    await recordAuditLog(tx, req.actor.id, "HANDOVER_SPORTS_SECRETARY", "users", parsed.data.newSecretaryUserId, {});
  });
  broadcastSse("NOTIFICATION", { role: "SPORTS_SECRETARY" }, [parsed.data.newSecretaryUserId]);
  broadcastSse("NAV_UPDATED", { role: "SPORTS_SECRETARY", targetUserId: parsed.data.newSecretaryUserId });
  res.json({ ok: true });
});
router4.get("/holders", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can view active role holders." });
    return;
  }
  const rows = await db.select({
    id: userRoles.id,
    userId: userRoles.userId,
    roleCode: userRoles.roleCode,
    clubId: userRoles.clubId,
    batchScope: userRoles.batchScope,
    scopeLabel: userRoles.scopeLabel,
    matchId: userRoles.matchId,
    auctionId: userRoles.auctionId,
    createdAt: userRoles.createdAt,
    userName: users.name,
    rollNumber: users.rollNumber,
    batch: users.batch,
    clubName: sportsClubs.name
  }).from(userRoles).innerJoin(users, eq7(userRoles.userId, users.id)).leftJoin(sportsClubs, eq7(userRoles.clubId, sportsClubs.id)).where(
    and6(
      eq7(userRoles.active, true),
      inArray3(userRoles.roleCode, [
        "CLUB_SECRETARY",
        "CLUB_COORDINATOR",
        "MATCH_SCORER",
        "AUCTION_OPERATOR"
      ])
    )
  ).orderBy(asc3(userRoles.roleCode), asc3(users.name));
  res.json({ holders: rows });
});
router4.delete("/holders/:roleId", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can revoke active roles." });
    return;
  }
  const roleId = parsePositiveIntId(req.params.roleId);
  if (!roleId) {
    res.status(400).json({ error: "Invalid role assignment ID." });
    return;
  }
  const outcome = await db.transaction(async (tx) => {
    const [target] = await tx.select().from(userRoles).where(and6(eq7(userRoles.id, roleId), eq7(userRoles.active, true))).for("update").limit(1);
    if (!target) {
      return { ok: false, status: 404, error: "Active role assignment not found." };
    }
    if (!["CLUB_SECRETARY", "CLUB_COORDINATOR", "MATCH_SCORER", "AUCTION_OPERATOR"].includes(
      target.roleCode
    )) {
      return {
        ok: false,
        status: 400,
        error: "This role cannot be revoked directly from this endpoint."
      };
    }
    await tx.update(userRoles).set({ active: false }).where(eq7(userRoles.id, roleId));
    if (target.roleCode === "MATCH_SCORER" && target.matchId) {
      await tx.update(matches).set({ scorerUserId: null }).where(and6(eq7(matches.id, target.matchId), eq7(matches.scorerUserId, target.userId)));
    }
    if (target.clubId && target.roleCode === "CLUB_COORDINATOR") {
      await removeClubCoordinator(tx, {
        clubId: target.clubId,
        targetUserId: target.userId,
        batchScope: target.batchScope
      });
    } else if (target.clubId && target.roleCode === "CLUB_SECRETARY") {
      const [prof] = await tx.select({ id: playerProfiles.id }).from(playerProfiles).where(eq7(playerProfiles.userId, target.userId)).limit(1);
      if (prof) {
        await tx.update(clubMemberships).set({ role: "MEMBER", batchScope: null, scopeLabel: null }).where(
          and6(
            eq7(clubMemberships.clubId, target.clubId),
            eq7(clubMemberships.playerProfileId, prof.id),
            eq7(clubMemberships.role, "SECRETARY")
          )
        );
      }
    }
    await tx.insert(notifications).values({
      userId: target.userId,
      title: `Role Revoked: ${target.roleCode}`,
      message: `Revoked by ${req.actor.name}.`,
      linkUrl: "/roles"
    });
    await recordAuditLog(tx, req.actor.id, "REVOKE_ROLE_DIRECT", "user_roles", roleId, {
      targetUserId: target.userId,
      roleCode: target.roleCode,
      clubId: target.clubId,
      matchId: target.matchId
    });
    return { ok: true, target };
  });
  if (!outcome.ok) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }
  broadcastSse("NOTIFICATION", { role: outcome.target.roleCode }, [outcome.target.userId]);
  broadcastSse("NAV_UPDATED", { role: outcome.target.roleCode, targetUserId: outcome.target.userId });
  if (outcome.target.roleCode === "MATCH_SCORER" && outcome.target.matchId) {
    broadcastSse("MATCH_STATUS", { matchId: outcome.target.matchId });
  }
  res.json({ ok: true });
});
router4.post("/semester-rollover", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({
      error: "Only Sports Secretary or Faculty Advisor can run a controlled semester rollover."
    });
    return;
  }
  const schema = z4.object({
    term: z4.string().trim().min(3).max(32).regex(/^[A-Za-z0-9_-]+$/, "Term must be alphanumeric with _ or - (e.g., EVEN_2027).")
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Provide a valid academic term identifier (e.g., EVEN_2027)." });
    return;
  }
  const term = parsed.data.term.toUpperCase();
  const excludedIds = await getExcludedNonStudentIds();
  const excludedSet = new Set(excludedIds);
  const summary = await db.transaction(async (tx) => {
    const allUsers = await tx.select().from(users);
    let advancedCount = 0;
    let graduatedCount = 0;
    let skippedCount = 0;
    for (const u of allUsers) {
      if (excludedSet.has(u.id) || u.accountType !== "STUDENT") {
        skippedCount += 1;
        continue;
      }
      const outcome = computeSemesterRollover(
        {
          accountType: u.accountType,
          programType: u.programType ?? (u.batch === "MTECH" ? "MTECH" : "BTECH"),
          currentSemester: u.currentSemester ?? 1,
          lastIncrementedTerm: u.lastIncrementedTerm ?? null,
          isGraduated: Boolean(u.isGraduated)
        },
        term
      );
      if (outcome.action === "SKIP") {
        skippedCount += 1;
        continue;
      }
      await tx.update(users).set({
        college: FIXED_COLLEGE,
        currentSemester: outcome.nextSemester,
        batch: outcome.nextBatch,
        isGraduated: outcome.isGraduated,
        lastIncrementedTerm: outcome.lastIncrementedTerm
      }).where(eq7(users.id, u.id));
      await tx.update(playerProfiles).set({
        college: FIXED_COLLEGE,
        currentSemester: outcome.nextSemester,
        batch: outcome.nextBatch,
        isGraduated: outcome.isGraduated
      }).where(eq7(playerProfiles.userId, u.id));
      if (outcome.action === "GRADUATE") {
        graduatedCount += 1;
      } else {
        advancedCount += 1;
      }
    }
    await recordAuditLog(tx, req.actor.id, "SEMESTER_ROLLOVER", "academic_term", term, {
      term,
      advancedCount,
      graduatedCount,
      skippedCount
    });
    return { term, advancedCount, graduatedCount, skippedCount };
  });
  res.json({ ok: true, ...summary });
});
router4.get("/audit-logs", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Audit logs are restricted to Sports Secretary and Faculty Advisor." });
    return;
  }
  const rows = await db.select({
    id: auditLogs.id,
    actorUserId: auditLogs.actorUserId,
    action: auditLogs.action,
    entityType: auditLogs.entityType,
    entityId: auditLogs.entityId,
    metadataJson: auditLogs.metadataJson,
    createdAt: auditLogs.createdAt,
    actorName: users.name
  }).from(auditLogs).leftJoin(users, eq7(auditLogs.actorUserId, users.id)).orderBy(desc3(auditLogs.createdAt)).limit(50);
  res.json({ logs: rows });
});
var roles_default = router4;

// server/routes/tournaments.ts
import { Router as Router5 } from "express";
import { and as and7, asc as asc4, desc as desc4, eq as eq8, inArray as inArray4, ne as ne2 } from "drizzle-orm";
import { z as z5 } from "zod";
var router5 = Router5();
router5.get("/sports", async (_req, res) => {
  const allSports = await db.select().from(sports).orderBy(asc4(sports.displayOrder));
  res.json({ sports: allSports });
});
router5.get("/", async (_req, res) => {
  const [rows, allSports] = await Promise.all([
    db.select().from(tournaments).where(ne2(tournaments.status, "ARCHIVED")).orderBy(desc4(tournaments.isCurrent), desc4(tournaments.startsAt), desc4(tournaments.id)),
    db.select().from(sports).orderBy(asc4(sports.displayOrder))
  ]);
  res.json({ tournaments: rows, sports: allSports });
});
router5.get("/current", async (req, res) => {
  const [current] = await db.select().from(tournaments).where(eq8(tournaments.isCurrent, true)).orderBy(desc4(tournaments.id)).limit(1);
  if (!current) {
    const [upcomingTournaments, allSports2] = await Promise.all([
      db.select().from(tournaments).where(ne2(tournaments.status, "ARCHIVED")).orderBy(desc4(tournaments.startsAt), desc4(tournaments.id)),
      db.select().from(sports).orderBy(asc4(sports.displayOrder))
    ]);
    res.json({
      tournament: null,
      sports: [],
      teams: [],
      standings: [],
      matches: [],
      upcomingTournaments,
      allSports: allSports2,
      canManage: hasGlobalSportsAuthority(req.actor)
    });
    return;
  }
  const [configuredSports, allSports] = await Promise.all([
    db.select({
      id: sports.id,
      slug: sports.slug,
      name: sports.name,
      category: sports.category,
      format: tournamentSports.format,
      minSquadSize: tournamentSports.minSquadSize,
      maxSquadSize: tournamentSports.maxSquadSize,
      registrationDeadline: tournamentSports.registrationDeadline
    }).from(tournamentSports).innerJoin(sports, eq8(tournamentSports.sportId, sports.id)).where(eq8(tournamentSports.tournamentId, current.id)).orderBy(asc4(sports.displayOrder)),
    db.select().from(sports).orderBy(asc4(sports.displayOrder))
  ]);
  const teamRows = await db.select().from(teams).where(eq8(teams.tournamentId, current.id)).orderBy(asc4(teams.id));
  const teamIds = teamRows.map((t) => t.id);
  const rosterRows = teamIds.length > 0 ? await db.select({
    id: teamRosters.id,
    teamId: teamRosters.teamId,
    playerProfileId: teamRosters.playerProfileId,
    playingRole: teamRosters.playingRole,
    playerClass: teamRosters.playerClass,
    displayName: playerProfiles.displayName,
    batch: playerProfiles.batch,
    branch: playerProfiles.branch
  }).from(teamRosters).innerJoin(playerProfiles, eq8(teamRosters.playerProfileId, playerProfiles.id)).where(inArray4(teamRosters.teamId, teamIds)) : [];
  const standingsRows = await db.select().from(standings).where(eq8(standings.tournamentId, current.id)).orderBy(asc4(standings.rank));
  const matchRows = await db.select().from(matches).where(eq8(matches.tournamentId, current.id)).orderBy(desc4(matches.matchOrder), desc4(matches.scheduledAt));
  const teamMap = Object.fromEntries(teamRows.map((t) => [t.id, t]));
  const sportMap = Object.fromEntries(configuredSports.map((s) => [s.id, s]));
  const nowMs = Date.now();
  res.json({
    tournament: current,
    sports: configuredSports.map((s) => ({
      ...s,
      registrationOpen: !s.registrationDeadline || nowMs <= new Date(s.registrationDeadline).getTime()
    })),
    teams: teamRows.map((t) => ({
      ...t,
      roster: rosterRows.filter((r) => r.teamId === t.id)
    })),
    standings: standingsRows.map((s) => ({
      ...s,
      team: teamMap[s.teamId] ?? null
    })),
    matches: matchRows.map((m) => ({
      ...m,
      teamA: teamMap[m.teamAId] ?? null,
      teamB: teamMap[m.teamBId] ?? null,
      sport: sportMap[m.sportId] ?? null
    })),
    allSports,
    canManage: hasGlobalSportsAuthority(req.actor)
  });
});
router5.post("/", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can configure tournaments." });
    return;
  }
  const schema = z5.object({
    name: z5.string().min(3).max(160),
    academicYear: z5.number().int().min(2020).max(2040),
    semester: z5.enum(["ODD", "EVEN", "ANNUAL"]),
    tournamentType: z5.enum(["FLAGSHIP", "INTER_HOSTEL", "OPEN", "INTRA_CLUB", "PROTHYMOS"]),
    format: z5.enum(["KNOCKOUT", "LEAGUE", "ROUND_ROBIN", "GROUP_KNOCKOUT", "BEST_OF_SERIES"]),
    rosterMode: z5.enum(["AUCTION", "CAPTAIN_SUBMISSION"]),
    splitMode: z5.enum(["COMBINED", "SEPARATE_BOYS_GIRLS"]).default("COMBINED"),
    description: z5.string().max(600).optional(),
    startsAt: z5.string().datetime(),
    endsAt: z5.string().datetime().optional(),
    sportIds: z5.array(z5.number().int().positive()).min(1),
    setAsCurrent: z5.boolean().default(true),
    notifyEveryone: z5.boolean().default(false)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid tournament configuration." });
    return;
  }
  const created = await db.transaction(async (tx) => {
    if (parsed.data.setAsCurrent) {
      await tx.update(tournaments).set({ isCurrent: false }).where(eq8(tournaments.isCurrent, true));
    }
    const [t] = await tx.insert(tournaments).values({
      name: parsed.data.name.trim(),
      academicYear: parsed.data.academicYear,
      semester: parsed.data.semester,
      tournamentType: parsed.data.tournamentType,
      format: parsed.data.format,
      rosterMode: parsed.data.rosterMode,
      splitMode: parsed.data.splitMode,
      status: "ACTIVE",
      isCurrent: parsed.data.setAsCurrent,
      description: parsed.data.description?.trim() || null,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null
    }).returning();
    await tx.insert(tournamentSports).values(
      parsed.data.sportIds.map((sid) => ({
        tournamentId: t.id,
        sportId: sid,
        format: parsed.data.format
      }))
    );
    if (parsed.data.setAsCurrent) {
      await tx.insert(siteSettings).values({ key: "currentTournamentId", valueJson: t.id, updatedBy: req.actor.id }).onConflictDoUpdate({
        target: siteSettings.key,
        set: { valueJson: t.id, updatedBy: req.actor.id, updatedAt: /* @__PURE__ */ new Date() }
      });
    }
    if (parsed.data.notifyEveryone) {
      const allUsers = await tx.select({ id: users.id }).from(users);
      if (allUsers.length > 0) {
        await tx.insert(notifications).values(
          allUsers.map((u) => ({
            userId: u.id,
            title: `Tournament Announced: ${t.name}`,
            message: "Fixtures, team submissions, and live schedules are now open.",
            linkUrl: "/tournaments/current"
          }))
        );
      }
    }
    await recordAuditLog(tx, req.actor.id, "CREATE_TOURNAMENT", "tournaments", t.id, {
      notifyEveryone: parsed.data.notifyEveryone
    });
    return t;
  });
  if (parsed.data.notifyEveryone) {
    broadcastSse("NOTIFICATION", { tournamentId: created.id });
  }
  res.status(201).json({ tournament: created });
});
async function applyTournamentStatusTransition(tx, params) {
  const { tournamentId, existing, nextStatus, previousStatus, actorId, auditAction } = params;
  if (nextStatus === "CURRENT") {
    await tx.update(tournaments).set({
      isCurrent: false,
      status: previousStatus ?? "UPCOMING"
    }).where(and7(eq8(tournaments.isCurrent, true), ne2(tournaments.id, tournamentId)));
    const [activated] = await tx.update(tournaments).set({ isCurrent: true, status: "ACTIVE" }).where(eq8(tournaments.id, tournamentId)).returning();
    await tx.insert(siteSettings).values({ key: "currentTournamentId", valueJson: activated.id, updatedBy: actorId }).onConflictDoUpdate({
      target: siteSettings.key,
      set: { valueJson: activated.id, updatedBy: actorId, updatedAt: /* @__PURE__ */ new Date() }
    });
    await recordAuditLog(tx, actorId, auditAction, "tournaments", tournamentId, {
      name: activated.name
    });
    return activated;
  }
  const isFinished = nextStatus === "COMPLETED" || nextStatus === "ARCHIVED";
  const [row] = await tx.update(tournaments).set({
    status: nextStatus,
    ...isFinished ? { isCurrent: false } : {},
    ...nextStatus === "ARCHIVED" ? { completenessStatus: "VERIFIED", verifiedBy: actorId } : {}
  }).where(eq8(tournaments.id, tournamentId)).returning();
  if (isFinished) {
    await tx.update(userRoles).set({ active: false }).where(
      and7(
        eq8(userRoles.roleCode, "CAPTAIN"),
        eq8(userRoles.tournamentId, tournamentId),
        eq8(userRoles.active, true)
      )
    );
    if (existing.isCurrent) {
      await tx.delete(siteSettings).where(eq8(siteSettings.key, "currentTournamentId"));
    }
  }
  await recordAuditLog(tx, actorId, auditAction, "tournaments", tournamentId, {});
  return row;
}
router5.patch("/:id", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can update tournaments." });
    return;
  }
  const tournamentId = parsePositiveIntId(req.params.id);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament ID." });
    return;
  }
  const schema = z5.object({
    status: z5.enum(["CURRENT", "ACTIVE", "UPCOMING", "COMPLETED", "ARCHIVED"]),
    previousStatus: z5.enum(["UPCOMING", "ARCHIVED"]).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid tournament update payload." });
    return;
  }
  const [existing] = await db.select().from(tournaments).where(eq8(tournaments.id, tournamentId)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Tournament not found." });
    return;
  }
  const updated = await db.transaction(
    (tx) => applyTournamentStatusTransition(tx, {
      tournamentId,
      existing,
      nextStatus: parsed.data.status,
      previousStatus: parsed.data.previousStatus,
      actorId: req.actor.id,
      auditAction: parsed.data.status === "CURRENT" ? "ACTIVATE_CURRENT_TOURNAMENT" : `TOURNAMENT_${parsed.data.status}`
    })
  );
  invalidateBootstrapCache();
  broadcastSse("NAV_UPDATED", { currentTournamentId: updated.isCurrent ? updated.id : null });
  res.json({ tournament: updated });
});
router5.patch("/:id/config", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can configure tournaments." });
    return;
  }
  const tournamentId = parsePositiveIntId(req.params.id);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament ID." });
    return;
  }
  const sportConfigSchema = z5.object({
    sportId: z5.number().int().positive(),
    minSquadSize: z5.number().int().min(1).max(30).default(1),
    maxSquadSize: z5.number().int().min(1).max(40).default(15),
    registrationDeadline: z5.string().datetime().nullable().optional()
  });
  const schema = z5.object({
    name: z5.string().trim().min(3).max(160),
    format: z5.enum(["KNOCKOUT", "LEAGUE", "ROUND_ROBIN", "GROUP_KNOCKOUT", "BEST_OF_SERIES"]),
    rosterMode: z5.enum(["AUCTION", "CAPTAIN_SUBMISSION"]),
    splitMode: z5.enum(["COMBINED", "SEPARATE_BOYS_GIRLS"]).optional(),
    description: z5.string().max(600).nullable().optional(),
    startsAt: z5.string().datetime(),
    endsAt: z5.string().datetime().nullable().optional(),
    sportsConfig: z5.array(sportConfigSchema).min(1),
    notifyEveryone: z5.boolean().default(false)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid tournament configuration payload." });
    return;
  }
  for (const sc of parsed.data.sportsConfig) {
    if (sc.minSquadSize > sc.maxSquadSize) {
      res.status(400).json({ error: "Minimum squad size cannot exceed maximum squad size." });
      return;
    }
  }
  const [existing] = await db.select().from(tournaments).where(eq8(tournaments.id, tournamentId)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Tournament not found." });
    return;
  }
  if (existing.status === "ARCHIVED") {
    res.status(409).json({ error: "Archived tournaments cannot be reconfigured." });
    return;
  }
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx.update(tournaments).set({
      name: parsed.data.name,
      format: parsed.data.format,
      rosterMode: parsed.data.rosterMode,
      ...parsed.data.splitMode ? { splitMode: parsed.data.splitMode } : {},
      description: parsed.data.description?.trim() || null,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null
    }).where(eq8(tournaments.id, tournamentId)).returning();
    const existingTs = await tx.select().from(tournamentSports).where(eq8(tournamentSports.tournamentId, tournamentId));
    const existingBySportId = new Map(existingTs.map((s) => [s.sportId, s]));
    const nextSportIds = parsed.data.sportsConfig.map((s) => s.sportId);
    for (const sc of parsed.data.sportsConfig) {
      const prior = existingBySportId.get(sc.sportId);
      if (prior) {
        await tx.update(tournamentSports).set({
          format: parsed.data.format,
          minSquadSize: sc.minSquadSize,
          maxSquadSize: sc.maxSquadSize,
          registrationDeadline: sc.registrationDeadline ? new Date(sc.registrationDeadline) : null
        }).where(eq8(tournamentSports.id, prior.id));
      } else {
        await tx.insert(tournamentSports).values({
          tournamentId,
          sportId: sc.sportId,
          format: parsed.data.format,
          minSquadSize: sc.minSquadSize,
          maxSquadSize: sc.maxSquadSize,
          registrationDeadline: sc.registrationDeadline ? new Date(sc.registrationDeadline) : null
        });
      }
    }
    const removedSportIds = existingTs.map((s) => s.sportId).filter((sid) => !nextSportIds.includes(sid));
    if (removedSportIds.length > 0) {
      await tx.delete(tournamentSports).where(
        and7(
          eq8(tournamentSports.tournamentId, tournamentId),
          inArray4(tournamentSports.sportId, removedSportIds)
        )
      );
    }
    if (parsed.data.notifyEveryone) {
      const allUsers = await tx.select({ id: users.id }).from(users);
      if (allUsers.length > 0) {
        await tx.insert(notifications).values(
          allUsers.map((u) => ({
            userId: u.id,
            title: `Tournament Updated: ${row.name}`,
            message: "Sports lineup, schedules, or registration deadlines were updated.",
            linkUrl: "/tournaments/current"
          }))
        );
      }
    }
    await recordAuditLog(tx, req.actor.id, "UPDATE_TOURNAMENT_CONFIG", "tournaments", tournamentId, {
      sportCount: parsed.data.sportsConfig.length,
      notifyEveryone: parsed.data.notifyEveryone
    });
    return row;
  });
  if (parsed.data.notifyEveryone) {
    broadcastSse("NOTIFICATION", { tournamentId: updated.id });
  }
  invalidateBootstrapCache();
  broadcastSse("NAV_UPDATED", { currentTournamentId: updated.isCurrent ? updated.id : null });
  res.json({ tournament: updated });
});
router5.patch("/:id/status", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can update tournament status." });
    return;
  }
  const tournamentId = parsePositiveIntId(req.params.id);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament ID." });
    return;
  }
  const schema = z5.object({
    status: z5.enum(["ACTIVE", "COMPLETED", "ARCHIVED"])
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid tournament status." });
    return;
  }
  const [existing] = await db.select().from(tournaments).where(eq8(tournaments.id, tournamentId)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Tournament not found." });
    return;
  }
  const updated = await db.transaction(
    (tx) => applyTournamentStatusTransition(tx, {
      tournamentId,
      existing,
      nextStatus: parsed.data.status,
      actorId: req.actor.id,
      auditAction: `TOURNAMENT_STATUS_${parsed.data.status}`
    })
  );
  invalidateBootstrapCache();
  broadcastSse("NAV_UPDATED", { currentTournamentId: updated.isCurrent ? updated.id : null });
  res.json({ tournament: updated });
});
router5.post("/:id/archive", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can archive tournaments." });
    return;
  }
  const tournamentId = parsePositiveIntId(req.params.id);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament ID." });
    return;
  }
  const [existing] = await db.select().from(tournaments).where(eq8(tournaments.id, tournamentId)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Tournament not found." });
    return;
  }
  const updated = await db.transaction(
    (tx) => applyTournamentStatusTransition(tx, {
      tournamentId,
      existing,
      nextStatus: "ARCHIVED",
      actorId: req.actor.id,
      auditAction: "ARCHIVE_TOURNAMENT"
    })
  );
  invalidateBootstrapCache();
  broadcastSse("NAV_UPDATED", { currentTournamentId: updated.isCurrent ? updated.id : null });
  res.json({ tournament: updated });
});
router5.post("/:id/teams", requireAuth, async (req, res) => {
  const tournamentId = parsePositiveIntId(req.params.id);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament ID." });
    return;
  }
  const schema = z5.object({
    teamId: z5.number().int().positive().optional(),
    sportId: z5.number().int().positive(),
    track: z5.enum(["COMBINED", "BOYS", "GIRLS"]).optional(),
    name: z5.string().min(2).max(80),
    shortCode: z5.string().min(2).max(6).transform((s) => s.toUpperCase()),
    accentColor: z5.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#B91C1C"),
    playerProfileIds: z5.array(z5.number().int().positive()).min(1),
    submitImmediately: z5.boolean().default(true)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid team submission payload." });
    return;
  }
  const [tournament] = await db.select().from(tournaments).where(eq8(tournaments.id, tournamentId)).limit(1);
  if (!tournament || tournament.status !== "ACTIVE") {
    res.status(400).json({ error: "Team roster submissions are closed because this tournament is not active." });
    return;
  }
  if (tournament.rosterMode !== "CAPTAIN_SUBMISSION") {
    res.status(400).json({ error: "This tournament uses AUCTION squads rather than captain roster submissions." });
    return;
  }
  const [tsConfig] = await db.select().from(tournamentSports).where(
    and7(
      eq8(tournamentSports.tournamentId, tournamentId),
      eq8(tournamentSports.sportId, parsed.data.sportId)
    )
  ).limit(1);
  if (!tsConfig) {
    res.status(400).json({ error: "Selected sport is not configured for this tournament." });
    return;
  }
  if (tsConfig.registrationDeadline && Date.now() > new Date(tsConfig.registrationDeadline).getTime()) {
    if (!hasGlobalSportsAuthority(req.actor)) {
      res.status(400).json({ error: "Team registration deadline has passed." });
      return;
    }
  }
  let editableTeamId = null;
  if (parsed.data.teamId) {
    const [targetTeam] = await db.select().from(teams).where(
      and7(
        eq8(teams.id, parsed.data.teamId),
        eq8(teams.tournamentId, tournamentId),
        eq8(teams.sportId, parsed.data.sportId)
      )
    ).limit(1);
    if (!targetTeam) {
      res.status(404).json({ error: "Team to edit not found for this tournament and sport." });
      return;
    }
    if (!hasGlobalSportsAuthority(req.actor) && targetTeam.captainUserId !== req.actor.id) {
      res.status(403).json({ error: "You can only edit your own team submission." });
      return;
    }
    if (targetTeam.submissionStatus !== "DRAFT" && targetTeam.submissionStatus !== "CHANGES_REQUESTED") {
      res.status(409).json({ error: "Only DRAFT or CHANGES_REQUESTED teams can be edited and resubmitted." });
      return;
    }
    editableTeamId = targetTeam.id;
  } else if (!hasGlobalSportsAuthority(req.actor)) {
    const existingOwn = await db.select({ id: teams.id, submissionStatus: teams.submissionStatus }).from(teams).where(
      and7(
        eq8(teams.tournamentId, tournamentId),
        eq8(teams.sportId, parsed.data.sportId),
        eq8(teams.captainUserId, req.actor.id)
      )
    );
    const blockingTeam = existingOwn.find(
      (t) => t.submissionStatus !== "REJECTED" && t.submissionStatus !== "DRAFT" && t.submissionStatus !== "CHANGES_REQUESTED"
    );
    if (blockingTeam) {
      res.status(409).json({ error: "You have already submitted a team for this sport in this tournament." });
      return;
    }
    const editableTeam = existingOwn.find(
      (t) => t.submissionStatus === "DRAFT" || t.submissionStatus === "CHANGES_REQUESTED"
    );
    if (editableTeam) {
      editableTeamId = editableTeam.id;
    }
  }
  const uniquePlayerIds = Array.from(new Set(parsed.data.playerProfileIds));
  if (parsed.data.submitImmediately && (uniquePlayerIds.length < tsConfig.minSquadSize || uniquePlayerIds.length > tsConfig.maxSquadSize)) {
    res.status(400).json({
      error: `Squad size must be between ${tsConfig.minSquadSize} and ${tsConfig.maxSquadSize} players (got ${uniquePlayerIds.length}).`
    });
    return;
  }
  const duplicateRosterRows = await db.select({
    playerProfileId: teamRosters.playerProfileId,
    teamId: teams.id,
    teamName: teams.name
  }).from(teamRosters).innerJoin(teams, eq8(teamRosters.teamId, teams.id)).where(
    and7(
      eq8(teams.tournamentId, tournamentId),
      eq8(teams.sportId, parsed.data.sportId),
      ne2(teams.submissionStatus, "REJECTED"),
      inArray4(teamRosters.playerProfileId, uniquePlayerIds),
      ...editableTeamId ? [ne2(teams.id, editableTeamId)] : []
    )
  );
  if (duplicateRosterRows.length > 0) {
    res.status(409).json({
      error: `One or more selected players are already registered on another team (${duplicateRosterRows[0].teamName}) for this sport.`
    });
    return;
  }
  const selectedProfiles = await db.select({
    profileId: playerProfiles.id,
    userId: users.id,
    accountType: users.accountType
  }).from(playerProfiles).innerJoin(users, eq8(playerProfiles.userId, users.id)).where(inArray4(playerProfiles.id, uniquePlayerIds));
  if (selectedProfiles.length !== uniquePlayerIds.length) {
    res.status(400).json({ error: "One or more selected players do not have an active IIITT student account." });
    return;
  }
  if (selectedProfiles.some((p) => p.accountType !== "STUDENT")) {
    res.status(400).json({ error: "Faculty, ground staff, and admin accounts cannot be added to student team rosters." });
    return;
  }
  const selectedUserIds = selectedProfiles.map((p) => p.userId);
  const forbiddenHolders = await db.select({ userId: userRoles.userId }).from(userRoles).where(
    and7(
      inArray4(userRoles.userId, selectedUserIds),
      eq8(userRoles.active, true),
      inArray4(userRoles.roleCode, ["FACULTY_ADVISOR", "EQUIPMENT_STAFF", "SUPER_ADMIN"])
    )
  );
  if (forbiddenHolders.length > 0) {
    res.status(400).json({ error: "Faculty, staff, and system admin accounts cannot join student team rosters." });
    return;
  }
  const saved = await db.transaction(async (tx) => {
    const nextStatus = parsed.data.submitImmediately ? "SUBMITTED" : "DRAFT";
    let team;
    if (editableTeamId) {
      const [updatedTeam] = await tx.update(teams).set({
        name: parsed.data.name.trim(),
        shortCode: parsed.data.shortCode,
        accentColor: parsed.data.accentColor,
        submissionStatus: nextStatus
      }).where(eq8(teams.id, editableTeamId)).returning();
      team = updatedTeam;
      await tx.delete(teamRosters).where(eq8(teamRosters.teamId, team.id));
    } else {
      const [insertedTeam] = await tx.insert(teams).values({
        tournamentId,
        sportId: parsed.data.sportId,
        track: tournament.splitMode === "SEPARATE_BOYS_GIRLS" ? parsed.data.track === "GIRLS" ? "GIRLS" : "BOYS" : "COMBINED",
        name: parsed.data.name.trim(),
        shortCode: parsed.data.shortCode,
        accentColor: parsed.data.accentColor,
        captainUserId: req.actor.id,
        submissionStatus: nextStatus
      }).returning();
      team = insertedTeam;
    }
    await tx.insert(teamRosters).values(
      uniquePlayerIds.map((pid, idx) => ({
        teamId: team.id,
        playerProfileId: pid,
        playingRole: idx === 0 ? "Captain" : "Squad Member",
        playerClass: "OPEN"
      }))
    );
    await recordAuditLog(
      tx,
      req.actor.id,
      editableTeamId ? "RESUBMIT_TEAM_SUBMISSION" : "CREATE_TEAM_SUBMISSION",
      "teams",
      team.id,
      {
        status: team.submissionStatus,
        playerCount: uniquePlayerIds.length
      }
    );
    return team;
  });
  res.status(editableTeamId ? 200 : 201).json({ team: saved });
});
router5.patch("/teams/:teamId/review", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can approve/reject teams." });
    return;
  }
  const teamId = parsePositiveIntId(req.params.teamId);
  if (!teamId) {
    res.status(400).json({ error: "Invalid team ID." });
    return;
  }
  const schema = z5.object({
    decision: z5.enum(["APPROVED", "CHANGES_REQUESTED", "REJECTED", "LOCKED"]),
    reviewNotes: z5.string().max(300).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid team review decision." });
    return;
  }
  const [updated] = await db.transaction(async (tx) => {
    const [row] = await tx.update(teams).set({
      submissionStatus: parsed.data.decision,
      reviewNotes: parsed.data.reviewNotes?.trim() || null,
      reviewedBy: req.actor.id
    }).where(eq8(teams.id, teamId)).returning();
    if (row?.captainUserId) {
      if (parsed.data.decision === "APPROVED" || parsed.data.decision === "LOCKED") {
        const [existingCaptain] = await tx.select({ id: userRoles.id }).from(userRoles).where(
          and7(
            eq8(userRoles.userId, row.captainUserId),
            eq8(userRoles.roleCode, "CAPTAIN"),
            eq8(userRoles.tournamentId, row.tournamentId),
            eq8(userRoles.active, true)
          )
        ).limit(1);
        if (!existingCaptain) {
          await tx.insert(userRoles).values({
            userId: row.captainUserId,
            roleCode: "CAPTAIN",
            tournamentId: row.tournamentId,
            grantedBy: req.actor.id
          });
        }
      } else if (parsed.data.decision === "REJECTED") {
        const otherApproved = await tx.select({ id: teams.id }).from(teams).where(
          and7(
            eq8(teams.tournamentId, row.tournamentId),
            eq8(teams.captainUserId, row.captainUserId),
            inArray4(teams.submissionStatus, ["APPROVED", "LOCKED"])
          )
        );
        if (otherApproved.length === 0) {
          await tx.update(userRoles).set({ active: false }).where(
            and7(
              eq8(userRoles.userId, row.captainUserId),
              eq8(userRoles.roleCode, "CAPTAIN"),
              eq8(userRoles.tournamentId, row.tournamentId),
              eq8(userRoles.active, true)
            )
          );
        }
      }
      await tx.insert(notifications).values({
        userId: row.captainUserId,
        title: `Team ${row.name}: ${parsed.data.decision}`,
        message: parsed.data.reviewNotes?.trim() || "Roster status updated by Sports Secretary.",
        linkUrl: "/tournaments/current"
      });
    }
    if (row) {
      await recordAuditLog(tx, req.actor.id, `TEAM_${parsed.data.decision}`, "teams", teamId, {});
    }
    return [row];
  });
  if (!updated) {
    res.status(404).json({ error: "Team not found." });
    return;
  }
  if (updated.captainUserId) {
    broadcastSse("NOTIFICATION", { teamId, decision: parsed.data.decision }, [updated.captainUserId]);
  }
  res.json({ team: updated });
});
router5.post("/:id/matches", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can schedule matches." });
    return;
  }
  const tournamentId = parsePositiveIntId(req.params.id);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament ID." });
    return;
  }
  const schema = z5.object({
    sportId: z5.number().int().positive(),
    track: z5.enum(["COMBINED", "BOYS", "GIRLS"]).optional(),
    roundLabel: z5.string().min(2).max(80),
    matchOrder: z5.number().int().positive().default(1),
    teamAId: z5.number().int().positive().optional(),
    teamBId: z5.number().int().positive().optional(),
    customTeamAName: z5.string().trim().min(2).max(80).optional(),
    customTeamBName: z5.string().trim().min(2).max(80).optional(),
    venue: z5.string().min(2).max(160),
    scheduledAt: z5.string().datetime(),
    scorerUserId: z5.number().int().positive().nullable().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid fixture details." });
    return;
  }
  const fixtureOutcome = await db.transaction(async (tx) => {
    const [tournament] = await tx.select().from(tournaments).where(eq8(tournaments.id, tournamentId)).limit(1);
    if (!tournament) {
      return { ok: false, status: 404, error: "Tournament not found." };
    }
    if (tournament.status === "ARCHIVED") {
      return { ok: false, status: 400, error: "Cannot schedule fixtures in an archived tournament." };
    }
    const [tsConfig] = await tx.select({ id: tournamentSports.id }).from(tournamentSports).where(
      and7(
        eq8(tournamentSports.tournamentId, tournamentId),
        eq8(tournamentSports.sportId, parsed.data.sportId)
      )
    ).limit(1);
    if (!tsConfig) {
      return { ok: false, status: 400, error: "Selected sport is not configured for this tournament." };
    }
    if (parsed.data.scorerUserId) {
      const [scorer] = await tx.select({ id: users.id }).from(users).where(eq8(users.id, parsed.data.scorerUserId)).limit(1);
      if (!scorer) {
        return { ok: false, status: 404, error: "Assigned scorer user not found." };
      }
    }
    const resolveOrCreateTeam = async (teamId, customName) => {
      if (teamId) return teamId;
      if (!customName) return null;
      const code = customName.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 4) || "TM";
      const [createdTeam] = await tx.insert(teams).values({
        tournamentId,
        sportId: parsed.data.sportId,
        name: customName.trim(),
        shortCode: code,
        submissionStatus: "APPROVED",
        reviewedBy: req.actor.id
      }).returning();
      return createdTeam.id;
    };
    const resolvedA = await resolveOrCreateTeam(parsed.data.teamAId, parsed.data.customTeamAName);
    const resolvedB = await resolveOrCreateTeam(parsed.data.teamBId, parsed.data.customTeamBName);
    if (!resolvedA || !resolvedB || resolvedA === resolvedB) {
      return { ok: false, status: 400, error: "Select or enter two distinct teams." };
    }
    const pairTeams = await tx.select().from(teams).where(
      and7(
        eq8(teams.tournamentId, tournamentId),
        eq8(teams.sportId, parsed.data.sportId),
        inArray4(teams.id, [resolvedA, resolvedB])
      )
    );
    if (pairTeams.length !== 2 || pairTeams.some((t) => t.submissionStatus !== "APPROVED" && t.submissionStatus !== "LOCKED")) {
      return {
        ok: false,
        status: 400,
        error: "Both teams must belong to this tournament & sport and be APPROVED or LOCKED before scheduling."
      };
    }
    const effectiveMatchTrack = tournament.splitMode === "SEPARATE_BOYS_GIRLS" ? parsed.data.track === "GIRLS" ? "GIRLS" : "BOYS" : "COMBINED";
    const [created] = await tx.insert(matches).values({
      tournamentId,
      sportId: parsed.data.sportId,
      track: effectiveMatchTrack,
      roundLabel: parsed.data.roundLabel.trim(),
      matchOrder: parsed.data.matchOrder,
      teamAId: resolvedA,
      teamBId: resolvedB,
      venue: parsed.data.venue.trim(),
      scheduledAt: new Date(parsed.data.scheduledAt),
      status: "UPCOMING",
      scorerUserId: parsed.data.scorerUserId ?? null,
      scoreSummary: "Scheduled"
    }).returning();
    return { ok: true, created };
  });
  if (!fixtureOutcome.ok) {
    res.status(fixtureOutcome.status).json({ error: fixtureOutcome.error });
    return;
  }
  res.status(201).json({ match: fixtureOutcome.created });
});
var tournaments_default = router5;

// server/routes/matches.ts
import { Router as Router6 } from "express";
import { and as and8, asc as asc5, desc as desc5, eq as eq9, inArray as inArray5 } from "drizzle-orm";
import { z as z6 } from "zod";

// shared/scoring/types.ts
function resolveClockState(events, config = {}) {
  if (config.clockRunning !== void 0 || config.clockAnchorMs !== void 0 || config.clockAccumulatedMs !== void 0) {
    return {
      running: Boolean(config.clockRunning),
      anchorEpochMs: config.clockAnchorMs ?? null,
      accumulatedMs: Math.max(0, Number(config.clockAccumulatedMs ?? 0))
    };
  }
  return reduceClockFromEvents(events);
}
function reduceClockFromEvents(events) {
  let running = false;
  let anchorEpochMs = null;
  let accumulatedMs = 0;
  for (const ev of events) {
    if (ev.voided) continue;
    const t = typeof ev.occurredAt === "number" ? ev.occurredAt : new Date(ev.occurredAt).getTime();
    if (ev.eventType === "CLOCK_START") {
      if (!running) {
        running = true;
        anchorEpochMs = Number(ev.payloadJson.anchorEpochMs ?? t);
      }
    } else if (ev.eventType === "CLOCK_PAUSE") {
      if (running && anchorEpochMs !== null) {
        accumulatedMs += Math.max(0, t - anchorEpochMs);
      }
      running = false;
      anchorEpochMs = null;
    } else if (ev.eventType === "CLOCK_RESET") {
      running = false;
      anchorEpochMs = null;
      accumulatedMs = 0;
    }
  }
  return { running, anchorEpochMs, accumulatedMs };
}

// shared/scoring/reducers/cricket.ts
function createInnings(battingSide) {
  return {
    battingSide,
    runs: 0,
    wickets: 0,
    legalBalls: 0,
    extras: { wd: 0, nb: 0, b: 0, lb: 0 },
    freeHit: false,
    strikerId: null,
    nonStrikerId: null,
    bowlerId: null,
    lastCompletedOverBowlerId: null,
    bowlerSelectedForNewOver: false,
    batters: {},
    bowlers: {},
    recentBalls: [],
    oversGroups: []
  };
}
function formatOvers(legalBalls) {
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
}
function ballsToOversDecimal(legalBalls) {
  return Math.floor(legalBalls / 6) + legalBalls % 6 / 6;
}
function ensureBatter(inn, id) {
  if (!inn.batters[id]) {
    inn.batters[id] = {
      playerId: id,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      out: false,
      dismissal: "not out"
    };
  }
  return inn.batters[id];
}
function ensureBowler(inn, id) {
  if (!inn.bowlers[id]) {
    inn.bowlers[id] = {
      playerId: id,
      balls: 0,
      maidens: 0,
      runs: 0,
      wickets: 0,
      currentOverBalls: 0,
      currentOverRuns: 0
    };
  }
  return inn.bowlers[id];
}
function swapCrease(inn) {
  if (inn.strikerId && inn.nonStrikerId) {
    const tmp = inn.strikerId;
    inn.strikerId = inn.nonStrikerId;
    inn.nonStrikerId = tmp;
  }
}
function reduceCricket(events, config = {}) {
  const oversLimit = config.oversPerInnings ?? 10;
  const teamAShort = config.teamAShort ?? "TEAM A";
  const teamBShort = config.teamBShort ?? "TEAM B";
  const superOverMaxBalls = 6;
  const superOverMaxWickets = 2;
  const active = events.filter((e) => !e.voided).sort((a, b) => a.seq - b.seq);
  const inningsList = [createInnings("A"), createInnings("B")];
  let currentInningsIdx = 0;
  let isSuperOver = false;
  let superOverIndex = 0;
  const superOvers = [];
  const getActiveInnings = () => {
    if (isSuperOver && superOvers.length > 0) {
      const so = superOvers[superOvers.length - 1];
      return so.halves[so.activeHalf];
    }
    return inningsList[currentInningsIdx];
  };
  for (const ev of active) {
    const p = ev.payloadJson ?? {};
    if (ev.eventType === "INNINGS_SWITCH") {
      if (!isSuperOver && currentInningsIdx === 0) {
        const nextSide = p.battingSide ?? (inningsList[0].battingSide === "A" ? "B" : "A");
        inningsList[1].battingSide = nextSide;
        currentInningsIdx = 1;
        if (p.strikerId) {
          inningsList[1].strikerId = Number(p.strikerId);
          ensureBatter(inningsList[1], Number(p.strikerId));
        }
        if (p.nonStrikerId) {
          inningsList[1].nonStrikerId = Number(p.nonStrikerId);
          ensureBatter(inningsList[1], Number(p.nonStrikerId));
        }
        if (p.bowlerId) {
          inningsList[1].bowlerId = Number(p.bowlerId);
          ensureBowler(inningsList[1], Number(p.bowlerId));
        }
      }
      continue;
    }
    if (ev.eventType === "SUPER_OVER_START") {
      const nextIdx = p.superOverIndex ? Number(p.superOverIndex) : superOverIndex + 1;
      const firstSide = p.battingSide ?? inningsList[1].battingSide;
      const secondSide = firstSide === "A" ? "B" : "A";
      const h1 = createInnings(firstSide);
      const h2 = createInnings(secondSide);
      if (p.strikerId) {
        h1.strikerId = Number(p.strikerId);
        ensureBatter(h1, Number(p.strikerId));
      }
      if (p.nonStrikerId) {
        h1.nonStrikerId = Number(p.nonStrikerId);
        ensureBatter(h1, Number(p.nonStrikerId));
      }
      if (p.bowlerId) {
        h1.bowlerId = Number(p.bowlerId);
        ensureBowler(h1, Number(p.bowlerId));
      }
      superOvers.push({
        index: nextIdx,
        halves: [h1, h2],
        activeHalf: 0,
        target: null
      });
      isSuperOver = true;
      superOverIndex = nextIdx;
      continue;
    }
    if (ev.eventType === "SUPER_OVER_SWITCH") {
      const so = superOvers[superOvers.length - 1];
      if (so && so.activeHalf === 0) {
        so.target = so.halves[0].runs + 1;
        so.activeHalf = 1;
        const h2 = so.halves[1];
        if (p.battingSide === "A" || p.battingSide === "B") {
          h2.battingSide = p.battingSide;
        }
        if (p.strikerId) {
          h2.strikerId = Number(p.strikerId);
          ensureBatter(h2, Number(p.strikerId));
        }
        if (p.nonStrikerId) {
          h2.nonStrikerId = Number(p.nonStrikerId);
          ensureBatter(h2, Number(p.nonStrikerId));
        }
        if (p.bowlerId) {
          h2.bowlerId = Number(p.bowlerId);
          ensureBowler(h2, Number(p.bowlerId));
        }
      }
      continue;
    }
    if (ev.eventType === "SWAP_STRIKE") {
      swapCrease(getActiveInnings());
      continue;
    }
    if (ev.eventType === "SET_PLAYERS") {
      const inn3 = getActiveInnings();
      if (p.strikerId) {
        inn3.strikerId = Number(p.strikerId);
        ensureBatter(inn3, inn3.strikerId);
      }
      if (p.nonStrikerId) {
        inn3.nonStrikerId = Number(p.nonStrikerId);
        ensureBatter(inn3, inn3.nonStrikerId);
      }
      if (p.bowlerId) {
        inn3.bowlerId = Number(p.bowlerId);
        ensureBowler(inn3, inn3.bowlerId);
        inn3.bowlerSelectedForNewOver = true;
      }
      continue;
    }
    if (ev.eventType !== "BALL") continue;
    if (!isSuperOver && currentInningsIdx === 0 && p.side && p.side !== inningsList[0].battingSide && inningsList[0].legalBalls === 0 && inningsList[0].runs === 0) {
      inningsList[0].battingSide = p.side;
      inningsList[1].battingSide = p.side === "A" ? "B" : "A";
    }
    const inn = getActiveInnings();
    const runs = Number(p.runs ?? 0);
    const extraType = p.extraType ?? null;
    const isWicket = Boolean(p.wicket);
    const wicketType = p.wicketType ?? "OUT";
    const batterId = p.batterId ? Number(p.batterId) : inn.strikerId;
    const nonStrikerParam = p.nonStrikerId ? Number(p.nonStrikerId) : inn.nonStrikerId;
    const bowlerId = p.bowlerId ? Number(p.bowlerId) : inn.bowlerId;
    if (batterId) inn.strikerId = batterId;
    if (nonStrikerParam && nonStrikerParam !== inn.strikerId) inn.nonStrikerId = nonStrikerParam;
    if (bowlerId) inn.bowlerId = bowlerId;
    const isWide = extraType === "WD";
    const isNoBall = extraType === "NB";
    const isBye = extraType === "B";
    const isLegBye = extraType === "LB";
    const isLegal = !isWide && !isNoBall;
    const penaltyRun = isWide || isNoBall ? 1 : 0;
    const totalDeliveryRuns = runs + penaltyRun;
    inn.runs += totalDeliveryRuns;
    if (isWide) inn.extras.wd += totalDeliveryRuns;
    if (isNoBall) inn.extras.nb += 1;
    if (isBye) inn.extras.b += runs;
    if (isLegBye) inn.extras.lb += runs;
    if (isLegal) {
      inn.legalBalls += 1;
      inn.bowlerSelectedForNewOver = false;
    }
    if (batterId) {
      const bStat = ensureBatter(inn, batterId);
      if (!isWide) bStat.balls += 1;
      if (!isWide && !isBye && !isLegBye) {
        bStat.runs += runs;
        if (runs === 4) bStat.fours += 1;
        if (runs === 6) bStat.sixes += 1;
      }
    }
    if (inn.nonStrikerId) {
      ensureBatter(inn, inn.nonStrikerId);
    }
    const dismissedBatterId = p.dismissedBatterId ? Number(p.dismissedBatterId) : batterId;
    const isRetiredHurt = wicketType.toUpperCase() === "RETIRED_HURT";
    if (isWicket && dismissedBatterId) {
      const dStat = ensureBatter(inn, dismissedBatterId);
      dStat.out = true;
      dStat.dismissal = wicketType.toLowerCase().replace(/_/g, " ");
      if (!isRetiredHurt) {
        inn.wickets += 1;
      }
    } else if (isWicket) {
      inn.wickets += 1;
    }
    const bowlerConceded = !isBye && !isLegBye ? totalDeliveryRuns : 0;
    if (bowlerId) {
      const bw = ensureBowler(inn, bowlerId);
      if (isLegal) {
        bw.balls += 1;
        bw.currentOverBalls += 1;
      }
      bw.runs += bowlerConceded;
      bw.currentOverRuns += bowlerConceded;
      if (isWicket && wicketType.toUpperCase() !== "RUN_OUT" && !isRetiredHurt) {
        bw.wickets += 1;
      }
      if (isLegal && bw.currentOverBalls === 6) {
        if (bw.currentOverRuns === 0) {
          bw.maidens += 1;
        }
        bw.currentOverBalls = 0;
        bw.currentOverRuns = 0;
      }
    }
    const tag = isWicket ? "W" : isWide ? `${runs > 0 ? runs : ""}WD` : isNoBall ? `${runs > 0 ? runs : ""}NB` : isBye ? `${runs}B` : isLegBye ? `${runs}LB` : `${runs}`;
    inn.recentBalls.push(tag);
    if (inn.recentBalls.length > 18) inn.recentBalls.shift();
    const overNumber = isLegal ? Math.max(1, Math.ceil(inn.legalBalls / 6)) : Math.floor(inn.legalBalls / 6) + 1;
    let group = inn.oversGroups.find((g) => g.overNumber === overNumber);
    if (!group) {
      group = {
        overNumber,
        balls: [],
        ...isSuperOver ? { isSuperOver: true, superOverIndex } : {}
      };
      inn.oversGroups.push(group);
    }
    group.balls.push(tag);
    inn.freeHit = isNoBall;
    const oddRunsSwap = runs % 2 === 1;
    const overCompleted = isLegal && inn.legalBalls > 0 && inn.legalBalls % 6 === 0;
    if (overCompleted) {
      inn.lastCompletedOverBowlerId = bowlerId ?? null;
    }
    if (oddRunsSwap !== overCompleted) {
      swapCrease(inn);
    }
    if (isWicket && dismissedBatterId) {
      const nextBatterId = p.nextBatterId ? Number(p.nextBatterId) : null;
      if (inn.strikerId === dismissedBatterId) {
        inn.strikerId = nextBatterId;
      } else if (inn.nonStrikerId === dismissedBatterId) {
        inn.nonStrikerId = nextBatterId;
      }
      if (nextBatterId) {
        ensureBatter(inn, nextBatterId);
      }
    }
  }
  const inn1 = inningsList[0];
  const inn2 = inningsList[1];
  const activeInn = getActiveInnings();
  const activeSO = isSuperOver && superOvers.length > 0 ? superOvers[superOvers.length - 1] : null;
  const sideAScore = inn1.battingSide === "A" ? inn1 : inn2;
  const sideBScore = inn1.battingSide === "B" ? inn1 : inn2;
  const labelFor = (inn) => `${inn.runs}/${inn.wickets} (${formatOvers(inn.legalBalls)})`;
  let crr = 0;
  let target = null;
  let ballsRemaining = 0;
  let runsNeeded = null;
  let rrr = null;
  if (isSuperOver && activeSO) {
    const soInn = activeSO.halves[activeSO.activeHalf];
    crr = soInn.legalBalls > 0 ? Number((soInn.runs / ballsToOversDecimal(soInn.legalBalls)).toFixed(2)) : 0;
    target = activeSO.activeHalf === 1 ? activeSO.target : null;
    ballsRemaining = Math.max(0, superOverMaxBalls - soInn.legalBalls);
    runsNeeded = target !== null ? Math.max(0, target - soInn.runs) : null;
    rrr = target !== null && ballsRemaining > 0 ? Number((Math.max(0, target - soInn.runs) * 6 / ballsRemaining).toFixed(2)) : null;
  } else {
    crr = activeInn.legalBalls > 0 ? Number((activeInn.runs / ballsToOversDecimal(activeInn.legalBalls)).toFixed(2)) : 0;
    target = currentInningsIdx === 1 ? inn1.runs + 1 : null;
    ballsRemaining = Math.max(0, oversLimit * 6 - inn2.legalBalls);
    runsNeeded = target !== null ? Math.max(0, target - inn2.runs) : null;
    rrr = target !== null && ballsRemaining > 0 ? Number((Math.max(0, target - inn2.runs) * 6 / ballsRemaining).toFixed(2)) : null;
  }
  const innings1Complete = !isSuperOver && currentInningsIdx === 0 && (inn1.legalBalls >= oversLimit * 6 || inn1.wickets >= 10);
  const innings2Complete = !isSuperOver && currentInningsIdx === 1 && (inn2.runs >= inn1.runs + 1 || inn2.legalBalls >= oversLimit * 6 || inn2.wickets >= 10);
  let superOverHalf1Complete = false;
  let superOverComplete = false;
  let matchTied = false;
  let suggestedWinnerSide = null;
  if (isSuperOver && activeSO) {
    const h1 = activeSO.halves[0];
    const h2 = activeSO.halves[1];
    if (activeSO.activeHalf === 0) {
      superOverHalf1Complete = h1.legalBalls >= superOverMaxBalls || h1.wickets >= superOverMaxWickets;
    } else {
      const chased = activeSO.target !== null && h2.runs >= activeSO.target;
      const exhausted = h2.legalBalls >= superOverMaxBalls || h2.wickets >= superOverMaxWickets;
      superOverComplete = chased || exhausted;
      if (chased) {
        suggestedWinnerSide = h2.battingSide;
      } else if (exhausted) {
        if (h1.runs > h2.runs) suggestedWinnerSide = h1.battingSide;
        else if (h2.runs > h1.runs) suggestedWinnerSide = h2.battingSide;
        else {
          suggestedWinnerSide = "DRAW";
          matchTied = true;
        }
      }
    }
  } else if (currentInningsIdx === 1) {
    if (inn2.runs >= inn1.runs + 1) {
      suggestedWinnerSide = inn2.battingSide;
    } else if (inn2.legalBalls >= oversLimit * 6 || inn2.wickets >= 10) {
      if (inn1.runs > inn2.runs) suggestedWinnerSide = inn1.battingSide;
      else if (inn2.runs > inn1.runs) suggestedWinnerSide = inn2.battingSide;
      else {
        suggestedWinnerSide = "DRAW";
        matchTied = true;
      }
    }
  }
  const isCurrentInningsOver = isSuperOver ? activeSO?.activeHalf === 0 ? superOverHalf1Complete : superOverComplete : currentInningsIdx === 0 ? innings1Complete : innings2Complete;
  const overJustCompleted = !isSuperOver && !isCurrentInningsOver && activeInn.legalBalls > 0 && activeInn.legalBalls % 6 === 0 && !activeInn.bowlerSelectedForNewOver;
  const activeSideShort = activeInn.battingSide === "A" ? teamAShort : teamBShort;
  const summaryText = isSuperOver ? activeSO?.activeHalf === 1 && target !== null ? `SO${superOverIndex} \u2022 ${activeSideShort} ${labelFor(activeInn)} \u2022 Target ${target}` : `SO${superOverIndex} \u2022 ${activeSideShort} ${labelFor(activeInn)}` : currentInningsIdx === 0 ? `${activeSideShort} ${labelFor(activeInn)}` : `${activeSideShort} ${labelFor(activeInn)} \u2022 Target ${target}`;
  const periodLabel = isSuperOver ? activeSO?.activeHalf === 1 && target !== null ? `Super Over ${superOverIndex} (Target ${target})` : `Super Over ${superOverIndex}` : currentInningsIdx === 0 ? `1st Innings (${oversLimit} ov)` : `2nd Innings (Target ${target})`;
  const bowlingSide = activeInn.battingSide === "A" ? "B" : "A";
  return {
    sportId: "cricket",
    summaryText,
    teamAScoreLabel: labelFor(sideAScore),
    teamBScoreLabel: labelFor(sideBScore),
    teamANumeric: sideAScore.runs,
    teamBNumeric: sideBScore.runs,
    periodLabel,
    clock: resolveClockState(active, config),
    suggestedWinnerSide,
    activeEventCount: active.length,
    detail: {
      currentInningsIdx,
      oversLimit,
      crr,
      rrr,
      target,
      runsNeeded,
      ballsRemaining,
      freeHit: activeInn.freeHit,
      battingSide: activeInn.battingSide,
      bowlingSide,
      strikerId: activeInn.strikerId,
      nonStrikerId: activeInn.nonStrikerId,
      bowlerId: activeInn.bowlerId,
      lastCompletedOverBowlerId: activeInn.lastCompletedOverBowlerId,
      overJustCompleted,
      innings1Complete,
      innings2Complete,
      matchTied,
      extras: activeInn.extras,
      activeBatters: Object.values(activeInn.batters),
      activeBowlers: Object.values(activeInn.bowlers),
      recentBalls: activeInn.recentBalls,
      oversGroups: activeInn.oversGroups,
      currentOverBalls: activeInn.oversGroups[activeInn.oversGroups.length - 1]?.balls ?? [],
      // Super Over state
      isSuperOver,
      superOverIndex,
      superOverHalf: activeSO?.activeHalf ?? 0,
      superOverMaxBalls,
      superOverMaxWickets,
      superOverRuns: activeInn.runs,
      superOverWickets: activeInn.wickets,
      superOverLegalBalls: activeInn.legalBalls,
      superOverTarget: activeSO?.target ?? null,
      superOverHalf1Complete,
      superOverComplete,
      superOvers: superOvers.map((so) => ({
        index: so.index,
        target: so.target,
        activeHalf: so.activeHalf,
        halves: so.halves.map((h) => ({
          battingSide: h.battingSide,
          runs: h.runs,
          wickets: h.wickets,
          legalBalls: h.legalBalls,
          oversText: formatOvers(h.legalBalls)
        }))
      })),
      innings: inningsList.map((inn) => ({
        battingSide: inn.battingSide,
        runs: inn.runs,
        wickets: inn.wickets,
        legalBalls: inn.legalBalls,
        oversText: formatOvers(inn.legalBalls),
        oversDecimal: ballsToOversDecimal(inn.legalBalls),
        extras: inn.extras,
        batters: Object.values(inn.batters),
        bowlers: Object.values(inn.bowlers)
      }))
    }
  };
}

// shared/scoring/reducers/courtAndIndoor.ts
var SPECS = {
  volleyball: {
    bestOfGames: 3,
    targetPoints: 25,
    deciderPoints: 15,
    winByTwo: true,
    maxCap: null,
    serveRotationEvery: null
  },
  throwball: {
    bestOfGames: 3,
    targetPoints: 25,
    deciderPoints: 15,
    winByTwo: true,
    maxCap: null,
    serveRotationEvery: null
  },
  badminton: {
    bestOfGames: 3,
    targetPoints: 21,
    deciderPoints: 21,
    winByTwo: true,
    maxCap: 30,
    serveRotationEvery: null
  },
  table_tennis: {
    bestOfGames: 5,
    targetPoints: 11,
    deciderPoints: 11,
    winByTwo: true,
    maxCap: null,
    serveRotationEvery: 2
  }
};
function reduceSetSport(sportId, events, config = {}) {
  const base = SPECS[sportId];
  const bestOfGames = config.bestOfGames ?? base.bestOfGames;
  const targetPoints = config.targetPoints ?? base.targetPoints;
  const deciderPoints = config.deciderPoints ?? base.deciderPoints;
  const setsNeeded = Math.ceil(bestOfGames / 2);
  const active = events.filter((e) => !e.voided).sort((a, b) => a.seq - b.seq);
  const sets = [{ a: 0, b: 0, winner: null }];
  let serverSide = "A";
  let timeoutsA = 0;
  let timeoutsB = 0;
  for (const ev of active) {
    const p = ev.payloadJson;
    if (ev.eventType === "TIMEOUT") {
      if (p.side === "A") timeoutsA += 1;
      else if (p.side === "B") timeoutsB += 1;
      continue;
    }
    if (ev.eventType === "SET_SERVER") {
      if (p.side === "A" || p.side === "B") serverSide = p.side;
      continue;
    }
    if (ev.eventType !== "POINT") continue;
    let currentSet2 = sets[sets.length - 1];
    if (currentSet2.winner !== null) {
      if (sets.length < bestOfGames) {
        currentSet2 = { a: 0, b: 0, winner: null };
        sets.push(currentSet2);
      } else {
        continue;
      }
    }
    const side = p.side ?? "A";
    if (side === "A") currentSet2.a += 1;
    else currentSet2.b += 1;
    if (sportId === "table_tennis" && base.serveRotationEvery) {
      const totalPts = currentSet2.a + currentSet2.b;
      const inDeuce = currentSet2.a >= targetPoints - 1 && currentSet2.b >= targetPoints - 1;
      if (inDeuce) {
        serverSide = serverSide === "A" ? "B" : "A";
      } else if (totalPts % base.serveRotationEvery === 0) {
        serverSide = serverSide === "A" ? "B" : "A";
      }
    } else {
      serverSide = side;
    }
    const isDecider = sets.length === bestOfGames;
    const goal = isDecider ? deciderPoints : targetPoints;
    const lead = Math.abs(currentSet2.a - currentSet2.b);
    const maxScore = Math.max(currentSet2.a, currentSet2.b);
    const hitCap = base.maxCap !== null && maxScore >= base.maxCap;
    const wonNormally = maxScore >= goal && (!base.winByTwo || lead >= 2);
    if (hitCap || wonNormally) {
      currentSet2.winner = currentSet2.a > currentSet2.b ? "A" : "B";
      const setsWonA2 = sets.filter((s) => s.winner === "A").length;
      const setsWonB2 = sets.filter((s) => s.winner === "B").length;
      if (setsWonA2 < setsNeeded && setsWonB2 < setsNeeded && sets.length < bestOfGames) {
        sets.push({ a: 0, b: 0, winner: null });
      }
    }
  }
  const setsWonA = sets.filter((s) => s.winner === "A").length;
  const setsWonB = sets.filter((s) => s.winner === "B").length;
  const currentSet = sets[sets.length - 1];
  let suggestedWinnerSide = null;
  if (setsWonA >= setsNeeded) suggestedWinnerSide = "A";
  else if (setsWonB >= setsNeeded) suggestedWinnerSide = "B";
  const setScoresText = sets.map((s) => `${s.a}-${s.b}`).join(", ");
  const teamAShort = config.teamAShort ?? "TEAM A";
  const teamBShort = config.teamBShort ?? "TEAM B";
  return {
    sportId,
    summaryText: `${teamAShort} ${setsWonA}-${setsWonB} ${teamBShort} (${setScoresText})`,
    teamAScoreLabel: `${setsWonA} sets (${currentSet.a})`,
    teamBScoreLabel: `${setsWonB} sets (${currentSet.b})`,
    teamANumeric: setsWonA,
    teamBNumeric: setsWonB,
    periodLabel: `Set ${sets.length} of ${bestOfGames}`,
    clock: resolveClockState(active, config),
    suggestedWinnerSide,
    activeEventCount: active.length,
    detail: {
      bestOfGames,
      targetPoints,
      sets,
      setsWonA,
      setsWonB,
      currentSetNumber: sets.length,
      serverSide,
      timeoutsA,
      timeoutsB,
      badmintonInterval: sportId === "badminton" && (currentSet.a === 11 || currentSet.b === 11) && Math.min(currentSet.a, currentSet.b) < 11
    }
  };
}

// shared/scoring/reducers/fieldAndBoard.ts
function reduceFootball(events, config = {}) {
  const active = events.filter((e) => !e.voided).sort((a, b) => a.seq - b.seq);
  let goalsA = 0;
  let goalsB = 0;
  let penA = 0;
  let penB = 0;
  let period = "1H";
  const goalsList = [];
  const cards = [];
  const subs = [];
  for (const ev of active) {
    const p = ev.payloadJson;
    if (ev.eventType === "PERIOD") {
      period = String(p.period ?? period);
    } else if (ev.eventType === "GOAL") {
      const side = p.side ?? "A";
      if (side === "A") goalsA += 1;
      else goalsB += 1;
      goalsList.push({
        side,
        scorerId: p.scorerId ? Number(p.scorerId) : void 0,
        assistId: p.assistId ? Number(p.assistId) : void 0,
        minute: p.minute ? Number(p.minute) : void 0
      });
    } else if (ev.eventType === "CARD") {
      cards.push({
        side: p.side ?? "A",
        playerId: p.playerId ? Number(p.playerId) : void 0,
        card: p.card ?? "YELLOW",
        minute: p.minute ? Number(p.minute) : void 0
      });
    } else if (ev.eventType === "SUB") {
      subs.push({
        side: p.side ?? "A",
        outId: p.outId ? Number(p.outId) : void 0,
        inId: p.inId ? Number(p.inId) : void 0,
        minute: p.minute ? Number(p.minute) : void 0
      });
    } else if (ev.eventType === "PENALTY_SHOOTOUT") {
      const side = p.side ?? "A";
      if (p.scored) {
        if (side === "A") penA += 1;
        else penB += 1;
      }
    }
  }
  const teamAShort = config.teamAShort ?? "TEAM A";
  const teamBShort = config.teamBShort ?? "TEAM B";
  const penText = penA > 0 || penB > 0 ? ` (PEN ${penA}-${penB})` : "";
  let suggestedWinnerSide = null;
  if (period === "FT" || period === "PEN") {
    if (goalsA > goalsB || goalsA === goalsB && penA > penB) suggestedWinnerSide = "A";
    else if (goalsB > goalsA || goalsA === goalsB && penB > penA) suggestedWinnerSide = "B";
    else suggestedWinnerSide = "DRAW";
  }
  return {
    sportId: "football",
    summaryText: `${teamAShort} ${goalsA} - ${goalsB} ${teamBShort}${penText}`,
    teamAScoreLabel: String(goalsA),
    teamBScoreLabel: String(goalsB),
    teamANumeric: goalsA,
    teamBNumeric: goalsB,
    periodLabel: period,
    clock: resolveClockState(active, config),
    suggestedWinnerSide,
    activeEventCount: active.length,
    detail: {
      goalsA,
      goalsB,
      penA,
      penB,
      period,
      goalsList,
      cards,
      subs
    }
  };
}
function reduceKabaddi(events, config = {}) {
  const active = events.filter((e) => !e.voided).sort((a, b) => a.seq - b.seq);
  const stats = {
    A: { total: 0, raid: 0, tackle: 0, bonus: 0, allOut: 0, superRaid: 0, superTackle: 0 },
    B: { total: 0, raid: 0, tackle: 0, bonus: 0, allOut: 0, superRaid: 0, superTackle: 0 }
  };
  let period = "1st Half";
  let doOrDieA = 0;
  let doOrDieB = 0;
  for (const ev of active) {
    const p = ev.payloadJson;
    if (ev.eventType === "PERIOD") {
      period = String(p.period ?? period);
      continue;
    }
    const side = p.side ?? "A";
    const s = stats[side];
    if (ev.eventType === "RAID") {
      const pts = Number(p.points ?? 1);
      const bonus = Number(p.bonus ?? 0);
      s.raid += pts;
      s.bonus += bonus;
      s.total += pts + bonus;
      if (pts + bonus >= 3) s.superRaid += 1;
      if (side === "A") doOrDieA = 0;
      else doOrDieB = 0;
    } else if (ev.eventType === "EMPTY_RAID") {
      if (side === "A") doOrDieA = Math.min(2, doOrDieA + 1);
      else doOrDieB = Math.min(2, doOrDieB + 1);
    } else if (ev.eventType === "TACKLE") {
      const isSuper = Boolean(p.superTackle);
      const pts = isSuper ? 2 : Number(p.points ?? 1);
      s.tackle += pts;
      s.total += pts;
      if (isSuper) s.superTackle += 1;
    } else if (ev.eventType === "ALL_OUT") {
      s.allOut += 2;
      s.total += 2;
    }
  }
  const teamAShort = config.teamAShort ?? "TEAM A";
  const teamBShort = config.teamBShort ?? "TEAM B";
  return {
    sportId: "kabaddi",
    summaryText: `${teamAShort} ${stats.A.total} - ${stats.B.total} ${teamBShort}`,
    teamAScoreLabel: String(stats.A.total),
    teamBScoreLabel: String(stats.B.total),
    teamANumeric: stats.A.total,
    teamBNumeric: stats.B.total,
    periodLabel: period,
    clock: resolveClockState(active, config),
    suggestedWinnerSide: stats.A.total > stats.B.total ? "A" : stats.B.total > stats.A.total ? "B" : null,
    activeEventCount: active.length,
    detail: {
      stats,
      doOrDieA,
      doOrDieB,
      period
    }
  };
}
function reduceKhoKho(events, config = {}) {
  const active = events.filter((e) => !e.voided).sort((a, b) => a.seq - b.seq);
  let scoreA = 0;
  let scoreB = 0;
  let turn = 1;
  let chasingSide = "A";
  const dismissals = [];
  for (const ev of active) {
    const p = ev.payloadJson;
    if (ev.eventType === "TURN_SWITCH") {
      turn = Number(p.turn ?? turn + 1);
      chasingSide = p.chasingSide ?? (chasingSide === "A" ? "B" : "A");
    } else if (ev.eventType === "DISMISSAL") {
      const side = p.side ?? chasingSide;
      const pts = Number(p.points ?? 1);
      if (side === "A") scoreA += pts;
      else scoreB += pts;
      dismissals.push({
        turn,
        side,
        method: String(p.method ?? "TOUCH"),
        defenderId: p.defenderId ? Number(p.defenderId) : void 0
      });
    }
  }
  const teamAShort = config.teamAShort ?? "TEAM A";
  const teamBShort = config.teamBShort ?? "TEAM B";
  return {
    sportId: "kho_kho",
    summaryText: `${teamAShort} ${scoreA} - ${scoreB} ${teamBShort} (Turn ${turn})`,
    teamAScoreLabel: String(scoreA),
    teamBScoreLabel: String(scoreB),
    teamANumeric: scoreA,
    teamBNumeric: scoreB,
    periodLabel: `Turn ${turn} of 4 \u2022 Chasing: ${chasingSide === "A" ? teamAShort : teamBShort}`,
    clock: resolveClockState(active, config),
    suggestedWinnerSide: scoreA > scoreB ? "A" : scoreB > scoreA ? "B" : null,
    activeEventCount: active.length,
    detail: { turn, chasingSide, dismissals }
  };
}
function reduceCarrom(events, config = {}) {
  const active = events.filter((e) => !e.voided).sort((a, b) => a.seq - b.seq);
  let pointsA = 0;
  let pointsB = 0;
  const boards = [];
  for (const ev of active) {
    const p = ev.payloadJson;
    if (ev.eventType === "BOARD_RESULT") {
      const winner = p.side ?? "A";
      const pts = Number(p.points ?? 1);
      const queenCovered = Boolean(p.queenCovered);
      const total = pts + (queenCovered ? 3 : 0);
      if (winner === "A") pointsA += total;
      else pointsB += total;
      boards.push({
        boardNumber: boards.length + 1,
        winner,
        points: total,
        queenCovered
      });
    } else if (ev.eventType === "FOUL") {
      const side = p.side ?? "A";
      if (side === "A") pointsA = Math.max(0, pointsA - 1);
      else pointsB = Math.max(0, pointsB - 1);
    }
  }
  const teamAShort = config.teamAShort ?? "PLAYER A";
  const teamBShort = config.teamBShort ?? "PLAYER B";
  return {
    sportId: "carrom",
    summaryText: `${teamAShort} ${pointsA} - ${pointsB} ${teamBShort}`,
    teamAScoreLabel: String(pointsA),
    teamBScoreLabel: String(pointsB),
    teamANumeric: pointsA,
    teamBNumeric: pointsB,
    periodLabel: `Board ${boards.length + 1}`,
    clock: resolveClockState(active, config),
    suggestedWinnerSide: pointsA > pointsB ? "A" : pointsB > pointsA ? "B" : null,
    activeEventCount: active.length,
    detail: { boards, pointsA, pointsB }
  };
}
function reduceChess(events, config = {}) {
  const active = events.filter((e) => !e.voided).sort((a, b) => a.seq - b.seq);
  let scoreA = 0;
  let scoreB = 0;
  let termination = null;
  const moves = [];
  for (const ev of active) {
    const p = ev.payloadJson;
    if (ev.eventType === "MOVE") {
      moves.push({
        moveNo: Math.floor(moves.length / 2) + 1,
        side: p.side ?? (moves.length % 2 === 0 ? "A" : "B"),
        san: String(p.san ?? "")
      });
    } else if (ev.eventType === "RESULT") {
      const res = String(p.result ?? "1/2-1/2");
      termination = String(p.termination ?? "COMPLETED");
      if (res === "1-0") {
        scoreA = 1;
        scoreB = 0;
      } else if (res === "0-1") {
        scoreA = 0;
        scoreB = 1;
      } else {
        scoreA = 0.5;
        scoreB = 0.5;
      }
    }
  }
  const teamAShort = config.teamAShort ?? "WHITE";
  const teamBShort = config.teamBShort ?? "BLACK";
  const scoreLabel = termination ? `${scoreA} - ${scoreB} (${termination})` : `Move ${Math.floor(moves.length / 2) + 1}`;
  return {
    sportId: "chess",
    summaryText: `${teamAShort} vs ${teamBShort} \u2022 ${scoreLabel}`,
    teamAScoreLabel: String(scoreA),
    teamBScoreLabel: String(scoreB),
    teamANumeric: scoreA,
    teamBNumeric: scoreB,
    periodLabel: termination ? `Finished: ${termination}` : `In Progress (Ply ${moves.length})`,
    clock: resolveClockState(active, config),
    suggestedWinnerSide: termination === null ? null : scoreA > scoreB ? "A" : scoreB > scoreA ? "B" : "DRAW",
    activeEventCount: active.length,
    detail: { moves, termination, scoreA, scoreB }
  };
}

// shared/scoring/reducers/index.ts
function reduceMatchEvents(sportId, events, config = {}) {
  switch (sportId) {
    case "cricket":
      return reduceCricket(events, config);
    case "volleyball":
    case "throwball":
    case "badminton":
    case "table_tennis":
      return reduceSetSport(sportId, events, config);
    case "football":
      return reduceFootball(events, config);
    case "kabaddi":
      return reduceKabaddi(events, config);
    case "kho_kho":
      return reduceKhoKho(events, config);
    case "carrom":
      return reduceCarrom(events, config);
    case "chess":
      return reduceChess(events, config);
  }
}

// shared/scoring/standings.ts
function computeStandingsForSport(sportId, teamIds, completedMatches) {
  const table = /* @__PURE__ */ new Map();
  for (const tid of teamIds) {
    table.set(tid, {
      teamId: tid,
      played: 0,
      won: 0,
      lost: 0,
      drawn: 0,
      points: 0,
      nrr: 0,
      goalDiff: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      setsWon: 0,
      setsLost: 0,
      rank: 1,
      cricRunsFor: 0,
      cricOversFor: 0,
      cricRunsAgainst: 0,
      cricOversAgainst: 0
    });
  }
  const winPts = sportId === "football" ? 3 : 2;
  for (const m of completedMatches) {
    const a = table.get(m.teamAId);
    const b = table.get(m.teamBId);
    if (!a || !b) continue;
    a.played += 1;
    b.played += 1;
    if (m.winnerTeamId === m.teamAId) {
      a.won += 1;
      a.points += winPts;
      b.lost += 1;
    } else if (m.winnerTeamId === m.teamBId) {
      b.won += 1;
      b.points += winPts;
      a.lost += 1;
    } else {
      a.drawn += 1;
      b.drawn += 1;
      a.points += 1;
      b.points += 1;
    }
    if (sportId === "cricket") {
      const innings = m.derived.detail.innings ?? [];
      const oversLimit = Number(m.derived.detail.oversLimit ?? 10);
      for (const inn of innings) {
        const effOvers = inn.wickets >= 10 ? oversLimit : inn.oversDecimal;
        if (effOvers <= 0) continue;
        if (inn.battingSide === "A") {
          a.cricRunsFor += inn.runs;
          a.cricOversFor += effOvers;
          b.cricRunsAgainst += inn.runs;
          b.cricOversAgainst += effOvers;
        } else {
          b.cricRunsFor += inn.runs;
          b.cricOversFor += effOvers;
          a.cricRunsAgainst += inn.runs;
          a.cricOversAgainst += effOvers;
        }
      }
    } else if (sportId === "volleyball" || sportId === "throwball" || sportId === "badminton" || sportId === "table_tennis") {
      a.setsWon += m.derived.teamANumeric;
      a.setsLost += m.derived.teamBNumeric;
      b.setsWon += m.derived.teamBNumeric;
      b.setsLost += m.derived.teamANumeric;
    } else {
      a.goalsFor += m.derived.teamANumeric;
      a.goalsAgainst += m.derived.teamBNumeric;
      b.goalsFor += m.derived.teamBNumeric;
      b.goalsAgainst += m.derived.teamANumeric;
    }
  }
  const rows = Array.from(table.values()).map((r) => {
    const nrr = r.cricOversFor > 0 && r.cricOversAgainst > 0 ? Number((r.cricRunsFor / r.cricOversFor - r.cricRunsAgainst / r.cricOversAgainst).toFixed(3)) : 0;
    const goalDiff = r.goalsFor - r.goalsAgainst;
    return {
      teamId: r.teamId,
      played: r.played,
      won: r.won,
      lost: r.lost,
      drawn: r.drawn,
      points: r.points,
      nrr,
      goalDiff,
      goalsFor: r.goalsFor,
      goalsAgainst: r.goalsAgainst,
      setsWon: r.setsWon,
      setsLost: r.setsLost,
      rank: 1
    };
  });
  rows.sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    if (sportId === "cricket" && y.nrr !== x.nrr) return y.nrr - x.nrr;
    if (sportId === "volleyball" || sportId === "throwball" || sportId === "badminton" || sportId === "table_tennis") {
      const diffY = y.setsWon - y.setsLost;
      const diffX = x.setsWon - x.setsLost;
      if (diffY !== diffX) return diffY - diffX;
    }
    if (y.goalDiff !== x.goalDiff) return y.goalDiff - x.goalDiff;
    return y.won - x.won;
  });
  rows.forEach((r, idx) => {
    r.rank = idx + 1;
  });
  return rows;
}

// server/routes/matches.ts
var router6 = Router6();
async function hydrateMatchFull(matchId) {
  const [m] = await db.select().from(matches).where(eq9(matches.id, matchId)).limit(1);
  if (!m) return null;
  const [sport] = await db.select().from(sports).where(eq9(sports.id, m.sportId)).limit(1);
  const [tournament] = await db.select().from(tournaments).where(eq9(tournaments.id, m.tournamentId)).limit(1);
  const pairTeams = await db.select().from(teams).where(inArray5(teams.id, [m.teamAId, m.teamBId]));
  const teamA = pairTeams.find((t) => t.id === m.teamAId) ?? null;
  const teamB = pairTeams.find((t) => t.id === m.teamBId) ?? null;
  const rosterRows = await db.select({
    teamId: teamRosters.teamId,
    playerProfileId: teamRosters.playerProfileId,
    playingRole: teamRosters.playingRole,
    displayName: playerProfiles.displayName,
    batch: playerProfiles.batch,
    branch: playerProfiles.branch
  }).from(teamRosters).innerJoin(playerProfiles, eq9(teamRosters.playerProfileId, playerProfiles.id)).where(inArray5(teamRosters.teamId, [m.teamAId, m.teamBId]));
  const events = await db.select().from(matchEvents).where(eq9(matchEvents.matchId, m.id)).orderBy(asc5(matchEvents.seq));
  const referencedIds = /* @__PURE__ */ new Set([
    ...rosterRows.map((r) => r.playerProfileId),
    ...Array.isArray(m.lineupAJson) ? m.lineupAJson : [],
    ...Array.isArray(m.lineupBJson) ? m.lineupBJson : []
  ]);
  for (const ev of events) {
    const p = ev.payloadJson ?? {};
    for (const k of ["batterId", "nonStrikerId", "bowlerId", "fielderId", "scorerId", "assistId", "playerId", "defenderId", "chaserId"]) {
      const val = Number(p[k]);
      if (Number.isFinite(val) && val > 0) referencedIds.add(val);
    }
  }
  const extraProfileRows = referencedIds.size > 0 ? await db.select({ id: playerProfiles.id, displayName: playerProfiles.displayName }).from(playerProfiles).where(inArray5(playerProfiles.id, Array.from(referencedIds))) : [];
  const playerNames = {};
  for (const r of rosterRows) playerNames[r.playerProfileId] = r.displayName;
  for (const p of extraProfileRows) playerNames[p.id] = p.displayName;
  const [mvpRow] = await db.select({ playerProfileId: playerMatchStats.playerProfileId }).from(playerMatchStats).where(and8(eq9(playerMatchStats.matchId, m.id), eq9(playerMatchStats.isMvp, true))).limit(1);
  const scorerUser = m.scorerUserId ? (await db.select({ id: users.id, name: users.name }).from(users).where(eq9(users.id, m.scorerUserId)).limit(1))[0] ?? null : null;
  const cfg = m.configJson ?? {};
  const derived = reduceMatchEvents(
    sport?.slug ?? "cricket",
    events.map((e) => ({
      id: e.id,
      seq: e.seq,
      occurredAt: e.occurredAt.toISOString(),
      matchClockMs: e.matchClockMs,
      eventType: e.eventType,
      payloadJson: e.payloadJson,
      voided: e.voided
    })),
    {
      teamAShort: teamA?.shortCode ?? "TEAM A",
      teamBShort: teamB?.shortCode ?? "TEAM B",
      teamAName: teamA?.name ?? "Team A",
      teamBName: teamB?.name ?? "Team B",
      ...cfg
    }
  );
  return {
    match: m,
    sport,
    tournament,
    teamA: teamA ? { ...teamA, roster: rosterRows.filter((r) => r.teamId === teamA.id) } : null,
    teamB: teamB ? { ...teamB, roster: rosterRows.filter((r) => r.teamId === teamB.id) } : null,
    scorerUser,
    events: events.map(({ createdBy: _createdBy, ...ev }) => ev),
    playerNames,
    mvpPlayerProfileId: mvpRow?.playerProfileId ?? null,
    derived,
    serverNowMs: Date.now(),
    clock: {
      clockRunning: derived.clock.running,
      clockAnchorMs: derived.clock.anchorEpochMs,
      clockAccumulatedMs: derived.clock.accumulatedMs
    }
  };
}
router6.get("/", async (_req, res) => {
  const allMatches = await db.select().from(matches).orderBy(desc5(matches.scheduledAt));
  const allSports = await db.select().from(sports);
  const allTeams = await db.select().from(teams);
  const allTournaments = await db.select().from(tournaments);
  const sportMap = Object.fromEntries(allSports.map((s) => [s.id, s]));
  const teamMap = Object.fromEntries(allTeams.map((t) => [t.id, t]));
  const tourMap = Object.fromEntries(allTournaments.map((t) => [t.id, t]));
  const formatted = allMatches.filter((m) => tourMap[m.tournamentId]?.status !== "ARCHIVED").map((m) => ({
    ...m,
    sport: sportMap[m.sportId] ?? null,
    teamA: teamMap[m.teamAId] ?? null,
    teamB: teamMap[m.teamBId] ?? null,
    tournamentName: tourMap[m.tournamentId]?.name ?? ""
  }));
  res.json({
    liveMatches: formatted.filter((m) => m.status === "LIVE"),
    upcomingMatches: formatted.filter((m) => m.status === "UPCOMING"),
    completedMatches: formatted.filter((m) => m.status === "COMPLETED")
  });
});
router6.get("/:id", async (req, res) => {
  const matchId = parsePositiveIntId(req.params.id);
  if (!matchId) {
    res.status(400).json({ error: "Invalid match ID." });
    return;
  }
  const hydrated = await hydrateMatchFull(matchId);
  if (!hydrated) {
    res.status(404).json({ error: "Match not found." });
    return;
  }
  res.json({
    ...hydrated,
    permissions: {
      canScore: canScoreMatch(req.actor, hydrated.match.scorerUserId),
      canVerify: hasGlobalSportsAuthority(req.actor)
    }
  });
});
router6.post("/:id/transition", requireAuth, async (req, res) => {
  const matchId = parsePositiveIntId(req.params.id);
  if (!matchId) {
    res.status(400).json({ error: "Invalid match ID." });
    return;
  }
  const [existing] = await db.select().from(matches).where(eq9(matches.id, matchId)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Match not found." });
    return;
  }
  if (!canScoreMatch(req.actor, existing.scorerUserId)) {
    res.status(403).json({ error: "Only the assigned Match Scorer or Sports Secretary can change match state." });
    return;
  }
  const schema = z6.object({
    nextStatus: z6.enum(["LIVE", "COMPLETED"]),
    expectedVersion: z6.number().int().positive(),
    winnerTeamId: z6.number().int().positive().nullable().optional(),
    resultNote: z6.string().max(240).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid match transition payload." });
    return;
  }
  if (existing.status === "COMPLETED" && parsed.data.nextStatus === "LIVE") {
    if (!hasGlobalSportsAuthority(req.actor)) {
      res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can reopen a completed match." });
      return;
    }
  }
  if (existing.version !== parsed.data.expectedVersion) {
    res.status(409).json({
      error: "Stale match version detected (concurrent update). Please refresh before continuing."
    });
    return;
  }
  const isPlaceholderSummary = (val) => {
    const s = (val ?? "").trim().toLowerCase();
    return s === "" || s === "scheduled" || s === "kickoff scheduled";
  };
  const updated = await db.transaction(async (tx) => {
    let nextScoreSummary = existing.scoreSummary;
    let nextResultNote = parsed.data.resultNote?.trim() || existing.resultNote;
    if (parsed.data.nextStatus === "LIVE") {
      if (isPlaceholderSummary(nextScoreSummary)) {
        nextScoreSummary = "Live \u2014 In Progress";
      }
    } else if (parsed.data.nextStatus === "COMPLETED") {
      const [sportRow] = await tx.select({ slug: sports.slug }).from(sports).where(eq9(sports.id, existing.sportId)).limit(1);
      const pairTeams = await tx.select().from(teams).where(inArray5(teams.id, [existing.teamAId, existing.teamBId]));
      const teamA = pairTeams.find((t) => t.id === existing.teamAId);
      const teamB = pairTeams.find((t) => t.id === existing.teamBId);
      const events = await tx.select().from(matchEvents).where(and8(eq9(matchEvents.matchId, matchId), eq9(matchEvents.voided, false))).orderBy(asc5(matchEvents.seq));
      if (events.length > 0 && sportRow) {
        const derived = reduceMatchEvents(
          sportRow.slug,
          events.map((e) => ({
            id: e.id,
            seq: e.seq,
            occurredAt: e.occurredAt.toISOString(),
            matchClockMs: e.matchClockMs,
            eventType: e.eventType,
            payloadJson: e.payloadJson,
            voided: e.voided
          })),
          {
            teamAShort: teamA?.shortCode ?? "TEAM A",
            teamBShort: teamB?.shortCode ?? "TEAM B",
            ...existing.configJson
          }
        );
        if (derived.summaryText?.trim()) {
          nextScoreSummary = derived.summaryText.trim();
        }
      }
      if (isPlaceholderSummary(nextScoreSummary) || nextScoreSummary === "Live \u2014 In Progress") {
        const winnerId = parsed.data.winnerTeamId !== void 0 ? parsed.data.winnerTeamId : existing.winnerTeamId;
        const winnerTeam = winnerId === existing.teamAId ? teamA : winnerId === existing.teamBId ? teamB : null;
        if (nextResultNote?.trim()) {
          nextScoreSummary = nextResultNote.trim();
        } else if (winnerTeam) {
          nextScoreSummary = `${winnerTeam.name} Won`;
        } else if (parsed.data.winnerTeamId === null) {
          nextScoreSummary = "Match Tied";
        } else {
          nextScoreSummary = "Completed \u2014 Final Score";
        }
      }
      if (!nextResultNote?.trim()) {
        nextResultNote = nextScoreSummary ?? "Completed \u2014 Final Score";
      }
    }
    const [row] = await tx.update(matches).set({
      status: parsed.data.nextStatus,
      version: existing.version + 1,
      scoreSummary: nextScoreSummary,
      ...existing.status === "COMPLETED" && parsed.data.nextStatus === "LIVE" ? { verifiedBy: null, verifiedAt: null } : {},
      ...parsed.data.winnerTeamId !== void 0 ? { winnerTeamId: parsed.data.winnerTeamId } : {},
      ...nextResultNote ? { resultNote: nextResultNote } : {}
    }).where(and8(eq9(matches.id, matchId), eq9(matches.version, parsed.data.expectedVersion))).returning();
    if (row) {
      if (existing.status === "COMPLETED" && parsed.data.nextStatus === "LIVE") {
        await recomputeStandingsForTournamentSport(tx, existing.tournamentId, existing.sportId);
      }
      await recordAuditLog(tx, req.actor.id, `MATCH_STATUS_${parsed.data.nextStatus}`, "matches", matchId, {
        from: existing.status,
        to: parsed.data.nextStatus
      });
    }
    return row ?? null;
  });
  if (!updated) {
    res.status(409).json({ error: "Concurrent update conflict." });
    return;
  }
  const liveCountRows = await db.select({ id: matches.id }).from(matches).where(eq9(matches.status, "LIVE"));
  broadcastSse("MATCH_STATUS", {
    matchId,
    status: updated.status,
    version: updated.version,
    hasLiveMatches: liveCountRows.length > 0
  });
  broadcastSse("NAV_UPDATED", { hasLiveMatches: liveCountRows.length > 0 });
  res.json({ match: updated });
});
router6.post("/:id/clock", requireAuth, async (req, res) => {
  const matchId = parsePositiveIntId(req.params.id);
  if (!matchId) {
    res.status(400).json({ error: "Invalid match ID." });
    return;
  }
  const [preMatch] = await db.select({ id: matches.id, scorerUserId: matches.scorerUserId }).from(matches).where(eq9(matches.id, matchId)).limit(1);
  if (!preMatch) {
    res.status(404).json({ error: "Match not found." });
    return;
  }
  if (!canScoreMatch(req.actor, preMatch.scorerUserId)) {
    res.status(403).json({
      error: "Only the assigned Match Scorer or Sports Secretary can control the match clock."
    });
    return;
  }
  const schema = z6.object({
    action: z6.enum(["START", "PAUSE", "RESET"]),
    expectedVersion: z6.number().int().positive().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid clock action." });
    return;
  }
  const result = await db.transaction(async (tx) => {
    const [match] = await tx.select().from(matches).where(eq9(matches.id, matchId)).for("update").limit(1);
    if (!match) {
      return { ok: false, status: 404, error: "Match not found." };
    }
    if (!canScoreMatch(req.actor, match.scorerUserId)) {
      return {
        ok: false,
        status: 403,
        error: "Only the assigned Match Scorer or Sports Secretary can control the match clock."
      };
    }
    if (parsed.data.expectedVersion !== void 0 && match.version !== parsed.data.expectedVersion) {
      return {
        ok: false,
        status: 409,
        error: "Stale match version detected. Please refresh before continuing."
      };
    }
    const nowMs = Date.now();
    const prevCfg = match.configJson ?? {};
    const wasRunning = Boolean(prevCfg.clockRunning);
    const prevAnchor = prevCfg.clockAnchorMs ? Number(prevCfg.clockAnchorMs) : null;
    let clockAccumulatedMs = Math.max(0, Number(prevCfg.clockAccumulatedMs ?? 0));
    let clockRunning = wasRunning;
    let clockAnchorMs = prevAnchor;
    if (parsed.data.action === "START") {
      if (!wasRunning) {
        clockRunning = true;
        clockAnchorMs = nowMs;
      }
    } else if (parsed.data.action === "PAUSE") {
      if (wasRunning && prevAnchor !== null) {
        clockAccumulatedMs += Math.max(0, nowMs - prevAnchor);
      }
      clockRunning = false;
      clockAnchorMs = null;
    } else {
      clockRunning = false;
      clockAnchorMs = null;
      clockAccumulatedMs = 0;
    }
    const nextConfig = {
      ...prevCfg,
      clockRunning,
      clockAnchorMs,
      clockAccumulatedMs,
      clockManuallyReset: parsed.data.action === "RESET"
    };
    const [updated] = await tx.update(matches).set({
      configJson: nextConfig,
      version: match.version + 1
    }).where(and8(eq9(matches.id, matchId), eq9(matches.version, match.version))).returning();
    if (!updated) {
      return { ok: false, status: 409, error: "Concurrent clock update conflict." };
    }
    await recordAuditLog(tx, req.actor.id, `MATCH_CLOCK_${parsed.data.action}`, "matches", matchId, {
      clockRunning,
      clockAnchorMs,
      clockAccumulatedMs
    });
    return {
      ok: true,
      payload: {
        matchId,
        clockRunning,
        clockAnchorMs,
        clockAccumulatedMs,
        version: updated.version
      }
    };
  });
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  broadcastSse("MATCH_CLOCK", result.payload);
  res.json(result.payload);
});
router6.post("/:id/events", requireAuth, async (req, res) => {
  const matchId = parsePositiveIntId(req.params.id);
  if (!matchId) {
    res.status(400).json({ error: "Invalid match ID." });
    return;
  }
  const [preMatch] = await db.select({ id: matches.id, scorerUserId: matches.scorerUserId }).from(matches).where(eq9(matches.id, matchId)).limit(1);
  if (!preMatch) {
    res.status(404).json({ error: "Match not found." });
    return;
  }
  if (!canScoreMatch(req.actor, preMatch.scorerUserId)) {
    res.status(403).json({
      error: "Read-only access: Only the assigned Match Scorer or Sports Secretary can score this match."
    });
    return;
  }
  const schema = z6.object({
    eventType: z6.string().min(2).max(40),
    payloadJson: z6.record(z6.string(), z6.unknown()).default({}),
    matchClockMs: z6.number().int().nonnegative().nullable().optional(),
    expectedVersion: z6.number().int().positive().optional(),
    idempotencyKey: z6.string().min(4).max(120).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid scoring event payload." });
    return;
  }
  const idemKey = extractIdempotencyKey(req);
  const idemScope = `MATCH_EVENT:${matchId}`;
  const result = await db.transaction(async (tx) => {
    if (idemKey) {
      const prior = await findIdempotencyRecord(tx, idemScope, idemKey);
      if (prior) {
        return {
          ok: true,
          replayed: true,
          statusCode: prior.statusCode,
          responseJson: prior.responseJson
        };
      }
    }
    const [match] = await tx.select().from(matches).where(eq9(matches.id, matchId)).for("update").limit(1);
    if (!match) {
      return { ok: false, status: 404, error: "Match not found." };
    }
    if (!canScoreMatch(req.actor, match.scorerUserId)) {
      return {
        ok: false,
        status: 403,
        error: "Read-only access: Only the assigned Match Scorer or Sports Secretary can score this match."
      };
    }
    if (match.status !== "LIVE") {
      return { ok: false, status: 400, error: "Match must be LIVE to record scoring events." };
    }
    if (parsed.data.expectedVersion !== void 0 && match.version !== parsed.data.expectedVersion) {
      return {
        ok: false,
        status: 409,
        error: "Stale match version detected. Please refresh before scoring."
      };
    }
    const [sport] = await tx.select().from(sports).where(eq9(sports.id, match.sportId)).limit(1);
    const pairTeams = await tx.select().from(teams).where(inArray5(teams.id, [match.teamAId, match.teamBId]));
    const teamA = pairTeams.find((t) => t.id === match.teamAId);
    const teamB = pairTeams.find((t) => t.id === match.teamBId);
    const existingEvents = await tx.select().from(matchEvents).where(eq9(matchEvents.matchId, matchId)).orderBy(asc5(matchEvents.seq));
    const nextSeq = (existingEvents[existingEvents.length - 1]?.seq ?? 0) + 1;
    const [inserted] = await tx.insert(matchEvents).values({
      matchId,
      seq: nextSeq,
      eventType: parsed.data.eventType,
      payloadJson: parsed.data.payloadJson,
      matchClockMs: parsed.data.matchClockMs ?? null,
      createdBy: req.actor.id
    }).returning();
    const allEvents = [...existingEvents, inserted];
    const prevCfg = match.configJson ?? {};
    const shouldAutoStartClock = !prevCfg.clockRunning && !prevCfg.clockAnchorMs && Number(prevCfg.clockAccumulatedMs ?? 0) === 0 && !prevCfg.clockManuallyReset && !["CLOCK_START", "CLOCK_PAUSE", "CLOCK_RESET"].includes(parsed.data.eventType);
    const nextCfg = shouldAutoStartClock ? {
      ...prevCfg,
      clockRunning: true,
      clockAnchorMs: Date.now(),
      clockAccumulatedMs: 0
    } : prevCfg;
    const derived = reduceMatchEvents(
      sport?.slug ?? "cricket",
      allEvents.map((e) => ({
        id: e.id,
        seq: e.seq,
        occurredAt: e.occurredAt.toISOString(),
        matchClockMs: e.matchClockMs,
        eventType: e.eventType,
        payloadJson: e.payloadJson,
        voided: e.voided
      })),
      {
        teamAShort: teamA?.shortCode ?? "TEAM A",
        teamBShort: teamB?.shortCode ?? "TEAM B",
        ...nextCfg
      }
    );
    const [updatedMatch] = await tx.update(matches).set({
      scoreSummary: derived.summaryText,
      configJson: nextCfg,
      version: match.version + 1
    }).where(and8(eq9(matches.id, matchId), eq9(matches.version, match.version))).returning();
    if (!updatedMatch) {
      return { ok: false, status: 409, error: "Concurrent scoring conflict." };
    }
    const autoStartedClock = shouldAutoStartClock ? {
      clockRunning: true,
      clockAnchorMs: Number(nextCfg.clockAnchorMs),
      clockAccumulatedMs: 0
    } : null;
    const responseJson = {
      event: inserted,
      derived,
      version: updatedMatch.version,
      clock: autoStartedClock
    };
    if (idemKey) {
      await saveIdempotencyRecord(tx, {
        scope: idemScope,
        key: idemKey,
        actorUserId: req.actor.id,
        statusCode: 201,
        responseJson
      });
    }
    return {
      ok: true,
      replayed: false,
      inserted,
      derived,
      newVersion: updatedMatch.version,
      autoStartedClock,
      responseJson
    };
  });
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  if (result.replayed) {
    res.status(result.statusCode).json(result.responseJson);
    return;
  }
  if (result.autoStartedClock) {
    broadcastSse("MATCH_CLOCK", {
      matchId,
      ...result.autoStartedClock,
      version: result.newVersion
    });
  }
  broadcastSse("MATCH_EVENT", {
    matchId,
    event: result.inserted,
    scoreSummary: result.derived.summaryText,
    version: result.newVersion
  });
  res.status(201).json(result.responseJson);
});
router6.post("/:id/events/:seq/void", requireAuth, async (req, res) => {
  const matchId = parsePositiveIntId(req.params.id);
  const seq = parsePositiveIntId(req.params.seq);
  if (!matchId || !seq) {
    res.status(400).json({ error: "Invalid match ID or event sequence." });
    return;
  }
  const expectedVersion = req.body && typeof req.body === "object" && Number.isInteger(req.body.expectedVersion) ? Number(req.body.expectedVersion) : void 0;
  const result = await db.transaction(async (tx) => {
    const [match] = await tx.select().from(matches).where(eq9(matches.id, matchId)).for("update").limit(1);
    if (!match) {
      return { ok: false, status: 404, error: "Match not found." };
    }
    if (!canScoreMatch(req.actor, match.scorerUserId)) {
      return {
        ok: false,
        status: 403,
        error: "Only the assigned Match Scorer or Sports Secretary can undo events."
      };
    }
    if (match.status !== "LIVE") {
      return {
        ok: false,
        status: 409,
        error: "Cannot void events on a match that is not LIVE. Reopen the match first if correction is required."
      };
    }
    if (expectedVersion !== void 0 && match.version !== expectedVersion) {
      return {
        ok: false,
        status: 409,
        error: "Stale match version detected. Please refresh before undoing."
      };
    }
    const [sport] = await tx.select().from(sports).where(eq9(sports.id, match.sportId)).limit(1);
    const pairTeams = await tx.select().from(teams).where(inArray5(teams.id, [match.teamAId, match.teamBId]));
    const teamA = pairTeams.find((t) => t.id === match.teamAId);
    const teamB = pairTeams.find((t) => t.id === match.teamBId);
    const [voidedRow] = await tx.update(matchEvents).set({ voided: true }).where(and8(eq9(matchEvents.matchId, matchId), eq9(matchEvents.seq, seq), eq9(matchEvents.voided, false))).returning();
    if (!voidedRow) {
      return { ok: false, status: 409, error: "Event already voided or not found." };
    }
    const allEvents = await tx.select().from(matchEvents).where(eq9(matchEvents.matchId, matchId)).orderBy(asc5(matchEvents.seq));
    const derived = reduceMatchEvents(
      sport?.slug ?? "cricket",
      allEvents.map((e) => ({
        id: e.id,
        seq: e.seq,
        occurredAt: e.occurredAt.toISOString(),
        matchClockMs: e.matchClockMs,
        eventType: e.eventType,
        payloadJson: e.payloadJson,
        voided: e.voided
      })),
      {
        teamAShort: teamA?.shortCode ?? "TEAM A",
        teamBShort: teamB?.shortCode ?? "TEAM B",
        ...match.configJson
      }
    );
    const [updatedMatch] = await tx.update(matches).set({ scoreSummary: derived.summaryText, version: match.version + 1 }).where(and8(eq9(matches.id, matchId), eq9(matches.version, match.version))).returning();
    if (!updatedMatch) {
      return { ok: false, status: 409, error: "Concurrent void conflict." };
    }
    await recordAuditLog(tx, req.actor.id, "VOID_MATCH_EVENT", "match_events", `${matchId}:${seq}`, {});
    return { ok: true, derived, newVersion: updatedMatch.version };
  });
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  broadcastSse("MATCH_EVENT", {
    matchId,
    voidedSeq: seq,
    scoreSummary: result.derived.summaryText,
    version: result.newVersion
  });
  res.json({ derived: result.derived, version: result.newVersion });
});
router6.patch("/:id/lineup", requireAuth, async (req, res) => {
  const matchId = parsePositiveIntId(req.params.id);
  if (!matchId) {
    res.status(400).json({ error: "Invalid match ID." });
    return;
  }
  const schema = z6.object({
    side: z6.enum(["A", "B"]),
    playerProfileIds: z6.array(z6.number().int().positive()),
    overrideReason: z6.string().max(240).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid lineup payload." });
    return;
  }
  const [match] = await db.select().from(matches).where(eq9(matches.id, matchId)).limit(1);
  if (!match) {
    res.status(404).json({ error: "Match not found." });
    return;
  }
  if (match.status === "COMPLETED") {
    res.status(409).json({ error: "Cannot edit lineup on a completed match." });
    return;
  }
  const uniqueIds = Array.from(new Set(parsed.data.playerProfileIds));
  if (uniqueIds.length > 0) {
    const excludedIds = await getExcludedNonStudentIds();
    const excludedSet = new Set(excludedIds);
    const validProfiles = await db.select({ id: playerProfiles.id, userId: users.id, accountType: users.accountType }).from(playerProfiles).innerJoin(users, eq9(playerProfiles.userId, users.id)).where(inArray5(playerProfiles.id, uniqueIds));
    if (validProfiles.length !== uniqueIds.length || validProfiles.some((p) => p.accountType !== "STUDENT" || excludedSet.has(p.userId))) {
      res.status(400).json({ error: "All lineup playerProfileIds must belong to active student profiles." });
      return;
    }
  }
  const targetTeamId = parsed.data.side === "A" ? match.teamAId : match.teamBId;
  const [team] = await db.select().from(teams).where(eq9(teams.id, targetTeamId)).limit(1);
  const isTeamCaptain = team?.captainUserId === req.actor.id;
  const isScorerOrAdmin = canScoreMatch(req.actor, match.scorerUserId);
  if (!isTeamCaptain && !isScorerOrAdmin) {
    res.status(403).json({ error: "Only the team Captain, assigned Scorer, or Sports Secretary can update lineup." });
    return;
  }
  const [updated] = await db.transaction(async (tx) => {
    const [row] = await tx.update(matches).set(
      parsed.data.side === "A" ? { lineupAJson: uniqueIds } : { lineupBJson: uniqueIds }
    ).where(eq9(matches.id, matchId)).returning();
    await recordAuditLog(
      tx,
      req.actor.id,
      isScorerOrAdmin && !isTeamCaptain ? "LINEUP_GROUND_OVERRIDE" : "MATCH_LINEUP_UPDATED",
      "matches",
      matchId,
      {
        side: parsed.data.side,
        playerCount: uniqueIds.length,
        reason: parsed.data.overrideReason ?? "Match-scoped lineup adjustment"
      }
    );
    return [row];
  });
  broadcastSse("MATCH_LINEUP", {
    matchId,
    side: parsed.data.side,
    playerProfileIds: uniqueIds
  });
  res.json({ match: updated });
});
router6.post("/:id/lineup/members", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can modify match-scoped squads." });
    return;
  }
  const matchId = parsePositiveIntId(req.params.id);
  if (!matchId) {
    res.status(400).json({ error: "Invalid match ID." });
    return;
  }
  const schema = z6.object({
    side: z6.enum(["A", "B"]),
    action: z6.enum(["ADD", "REMOVE"]),
    playerProfileId: z6.number().int().positive()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid match lineup member payload." });
    return;
  }
  const [match] = await db.select().from(matches).where(eq9(matches.id, matchId)).limit(1);
  if (!match) {
    res.status(404).json({ error: "Match not found." });
    return;
  }
  if (match.status === "COMPLETED") {
    res.status(409).json({ error: "Cannot edit lineup on a completed match." });
    return;
  }
  const excludedIds = await getExcludedNonStudentIds();
  const [profile] = await db.select({ id: playerProfiles.id, userId: users.id, accountType: users.accountType }).from(playerProfiles).innerJoin(users, eq9(playerProfiles.userId, users.id)).where(eq9(playerProfiles.id, parsed.data.playerProfileId)).limit(1);
  if (!profile) {
    res.status(404).json({ error: "Player profile not found." });
    return;
  }
  if (profile.accountType !== "STUDENT" || excludedIds.includes(profile.userId)) {
    res.status(400).json({ error: "Only eligible student accounts can be added to match lineups." });
    return;
  }
  const currentList = Array.isArray(
    parsed.data.side === "A" ? match.lineupAJson : match.lineupBJson
  ) ? [...parsed.data.side === "A" ? match.lineupAJson : match.lineupBJson] : [];
  let nextList;
  if (parsed.data.action === "ADD") {
    nextList = Array.from(/* @__PURE__ */ new Set([...currentList, parsed.data.playerProfileId]));
  } else {
    nextList = currentList.filter((id) => id !== parsed.data.playerProfileId);
  }
  const [updated] = await db.transaction(async (tx) => {
    const [row] = await tx.update(matches).set(parsed.data.side === "A" ? { lineupAJson: nextList } : { lineupBJson: nextList }).where(eq9(matches.id, matchId)).returning();
    await recordAuditLog(tx, req.actor.id, "MATCH_LINEUP_UPDATED", "matches", matchId, {
      side: parsed.data.side,
      action: parsed.data.action,
      playerProfileId: parsed.data.playerProfileId
    });
    return [row];
  });
  broadcastSse("MATCH_STATUS", { matchId });
  res.json({ match: updated });
});
async function recomputeStandingsForTournamentSport(tx, tournamentId, sportId) {
  const [sport] = await tx.select().from(sports).where(eq9(sports.id, sportId)).limit(1);
  const sportSlug = sport?.slug ?? "cricket";
  const sportTeams = await tx.select().from(teams).where(and8(eq9(teams.tournamentId, tournamentId), eq9(teams.sportId, sportId)));
  const teamMap = Object.fromEntries(sportTeams.map((t) => [t.id, t]));
  const sportMatches = await tx.select().from(matches).where(
    and8(
      eq9(matches.tournamentId, tournamentId),
      eq9(matches.sportId, sportId),
      eq9(matches.status, "COMPLETED")
    )
  );
  const allEvents = sportMatches.length > 0 ? await tx.select().from(matchEvents).where(inArray5(matchEvents.matchId, sportMatches.map((m) => m.id))).orderBy(asc5(matchEvents.seq)) : [];
  const completedInputs = sportMatches.map((m) => {
    const mEvents = allEvents.filter((e) => e.matchId === m.id);
    const derived = reduceMatchEvents(
      sportSlug,
      mEvents.map((e) => ({
        id: e.id,
        seq: e.seq,
        occurredAt: e.occurredAt.toISOString(),
        matchClockMs: e.matchClockMs,
        eventType: e.eventType,
        payloadJson: e.payloadJson,
        voided: e.voided
      })),
      {
        teamAShort: teamMap[m.teamAId]?.shortCode ?? "A",
        teamBShort: teamMap[m.teamBId]?.shortCode ?? "B",
        ...m.configJson
      }
    );
    return {
      teamAId: m.teamAId,
      teamBId: m.teamBId,
      winnerTeamId: m.winnerTeamId,
      sportId: sportSlug,
      derived
    };
  });
  const computed = computeStandingsForSport(
    sportSlug,
    sportTeams.map((t) => t.id),
    completedInputs
  );
  for (const row of computed) {
    await tx.insert(standings).values({
      tournamentId,
      sportId,
      teamId: row.teamId,
      played: row.played,
      won: row.won,
      lost: row.lost,
      drawn: row.drawn,
      points: row.points,
      nrr: row.nrr,
      goalDiff: row.goalDiff,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      setsWon: row.setsWon,
      setsLost: row.setsLost,
      rank: row.rank
    }).onConflictDoUpdate({
      target: [standings.tournamentId, standings.sportId, standings.teamId],
      set: {
        played: row.played,
        won: row.won,
        lost: row.lost,
        drawn: row.drawn,
        points: row.points,
        nrr: row.nrr,
        goalDiff: row.goalDiff,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        setsWon: row.setsWon,
        setsLost: row.setsLost,
        rank: row.rank,
        updatedAt: /* @__PURE__ */ new Date()
      }
    });
  }
}
router6.patch("/:id", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can edit scheduled matches." });
    return;
  }
  const matchId = parsePositiveIntId(req.params.id);
  if (!matchId) {
    res.status(400).json({ error: "Invalid match ID." });
    return;
  }
  const [existing] = await db.select().from(matches).where(eq9(matches.id, matchId)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Match not found." });
    return;
  }
  const rawBody = req.body && typeof req.body === "object" ? req.body : {};
  const normalized = {
    ...rawBody,
    scheduledAt: rawBody.scheduledAt ?? rawBody.scheduledTime,
    roundLabel: rawBody.roundLabel ?? rawBody.stage
  };
  const schema = z6.object({
    roundLabel: z6.string().trim().min(2).max(80).optional(),
    matchOrder: z6.number().int().positive().optional(),
    venue: z6.string().trim().min(2).max(160).optional(),
    scheduledAt: z6.string().datetime().optional(),
    teamAId: z6.number().int().positive().optional(),
    teamBId: z6.number().int().positive().optional(),
    scorerUserId: z6.number().int().positive().nullable().optional(),
    expectedVersion: z6.number().int().positive().optional()
  });
  const parsed = schema.safeParse(normalized);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid match update payload." });
    return;
  }
  if (parsed.data.scorerUserId) {
    const [scorerRow] = await db.select({ id: users.id }).from(users).where(eq9(users.id, parsed.data.scorerUserId)).limit(1);
    if (!scorerRow) {
      res.status(404).json({ error: "Assigned scorer user not found." });
      return;
    }
  }
  const nextTeamAId = parsed.data.teamAId ?? existing.teamAId;
  const nextTeamBId = parsed.data.teamBId ?? existing.teamBId;
  if (nextTeamAId === nextTeamBId) {
    res.status(400).json({ error: "Team A and Team B must be different teams." });
    return;
  }
  if (parsed.data.teamAId !== void 0 || parsed.data.teamBId !== void 0) {
    const pairTeams = await db.select().from(teams).where(
      and8(
        eq9(teams.tournamentId, existing.tournamentId),
        eq9(teams.sportId, existing.sportId),
        inArray5(teams.id, [nextTeamAId, nextTeamBId])
      )
    );
    if (pairTeams.length !== 2 || pairTeams.some((t) => t.submissionStatus !== "APPROVED" && t.submissionStatus !== "LOCKED")) {
      res.status(400).json({ error: "Both teams must be APPROVED for this tournament and sport." });
      return;
    }
  }
  const editOutcome = await db.transaction(async (tx) => {
    const [lockedMatch] = await tx.select().from(matches).where(eq9(matches.id, matchId)).for("update").limit(1);
    if (!lockedMatch) {
      return { ok: false, status: 404, error: "Match not found." };
    }
    if (parsed.data.expectedVersion !== void 0 && lockedMatch.version !== parsed.data.expectedVersion) {
      return {
        ok: false,
        status: 409,
        error: "Match updated concurrently (stale version). Refreshing state."
      };
    }
    const [row] = await tx.update(matches).set({
      ...parsed.data.roundLabel !== void 0 ? { roundLabel: parsed.data.roundLabel } : {},
      ...parsed.data.matchOrder !== void 0 ? { matchOrder: parsed.data.matchOrder } : {},
      ...parsed.data.venue !== void 0 ? { venue: parsed.data.venue } : {},
      ...parsed.data.scheduledAt !== void 0 ? { scheduledAt: new Date(parsed.data.scheduledAt) } : {},
      ...parsed.data.teamAId !== void 0 ? { teamAId: parsed.data.teamAId } : {},
      ...parsed.data.teamBId !== void 0 ? { teamBId: parsed.data.teamBId } : {},
      ...parsed.data.scorerUserId !== void 0 ? { scorerUserId: parsed.data.scorerUserId } : {},
      version: lockedMatch.version + 1
    }).where(and8(eq9(matches.id, matchId), eq9(matches.version, lockedMatch.version))).returning();
    if (!row) {
      return {
        ok: false,
        status: 409,
        error: "Match updated concurrently (stale version). Refreshing state."
      };
    }
    if (lockedMatch.status === "COMPLETED" && (parsed.data.teamAId !== void 0 || parsed.data.teamBId !== void 0)) {
      await recomputeStandingsForTournamentSport(tx, lockedMatch.tournamentId, lockedMatch.sportId);
    }
    await recordAuditLog(tx, req.actor.id, "EDIT_MATCH", "matches", matchId, {
      fields: Object.keys(parsed.data)
    });
    return { ok: true, row };
  });
  if (!editOutcome.ok) {
    res.status(editOutcome.status).json({ error: editOutcome.error });
    return;
  }
  const updated = editOutcome.row;
  broadcastSse("MATCH_STATUS", { matchId, version: updated.version });
  res.json({ match: updated });
});
router6.delete("/:id", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can delete matches." });
    return;
  }
  const matchId = parsePositiveIntId(req.params.id);
  if (!matchId) {
    res.status(400).json({ error: "Invalid match ID." });
    return;
  }
  const [existing] = await db.select().from(matches).where(eq9(matches.id, matchId)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Match not found." });
    return;
  }
  await db.transaction(async (tx) => {
    await tx.delete(matches).where(eq9(matches.id, matchId));
    if (existing.status === "COMPLETED") {
      await recomputeStandingsForTournamentSport(tx, existing.tournamentId, existing.sportId);
    }
    await recordAuditLog(tx, req.actor.id, "DELETE_MATCH", "matches", matchId, {
      tournamentId: existing.tournamentId,
      sportId: existing.sportId,
      status: existing.status
    });
  });
  const liveCountRows = await db.select({ id: matches.id }).from(matches).where(eq9(matches.status, "LIVE"));
  broadcastSse("MATCH_STATUS", { matchId, deleted: true, hasLiveMatches: liveCountRows.length > 0 });
  broadcastSse("NAV_UPDATED", { hasLiveMatches: liveCountRows.length > 0 });
  res.json({ ok: true });
});
router6.post("/:id/verify", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can verify match results." });
    return;
  }
  const matchId = parsePositiveIntId(req.params.id);
  if (!matchId) {
    res.status(400).json({ error: "Invalid match id." });
    return;
  }
  const schema = z6.object({
    winnerTeamId: z6.number().int().positive().nullable(),
    resultNote: z6.string().min(2).max(240),
    mvpPlayerProfileId: z6.number().int().positive().nullable().optional(),
    expectedVersion: z6.number().int().positive().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid verification payload." });
    return;
  }
  const outcome = await db.transaction(async (tx) => {
    const [match] = await tx.select().from(matches).where(eq9(matches.id, matchId)).for("update").limit(1);
    if (!match) {
      return { ok: false, status: 404, error: "Match not found." };
    }
    if (parsed.data.expectedVersion !== void 0 && match.version !== parsed.data.expectedVersion) {
      return {
        ok: false,
        status: 409,
        error: "Match updated concurrently (stale version). Refreshing state."
      };
    }
    if (parsed.data.winnerTeamId !== null && parsed.data.winnerTeamId !== match.teamAId && parsed.data.winnerTeamId !== match.teamBId) {
      return {
        ok: false,
        status: 400,
        error: "winnerTeamId must be one of the participating teams in this match."
      };
    }
    const prevSummary = (match.scoreSummary ?? "").trim().toLowerCase();
    const shouldReplaceSummary = prevSummary === "" || prevSummary === "scheduled" || prevSummary === "kickoff scheduled" || prevSummary === "live \u2014 in progress";
    await tx.update(matches).set({
      status: "COMPLETED",
      winnerTeamId: parsed.data.winnerTeamId,
      resultNote: parsed.data.resultNote.trim(),
      ...shouldReplaceSummary ? { scoreSummary: parsed.data.resultNote.trim() } : {},
      verifiedBy: req.actor.id,
      verifiedAt: /* @__PURE__ */ new Date(),
      version: match.version + 1
    }).where(and8(eq9(matches.id, matchId), eq9(matches.version, match.version)));
    await recomputeStandingsForTournamentSport(tx, match.tournamentId, match.sportId);
    if (parsed.data.mvpPlayerProfileId) {
      await tx.update(playerMatchStats).set({ isMvp: false }).where(eq9(playerMatchStats.matchId, matchId));
      const [mvpRoster] = await tx.select({ teamId: teamRosters.teamId }).from(teamRosters).where(
        and8(
          inArray5(teamRosters.teamId, [match.teamAId, match.teamBId]),
          eq9(teamRosters.playerProfileId, parsed.data.mvpPlayerProfileId)
        )
      ).limit(1);
      const mvpTeamId = mvpRoster?.teamId ?? parsed.data.winnerTeamId ?? match.teamAId;
      await tx.insert(playerMatchStats).values({
        matchId,
        playerProfileId: parsed.data.mvpPlayerProfileId,
        teamId: mvpTeamId,
        sportId: match.sportId,
        statsJson: { verifiedResult: parsed.data.resultNote },
        isMvp: true,
        verified: true
      }).onConflictDoUpdate({
        target: [playerMatchStats.matchId, playerMatchStats.playerProfileId],
        set: { teamId: mvpTeamId, isMvp: true, verified: true }
      });
    }
    await recordAuditLog(tx, req.actor.id, "VERIFY_MATCH_RESULT", "matches", matchId, {
      winnerTeamId: parsed.data.winnerTeamId,
      resultNote: parsed.data.resultNote
    });
    return { ok: true };
  });
  if (!outcome.ok) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }
  const liveCountRows = await db.select({ id: matches.id }).from(matches).where(eq9(matches.status, "LIVE"));
  broadcastSse("MATCH_STATUS", {
    matchId,
    status: "COMPLETED",
    verified: true,
    hasLiveMatches: liveCountRows.length > 0
  });
  broadcastSse("NAV_UPDATED", { hasLiveMatches: liveCountRows.length > 0 });
  res.json({ ok: true });
});
var matches_default = router6;

// server/routes/archive.ts
import { Router as Router7 } from "express";
import { and as and9, asc as asc6, desc as desc6, eq as eq10, inArray as inArray6 } from "drizzle-orm";
import { z as z7 } from "zod";
var router7 = Router7();
router7.get("/years", async (_req, res) => {
  const archived = await db.select().from(tournaments).where(eq10(tournaments.status, "ARCHIVED")).orderBy(desc6(tournaments.academicYear), desc6(tournaments.startsAt));
  const years = Array.from(new Set(archived.map((t) => t.academicYear))).sort((a, b) => b - a);
  res.json({ years, tournaments: archived });
});
router7.get("/:year", async (req, res) => {
  const year = Number(req.params.year);
  if (!Number.isFinite(year)) {
    res.status(400).json({ error: "Invalid archive year." });
    return;
  }
  const q = String(req.query.q ?? "").trim().toLowerCase();
  const formatFilter = String(req.query.format ?? "").trim();
  const typeFilter = String(req.query.tournamentType ?? "").trim();
  const tourRows = await db.select().from(tournaments).where(and9(eq10(tournaments.status, "ARCHIVED"), eq10(tournaments.academicYear, year))).orderBy(desc6(tournaments.startsAt));
  const allYearIds = tourRows.map((t) => t.id);
  const [allTsRows, allTeamRows, allRosterPlayers] = allYearIds.length > 0 ? await Promise.all([
    db.select({
      tournamentId: tournamentSports.tournamentId,
      sportId: sports.id,
      slug: sports.slug,
      name: sports.name,
      winnerTeamId: tournamentSports.winnerTeamId,
      runnerUp1TeamId: tournamentSports.runnerUp1TeamId,
      runnerUp2TeamId: tournamentSports.runnerUp2TeamId
    }).from(tournamentSports).innerJoin(sports, eq10(tournamentSports.sportId, sports.id)).where(inArray6(tournamentSports.tournamentId, allYearIds)).orderBy(asc6(sports.displayOrder)),
    db.select({
      id: teams.id,
      tournamentId: teams.tournamentId,
      name: teams.name,
      shortCode: teams.shortCode
    }).from(teams).where(inArray6(teams.tournamentId, allYearIds)),
    db.select({
      tournamentId: teams.tournamentId,
      displayName: playerProfiles.displayName
    }).from(teamRosters).innerJoin(teams, eq10(teamRosters.teamId, teams.id)).innerJoin(playerProfiles, eq10(teamRosters.playerProfileId, playerProfiles.id)).where(inArray6(teams.tournamentId, allYearIds))
  ]) : [[], [], []];
  const filteredTours = tourRows.filter((t) => {
    if (formatFilter && t.format !== formatFilter) return false;
    if (typeFilter && t.tournamentType !== typeFilter) return false;
    if (q) {
      const matchesTournament = t.name.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q) || String(t.academicYear).includes(q);
      const matchesSport = allTsRows.some(
        (s) => s.tournamentId === t.id && (s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q))
      );
      const matchesTeam = allTeamRows.some(
        (tm) => tm.tournamentId === t.id && (tm.name.toLowerCase().includes(q) || tm.shortCode.toLowerCase().includes(q))
      );
      const matchesPlayer = allRosterPlayers.some(
        (p) => p.tournamentId === t.id && p.displayName.toLowerCase().includes(q)
      );
      if (!matchesTournament && !matchesSport && !matchesTeam && !matchesPlayer) {
        return false;
      }
    }
    return true;
  });
  const tourIds = filteredTours.map((t) => t.id);
  const tsRows = allTsRows.filter((s) => tourIds.includes(s.tournamentId));
  const teamRows = allTeamRows.filter((tm) => tourIds.includes(tm.tournamentId));
  const mediaRows = tourIds.length > 0 ? await db.select().from(tournamentMedia).where(inArray6(tournamentMedia.tournamentId, tourIds)) : [];
  const matchRows = tourIds.length > 0 ? await db.select({
    id: matches.id,
    tournamentId: matches.tournamentId,
    roundLabel: matches.roundLabel,
    scoreSummary: matches.scoreSummary,
    resultNote: matches.resultNote,
    sportName: sports.name,
    sportSlug: sports.slug,
    teamAId: matches.teamAId,
    teamBId: matches.teamBId
  }).from(matches).innerJoin(sports, eq10(matches.sportId, sports.id)).where(inArray6(matches.tournamentId, tourIds)).orderBy(desc6(matches.matchOrder), desc6(matches.scheduledAt)) : [];
  const teamMap = Object.fromEntries(teamRows.map((t) => [t.id, t]));
  res.json({
    year,
    tournaments: filteredTours.map((t) => ({
      ...t,
      sports: tsRows.filter((s) => s.tournamentId === t.id),
      media: mediaRows.filter((m) => m.tournamentId === t.id),
      matches: matchRows.filter((m) => m.tournamentId === t.id).map((m) => ({
        ...m,
        teamA: teamMap[m.teamAId] ?? null,
        teamB: teamMap[m.teamBId] ?? null
      }))
    }))
  });
});
router7.get("/:year/:tournamentId/:sportSlug", async (req, res) => {
  const year = Number(req.params.year);
  const tournamentId = Number(req.params.tournamentId);
  if (!Number.isFinite(year) || !Number.isFinite(tournamentId)) {
    res.status(404).json({ error: "Archived tournament not found." });
    return;
  }
  const [tournament] = await db.select().from(tournaments).where(
    and9(
      eq10(tournaments.id, tournamentId),
      eq10(tournaments.status, "ARCHIVED"),
      eq10(tournaments.academicYear, year)
    )
  ).limit(1);
  if (!tournament || tournament.status !== "ARCHIVED" || tournament.academicYear !== year) {
    res.status(404).json({ error: "Archived tournament not found for this year." });
    return;
  }
  const [sport] = await db.select().from(sports).where(eq10(sports.slug, req.params.sportSlug)).limit(1);
  if (!sport) {
    res.status(404).json({ error: "Sport not found." });
    return;
  }
  const [ts] = await db.select().from(tournamentSports).where(
    and9(eq10(tournamentSports.tournamentId, tournamentId), eq10(tournamentSports.sportId, sport.id))
  ).limit(1);
  const teamRows = await db.select().from(teams).where(and9(eq10(teams.tournamentId, tournamentId), eq10(teams.sportId, sport.id))).orderBy(asc6(teams.name));
  const teamIds = teamRows.map((t) => t.id);
  const rosterRows = teamIds.length > 0 ? await db.select({
    teamId: teamRosters.teamId,
    playerProfileId: teamRosters.playerProfileId,
    playingRole: teamRosters.playingRole,
    playerClass: teamRosters.playerClass,
    soldPrice: teamRosters.soldPrice,
    displayName: playerProfiles.displayName,
    batch: playerProfiles.batch,
    branch: playerProfiles.branch
  }).from(teamRosters).innerJoin(playerProfiles, eq10(teamRosters.playerProfileId, playerProfiles.id)).where(inArray6(teamRosters.teamId, teamIds)) : [];
  const standingRows = await db.select().from(standings).where(and9(eq10(standings.tournamentId, tournamentId), eq10(standings.sportId, sport.id))).orderBy(asc6(standings.rank));
  const matchRows = await db.select().from(matches).where(and9(eq10(matches.tournamentId, tournamentId), eq10(matches.sportId, sport.id))).orderBy(desc6(matches.matchOrder), desc6(matches.scheduledAt));
  const teamMap = Object.fromEntries(teamRows.map((t) => [t.id, t]));
  res.json({
    tournament,
    sport,
    podium: {
      winner: ts?.winnerTeamId ? teamMap[ts.winnerTeamId] ?? null : null,
      runnerUp1: ts?.runnerUp1TeamId ? teamMap[ts.runnerUp1TeamId] ?? null : null,
      runnerUp2: ts?.runnerUp2TeamId ? teamMap[ts.runnerUp2TeamId] ?? null : null
    },
    standings: standingRows.map((s) => ({
      ...s,
      team: teamMap[s.teamId] ?? null
    })),
    matches: matchRows.map((m) => ({
      ...m,
      teamA: teamMap[m.teamAId] ?? null,
      teamB: teamMap[m.teamBId] ?? null
    })),
    teams: teamRows.map((t) => ({
      ...t,
      roster: rosterRows.filter((r) => r.teamId === t.id)
    }))
  });
});
router7.post("/legacy", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can add legacy archive records." });
    return;
  }
  const schema = z7.object({
    name: z7.string().min(3).max(160),
    academicYear: z7.number().int().min(2015).max(2030),
    semester: z7.enum(["ODD", "EVEN", "ANNUAL"]).default("ANNUAL"),
    tournamentType: z7.enum(["FLAGSHIP", "INTER_HOSTEL", "OPEN", "INTRA_CLUB", "PROTHYMOS"]),
    format: z7.enum(["KNOCKOUT", "LEAGUE", "ROUND_ROBIN", "GROUP_KNOCKOUT", "BEST_OF_SERIES"]),
    completenessStatus: z7.enum(["RESULTS_ONLY", "PARTIAL", "COMPLETE", "VERIFIED"]),
    sportId: z7.number().int().positive(),
    winnerName: z7.string().min(2).max(80),
    runnerUp1Name: z7.string().min(2).max(80),
    runnerUp2Name: z7.string().max(80).optional().nullable(),
    finalSummary: z7.string().min(3).max(240),
    description: z7.string().max(400).optional(),
    mediaUrl: z7.string().max(400).optional().nullable()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid legacy archive record." });
    return;
  }
  const created = await db.transaction(async (tx) => {
    const [t] = await tx.insert(tournaments).values({
      name: parsed.data.name.trim(),
      academicYear: parsed.data.academicYear,
      semester: parsed.data.semester,
      tournamentType: parsed.data.tournamentType,
      format: parsed.data.format,
      rosterMode: "CAPTAIN_SUBMISSION",
      status: "ARCHIVED",
      completenessStatus: parsed.data.completenessStatus,
      isCurrent: false,
      description: parsed.data.description?.trim() || null,
      startsAt: /* @__PURE__ */ new Date(`${parsed.data.academicYear}-03-15T09:00:00Z`),
      verifiedBy: req.actor.id
    }).returning();
    const [winTeam] = await tx.insert(teams).values({
      tournamentId: t.id,
      sportId: parsed.data.sportId,
      name: parsed.data.winnerName.trim(),
      shortCode: parsed.data.winnerName.trim().slice(0, 3).toUpperCase(),
      submissionStatus: "LOCKED"
    }).returning();
    const [ru1Team] = await tx.insert(teams).values({
      tournamentId: t.id,
      sportId: parsed.data.sportId,
      name: parsed.data.runnerUp1Name.trim(),
      shortCode: parsed.data.runnerUp1Name.trim().slice(0, 3).toUpperCase(),
      submissionStatus: "LOCKED"
    }).returning();
    let ru2Id = null;
    if (parsed.data.runnerUp2Name?.trim()) {
      const [ru2Team] = await tx.insert(teams).values({
        tournamentId: t.id,
        sportId: parsed.data.sportId,
        name: parsed.data.runnerUp2Name.trim(),
        shortCode: parsed.data.runnerUp2Name.trim().slice(0, 3).toUpperCase(),
        submissionStatus: "LOCKED"
      }).returning();
      ru2Id = ru2Team.id;
    }
    await tx.insert(tournamentSports).values({
      tournamentId: t.id,
      sportId: parsed.data.sportId,
      format: parsed.data.format,
      winnerTeamId: winTeam.id,
      runnerUp1TeamId: ru1Team.id,
      runnerUp2TeamId: ru2Id
    });
    await tx.insert(matches).values({
      tournamentId: t.id,
      sportId: parsed.data.sportId,
      roundLabel: "Final",
      matchOrder: 1,
      teamAId: winTeam.id,
      teamBId: ru1Team.id,
      venue: "IIITT Campus Ground",
      scheduledAt: /* @__PURE__ */ new Date(`${parsed.data.academicYear}-03-20T16:00:00Z`),
      status: "COMPLETED",
      scoreSummary: parsed.data.finalSummary.trim(),
      resultNote: `${winTeam.name} won the championship`,
      winnerTeamId: winTeam.id,
      verifiedBy: req.actor.id,
      verifiedAt: /* @__PURE__ */ new Date()
    });
    if (parsed.data.mediaUrl) {
      await tx.insert(tournamentMedia).values({
        tournamentId: t.id,
        title: `${t.name} Official Record`,
        mediaType: parsed.data.mediaUrl.endsWith(".pdf") ? "PDF" : "IMAGE",
        fileUrl: parsed.data.mediaUrl,
        uploadedBy: req.actor.id
      });
    }
    await recordAuditLog(tx, req.actor.id, "CREATE_LEGACY_ARCHIVE", "tournaments", t.id, {});
    return t;
  });
  res.status(201).json({ tournament: created });
});
var archive_default = router7;

// server/routes/players.ts
import { Router as Router8 } from "express";
import { and as and10, asc as asc7, desc as desc7, eq as eq11 } from "drizzle-orm";
import { z as z8 } from "zod";
var router8 = Router8();
router8.get("/:id", async (req, res) => {
  const profileId = Number(req.params.id);
  if (!Number.isFinite(profileId)) {
    res.status(400).json({ error: "Invalid player profile ID." });
    return;
  }
  const [profile] = await db.select().from(playerProfiles).where(eq11(playerProfiles.id, profileId)).limit(1);
  if (!profile) {
    res.status(404).json({ error: "Player profile not found." });
    return;
  }
  const isAuthenticated = Boolean(req.actor);
  const isOwner = req.actor?.playerProfileId === profile.id;
  const canViewPersonalBio = isOwner || profile.visibility === "PUBLIC" || profile.visibility === "IIITT_ONLY" && isAuthenticated;
  const clubBadges = await db.select({
    clubId: sportsClubs.id,
    clubSlug: sportsClubs.slug,
    clubName: sportsClubs.name,
    role: clubMemberships.role,
    batchScope: clubMemberships.batchScope,
    scopeLabel: clubMemberships.scopeLabel,
    status: clubMemberships.status,
    inductedAt: clubMemberships.inductedAt
  }).from(clubMemberships).innerJoin(sportsClubs, eq11(clubMemberships.clubId, sportsClubs.id)).where(
    and10(eq11(clubMemberships.playerProfileId, profile.id), eq11(clubMemberships.status, "INDUCTED"))
  ).orderBy(asc7(sportsClubs.name));
  const teamAppearances = await db.select({
    teamId: teams.id,
    teamName: teams.name,
    shortCode: teams.shortCode,
    playingRole: teamRosters.playingRole,
    playerClass: teamRosters.playerClass,
    tournamentId: tournaments.id,
    tournamentName: tournaments.name,
    academicYear: tournaments.academicYear,
    sportName: sports.name,
    sportSlug: sports.slug
  }).from(teamRosters).innerJoin(teams, eq11(teamRosters.teamId, teams.id)).innerJoin(tournaments, eq11(teams.tournamentId, tournaments.id)).innerJoin(sports, eq11(teams.sportId, sports.id)).where(eq11(teamRosters.playerProfileId, profile.id)).orderBy(desc7(tournaments.academicYear));
  const matchStatRows = await db.select({
    matchId: matches.id,
    roundLabel: matches.roundLabel,
    scoreSummary: matches.scoreSummary,
    resultNote: matches.resultNote,
    scheduledAt: matches.scheduledAt,
    sportName: sports.name,
    statsJson: playerMatchStats.statsJson,
    isMvp: playerMatchStats.isMvp
  }).from(playerMatchStats).innerJoin(matches, eq11(playerMatchStats.matchId, matches.id)).innerJoin(sports, eq11(playerMatchStats.sportId, sports.id)).where(eq11(playerMatchStats.playerProfileId, profile.id)).orderBy(desc7(matches.scheduledAt));
  res.json({
    profile: {
      id: profile.id,
      displayName: profile.displayName,
      college: profile.college ?? FIXED_COLLEGE,
      batch: profile.batch,
      programType: profile.programType ?? "BTECH",
      currentSemester: profile.currentSemester ?? 1,
      isGraduated: Boolean(profile.isGraduated),
      gender: profile.gender ?? "BOYS",
      branch: profile.branch,
      rollNumber: isAuthenticated ? profile.rollNumber : null,
      // Internal @iiitt.ac.in only
      avatarUrl: profile.avatarUrl,
      visibility: profile.visibility,
      isClaimed: profile.isClaimed,
      bio: canViewPersonalBio ? profile.bio : null,
      preferredSports: canViewPersonalBio ? profile.preferredSports : [],
      privacyRestricted: !canViewPersonalBio
    },
    clubBadges,
    teamAppearances,
    matchStats: matchStatRows
  });
});
router8.patch("/me", requireAuth, async (req, res) => {
  if (!req.actor?.playerProfileId) {
    res.status(404).json({ error: "Player profile not found." });
    return;
  }
  const schema = z8.object({
    bio: z8.string().max(400).optional().nullable(),
    branch: z8.string().max(40).optional().nullable(),
    preferredSports: z8.array(z8.string()).max(10).optional(),
    visibility: z8.enum(["PUBLIC", "IIITT_ONLY", "PRIVATE"]).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid profile update payload." });
    return;
  }
  const [updated] = await db.update(playerProfiles).set({
    ...parsed.data.bio !== void 0 ? { bio: parsed.data.bio?.trim() || null } : {},
    ...parsed.data.branch !== void 0 ? { branch: parsed.data.branch?.trim() || null } : {},
    ...parsed.data.preferredSports ? { preferredSports: parsed.data.preferredSports } : {},
    ...parsed.data.visibility ? { visibility: parsed.data.visibility } : {}
  }).where(eq11(playerProfiles.id, req.actor.playerProfileId)).returning();
  res.json({ profile: updated });
});
router8.patch("/:id/academic", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({
      error: "Only Sports Secretary or Faculty Advisor can override academic progression."
    });
    return;
  }
  const profileId = parsePositiveIntId(req.params.id);
  if (!profileId) {
    res.status(400).json({ error: "Invalid player profile ID." });
    return;
  }
  const schema = z8.object({
    batch: z8.enum(["1ST", "2ND", "3RD", "4TH", "MTECH"]),
    branch: z8.string().trim().min(2).max(40).optional().nullable(),
    programType: z8.enum(["BTECH", "MTECH"]),
    currentSemester: z8.number().int().min(1).max(8),
    isGraduated: z8.boolean().default(false),
    gender: z8.enum(["BOYS", "GIRLS"]).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid academic override payload." });
    return;
  }
  const cap = maxSemesterForProgram(parsed.data.programType);
  if (parsed.data.currentSemester > cap) {
    res.status(400).json({
      error: `Semester cannot exceed ${cap} for ${parsed.data.programType}.`
    });
    return;
  }
  const updated = await db.transaction(async (tx) => {
    const [prof] = await tx.select().from(playerProfiles).where(eq11(playerProfiles.id, profileId)).limit(1);
    if (!prof) return null;
    const [nextProf] = await tx.update(playerProfiles).set({
      college: FIXED_COLLEGE,
      batch: parsed.data.batch,
      programType: parsed.data.programType,
      currentSemester: parsed.data.currentSemester,
      isGraduated: parsed.data.isGraduated,
      ...parsed.data.branch !== void 0 ? { branch: parsed.data.branch?.trim().toUpperCase() || null } : {},
      ...parsed.data.gender ? { gender: parsed.data.gender } : {}
    }).where(eq11(playerProfiles.id, profileId)).returning();
    if (prof.userId) {
      await tx.update(users).set({
        college: FIXED_COLLEGE,
        batch: parsed.data.batch,
        programType: parsed.data.programType,
        currentSemester: parsed.data.currentSemester,
        isGraduated: parsed.data.isGraduated,
        ...parsed.data.gender ? { gender: parsed.data.gender } : {}
      }).where(eq11(users.id, prof.userId));
    }
    await recordAuditLog(tx, req.actor.id, "ACADEMIC_OVERRIDE", "player_profiles", profileId, {
      batch: parsed.data.batch,
      programType: parsed.data.programType,
      currentSemester: parsed.data.currentSemester,
      isGraduated: parsed.data.isGraduated
    });
    return nextProf;
  });
  if (!updated) {
    res.status(404).json({ error: "Player profile not found." });
    return;
  }
  res.json({ profile: updated });
});
var players_default = router8;

// server/routes/auction.ts
import crypto4 from "crypto";
import { Router as Router9 } from "express";
import { and as and11, asc as asc8, desc as desc8, eq as eq12, inArray as inArray7, isNull as isNull3, or as or4 } from "drizzle-orm";
import { z as z9 } from "zod";
var router9 = Router9();
function getSportEffectiveBasePrices(auction, sportId) {
  const override = auction.sportBasePricesJson?.[String(sportId)];
  return {
    clubBasePrice: override?.clubBasePrice ?? auction.clubBasePrice,
    nonClubBasePrice: override?.nonClubBasePrice ?? auction.nonClubBasePrice
  };
}
async function getActiveCaptainUserIds(auctionId) {
  const [roleCaps, franchiseCaps, activeTournaments] = await Promise.all([
    db.select({
      userId: userRoles.userId,
      auctionId: userRoles.auctionId,
      tournamentId: userRoles.tournamentId
    }).from(userRoles).where(and11(eq12(userRoles.active, true), eq12(userRoles.roleCode, "CAPTAIN"))),
    db.select({ captainUserId: auctionFranchises.captainUserId }).from(auctionFranchises).where(
      and11(
        eq12(auctionFranchises.auctionId, auctionId),
        eq12(auctionFranchises.status, "APPROVED")
      )
    ),
    db.select({ id: tournaments.id }).from(tournaments).where(eq12(tournaments.isCurrent, true))
  ]);
  const activeTournamentIds = new Set(activeTournaments.map((t) => t.id));
  const ids = /* @__PURE__ */ new Set();
  for (const rc of roleCaps) {
    if ((rc.auctionId === null || rc.auctionId === auctionId) && (rc.tournamentId === null || activeTournamentIds.has(rc.tournamentId))) {
      ids.add(rc.userId);
    }
  }
  for (const fc of franchiseCaps) {
    if (fc.captainUserId) ids.add(fc.captainUserId);
  }
  if (activeTournaments.length > 0) {
    const teamCaps = await db.select({ captainUserId: teams.captainUserId }).from(teams).where(
      and11(
        inArray7(
          teams.tournamentId,
          activeTournaments.map((t) => t.id)
        ),
        inArray7(teams.submissionStatus, ["APPROVED", "LOCKED"])
      )
    );
    for (const tc of teamCaps) {
      if (tc.captainUserId) ids.add(tc.captainUserId);
    }
  }
  return ids;
}
function getIncrementalStep(auction, currentAmount) {
  const slabs = auction.bidSlabsJson ?? [];
  for (const slab of slabs) {
    if (slab.upTo === null || currentAmount < slab.upTo) {
      return slab.increment;
    }
  }
  return auction.defaultIncrement;
}
async function getActiveOrLatestAuction(executor = db) {
  const all = await executor.select().from(auctions).orderBy(desc8(auctions.id)).limit(5);
  return all.find((a) => a.status === "LIVE") ?? all.find((a) => a.status !== "COMPLETED") ?? all[0] ?? null;
}
function checkVersionConflict(res, auction, expectedVersion) {
  if (expectedVersion !== void 0 && auction.version !== expectedVersion) {
    res.status(409).json({
      error: "Auction state changed concurrently. Synced latest state\u2014please retry.",
      currentVersion: auction.version
    });
    return true;
  }
  return false;
}
async function computeFranchiseGuardrail(executor, auction, franchise, candidateClass) {
  const soldRows = await executor.select({
    playerClass: auctionRegistrations.playerClass
  }).from(auctionRegistrations).where(
    and11(
      eq12(auctionRegistrations.auctionId, auction.id),
      eq12(auctionRegistrations.sportId, franchise.sportId),
      eq12(auctionRegistrations.soldFranchiseId, franchise.id),
      eq12(auctionRegistrations.status, "SOLD")
    )
  );
  const squadCount = soldRows.length;
  const clubCount = soldRows.filter((r) => r.playerClass === "CLUB").length;
  const nonClubCount = soldRows.filter((r) => r.playerClass === "NON_CLUB").length;
  const sportPrices = getSportEffectiveBasePrices(auction, franchise.sportId);
  const guardrail = computeMaxAllowedBid({
    remainingPurse: franchise.remainingPurse,
    currentSquadCount: squadCount,
    currentClubCount: clubCount,
    currentNonClubCount: nonClubCount,
    minSquad: franchise.minSquad,
    maxSquad: franchise.maxSquad,
    minClubQuota: franchise.minClubQuota,
    minNonClubQuota: franchise.minNonClubQuota,
    clubBasePrice: sportPrices.clubBasePrice,
    nonClubBasePrice: sportPrices.nonClubBasePrice,
    candidateClass
  });
  return {
    squadCount,
    clubCount,
    nonClubCount,
    ...guardrail
  };
}
async function buildAuctionSnapshot(actor, sportIdOverride) {
  const auction = await getActiveOrLatestAuction();
  const allSports = await db.select().from(sports).orderBy(asc8(sports.displayOrder));
  const clubRows = await db.select().from(sportsClubs);
  const clubBySportId = Object.fromEntries(clubRows.map((c) => [c.sportId, c]));
  if (!auction) {
    return {
      auction: null,
      sports: allSports,
      rounds: [],
      franchises: [],
      registrations: [],
      teamRegistrations: [],
      activePlayer: null,
      activeBids: [],
      rtmEntries: [],
      myRegistrations: [],
      myWatchlist: [],
      myInductedSportIds: [],
      permissions: {
        canManageConfig: hasGlobalSportsAuthority(actor),
        canOperateStage: canOperateAuction(actor, null),
        canRegister: Boolean(actor && actor.accountType === "STUDENT")
      }
    };
  }
  const effectiveSportId = sportIdOverride && allSports.some((s) => s.id === sportIdOverride) ? sportIdOverride : auction.activeSportId ?? allSports[0]?.id ?? null;
  const rounds = await db.select().from(auctionRounds).where(eq12(auctionRounds.auctionId, auction.id)).orderBy(asc8(auctionRounds.roundOrder), asc8(auctionRounds.id));
  const franchiseRows = await db.select().from(auctionFranchises).where(
    and11(
      eq12(auctionFranchises.auctionId, auction.id),
      eq12(auctionFranchises.status, "APPROVED")
    )
  ).orderBy(asc8(auctionFranchises.sportId), asc8(auctionFranchises.slotNumber), asc8(auctionFranchises.id));
  const captainIds = Array.from(
    new Set(franchiseRows.map((f) => f.captainUserId).filter((id) => id !== null))
  );
  const captainRows = captainIds.length > 0 ? await db.select({
    id: users.id,
    name: users.name,
    rollNumber: users.rollNumber,
    batch: users.batch
  }).from(users).where(inArray7(users.id, captainIds)) : [];
  const captainMap = Object.fromEntries(captainRows.map((c) => [c.id, c]));
  const regRows = await db.select({
    reg: auctionRegistrations,
    profile: {
      displayName: playerProfiles.displayName,
      batch: playerProfiles.batch,
      branch: playerProfiles.branch,
      rollNumber: playerProfiles.rollNumber,
      userId: playerProfiles.userId,
      avatarUrl: playerProfiles.avatarUrl
    }
  }).from(auctionRegistrations).innerJoin(playerProfiles, eq12(auctionRegistrations.playerProfileId, playerProfiles.id)).where(eq12(auctionRegistrations.auctionId, auction.id)).orderBy(asc8(auctionRegistrations.id));
  const activeRegRow = auction.activePlayerId ? regRows.find((r) => r.reg.id === auction.activePlayerId) ?? null : null;
  const activePlayerClass = activeRegRow?.reg.playerClass ?? "NON_CLUB";
  const hydratedFranchises = franchiseRows.map((f) => {
    const boughtPlayers = regRows.filter(
      (r) => r.reg.sportId === f.sportId && r.reg.status === "SOLD" && r.reg.soldFranchiseId === f.id
    ).map((r) => ({
      id: r.reg.id,
      playerProfileId: r.reg.playerProfileId,
      name: r.profile.displayName,
      batch: r.profile.batch,
      branch: r.profile.branch,
      rollNumber: actor ? r.profile.rollNumber : null,
      positions: r.reg.positionsJson,
      playerClass: r.reg.playerClass,
      soldPrice: r.reg.soldPrice ?? r.reg.basePrice
    }));
    const clubCount = boughtPlayers.filter((p) => p.playerClass === "CLUB").length;
    const nonClubCount = boughtPlayers.filter((p) => p.playerClass === "NON_CLUB").length;
    const sportPrices = getSportEffectiveBasePrices(auction, f.sportId);
    const guard = computeMaxAllowedBid({
      remainingPurse: f.remainingPurse,
      currentSquadCount: boughtPlayers.length,
      currentClubCount: clubCount,
      currentNonClubCount: nonClubCount,
      minSquad: f.minSquad,
      maxSquad: f.maxSquad,
      minClubQuota: f.minClubQuota,
      minNonClubQuota: f.minNonClubQuota,
      clubBasePrice: sportPrices.clubBasePrice,
      nonClubBasePrice: sportPrices.nonClubBasePrice,
      candidateClass: activeRegRow && activeRegRow.reg.sportId === f.sportId ? activePlayerClass : "NON_CLUB"
    });
    const rawCaptain = f.captainUserId ? captainMap[f.captainUserId] ?? null : null;
    const captain = rawCaptain ? actor ? rawCaptain : { id: rawCaptain.id, name: rawCaptain.name, batch: rawCaptain.batch, rollNumber: null } : null;
    return {
      ...f,
      captain,
      boughtPlayers,
      squadCount: boughtPlayers.length,
      clubCount,
      nonClubCount,
      maxAllowedBid: guard.maxAllowedBid,
      requiredReserve: guard.requiredReserve,
      eligibleToBid: guard.eligible,
      guardReason: guard.reason
    };
  });
  const activeBids = activeRegRow ? await db.select().from(auctionBids).where(
    and11(
      eq12(auctionBids.auctionPlayerId, activeRegRow.reg.id),
      eq12(auctionBids.undone, false)
    )
  ).orderBy(desc8(auctionBids.id)) : [];
  const rtmEntries = await db.select().from(rtmEligibility).where(eq12(rtmEligibility.seasonYear, auction.seasonYear));
  const activeCaptainIds = await getActiveCaptainUserIds(auction.id);
  const hydratedRegistrations = regRows.filter(({ profile }) => !profile.userId || !activeCaptainIds.has(profile.userId)).map(({ reg, profile }) => ({
    ...reg,
    displayName: profile.displayName,
    batch: profile.batch,
    branch: profile.branch,
    rollNumber: actor ? profile.rollNumber : null,
    userId: actor ? profile.userId : null,
    photoUrl: reg.photoUrl ?? profile.avatarUrl
  }));
  const myRegistrations = actor?.playerProfileId ? hydratedRegistrations.filter((r) => r.playerProfileId === actor.playerProfileId) : [];
  let myInductedSportIds = [];
  if (actor?.playerProfileId) {
    const mems = await db.select({ clubId: clubMemberships.clubId }).from(clubMemberships).where(
      and11(
        eq12(clubMemberships.playerProfileId, actor.playerProfileId),
        eq12(clubMemberships.status, "INDUCTED")
      )
    );
    const inductedClubSet = new Set(mems.map((m) => m.clubId));
    myInductedSportIds = allSports.filter((s) => clubBySportId[s.id] && inductedClubSet.has(clubBySportId[s.id].id)).map((s) => s.id);
  }
  const myCaptainFranchiseIds = actor ? hydratedFranchises.filter((f) => f.captainUserId === actor.id).map((f) => f.id) : [];
  const myWatchlist = myCaptainFranchiseIds.length > 0 ? await db.select().from(captainWatchlists).where(inArray7(captainWatchlists.franchiseId, myCaptainFranchiseIds)) : [];
  const operatorRows = await db.select({
    roleId: userRoles.id,
    userId: userRoles.userId,
    roleCode: userRoles.roleCode,
    auctionId: userRoles.auctionId,
    name: users.name,
    rollNumber: users.rollNumber,
    batch: users.batch
  }).from(userRoles).innerJoin(users, eq12(userRoles.userId, users.id)).where(
    and11(
      eq12(userRoles.active, true),
      inArray7(userRoles.roleCode, ["AUCTION_OPERATOR", "AUCTIONEER"]),
      or4(isNull3(userRoles.auctionId), eq12(userRoles.auctionId, auction.id))
    )
  ).orderBy(asc8(users.name));
  const isGlobalAdmin = hasGlobalSportsAuthority(actor);
  const rawTeamRegs = actor ? await db.select().from(auctionTeamRegistrations).where(
    isGlobalAdmin ? eq12(auctionTeamRegistrations.auctionId, auction.id) : and11(
      eq12(auctionTeamRegistrations.auctionId, auction.id),
      or4(
        eq12(auctionTeamRegistrations.submittedByUserId, actor.id),
        eq12(auctionTeamRegistrations.captainUserId, actor.id)
      )
    )
  ).orderBy(desc8(auctionTeamRegistrations.createdAt), desc8(auctionTeamRegistrations.id)) : [];
  const regUserIds = Array.from(
    new Set(
      rawTeamRegs.flatMap((r) => [r.submittedByUserId, r.captainUserId]).filter((id) => id !== null)
    )
  );
  const regUserRows = regUserIds.length > 0 ? await db.select({ id: users.id, name: users.name, rollNumber: users.rollNumber, batch: users.batch }).from(users).where(inArray7(users.id, regUserIds)) : [];
  const regUserMap = Object.fromEntries(regUserRows.map((u) => [u.id, u]));
  const sportNameMap = Object.fromEntries(allSports.map((s) => [s.id, s.name]));
  const teamRegistrations = rawTeamRegs.map((r) => ({
    ...r,
    sportName: sportNameMap[r.sportId] ?? "Sport",
    submitterName: regUserMap[r.submittedByUserId]?.name ?? "User",
    captainName: r.captainUserId ? regUserMap[r.captainUserId]?.name ?? null : null
  }));
  return {
    auction,
    effectiveSportId,
    sports: allSports,
    rounds,
    franchises: hydratedFranchises,
    registrations: hydratedRegistrations,
    teamRegistrations,
    operators: actor ? operatorRows : operatorRows.map(({ userId: _uid, rollNumber: _rn, ...pubOp }) => ({
      ...pubOp,
      userId: null,
      rollNumber: null
    })),
    activePlayer: activeRegRow ? hydratedRegistrations.find((r) => r.id === activeRegRow.reg.id) ?? null : null,
    activeBids,
    rtmEntries,
    myRegistrations,
    myWatchlist,
    myInductedSportIds,
    permissions: {
      canManageConfig: hasGlobalSportsAuthority(actor),
      canOperateStage: canOperateAuction(actor, auction.id),
      canRegister: Boolean(actor && actor.accountType === "STUDENT") && !actor.roles.some((r) => NON_STUDENT_ROLES.includes(r.roleCode)) && !activeCaptainIds.has(actor.id),
      isCaptain: myCaptainFranchiseIds.length > 0 || (actor ? activeCaptainIds.has(actor.id) : false),
      isActiveCaptain: actor ? activeCaptainIds.has(actor.id) : false
    }
  };
}
var PUBLIC_AUCTION_SNAPSHOT_TTL_MS = 500;
var publicAuctionSnapshotCache = /* @__PURE__ */ new Map();
function invalidateAuctionSnapshotCache() {
  publicAuctionSnapshotCache.clear();
}
async function broadcastAuctionUpdate(eventType, payload = {}) {
  invalidateAuctionSnapshotCache();
  broadcastSse(eventType, { ts: Date.now(), ...payload });
}
router9.get("/state", async (req, res) => {
  const rawSportId = req.query.sportId ? Number(req.query.sportId) : null;
  const sportId = rawSportId && Number.isFinite(rawSportId) ? rawSportId : null;
  const cacheKey = sportId ?? 0;
  if (!req.actor) {
    const cached = publicAuctionSnapshotCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAtMs) {
      res.json(cached.payload);
      return;
    }
  }
  const snapshot = await buildAuctionSnapshot(req.actor, sportId);
  if (!req.actor) {
    publicAuctionSnapshotCache.set(cacheKey, {
      expiresAtMs: Date.now() + PUBLIC_AUCTION_SNAPSHOT_TTL_MS,
      payload: snapshot
    });
  }
  res.json(snapshot);
});
router9.get("/live-state", async (req, res) => {
  const rawSportId = req.query.sportId ? Number(req.query.sportId) : null;
  const sportId = rawSportId && Number.isFinite(rawSportId) ? rawSportId : null;
  const cacheKey = sportId ?? 0;
  if (!req.actor) {
    const cached = publicAuctionSnapshotCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAtMs) {
      res.json(cached.payload);
      return;
    }
  }
  const snapshot = await buildAuctionSnapshot(req.actor, sportId);
  if (!req.actor) {
    publicAuctionSnapshotCache.set(cacheKey, {
      expiresAtMs: Date.now() + PUBLIC_AUCTION_SNAPSHOT_TTL_MS,
      payload: snapshot
    });
  }
  res.json(snapshot);
});
router9.get("/stream", (req, res) => {
  registerSseStream(req, res, req.actor?.id ?? null);
});
router9.post("/upload-photo", requireAuth, uploadMiddleware.single("file"), async (req, res, next) => {
  if (!req.file || !req.file.buffer) {
    res.status(400).json({ error: "No player portrait file uploaded." });
    return;
  }
  try {
    const saved = await saveValidatedUpload(req.file.buffer, "players");
    res.status(201).json({ photoUrl: saved.url, url: saved.url });
  } catch (err) {
    next(err);
  }
});
router9.post("/registrations", requireAuth, async (req, res) => {
  const studentErr = await assertStudentCandidate(req.actor.id);
  if (studentErr) {
    res.status(403).json({ error: studentErr });
    return;
  }
  const schema = z9.object({
    sportId: z9.number().int().positive(),
    track: z9.enum(["COMBINED", "BOYS", "GIRLS"]).optional(),
    positionsJson: z9.array(z9.string().min(1).max(60)).min(1).max(6),
    experience: z9.string().max(400).optional().nullable(),
    achievements: z9.string().max(400).optional().nullable(),
    photoUrl: z9.string().max(300).refine((v) => v.startsWith("/uploads/players/") || v.startsWith("/uploads/"), {
      message: "Invalid uploaded photo URL."
    }).optional().nullable()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Select a sport and at least 1 playing position." });
    return;
  }
  const auction = await getActiveOrLatestAuction();
  if (!auction) {
    res.status(404).json({ error: "No auction cycle configured." });
    return;
  }
  const activeCaptainIds = await getActiveCaptainUserIds(auction.id);
  if (activeCaptainIds.has(req.actor.id)) {
    res.status(403).json({
      error: "Team captains cannot register as biddable auction players."
    });
    return;
  }
  if (auction.status !== "REGISTRATION_OPEN") {
    res.status(400).json({ error: `Auction registration is closed (status: ${auction.status}).` });
    return;
  }
  if (auction.registrationDeadline && Date.now() > new Date(auction.registrationDeadline).getTime()) {
    res.status(400).json({ error: "Auction registration is closed (deadline has passed)." });
    return;
  }
  const [sport] = await db.select().from(sports).where(eq12(sports.id, parsed.data.sportId)).limit(1);
  if (!sport) {
    res.status(404).json({ error: "Selected sport not found." });
    return;
  }
  const profileId = await ensureStudentPlayerProfileId(db, req.actor.id);
  if (!profileId) {
    res.status(400).json({ error: "Student player profile is required to register." });
    return;
  }
  const [existing] = await db.select().from(auctionRegistrations).where(
    and11(
      eq12(auctionRegistrations.auctionId, auction.id),
      eq12(auctionRegistrations.sportId, sport.id),
      eq12(auctionRegistrations.playerProfileId, profileId)
    )
  ).limit(1);
  if (existing) {
    res.status(409).json({
      error: `You have already registered for ${sport.name} in ${auction.name}.`
    });
    return;
  }
  const [club] = await db.select().from(sportsClubs).where(eq12(sportsClubs.sportId, sport.id)).limit(1);
  let isInductedClubMember = false;
  if (club) {
    const [mem] = await db.select({ id: clubMemberships.id }).from(clubMemberships).where(
      and11(
        eq12(clubMemberships.clubId, club.id),
        eq12(clubMemberships.playerProfileId, profileId),
        eq12(clubMemberships.status, "INDUCTED")
      )
    ).limit(1);
    isInductedClubMember = Boolean(mem);
  }
  const playerClass = isInductedClubMember ? "CLUB" : "NON_CLUB";
  const sportPrices = getSportEffectiveBasePrices(auction, sport.id);
  const basePrice = playerClass === "CLUB" ? sportPrices.clubBasePrice : sportPrices.nonClubBasePrice;
  const [defaultRound] = await db.select().from(auctionRounds).where(eq12(auctionRounds.auctionId, auction.id)).orderBy(asc8(auctionRounds.roundOrder), asc8(auctionRounds.id)).limit(1);
  const uniquePositions = Array.from(
    new Set(parsed.data.positionsJson.map((p) => p.trim()).filter(Boolean))
  );
  const effectiveTrack = auction.splitMode === "SEPARATE_BOYS_GIRLS" ? parsed.data.track === "GIRLS" ? "GIRLS" : parsed.data.track === "BOYS" ? "BOYS" : req.actor.gender === "GIRLS" ? "GIRLS" : "BOYS" : "COMBINED";
  const [created] = await db.insert(auctionRegistrations).values({
    auctionId: auction.id,
    sportId: sport.id,
    roundId: auction.activeRoundId ?? defaultRound?.id ?? null,
    track: effectiveTrack,
    playerProfileId: profileId,
    positionsJson: uniquePositions,
    playerClass,
    tier: "STANDARD",
    basePrice,
    experience: parsed.data.experience?.trim() || null,
    achievements: parsed.data.achievements?.trim() || null,
    photoUrl: parsed.data.photoUrl ?? null,
    status: "ELIGIBLE"
  }).returning();
  await broadcastAuctionUpdate("AUCTION_UPDATED", { sportId: sport.id });
  res.status(201).json({ registration: created });
});
router9.post("/watchlist", requireAuth, async (req, res) => {
  const schema = z9.object({
    franchiseId: z9.number().int().positive(),
    auctionPlayerId: z9.number().int().positive(),
    priorityNote: z9.string().max(200).optional().nullable(),
    maxTargetBid: z9.number().int().nonnegative().optional().nullable()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid watchlist payload." });
    return;
  }
  const [franchise] = await db.select().from(auctionFranchises).where(eq12(auctionFranchises.id, parsed.data.franchiseId)).limit(1);
  if (!franchise) {
    res.status(404).json({ error: "Franchise not found." });
    return;
  }
  if (franchise.captainUserId !== req.actor.id && !hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only the franchise captain can manage this watchlist." });
    return;
  }
  const [entry] = await db.insert(captainWatchlists).values({
    franchiseId: franchise.id,
    auctionPlayerId: parsed.data.auctionPlayerId,
    priorityNote: parsed.data.priorityNote?.trim() || null,
    maxTargetBid: parsed.data.maxTargetBid ?? null
  }).onConflictDoUpdate({
    target: [captainWatchlists.franchiseId, captainWatchlists.auctionPlayerId],
    set: {
      priorityNote: parsed.data.priorityNote?.trim() || null,
      maxTargetBid: parsed.data.maxTargetBid ?? null
    }
  }).returning();
  res.status(201).json({ watchlistEntry: entry });
});
router9.delete("/watchlist/:id", requireAuth, async (req, res) => {
  const id = parsePositiveIntId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid watchlist ID." });
    return;
  }
  const [entry] = await db.select().from(captainWatchlists).where(eq12(captainWatchlists.id, id)).limit(1);
  if (!entry) {
    res.status(404).json({ error: "Watchlist entry not found." });
    return;
  }
  const [franchise] = await db.select().from(auctionFranchises).where(eq12(auctionFranchises.id, entry.franchiseId)).limit(1);
  if (!franchise || franchise.captainUserId !== req.actor.id && !hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Unauthorized to delete watchlist entry." });
    return;
  }
  await db.delete(captainWatchlists).where(eq12(captainWatchlists.id, id));
  res.json({ ok: true });
});
router9.patch("/config", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can configure the auction." });
    return;
  }
  const schema = z9.object({
    expectedVersion: z9.number().int().positive().optional(),
    name: z9.string().min(2).max(160).optional(),
    status: z9.enum(["DRAFT", "REGISTRATION_OPEN", "FROZEN", "LIVE", "COMPLETED", "PUBLISHED"]).optional(),
    registrationDeadline: z9.string().datetime().nullable().optional(),
    clubBasePrice: z9.number().int().nonnegative().optional(),
    nonClubBasePrice: z9.number().int().nonnegative().optional(),
    sportBasePricesJson: z9.record(
      z9.string(),
      z9.object({
        clubBasePrice: z9.number().int().nonnegative(),
        nonClubBasePrice: z9.number().int().nonnegative()
      })
    ).optional(),
    defaultIncrement: z9.number().int().positive().optional(),
    jumpIncrement: z9.number().int().positive().optional(),
    bidSlabsJson: z9.array(
      z9.object({
        upTo: z9.number().int().positive().nullable(),
        increment: z9.number().int().positive()
      })
    ).optional(),
    rtmEnabled: z9.boolean().optional(),
    splitMode: z9.enum(["COMBINED", "SEPARATE_BOYS_GIRLS"]).optional(),
    activeTrack: z9.enum(["COMBINED", "BOYS", "GIRLS"]).optional(),
    showAuctionInNav: z9.boolean().optional(),
    showLiveAuctionInNav: z9.boolean().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid auction configuration payload." });
    return;
  }
  const auction = await getActiveOrLatestAuction();
  if (!auction) {
    res.status(404).json({ error: "No auction record found." });
    return;
  }
  if (checkVersionConflict(res, auction, parsed.data.expectedVersion)) return;
  const outcome = await db.transaction(async (tx) => {
    const [lockedAuction] = await tx.select().from(auctions).where(eq12(auctions.id, auction.id)).for("update").limit(1);
    if (!lockedAuction) {
      return { ok: false, status: 404, error: "No auction record found." };
    }
    if (parsed.data.expectedVersion !== void 0 && lockedAuction.version !== parsed.data.expectedVersion) {
      return {
        ok: false,
        status: 409,
        error: "Auction stage updated concurrently (stale version). Refreshing state."
      };
    }
    const [row] = await tx.update(auctions).set({
      ...parsed.data.name ? { name: parsed.data.name.trim() } : {},
      ...parsed.data.status ? { status: parsed.data.status } : {},
      ...parsed.data.registrationDeadline !== void 0 ? {
        registrationDeadline: parsed.data.registrationDeadline ? new Date(parsed.data.registrationDeadline) : null
      } : {},
      ...parsed.data.clubBasePrice !== void 0 ? { clubBasePrice: parsed.data.clubBasePrice } : {},
      ...parsed.data.nonClubBasePrice !== void 0 ? { nonClubBasePrice: parsed.data.nonClubBasePrice } : {},
      ...parsed.data.sportBasePricesJson !== void 0 ? { sportBasePricesJson: parsed.data.sportBasePricesJson } : {},
      ...parsed.data.defaultIncrement !== void 0 ? { defaultIncrement: parsed.data.defaultIncrement } : {},
      ...parsed.data.jumpIncrement !== void 0 ? { jumpIncrement: parsed.data.jumpIncrement } : {},
      ...parsed.data.bidSlabsJson !== void 0 ? { bidSlabsJson: parsed.data.bidSlabsJson } : {},
      ...parsed.data.rtmEnabled !== void 0 ? { rtmEnabled: parsed.data.rtmEnabled } : {},
      ...parsed.data.splitMode !== void 0 ? { splitMode: parsed.data.splitMode } : {},
      ...parsed.data.activeTrack !== void 0 ? { activeTrack: parsed.data.activeTrack } : parsed.data.splitMode === "SEPARATE_BOYS_GIRLS" && lockedAuction.activeTrack === "COMBINED" ? { activeTrack: "BOYS" } : parsed.data.splitMode === "COMBINED" ? { activeTrack: "COMBINED" } : {},
      version: lockedAuction.version + 1
    }).where(and11(eq12(auctions.id, lockedAuction.id), eq12(auctions.version, lockedAuction.version))).returning();
    if (!row) {
      return {
        ok: false,
        status: 409,
        error: "Auction stage updated concurrently (stale version). Refreshing state."
      };
    }
    if (parsed.data.showAuctionInNav !== void 0) {
      await tx.insert(siteSettings).values({ key: "showAuctionInNav", valueJson: parsed.data.showAuctionInNav, updatedBy: req.actor.id }).onConflictDoUpdate({
        target: siteSettings.key,
        set: { valueJson: parsed.data.showAuctionInNav, updatedBy: req.actor.id, updatedAt: /* @__PURE__ */ new Date() }
      });
    }
    if (parsed.data.showLiveAuctionInNav !== void 0) {
      await tx.insert(siteSettings).values({ key: "showLiveAuctionInNav", valueJson: parsed.data.showLiveAuctionInNav, updatedBy: req.actor.id }).onConflictDoUpdate({
        target: siteSettings.key,
        set: { valueJson: parsed.data.showLiveAuctionInNav, updatedBy: req.actor.id, updatedAt: /* @__PURE__ */ new Date() }
      });
    }
    await recordAuditLog(tx, req.actor.id, "UPDATE_AUCTION_CONFIG", "auctions", lockedAuction.id, {
      status: parsed.data.status
    });
    return { ok: true, row };
  });
  if (!outcome.ok) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }
  const updated = outcome.row;
  if (parsed.data.showAuctionInNav !== void 0 || parsed.data.showLiveAuctionInNav !== void 0) {
    broadcastSse("NAV_UPDATED", {
      showAuctionInNav: parsed.data.showAuctionInNav,
      showLiveAuctionInNav: parsed.data.showLiveAuctionInNav
    });
  }
  await broadcastAuctionUpdate("AUCTION_UPDATED");
  res.json({ auction: updated });
});
router9.post("/rounds", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can manage auction rounds." });
    return;
  }
  const schema = z9.object({
    name: z9.string().min(2).max(120),
    sportId: z9.number().int().positive().nullable().optional(),
    roundOrder: z9.number().int().positive().default(1),
    roundType: z9.enum(["MAIN", "ACCELERATED", "UNSOLD", "RTM"]).default("MAIN"),
    active: z9.boolean().default(false)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid round payload." });
    return;
  }
  const auction = await getActiveOrLatestAuction();
  if (!auction) {
    res.status(404).json({ error: "Auction not found." });
    return;
  }
  const created = await db.transaction(async (tx) => {
    if (parsed.data.active) {
      await tx.update(auctionRounds).set({ active: false }).where(eq12(auctionRounds.auctionId, auction.id));
    }
    const [row] = await tx.insert(auctionRounds).values({
      auctionId: auction.id,
      sportId: parsed.data.sportId ?? null,
      name: parsed.data.name.trim(),
      roundOrder: parsed.data.roundOrder,
      roundType: parsed.data.roundType,
      active: parsed.data.active
    }).returning();
    if (parsed.data.active) {
      await tx.update(auctions).set({ activeRoundId: row.id, version: auction.version + 1 }).where(eq12(auctions.id, auction.id));
    }
    return row;
  });
  await broadcastAuctionUpdate("AUCTION_UPDATED");
  res.status(201).json({ round: created });
});
router9.patch("/rounds/:id", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can manage auction rounds." });
    return;
  }
  const roundId = parsePositiveIntId(req.params.id);
  if (!roundId) {
    res.status(400).json({ error: "Invalid round ID." });
    return;
  }
  const schema = z9.object({
    name: z9.string().min(2).max(120).optional(),
    roundOrder: z9.number().int().positive().optional(),
    roundType: z9.enum(["MAIN", "ACCELERATED", "UNSOLD", "RTM"]).optional(),
    active: z9.boolean().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid round update payload." });
    return;
  }
  const [existing] = await db.select().from(auctionRounds).where(eq12(auctionRounds.id, roundId)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Round not found." });
    return;
  }
  const updated = await db.transaction(async (tx) => {
    if (parsed.data.active) {
      await tx.update(auctionRounds).set({ active: false }).where(eq12(auctionRounds.auctionId, existing.auctionId));
    }
    const [row] = await tx.update(auctionRounds).set({
      ...parsed.data.name ? { name: parsed.data.name.trim() } : {},
      ...parsed.data.roundOrder !== void 0 ? { roundOrder: parsed.data.roundOrder } : {},
      ...parsed.data.roundType ? { roundType: parsed.data.roundType } : {},
      ...parsed.data.active !== void 0 ? { active: parsed.data.active } : {}
    }).where(eq12(auctionRounds.id, roundId)).returning();
    if (parsed.data.active) {
      const [auc] = await tx.select().from(auctions).where(eq12(auctions.id, existing.auctionId)).limit(1);
      if (auc) {
        await tx.update(auctions).set({ activeRoundId: row.id, version: auc.version + 1 }).where(eq12(auctions.id, auc.id));
      }
    }
    return row;
  });
  await broadcastAuctionUpdate("AUCTION_UPDATED");
  res.json({ round: updated });
});
router9.delete("/rounds/:id", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can delete rounds." });
    return;
  }
  const roundId = parsePositiveIntId(req.params.id);
  if (!roundId) {
    res.status(400).json({ error: "Invalid round ID." });
    return;
  }
  await db.delete(auctionRounds).where(eq12(auctionRounds.id, roundId));
  await broadcastAuctionUpdate("AUCTION_UPDATED");
  res.json({ ok: true });
});
router9.post("/franchises", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can create franchises." });
    return;
  }
  const schema = z9.object({
    sportId: z9.number().int().positive(),
    track: z9.enum(["COMBINED", "BOYS", "GIRLS"]).optional(),
    name: z9.string().min(2).max(100),
    shortCode: z9.string().min(2).max(6).transform((s) => s.toUpperCase()),
    accentColor: z9.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#D97706"),
    captainUserId: z9.number().int().positive().nullable().optional(),
    startingPurse: z9.number().int().positive().default(2e4),
    minSquad: z9.number().int().positive().default(11),
    maxSquad: z9.number().int().positive().default(15),
    minClubQuota: z9.number().int().nonnegative().default(3),
    minNonClubQuota: z9.number().int().nonnegative().default(4)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid franchise payload." });
    return;
  }
  if (parsed.data.captainUserId) {
    const err = await assertStudentCandidate(parsed.data.captainUserId);
    if (err) {
      res.status(400).json({ error: err });
      return;
    }
  }
  const auction = await getActiveOrLatestAuction();
  if (!auction) {
    res.status(404).json({ error: "Auction not found." });
    return;
  }
  const existingForSport = await db.select().from(auctionFranchises).where(and11(eq12(auctionFranchises.auctionId, auction.id), eq12(auctionFranchises.sportId, parsed.data.sportId)));
  const nextSlot = existingForSport.reduce((max, f) => Math.max(max, f.slotNumber), 0) + 1;
  const effectiveFranchiseTrack = auction.splitMode === "SEPARATE_BOYS_GIRLS" ? parsed.data.track === "GIRLS" ? "GIRLS" : "BOYS" : "COMBINED";
  const [created] = await db.insert(auctionFranchises).values({
    auctionId: auction.id,
    sportId: parsed.data.sportId,
    slotNumber: nextSlot,
    track: effectiveFranchiseTrack,
    name: parsed.data.name.trim(),
    shortCode: parsed.data.shortCode.trim().toUpperCase(),
    accentColor: parsed.data.accentColor,
    captainUserId: parsed.data.captainUserId ?? null,
    startingPurse: parsed.data.startingPurse,
    remainingPurse: parsed.data.startingPurse,
    minSquad: parsed.data.minSquad,
    maxSquad: Math.max(parsed.data.minSquad, parsed.data.maxSquad),
    minClubQuota: parsed.data.minClubQuota,
    minNonClubQuota: parsed.data.minNonClubQuota
  }).returning();
  await broadcastAuctionUpdate("AUCTION_UPDATED", { sportId: parsed.data.sportId });
  res.status(201).json({ franchise: created });
});
router9.patch("/franchises/:id", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can update franchises." });
    return;
  }
  const franchiseId = parsePositiveIntId(req.params.id);
  if (!franchiseId) {
    res.status(400).json({ error: "Invalid franchise ID." });
    return;
  }
  const schema = z9.object({
    name: z9.string().min(2).max(100).optional(),
    shortCode: z9.string().min(2).max(6).transform((s) => s.toUpperCase()).optional(),
    accentColor: z9.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    captainUserId: z9.number().int().positive().nullable().optional(),
    sportId: z9.number().int().positive().optional(),
    startingPurse: z9.number().int().positive().optional(),
    remainingPurse: z9.number().int().nonnegative().optional(),
    minSquad: z9.number().int().positive().optional(),
    maxSquad: z9.number().int().positive().optional(),
    minClubQuota: z9.number().int().nonnegative().optional(),
    minNonClubQuota: z9.number().int().nonnegative().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid franchise update payload." });
    return;
  }
  const [existing] = await db.select().from(auctionFranchises).where(eq12(auctionFranchises.id, franchiseId)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Franchise not found." });
    return;
  }
  if (parsed.data.captainUserId) {
    const err = await assertStudentCandidate(parsed.data.captainUserId);
    if (err) {
      res.status(400).json({ error: err });
      return;
    }
  }
  const spentAmount = Math.max(0, existing.startingPurse - existing.remainingPurse);
  let nextStartingPurse = existing.startingPurse;
  let nextRemainingPurse = existing.remainingPurse;
  if (parsed.data.startingPurse !== void 0) {
    if (parsed.data.startingPurse < spentAmount) {
      res.status(400).json({
        error: `Starting purse cannot be lower than already spent amount (\u20B9${spentAmount}).`
      });
      return;
    }
    nextStartingPurse = parsed.data.startingPurse;
    nextRemainingPurse = parsed.data.remainingPurse ?? parsed.data.startingPurse - spentAmount;
  } else if (parsed.data.remainingPurse !== void 0) {
    nextRemainingPurse = parsed.data.remainingPurse;
  }
  const [updated] = await db.update(auctionFranchises).set({
    ...parsed.data.name ? { name: parsed.data.name.trim() } : {},
    ...parsed.data.shortCode ? { shortCode: parsed.data.shortCode.trim().toUpperCase() } : {},
    ...parsed.data.accentColor ? { accentColor: parsed.data.accentColor } : {},
    ...parsed.data.captainUserId !== void 0 ? { captainUserId: parsed.data.captainUserId } : {},
    ...parsed.data.sportId ? { sportId: parsed.data.sportId } : {},
    startingPurse: nextStartingPurse,
    remainingPurse: nextRemainingPurse,
    ...parsed.data.minSquad !== void 0 ? { minSquad: parsed.data.minSquad } : {},
    ...parsed.data.maxSquad !== void 0 ? { maxSquad: parsed.data.maxSquad } : {},
    ...parsed.data.minClubQuota !== void 0 ? { minClubQuota: parsed.data.minClubQuota } : {},
    ...parsed.data.minNonClubQuota !== void 0 ? { minNonClubQuota: parsed.data.minNonClubQuota } : {}
  }).where(eq12(auctionFranchises.id, franchiseId)).returning();
  await broadcastAuctionUpdate("AUCTION_UPDATED", { sportId: updated.sportId });
  res.json({ franchise: updated });
});
router9.delete("/franchises/:id", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can delete franchises." });
    return;
  }
  const franchiseId = parsePositiveIntId(req.params.id);
  if (!franchiseId) {
    res.status(400).json({ error: "Invalid franchise ID." });
    return;
  }
  const [sold] = await db.select({ id: auctionRegistrations.id }).from(auctionRegistrations).where(
    and11(
      eq12(auctionRegistrations.soldFranchiseId, franchiseId),
      eq12(auctionRegistrations.status, "SOLD")
    )
  ).limit(1);
  if (sold) {
    res.status(409).json({ error: "Cannot delete a franchise that already has SOLD players." });
    return;
  }
  await db.delete(auctionFranchises).where(eq12(auctionFranchises.id, franchiseId));
  await broadcastAuctionUpdate("AUCTION_UPDATED");
  res.json({ ok: true });
});
router9.patch("/registrations/:id", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can edit auction registrations." });
    return;
  }
  const regId = parsePositiveIntId(req.params.id);
  if (!regId) {
    res.status(400).json({ error: "Invalid registration ID." });
    return;
  }
  const schema = z9.object({
    positionsJson: z9.array(z9.string().min(1).max(60)).min(1).max(6).optional(),
    playerClass: z9.enum(["CLUB", "NON_CLUB"]).optional(),
    basePrice: z9.number().int().nonnegative().optional(),
    tier: z9.enum(["MARQUEE", "TIER_1", "STANDARD"]).optional(),
    roundId: z9.number().int().positive().nullable().optional(),
    status: z9.enum(["REGISTERED", "ELIGIBLE", "IN_AUCTION", "SOLD", "UNSOLD", "INELIGIBLE"]).optional(),
    experience: z9.string().max(400).nullable().optional(),
    achievements: z9.string().max(400).nullable().optional(),
    photoUrl: z9.string().max(300).nullable().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid registration update payload." });
    return;
  }
  if (parsed.data.photoUrl !== void 0 && parsed.data.photoUrl !== null && parsed.data.photoUrl !== "" && !parsed.data.photoUrl.startsWith("/uploads/") && !parsed.data.photoUrl.startsWith("/assets/")) {
    res.status(400).json({ error: "photoUrl must be a validated /uploads/ or /assets/ path." });
    return;
  }
  const [existing] = await db.select().from(auctionRegistrations).where(eq12(auctionRegistrations.id, regId)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Auction registration not found." });
    return;
  }
  if (parsed.data.status && parsed.data.status !== existing.status && (parsed.data.status === "SOLD" || existing.status === "SOLD")) {
    res.status(400).json({ error: "Use live auction outcome or undo endpoints to change SOLD status." });
    return;
  }
  const [updated] = await db.update(auctionRegistrations).set({
    ...parsed.data.positionsJson ? { positionsJson: parsed.data.positionsJson } : {},
    ...parsed.data.playerClass ? { playerClass: parsed.data.playerClass } : {},
    ...parsed.data.basePrice !== void 0 ? { basePrice: parsed.data.basePrice } : {},
    ...parsed.data.tier ? { tier: parsed.data.tier } : {},
    ...parsed.data.roundId !== void 0 ? { roundId: parsed.data.roundId } : {},
    ...parsed.data.status ? { status: parsed.data.status } : {},
    ...parsed.data.experience !== void 0 ? { experience: parsed.data.experience } : {},
    ...parsed.data.achievements !== void 0 ? { achievements: parsed.data.achievements } : {},
    ...parsed.data.photoUrl !== void 0 ? { photoUrl: parsed.data.photoUrl } : {}
  }).where(eq12(auctionRegistrations.id, regId)).returning();
  await broadcastAuctionUpdate("AUCTION_UPDATED", { sportId: updated.sportId });
  res.json({ registration: updated });
});
router9.post("/operators", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({
      error: "Only the Sports Secretary or Faculty Advisor can assign Auction Operators."
    });
    return;
  }
  const schema = z9.object({ userId: z9.number().int().positive() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Select a valid student user." });
    return;
  }
  const candidateErr = await assertStudentCandidate(parsed.data.userId);
  if (candidateErr) {
    res.status(400).json({ error: candidateErr });
    return;
  }
  const auction = await getActiveOrLatestAuction();
  if (!auction) {
    res.status(404).json({ error: "Auction not found." });
    return;
  }
  const [existing] = await db.select().from(userRoles).where(
    and11(
      eq12(userRoles.userId, parsed.data.userId),
      inArray7(userRoles.roleCode, ["AUCTION_OPERATOR", "AUCTIONEER"]),
      eq12(userRoles.active, true),
      or4(isNull3(userRoles.auctionId), eq12(userRoles.auctionId, auction.id))
    )
  ).limit(1);
  if (existing) {
    res.status(409).json({ error: "Selected student is already an active Auction Operator." });
    return;
  }
  const [created] = await db.transaction(async (tx) => {
    const [row] = await tx.insert(userRoles).values({
      userId: parsed.data.userId,
      roleCode: "AUCTION_OPERATOR",
      auctionId: auction.id,
      grantedBy: req.actor.id
    }).returning();
    await tx.insert(notifications).values({
      userId: parsed.data.userId,
      title: `Auction Operator Assigned: ${auction.name}`,
      message: "You have been granted live stage operator controls on /live-auction.",
      linkUrl: "/live-auction"
    });
    await recordAuditLog(tx, req.actor.id, "ASSIGN_AUCTION_OPERATOR", "user_roles", row.id, {
      auctionId: auction.id,
      targetUserId: parsed.data.userId
    });
    return [row];
  });
  broadcastSse("NOTIFICATION", { auctionId: auction.id }, [parsed.data.userId]);
  await broadcastAuctionUpdate("AUCTION_UPDATED", { operatorUserId: parsed.data.userId });
  res.status(201).json({ operator: created });
});
router9.delete("/operators/:userId", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({
      error: "Only the Sports Secretary or Faculty Advisor can revoke Auction Operators."
    });
    return;
  }
  const targetUserId = Number(req.params.userId);
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    res.status(400).json({ error: "Invalid user ID." });
    return;
  }
  const auction = await getActiveOrLatestAuction();
  if (!auction) {
    res.status(404).json({ error: "Auction not found." });
    return;
  }
  const deactivated = await db.transaction(async (tx) => {
    const updatedRows = await tx.update(userRoles).set({ active: false }).where(
      and11(
        eq12(userRoles.userId, targetUserId),
        inArray7(userRoles.roleCode, ["AUCTION_OPERATOR", "AUCTIONEER"]),
        eq12(userRoles.active, true),
        or4(isNull3(userRoles.auctionId), eq12(userRoles.auctionId, auction.id))
      )
    ).returning();
    if (updatedRows.length > 0) {
      await tx.insert(notifications).values({
        userId: targetUserId,
        title: `Auction Operator Revoked: ${auction.name}`,
        message: "Your live stage auction operator access has been revoked.",
        linkUrl: "/auction"
      });
      await recordAuditLog(tx, req.actor.id, "REVOKE_AUCTION_OPERATOR", "users", targetUserId, {
        auctionId: auction.id
      });
    }
    return updatedRows;
  });
  if (deactivated.length === 0) {
    res.status(404).json({ error: "No active Auction Operator assignment found for this user." });
    return;
  }
  broadcastSse("NOTIFICATION", { auctionId: auction.id }, [targetUserId]);
  await broadcastAuctionUpdate("AUCTION_UPDATED", { revokedUserId: targetUserId });
  res.json({ ok: true });
});
router9.post("/context", requireAuth, async (req, res) => {
  const auction = await getActiveOrLatestAuction();
  if (!auction) {
    res.status(404).json({ error: "Auction not found." });
    return;
  }
  if (!canOperateAuction(req.actor, auction.id)) {
    res.status(403).json({ error: "Only the Auction Operator or Sports Secretary can switch stage context." });
    return;
  }
  const schema = z9.object({
    sportId: z9.number().int().positive().optional(),
    roundId: z9.number().int().positive().nullable().optional(),
    track: z9.enum(["COMBINED", "BOYS", "GIRLS"]).optional(),
    expectedVersion: z9.number().int().positive().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid context payload." });
    return;
  }
  if (checkVersionConflict(res, auction, parsed.data.expectedVersion)) return;
  const outcome = await db.transaction(async (tx) => {
    const [lockedAuction] = await tx.select().from(auctions).where(eq12(auctions.id, auction.id)).for("update").limit(1);
    if (!lockedAuction) {
      return { ok: false, status: 404, error: "Auction not found." };
    }
    if (parsed.data.expectedVersion !== void 0 && lockedAuction.version !== parsed.data.expectedVersion) {
      return {
        ok: false,
        status: 409,
        error: "Auction stage updated concurrently (stale version). Refreshing state."
      };
    }
    const switchingSport = parsed.data.sportId && parsed.data.sportId !== lockedAuction.activeSportId;
    if (switchingSport && lockedAuction.activePlayerId) {
      await tx.update(auctionRegistrations).set({ status: "ELIGIBLE" }).where(
        and11(
          eq12(auctionRegistrations.id, lockedAuction.activePlayerId),
          eq12(auctionRegistrations.status, "IN_AUCTION")
        )
      );
    }
    if (parsed.data.roundId) {
      await tx.update(auctionRounds).set({ active: false }).where(eq12(auctionRounds.auctionId, lockedAuction.id));
      await tx.update(auctionRounds).set({ active: true }).where(eq12(auctionRounds.id, parsed.data.roundId));
    }
    const [updatedAuc] = await tx.update(auctions).set({
      ...parsed.data.sportId ? { activeSportId: parsed.data.sportId } : {},
      ...parsed.data.roundId !== void 0 ? { activeRoundId: parsed.data.roundId } : {},
      ...parsed.data.track ? { activeTrack: parsed.data.track } : {},
      ...switchingSport ? { activePlayerId: null, projectorMode: "STAGE" } : {},
      version: lockedAuction.version + 1
    }).where(and11(eq12(auctions.id, lockedAuction.id), eq12(auctions.version, lockedAuction.version))).returning();
    if (!updatedAuc) {
      return {
        ok: false,
        status: 409,
        error: "Auction stage updated concurrently (stale version). Refreshing state."
      };
    }
    return { ok: true };
  });
  if (!outcome.ok) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }
  await broadcastAuctionUpdate("AUCTION_STAGE", { sportId: parsed.data.sportId ?? auction.activeSportId });
  res.json({ ok: true });
});
router9.post("/next-player", requireAuth, async (req, res) => {
  const auction = await getActiveOrLatestAuction();
  if (!auction) {
    res.status(404).json({ error: "Auction not found." });
    return;
  }
  if (!canOperateAuction(req.actor, auction.id)) {
    res.status(403).json({ error: "Only the Auction Operator or Sports Secretary can stage players." });
    return;
  }
  const schema = z9.object({
    auctionPlayerId: z9.number().int().positive().optional(),
    sportId: z9.number().int().positive().optional(),
    expectedVersion: z9.number().int().positive().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid next-player payload." });
    return;
  }
  if (checkVersionConflict(res, auction, parsed.data.expectedVersion)) return;
  const targetSportId = parsed.data.sportId ?? auction.activeSportId;
  if (!targetSportId) {
    res.status(400).json({ error: "Select an active sport first." });
    return;
  }
  const [activeRound] = auction.activeRoundId ? await db.select().from(auctionRounds).where(eq12(auctionRounds.id, auction.activeRoundId)).limit(1) : [];
  const activeCaptainIds = await getActiveCaptainUserIds(auction.id);
  let captainProfileIds = /* @__PURE__ */ new Set();
  if (activeCaptainIds.size > 0) {
    const capProfs = await db.select({ id: playerProfiles.id }).from(playerProfiles).where(inArray7(playerProfiles.userId, Array.from(activeCaptainIds)));
    captainProfileIds = new Set(capProfs.map((p) => p.id));
  }
  const targetTrack = auction.splitMode === "SEPARATE_BOYS_GIRLS" ? auction.activeTrack === "GIRLS" ? "GIRLS" : "BOYS" : null;
  let nextReg;
  if (parsed.data.auctionPlayerId) {
    [nextReg] = await db.select().from(auctionRegistrations).where(
      and11(
        eq12(auctionRegistrations.id, parsed.data.auctionPlayerId),
        eq12(auctionRegistrations.auctionId, auction.id),
        eq12(auctionRegistrations.sportId, targetSportId)
      )
    ).limit(1);
    if (!nextReg || nextReg.status === "SOLD" || nextReg.status === "INELIGIBLE") {
      res.status(400).json({ error: "Selected player cannot be staged (already SOLD or INELIGIBLE)." });
      return;
    }
    if (targetTrack && nextReg.track !== targetTrack) {
      res.status(400).json({ error: `Selected player is in ${nextReg.track} track (active track: ${targetTrack}).` });
      return;
    }
    if (captainProfileIds.has(nextReg.playerProfileId)) {
      res.status(400).json({ error: "Active team captains cannot be staged onto the auction block." });
      return;
    }
  } else {
    const eligibleStatuses = activeRound?.roundType === "UNSOLD" || activeRound?.roundType === "ACCELERATED" ? ["UNSOLD", "ELIGIBLE", "REGISTERED"] : ["ELIGIBLE", "REGISTERED"];
    const pool2 = (await db.select().from(auctionRegistrations).where(
      and11(
        eq12(auctionRegistrations.auctionId, auction.id),
        eq12(auctionRegistrations.sportId, targetSportId),
        inArray7(auctionRegistrations.status, eligibleStatuses),
        ...targetTrack ? [eq12(auctionRegistrations.track, targetTrack)] : []
      )
    ).orderBy(asc8(auctionRegistrations.id))).filter((p) => !captainProfileIds.has(p.playerProfileId));
    const roundMatched = activeRound && pool2.some((p) => p.roundId === activeRound.id) ? pool2.filter((p) => p.roundId === activeRound.id) : pool2;
    const tierOrder = { MARQUEE: 0, TIER_1: 1, STANDARD: 2 };
    roundMatched.sort((a, b) => (tierOrder[a.tier] ?? 9) - (tierOrder[b.tier] ?? 9) || a.id - b.id);
    nextReg = roundMatched[0];
  }
  if (!nextReg) {
    res.status(404).json({ error: "No eligible players remaining in this sport pool." });
    return;
  }
  const stageOutcome = await db.transaction(async (tx) => {
    const [lockedAuction] = await tx.select().from(auctions).where(eq12(auctions.id, auction.id)).for("update").limit(1);
    if (!lockedAuction) {
      return { ok: false, status: 404, error: "Auction not found." };
    }
    if (parsed.data.expectedVersion !== void 0 && lockedAuction.version !== parsed.data.expectedVersion) {
      return {
        ok: false,
        status: 409,
        error: "Auction stage updated concurrently (stale version). Refreshing state."
      };
    }
    if (lockedAuction.activePlayerId && lockedAuction.activePlayerId !== nextReg.id) {
      await tx.update(auctionRegistrations).set({ status: "ELIGIBLE" }).where(
        and11(
          eq12(auctionRegistrations.id, lockedAuction.activePlayerId),
          eq12(auctionRegistrations.status, "IN_AUCTION")
        )
      );
    }
    await tx.update(auctionRegistrations).set({ status: "IN_AUCTION" }).where(eq12(auctionRegistrations.id, nextReg.id));
    const [updatedAuc] = await tx.update(auctions).set({
      activeSportId: targetSportId,
      activePlayerId: nextReg.id,
      projectorMode: "STAGE",
      projectorPaused: false,
      version: lockedAuction.version + 1
    }).where(and11(eq12(auctions.id, lockedAuction.id), eq12(auctions.version, lockedAuction.version))).returning();
    if (!updatedAuc) {
      return {
        ok: false,
        status: 409,
        error: "Auction stage updated concurrently (stale version). Refreshing state."
      };
    }
    return { ok: true };
  });
  if (!stageOutcome.ok) {
    res.status(stageOutcome.status).json({ error: stageOutcome.error });
    return;
  }
  await broadcastAuctionUpdate("AUCTION_STAGE", {
    sportId: targetSportId,
    activePlayerId: nextReg.id
  });
  res.json({ activePlayer: nextReg });
});
router9.post("/bid", requireAuth, async (req, res) => {
  const auction = await getActiveOrLatestAuction();
  if (!auction) {
    res.status(404).json({ error: "Auction not found." });
    return;
  }
  if (!canOperateAuction(req.actor, auction.id)) {
    res.status(403).json({ error: "Only the Auction Operator or Sports Secretary can place live stage bids." });
    return;
  }
  if (auction.status !== "LIVE") {
    res.status(400).json({ error: "Auction status must be LIVE to record stage bids." });
    return;
  }
  if (!auction.activePlayerId || !auction.activeSportId) {
    res.status(400).json({ error: "No player currently on the live stage." });
    return;
  }
  const schema = z9.object({
    franchiseId: z9.number().int().positive(),
    bidType: z9.enum(["INCREMENT", "JUMP", "CUSTOM"]).default("INCREMENT"),
    amount: z9.number().int().positive().optional(),
    expectedVersion: z9.number().int().positive().optional(),
    idempotencyKey: z9.string().min(4).max(120).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid bid payload." });
    return;
  }
  if (checkVersionConflict(res, auction, parsed.data.expectedVersion)) return;
  const idemKey = extractIdempotencyKey(req);
  const outcome = await db.transaction(async (tx) => {
    if (idemKey) {
      const prior = await findIdempotencyRecord(tx, "AUCTION_BID", idemKey);
      if (prior) {
        return {
          ok: true,
          replayed: true,
          statusCode: prior.statusCode,
          responseJson: prior.responseJson
        };
      }
      const [existingBid] = await tx.select().from(auctionBids).where(eq12(auctionBids.idempotencyKey, idemKey)).limit(1);
      if (existingBid) {
        return {
          ok: true,
          replayed: true,
          statusCode: 201,
          responseJson: { bid: existingBid }
        };
      }
    }
    const [lockedAuction] = await tx.select().from(auctions).where(eq12(auctions.id, auction.id)).for("update").limit(1);
    if (!lockedAuction || lockedAuction.status !== "LIVE") {
      return { ok: false, status: 400, error: "Auction status must be LIVE to record stage bids." };
    }
    if (parsed.data.expectedVersion !== void 0 && lockedAuction.version !== parsed.data.expectedVersion) {
      return {
        ok: false,
        status: 409,
        error: "Auction stage updated concurrently (stale version). Refreshing state."
      };
    }
    if (!lockedAuction.activePlayerId) {
      return { ok: false, status: 400, error: "No player currently on the live stage." };
    }
    const [player] = await tx.select().from(auctionRegistrations).where(eq12(auctionRegistrations.id, lockedAuction.activePlayerId)).for("update").limit(1);
    if (!player || player.status !== "IN_AUCTION") {
      return { ok: false, status: 400, error: "Active player is not in live bidding." };
    }
    const [franchise] = await tx.select().from(auctionFranchises).where(
      and11(
        eq12(auctionFranchises.id, parsed.data.franchiseId),
        eq12(auctionFranchises.auctionId, lockedAuction.id),
        eq12(auctionFranchises.sportId, player.sportId)
      )
    ).for("update").limit(1);
    if (!franchise) {
      return { ok: false, status: 404, error: "Franchise not found for the active sport." };
    }
    if (lockedAuction.splitMode === "SEPARATE_BOYS_GIRLS" && franchise.track !== player.track) {
      return {
        ok: false,
        status: 400,
        error: `Track mismatch: ${franchise.name} (${franchise.track}) cannot bid on ${player.track} player.`
      };
    }
    if (franchise.status !== "APPROVED") {
      return {
        ok: false,
        status: 403,
        error: "Franchise is not approved for live auction bidding."
      };
    }
    const [latestBid] = await tx.select().from(auctionBids).where(
      and11(
        eq12(auctionBids.auctionPlayerId, player.id),
        eq12(auctionBids.undone, false)
      )
    ).orderBy(desc8(auctionBids.id)).limit(1);
    if (latestBid && latestBid.franchiseId === franchise.id) {
      return { ok: false, status: 400, error: `${franchise.shortCode} already holds the highest bid.` };
    }
    let bidAmount;
    if (!latestBid) {
      if (parsed.data.bidType === "CUSTOM" && parsed.data.amount !== void 0) {
        bidAmount = parsed.data.amount;
      } else if (parsed.data.bidType === "JUMP") {
        bidAmount = player.basePrice + (parsed.data.amount ?? lockedAuction.jumpIncrement);
      } else {
        bidAmount = player.basePrice;
      }
      if (bidAmount < player.basePrice) {
        return {
          ok: false,
          status: 400,
          error: `Opening bid must be at least base price (\u20B9${player.basePrice}).`
        };
      }
    } else {
      const step = parsed.data.bidType === "JUMP" ? parsed.data.amount ?? lockedAuction.jumpIncrement : getIncrementalStep(lockedAuction, latestBid.amount);
      bidAmount = parsed.data.bidType === "CUSTOM" && parsed.data.amount !== void 0 ? parsed.data.amount : latestBid.amount + step;
      if (bidAmount <= latestBid.amount) {
        return {
          ok: false,
          status: 400,
          error: `Bid must exceed current highest bid (\u20B9${latestBid.amount}).`
        };
      }
    }
    const guard = await computeFranchiseGuardrail(
      tx,
      lockedAuction,
      franchise,
      player.playerClass === "CLUB" ? "CLUB" : "NON_CLUB"
    );
    if (!guard.eligible || bidAmount > guard.maxAllowedBid) {
      return {
        ok: false,
        status: 400,
        error: guard.reason && !guard.eligible ? `${franchise.shortCode}: ${guard.reason}` : `${franchise.shortCode} max legal bid is \u20B9${guard.maxAllowedBid} (reserve \u20B9${guard.requiredReserve} required for remaining quota slots).`
      };
    }
    const [createdBid] = await tx.insert(auctionBids).values({
      auctionId: lockedAuction.id,
      sportId: player.sportId,
      auctionPlayerId: player.id,
      franchiseId: franchise.id,
      amount: bidAmount,
      bidType: parsed.data.bidType,
      idempotencyKey: idemKey ?? `bid-${player.id}-${franchise.id}-${crypto4.randomUUID()}`,
      createdBy: req.actor.id
    }).returning();
    await tx.update(auctions).set({ projectorMode: "STAGE", version: lockedAuction.version + 1 }).where(and11(eq12(auctions.id, lockedAuction.id), eq12(auctions.version, lockedAuction.version)));
    const responseJson = { bid: createdBid };
    if (idemKey) {
      await saveIdempotencyRecord(tx, {
        scope: "AUCTION_BID",
        key: idemKey,
        actorUserId: req.actor.id,
        statusCode: 201,
        responseJson
      });
    }
    return { ok: true, replayed: false, bid: createdBid };
  });
  if (!outcome.ok) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }
  if (outcome.replayed) {
    res.status(outcome.statusCode).json(outcome.responseJson);
    return;
  }
  await broadcastAuctionUpdate("AUCTION_BID", {
    bid: outcome.bid,
    sportId: outcome.bid.sportId,
    auctionPlayerId: outcome.bid.auctionPlayerId,
    franchiseId: outcome.bid.franchiseId,
    amount: outcome.bid.amount,
    bidType: outcome.bid.bidType
  });
  res.status(201).json({ bid: outcome.bid });
});
router9.post("/undo", requireAuth, async (req, res) => {
  const auction = await getActiveOrLatestAuction();
  if (!auction) {
    res.status(404).json({ error: "Auction not found." });
    return;
  }
  if (!canOperateAuction(req.actor, auction.id)) {
    res.status(403).json({ error: "Only the Auction Operator or Sports Secretary can undo bids." });
    return;
  }
  const schema = z9.object({ expectedVersion: z9.number().int().positive().optional() });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid undo payload." });
    return;
  }
  if (checkVersionConflict(res, auction, parsed.data.expectedVersion)) return;
  if (!auction.activePlayerId) {
    res.status(400).json({ error: "No active player on stage to undo." });
    return;
  }
  const undone = await db.transaction(async (tx) => {
    const [lockedAuction] = await tx.select().from(auctions).where(eq12(auctions.id, auction.id)).for("update").limit(1);
    if (!lockedAuction) {
      return { ok: false, status: 404, error: "Auction not found." };
    }
    if (parsed.data.expectedVersion !== void 0 && lockedAuction.version !== parsed.data.expectedVersion) {
      return {
        ok: false,
        status: 409,
        error: "Auction stage updated concurrently (stale version). Refreshing state."
      };
    }
    if (!lockedAuction.activePlayerId) {
      return { ok: false, status: 400, error: "No active player on stage to undo." };
    }
    const [player] = await tx.select().from(auctionRegistrations).where(eq12(auctionRegistrations.id, lockedAuction.activePlayerId)).for("update").limit(1);
    if (player && (player.status === "SOLD" || player.status === "UNSOLD")) {
      if (player.status === "SOLD" && player.soldFranchiseId && player.soldPrice) {
        const [franchise] = await tx.select().from(auctionFranchises).where(eq12(auctionFranchises.id, player.soldFranchiseId)).for("update").limit(1);
        if (franchise) {
          await tx.update(auctionFranchises).set({ remainingPurse: franchise.remainingPurse + player.soldPrice }).where(eq12(auctionFranchises.id, franchise.id));
          if (franchise.tournamentTeamId) {
            await tx.delete(teamRosters).where(
              and11(
                eq12(teamRosters.teamId, franchise.tournamentTeamId),
                eq12(teamRosters.playerProfileId, player.playerProfileId)
              )
            );
          }
        }
        const [rtmBid] = await tx.select().from(auctionBids).where(
          and11(
            eq12(auctionBids.auctionPlayerId, player.id),
            eq12(auctionBids.franchiseId, player.soldFranchiseId),
            eq12(auctionBids.bidType, "RTM"),
            eq12(auctionBids.undone, false)
          )
        ).orderBy(desc8(auctionBids.id)).limit(1);
        if (rtmBid) {
          await tx.update(auctionBids).set({ undone: true }).where(eq12(auctionBids.id, rtmBid.id));
          await tx.update(rtmEligibility).set({ used: false }).where(
            and11(
              eq12(rtmEligibility.seasonYear, lockedAuction.seasonYear),
              eq12(rtmEligibility.sportId, player.sportId),
              eq12(rtmEligibility.playerProfileId, player.playerProfileId),
              eq12(rtmEligibility.previousFranchiseId, player.soldFranchiseId)
            )
          );
        }
      }
      await tx.update(auctionRegistrations).set({ status: "IN_AUCTION", soldFranchiseId: null, soldPrice: null }).where(eq12(auctionRegistrations.id, player.id));
      await tx.update(auctions).set({ projectorMode: "STAGE", version: lockedAuction.version + 1 }).where(and11(eq12(auctions.id, lockedAuction.id), eq12(auctions.version, lockedAuction.version)));
      return { ok: true, data: { revertedOutcome: player.status } };
    }
    const [latestBid] = await tx.select().from(auctionBids).where(
      and11(
        eq12(auctionBids.auctionPlayerId, lockedAuction.activePlayerId),
        eq12(auctionBids.undone, false)
      )
    ).orderBy(desc8(auctionBids.id)).limit(1);
    if (!latestBid) {
      return { ok: false, status: 400, error: "No active bid or outcome to undo for the staged player." };
    }
    await tx.update(auctionBids).set({ undone: true }).where(eq12(auctionBids.id, latestBid.id));
    await tx.update(auctions).set({ projectorMode: "STAGE", version: lockedAuction.version + 1 }).where(and11(eq12(auctions.id, lockedAuction.id), eq12(auctions.version, lockedAuction.version)));
    return { ok: true, data: { undoneBidId: latestBid.id } };
  });
  if (!undone.ok) {
    res.status(undone.status).json({ error: undone.error });
    return;
  }
  await broadcastAuctionUpdate("AUCTION_BID", { undone: undone.data });
  res.json({ ok: true, ...undone.data });
});
async function syncSoldPlayerToTournamentTeam(tx, auction, franchise, player, soldPrice) {
  let targetTournamentId = auction.tournamentId;
  if (!targetTournamentId) {
    const [curT] = await tx.select().from(tournaments).where(eq12(tournaments.isCurrent, true)).limit(1);
    targetTournamentId = curT?.id ?? null;
  }
  if (!targetTournamentId) return;
  let teamId = franchise.tournamentTeamId;
  if (!teamId) {
    const [existingTeam] = await tx.select().from(teams).where(
      and11(
        eq12(teams.tournamentId, targetTournamentId),
        eq12(teams.sportId, franchise.sportId),
        eq12(teams.shortCode, franchise.shortCode)
      )
    ).limit(1);
    if (existingTeam) {
      teamId = existingTeam.id;
    } else {
      const [createdTeam] = await tx.insert(teams).values({
        tournamentId: targetTournamentId,
        sportId: franchise.sportId,
        name: franchise.name,
        shortCode: franchise.shortCode,
        accentColor: franchise.accentColor,
        captainUserId: franchise.captainUserId,
        franchiseId: franchise.id,
        submissionStatus: "APPROVED",
        reviewedBy: franchise.captainUserId ?? null
      }).returning();
      teamId = createdTeam.id;
    }
    await tx.update(auctionFranchises).set({ tournamentTeamId: teamId }).where(eq12(auctionFranchises.id, franchise.id));
  }
  await tx.insert(teamRosters).values({
    teamId,
    playerProfileId: player.playerProfileId,
    playingRole: player.positionsJson[0] ?? null,
    playerClass: player.playerClass,
    soldPrice
  }).onConflictDoUpdate({
    target: [teamRosters.teamId, teamRosters.playerProfileId],
    set: {
      playingRole: player.positionsJson[0] ?? null,
      playerClass: player.playerClass,
      soldPrice
    }
  });
}
router9.post("/outcome", requireAuth, async (req, res) => {
  const auction = await getActiveOrLatestAuction();
  if (!auction) {
    res.status(404).json({ error: "Auction not found." });
    return;
  }
  if (!canOperateAuction(req.actor, auction.id)) {
    res.status(403).json({ error: "Only the Auction Operator or Sports Secretary can mark SOLD / UNSOLD." });
    return;
  }
  if (!auction.activePlayerId) {
    res.status(400).json({ error: "No active player on stage." });
    return;
  }
  const schema = z9.object({
    outcome: z9.enum(["SOLD", "UNSOLD"]),
    expectedVersion: z9.number().int().positive().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid outcome payload." });
    return;
  }
  if (checkVersionConflict(res, auction, parsed.data.expectedVersion)) return;
  const idemKey = extractIdempotencyKey(req);
  const result = await db.transaction(async (tx) => {
    if (idemKey) {
      const cached = await findIdempotencyRecord(tx, "AUCTION_OUTCOME", idemKey);
      if (cached) {
        return {
          ok: true,
          replayed: true,
          statusCode: cached.statusCode,
          responseJson: cached.responseJson
        };
      }
    }
    const [lockedAuction] = await tx.select().from(auctions).where(eq12(auctions.id, auction.id)).for("update").limit(1);
    if (!lockedAuction) {
      return { ok: false, status: 404, error: "Auction not found." };
    }
    if (parsed.data.expectedVersion !== void 0 && lockedAuction.version !== parsed.data.expectedVersion) {
      return {
        ok: false,
        status: 409,
        error: "Auction stage updated concurrently (stale version). Refreshing state."
      };
    }
    if (!lockedAuction.activePlayerId) {
      return { ok: false, status: 400, error: "No active player on stage." };
    }
    const [player] = await tx.select().from(auctionRegistrations).where(eq12(auctionRegistrations.id, lockedAuction.activePlayerId)).for("update").limit(1);
    if (!player || player.status !== "IN_AUCTION") {
      return { ok: false, status: 400, error: "Staged player is not currently IN_AUCTION." };
    }
    if (parsed.data.outcome === "UNSOLD") {
      const [updatedReg2] = await tx.update(auctionRegistrations).set({ status: "UNSOLD", soldFranchiseId: null, soldPrice: null }).where(eq12(auctionRegistrations.id, player.id)).returning();
      await tx.update(auctions).set({ projectorMode: "UNSOLD", version: lockedAuction.version + 1 }).where(and11(eq12(auctions.id, lockedAuction.id), eq12(auctions.version, lockedAuction.version)));
      await recordAuditLog(tx, req.actor.id, "AUCTION_UNSOLD", "auction_registrations", player.id, {});
      const responseJson2 = { ok: true, registration: updatedReg2 };
      if (idemKey) {
        await saveIdempotencyRecord(tx, {
          scope: "AUCTION_OUTCOME",
          key: idemKey,
          actorUserId: req.actor.id,
          statusCode: 200,
          responseJson: responseJson2
        });
      }
      return { ok: true, replayed: false, registration: updatedReg2, soldToUserId: null };
    }
    const [leadingBid] = await tx.select().from(auctionBids).where(and11(eq12(auctionBids.auctionPlayerId, player.id), eq12(auctionBids.undone, false))).orderBy(desc8(auctionBids.id)).limit(1);
    if (!leadingBid || !leadingBid.franchiseId) {
      return { ok: false, status: 400, error: "Cannot mark SOLD without at least one valid bid." };
    }
    const [franchise] = await tx.select().from(auctionFranchises).where(eq12(auctionFranchises.id, leadingBid.franchiseId)).for("update").limit(1);
    if (!franchise) {
      return { ok: false, status: 404, error: "Winning franchise not found." };
    }
    const guard = await computeFranchiseGuardrail(
      tx,
      lockedAuction,
      franchise,
      player.playerClass === "CLUB" ? "CLUB" : "NON_CLUB"
    );
    if (!guard.eligible || leadingBid.amount > guard.maxAllowedBid) {
      return { ok: false, status: 400, error: "Winning bid exceeds franchise purse/quota guardrail." };
    }
    await tx.update(auctionFranchises).set({ remainingPurse: franchise.remainingPurse - leadingBid.amount }).where(eq12(auctionFranchises.id, franchise.id));
    const [updatedReg] = await tx.update(auctionRegistrations).set({
      status: "SOLD",
      soldFranchiseId: franchise.id,
      soldPrice: leadingBid.amount
    }).where(eq12(auctionRegistrations.id, player.id)).returning();
    await syncSoldPlayerToTournamentTeam(tx, lockedAuction, franchise, player, leadingBid.amount);
    await tx.update(auctions).set({ projectorMode: "SOLD", version: lockedAuction.version + 1 }).where(and11(eq12(auctions.id, lockedAuction.id), eq12(auctions.version, lockedAuction.version)));
    const [prof] = await tx.select({ userId: playerProfiles.userId }).from(playerProfiles).where(eq12(playerProfiles.id, player.playerProfileId)).limit(1);
    if (prof?.userId) {
      await tx.insert(notifications).values({
        userId: prof.userId,
        title: `Auction SOLD: ${franchise.name}`,
        message: `You were signed by ${franchise.name} (${franchise.shortCode}) for \u20B9${leadingBid.amount}.`,
        linkUrl: "/live-auction"
      });
    }
    await recordAuditLog(tx, req.actor.id, "AUCTION_SOLD", "auction_registrations", player.id, {
      franchiseId: franchise.id,
      soldPrice: leadingBid.amount
    });
    const responseJson = { ok: true, registration: updatedReg };
    if (idemKey) {
      await saveIdempotencyRecord(tx, {
        scope: "AUCTION_OUTCOME",
        key: idemKey,
        actorUserId: req.actor.id,
        statusCode: 200,
        responseJson
      });
    }
    return { ok: true, replayed: false, registration: updatedReg, soldToUserId: prof?.userId ?? null };
  });
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  if (result.replayed) {
    res.status(result.statusCode).json(result.responseJson);
    return;
  }
  if (result.soldToUserId) {
    broadcastSse("NOTIFICATION", { auctionOutcome: parsed.data.outcome }, [result.soldToUserId]);
  }
  await broadcastAuctionUpdate("AUCTION_OUTCOME", {
    outcome: parsed.data.outcome,
    registration: result.registration
  });
  res.json({ ok: true, registration: result.registration });
});
router9.post("/rtm", requireAuth, async (req, res) => {
  const auction = await getActiveOrLatestAuction();
  if (!auction) {
    res.status(404).json({ error: "Auction not found." });
    return;
  }
  if (!canOperateAuction(req.actor, auction.id)) {
    res.status(403).json({ error: "Only the Auction Operator or Sports Secretary can exercise RTM." });
    return;
  }
  if (!auction.activePlayerId) {
    res.status(400).json({ error: "No active player on stage." });
    return;
  }
  const schema = z9.object({
    franchiseId: z9.number().int().positive(),
    expectedVersion: z9.number().int().positive().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid RTM payload." });
    return;
  }
  if (checkVersionConflict(res, auction, parsed.data.expectedVersion)) return;
  const idemKey = extractIdempotencyKey(req);
  const outcome = await db.transaction(async (tx) => {
    if (idemKey) {
      const prior = await findIdempotencyRecord(tx, "AUCTION_RTM", idemKey);
      if (prior) {
        return {
          ok: true,
          replayed: true,
          statusCode: prior.statusCode,
          responseJson: prior.responseJson
        };
      }
    }
    const [lockedAuction] = await tx.select().from(auctions).where(eq12(auctions.id, auction.id)).for("update").limit(1);
    if (!lockedAuction) {
      return { ok: false, status: 404, error: "Auction not found." };
    }
    if (lockedAuction.status !== "LIVE") {
      return { ok: false, status: 400, error: "Auction status must be LIVE to exercise RTM." };
    }
    if (!lockedAuction.rtmEnabled) {
      return { ok: false, status: 400, error: "RTM is disabled for this auction." };
    }
    if (parsed.data.expectedVersion !== void 0 && lockedAuction.version !== parsed.data.expectedVersion) {
      return {
        ok: false,
        status: 409,
        error: "Auction stage updated concurrently (stale version). Refreshing state."
      };
    }
    if (!lockedAuction.activePlayerId) {
      return { ok: false, status: 400, error: "No active player on stage." };
    }
    const [player] = await tx.select().from(auctionRegistrations).where(eq12(auctionRegistrations.id, lockedAuction.activePlayerId)).for("update").limit(1);
    if (!player) {
      return { ok: false, status: 404, error: "Active player not found." };
    }
    if (player.status !== "IN_AUCTION" && player.status !== "SOLD") {
      return { ok: false, status: 400, error: "Player is not eligible for RTM in current state." };
    }
    const [rtm] = await tx.select().from(rtmEligibility).where(
      and11(
        eq12(rtmEligibility.seasonYear, lockedAuction.seasonYear),
        eq12(rtmEligibility.sportId, player.sportId),
        eq12(rtmEligibility.playerProfileId, player.playerProfileId),
        eq12(rtmEligibility.previousFranchiseId, parsed.data.franchiseId),
        eq12(rtmEligibility.used, false)
      )
    ).for("update").limit(1);
    if (!rtm) {
      return { ok: false, status: 400, error: "RTM is not eligible for this franchise and player." };
    }
    const franchiseIdsToLock = Array.from(
      new Set(
        [parsed.data.franchiseId, player.soldFranchiseId].filter(
          (id) => id !== null && id !== void 0
        )
      )
    ).sort((a, b) => a - b);
    const lockedFranchises = await tx.select().from(auctionFranchises).where(inArray7(auctionFranchises.id, franchiseIdsToLock)).orderBy(asc8(auctionFranchises.id)).for("update");
    const rtmFranchise = lockedFranchises.find(
      (f) => f.id === parsed.data.franchiseId && f.sportId === player.sportId && f.auctionId === lockedAuction.id
    );
    if (!rtmFranchise) {
      return { ok: false, status: 404, error: "RTM franchise not found for this sport." };
    }
    if (rtmFranchise.status !== "APPROVED") {
      return {
        ok: false,
        status: 403,
        error: "RTM franchise is not approved for auction participation."
      };
    }
    const matchPrice = player.soldPrice ?? (await tx.select().from(auctionBids).where(and11(eq12(auctionBids.auctionPlayerId, player.id), eq12(auctionBids.undone, false))).orderBy(desc8(auctionBids.id)).limit(1))[0]?.amount ?? player.basePrice;
    if (player.status === "SOLD" && player.soldFranchiseId && player.soldPrice) {
      if (player.soldFranchiseId === rtmFranchise.id) {
        return { ok: false, status: 400, error: "Franchise already won the player." };
      }
      const prevF = lockedFranchises.find((f) => f.id === player.soldFranchiseId);
      if (prevF) {
        await tx.update(auctionFranchises).set({ remainingPurse: prevF.remainingPurse + player.soldPrice }).where(eq12(auctionFranchises.id, prevF.id));
        if (prevF.tournamentTeamId) {
          await tx.delete(teamRosters).where(
            and11(
              eq12(teamRosters.teamId, prevF.tournamentTeamId),
              eq12(teamRosters.playerProfileId, player.playerProfileId)
            )
          );
        }
      }
    }
    const guard = await computeFranchiseGuardrail(
      tx,
      lockedAuction,
      rtmFranchise,
      player.playerClass === "CLUB" ? "CLUB" : "NON_CLUB"
    );
    if (!guard.eligible || matchPrice > guard.maxAllowedBid) {
      return { ok: false, status: 400, error: "RTM franchise exceeds max allowed bid guardrail." };
    }
    await tx.update(auctionFranchises).set({ remainingPurse: rtmFranchise.remainingPurse - matchPrice }).where(eq12(auctionFranchises.id, rtmFranchise.id));
    await tx.insert(auctionBids).values({
      auctionId: lockedAuction.id,
      sportId: player.sportId,
      auctionPlayerId: player.id,
      franchiseId: rtmFranchise.id,
      amount: matchPrice,
      bidType: "RTM",
      idempotencyKey: idemKey ?? `rtm-${player.id}-${rtmFranchise.id}-${crypto4.randomUUID()}`,
      createdBy: req.actor.id
    });
    const [updatedReg] = await tx.update(auctionRegistrations).set({ status: "SOLD", soldFranchiseId: rtmFranchise.id, soldPrice: matchPrice }).where(eq12(auctionRegistrations.id, player.id)).returning();
    await tx.update(rtmEligibility).set({ used: true }).where(eq12(rtmEligibility.id, rtm.id));
    await syncSoldPlayerToTournamentTeam(tx, lockedAuction, rtmFranchise, player, matchPrice);
    const [updatedAuc] = await tx.update(auctions).set({ projectorMode: "SOLD", version: lockedAuction.version + 1 }).where(and11(eq12(auctions.id, lockedAuction.id), eq12(auctions.version, lockedAuction.version))).returning();
    if (!updatedAuc) {
      return {
        ok: false,
        status: 409,
        error: "Auction stage updated concurrently (stale version). Refreshing state."
      };
    }
    await recordAuditLog(tx, req.actor.id, "AUCTION_RTM", "auction_registrations", player.id, {
      franchiseId: rtmFranchise.id,
      matchPrice,
      rtmEligibilityId: rtm.id
    });
    const responseJson = { ok: true, registration: updatedReg };
    if (idemKey) {
      await saveIdempotencyRecord(tx, {
        scope: "AUCTION_RTM",
        key: idemKey,
        actorUserId: req.actor.id,
        statusCode: 200,
        responseJson
      });
    }
    return { ok: true, replayed: false, registration: updatedReg };
  });
  if (!outcome.ok) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }
  if (outcome.replayed) {
    res.status(outcome.statusCode).json(outcome.responseJson);
    return;
  }
  await broadcastAuctionUpdate("AUCTION_OUTCOME", {
    outcome: "SOLD",
    rtm: true,
    registration: outcome.registration
  });
  res.json({ ok: true, registration: outcome.registration });
});
router9.post("/projector", requireAuth, async (req, res) => {
  const auction = await getActiveOrLatestAuction();
  if (!auction) {
    res.status(404).json({ error: "Auction not found." });
    return;
  }
  if (!canOperateAuction(req.actor, auction.id)) {
    res.status(403).json({ error: "Only the Auction Operator or Sports Secretary can control projector mode." });
    return;
  }
  const schema = z9.object({
    mode: z9.enum(["STAGE", "SOLD", "UNSOLD", "STANDINGS", "PAUSED"]),
    expectedVersion: z9.number().int().positive().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid projector mode payload." });
    return;
  }
  if (checkVersionConflict(res, auction, parsed.data.expectedVersion)) return;
  const projOutcome = await db.transaction(async (tx) => {
    const [lockedAuction] = await tx.select().from(auctions).where(eq12(auctions.id, auction.id)).for("update").limit(1);
    if (!lockedAuction) {
      return { ok: false, status: 404, error: "Auction not found." };
    }
    if (parsed.data.expectedVersion !== void 0 && lockedAuction.version !== parsed.data.expectedVersion) {
      return {
        ok: false,
        status: 409,
        error: "Auction stage updated concurrently (stale version). Refreshing state."
      };
    }
    const [updatedAuc] = await tx.update(auctions).set({
      projectorMode: parsed.data.mode,
      projectorPaused: parsed.data.mode === "PAUSED",
      version: lockedAuction.version + 1
    }).where(and11(eq12(auctions.id, lockedAuction.id), eq12(auctions.version, lockedAuction.version))).returning();
    if (!updatedAuc) {
      return {
        ok: false,
        status: 409,
        error: "Auction stage updated concurrently (stale version). Refreshing state."
      };
    }
    return { ok: true };
  });
  if (!projOutcome.ok) {
    res.status(projOutcome.status).json({ error: projOutcome.error });
    return;
  }
  await broadcastAuctionUpdate("AUCTION_PROJECTOR", { mode: parsed.data.mode });
  res.json({ ok: true, projectorMode: parsed.data.mode });
});
router9.get("/team-registrations", requireAuth, async (req, res) => {
  const auction = await getActiveOrLatestAuction();
  if (!auction) {
    res.json({ teamRegistrations: [] });
    return;
  }
  const sportId = req.query.sportId ? Number(req.query.sportId) : null;
  const isGlobalAdmin = hasGlobalSportsAuthority(req.actor);
  const conditions = [eq12(auctionTeamRegistrations.auctionId, auction.id)];
  if (sportId && Number.isFinite(sportId)) {
    conditions.push(eq12(auctionTeamRegistrations.sportId, sportId));
  }
  if (!isGlobalAdmin) {
    conditions.push(
      or4(
        eq12(auctionTeamRegistrations.submittedByUserId, req.actor.id),
        eq12(auctionTeamRegistrations.captainUserId, req.actor.id)
      )
    );
  }
  const rows = await db.select().from(auctionTeamRegistrations).where(and11(...conditions)).orderBy(desc8(auctionTeamRegistrations.createdAt), desc8(auctionTeamRegistrations.id));
  const userIds = Array.from(
    new Set(
      rows.flatMap((r) => [r.submittedByUserId, r.captainUserId]).filter((id) => id !== null)
    )
  );
  const [userRows, allSports] = await Promise.all([
    userIds.length > 0 ? db.select({ id: users.id, name: users.name, rollNumber: users.rollNumber }).from(users).where(inArray7(users.id, userIds)) : Promise.resolve([]),
    db.select({ id: sports.id, name: sports.name }).from(sports)
  ]);
  const userMap = Object.fromEntries(userRows.map((u) => [u.id, u]));
  const sportMap = Object.fromEntries(allSports.map((s) => [s.id, s.name]));
  res.json({
    teamRegistrations: rows.map((r) => ({
      ...r,
      sportName: sportMap[r.sportId] ?? "Sport",
      submitterName: userMap[r.submittedByUserId]?.name ?? "User",
      captainName: r.captainUserId ? userMap[r.captainUserId]?.name ?? null : null
    }))
  });
});
router9.post("/team-registrations", requireAuth, async (req, res) => {
  const auction = await getActiveOrLatestAuction();
  if (!auction) {
    res.status(404).json({ error: "No active Prothymos auction found." });
    return;
  }
  if (auction.status !== "REGISTRATION_OPEN") {
    res.status(400).json({ error: "Team registrations are closed because auction registration is not open." });
    return;
  }
  if (auction.registrationDeadline && Date.now() > new Date(auction.registrationDeadline).getTime() && !hasGlobalSportsAuthority(req.actor)) {
    res.status(400).json({ error: "Auction team registration deadline has passed." });
    return;
  }
  const schema = z9.object({
    sportId: z9.number().int().positive(),
    track: z9.enum(["COMBINED", "BOYS", "GIRLS"]).optional(),
    teamName: z9.string().trim().min(2).max(80),
    shortCode: z9.string().trim().min(2).max(8),
    accentColor: z9.string().trim().min(4).max(20).optional(),
    captainUserId: z9.number().int().positive().nullable().optional(),
    memberUserIds: z9.array(z9.number().int().positive()).max(20).optional(),
    rosterNotes: z9.string().trim().max(400).nullable().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid team registration payload." });
    return;
  }
  if (parsed.data.memberUserIds && parsed.data.memberUserIds.length > 0) {
    for (const memberUid of Array.from(new Set(parsed.data.memberUserIds))) {
      const memErr = await assertStudentCandidate(memberUid);
      if (memErr) {
        res.status(400).json({ error: memErr });
        return;
      }
    }
  }
  const cleanCode = parsed.data.shortCode.toUpperCase();
  const cleanName = parsed.data.teamName.trim();
  const [dupFranchise] = await db.select({ id: auctionFranchises.id }).from(auctionFranchises).where(
    and11(
      eq12(auctionFranchises.auctionId, auction.id),
      eq12(auctionFranchises.sportId, parsed.data.sportId),
      or4(eq12(auctionFranchises.shortCode, cleanCode), eq12(auctionFranchises.name, cleanName))
    )
  ).limit(1);
  if (dupFranchise) {
    res.status(409).json({ error: "A franchise with that team name or short code already exists for this sport." });
    return;
  }
  const [dupPending] = await db.select({ id: auctionTeamRegistrations.id }).from(auctionTeamRegistrations).where(
    and11(
      eq12(auctionTeamRegistrations.auctionId, auction.id),
      eq12(auctionTeamRegistrations.sportId, parsed.data.sportId),
      eq12(auctionTeamRegistrations.status, "PENDING_APPROVAL"),
      or4(
        eq12(auctionTeamRegistrations.shortCode, cleanCode),
        eq12(auctionTeamRegistrations.teamName, cleanName)
      )
    )
  ).limit(1);
  if (dupPending) {
    res.status(409).json({ error: "A pending team registration with that name or code already exists." });
    return;
  }
  const resolvedCaptainId = parsed.data.captainUserId !== void 0 ? parsed.data.captainUserId : req.actor.accountType === "STUDENT" ? req.actor.id : null;
  if (resolvedCaptainId) {
    const capErr = await assertStudentCandidate(resolvedCaptainId);
    if (capErr) {
      res.status(400).json({ error: capErr });
      return;
    }
  }
  const effectiveTeamTrack = auction.splitMode === "SEPARATE_BOYS_GIRLS" ? parsed.data.track === "GIRLS" ? "GIRLS" : "BOYS" : "COMBINED";
  const [created] = await db.insert(auctionTeamRegistrations).values({
    auctionId: auction.id,
    sportId: parsed.data.sportId,
    track: effectiveTeamTrack,
    submittedByUserId: req.actor.id,
    teamName: cleanName,
    shortCode: cleanCode,
    accentColor: parsed.data.accentColor || "#D97706",
    captainUserId: resolvedCaptainId,
    memberUserIdsJson: parsed.data.memberUserIds ?? [],
    rosterNotes: parsed.data.rosterNotes?.trim() || null,
    status: "PENDING_APPROVAL"
  }).returning();
  await broadcastAuctionUpdate("AUCTION_UPDATED", { teamRegistrationId: created.id });
  res.status(201).json({ teamRegistration: created });
});
router9.patch("/team-registrations/:id/review", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can review auction team registrations." });
    return;
  }
  const regId = parsePositiveIntId(req.params.id);
  if (!regId) {
    res.status(400).json({ error: "Invalid registration ID." });
    return;
  }
  const schema = z9.object({
    decision: z9.enum(["APPROVED", "CHANGES_REQUESTED", "REJECTED"]),
    reviewNote: z9.string().trim().max(400).optional(),
    startingPurse: z9.number().int().positive().optional(),
    captainUserId: z9.number().int().positive().nullable().optional(),
    minSquad: z9.number().int().min(1).max(30).optional(),
    maxSquad: z9.number().int().min(1).max(40).optional(),
    minClubQuota: z9.number().int().min(0).max(20).optional(),
    minNonClubQuota: z9.number().int().min(0).max(20).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid team review payload." });
    return;
  }
  const [existing] = await db.select().from(auctionTeamRegistrations).where(eq12(auctionTeamRegistrations.id, regId)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Team registration not found." });
    return;
  }
  if (parsed.data.captainUserId) {
    const capErr = await assertStudentCandidate(parsed.data.captainUserId);
    if (capErr) {
      res.status(400).json({ error: capErr });
      return;
    }
  }
  const result = await db.transaction(async (tx) => {
    const [lockedExisting] = await tx.select().from(auctionTeamRegistrations).where(eq12(auctionTeamRegistrations.id, regId)).for("update").limit(1);
    if (!lockedExisting) {
      return { ok: false, status: 404, error: "Team registration not found." };
    }
    if (lockedExisting.status === "APPROVED" && parsed.data.decision === "APPROVED") {
      return {
        ok: false,
        status: 409,
        error: "Team registration has already been approved."
      };
    }
    let linkedFranchiseId = lockedExisting.franchiseId;
    const finalCaptainId = parsed.data.captainUserId !== void 0 ? parsed.data.captainUserId : lockedExisting.captainUserId;
    if (parsed.data.decision === "APPROVED") {
      if (linkedFranchiseId) {
        await tx.update(auctionFranchises).set({
          status: "APPROVED",
          captainUserId: finalCaptainId,
          ...parsed.data.startingPurse ? { startingPurse: parsed.data.startingPurse, remainingPurse: parsed.data.startingPurse } : {},
          ...parsed.data.minSquad !== void 0 ? { minSquad: parsed.data.minSquad } : {},
          ...parsed.data.maxSquad !== void 0 ? { maxSquad: parsed.data.maxSquad } : {},
          ...parsed.data.minClubQuota !== void 0 ? { minClubQuota: parsed.data.minClubQuota } : {},
          ...parsed.data.minNonClubQuota !== void 0 ? { minNonClubQuota: parsed.data.minNonClubQuota } : {}
        }).where(eq12(auctionFranchises.id, linkedFranchiseId));
      } else {
        const existingSportFranchises = await tx.select({ slotNumber: auctionFranchises.slotNumber }).from(auctionFranchises).where(
          and11(
            eq12(auctionFranchises.auctionId, lockedExisting.auctionId),
            eq12(auctionFranchises.sportId, lockedExisting.sportId)
          )
        );
        const nextSlot = existingSportFranchises.reduce((max, f) => Math.max(max, f.slotNumber), 0) + 1;
        const purse = parsed.data.startingPurse ?? 2e4;
        const [createdFranchise] = await tx.insert(auctionFranchises).values({
          auctionId: lockedExisting.auctionId,
          sportId: lockedExisting.sportId,
          slotNumber: nextSlot,
          name: lockedExisting.teamName,
          shortCode: lockedExisting.shortCode,
          accentColor: lockedExisting.accentColor,
          captainUserId: finalCaptainId,
          startingPurse: purse,
          remainingPurse: purse,
          minSquad: parsed.data.minSquad ?? 6,
          maxSquad: parsed.data.maxSquad ?? 15,
          minClubQuota: parsed.data.minClubQuota ?? 1,
          minNonClubQuota: parsed.data.minNonClubQuota ?? 1,
          status: "APPROVED"
        }).returning();
        linkedFranchiseId = createdFranchise.id;
      }
      if (finalCaptainId) {
        const capProfileId = await ensureStudentPlayerProfileId(tx, finalCaptainId);
        if (capProfileId) {
          await tx.update(auctionRegistrations).set({ status: "INELIGIBLE" }).where(
            and11(
              eq12(auctionRegistrations.auctionId, lockedExisting.auctionId),
              eq12(auctionRegistrations.playerProfileId, capProfileId),
              inArray7(auctionRegistrations.status, ["REGISTERED", "ELIGIBLE", "UNSOLD", "IN_AUCTION"])
            )
          );
        }
      }
    } else if (linkedFranchiseId) {
      await tx.update(auctionFranchises).set({ status: parsed.data.decision }).where(eq12(auctionFranchises.id, linkedFranchiseId));
    }
    const [updatedReg] = await tx.update(auctionTeamRegistrations).set({
      status: parsed.data.decision,
      captainUserId: finalCaptainId,
      franchiseId: linkedFranchiseId,
      reviewedByUserId: req.actor.id,
      reviewNote: parsed.data.reviewNote?.trim() || null,
      reviewedAt: /* @__PURE__ */ new Date()
    }).where(eq12(auctionTeamRegistrations.id, regId)).returning();
    const notifyTargets = Array.from(
      new Set(
        [lockedExisting.submittedByUserId, finalCaptainId].filter((id) => id !== null)
      )
    );
    if (notifyTargets.length > 0) {
      await tx.insert(notifications).values(
        notifyTargets.map((uid) => ({
          userId: uid,
          title: `Auction Team ${lockedExisting.teamName}: ${parsed.data.decision}`,
          message: parsed.data.reviewNote?.trim() || (parsed.data.decision === "APPROVED" ? "Your team is approved and active for Prothymos live auction bidding." : "Review update from Sports Secretary."),
          linkUrl: "/auction"
        }))
      );
    }
    await recordAuditLog(
      tx,
      req.actor.id,
      `AUCTION_TEAM_${parsed.data.decision}`,
      "auction_team_registrations",
      regId,
      { franchiseId: linkedFranchiseId }
    );
    return { ok: true, updatedReg };
  });
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  await broadcastAuctionUpdate("AUCTION_UPDATED", { teamRegistrationId: regId });
  res.json({ teamRegistration: result.updatedReg });
});
router9.post("/publish-rosters", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can publish rosters to a tournament." });
    return;
  }
  const auction = await getActiveOrLatestAuction();
  if (!auction) {
    res.status(404).json({ error: "No Prothymos auction found." });
    return;
  }
  const schema = z9.object({ sportId: z9.number().int().positive().optional() });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid publish rosters payload." });
    return;
  }
  const result = await db.transaction(async (tx) => {
    let currentT;
    if (auction.tournamentId) {
      const [linked] = await tx.select().from(tournaments).where(eq12(tournaments.id, auction.tournamentId)).limit(1);
      if (linked && linked.status !== "ARCHIVED") {
        if (!linked.isCurrent || linked.status !== "ACTIVE") {
          await tx.update(tournaments).set({ isCurrent: false }).where(eq12(tournaments.isCurrent, true));
          const [activated] = await tx.update(tournaments).set({ isCurrent: true, status: "ACTIVE" }).where(eq12(tournaments.id, linked.id)).returning();
          currentT = activated;
        } else {
          currentT = linked;
        }
      }
    }
    if (!currentT) {
      const [activeCurrent] = await tx.select().from(tournaments).where(eq12(tournaments.isCurrent, true)).orderBy(desc8(tournaments.id)).limit(1);
      currentT = activeCurrent;
    }
    if (!currentT) {
      const [upcomingPro] = await tx.select().from(tournaments).where(and11(eq12(tournaments.status, "UPCOMING"), eq12(tournaments.tournamentType, "PROTHYMOS"))).orderBy(desc8(tournaments.id)).limit(1);
      if (upcomingPro) {
        const [activated] = await tx.update(tournaments).set({ isCurrent: true, status: "ACTIVE" }).where(eq12(tournaments.id, upcomingPro.id)).returning();
        currentT = activated;
      }
    }
    if (!currentT) {
      const [createdT] = await tx.insert(tournaments).values({
        name: `${auction.name} Championship`,
        academicYear: auction.seasonYear,
        semester: "EVEN",
        tournamentType: "PROTHYMOS",
        format: "GROUP_KNOCKOUT",
        rosterMode: "AUCTION",
        status: "ACTIVE",
        isCurrent: true,
        startsAt: /* @__PURE__ */ new Date(),
        description: "Published from Prothymos final auction squad sheets."
      }).returning();
      currentT = createdT;
    }
    await tx.insert(siteSettings).values({ key: "currentTournamentId", valueJson: currentT.id, updatedBy: req.actor.id }).onConflictDoUpdate({
      target: siteSettings.key,
      set: { valueJson: currentT.id, updatedBy: req.actor.id, updatedAt: /* @__PURE__ */ new Date() }
    });
    const franchiseConds = [
      eq12(auctionFranchises.auctionId, auction.id),
      eq12(auctionFranchises.status, "APPROVED")
    ];
    if (parsed.data.sportId) {
      franchiseConds.push(eq12(auctionFranchises.sportId, parsed.data.sportId));
    }
    const approvedFranchises = await tx.select().from(auctionFranchises).where(and11(...franchiseConds)).orderBy(asc8(auctionFranchises.sportId), asc8(auctionFranchises.slotNumber));
    const sportIdsToEnsure = Array.from(new Set(approvedFranchises.map((f) => f.sportId)));
    if (sportIdsToEnsure.length > 0) {
      await tx.insert(tournamentSports).values(
        sportIdsToEnsure.map((sid) => ({
          tournamentId: currentT.id,
          sportId: sid,
          format: currentT.format
        }))
      ).onConflictDoNothing();
    }
    let syncedTeamsCount = 0;
    let syncedPlayersCount = 0;
    for (const f of approvedFranchises) {
      let teamId = f.tournamentTeamId;
      if (teamId) {
        const [checkT] = await tx.select({ id: teams.id }).from(teams).where(and11(eq12(teams.id, teamId), eq12(teams.tournamentId, currentT.id))).limit(1);
        if (!checkT) teamId = null;
      }
      if (!teamId) {
        const [existingByCode] = await tx.select().from(teams).where(
          and11(
            eq12(teams.tournamentId, currentT.id),
            eq12(teams.sportId, f.sportId),
            eq12(teams.shortCode, f.shortCode)
          )
        ).limit(1);
        if (existingByCode) {
          teamId = existingByCode.id;
          await tx.update(teams).set({
            name: f.name,
            accentColor: f.accentColor,
            captainUserId: f.captainUserId,
            franchiseId: f.id,
            submissionStatus: "APPROVED",
            reviewedBy: req.actor.id
          }).where(eq12(teams.id, teamId));
        } else {
          const [createdTeam] = await tx.insert(teams).values({
            tournamentId: currentT.id,
            sportId: f.sportId,
            name: f.name,
            shortCode: f.shortCode,
            accentColor: f.accentColor,
            captainUserId: f.captainUserId,
            franchiseId: f.id,
            submissionStatus: "APPROVED",
            reviewedBy: req.actor.id
          }).returning();
          teamId = createdTeam.id;
        }
        await tx.update(auctionFranchises).set({ tournamentTeamId: teamId }).where(eq12(auctionFranchises.id, f.id));
      }
      syncedTeamsCount += 1;
      await tx.insert(standings).values({
        tournamentId: currentT.id,
        sportId: f.sportId,
        teamId,
        rank: f.slotNumber
      }).onConflictDoNothing();
      if (f.captainUserId) {
        const capProfileId = await ensureStudentPlayerProfileId(tx, f.captainUserId);
        if (capProfileId) {
          const [sportClub] = await tx.select({ id: sportsClubs.id }).from(sportsClubs).where(eq12(sportsClubs.sportId, f.sportId)).limit(1);
          let capClass = "NON_CLUB";
          if (sportClub) {
            const [inductedCap] = await tx.select({ id: clubMemberships.id }).from(clubMemberships).where(
              and11(
                eq12(clubMemberships.clubId, sportClub.id),
                eq12(clubMemberships.playerProfileId, capProfileId),
                eq12(clubMemberships.status, "INDUCTED")
              )
            ).limit(1);
            if (inductedCap) capClass = "CLUB";
          }
          await tx.insert(teamRosters).values({
            teamId,
            playerProfileId: capProfileId,
            playingRole: "Captain",
            playerClass: capClass
          }).onConflictDoNothing();
          syncedPlayersCount += 1;
        }
        const [existingCapRole] = await tx.select({ id: userRoles.id }).from(userRoles).where(
          and11(
            eq12(userRoles.userId, f.captainUserId),
            eq12(userRoles.roleCode, "CAPTAIN"),
            eq12(userRoles.tournamentId, currentT.id),
            eq12(userRoles.active, true)
          )
        ).limit(1);
        if (!existingCapRole) {
          await tx.insert(userRoles).values({
            userId: f.captainUserId,
            roleCode: "CAPTAIN",
            tournamentId: currentT.id,
            grantedBy: req.actor.id
          });
        }
      }
      const soldRegs = await tx.select().from(auctionRegistrations).where(
        and11(
          eq12(auctionRegistrations.auctionId, auction.id),
          eq12(auctionRegistrations.soldFranchiseId, f.id),
          eq12(auctionRegistrations.status, "SOLD")
        )
      );
      for (const sr of soldRegs) {
        await tx.insert(teamRosters).values({
          teamId,
          playerProfileId: sr.playerProfileId,
          playingRole: sr.positionsJson[0] ?? "Squad",
          playerClass: sr.playerClass,
          soldPrice: sr.soldPrice ?? sr.basePrice
        }).onConflictDoUpdate({
          target: [teamRosters.teamId, teamRosters.playerProfileId],
          set: {
            playingRole: sr.positionsJson[0] ?? "Squad",
            playerClass: sr.playerClass,
            soldPrice: sr.soldPrice ?? sr.basePrice
          }
        });
        syncedPlayersCount += 1;
      }
    }
    await tx.update(auctions).set({
      status: "PUBLISHED",
      tournamentId: currentT.id,
      version: auction.version + 1
    }).where(eq12(auctions.id, auction.id));
    await recordAuditLog(tx, req.actor.id, "PUBLISH_AUCTION_ROSTERS", "tournaments", currentT.id, {
      auctionId: auction.id,
      syncedTeamsCount,
      syncedPlayersCount
    });
    return {
      tournamentId: currentT.id,
      tournamentName: currentT.name,
      syncedTeamsCount,
      syncedPlayersCount
    };
  });
  broadcastSse("NAV_UPDATED", { currentTournamentId: result.tournamentId });
  await broadcastAuctionUpdate("AUCTION_UPDATED", { publishedTournamentId: result.tournamentId });
  res.json({ ok: true, ...result });
});
var auction_default = router9;

// server/index.ts
validateProductionSessionSecret();
validateProductionDemoConfig();
validateProductionDeployConfig();
validateStorageConfig();
var PORT = Number(process.env.PORT ?? 3e3);
var isProd = process.env.NODE_ENV === "production";
async function startServer() {
  await verifyDatabaseConnection();
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", parseTrustProxySetting());
  app.use(
    helmet({
      contentSecurityPolicy: isProd ? {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "blob:"],
          scriptSrc: ["'self'"]
        }
      } : false
    })
  );
  app.use(cors(buildCorsOptions()));
  app.use(
    compression({
      filter: (req, res) => {
        if (req.path.endsWith("/stream") || String(res.getHeader("Content-Type") ?? "").includes("text/event-stream")) {
          return false;
        }
        return compression.filter(req, res);
      }
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "2mb" }));
  app.use("/uploads/players", express.static(PLAYER_UPLOADS_DIR, { maxAge: "7d" }));
  app.use("/uploads", express.static(UPLOADS_DIR, { maxAge: "7d" }));
  app.use("/api", attachSession);
  const authLimiter = createRateLimiter({
    windowMs: 6e4,
    maxRequests: 30,
    keyPrefix: "auth"
  });
  const writeLimiter = createRateLimiter({
    windowMs: 6e4,
    maxRequests: 180,
    exemptPrivileged: true,
    keyPrefix: "write"
  });
  app.use("/api", (req, res, next) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      writeLimiter(req, res, next);
      return;
    }
    next();
  });
  app.get("/api/stream", (req, res) => {
    registerSseStream(req, res, req.actor?.id ?? null);
  });
  app.use("/api/auth", authLimiter, wrapAsyncRouter(auth_default));
  app.use("/api", wrapAsyncRouter(bootstrap_default));
  app.use("/api/clubs", wrapAsyncRouter(clubs_default));
  app.use("/api/roles", wrapAsyncRouter(roles_default));
  app.use("/api/tournaments", wrapAsyncRouter(tournaments_default));
  app.use("/api/matches", wrapAsyncRouter(matches_default));
  app.use("/api/archive", wrapAsyncRouter(archive_default));
  app.use("/api/players", wrapAsyncRouter(players_default));
  app.use("/api/auction", wrapAsyncRouter(auction_default));
  app.use("/api", (err, _req, res, _next) => {
    console.error("[API ERROR]", err);
    if (res.headersSent) return;
    if (err instanceof multer2.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({ error: "File exceeds 2 MB limit." });
        return;
      }
      res.status(400).json({ error: err.message || "Invalid file upload." });
      return;
    }
    const e = err;
    if (e?.type === "entity.parse.failed") {
      res.status(400).json({ error: "Malformed JSON request body." });
      return;
    }
    if (e?.code === "23505") {
      res.status(409).json({ error: "Duplicate or conflicting record." });
      return;
    }
    if (e?.code === "22P02" || e?.code === "23503" || e?.code === "23502") {
      res.status(400).json({ error: "Invalid identifier or reference in request." });
      return;
    }
    const status = typeof e?.status === "number" && e.status >= 400 && e.status < 600 ? e.status : 500;
    const message = status < 500 && err instanceof Error && err.message ? err.message : "An internal server error occurred.";
    res.status(status).json({ error: message });
  });
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPublic = path2.resolve(process.cwd(), "dist/public");
    app.use(
      express.static(distPublic, {
        maxAge: "7d",
        setHeaders: (res, filePath) => {
          if (filePath.endsWith(".html")) {
            res.setHeader("Cache-Control", "no-cache");
          }
        }
      })
    );
    app.get("*", (_req, res) => {
      res.sendFile(path2.join(distPublic, "index.html"));
    });
  }
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] IIITT Sports Platform listening on http://0.0.0.0:${PORT} (${isProd ? "production" : "development"})`);
  });
  const activeSockets = /* @__PURE__ */ new Set();
  server.on("connection", (socket) => {
    activeSockets.add(socket);
    socket.on("close", () => activeSockets.delete(socket));
  });
  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[SERVER] Received ${signal}. Closing SSE streams, HTTP server, and PostgreSQL pool...`);
    closeAllSseStreams();
    server.closeIdleConnections?.();
    for (const sock of activeSockets) {
      sock.destroy();
    }
    activeSockets.clear();
    server.close(async () => {
      try {
        await pool.end();
      } catch (err) {
        console.error("[SHUTDOWN] Error closing PostgreSQL pool:", err);
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5e3).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
startServer().catch((err) => {
  console.error("[BOOT ERROR]", err);
  process.exit(1);
});
