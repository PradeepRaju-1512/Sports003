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
  index,
} from "drizzle-orm/pg-core";

// ============================================================================
// 1. IDENTITY, AUTHENTICATION & RESOURCE-SCOPED RBAC
// ============================================================================

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  college: text("college").notNull().default("IIITT"),
  rollNumber: text("roll_number"),
  batch: text("batch").notNull().default("1ST"), // 1ST | 2ND | 3RD | 4TH | MTECH | STAFF | FACULTY
  programType: text("program_type").notNull().default("BTECH"), // BTECH | MTECH
  currentSemester: integer("current_semester").notNull().default(1),
  lastIncrementedTerm: text("last_incremented_term"),
  isGraduated: boolean("is_graduated").notNull().default(false),
  gender: text("gender").notNull().default("BOYS"), // BOYS | GIRLS
  hostel: text("hostel"),
  avatarUrl: text("avatar_url"),
  qrCodeToken: text("qr_code_token").notNull().unique(),
  accountType: text("account_type").notNull().default("STUDENT"), // STUDENT | STAFF | FACULTY | SYSTEM
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const playerProfiles = pgTable("player_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .unique()
    .references(() => users.id, { onDelete: "set null" }),
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
  preferredSports: jsonb("preferred_sports").$type<string[]>().notNull().default([]),
  avatarUrl: text("avatar_url"),
  visibility: text("visibility").notNull().default("PUBLIC"), // PUBLIC | IIITT_ONLY | PRIVATE
  isClaimed: boolean("is_claimed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  label: text("label").notNull(),
  level: integer("level").notNull(),
  description: text("description"),
});

export const userRoles = pgTable(
  "user_roles",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleCode: text("role_code").notNull(),
    clubId: integer("club_id"),
    batchScope: text("batch_scope"), // 1ST | 2ND | 3RD | 4TH | MTECH | ALL | null
    scopeLabel: text("scope_label"), // Optional metadata e.g. Boys | Girls | Track
    tournamentId: integer("tournament_id"),
    auctionId: integer("auction_id"),
    matchId: integer("match_id"),
    grantedBy: integer("granted_by").references(() => users.id, { onDelete: "set null" }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_user_roles_user_active").on(t.userId, t.active)]
);

export const roleRequests = pgTable(
  "role_requests",
  {
    id: serial("id").primaryKey(),
    requesterUserId: integer("requester_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetUserId: integer("target_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    requestedRole: text("requested_role").notNull(), // CLUB_SECRETARY | CLUB_COORDINATOR | MATCH_SCORER
    action: text("action").notNull().default("APPOINT"), // APPOINT | REMOVE
    clubId: integer("club_id"),
    batchScope: text("batch_scope"),
    scopeLabel: text("scope_label"),
    matchId: integer("match_id"),
    auctionId: integer("auction_id"),
    reason: text("reason"),
    status: text("status").notNull().default("PENDING"), // PENDING | APPROVED | REJECTED
    reviewedBy: integer("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewNotes: text("review_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (t) => [index("idx_role_requests_status_created").on(t.status, t.createdAt)]
);

// ============================================================================
// 2. SPORTS & OFFICIAL CLUBS + BATCH-WISE INDUCTIONS
// ============================================================================

export const sports = pgTable("sports", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(), // football, cricket, volleyball, kho_kho, kabaddi, badminton, table_tennis, carrom, chess, throwball
  name: text("name").notNull(),
  category: text("category").notNull(), // OUTDOOR_TEAM | INDOOR
  isOfficialClub: boolean("is_official_club").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
});

export const sportsClubs = pgTable("sports_clubs", {
  id: serial("id").primaryKey(),
  sportId: integer("sport_id")
    .notNull()
    .unique()
    .references(() => sports.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  tagline: text("tagline"),
  description: text("description"),
  bannerUrl: text("banner_url").notNull(),
  practiceSchedule: text("practice_schedule"),
  inductionOpen: boolean("induction_open").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clubMemberships = pgTable(
  "club_memberships",
  {
    id: serial("id").primaryKey(),
    clubId: integer("club_id")
      .notNull()
      .references(() => sportsClubs.id, { onDelete: "cascade" }),
    playerProfileId: integer("player_profile_id")
      .notNull()
      .references(() => playerProfiles.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("MEMBER"), // SECRETARY | COORDINATOR | MEMBER
    batchScope: text("batch_scope"),
    scopeLabel: text("scope_label"), // Optional metadata e.g. Boys | Girls | Open | Track
    status: text("status").notNull().default("APPLIED"), // APPLIED | TRIAL_ATTENDED | INDUCTED | REJECTED
    trialNotes: text("trial_notes"),
    evaluationScore: integer("evaluation_score"),
    evaluatedBy: integer("evaluated_by").references(() => users.id, { onDelete: "set null" }),
    approvedBy: integer("approved_by").references(() => users.id, { onDelete: "set null" }),
    inductedAt: timestamp("inducted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_club_member_profile").on(t.clubId, t.playerProfileId),
    index("idx_club_memberships_profile_status").on(t.playerProfileId, t.status),
  ]
);

export const clubActivities = pgTable(
  "club_activities",
  {
    id: serial("id").primaryKey(),
    clubId: integer("club_id")
      .notNull()
      .references(() => sportsClubs.id, { onDelete: "cascade" }),
    activityType: text("activity_type").notNull(), // PRACTICE | INDUCTION | MEETING | INTER_IIIT | EXTERNAL_MATCH | OTHER
    customTypeLabel: text("custom_type_label"),
    targetBatch: text("target_batch").notNull().default("ALL"), // 1ST | 2ND | 3RD | 4TH | MTECH | ALL
    category: text("category").notNull().default("OPEN"), // BOYS | GIRLS | OPEN
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    venue: text("venue").notNull(),
    notes: text("notes"),
    selectedSquadJson: jsonb("selected_squad_json")
      .$type<
        Array<{
          userId: number;
          playerProfileId: number;
          name: string;
          rollNumber: string | null;
          batch: string;
          branch: string | null;
          isClubMember: boolean;
        }>
      >()
      .notNull()
      .default([]),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_club_activities_club_time").on(t.clubId, t.scheduledAt)]
);

// ============================================================================
// 3. TOURNAMENTS, TEAMS, EVENT-SOURCED SCORING & PERMANENT ARCHIVE
// ============================================================================

export const tournaments = pgTable(
  "tournaments",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    academicYear: integer("academic_year").notNull(),
    semester: text("semester").notNull().default("ODD"), // ODD | EVEN | ANNUAL
    tournamentType: text("tournament_type").notNull().default("FLAGSHIP"), // FLAGSHIP | INTER_HOSTEL | OPEN | INTRA_CLUB | PROTHYMOS
    format: text("format").notNull().default("GROUP_KNOCKOUT"), // KNOCKOUT | LEAGUE | ROUND_ROBIN | GROUP_KNOCKOUT | BEST_OF_SERIES
    rosterMode: text("roster_mode").notNull().default("CAPTAIN_SUBMISSION"), // AUCTION | CAPTAIN_SUBMISSION
    splitMode: text("split_mode").notNull().default("COMBINED"), // COMBINED | SEPARATE_BOYS_GIRLS
    status: text("status").notNull().default("ACTIVE"), // DRAFT | ACTIVE | COMPLETED | ARCHIVED
    completenessStatus: text("completeness_status").notNull().default("COMPLETE"), // RESULTS_ONLY | PARTIAL | COMPLETE | VERIFIED
    isCurrent: boolean("is_current").notNull().default(false),
    posterUrl: text("poster_url"),
    description: text("description"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    verifiedBy: integer("verified_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_tournaments_status_year").on(t.status, t.academicYear)]
);

export const tournamentSports = pgTable(
  "tournament_sports",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    sportId: integer("sport_id")
      .notNull()
      .references(() => sports.id, { onDelete: "cascade" }),
    format: text("format").notNull().default("GROUP_KNOCKOUT"),
    minSquadSize: integer("min_squad_size").notNull().default(1),
    maxSquadSize: integer("max_squad_size").notNull().default(15),
    registrationDeadline: timestamp("registration_deadline", { withTimezone: true }),
    winnerTeamId: integer("winner_team_id"),
    runnerUp1TeamId: integer("runner_up_1_team_id"),
    runnerUp2TeamId: integer("runner_up_2_team_id"),
    configJson: jsonb("config_json").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [uniqueIndex("uq_tournament_sport").on(t.tournamentId, t.sportId)]
);

export const teams = pgTable(
  "teams",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    sportId: integer("sport_id")
      .notNull()
      .references(() => sports.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    shortCode: text("short_code").notNull(),
    accentColor: text("accent_color").notNull().default("#B91C1C"),
    logoUrl: text("logo_url"),
    captainUserId: integer("captain_user_id").references(() => users.id, { onDelete: "set null" }),
    franchiseId: integer("franchise_id"),
    track: text("track").notNull().default("COMBINED"), // COMBINED | BOYS | GIRLS
    submissionStatus: text("submission_status").notNull().default("DRAFT"), // DRAFT | SUBMITTED | APPROVED | CHANGES_REQUESTED | REJECTED | LOCKED
    reviewNotes: text("review_notes"),
    reviewedBy: integer("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_teams_tournament_sport").on(t.tournamentId, t.sportId),
    index("idx_teams_captain").on(t.captainUserId),
  ]
);

export const teamRosters = pgTable(
  "team_rosters",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    playerProfileId: integer("player_profile_id")
      .notNull()
      .references(() => playerProfiles.id, { onDelete: "cascade" }),
    playingRole: text("playing_role"),
    jerseyNumber: integer("jersey_number"),
    playerClass: text("player_class").notNull().default("OPEN"), // CLUB | NON_CLUB | OPEN
    soldPrice: integer("sold_price"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_team_player").on(t.teamId, t.playerProfileId)]
);

export const standings = pgTable(
  "standings",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    sportId: integer("sport_id")
      .notNull()
      .references(() => sports.id, { onDelete: "cascade" }),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
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
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_standing_team").on(t.tournamentId, t.sportId, t.teamId)]
);

export const matches = pgTable(
  "matches",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    sportId: integer("sport_id")
      .notNull()
      .references(() => sports.id, { onDelete: "cascade" }),
    roundLabel: text("round_label").notNull().default("League Match"), // Opening Match | Group A | Quarter-Final | Semi-Final | Final
    matchOrder: integer("match_order").notNull().default(1),
    track: text("track").notNull().default("COMBINED"), // COMBINED | BOYS | GIRLS
    teamAId: integer("team_a_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    teamBId: integer("team_b_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    venue: text("venue").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("UPCOMING"), // UPCOMING | LIVE | COMPLETED
    scorerUserId: integer("scorer_user_id").references(() => users.id, { onDelete: "set null" }),
    lineupAJson: jsonb("lineup_a_json").$type<number[]>().notNull().default([]),
    lineupBJson: jsonb("lineup_b_json").$type<number[]>().notNull().default([]),
    configJson: jsonb("config_json").$type<Record<string, unknown>>().notNull().default({}),
    scoreSummary: text("score_summary"),
    resultNote: text("result_note"),
    winnerTeamId: integer("winner_team_id").references(() => teams.id, { onDelete: "set null" }),
    version: integer("version").notNull().default(1),
    verifiedBy: integer("verified_by").references(() => users.id, { onDelete: "set null" }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_matches_status_time").on(t.status, t.scheduledAt),
    index("idx_matches_tournament_sport").on(t.tournamentId, t.sportId),
    index("idx_matches_scorer").on(t.scorerUserId),
  ]
);

export const matchEvents = pgTable(
  "match_events",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    matchClockMs: integer("match_clock_ms"),
    eventType: text("event_type").notNull(),
    payloadJson: jsonb("payload_json").$type<Record<string, unknown>>().notNull(),
    voided: boolean("voided").notNull().default(false),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_match_event_seq").on(t.matchId, t.seq)]
);

export const playerMatchStats = pgTable(
  "player_match_stats",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    playerProfileId: integer("player_profile_id")
      .notNull()
      .references(() => playerProfiles.id, { onDelete: "cascade" }),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    sportId: integer("sport_id")
      .notNull()
      .references(() => sports.id, { onDelete: "cascade" }),
    statsJson: jsonb("stats_json").$type<Record<string, unknown>>().notNull().default({}),
    isMvp: boolean("is_mvp").notNull().default(false),
    verified: boolean("verified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_player_match_stat").on(t.matchId, t.playerProfileId)]
);

export const tournamentMedia = pgTable("tournament_media", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  mediaType: text("media_type").notNull().default("IMAGE"), // IMAGE | PDF | SCORECARD_SCAN
  fileUrl: text("file_url").notNull(),
  uploadedBy: integer("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// 4. PROTHYMOS MULTI-SPORT STAGE AUCTION ENGINE (PHASE 2 SCHEMA READY)
// ============================================================================

export const auctions = pgTable("auctions", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").references(() => tournaments.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  seasonYear: integer("season_year").notNull(),
  status: text("status").notNull().default("DRAFT"), // DRAFT | REGISTRATION_OPEN | FROZEN | LIVE | COMPLETED | PUBLISHED
  registrationDeadline: timestamp("registration_deadline", { withTimezone: true }),
  clubBasePrice: integer("club_base_price").notNull().default(500),
  nonClubBasePrice: integer("non_club_base_price").notNull().default(200),
  sportBasePricesJson: jsonb("sport_base_prices_json")
    .$type<Record<string, { clubBasePrice: number; nonClubBasePrice: number }>>()
    .notNull()
    .default({}),
  defaultIncrement: integer("default_increment").notNull().default(100),
  jumpIncrement: integer("jump_increment").notNull().default(500),
  bidSlabsJson: jsonb("bid_slabs_json")
    .$type<Array<{ upTo: number | null; increment: number }>>()
    .notNull()
    .default([
      { upTo: 2000, increment: 100 },
      { upTo: 5000, increment: 250 },
      { upTo: null, increment: 500 },
    ]),
  activeSportId: integer("active_sport_id").references(() => sports.id, { onDelete: "set null" }),
  splitMode: text("split_mode").notNull().default("COMBINED"), // COMBINED | SEPARATE_BOYS_GIRLS
  activeTrack: text("active_track").notNull().default("COMBINED"), // COMBINED | BOYS | GIRLS
  activeRoundId: integer("active_round_id"),
  activePlayerId: integer("active_player_id"),
  projectorMode: text("projector_mode").notNull().default("STAGE"), // STAGE | SOLD | UNSOLD | STANDINGS | PAUSED
  projectorPaused: boolean("projector_paused").notNull().default(false),
  rtmEnabled: boolean("rtm_enabled").notNull().default(false),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auctionRounds = pgTable("auction_rounds", {
  id: serial("id").primaryKey(),
  auctionId: integer("auction_id")
    .notNull()
    .references(() => auctions.id, { onDelete: "cascade" }),
  sportId: integer("sport_id").references(() => sports.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  roundOrder: integer("round_order").notNull().default(1),
  roundType: text("round_type").notNull().default("MAIN"), // MAIN | ACCELERATED | UNSOLD | RTM
  active: boolean("active").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auctionFranchises = pgTable(
  "auction_franchises",
  {
    id: serial("id").primaryKey(),
    auctionId: integer("auction_id")
      .notNull()
      .references(() => auctions.id, { onDelete: "cascade" }),
    sportId: integer("sport_id")
      .notNull()
      .references(() => sports.id, { onDelete: "cascade" }),
    slotNumber: integer("slot_number").notNull(), // 1..8 for keyboard hotkeys
    track: text("track").notNull().default("COMBINED"), // COMBINED | BOYS | GIRLS
    name: text("name").notNull(),
    shortCode: text("short_code").notNull(),
    accentColor: text("accent_color").notNull().default("#D97706"),
    logoUrl: text("logo_url"),
    captainUserId: integer("captain_user_id").references(() => users.id, { onDelete: "set null" }),
    tournamentTeamId: integer("tournament_team_id").references(() => teams.id, { onDelete: "set null" }),
    startingPurse: integer("starting_purse").notNull().default(20000),
    remainingPurse: integer("remaining_purse").notNull().default(20000),
    minSquad: integer("min_squad").notNull().default(11),
    maxSquad: integer("max_squad").notNull().default(15),
    minClubQuota: integer("min_club_quota").notNull().default(3),
    minNonClubQuota: integer("min_non_club_quota").notNull().default(4),
    status: text("status").notNull().default("APPROVED"), // PENDING_APPROVAL | APPROVED | CHANGES_REQUESTED | REJECTED
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_auction_franchises_scope").on(t.auctionId, t.sportId, t.status)]
);

export const auctionTeamRegistrations = pgTable("auction_team_registrations", {
  id: serial("id").primaryKey(),
  auctionId: integer("auction_id")
    .notNull()
    .references(() => auctions.id, { onDelete: "cascade" }),
  sportId: integer("sport_id")
    .notNull()
    .references(() => sports.id, { onDelete: "cascade" }),
  submittedByUserId: integer("submitted_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  teamName: text("team_name").notNull(),
  shortCode: text("short_code").notNull(),
  track: text("track").notNull().default("COMBINED"), // COMBINED | BOYS | GIRLS
  accentColor: text("accent_color").notNull().default("#D97706"),
  captainUserId: integer("captain_user_id").references(() => users.id, { onDelete: "set null" }),
  memberUserIdsJson: jsonb("member_user_ids_json").$type<number[]>().notNull().default([]),
  rosterNotes: text("roster_notes"),
  status: text("status").notNull().default("PENDING_APPROVAL"), // PENDING_APPROVAL | APPROVED | CHANGES_REQUESTED | REJECTED
  franchiseId: integer("franchise_id").references(() => auctionFranchises.id, {
    onDelete: "set null",
  }),
  reviewedByUserId: integer("reviewed_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

export const auctionRegistrations = pgTable(
  "auction_registrations",
  {
    id: serial("id").primaryKey(),
    auctionId: integer("auction_id")
      .notNull()
      .references(() => auctions.id, { onDelete: "cascade" }),
    sportId: integer("sport_id")
      .notNull()
      .references(() => sports.id, { onDelete: "cascade" }),
    roundId: integer("round_id").references(() => auctionRounds.id, { onDelete: "set null" }),
    track: text("track").notNull().default("COMBINED"), // COMBINED | BOYS | GIRLS
    playerProfileId: integer("player_profile_id")
      .notNull()
      .references(() => playerProfiles.id, { onDelete: "cascade" }),
    positionsJson: jsonb("positions_json").$type<string[]>().notNull().default([]),
    playerClass: text("player_class").notNull().default("NON_CLUB"), // CLUB | NON_CLUB
    tier: text("tier").notNull().default("STANDARD"), // MARQUEE | TIER_1 | STANDARD
    basePrice: integer("base_price").notNull().default(200),
    experience: text("experience"),
    achievements: text("achievements"),
    photoUrl: text("photo_url"),
    status: text("status").notNull().default("ELIGIBLE"), // REGISTERED | ELIGIBLE | IN_AUCTION | SOLD | UNSOLD | INELIGIBLE
    soldFranchiseId: integer("sold_franchise_id").references(() => auctionFranchises.id, {
      onDelete: "set null",
    }),
    soldPrice: integer("sold_price"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_auction_sport_player").on(t.auctionId, t.sportId, t.playerProfileId),
    index("idx_auction_regs_scope").on(t.auctionId, t.sportId, t.status),
  ]
);

export const auctionPlayers = auctionRegistrations;

export const auctionBids = pgTable(
  "auction_bids",
  {
    id: serial("id").primaryKey(),
    auctionId: integer("auction_id")
      .notNull()
      .references(() => auctions.id, { onDelete: "cascade" }),
    sportId: integer("sport_id")
      .notNull()
      .references(() => sports.id, { onDelete: "cascade" }),
    auctionPlayerId: integer("auction_player_id")
      .notNull()
      .references(() => auctionRegistrations.id, { onDelete: "cascade" }),
    franchiseId: integer("franchise_id").references(() => auctionFranchises.id, {
      onDelete: "set null",
    }),
    amount: integer("amount").notNull(),
    bidType: text("bid_type").notNull(), // INCREMENT | JUMP | CUSTOM | RTM | SOLD | UNSOLD
    undone: boolean("undone").notNull().default(false),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_auction_bids_player_undone_id").on(t.auctionPlayerId, t.undone, t.id)]
);

export const rtmEligibility = pgTable("rtm_eligibility", {
  id: serial("id").primaryKey(),
  seasonYear: integer("season_year").notNull(),
  sportId: integer("sport_id")
    .notNull()
    .references(() => sports.id, { onDelete: "cascade" }),
  playerProfileId: integer("player_profile_id")
    .notNull()
    .references(() => playerProfiles.id, { onDelete: "cascade" }),
  previousFranchiseId: integer("previous_franchise_id").references(() => auctionFranchises.id, {
    onDelete: "set null",
  }),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const captainWatchlists = pgTable(
  "captain_watchlists",
  {
    id: serial("id").primaryKey(),
    franchiseId: integer("franchise_id")
      .notNull()
      .references(() => auctionFranchises.id, { onDelete: "cascade" }),
    auctionPlayerId: integer("auction_player_id")
      .notNull()
      .references(() => auctionRegistrations.id, { onDelete: "cascade" }),
    priorityNote: text("priority_note"),
    maxTargetBid: integer("max_target_bid"),
  },
  (t) => [uniqueIndex("uq_watchlist_entry").on(t.franchiseId, t.auctionPlayerId)]
);

// ============================================================================
// 5. CAMPUS FACILITIES, QR EQUIPMENT & COMMUNITY (PHASE 3 SCHEMA READY)
// ============================================================================

export const facilities = pgTable("facilities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  sportId: integer("sport_id").references(() => sports.id, { onDelete: "set null" }),
  status: text("status").notNull().default("OPEN"), // OPEN | OCCUPIED | CLOSED | MAINTENANCE | WEATHER_CLOSURE
  location: text("location"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const facilityConfig = pgTable("facility_config", {
  id: serial("id").primaryKey(),
  facilityId: integer("facility_id")
    .notNull()
    .unique()
    .references(() => facilities.id, { onDelete: "cascade" }),
  bookingMode: text("booking_mode").notNull().default("DIRECT_BOOKING"), // DIRECT_BOOKING | APPROVAL_REQUIRED | STAFF_MANAGED | CAPACITY_BASED
  maxCapacity: integer("max_capacity").notNull().default(1),
  slotDurationMins: integer("slot_duration_mins").notNull().default(60),
  dailyUserLimit: integer("daily_user_limit").notNull().default(1),
  noShowBanHours: integer("no_show_ban_hours").notNull().default(48),
});

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  facilityId: integer("facility_id")
    .notNull()
    .references(() => facilities.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  clubId: integer("club_id").references(() => sportsClubs.id, { onDelete: "set null" }),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("APPROVED"), // PENDING_APPROVAL | APPROVED | REJECTED | CHECKED_IN | COMPLETED | CANCELLED | NO_SHOW
  notes: text("notes"),
  approvedBy: integer("approved_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const equipment = pgTable("equipment", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sportId: integer("sport_id").references(() => sports.id, { onDelete: "set null" }),
  itemType: text("item_type").notNull().default("TRACKED_ASSET"), // TRACKED_ASSET | BULK_CONSUMABLE
  qrCode: text("qr_code").unique(),
  totalQty: integer("total_qty").notNull().default(1),
  availableQty: integer("available_qty").notNull().default(1),
  condition: text("condition").notNull().default("AVAILABLE"), // AVAILABLE | ISSUED | DAMAGED | LOST | MAINTENANCE
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const equipmentTransactions = pgTable("equipment_transactions", {
  id: serial("id").primaryKey(),
  equipmentId: integer("equipment_id")
    .notNull()
    .references(() => equipment.id, { onDelete: "cascade" }),
  borrowerUserId: integer("borrower_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  issuedBy: integer("issued_by").references(() => users.id, { onDelete: "set null" }),
  qty: integer("qty").notNull().default(1),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  returnedAt: timestamp("returned_at", { withTimezone: true }),
  returnCondition: text("return_condition"),
  notes: text("notes"),
});

export const pickupGames = pgTable("pickup_games", {
  id: serial("id").primaryKey(),
  hostUserId: integer("host_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  sportId: integer("sport_id")
    .notNull()
    .references(() => sports.id, { onDelete: "cascade" }),
  venue: text("venue").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  maxPlayers: integer("max_players").notNull(),
  skillLevel: text("skill_level").notNull().default("OPEN"),
  preferredPosition: text("preferred_position"),
  requiresApproval: boolean("requires_approval").notNull().default(false),
  status: text("status").notNull().default("OPEN"), // OPEN | FULL | EXPIRED | CANCELLED
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pickupParticipants = pgTable(
  "pickup_participants",
  {
    id: serial("id").primaryKey(),
    pickupGameId: integer("pickup_game_id")
      .notNull()
      .references(() => pickupGames.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("JOINED"), // JOINED | WAITLISTED | PENDING
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_pickup_user").on(t.pickupGameId, t.userId)]
);

export const batchHostelPoints = pgTable("batch_hostel_points", {
  id: serial("id").primaryKey(),
  academicYear: integer("academic_year").notNull(),
  entityType: text("entity_type").notNull(), // BATCH | HOSTEL
  entityName: text("entity_name").notNull(),
  goldMedals: integer("gold_medals").notNull().default(0),
  silverMedals: integer("silver_medals").notNull().default(0),
  bronzeMedals: integer("bronze_medals").notNull().default(0),
  totalPoints: integer("total_points").notNull().default(0),
});

export const fantasyLeagues = pgTable("fantasy_leagues", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  budgetLimit: integer("budget_limit").notNull().default(100),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const fantasyEntries = pgTable("fantasy_entries", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id")
    .notNull()
    .references(() => fantasyLeagues.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  selectedPlayerIds: jsonb("selected_player_ids").$type<number[]>().notNull().default([]),
  captainPlayerId: integer("captain_player_id"),
  totalPoints: doublePrecision("total_points").notNull().default(0),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
});

export const interIiitTrials = pgTable("inter_iiit_trials", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  sportId: integer("sport_id")
    .notNull()
    .references(() => sports.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  venue: text("venue").notNull(),
  eligibilityNotes: text("eligibility_notes"),
  status: text("status").notNull().default("OPEN"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contingents = pgTable("contingents", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  sportId: integer("sport_id")
    .notNull()
    .references(() => sports.id, { onDelete: "cascade" }),
  hostInstitute: text("host_institute").notNull(),
  status: text("status").notNull().default("TRIALS"), // TRIALS | SHORTLISTED | FACULTY_APPROVED | COMPLETED
  approvedByFacultyId: integer("approved_by_faculty_id").references(() => users.id, {
    onDelete: "set null",
  }),
  travelDetails: text("travel_details"),
  accommodationDetails: text("accommodation_details"),
  medalResult: text("medal_result"),
  rosterJson: jsonb("roster_json").$type<number[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// 6. NOTICES, NOTIFICATIONS, SITE SETTINGS & AUDIT LOGS
// ============================================================================

export const announcements = pgTable(
  "announcements",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    isUrgentBanner: boolean("is_urgent_banner").notNull().default(false), // If true, title MUST be <= 5 words
    active: boolean("active").notNull().default(true),
    clubId: integer("club_id").references(() => sportsClubs.id, { onDelete: "cascade" }),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_announcements_active_urgent").on(t.active, t.isUrgentBanner)]
);

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    message: text("message").notNull(),
    linkUrl: text("link_url"),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_notifications_user_read").on(t.userId, t.isRead)]
);

export const siteSettings = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  valueJson: jsonb("value_json").$type<unknown>().notNull(),
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    actorUserId: integer("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_audit_entity").on(t.entityType, t.entityId)]
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: serial("id").primaryKey(),
    scope: text("scope").notNull(),
    key: text("key").notNull(),
    actorUserId: integer("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    statusCode: integer("status_code").notNull(),
    responseJson: jsonb("response_json").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_idempotency_scope_key").on(t.scope, t.key)]
);
