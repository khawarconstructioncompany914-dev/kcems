// ============================================================
// KCEMS · seed dataset — matches the numbers in KCEMS Screens.dc.html
// All money = integer PKR. Timestamps are relative to "now".
// ============================================================

const DAY = 86_400_000
const now = Date.now()
const iso = (d) => new Date(d).toISOString()
const daysAgo = (n) => iso(now - n * DAY)

export function buildSeed() {
  // ---------- Users ----------
  // Demo password for every seeded account is "kcems" (mustChangePassword:false
  // so testing is smooth). Real accounts created by Owner/Admin get a temp
  // password + mustChangePassword:true. In production the password is a bcrypt
  // hash stored server-side — never plain text like this local demo.
  const U = (o) => ({ password: 'kcems', mustChangePassword: false, ...o })
  const users = [
    U({ id: 'u_owner', name: 'Meesam Ali',  username: 'meesamali', phone: '+92 300 8500011', email: 'meesamali@khawar.pk', role: 'owner',   status: 'active' }),
    U({ id: 'u_admin', name: 'Muzamil Ali Sher',   username: 'muzamilalisher', phone: '+92 301 8500033', email: 'muzamilalisher@khawar.pk', role: 'admin',   status: 'active' }),
    U({ id: 'u_fin',   name: 'Tariq Ismail',  username: 'tariqismail',  phone: '+92 301 8500022', email: 'tariqismail@khawar.pk',  role: 'finance', status: 'active' }),

    // All five real head engineers, so the "responsible engineer" picker in the
    // site modal shows the same list here as it does in production.
    U({ id: 'u_ali',  name: 'Ali Khawaja',   username: 'alikhawaja',   phone: '+92 321 4410001', email: 'alikhawaja@khawar.pk',   role: 'engineer', status: 'active' }),
    U({ id: 'u_touf', name: 'Toufeeq Abbas', username: 'toufeeqabbas', phone: '+92 321 4410002', email: 'toufeeqabbas@khawar.pk', role: 'engineer', status: 'active' }),
    U({ id: 'u_zoh',  name: 'Zohaib Hassan', username: 'zohaibhassan', phone: '+92 321 4410003', email: 'zohaibhassan@khawar.pk', role: 'engineer', status: 'active' }),
    U({ id: 'u_shab', name: 'Shabbir Hussain 2',    username: 'shabbirhussain2',    phone: '+92 321 4410004', email: 'shabbirhussain2@khawar.pk',    role: 'engineer', status: 'active' }),
    U({ id: 'u_zahid', name: 'Muhammad Zahid Talib', username: 'muhammadzahidtalib', phone: '+92 321 4410005', email: 'muhammadzahidtalib@khawar.pk', role: 'engineer', status: 'active' }),

    U({ id: 's_faraz',    name: 'Faraz Ahmed',   username: 'faraz',    phone: '+92 300 1234567', role: 'supervisor', status: 'active', engineerId: 'u_ali',  siteId: 'dha6' }),
    U({ id: 's_saqib',    name: 'Saqib Riaz',    username: 'saqib',    phone: '+92 300 2234567', role: 'supervisor', status: 'active', engineerId: 'u_ali',  siteId: 'gulberg' }),
    U({ id: 's_abdullah', name: 'Abdullah Khan', username: 'abdullah', phone: '+92 300 3234567', role: 'supervisor', status: 'active', engineerId: 'u_ali',  siteId: 'emaar_c' }),
    U({ id: 's_hassan',   name: 'Hassan Raza',   username: 'hassan',   phone: '+92 300 4234567', role: 'supervisor', status: 'active', engineerId: 'u_touf', siteId: 'bahria' }),
    U({ id: 's_mubeen',   name: 'Mubeen Akhtar', username: 'mubeen',   phone: '+92 300 5234567', role: 'supervisor', status: 'active', engineerId: 'u_zoh',  siteId: 'emaar_o' }),
    U({ id: 's_rana',     name: 'Rana Waseem',   username: 'rana',     phone: '+92 300 6234567', role: 'supervisor', status: 'active', engineerId: 'u_zoh',  siteId: 'parkview' }),
  ]

  // ---------- Sites ----------
  // openingSpend = approved spend booked before the live demo window,
  // broken down by category so the site-detail bars match the mock.
  const sites = [
    { id: 'dha6',     name: 'DHA Phase 6',        label: 'DHA 6',     city: 'Lahore',  phase: 'Grey structure', engineerId: 'u_ali',  budget: 2_400_000, status: 'active',
      openingSpend: { materials: 1_000_000, labour: 461_500, fuel: 120_000, tea_food: 51_000, other: 0 } },
    { id: 'gulberg',  name: 'Gulberg Heights',    label: 'Gulberg',   city: 'Lahore',  phase: 'Foundation',     engineerId: 'u_ali',  budget: 1_800_000, status: 'active',
      openingSpend: { materials: 512_000, labour: 190_000, fuel: 44_000, tea_food: 12_000, other: 0 } },
    { id: 'emaar_c',  name: 'Emaar Canyon Views', label: 'Emaar',     city: 'Lahore',  phase: 'Finishing',      engineerId: 'u_ali',  budget: 3_200_000, status: 'active',
      openingSpend: { materials: 1_840_000, labour: 620_000, fuel: 88_000, tea_food: 41_000, other: 0 } },
    { id: 'bahria',   name: 'Bahria Orchard',     label: 'Bahria',    city: 'Lahore',  phase: 'Grey structure', engineerId: 'u_touf', budget: 1_500_000, status: 'active',
      openingSpend: { materials: 402_000, labour: 150_000, fuel: 60_000, tea_food: 18_000, other: 0 } },
    { id: 'emaar_o',  name: 'Emaar Oceanfront',   label: 'Emaar',     city: 'Karachi', phase: 'Grey structure', engineerId: 'u_zoh',  budget: 2_900_000, status: 'active',
      openingSpend: { materials: 980_000, labour: 410_000, fuel: 95_000, tea_food: 30_000, other: 0 } },
    { id: 'parkview', name: 'Park View City',     label: 'Park View', city: 'Lahore',  phase: 'Foundation',     engineerId: 'u_zoh',  budget: 2_100_000, status: 'on_hold',
      openingSpend: { materials: 220_000, labour: 96_000, fuel: 22_000, tea_food: 8_000, other: 0 } },
  ]

  // ---------- Fund transactions ----------
  // Faraz: funds_in totals 120,000 → cash = 120,000 − 77,500 approved = 42,500 (matches mobile home)
  const funds = [
    { id: 'f1', supervisorId: 's_faraz', type: 'funds_in', method: 'cash',   amount: 80_000, byUserId: 'u_owner', note: 'Opening float — DHA 6', createdAt: daysAgo(18) },
    { id: 'f2', supervisorId: 's_faraz', type: 'funds_in', method: 'online', amount: 40_000, byUserId: 'u_fin',   note: 'Top-up',              createdAt: daysAgo(6) },

    { id: 'f3', supervisorId: 's_saqib',    type: 'funds_in', method: 'cash',   amount: 90_000, byUserId: 'u_owner', note: 'Opening float — Gulberg', createdAt: daysAgo(15) },
    { id: 'f4', supervisorId: 's_abdullah', type: 'funds_in', method: 'cheque', amount: 150_000, byUserId: 'u_fin',  note: 'Finishing phase float',    createdAt: daysAgo(12) },
    { id: 'f5', supervisorId: 's_hassan',   type: 'funds_in', method: 'online', amount: 70_000, byUserId: 'u_fin',   note: 'Opening float — Bahria',   createdAt: daysAgo(10) },
    { id: 'f6', supervisorId: 's_mubeen',   type: 'funds_in', method: 'cash',   amount: 110_000, byUserId: 'u_owner', note: 'Opening float',           createdAt: daysAgo(9) },
    { id: 'f7', supervisorId: 's_rana',     type: 'funds_in', method: 'online', amount: 60_000, byUserId: 'u_fin',   note: 'Opening float — Park View', createdAt: daysAgo(8) },
  ]

  // ---------- Expenses ----------
  const E = (o) => ({ billImageUrl: 'bill', rejectReason: null, returnNote: null, settledAt: null, decidedAt: null, ...o })
  const expenses = [
    // Faraz (DHA 6) — drives the mobile screens
    E({ id: 'e_cement',  supervisorId: 's_faraz', siteId: 'dha6', amount: 12_000, category: 'materials', note: 'Cement — 50 bags',      status: 'approved',        createdAt: daysAgo(0), decidedAt: daysAgo(0) }),
    E({ id: 'e_sand',    supervisorId: 's_faraz', siteId: 'dha6', amount: 9_500,  category: 'materials', note: 'River sand — 6 trolleys, plaster', status: 'engineer_review', createdAt: daysAgo(0) }),
    E({ id: 'e_steel',   supervisorId: 's_faraz', siteId: 'dha6', amount: 48_000, category: 'materials', note: 'Steel — 2 ton',         status: 'approved',        createdAt: daysAgo(11), decidedAt: daysAgo(10) }),
    E({ id: 'e_labadv',  supervisorId: 's_faraz', siteId: 'dha6', amount: 17_500, category: 'labour',    note: 'Labour advance',        status: 'approved',        createdAt: daysAgo(14), decidedAt: daysAgo(14) }),
    E({ id: 'e_diesel',  supervisorId: 's_faraz', siteId: 'dha6', amount: 3_200,  category: 'fuel',      note: 'Diesel — 40L',          status: 'rejected',        createdAt: daysAgo(3), decidedAt: daysAgo(2), rejectReason: 'Wrong site — fuel logged against DHA 6 but delivered to Gulberg.' }),

    // Ali's other supervisors → engineer_review queue
    E({ id: 'e_ply',     supervisorId: 's_abdullah', siteId: 'emaar_c', amount: 24_000, category: 'materials', note: 'Shuttering ply — 12 sheets', status: 'engineer_review', createdAt: daysAgo(1) }),
    E({ id: 'e_wire',    supervisorId: 's_saqib',    siteId: 'gulberg', amount: 6_800,  category: 'materials', note: 'Rebar tie wire — 40kg',      status: 'engineer_review', createdAt: daysAgo(1) }),

    // Passed up → finance_review queue (across engineers; finance sees all)
    E({ id: 'e_gulcement', supervisorId: 's_saqib',  siteId: 'gulberg',  amount: 52_000, category: 'materials', note: 'Cement — 120 bags', status: 'finance_review', createdAt: daysAgo(2) }),
    E({ id: 'e_genfuel',   supervisorId: 's_hassan', siteId: 'bahria',   amount: 15_600, category: 'fuel',      note: 'Generator diesel — week', status: 'finance_review', createdAt: daysAgo(2) }),
    E({ id: 'e_wages',     supervisorId: 's_rana',   siteId: 'parkview', amount: 88_000, category: 'labour',    note: 'Labour wages — week 28', status: 'finance_review', createdAt: daysAgo(1) }),
    E({ id: 'e_tiles',     supervisorId: 's_mubeen', siteId: 'emaar_o',  amount: 41_500, category: 'materials', note: 'Floor tiles — 400 sq ft', status: 'finance_review', createdAt: daysAgo(1) }),

    // A returned item (engineer sent back to fix)
    E({ id: 'e_returned',  supervisorId: 's_saqib', siteId: 'gulberg', amount: 4_200, category: 'tea_food', note: 'Site tea & snacks', status: 'returned', createdAt: daysAgo(2), returnNote: 'Attach a clearer photo of the bill — total is unreadable.' }),

    // extra approved history (for reports / people cash math)
    E({ id: 'e_h1', supervisorId: 's_saqib',    siteId: 'gulberg',  amount: 16_000, category: 'materials', note: 'Sand — 10 trolleys', status: 'approved', createdAt: daysAgo(6), decidedAt: daysAgo(5) }),
    E({ id: 'e_h2', supervisorId: 's_abdullah', siteId: 'emaar_c',  amount: 33_500, category: 'materials', note: 'Paint — 15 gallons', status: 'approved', createdAt: daysAgo(7), decidedAt: daysAgo(6) }),
    E({ id: 'e_h3', supervisorId: 's_hassan',   siteId: 'bahria',   amount: 21_000, category: 'labour',    note: 'Mason wages',        status: 'approved', createdAt: daysAgo(9), decidedAt: daysAgo(8) }),
    E({ id: 'e_h4', supervisorId: 's_mubeen',   siteId: 'emaar_o',  amount: 12_400, category: 'fuel',      note: 'Transport — material haul', status: 'approved', createdAt: daysAgo(4), decidedAt: daysAgo(3) }),
  ]

  return {
    users,
    sites,
    funds,
    expenses,
    audit: [],
    session: null, // logged-out
  }
}
