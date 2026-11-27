import "dotenv/config";
import { and, eq, ne, sql } from "drizzle-orm";
import { db, pool } from "./index.ts";
import {
  users,
  playerProfiles,
  roles,
  userRoles,
  sports,
  sportsClubs,
  clubMemberships,
  clubActivities,
  tournaments,
  tournamentSports,
  teams,
  teamRosters,
  standings,
  matches,
  matchEvents,
  playerMatchStats,
  announcements,
  notifications,
  siteSettings,
  facilities,
  facilityConfig,
  equipment,
  auctions,
  auctionRounds,
  auctionFranchises,
  auctionRegistrations,
  auctionTeamRegistrations,
  auctionBids,
  rtmEligibility,
  captainWatchlists,
} from "./schema.ts";

export async function resetDatabase() {
  console.log("[SEED] Resetting PostgreSQL tables...");
  await db.execute(sql`
    TRUNCATE TABLE
      idempotency_keys,
      audit_logs,
      notifications,
      announcements,
      site_settings,
      captain_watchlists,
      rtm_eligibility,
      auction_bids,
      auction_team_registrations,
      auction_registrations,
      auction_franchises,
      auction_rounds,
      auctions,
      fantasy_entries,
      fantasy_leagues,
      batch_hostel_points,
      pickup_participants,
      pickup_games,
      equipment_transactions,
      equipment,
      bookings,
      facility_config,
      facilities,
      inter_iiit_trials,
      contingents,
      tournament_media,
      player_match_stats,
      match_events,
      matches,
      standings,
      team_rosters,
      teams,
      tournament_sports,
      tournaments,
      club_activities,
      club_memberships,
      sports_clubs,
      sports,
      role_requests,
      user_roles,
      roles,
      player_profiles,
      users
    RESTART IDENTITY CASCADE
  `);
}

async function seedProthymosAuctionIfMissing() {
  const existingAuctions = await db.select().from(auctions).limit(1);
  if (existingAuctions.length > 0) return;

  const allSports = await db.select().from(sports);
  const sportBySlug = Object.fromEntries(allSports.map((s) => [s.slug, s]));
  const allUsers = await db.select().from(users);
  const userByEmail = Object.fromEntries(allUsers.map((u) => [u.email, u]));
  const allProfiles = await db.select().from(playerProfiles);
  const profileByUserId = Object.fromEntries(
    allProfiles.filter((p) => p.userId !== null).map((p) => [p.userId!, p])
  );
  const allClubs = await db.select().from(sportsClubs);
  const clubBySportId = Object.fromEntries(allClubs.map((c) => [c.sportId, c]));
  const inductedRows = await db
    .select()
    .from(clubMemberships)
    .where(eq(clubMemberships.status, "INDUCTED"));

  const [prothymosTournament] = await db
    .select()
    .from(tournaments)
    .where(
      and(
        eq(tournaments.tournamentType, "PROTHYMOS"),
        ne(tournaments.status, "ARCHIVED")
      )
    )
    .limit(1);

  let targetTournament = prothymosTournament;
  if (!targetTournament) {
    const [createdT] = await db
      .insert(tournaments)
      .values({
        name: "Prothymos 2027 — Multi-Sport Franchise Championship",
        academicYear: 2027,
        semester: "EVEN",
        tournamentType: "PROTHYMOS",
        format: "GROUP_KNOCKOUT",
        rosterMode: "AUCTION",
        status: "UPCOMING",
        completenessStatus: "COMPLETE",
        isCurrent: false,
        startsAt: new Date("2027-02-14T09:00:00Z"),
        endsAt: new Date("2027-03-02T18:00:00Z"),
        description: "Annual Prothymos inter-franchise tournament drafted via live multi-sport stage auction.",
      })
      .returning();
    targetTournament = createdT;
  }

  const cricketId = sportBySlug["cricket"].id;
  const footballId = sportBySlug["football"].id;
  const badmintonId = sportBySlug["badminton"].id;

  const [auction] = await db
    .insert(auctions)
    .values({
      tournamentId: targetTournament.id,
      name: "Prothymos 2027 Multi-Sport Player Auction",
      seasonYear: 2027,
      status: "REGISTRATION_OPEN",
      registrationDeadline: new Date(Date.now() + 14 * 86400000),
      clubBasePrice: 500,
      nonClubBasePrice: 200,
      sportBasePricesJson: {
        [String(cricketId)]: { clubBasePrice: 600, nonClubBasePrice: 250 },
        [String(footballId)]: { clubBasePrice: 500, nonClubBasePrice: 200 },
        [String(badmintonId)]: { clubBasePrice: 400, nonClubBasePrice: 150 },
      },
      defaultIncrement: 100,
      jumpIncrement: 500,
      activeSportId: cricketId,
      projectorMode: "STAGE",
      rtmEnabled: true,
    })
    .returning();

  const [r1, r2, r3] = await db
    .insert(auctionRounds)
    .values([
      { auctionId: auction.id, name: "Round 1 — Main Pool", roundOrder: 1, roundType: "MAIN", active: true },
      { auctionId: auction.id, name: "Round 2 — Accelerated / Unsold", roundOrder: 2, roundType: "UNSOLD", active: false },
      { auctionId: auction.id, name: "Round 3 — RTM / Final", roundOrder: 3, roundType: "RTM", active: false },
    ])
    .returning();

  await db.update(auctions).set({ activeRoundId: r1.id }).where(eq(auctions.id, auction.id));

  const vikram = userByEmail["221114@iiitt.ac.in"];
  const devansh = userByEmail["221130@iiitt.ac.in"];
  const priya = userByEmail["231108@iiitt.ac.in"];
  const rohan = userByEmail["231122@iiitt.ac.in"];
  const ananya = userByEmail["241105@iiitt.ac.in"];
  const arjun = userByEmail["231145@iiitt.ac.in"];
  const kabir = userByEmail["251119@iiitt.ac.in"];
  const meera = userByEmail["241142@iiitt.ac.in"];
  const nikhil = userByEmail["231161@iiitt.ac.in"];
  const tanvi = userByEmail["241177@iiitt.ac.in"];
  const ishaan = userByEmail["251104@iiitt.ac.in"];
  const riya = userByEmail["241188@iiitt.ac.in"];

  const franchiseSeeds = [
    // Cricket (4 Franchises)
    { auctionId: auction.id, sportId: cricketId, slotNumber: 1, name: "Trichy Titans", shortCode: "TTN", accentColor: "#B91C1C", captainUserId: vikram.id, startingPurse: 20000, remainingPurse: 18500, minSquad: 11, maxSquad: 15, minClubQuota: 3, minNonClubQuota: 4 },
    { auctionId: auction.id, sportId: cricketId, slotNumber: 2, name: "Cauvery Chargers", shortCode: "CCG", accentColor: "#D97706", captainUserId: arjun.id, startingPurse: 20000, remainingPurse: 18800, minSquad: 11, maxSquad: 15, minClubQuota: 3, minNonClubQuota: 4 },
    { auctionId: auction.id, sportId: cricketId, slotNumber: 3, name: "Bhavani Blasters", shortCode: "BBL", accentColor: "#2563EB", captainUserId: meera.id, startingPurse: 20000, remainingPurse: 20000, minSquad: 11, maxSquad: 15, minClubQuota: 3, minNonClubQuota: 4 },
    { auctionId: auction.id, sportId: cricketId, slotNumber: 4, name: "Vaigai Warriors", shortCode: "VGW", accentColor: "#059669", captainUserId: nikhil.id, startingPurse: 20000, remainingPurse: 20000, minSquad: 11, maxSquad: 15, minClubQuota: 3, minNonClubQuota: 4 },
    // Football (4 Franchises - completely separate purses & squads)
    { auctionId: auction.id, sportId: footballId, slotNumber: 1, name: "Trichy Strikers FC", shortCode: "TSF", accentColor: "#DC2626", captainUserId: devansh.id, startingPurse: 16000, remainingPurse: 16000, minSquad: 7, maxSquad: 12, minClubQuota: 2, minNonClubQuota: 3 },
    { auctionId: auction.id, sportId: footballId, slotNumber: 2, name: "Kaveri United", shortCode: "KUN", accentColor: "#F59E0B", captainUserId: arjun.id, startingPurse: 16000, remainingPurse: 16000, minSquad: 7, maxSquad: 12, minClubQuota: 2, minNonClubQuota: 3 },
    { auctionId: auction.id, sportId: footballId, slotNumber: 3, name: "Maratha Rovers", shortCode: "MRV", accentColor: "#7C3AED", captainUserId: ananya.id, startingPurse: 16000, remainingPurse: 16000, minSquad: 7, maxSquad: 12, minClubQuota: 2, minNonClubQuota: 3 },
    { auctionId: auction.id, sportId: footballId, slotNumber: 4, name: "Deccan Dynamos", shortCode: "DDN", accentColor: "#0D9488", captainUserId: rohan.id, startingPurse: 16000, remainingPurse: 16000, minSquad: 7, maxSquad: 12, minClubQuota: 2, minNonClubQuota: 3 },
    // Badminton (4 Franchises)
    { auctionId: auction.id, sportId: badmintonId, slotNumber: 1, name: "Shuttle Kings", shortCode: "SKG", accentColor: "#E11D48", captainUserId: priya.id, startingPurse: 10000, remainingPurse: 10000, minSquad: 4, maxSquad: 8, minClubQuota: 1, minNonClubQuota: 1 },
    { auctionId: auction.id, sportId: badmintonId, slotNumber: 2, name: "Apex Smashers", shortCode: "APS", accentColor: "#D97706", captainUserId: tanvi.id, startingPurse: 10000, remainingPurse: 10000, minSquad: 4, maxSquad: 8, minClubQuota: 1, minNonClubQuota: 1 },
    { auctionId: auction.id, sportId: badmintonId, slotNumber: 3, name: "Net Ninjas", shortCode: "NTN", accentColor: "#0284C7", captainUserId: meera.id, startingPurse: 10000, remainingPurse: 10000, minSquad: 4, maxSquad: 8, minClubQuota: 1, minNonClubQuota: 1 },
    { auctionId: auction.id, sportId: badmintonId, slotNumber: 4, name: "DropShot Aces", shortCode: "DSA", accentColor: "#16A34A", captainUserId: vikram.id, startingPurse: 10000, remainingPurse: 10000, minSquad: 4, maxSquad: 8, minClubQuota: 1, minNonClubQuota: 1 },
  ];

  const insertedFranchises = await db.insert(auctionFranchises).values(franchiseSeeds).returning();
  const cricFranchise1 = insertedFranchises.find((f) => f.sportId === cricketId && f.slotNumber === 1)!;
  const cricFranchise2 = insertedFranchises.find((f) => f.sportId === cricketId && f.slotNumber === 2)!;

  if (arjun) {
    await db
      .update(userRoles)
      .set({ auctionId: auction.id })
      .where(and(eq(userRoles.userId, arjun.id), eq(userRoles.roleCode, "AUCTION_OPERATOR")));
  }

  const isClubForSport = (u: typeof vikram, sId: number) => {
    const prof = profileByUserId[u.id];
    const club = clubBySportId[sId];
    if (!prof || !club) return false;
    return inductedRows.some((m) => m.clubId === club.id && m.playerProfileId === prof.id);
  };

  const makeReg = (
    u: typeof vikram,
    sId: number,
    positions: string[],
    tier: "MARQUEE" | "TIER_1" | "STANDARD",
    experience: string,
    roundId: number,
    overrides?: {
      status?: "ELIGIBLE" | "SOLD" | "UNSOLD";
      soldFranchiseId?: number | null;
      soldPrice?: number | null;
    }
  ) => {
    const clubFlag = isClubForSport(u, sId);
    const base =
      sId === cricketId
        ? clubFlag
          ? 600
          : 250
        : sId === footballId
        ? clubFlag
          ? 500
          : 200
        : clubFlag
        ? 400
        : 150;
    return {
      auctionId: auction.id,
      sportId: sId,
      roundId,
      playerProfileId: profileByUserId[u.id].id,
      positionsJson: positions,
      playerClass: clubFlag ? "CLUB" : "NON_CLUB",
      tier,
      basePrice: base,
      experience,
      status: overrides?.status ?? "ELIGIBLE",
      soldFranchiseId: overrides?.soldFranchiseId ?? null,
      soldPrice: overrides?.soldPrice ?? null,
    };
  };

  const regSeeds = [
    makeReg(vikram, cricketId, ["All-Rounder", "Captain"], "MARQUEE", "IIITT Cricket Club Secretary, 2025 Runners-up", r1.id),
    makeReg(rohan, cricketId, ["Bowler", "All-Rounder"], "TIER_1", "Lead pacer, 3rd Year Coordinator", r1.id),
    makeReg(ananya, cricketId, ["Batsman", "Wicketkeeper"], "TIER_1", "2nd Year Cricket Coordinator", r1.id, { status: "SOLD", soldFranchiseId: cricFranchise2.id, soldPrice: 1200 }),
    makeReg(devansh, cricketId, ["Batsman"], "STANDARD", "Middle-order anchor", r1.id, { status: "SOLD", soldFranchiseId: cricFranchise1.id, soldPrice: 1500 }),
    makeReg(kabir, cricketId, ["Batsman", "Fielder"], "STANDARD", "1st Year inducted prospect (NON_CLUB)", r1.id),
    makeReg(ishaan, cricketId, ["Bowler"], "STANDARD", "1st Year pace prospect (NON_CLUB)", r2.id, { status: "UNSOLD" }),
    makeReg(arjun, cricketId, ["Bowler", "All-Rounder"], "MARQUEE", "Death overs specialist (NON_CLUB)", r1.id),
    ...(riya ? [makeReg(riya, cricketId, ["Batsman", "Fielder"], "STANDARD", "Intra-hostel opener (NON_CLUB)", r1.id)] : []),
    makeReg(devansh, footballId, ["Striker", "Winger"], "MARQUEE", "Football Club Secretary & Golden Boot contender", r1.id),
    makeReg(ananya, footballId, ["Midfielder", "Winger"], "TIER_1", "Inducted Football Club midfielder", r1.id),
    makeReg(arjun, footballId, ["Defender"], "TIER_1", "3rd Year Football Coordinator", r1.id),
    makeReg(kabir, footballId, ["Goalkeeper", "Defender"], "STANDARD", "Hostel League keeper (NON_CLUB)", r1.id),
    makeReg(priya, badmintonId, ["Singles", "Mixed Doubles"], "MARQUEE", "Badminton Club Secretary", r1.id),
    makeReg(tanvi, badmintonId, ["Doubles", "Mixed Doubles"], "TIER_1", "2nd Year Badminton Coordinator", r1.id),
    makeReg(meera, badmintonId, ["Singles"], "STANDARD", "Intra-campus quarterfinalist (NON_CLUB)", r1.id),
    ...(riya ? [makeReg(riya, badmintonId, ["Singles", "Doubles"], "STANDARD", "2nd Year indoor open semi-finalist (NON_CLUB)", r1.id)] : []),
  ];

  const insertedRegs = await db.insert(auctionRegistrations).values(regSeeds).returning();
  const soldDevansh = insertedRegs.find(
    (r) => r.sportId === cricketId && r.playerProfileId === profileByUserId[devansh.id].id
  );
  const soldAnanya = insertedRegs.find(
    (r) => r.sportId === cricketId && r.playerProfileId === profileByUserId[ananya.id].id
  );
  if (soldDevansh && soldAnanya) {
    await db.insert(auctionBids).values([
      {
        auctionId: auction.id,
        sportId: cricketId,
        auctionPlayerId: soldDevansh.id,
        franchiseId: cricFranchise1.id,
        amount: 1500,
        bidType: "SOLD",
        idempotencyKey: "seed-cric-devansh-sold",
        createdBy: arjun?.id ?? vikram.id,
      },
      {
        auctionId: auction.id,
        sportId: cricketId,
        auctionPlayerId: soldAnanya.id,
        franchiseId: cricFranchise2.id,
        amount: 1200,
        bidType: "SOLD",
        idempotencyKey: "seed-cric-ananya-sold",
        createdBy: arjun?.id ?? vikram.id,
      },
    ]);
  }
  const rohanCricReg = insertedRegs.find(
    (r) => r.sportId === cricketId && r.playerProfileId === profileByUserId[rohan.id].id
  );
  if (rohanCricReg) {
    await db.insert(rtmEligibility).values({
      seasonYear: 2027,
      sportId: cricketId,
      playerProfileId: rohanCricReg.playerProfileId,
      previousFranchiseId: cricFranchise1.id,
      used: false,
    });
    await db.insert(captainWatchlists).values({
      franchiseId: cricFranchise1.id,
      auctionPlayerId: rohanCricReg.id,
      priorityNote: "Top death-bowling target for TTN",
      maxTargetBid: 3000,
    });
  }

  await db.insert(auctionTeamRegistrations).values({
    auctionId: auction.id,
    sportId: cricketId,
    submittedByUserId: kabir.id,
    teamName: "Godavari Gladiators",
    shortCode: "GGL",
    accentColor: "#0EA5E9",
    captainUserId: kabir.id,
    memberUserIdsJson: [kabir.id, ishaan.id],
    rosterNotes: "1st-year & hostel challenger franchise awaiting Sports Secretary approval.",
    status: "PENDING_APPROVAL",
  });

  console.log("[SEED] Prothymos 2027 Multi-Sport Auction seeded!");
}

export async function runSeed(options?: { reset?: boolean }) {
  if (options?.reset) {
    await resetDatabase();
  }
  console.log("[SEED] Starting idempotent IIITT Sports database seed...");

  // Guard: if sports already seeded, still ensure Prothymos auction seed exists idempotently
  const existingSports = await db.select().from(sports);
  if (existingSports.length >= 9) {
    await seedProthymosAuctionIfMissing();
    console.log("[SEED] Database already seeded. Skipping core reset.");
    return;
  }

  // 1. Roles
  const roleSeeds = [
    { code: "SUPER_ADMIN", label: "System Owner (Tech Only)", level: 5, description: "Platform infrastructure & recovery only; no sports authority." },
    { code: "FACULTY_ADVISOR", label: "Faculty Advisor / PED", level: 4, description: "Highest institute sports authority." },
    { code: "SPORTS_SECRETARY", label: "Sports Secretary", level: 3, description: "Institute student sports head." },
    { code: "EQUIPMENT_STAFF", label: "Equipment & Ground Staff", level: 2, description: "Campus equipment QR desk & facility approvals." },
    { code: "CLUB_SECRETARY", label: "Club Secretary", level: 2, description: "Heads one official sports club." },
    { code: "CLUB_COORDINATOR", label: "Club Coordinator", level: 2, description: "Batch-scoped club induction & activity coordinator." },
    { code: "CAPTAIN", label: "Team Captain", level: 2, description: "Submits team rosters & match Playing XI." },
    { code: "AUCTION_OPERATOR", label: "Auction Operator", level: 2, description: "Stage console operator for Prothymos." },
    { code: "MATCH_SCORER", label: "Match Scorer", level: 2, description: "Assigned live match scorer (/scorer)." },
    { code: "TOURNAMENT_MANAGER", label: "Tournament Manager", level: 2, description: "Assists with fixture logistics." },
    { code: "CLUB_MEMBER", label: "Inducted Club Member", level: 1, description: "Verified official sports club member." },
    { code: "STUDENT", label: "IIITT Student", level: 1, description: "Authenticated @iiitt.ac.in student." },
  ];
  await db.insert(roles).values(roleSeeds).onConflictDoNothing();

  // 2. All 9 Official IIITT Sports + Throwball
  const sportSeeds = [
    { slug: "football", name: "Football", category: "OUTDOOR_TEAM", isOfficialClub: true, displayOrder: 1 },
    { slug: "cricket", name: "Cricket", category: "OUTDOOR_TEAM", isOfficialClub: true, displayOrder: 2 },
    { slug: "volleyball", name: "Volleyball", category: "OUTDOOR_TEAM", isOfficialClub: true, displayOrder: 3 },
    { slug: "kho_kho", name: "Kho Kho", category: "OUTDOOR_TEAM", isOfficialClub: true, displayOrder: 4 },
    { slug: "kabaddi", name: "Kabaddi", category: "OUTDOOR_TEAM", isOfficialClub: true, displayOrder: 5 },
    { slug: "badminton", name: "Badminton", category: "INDOOR", isOfficialClub: true, displayOrder: 6 },
    { slug: "table_tennis", name: "Table Tennis", category: "INDOOR", isOfficialClub: true, displayOrder: 7 },
    { slug: "carrom", name: "Carrom", category: "INDOOR", isOfficialClub: true, displayOrder: 8 },
    { slug: "chess", name: "Chess", category: "INDOOR", isOfficialClub: true, displayOrder: 9 },
    { slug: "throwball", name: "Throwball", category: "OUTDOOR_TEAM", isOfficialClub: false, displayOrder: 10 },
  ];
  const insertedSports = await db.insert(sports).values(sportSeeds).returning();
  const sportBySlug = Object.fromEntries(insertedSports.map((s) => [s.slug, s]));

  // 3. Official 9 Sports Clubs
  const clubDescriptions: Record<string, { tagline: string; desc: string; schedule: string }> = {
    football: {
      tagline: "Relentless grit under the main ground floodlights.",
      desc: "Official IIITT Football Club representing the institute at Inter-IIIT and Trichy collegiate tournaments.",
      schedule: "Mon / Wed / Fri • 5:30 PM – 7:30 PM • Main Ground",
    },
    cricket: {
      tagline: "Precision pace, disciplined spin, and championship temperament.",
      desc: "Official IIITT Cricket Club managing turf nets, Inter-IIIT selection camps, and campus leagues.",
      schedule: "Tue / Thu / Sat • 6:00 AM – 8:00 AM • Cricket Nets & Ground",
    },
    volleyball: {
      tagline: "High flyers, iron blocks, and razor-sharp rotations.",
      desc: "Official IIITT Volleyball Club hosting evening floodlit drills and open scrimmages.",
      schedule: "Daily • 5:45 PM – 7:45 PM • Volleyball Court",
    },
    kho_kho: {
      tagline: "Pure speed, split-second dives, and relentless chase.",
      desc: "Official IIITT Kho Kho Club training sprint agility and pole-turn mechanics.",
      schedule: "Tue / Thu • 5:30 PM – 7:00 PM • Clay Court",
    },
    kabaddi: {
      tagline: "Hold the line. Break the raid.",
      desc: "Official IIITT Kabaddi Club building explosive mat raids and ankle-hold defense.",
      schedule: "Mon / Wed / Sat • 6:00 PM – 7:45 PM • Kabaddi Arena",
    },
    badminton: {
      tagline: "Featherlight deception at blistering pace.",
      desc: "Official IIITT Badminton Club running indoor shuttle sessions, ladder rankings, and Inter-IIIT trials.",
      schedule: "Mon–Fri • 6:00 PM – 8:30 PM • Indoor Sports Complex",
    },
    table_tennis: {
      tagline: "Spin, reflex, and millimeter precision.",
      desc: "Official IIITT Table Tennis Club with multi-table evening drills and singles/doubles ladders.",
      schedule: "Daily • 5:30 PM – 8:30 PM • TT Hall",
    },
    carrom: {
      tagline: "Steady hand, clean break, pocket the Queen.",
      desc: "Official IIITT Carrom Club hosting singles & doubles board championships.",
      schedule: "Wed / Fri / Sun • 7:00 PM – 9:00 PM • Student Activity Center",
    },
    chess: {
      tagline: "Sixty-four squares. Zero mercy.",
      desc: "Official IIITT Chess Club running FIDE-style rapid Swiss opens, blitz nights, and Inter-IIIT prep.",
      schedule: "Tue / Fri • 7:30 PM – 9:30 PM • Academic Seminar Hall 2",
    },
  };

  const clubRows = insertedSports
    .filter((s) => s.isOfficialClub)
    .map((s) => ({
      sportId: s.id,
      slug: s.slug,
      name: `IIITT ${s.name} Club`,
      tagline: clubDescriptions[s.slug].tagline,
      description: clubDescriptions[s.slug].desc,
      bannerUrl: `/images/clubs/${s.slug}.webp`,
      practiceSchedule: clubDescriptions[s.slug].schedule,
      inductionOpen: ["cricket", "football", "badminton", "kabaddi", "chess"].includes(s.slug),
    }));
  const insertedClubs = await db.insert(sportsClubs).values(clubRows).returning();
  const clubBySlug = Object.fromEntries(insertedClubs.map((c) => [c.slug, c]));

  // 4. Users & Player Profiles
  const userSeeds = [
    { email: "faculty.ped@iiitt.ac.in", name: "Dr. R. Karthikeyan", rollNumber: "PED-01", batch: "FACULTY", hostel: "Faculty Quarters", qrCodeToken: "IIITT-QR-FAC-01", accountType: "FACULTY", onboardingComplete: true },
    { email: "221101@iiitt.ac.in", name: "Aarav Sharma", rollNumber: "221101", batch: "4TH", hostel: "Cauvery Hostel", qrCodeToken: "IIITT-QR-221101", accountType: "STUDENT", onboardingComplete: true },
    { email: "staff.grounds@iiitt.ac.in", name: "S. Murugan", rollNumber: "STF-02", batch: "STAFF", hostel: "Staff Quarters", qrCodeToken: "IIITT-QR-STF-02", accountType: "STAFF", onboardingComplete: true },
    { email: "221114@iiitt.ac.in", name: "Vikram Nair", rollNumber: "221114", batch: "4TH", hostel: "Cauvery Hostel", qrCodeToken: "IIITT-QR-221114", accountType: "STUDENT", onboardingComplete: true },
    { email: "231108@iiitt.ac.in", name: "Priya Menon", rollNumber: "231108", batch: "3RD", hostel: "Vaigai Hostel", qrCodeToken: "IIITT-QR-231108", accountType: "STUDENT", onboardingComplete: true },
    { email: "231122@iiitt.ac.in", name: "Rohan Deshmukh", rollNumber: "231122", batch: "3RD", hostel: "Bhavani Hostel", qrCodeToken: "IIITT-QR-231122", accountType: "STUDENT", onboardingComplete: true },
    { email: "241105@iiitt.ac.in", name: "Ananya Iyer", rollNumber: "241105", batch: "2ND", hostel: "Vaigai Hostel", qrCodeToken: "IIITT-QR-241105", accountType: "STUDENT", onboardingComplete: true },
    { email: "251119@iiitt.ac.in", name: "Kabir Verma", rollNumber: "251119", batch: "1ST", hostel: "Amaravathi Hostel", qrCodeToken: "IIITT-QR-251119", accountType: "STUDENT", onboardingComplete: true },
    { email: "241142@iiitt.ac.in", name: "Meera Krishnan", rollNumber: "241142", batch: "2ND", hostel: "Vaigai Hostel", qrCodeToken: "IIITT-QR-241142", accountType: "STUDENT", onboardingComplete: true },
    { email: "231145@iiitt.ac.in", name: "Arjun Reddy", rollNumber: "231145", batch: "3RD", hostel: "Bhavani Hostel", qrCodeToken: "IIITT-QR-231145", accountType: "STUDENT", onboardingComplete: true },
    { email: "221130@iiitt.ac.in", name: "Devansh Patel", rollNumber: "221130", batch: "4TH", hostel: "Cauvery Hostel", qrCodeToken: "IIITT-QR-221130", accountType: "STUDENT", onboardingComplete: true },
    { email: "231161@iiitt.ac.in", name: "Nikhil Joshi", rollNumber: "231161", batch: "3RD", hostel: "Bhavani Hostel", qrCodeToken: "IIITT-QR-231161", accountType: "STUDENT", onboardingComplete: true },
    { email: "241177@iiitt.ac.in", name: "Tanvi Kulkarni", rollNumber: "241177", batch: "2ND", hostel: "Vaigai Hostel", qrCodeToken: "IIITT-QR-241177", accountType: "STUDENT", onboardingComplete: true },
    { email: "251104@iiitt.ac.in", name: "Ishaan Roy", rollNumber: "251104", batch: "1ST", hostel: "Amaravathi Hostel", qrCodeToken: "IIITT-QR-251104", accountType: "STUDENT", onboardingComplete: true },
    { email: "241188@iiitt.ac.in", name: "Riya Nair", rollNumber: "241188", batch: "2ND", hostel: "Vaigai Hostel", qrCodeToken: "IIITT-QR-241188", accountType: "STUDENT", onboardingComplete: true },
    { email: "raju@iiitt.ac.in", name: "raju", rollNumber: "241199", batch: "2ND", hostel: "Bhavani Hostel", qrCodeToken: "IIITT-QR-241199", accountType: "STUDENT", onboardingComplete: true },
    { email: "sysadmin@iiitt.ac.in", name: "System Administrator", rollNumber: "SYS-01", batch: "STAFF", hostel: null, qrCodeToken: "IIITT-QR-SYS-01", accountType: "SYSTEM", onboardingComplete: true },
  ];
  const insertedUsers = await db.insert(users).values(userSeeds).returning();
  const userByEmail = Object.fromEntries(insertedUsers.map((u) => [u.email, u]));

  const branches = ["CSE", "ECE", "CSE", "ECE", "CSE", "ECE", "CSE", "CSE", "ECE", "ME", "CSE", "ECE", "CSE", "ECE", "ECE", "CSE", "SYS"];
  const profileSeeds = insertedUsers.map((u, i) => ({
    userId: u.id,
    displayName: u.name,
    batch: u.batch,
    branch: branches[i] ?? "CSE",
    rollNumber: u.rollNumber,
    bio: u.accountType === "STUDENT" ? "IIITT Varsity & Intra-Campus Competitor" : u.name,
    visibility: "PUBLIC",
    isClaimed: true,
    preferredSports: i % 2 === 0 ? ["cricket", "badminton"] : ["football", "volleyball"],
  }));

  // Add 2 Unclaimed Alumni Profiles for Sports Archive history
  const insertedProfiles = await db
    .insert(playerProfiles)
    .values([
      ...profileSeeds,
      {
        userId: null,
        displayName: "Siddharth Rao",
        batch: "2023",
        branch: "CSE",
        rollNumber: "191103",
        bio: "2023 Inter-IIIT Cricket Captain & Archive MVP",
        visibility: "PUBLIC",
        isClaimed: false,
        preferredSports: ["cricket"],
      },
      {
        userId: null,
        displayName: "Arvind Swamy",
        batch: "2024",
        branch: "ECE",
        rollNumber: "201109",
        bio: "2024 Flagship Golden Boot Striker",
        visibility: "PUBLIC",
        isClaimed: false,
        preferredSports: ["football"],
      },
    ])
    .returning();

  const profileByUserId = Object.fromEntries(
    insertedProfiles.filter((p) => p.userId !== null).map((p) => [p.userId!, p])
  );
  const alumniSiddharth = insertedProfiles.find((p) => p.rollNumber === "191103")!;
  const alumniArvind = insertedProfiles.find((p) => p.rollNumber === "201109")!;

  // 5. Assign Scoped User Roles
  const secUser = userByEmail["221101@iiitt.ac.in"];
  const pedUser = userByEmail["faculty.ped@iiitt.ac.in"];
  const staffUser = userByEmail["staff.grounds@iiitt.ac.in"];
  const vikram = userByEmail["221114@iiitt.ac.in"];
  const priya = userByEmail["231108@iiitt.ac.in"];
  const rohan = userByEmail["231122@iiitt.ac.in"];
  const ananya = userByEmail["241105@iiitt.ac.in"];
  const meera = userByEmail["241142@iiitt.ac.in"];
  const arjun = userByEmail["231145@iiitt.ac.in"];
  const kabir = userByEmail["251119@iiitt.ac.in"];
  const devansh = userByEmail["221130@iiitt.ac.in"];
  const nikhil = userByEmail["231161@iiitt.ac.in"];
  const tanvi = userByEmail["241177@iiitt.ac.in"];
  const ishaan = userByEmail["251104@iiitt.ac.in"];
  const riya = userByEmail["241188@iiitt.ac.in"];
  const raju = userByEmail["raju@iiitt.ac.in"];
  const sysAdmin = userByEmail["sysadmin@iiitt.ac.in"];

  await db.insert(userRoles).values([
    { userId: pedUser.id, roleCode: "FACULTY_ADVISOR", grantedBy: sysAdmin.id },
    { userId: secUser.id, roleCode: "SPORTS_SECRETARY", grantedBy: pedUser.id },
    { userId: staffUser.id, roleCode: "EQUIPMENT_STAFF", grantedBy: pedUser.id },
    { userId: sysAdmin.id, roleCode: "SUPER_ADMIN", grantedBy: sysAdmin.id },
    { userId: vikram.id, roleCode: "CLUB_SECRETARY", clubId: clubBySlug["cricket"].id, grantedBy: secUser.id },
    { userId: vikram.id, roleCode: "CAPTAIN", grantedBy: secUser.id },
    { userId: priya.id, roleCode: "CLUB_SECRETARY", clubId: clubBySlug["badminton"].id, grantedBy: secUser.id },
    { userId: priya.id, roleCode: "CAPTAIN", grantedBy: secUser.id },
    { userId: priya.id, roleCode: "MATCH_SCORER", grantedBy: secUser.id },
    { userId: devansh.id, roleCode: "CLUB_SECRETARY", clubId: clubBySlug["football"].id, grantedBy: secUser.id },
    { userId: meera.id, roleCode: "CLUB_SECRETARY", clubId: clubBySlug["volleyball"].id, grantedBy: secUser.id },
    { userId: meera.id, roleCode: "CAPTAIN", grantedBy: secUser.id },
    { userId: rohan.id, roleCode: "CLUB_COORDINATOR", clubId: clubBySlug["cricket"].id, batchScope: "3RD", scopeLabel: "Boys", grantedBy: vikram.id },
    { userId: rohan.id, roleCode: "MATCH_SCORER", grantedBy: secUser.id },
    { userId: rohan.id, roleCode: "CLUB_MEMBER", clubId: clubBySlug["football"].id, grantedBy: devansh.id },
    { userId: rohan.id, roleCode: "CLUB_MEMBER", clubId: clubBySlug["badminton"].id, grantedBy: priya.id },
    { userId: rohan.id, roleCode: "CLUB_MEMBER", clubId: clubBySlug["table_tennis"].id, grantedBy: tanvi.id },
    { userId: rohan.id, roleCode: "CLUB_MEMBER", clubId: clubBySlug["volleyball"].id, grantedBy: meera.id },
    { userId: ananya.id, roleCode: "CLUB_COORDINATOR", clubId: clubBySlug["cricket"].id, batchScope: "2ND", scopeLabel: "Girls", grantedBy: vikram.id },
    { userId: ananya.id, roleCode: "CLUB_MEMBER", clubId: clubBySlug["football"].id, grantedBy: devansh.id },
    { userId: arjun.id, roleCode: "AUCTION_OPERATOR", grantedBy: secUser.id },
    { userId: arjun.id, roleCode: "CLUB_COORDINATOR", clubId: clubBySlug["football"].id, batchScope: "3RD", scopeLabel: "Boys", grantedBy: devansh.id },
    { userId: nikhil.id, roleCode: "CLUB_SECRETARY", clubId: clubBySlug["chess"].id, grantedBy: secUser.id },
    { userId: nikhil.id, roleCode: "CLUB_COORDINATOR", clubId: clubBySlug["cricket"].id, batchScope: "3RD", scopeLabel: "Open", grantedBy: vikram.id },
    { userId: tanvi.id, roleCode: "CLUB_SECRETARY", clubId: clubBySlug["table_tennis"].id, grantedBy: secUser.id },
    { userId: tanvi.id, roleCode: "CLUB_COORDINATOR", clubId: clubBySlug["badminton"].id, batchScope: "2ND", scopeLabel: "Girls", grantedBy: priya.id },
    { userId: kabir.id, roleCode: "STUDENT", grantedBy: sysAdmin.id },
    { userId: ishaan.id, roleCode: "STUDENT", grantedBy: sysAdmin.id },
    { userId: riya.id, roleCode: "STUDENT", grantedBy: sysAdmin.id },
    { userId: raju.id, roleCode: "STUDENT", grantedBy: sysAdmin.id },
  ]);

  // 6. Club Memberships (Secretaries, Multi-Coordinator Batches, Multi-Club Members, & Trial Candidates)
  await db.insert(clubMemberships).values([
    { clubId: clubBySlug["cricket"].id, playerProfileId: profileByUserId[vikram.id].id, role: "SECRETARY", status: "INDUCTED", approvedBy: secUser.id, inductedAt: new Date() },
    { clubId: clubBySlug["cricket"].id, playerProfileId: profileByUserId[rohan.id].id, role: "COORDINATOR", batchScope: "3RD", scopeLabel: "Boys", status: "INDUCTED", approvedBy: vikram.id, inductedAt: new Date() },
    { clubId: clubBySlug["cricket"].id, playerProfileId: profileByUserId[ananya.id].id, role: "COORDINATOR", batchScope: "2ND", scopeLabel: "Girls", status: "INDUCTED", approvedBy: vikram.id, inductedAt: new Date() },
    { clubId: clubBySlug["cricket"].id, playerProfileId: profileByUserId[devansh.id].id, role: "MEMBER", status: "INDUCTED", approvedBy: vikram.id, inductedAt: new Date() },
    { clubId: clubBySlug["cricket"].id, playerProfileId: profileByUserId[nikhil.id].id, role: "COORDINATOR", batchScope: "3RD", scopeLabel: "Open", status: "INDUCTED", approvedBy: vikram.id, inductedAt: new Date() },
    { clubId: clubBySlug["cricket"].id, playerProfileId: profileByUserId[kabir.id].id, role: "MEMBER", status: "TRIAL_ATTENDED", trialNotes: "Sharp fielding & clean straight drive in 1st-year net session.", evaluationScore: 8, evaluatedBy: rohan.id },
    { clubId: clubBySlug["cricket"].id, playerProfileId: profileByUserId[ishaan.id].id, role: "MEMBER", status: "APPLIED" },
    { clubId: clubBySlug["football"].id, playerProfileId: profileByUserId[devansh.id].id, role: "SECRETARY", status: "INDUCTED", approvedBy: secUser.id, inductedAt: new Date() },
    { clubId: clubBySlug["football"].id, playerProfileId: profileByUserId[rohan.id].id, role: "MEMBER", status: "INDUCTED", approvedBy: devansh.id, inductedAt: new Date() },
    { clubId: clubBySlug["football"].id, playerProfileId: profileByUserId[ananya.id].id, role: "MEMBER", status: "INDUCTED", approvedBy: devansh.id, inductedAt: new Date() },
    { clubId: clubBySlug["football"].id, playerProfileId: profileByUserId[arjun.id].id, role: "COORDINATOR", batchScope: "3RD", scopeLabel: "Boys", status: "INDUCTED", approvedBy: devansh.id, inductedAt: new Date() },
    { clubId: clubBySlug["football"].id, playerProfileId: profileByUserId[kabir.id].id, role: "MEMBER", status: "APPLIED" },
    { clubId: clubBySlug["badminton"].id, playerProfileId: profileByUserId[priya.id].id, role: "SECRETARY", status: "INDUCTED", approvedBy: secUser.id, inductedAt: new Date() },
    { clubId: clubBySlug["badminton"].id, playerProfileId: profileByUserId[rohan.id].id, role: "MEMBER", status: "INDUCTED", approvedBy: priya.id, inductedAt: new Date() },
    { clubId: clubBySlug["badminton"].id, playerProfileId: profileByUserId[tanvi.id].id, role: "COORDINATOR", batchScope: "2ND", scopeLabel: "Girls", status: "INDUCTED", approvedBy: priya.id, inductedAt: new Date() },
    { clubId: clubBySlug["badminton"].id, playerProfileId: profileByUserId[ishaan.id].id, role: "MEMBER", status: "TRIAL_ATTENDED", trialNotes: "Good footwork and net drop consistency.", evaluationScore: 7, evaluatedBy: tanvi.id },
    { clubId: clubBySlug["volleyball"].id, playerProfileId: profileByUserId[meera.id].id, role: "SECRETARY", status: "INDUCTED", approvedBy: secUser.id, inductedAt: new Date() },
    { clubId: clubBySlug["volleyball"].id, playerProfileId: profileByUserId[rohan.id].id, role: "MEMBER", status: "INDUCTED", approvedBy: meera.id, inductedAt: new Date() },
    { clubId: clubBySlug["table_tennis"].id, playerProfileId: profileByUserId[tanvi.id].id, role: "SECRETARY", status: "INDUCTED", approvedBy: secUser.id, inductedAt: new Date() },
    { clubId: clubBySlug["table_tennis"].id, playerProfileId: profileByUserId[rohan.id].id, role: "MEMBER", status: "INDUCTED", approvedBy: tanvi.id, inductedAt: new Date() },
    { clubId: clubBySlug["kabaddi"].id, playerProfileId: profileByUserId[rohan.id].id, role: "MEMBER", status: "TRIAL_ATTENDED", trialNotes: "Strong ankle hold & agility in mat trials.", evaluationScore: 8, evaluatedBy: secUser.id },
    { clubId: clubBySlug["chess"].id, playerProfileId: profileByUserId[nikhil.id].id, role: "SECRETARY", status: "INDUCTED", approvedBy: secUser.id, inductedAt: new Date() },
    { clubId: clubBySlug["chess"].id, playerProfileId: profileByUserId[riya.id].id, role: "MEMBER", status: "APPLIED" },
  ]);

  // 7. Club Upcoming Activities (All 9 Official Clubs + Inter-IIIT Squad Selection)
  const now = new Date();
  const plusHours = (h: number) => new Date(now.getTime() + h * 3600 * 1000);
  await db.insert(clubActivities).values([
    { clubId: clubBySlug["cricket"].id, activityType: "INDUCTION", targetBatch: "1ST", category: "OPEN", scheduledAt: plusHours(18), venue: "Main Cricket Nets", notes: "Bring white sports shoes; leather ball trials.", createdBy: vikram.id },
    { clubId: clubBySlug["cricket"].id, activityType: "PRACTICE", targetBatch: "ALL", category: "BOYS", scheduledAt: plusHours(42), venue: "IIITT Main Turf", notes: "Powerplay fielding drills & death bowling.", createdBy: rohan.id },
    {
      clubId: clubBySlug["cricket"].id,
      activityType: "INTER_IIIT",
      customTypeLabel: "Inter-IIIT Selection",
      targetBatch: "ALL",
      category: "BOYS",
      scheduledAt: plusHours(96),
      venue: "NIT Trichy Ground (Away)",
      notes: "Inter-IIIT practice fixture including inducted club core and non-club pace prospect.",
      selectedSquadJson: [
        { userId: vikram.id, playerProfileId: profileByUserId[vikram.id].id, name: vikram.name, rollNumber: vikram.rollNumber, batch: vikram.batch, branch: "ECE", isClubMember: true },
        { userId: rohan.id, playerProfileId: profileByUserId[rohan.id].id, name: rohan.name, rollNumber: rohan.rollNumber, batch: rohan.batch, branch: "ECE", isClubMember: true },
        { userId: riya.id, playerProfileId: profileByUserId[riya.id].id, name: riya.name, rollNumber: riya.rollNumber, batch: riya.batch, branch: "ECE", isClubMember: false },
      ],
      createdBy: vikram.id,
    },
    { clubId: clubBySlug["football"].id, activityType: "PRACTICE", targetBatch: "ALL", category: "OPEN", scheduledAt: plusHours(22), venue: "Main Football Ground", notes: "7v7 tactical pressing session.", createdBy: devansh.id },
    { clubId: clubBySlug["volleyball"].id, activityType: "PRACTICE", targetBatch: "ALL", category: "OPEN", scheduledAt: plusHours(28), venue: "Floodlit Volleyball Court", notes: "Serve-receive formations & quick middle attacks.", createdBy: meera.id },
    { clubId: clubBySlug["kho_kho"].id, activityType: "PRACTICE", targetBatch: "ALL", category: "OPEN", scheduledAt: plusHours(34), venue: "Kho Kho Clay Court", notes: "Pole-dive timing and chase chain drills.", createdBy: secUser.id },
    { clubId: clubBySlug["kabaddi"].id, activityType: "PRACTICE", targetBatch: "ALL", category: "BOYS", scheduledAt: plusHours(40), venue: "Kabaddi Mat Arena", notes: "Ankle-hold & bonus-line raid drills.", createdBy: secUser.id },
    { clubId: clubBySlug["badminton"].id, activityType: "INDUCTION", targetBatch: "1ST", category: "GIRLS", scheduledAt: plusHours(26), venue: "Indoor Court 1 & 2", notes: "Knockout ladder evaluation for freshers.", createdBy: priya.id },
    { clubId: clubBySlug["table_tennis"].id, activityType: "PRACTICE", targetBatch: "ALL", category: "OPEN", scheduledAt: plusHours(36), venue: "SAC Table Tennis Hall", notes: "Topspin rally & doubles rotation challenge.", createdBy: tanvi.id },
    { clubId: clubBySlug["carrom"].id, activityType: "PRACTICE", targetBatch: "ALL", category: "OPEN", scheduledAt: plusHours(44), venue: "Student Activity Center", notes: "Doubles break practice and Swiss open sign-ups.", createdBy: secUser.id },
    { clubId: clubBySlug["chess"].id, activityType: "OTHER", customTypeLabel: "Blitz Arena", targetBatch: "ALL", category: "OPEN", scheduledAt: plusHours(50), venue: "Seminar Hall 2", notes: "5+3 Swiss 7-round rapid evening.", createdBy: nikhil.id },
  ]);

  // 8. Tournaments: Current Flagship (2026) + Archived 2025 + Archived 2024 ("On This Day")
  const [currentTournament] = await db
    .insert(tournaments)
    .values({
      name: "IIITT Premier League — Odd Sem 2026",
      academicYear: 2026,
      semester: "ODD",
      tournamentType: "FLAGSHIP",
      format: "GROUP_KNOCKOUT",
      rosterMode: "CAPTAIN_SUBMISSION",
      status: "ACTIVE",
      completenessStatus: "COMPLETE",
      isCurrent: true,
      description: "Flagship Odd-Semester multi-sport championship across all 9 official IIITT sports.",
      startsAt: new Date(now.getTime() - 4 * 86400000),
      endsAt: new Date(now.getTime() + 10 * 86400000),
    })
    .returning();

  const [arch2025] = await db
    .insert(tournaments)
    .values({
      name: "Prothymos Championship 2025",
      academicYear: 2025,
      semester: "EVEN",
      tournamentType: "PROTHYMOS",
      format: "GROUP_KNOCKOUT",
      rosterMode: "AUCTION",
      status: "ARCHIVED",
      completenessStatus: "VERIFIED",
      isCurrent: false,
      description: "Flagship franchise auction & multi-sport championship of 2025.",
      startsAt: new Date("2025-03-10T09:00:00Z"),
      endsAt: new Date("2025-03-24T19:00:00Z"),
      verifiedBy: pedUser.id,
    })
    .returning();

  // Make "On This Day" match current month & day in 2024!
  const onThisDay2024 = new Date(now);
  onThisDay2024.setFullYear(2024);
  const [arch2024] = await db
    .insert(tournaments)
    .values({
      name: "IIITT Inter-Hostel Cup 2024",
      academicYear: 2024,
      semester: "ODD",
      tournamentType: "INTER_HOSTEL",
      format: "KNOCKOUT",
      rosterMode: "CAPTAIN_SUBMISSION",
      status: "ARCHIVED",
      completenessStatus: "VERIFIED",
      isCurrent: false,
      description: "Historic hostel vs hostel championship decided in a last-ball thriller.",
      startsAt: new Date(onThisDay2024.getTime() - 6 * 86400000),
      endsAt: onThisDay2024,
      verifiedBy: pedUser.id,
    })
    .returning();

  // Configure sports in Current Tournament
  const currentSportSlugs = ["cricket", "football", "volleyball", "badminton", "table_tennis", "chess"];
  await db.insert(tournamentSports).values(
    currentSportSlugs.map((slug) => ({
      tournamentId: currentTournament.id,
      sportId: sportBySlug[slug].id,
      format: "GROUP_KNOCKOUT",
      minSquadSize: slug === "badminton" || slug === "chess" ? 1 : 6,
      maxSquadSize: 15,
      registrationDeadline: new Date(now.getTime() + 5 * 86400000),
    }))
  );

  // 9. Teams & Rosters for Current Tournament (Cricket + Badminton + Football + Volleyball)
  const [cricTeamA, cricTeamB, cricTeamC, badTeamA, badTeamB, fbTeamA, fbTeamB, vbTeamA, vbTeamB] = await db
    .insert(teams)
    .values([
      { tournamentId: currentTournament.id, sportId: sportBySlug["cricket"].id, name: "Trichy Titans", shortCode: "TTN", accentColor: "#B91C1C", captainUserId: vikram.id, submissionStatus: "APPROVED", reviewedBy: secUser.id },
      { tournamentId: currentTournament.id, sportId: sportBySlug["cricket"].id, name: "Cauvery Chargers", shortCode: "CCG", accentColor: "#D97706", captainUserId: devansh.id, submissionStatus: "APPROVED", reviewedBy: secUser.id },
      { tournamentId: currentTournament.id, sportId: sportBySlug["cricket"].id, name: "Bhavani Blasters", shortCode: "BBL", accentColor: "#10B981", captainUserId: nikhil.id, submissionStatus: "SUBMITTED" },
      { tournamentId: currentTournament.id, sportId: sportBySlug["badminton"].id, name: "Shuttle Hawks", shortCode: "SHK", accentColor: "#D97706", captainUserId: priya.id, submissionStatus: "APPROVED", reviewedBy: secUser.id },
      { tournamentId: currentTournament.id, sportId: sportBySlug["badminton"].id, name: "Net Blazers", shortCode: "NBL", accentColor: "#B91C1C", captainUserId: tanvi.id, submissionStatus: "APPROVED", reviewedBy: secUser.id },
      { tournamentId: currentTournament.id, sportId: sportBySlug["football"].id, name: "Iron Strikers", shortCode: "IST", accentColor: "#B91C1C", captainUserId: devansh.id, submissionStatus: "APPROVED", reviewedBy: secUser.id },
      { tournamentId: currentTournament.id, sportId: sportBySlug["football"].id, name: "Vaigai Wolves", shortCode: "VWL", accentColor: "#D97706", captainUserId: arjun.id, submissionStatus: "APPROVED", reviewedBy: secUser.id },
      { tournamentId: currentTournament.id, sportId: sportBySlug["volleyball"].id, name: "Spike Titans", shortCode: "SPT", accentColor: "#2563EB", captainUserId: meera.id, submissionStatus: "APPROVED", reviewedBy: secUser.id },
      { tournamentId: currentTournament.id, sportId: sportBySlug["volleyball"].id, name: "Net Breakers", shortCode: "NBK", accentColor: "#059669", captainUserId: rohan.id, submissionStatus: "APPROVED", reviewedBy: secUser.id },
    ])
    .returning();

  const lineupA = [
    profileByUserId[vikram.id].id,
    profileByUserId[secUser.id].id,
    profileByUserId[ananya.id].id,
    profileByUserId[kabir.id].id,
  ];
  const lineupB = [
    profileByUserId[devansh.id].id,
    profileByUserId[arjun.id].id,
    profileByUserId[nikhil.id].id,
    profileByUserId[ishaan.id].id,
  ];

  await db.insert(teamRosters).values([
    { teamId: cricTeamA.id, playerProfileId: profileByUserId[vikram.id].id, playingRole: "All-Rounder (C)", playerClass: "CLUB" },
    { teamId: cricTeamA.id, playerProfileId: profileByUserId[secUser.id].id, playingRole: "Opening Batter", playerClass: "CLUB" },
    { teamId: cricTeamA.id, playerProfileId: profileByUserId[ananya.id].id, playingRole: "Pace Bowler", playerClass: "CLUB" },
    { teamId: cricTeamA.id, playerProfileId: profileByUserId[kabir.id].id, playingRole: "Wicketkeeper", playerClass: "NON_CLUB" },
    { teamId: cricTeamB.id, playerProfileId: profileByUserId[devansh.id].id, playingRole: "Batter (C)", playerClass: "CLUB" },
    { teamId: cricTeamB.id, playerProfileId: profileByUserId[arjun.id].id, playingRole: "Leg Spinner", playerClass: "NON_CLUB" },
    { teamId: cricTeamB.id, playerProfileId: profileByUserId[nikhil.id].id, playingRole: "All-Rounder", playerClass: "CLUB" },
    { teamId: cricTeamB.id, playerProfileId: profileByUserId[ishaan.id].id, playingRole: "Fast Bowler", playerClass: "NON_CLUB" },
    { teamId: cricTeamC.id, playerProfileId: profileByUserId[nikhil.id].id, playingRole: "Captain", playerClass: "CLUB" },
    { teamId: badTeamA.id, playerProfileId: profileByUserId[priya.id].id, playingRole: "Singles Ace", playerClass: "CLUB" },
    { teamId: badTeamB.id, playerProfileId: profileByUserId[tanvi.id].id, playingRole: "Singles Ace", playerClass: "CLUB" },
    { teamId: fbTeamA.id, playerProfileId: profileByUserId[devansh.id].id, playingRole: "Striker", playerClass: "CLUB" },
    { teamId: fbTeamB.id, playerProfileId: profileByUserId[arjun.id].id, playingRole: "Midfielder", playerClass: "CLUB" },
    { teamId: vbTeamA.id, playerProfileId: profileByUserId[meera.id].id, playingRole: "Setter (C)", playerClass: "CLUB" },
    { teamId: vbTeamB.id, playerProfileId: profileByUserId[rohan.id].id, playingRole: "Outside Hitter", playerClass: "NON_CLUB" },
  ]);

  // 10. Current Tournament Matches (2 LIVE, 3 COMPLETED, 3 UPCOMING across multiple sports)
  const [liveCricMatch, liveBadMatch, compCricMatch, compFbMatch, compBadMatch, upcFbMatch, upcVbMatch, upcCricMatch] = await db
    .insert(matches)
    .values([
      {
        tournamentId: currentTournament.id,
        sportId: sportBySlug["cricket"].id,
        roundLabel: "Semi-Final 1",
        matchOrder: 2,
        teamAId: cricTeamA.id,
        teamBId: cricTeamB.id,
        venue: "IIITT Main Cricket Ground",
        scheduledAt: new Date(now.getTime() - 25 * 60000),
        status: "LIVE",
        scorerUserId: rohan.id,
        lineupAJson: lineupA,
        lineupBJson: lineupB,
        configJson: { oversPerInnings: 10 },
        scoreSummary: "TTN 26/1 (2.0 ov)",
      },
      {
        tournamentId: currentTournament.id,
        sportId: sportBySlug["badminton"].id,
        roundLabel: "Group A Match 1",
        matchOrder: 1,
        teamAId: badTeamA.id,
        teamBId: badTeamB.id,
        venue: "Indoor Court 1",
        scheduledAt: new Date(now.getTime() - 15 * 60000),
        status: "LIVE",
        scorerUserId: rohan.id,
        lineupAJson: [profileByUserId[priya.id].id],
        lineupBJson: [profileByUserId[tanvi.id].id],
        configJson: { bestOfGames: 3, targetPoints: 21 },
        scoreSummary: "SHK 1-0 (21-17, 11-9)",
      },
      {
        tournamentId: currentTournament.id,
        sportId: sportBySlug["cricket"].id,
        roundLabel: "Opening Match",
        matchOrder: 1,
        teamAId: cricTeamB.id,
        teamBId: cricTeamA.id,
        venue: "IIITT Main Cricket Ground",
        scheduledAt: new Date(now.getTime() - 2 * 86400000),
        status: "COMPLETED",
        scorerUserId: rohan.id,
        lineupAJson: lineupB,
        lineupBJson: lineupA,
        configJson: { oversPerInnings: 10 },
        scoreSummary: "TTN 92/3 (9.1 ov) beat CCG 89/6 (10.0 ov)",
        resultNote: "Trichy Titans won by 7 wickets",
        winnerTeamId: cricTeamA.id,
        verifiedBy: secUser.id,
        verifiedAt: new Date(now.getTime() - 86400000),
      },
      {
        tournamentId: currentTournament.id,
        sportId: sportBySlug["football"].id,
        roundLabel: "Opening Match",
        matchOrder: 1,
        teamAId: fbTeamA.id,
        teamBId: fbTeamB.id,
        venue: "Main Football Ground",
        scheduledAt: new Date(now.getTime() - 86400000),
        status: "COMPLETED",
        scorerUserId: rohan.id,
        lineupAJson: [profileByUserId[devansh.id].id],
        lineupBJson: [profileByUserId[arjun.id].id],
        configJson: { halfMinutes: 35 },
        scoreSummary: "IST 2 - 1 VWL (FT)",
        resultNote: "Iron Strikers won 2-1",
        winnerTeamId: fbTeamA.id,
        verifiedBy: secUser.id,
        verifiedAt: new Date(now.getTime() - 43200000),
      },
      {
        tournamentId: currentTournament.id,
        sportId: sportBySlug["badminton"].id,
        roundLabel: "Opening Tie",
        matchOrder: 1,
        teamAId: badTeamA.id,
        teamBId: badTeamB.id,
        venue: "Indoor Court 1",
        scheduledAt: new Date(now.getTime() - 3 * 86400000),
        status: "COMPLETED",
        scorerUserId: priya.id,
        lineupAJson: [profileByUserId[priya.id].id],
        lineupBJson: [profileByUserId[tanvi.id].id],
        configJson: { bestOfGames: 3, targetPoints: 21 },
        scoreSummary: "SHK 2-0 (21-15, 21-18)",
        resultNote: "Shuttle Hawks won in straight games",
        winnerTeamId: badTeamA.id,
        verifiedBy: secUser.id,
        verifiedAt: new Date(now.getTime() - 2 * 86400000),
      },
      {
        tournamentId: currentTournament.id,
        sportId: sportBySlug["football"].id,
        roundLabel: "Group Match 2",
        matchOrder: 2,
        teamAId: fbTeamA.id,
        teamBId: fbTeamB.id,
        venue: "Main Football Ground",
        scheduledAt: plusHours(6),
        status: "UPCOMING",
        scorerUserId: rohan.id,
        lineupAJson: [profileByUserId[devansh.id].id],
        lineupBJson: [profileByUserId[arjun.id].id],
        configJson: { halfMinutes: 35 },
        scoreSummary: "Kickoff Scheduled",
      },
      {
        tournamentId: currentTournament.id,
        sportId: sportBySlug["volleyball"].id,
        roundLabel: "Group Match 1",
        matchOrder: 1,
        teamAId: vbTeamA.id,
        teamBId: vbTeamB.id,
        venue: "Floodlit Volleyball Court",
        scheduledAt: plusHours(20),
        status: "UPCOMING",
        scorerUserId: priya.id,
        lineupAJson: [profileByUserId[meera.id].id],
        lineupBJson: [profileByUserId[rohan.id].id],
        configJson: { bestOfSets: 3 },
        scoreSummary: "Scheduled",
      },
      {
        tournamentId: currentTournament.id,
        sportId: sportBySlug["cricket"].id,
        roundLabel: "League Match 3",
        matchOrder: 3,
        teamAId: cricTeamA.id,
        teamBId: cricTeamC.id,
        venue: "IIITT Main Cricket Ground",
        scheduledAt: plusHours(30),
        status: "UPCOMING",
        scorerUserId: rohan.id,
        lineupAJson: lineupA,
        lineupBJson: [profileByUserId[nikhil.id].id],
        configJson: { oversPerInnings: 10 },
        scoreSummary: "Scheduled",
      },
    ])
    .returning();

  // Match events for Live Cricket, Live Badminton, Completed Cricket, and Completed Football
  const liveBadEvents: Array<{
    matchId: number;
    seq: number;
    eventType: string;
    payloadJson: Record<string, unknown>;
    createdBy: number;
  }> = [];
  let badSeq = 1;
  // Game 1: SHK 21 - 17 NBL (interleaved so game finishes cleanly at 21-17)
  for (let i = 0; i < 17; i++) {
    liveBadEvents.push({ matchId: liveBadMatch.id, seq: badSeq++, eventType: "POINT", payloadJson: { side: "A" }, createdBy: rohan.id });
    liveBadEvents.push({ matchId: liveBadMatch.id, seq: badSeq++, eventType: "POINT", payloadJson: { side: "B" }, createdBy: rohan.id });
  }
  for (let i = 0; i < 4; i++) {
    liveBadEvents.push({ matchId: liveBadMatch.id, seq: badSeq++, eventType: "POINT", payloadJson: { side: "A" }, createdBy: rohan.id });
  }
  // Game 2: SHK 11 - 9 NBL
  for (let i = 0; i < 9; i++) {
    liveBadEvents.push({ matchId: liveBadMatch.id, seq: badSeq++, eventType: "POINT", payloadJson: { side: "A" }, createdBy: rohan.id });
    liveBadEvents.push({ matchId: liveBadMatch.id, seq: badSeq++, eventType: "POINT", payloadJson: { side: "B" }, createdBy: rohan.id });
  }
  for (let i = 0; i < 2; i++) {
    liveBadEvents.push({ matchId: liveBadMatch.id, seq: badSeq++, eventType: "POINT", payloadJson: { side: "A" }, createdBy: rohan.id });
  }

  // Completed Cricket Match (CCG 89/6 in 10.0 ov vs TTN 92/3 in 9.1 ov)
  const compCricEvents: Array<{
    matchId: number;
    seq: number;
    eventType: string;
    payloadJson: Record<string, unknown>;
    createdBy: number;
  }> = [];
  let ccSeq = 1;
  // Innings 1 (Side A = CCG): 60 balls -> 89 runs, 6 wickets
  for (let b = 0; b < 60; b++) {
    const isWicket = b > 0 && b % 10 === 9 && b <= 59;
    const runs = isWicket ? 0 : b < 35 ? 2 : b < 59 ? 1 : 2; // 35*2 + 18*1 + 1*1? Wait: 6 wickets at 9,19,29,39,49,59 = 6 balls (0 runs); 54 scoring balls: 35*2 + 19*1 = 89!
    compCricEvents.push({
      matchId: compCricMatch.id,
      seq: ccSeq++,
      eventType: "BALL",
      payloadJson: {
        side: "A",
        runs,
        extraType: null,
        wicket: isWicket,
        ...(isWicket ? { wicketType: "BOWLED" } : {}),
        batterId: lineupB[b % lineupB.length],
        bowlerId: lineupA[b % lineupA.length],
      },
      createdBy: rohan.id,
    });
  }
  compCricEvents.push({
    matchId: compCricMatch.id,
    seq: ccSeq++,
    eventType: "INNINGS_SWITCH",
    payloadJson: { battingSide: "B" },
    createdBy: rohan.id,
  });
  // Innings 2 (Side B = TTN): 55 balls (9.1 ov) -> 92 runs, 3 wickets
  for (let b = 0; b < 55; b++) {
    const isWicket = b === 12 || b === 26 || b === 40;
    const runs = isWicket ? 0 : b < 40 ? 2 : 1; // 3 wickets; 37*2 + 15*1 = 74 + 15 = 89 -> make last ball 4: 37*2 + 14*1 + 4 = 92!
    const finalRuns = b === 54 ? 4 : runs;
    compCricEvents.push({
      matchId: compCricMatch.id,
      seq: ccSeq++,
      eventType: "BALL",
      payloadJson: {
        side: "B",
        runs: finalRuns,
        extraType: null,
        wicket: isWicket,
        ...(isWicket ? { wicketType: "CAUGHT" } : {}),
        batterId: lineupA[b % lineupA.length],
        bowlerId: lineupB[b % lineupB.length],
      },
      createdBy: rohan.id,
    });
  }

  await db.insert(matchEvents).values([
    { matchId: liveCricMatch.id, seq: 1, eventType: "BALL", payloadJson: { side: "A", runs: 4, extraType: null, wicket: false, batterId: lineupA[0], bowlerId: lineupB[3] }, createdBy: rohan.id },
    { matchId: liveCricMatch.id, seq: 2, eventType: "BALL", payloadJson: { side: "A", runs: 1, extraType: null, wicket: false, batterId: lineupA[0], bowlerId: lineupB[3] }, createdBy: rohan.id },
    { matchId: liveCricMatch.id, seq: 3, eventType: "BALL", payloadJson: { side: "A", runs: 6, extraType: null, wicket: false, batterId: lineupA[1], bowlerId: lineupB[3] }, createdBy: rohan.id },
    { matchId: liveCricMatch.id, seq: 4, eventType: "BALL", payloadJson: { side: "A", runs: 0, extraType: null, wicket: true, wicketType: "BOWLED", batterId: lineupA[1], bowlerId: lineupB[3] }, createdBy: rohan.id },
    { matchId: liveCricMatch.id, seq: 5, eventType: "BALL", payloadJson: { side: "A", runs: 2, extraType: null, wicket: false, batterId: lineupA[2], bowlerId: lineupB[3] }, createdBy: rohan.id },
    { matchId: liveCricMatch.id, seq: 6, eventType: "BALL", payloadJson: { side: "A", runs: 1, extraType: null, wicket: false, batterId: lineupA[2], bowlerId: lineupB[3] }, createdBy: rohan.id },
    { matchId: liveCricMatch.id, seq: 7, eventType: "BALL", payloadJson: { side: "A", runs: 4, extraType: null, wicket: false, batterId: lineupA[0], bowlerId: lineupB[1] }, createdBy: rohan.id },
    { matchId: liveCricMatch.id, seq: 8, eventType: "BALL", payloadJson: { side: "A", runs: 1, extraType: "WD", wicket: false, batterId: lineupA[0], bowlerId: lineupB[1] }, createdBy: rohan.id },
    { matchId: liveCricMatch.id, seq: 9, eventType: "BALL", payloadJson: { side: "A", runs: 6, extraType: null, wicket: false, batterId: lineupA[0], bowlerId: lineupB[1] }, createdBy: rohan.id },
    { matchId: liveCricMatch.id, seq: 10, eventType: "BALL", payloadJson: { side: "A", runs: 1, extraType: null, wicket: false, batterId: lineupA[0], bowlerId: lineupB[1] }, createdBy: rohan.id },
    ...liveBadEvents,
    ...compCricEvents,
    { matchId: compFbMatch.id, seq: 1, eventType: "GOAL", payloadJson: { side: "A", minute: 14, scorerId: profileByUserId[devansh.id].id }, createdBy: rohan.id },
    { matchId: compFbMatch.id, seq: 2, eventType: "GOAL", payloadJson: { side: "B", minute: 38, scorerId: profileByUserId[arjun.id].id }, createdBy: rohan.id },
    { matchId: compFbMatch.id, seq: 3, eventType: "GOAL", payloadJson: { side: "A", minute: 64, scorerId: profileByUserId[devansh.id].id }, createdBy: rohan.id },
  ]);

  // Seed Current Standings
  await db.insert(standings).values([
    { tournamentId: currentTournament.id, sportId: sportBySlug["cricket"].id, teamId: cricTeamA.id, played: 1, won: 1, lost: 0, drawn: 0, points: 2, nrr: 1.135, rank: 1 },
    { tournamentId: currentTournament.id, sportId: sportBySlug["cricket"].id, teamId: cricTeamB.id, played: 1, won: 0, lost: 1, drawn: 0, points: 0, nrr: -1.135, rank: 2 },
    { tournamentId: currentTournament.id, sportId: sportBySlug["football"].id, teamId: fbTeamA.id, played: 1, won: 1, lost: 0, drawn: 0, points: 3, goalDiff: 1, goalsFor: 2, goalsAgainst: 1, rank: 1 },
    { tournamentId: currentTournament.id, sportId: sportBySlug["football"].id, teamId: fbTeamB.id, played: 1, won: 0, lost: 1, drawn: 0, points: 0, goalDiff: -1, goalsFor: 1, goalsAgainst: 2, rank: 2 },
    { tournamentId: currentTournament.id, sportId: sportBySlug["badminton"].id, teamId: badTeamA.id, played: 1, won: 1, lost: 0, drawn: 0, points: 2, setsWon: 2, setsLost: 0, rank: 1 },
    { tournamentId: currentTournament.id, sportId: sportBySlug["badminton"].id, teamId: badTeamB.id, played: 1, won: 0, lost: 1, drawn: 0, points: 0, setsWon: 0, setsLost: 2, rank: 2 },
  ]);

  // 11. Archived 2025 Tournament (Full Podium: Winner + 2 Runners-Up, Points Table, Final-to-Opening Matches, Rosters)
  const [a25CricT1, a25CricT2, a25CricT3, a25FbT1, a25FbT2] = await db
    .insert(teams)
    .values([
      { tournamentId: arch2025.id, sportId: sportBySlug["cricket"].id, name: "Deccan Mavericks", shortCode: "DMV", accentColor: "#B91C1C", captainUserId: vikram.id, submissionStatus: "LOCKED" },
      { tournamentId: arch2025.id, sportId: sportBySlug["cricket"].id, name: "Kaveri Knights", shortCode: "KKN", accentColor: "#D97706", captainUserId: devansh.id, submissionStatus: "LOCKED" },
      { tournamentId: arch2025.id, sportId: sportBySlug["cricket"].id, name: "Nilgiri Royals", shortCode: "NRY", accentColor: "#10B981", captainUserId: nikhil.id, submissionStatus: "LOCKED" },
      { tournamentId: arch2025.id, sportId: sportBySlug["football"].id, name: "Trichy United", shortCode: "TRU", accentColor: "#B91C1C", captainUserId: devansh.id, submissionStatus: "LOCKED" },
      { tournamentId: arch2025.id, sportId: sportBySlug["football"].id, name: "Srirangam FC", shortCode: "SFC", accentColor: "#D97706", captainUserId: arjun.id, submissionStatus: "LOCKED" },
    ])
    .returning();

  await db.insert(tournamentSports).values([
    {
      tournamentId: arch2025.id,
      sportId: sportBySlug["cricket"].id,
      format: "ROUND_ROBIN",
      winnerTeamId: a25CricT1.id,
      runnerUp1TeamId: a25CricT2.id,
      runnerUp2TeamId: a25CricT3.id,
    },
    {
      tournamentId: arch2025.id,
      sportId: sportBySlug["football"].id,
      format: "KNOCKOUT",
      winnerTeamId: a25FbT1.id,
      runnerUp1TeamId: a25FbT2.id,
      runnerUp2TeamId: null,
    },
  ]);

  await db.insert(teamRosters).values([
    { teamId: a25CricT1.id, playerProfileId: profileByUserId[vikram.id].id, playingRole: "Captain & Pace", playerClass: "CLUB", soldPrice: 4200 },
    { teamId: a25CricT1.id, playerProfileId: alumniSiddharth.id, playingRole: "Anchor Batter (Alumni)", playerClass: "CLUB", soldPrice: 5100 },
    { teamId: a25CricT2.id, playerProfileId: profileByUserId[devansh.id].id, playingRole: "Captain & Wicketkeeper", playerClass: "CLUB", soldPrice: 3800 },
    { teamId: a25CricT3.id, playerProfileId: profileByUserId[nikhil.id].id, playingRole: "All-Rounder", playerClass: "CLUB", soldPrice: 2900 },
    { teamId: a25FbT1.id, playerProfileId: alumniArvind.id, playingRole: "Golden Boot Striker", playerClass: "CLUB", soldPrice: 4800 },
    { teamId: a25FbT1.id, playerProfileId: profileByUserId[devansh.id].id, playingRole: "Winger", playerClass: "CLUB", soldPrice: 3100 },
    { teamId: a25FbT2.id, playerProfileId: profileByUserId[arjun.id].id, playingRole: "Central Midfielder", playerClass: "NON_CLUB", soldPrice: 1800 },
  ]);

  await db.insert(standings).values([
    { tournamentId: arch2025.id, sportId: sportBySlug["cricket"].id, teamId: a25CricT1.id, played: 4, won: 4, lost: 0, drawn: 0, points: 8, nrr: 1.64, rank: 1 },
    { tournamentId: arch2025.id, sportId: sportBySlug["cricket"].id, teamId: a25CricT2.id, played: 4, won: 2, lost: 2, drawn: 0, points: 4, nrr: 0.21, rank: 2 },
    { tournamentId: arch2025.id, sportId: sportBySlug["cricket"].id, teamId: a25CricT3.id, played: 4, won: 1, lost: 3, drawn: 0, points: 2, nrr: -0.95, rank: 3 },
    { tournamentId: arch2025.id, sportId: sportBySlug["football"].id, teamId: a25FbT1.id, played: 3, won: 3, lost: 0, drawn: 0, points: 9, goalDiff: 6, goalsFor: 8, goalsAgainst: 2, rank: 1 },
    { tournamentId: arch2025.id, sportId: sportBySlug["football"].id, teamId: a25FbT2.id, played: 3, won: 1, lost: 2, drawn: 0, points: 3, goalDiff: -2, goalsFor: 3, goalsAgainst: 5, rank: 2 },
  ]);

  const [a25Final, a25Semi, a25Open] = await db
    .insert(matches)
    .values([
      {
        tournamentId: arch2025.id,
        sportId: sportBySlug["cricket"].id,
        roundLabel: "Final",
        matchOrder: 3,
        teamAId: a25CricT1.id,
        teamBId: a25CricT2.id,
        venue: "Main Cricket Ground",
        scheduledAt: new Date("2025-03-24T15:30:00Z"),
        status: "COMPLETED",
        scoreSummary: "DMV 148/4 (15.0 ov) beat KKN 139/8 (15.0 ov)",
        resultNote: "Deccan Mavericks won by 9 runs",
        winnerTeamId: a25CricT1.id,
        verifiedBy: pedUser.id,
        verifiedAt: new Date("2025-03-24T19:00:00Z"),
      },
      {
        tournamentId: arch2025.id,
        sportId: sportBySlug["cricket"].id,
        roundLabel: "Semi-Final",
        matchOrder: 2,
        teamAId: a25CricT2.id,
        teamBId: a25CricT3.id,
        venue: "Main Cricket Ground",
        scheduledAt: new Date("2025-03-20T15:30:00Z"),
        status: "COMPLETED",
        scoreSummary: "KKN 124/5 (14.2 ov) beat NRY 120/7 (15.0 ov)",
        resultNote: "Kaveri Knights won by 5 wickets",
        winnerTeamId: a25CricT2.id,
        verifiedBy: pedUser.id,
        verifiedAt: new Date("2025-03-20T19:00:00Z"),
      },
      {
        tournamentId: arch2025.id,
        sportId: sportBySlug["cricket"].id,
        roundLabel: "Opening Match",
        matchOrder: 1,
        teamAId: a25CricT1.id,
        teamBId: a25CricT3.id,
        venue: "Main Cricket Ground",
        scheduledAt: new Date("2025-03-10T10:00:00Z"),
        status: "COMPLETED",
        scoreSummary: "DMV 136/3 (12.0 ov) beat NRY 98/9 (15.0 ov)",
        resultNote: "Deccan Mavericks won by 38 runs",
        winnerTeamId: a25CricT1.id,
        verifiedBy: pedUser.id,
        verifiedAt: new Date("2025-03-10T13:30:00Z"),
      },
      {
        tournamentId: arch2025.id,
        sportId: sportBySlug["football"].id,
        roundLabel: "Final",
        matchOrder: 1,
        teamAId: a25FbT1.id,
        teamBId: a25FbT2.id,
        venue: "Main Football Ground",
        scheduledAt: new Date("2025-03-23T16:30:00Z"),
        status: "COMPLETED",
        scoreSummary: "TRU 3 - 1 SFC (FT)",
        resultNote: "Trichy United clinched the 2025 Football title 3-1",
        winnerTeamId: a25FbT1.id,
        verifiedBy: pedUser.id,
        verifiedAt: new Date("2025-03-23T19:00:00Z"),
      },
    ])
    .returning();

  // 12. Archived 2024 On-This-Day Match + Standings
  const [a24T1, a24T2] = await db
    .insert(teams)
    .values([
      { tournamentId: arch2024.id, sportId: sportBySlug["cricket"].id, name: "Cauvery Hostel XI", shortCode: "CHX", accentColor: "#B91C1C", submissionStatus: "LOCKED" },
      { tournamentId: arch2024.id, sportId: sportBySlug["cricket"].id, name: "Bhavani Hostel XI", shortCode: "BHX", accentColor: "#D97706", submissionStatus: "LOCKED" },
    ])
    .returning();

  await db.insert(tournamentSports).values({
    tournamentId: arch2024.id,
    sportId: sportBySlug["cricket"].id,
    format: "KNOCKOUT",
    winnerTeamId: a24T1.id,
    runnerUp1TeamId: a24T2.id,
  });

  await db.insert(standings).values([
    { tournamentId: arch2024.id, sportId: sportBySlug["cricket"].id, teamId: a24T1.id, played: 3, won: 3, lost: 0, drawn: 0, points: 6, nrr: 0.94, rank: 1 },
    { tournamentId: arch2024.id, sportId: sportBySlug["cricket"].id, teamId: a24T2.id, played: 3, won: 2, lost: 1, drawn: 0, points: 4, nrr: 0.32, rank: 2 },
  ]);

  await db.insert(matches).values({
    tournamentId: arch2024.id,
    sportId: sportBySlug["cricket"].id,
    roundLabel: "Final",
    matchOrder: 1,
    teamAId: a24T1.id,
    teamBId: a24T2.id,
    venue: "IIITT Main Ground",
    scheduledAt: onThisDay2024,
    status: "COMPLETED",
    scoreSummary: "CHX 162/6 (20.0 ov) beat BHX 161/8 (20.0 ov)",
    resultNote: "Cauvery Hostel clinched the 2024 Cup by 1 run on the final delivery!",
    winnerTeamId: a24T1.id,
    verifiedBy: pedUser.id,
    verifiedAt: onThisDay2024,
  });

  // Player match stats for Hall of Fame & profiles
  await db.insert(playerMatchStats).values([
    { matchId: a25Final.id, playerProfileId: alumniSiddharth.id, teamId: a25CricT1.id, sportId: sportBySlug["cricket"].id, statsJson: { runs: 64, balls: 39, wickets: 0 }, isMvp: true, verified: true },
    { matchId: a25Final.id, playerProfileId: profileByUserId[vikram.id].id, teamId: a25CricT1.id, sportId: sportBySlug["cricket"].id, statsJson: { runs: 28, balls: 19, wickets: 3 }, isMvp: false, verified: true },
    { matchId: compCricMatch.id, playerProfileId: profileByUserId[vikram.id].id, teamId: cricTeamA.id, sportId: sportBySlug["cricket"].id, statsJson: { runs: 41, balls: 24, wickets: 2 }, isMvp: true, verified: true },
  ]);

  // 13. Announcements (including <=5-word Urgent Banner) & Site Settings
  await db.insert(announcements).values([
    {
      title: "CRICKET SEMIS LIVE NOW",
      body: "Trichy Titans vs Cauvery Chargers Semi-Final 1 is currently underway at the Main Cricket Ground.",
      isUrgentBanner: true,
      active: true,
      createdBy: secUser.id,
    },
    {
      title: "Odd Sem Flagship Registrations Open",
      body: "Team captains can submit verified 2026 squads under Current Tournament before Friday 8:00 PM IST.",
      isUrgentBanner: false,
      active: true,
      createdBy: secUser.id,
    },
    {
      title: "1st-Year Cricket & Badminton Trials",
      body: "Check respective Club Hubs for evening net timings and coordinator trial lists.",
      isUrgentBanner: false,
      active: true,
      createdBy: vikram.id,
    },
  ]);

  await db.insert(siteSettings).values([
    { key: "showAuctionInNav", valueJson: true, updatedBy: secUser.id },
    { key: "showLiveAuctionInNav", valueJson: true, updatedBy: secUser.id },
    { key: "currentTournamentId", valueJson: currentTournament.id, updatedBy: secUser.id },
    {
      key: "overviewConfig",
      valueJson: {
        headline: "2026–27 Academic Sports Calendar",
        summary: "Two flagship institute tournaments per academic year alongside official Inter-IIIT selection camps.",
        upcomingTournaments: [
          { name: "IIITT Premier League — Odd Sem 2026", window: "Nov 20 – Dec 08, 2026", mode: "Captain Submission" },
          { name: "Prothymos Auction & Fest — Even Sem 2027", window: "Feb 14 – Mar 02, 2027", mode: "IPL-Style Auction" },
        ],
      },
      updatedBy: secUser.id,
    },
  ]);

  // Notifications for student personas
  await db.insert(notifications).values([
    { userId: kabir.id, title: "Cricket Trial Evaluated", message: "Your 1st-year Cricket induction trial was logged as TRIAL_ATTENDED. Final Club Secretary review pending.", linkUrl: "/clubs/cricket" },
    { userId: rohan.id, title: "Assigned Match Scorer", message: "You are assigned to score Semi-Final 1 (TTN vs CCG) on /scorer.", linkUrl: `/scorer?matchId=${liveCricMatch.id}` },
    { userId: secUser.id, title: "Squad Submission Pending", message: "Bhavani Blasters submitted a Cricket roster for approval.", linkUrl: "/tournaments/current" },
  ]);

  // Pre-seed Facilities & Equipment (Phase 3 tables ready)
  const facRows = await db
    .insert(facilities)
    .values([
      { name: "IIITT Main Cricket Ground", slug: "cricket-ground", sportId: sportBySlug["cricket"].id, status: "OCCUPIED", location: "West Campus Arena" },
      { name: "Main Football Ground", slug: "football-ground", sportId: sportBySlug["football"].id, status: "OPEN", location: "West Campus Arena" },
      { name: "Floodlit Volleyball Court", slug: "volleyball-court", sportId: sportBySlug["volleyball"].id, status: "OPEN", location: "Hostel Sports Quadrangle" },
      { name: "Indoor Badminton Hall", slug: "badminton-court", sportId: sportBySlug["badminton"].id, status: "OCCUPIED", location: "Indoor Complex" },
      { name: "Basketball Court", slug: "basketball-court", sportId: null, status: "OPEN", location: "Hostel Sports Quadrangle" },
      { name: "Table Tennis Hall", slug: "table-tennis-hall", sportId: sportBySlug["table_tennis"].id, status: "OPEN", location: "SAC Floor 1" },
      { name: "IIITT Fitness Gym", slug: "gym", sportId: null, status: "OPEN", location: "Indoor Complex" },
    ])
    .returning();

  await db.insert(facilityConfig).values(
    facRows.map((f) => ({
      facilityId: f.id,
      bookingMode:
        f.slug === "gym"
          ? "CAPACITY_BASED"
          : f.slug === "cricket-ground" || f.slug === "football-ground"
          ? "APPROVAL_REQUIRED"
          : "DIRECT_BOOKING",
      maxCapacity: f.slug === "gym" ? 30 : 1,
      slotDurationMins: 60,
      dailyUserLimit: 1,
      noShowBanHours: 48,
    }))
  );

  await db.insert(equipment).values([
    { name: "SG English Willow Bat #01", sportId: sportBySlug["cricket"].id, itemType: "TRACKED_ASSET", qrCode: "EQ-CRIC-BAT-01", totalQty: 1, availableQty: 1, condition: "AVAILABLE" },
    { name: "Yonex Astrox Racket #04", sportId: sportBySlug["badminton"].id, itemType: "TRACKED_ASSET", qrCode: "EQ-BAD-RKT-04", totalQty: 1, availableQty: 1, condition: "AVAILABLE" },
    { name: "Feather Shuttlecocks (Tube)", sportId: sportBySlug["badminton"].id, itemType: "BULK_CONSUMABLE", qrCode: null, totalQty: 40, availableQty: 36, condition: "AVAILABLE" },
  ]);

  await seedProthymosAuctionIfMissing();
  console.log("[SEED] Completed successfully!");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const shouldReset = process.argv.includes("--reset") || process.env.RESET_DB === "true";
  runSeed({ reset: shouldReset })
    .then(() => pool.end())
    .catch((err) => {
      console.error("[SEED] Failed:", err);
      process.exit(1);
    });
}
