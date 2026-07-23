# Lakepointe Disambiguation Dataset

**Purpose:** Power a noise filter for an internal listening dashboard monitoring mentions of *our* Lakepointe Church (multi-campus, DFW/Dallas area, `lakepointe.church`, Senior Pastor Josh Howerton) and "Josh Howerton." "Lakepointe" / "Lake Pointe" / "Lakepoint" is a common American place-and-business name, so keyword matching pulls in many unrelated entities. Everything below is research-backed with cited URLs.

**Research date:** 2026-07-08
**Researcher note:** Every entity in the main tables was confirmed against a live source (URL cited). Anything I could not confirm is in the *Confidence Notes* section at the bottom, not in the main dataset.

---

## 1. Our entity (the target we WANT to match)

| Attribute | Value | Source |
|---|---|---|
| Current name | Lakepointe Church (one word) | https://lakepointe.church/ |
| Historical / legacy name | Lake Pointe Church (two words) — still used by Yelp, FaithStreet, usachurches, Planet Rockwall directory | https://www.faithstreet.com/church/lake-pointe-baptist-church-rockwall-tx , https://planetrockwall.com/directory/listing/lake-pointe-church |
| Domain | lakepointe.church (also lakepointe.online.church / lakepointe.live) | https://lakepointe.church/locations/ |
| HQ | 701 E. Interstate 30, Rockwall, TX 75087 | https://lakepointe.church/locations/ |
| Founded | 1979, Rowlett TX area (Lake Ray Hubbard); founding pastor Steve Stroope | https://grokipedia.com/page/Lakepointe_Church |
| Senior Pastor | Josh Howerton (joined ~2020; previously The Bridge Church, Nashville) | https://lakepointe.church/josh-howerton/ , https://joshhowerton.com/about/ |
| Affiliation | Southern Baptist | https://www.faithstreet.com/church/lake-pointe-baptist-church-rockwall-tx |

### Current campus list (verified from the church's own Locations page, 2026-05-07 modified)
Source: https://lakepointe.church/locations/ — the page states **"eight campuses, church online, and Lakepointe en Español."**

| Campus | City (address city) | Notes |
|---|---|---|
| Rockwall | Rockwall, TX (701 E. Interstate 30) | HQ / original |
| Mesquite | Mesquite, TX (3540 E. Emporium Cir) | URL alias: `town-east-campus` |
| Firewheel | **Garland, TX** (1201 E. Campbell Rd) | Campus name ≠ city name |
| Forney | Forney, TX (1851 FM 741) | |
| North Dallas | Dallas, TX (777 LBJ Fwy) | |
| East Dallas | Dallas, TX (9150 Garland Rd) | URL alias: `white-rock-campus`; area tags: White Rock, Casa Linda, Forest Hills, Lake Highlands |
| Sunnyvale | Sunnyvale, TX (620 US-80) | |
| Royse City | Royse City, TX (4755 I-30) | |
| Lucas/Allen | Lucas / Allen, TX | "Coming Soon" |
| Lakepointe en Español | Rockwall & North Dallas; also Tamaulipas, Mexico | lpespanol.org |
| Church Online | — | lakepointe.online.church / lakepointe.live |

> ⚠️ Note the discrepancy: the intro sentence says "eight campuses," and older cached search snippets referenced "six campuses." Josh Howerton's own bio pages and third-party profiles still say "six." Treat the campus **count** as fuzzy but the **campus city list above** as verified from the live page.

---

## 2. Collision entities (things we do NOT want to match)

Content volume is a rough estimate (High / Medium / Low) based on how much indexed news/reviews/social each generates. Domains left blank were not verified to a specific primary domain during research.

### 2a. Highest-risk collisions

| Name (exact spelling) | Type | Location | Domain | Content volume | Source |
|---|---|---|---|---|---|
| **Lakepointe Church** | Church (Southern Baptist) — *exact same spelling as ours* | Shelby Township / Macomb, MI (53245 Van Dyke Ave, 48316); Pastor "Scott" | lakepointechurch.org | Medium (active YouTube, Facebook, Instagram, events) | https://lakepointechurch.org/ , https://www.faithstreet.com/church/lakepointe-church-macomb-mi |
| **LakePoint Sports** (a.k.a. LakePoint Sporting Community) | Youth sports complex / tourism | Emerson, GA (261 Stars Way, 30121) | (not verified) | High (news, ~6M annual visitors claimed, Yelp/TripAdvisor/PBR) | https://www.tripadvisor.com/Attraction_Review-g34930-d8459187-Reviews-LakePoint_Sports-Emerson_Georgia.html , https://www.yelp.com/biz/lakepoint-sports-emerson-2 |
| **Lakepoint State Park / Lakepoint Resort State Park** | State park, resort lodge, marina, golf | Eufaula, AL (104 Lakepoint Dr, 36027) | alapark.com/parks/lakepoint-state-park | High (Wikipedia, TripAdvisor, Expedia, travel press) | https://en.wikipedia.org/wiki/Lakepoint_State_Park , https://www.alapark.com/parks/lakepoint-state-park |

### 2b. Senior care / housing

| Name | Type | Location | Domain | Content volume | Source |
|---|---|---|---|---|---|
| LakePointe Senior Care & Rehab Center | Skilled nursing / rehab (134 beds) | Clinton Township, MI (37700 Harper Ave, 48036) | nexcarehealth.com | Medium (reviews on Yelp, US News, Caring.com) | https://www.nexcarehealth.com/search-locations/lakepointe/ |
| Lake Pointe Village | Senior living | Indiana | asccare.com | Low–Medium | https://www.asccare.com/community/lake-pointe-village/ |
| LakePoint (retirement) | Retirement home | Augusta & El Dorado, KS | lakepointks.com | Low | https://www.lakepointks.com/ |

### 2c. Apartments

| Name | Type | Location | Domain | Content volume | Source |
|---|---|---|---|---|---|
| LakePointe Apartments | Apartments | Batavia, OH (4254 Long Lake Dr) | (apartmentratings listing) | Medium (554 reviews) | https://www.apartmentratings.com/oh/batavia/lakepointe-apartments_513752944445103/ |
| Lake Pointe | Apartments | Melbourne, FL (2880 N Wickham Rd) | liveatlakepointeapts.com | Medium (139 reviews) | https://www.apartmentratings.com/fl/melbourne/lake-pointe_321242010732935/ |
| Lake Pointe | Apartments | Tampa, FL | lakepointe.pmiflorida.com | Low–Medium | https://lakepointe.pmiflorida.com/ |
| Lake Pointe Apartments | Apartments | Folsom, CA | (Wheree listing) | Low | https://lake-pointe-apartments.wheree.com/ |
| Lake Pointe Fort Worth | Apartments | Fort Worth, TX | (Wheree listing) | Low–Medium | https://lake-pointe-fort-worth.wheree.com/ |

### 2d. Recreation (golf / marina)

| Name | Type | Location | Domain | Content volume | Source |
|---|---|---|---|---|---|
| Lake Point Golf & Country Club | Golf course | Fort St. John, BC, Canada (Charlie Lake) | lakepoint.ca | Low–Medium | https://lakepoint.ca/ |
| Lake Pointe Marina | Marina (listed CLOSED) | South Rockwood, MI | (Yelp/Marinas.com) | Low | https://marinas.com/view/marina/qpcq9p_Lake_Pointe_Marina_South_Rockwood_MI_United_States |
| **Lake Pointe Marina** | Marina | **Rowlett / Garland, TX (2413 Rowlett Rd)** — geographically inside our church's home area (Lake Ray Hubbard) | (hub.biz listing) | Low content, **high false-positive risk** due to shared geography | https://lake-pointe-marina-tx.hub.biz/ |

### 2e. Schools

| Name | Type | Location | Domain | Content volume | Source |
|---|---|---|---|---|---|
| Lake Pointe Elementary | Public elementary (Lake Travis ISD) | Austin, TX | (LTISD) | Medium | https://www.greatschools.org/texas/austin/9933-Lake-Pointe-Elementary-School/ |
| Lake Pointe Elementary | Public elementary (Eagle Mt-Saginaw ISD) | Fort Worth, TX | lpe.ltisdschools.org (Austin one) | Medium | https://www.greatschools.org/texas/fort-worth/12104-Lake-Pointe-Elementary-School/ |
| Lake Pointe Academy | K-12 (Lake County Schools) | Lake County, FL | lpa.lake.k12.fl.us | Low–Medium | https://lpa.lake.k12.fl.us/ |

### 2f. Residential developments / subdivisions / HOAs

| Name | Location | Content volume | Source |
|---|---|---|---|
| Lakepointe (condo/townhouse) | Wauconda, IL | Low–Medium | https://www.homesbymarco.com/subdivisions/lakepointe_in_wauconda_il |
| Lake Pointe (First Colony HOA) | Sugar Land, TX | Low–Medium | https://www.houstonproperties.com/houston-neighborhoods/lake-pointe |
| LakePointe (Trophy Signature Homes, Community ISD) | Lavon, TX (Collin County) | Low–Medium | https://www.trophysignaturehomes.com/communities/dallas-ft-worth/lavon/lakepointe |
| Lake Pointe (waterfront community) | Star, ID | Low | https://www.buildidaho.com/star-homes-for-sale/lake-pointe-subdivision/ |
| Lakepointe (neighborhood) | Midlothian, VA | Low | https://www.neighborhoods.com/lakepointe-midlothian-va |
| Lake Pointe (neighborhood) | Austin, TX | Low | https://www.realtyaustin.com/listings/neighborhood/tx/austin/lake-pointe |

### 2g. Other churches (name-adjacent)

| Name | Type | Location | Domain | Content volume | Source |
|---|---|---|---|---|---|
| LakePoint Community Church | Church | (location not verified) | lakepointcc.org | Low–Medium | https://lakepointcc.org/ |
| The Pointe Church | Church (name-adjacent, not "Lake Pointe") | Fort Wayne, IN | thepointe.church | Low | https://www.thepointe.church/ |
| **LakePointe City Church** | Church, active YouTube full-service reuploads | **Hot Springs, AR** (confirmed via its own Subsplash app slug `lakepointechurchhotsprin`) | subsplash.com/lakepointechurchhotsprin | Medium (weekly message uploads) | Discovered live in our own YouTube poll data 2026-07-19–21; e.g. https://www.youtube.com/watch?v=5_BhcXg36oQ |
| Lakepoint Church | Church, weekly livestream ("no-e" spelling, distinct from the AL state park / GA sports complex "no-e" family in §3) | Not verified from poll data alone | — | Low–Medium | https://www.youtube.com/watch?v=-EtLNQMSgfg |
| Lake Point Online | Church, online-only branding ("We point people to Jesus...") | Not verified from poll data alone | — | Low | https://www.youtube.com/watch?v=YkjvHgdbO08 |

### 2h. Incidental keyword collisions (not organizations — false-positive triggers only)

These aren't entities to track; they're evidence that the bare keyword phrases still throw false positives beyond the organizations above. Found live in poll data, all matched on the exact `query_matched` phrase shown (not fuzzy):

| Trigger | What it actually is | Matched on | Source |
|---|---|---|---|
| Pokémon Go raid-coordination posts | A real-world Pokémon Go gym/landmark happens to be named "Lake Pointe Church" (not ours) in r/PokemonGoRaids trade posts (e.g. "Hosting groundon...", "Mega Tyranitar add...") | `"Lake Pointe Church"` | e.g. https://www.reddit.com/r/PokemonGoRaids/comments/1l4eak6/hosting_groundon_713881782313/ |
| Rockwall-area local-news human-interest stories | e.g. "Rockwall High School Senior Cheer Spotlight," "Rockwall and Heath High School Cheerleaders welcome back RISD Staff" — "Lake Pointe Church" appears incidentally (sponsor credit / student affiliation), story isn't about the church | `"Lake Pointe Church"` | https://blueribbonnews.com (via Google News) |

---

## 3. Spelling-variant mapping

| Variant | Maps primarily to | Notes |
|---|---|---|
| **Lakepointe** (one word) | **OUR church** (current brand); also the MI church at lakepointechurch.org; LakePointe Senior Care (MI); LakePointe Apartments (Batavia, OH); several subdivisions | Our church's official current styling. **Not unique** — the MI church uses the identical string. |
| **Lake Pointe** (two words) | OUR church's legacy/third-party styling (Yelp, FaithStreet); many apartments, schools, marinas, subdivisions | Highest-volume variant overall and the noisiest. |
| **Lakepoint** (one word, no "e") | Lakepoint State Park (AL); LakePoint Sports (GA); LakePoint retirement (KS); Lake Point Golf (BC) | Our church does **not** use this spelling — a strong (but not perfect) block signal on its own. |
| **LakePoint** (camelCase, no "e") | LakePoint Sports (GA) brand styling; LakePoint Community Church | Marketing styling of the "no-e" entities. |

**Practical implication:** the "no-e" family (`Lakepoint` / `LakePoint`) is almost never our church, but the two big "no-e" entities (GA sports, AL state park) generate a lot of content, so they still need explicit block terms. The "-e" family (`Lakepointe` / `Lake Pointe`) contains both our church and the largest volume of collisions, so those variants **cannot** be filtered on spelling alone — they require the context-term lists below.

---

## 4. Josh Howerton collision findings

**Our Josh Howerton** is consistently the same person across his personal site, the church site, ERLC, Outreach Magazine, and ChurchLeaders coverage: Senior Pastor of Lakepointe Church (Dallas/Rockwall), author, podcaster, formerly of The Bridge Church (Nashville), Union University + Southern Seminary.
Sources: https://joshhowerton.com/about/ , https://lakepointe.church/josh-howerton/ , https://erlc.com/multi_author/josh-howerton/ , https://churchleaders.com/culture/2215123-who-is-josh-howerton-the-pastor-podcaster-and-polarizing.html

**Other people named Josh/Joshua Howerton:** the name is fairly distinctive but **not unique**. Public-records aggregators (e.g., Radaris) list multiple ordinary individuals, and there is at least one unrelated LinkedIn profile ("Josh Howerton – Self-employed"). None of these has a *meaningful public content footprint* that I could confirm would surface in media/social listening.
Sources: https://radaris.com/p/Josh/Howerton/ , https://www.linkedin.com/in/josh-howerton-8a934331/

**REVISED 2026-07-21 — production data has falsified the "low-collision" verdict below.** Two distinct real people named Josh Howerton *do* have a meaningful, live content footprint that surfaces in this dashboard's actual feed:

- **An options-trader "Josh Howerton"** posts day-trading YouTube content under the exact channel name "Josh Howerton" (`#optionstrading #livetrading #daytrading`, Linktree `thejoshhowerton`, site `the-josh-howerton-connect.netlify.app`). Confirmed live, e.g. https://www.youtube.com/watch?v=ABAA5bOj89s , https://www.youtube.com/watch?v=eXWJRf4xR1A — classified `other-church` in `channel_reputation` (soon `wrong-entity`, see Slice 7).
- **A "Josh Howerton" who was (until ~2025-10) a police officer/chief in Farmington, AR** — two Google News articles about his successor "Wilbanks" taking over as Farmington police chief matched our `"Josh Howerton"` keyword search (the outgoing chief's name), confirming a real, distinct public figure of that name. Confirmed live: https://news.google.com/rss/articles/CBMikgFBVV95cUxQMkpORHdnRUhWSGNqRXJFZ2hyNFBDdDd3M3RKM05BeDBEQUpPbzZ0YkY3eExqdDdjMWVGQWZPaVFueG9CN1FtUDhWNzZLTnZ3OEFPYUVKSFNBSkxxc0pDTnFvUlVqOUFJb1Nubm85QVh0ZnRWVmJZRUgwcVl0eTVBZjVDQ3VsS1lhS2ZKblZaQ3Zadw (via nwaonline.com, query_matched `"Josh Howerton"`), https://news.google.com/rss/articles/CBMilAFBVV95cUxPeTR1ZDlYOWl0Z0dsLWFpNjZ2TktFdmhKd0RHNFVYWFVkRHVCRWNIT3VPVTNpSC11Ym9XNlJXQlBqM2hfR2ZFcGxMeHJUbS1rSHdhX0RWaDVHU3BiWE5Xc3BZbl9zajdkN2pKNDdudHhUVVlUSVpMOVExTlBIb2dvOFlIX1FTWFB1MUtneTJCLXJmdEMt (via wcel.nwaonline.com).

**Verdict (revised):** "Josh Howerton" is **not** a low-collision term in practice — it is a common enough full name that at least two unrelated, actively-publishing people share it. The name alone is *not* a safe allow-signal on its own; per-source entity classification (Slice 7's `entity_reputation`) is the correct mitigation, not a context-term list, since these collisions surface as distinct YouTube channels / distinct news subjects rather than as distinguishing vocabulary near the name.

---

## 5. Context vocabulary (copy-pasteable)

```typescript
// Lakepointe listening filter — allow-signals.
// Presence of these terms near a "Lakepointe/Lake Pointe" mention RAISES confidence it's OUR church.
// Research date: 2026-07-08. Verify campus list against https://lakepointe.church/locations/ before shipping.
export const POSITIVE_CONTEXT_TERMS: string[] = [
  // People
  "Howerton",
  "Josh Howerton",
  "Steve Stroope",
  // Domains / handles
  "lakepointe.church",
  "lakepointe.online",
  "lakepointe.live",
  "lpespanol",
  "lpconnect",
  // Campus cities strongly specific to this church
  "Rockwall",
  "Royse City",
  "Forney",
  "Mesquite",
  "Sunnyvale",
  // Regional
  "Lake Ray Hubbard",
  "DFW",
  "Dallas-Fort Worth",
  "Metroplex",
  // Church programs / brand
  "Lakepointe en Espanol",
  "Lakepointe en Español",
  "Strategic Launch Network",
  "Live Free Podcast",
  "Next Step Class",
  "School of Ministry",
  // NOTE: broad terms "Dallas", "Garland", "Fort Worth", "Austin" are intentionally
  // EXCLUDED — they overlap with collision entities (see NEGATIVE list / confidence notes).
];
```

```typescript
// Lakepointe listening filter — block-signals.
// Presence of these terms near a "Lakepointe/Lake Pointe/Lakepoint" mention RAISES confidence it's NOT our church.
// Research date: 2026-07-08.
export const NEGATIVE_CONTEXT_TERMS: string[] = [
  // Spelling that our church never uses (weak-to-strong on its own)
  "Lakepoint", // no trailing "e"
  // GA youth-sports complex
  "Emerson",
  "Cartersville",
  "Acworth",
  "sports complex",
  "Champions Center",
  "tournament",
  "travel ball",
  // AL state park / resort
  "Eufaula",
  "state park",
  "Lake Eufaula",
  "Chattahoochee",
  "lodge",
  "campground",
  "cabins",
  // Senior care / nursing
  "senior care",
  "rehab center",
  "skilled nursing",
  "nursing home",
  "assisted living",
  "retirement",
  "Clinton Township",
  // MI church + facilities cluster
  "Shelby Township",
  "Shelby Twp",
  "Macomb",
  "Van Dyke",
  "South Rockwood",
  // Apartments / rentals
  "apartments",
  "apartment homes",
  "for rent",
  "floor plan",
  "leasing",
  "Batavia",
  "Melbourne, FL",
  "Wickham",
  // Real estate / subdivisions
  "homes for sale",
  "subdivision",
  "HOA",
  "First Colony",
  "Trophy Signature",
  "Wauconda",
  "Sugar Land",
  "Lavon",
  "Midlothian",
  // Golf / marina
  "country club",
  "golf course",
  "tee time",
  "Fort St. John",
  "Charlie Lake",
  "marina",
  "boat slip",
  // Schools
  "elementary",
  "school district",
  "Lake Travis ISD",
  "Eagle Mountain-Saginaw",
  "Lake Pointe Academy",
  // KS retirement
  "El Dorado",
];
```

---

## 6. Confidence notes

**Verified directly against live sources:**
- Our church's current campus city list and the "eight campuses" phrasing (fetched `lakepointe.church/locations/`, page modified 2026-05-07).
- The second, unrelated **Lakepointe Church in Shelby Township / Macomb, MI** — exact same spelling, confirmed via its own site `lakepointechurch.org` (Shelby Twp address, distinct pastor, distinct socials). This is the single most dangerous collision.
- LakePoint Sports (GA), Lakepoint State Park (AL), LakePointe Senior Care (MI), and the apartment/school/subdivision entities — each confirmed via cited third-party or official pages.
- Josh Howerton identity — his personal site, church page, and ERLC all describe the same person.

**Uncertain / could not confirm:**
- **Campus count discrepancy:** live page says "eight campuses" in prose but lists more location tiles (including "Coming Soon" Lucas/Allen), while Howerton's bios and older snippets say "six." Not resolved — treat the count as fuzzy.
- **LakePoint Community Church (lakepointcc.org):** confirmed to exist but I did **not** verify its city/state. Listed as collision but location is unknown.
- **A low-quality biography site (ScholarsLearn)** described "Josh Howerton" as "Senior Pastor of Influencers Churches Global" with US/Australia campuses. This conflicts with every primary source and appears to be an **error/conflation**; I did not treat it as evidence of a distinct notable Josh Howerton. If you want certainty on whether a *second* prominent Josh Howerton exists in ministry, that needs a dedicated check.
- **Exact primary domains** for LakePoint Sports and a few apartment/marina listings were not verified to the canonical site (only to directory/review aggregators), so those domain cells are blank rather than guessed.
- **NEW 2026-07-21 — possible obituary-filter gap:** live poll data has several Google News rows (fallen Dallas/Greenville/Rockwall-area police officers) matched on `"Lake Pointe Church"` with headline phrasing like "Funeral services planned for..." / "Funeral, Procession Tuesday Honors..." — none of these match the existing obituary title patterns (`obituary`, `visitation & funeral`, `funeral information`, `funeral home`), so they are NOT currently excluded. I have **not** read the full article text to confirm whether these are (a) legitimate mentions of our Rockwall church hosting a real funeral, or (b) a different "Lake Pointe Church" entirely — flagging as unresolved rather than guessing. Worth a manual look before deciding whether to widen the obituary title-pattern list or leave these as legitimate feed items.

**Searches that came up empty or thin:**
- "Lake Pointe Church" in Ohio/Georgia/Florida/Tennessee/Louisiana/Missouri/Oxford MS/Wilson NC — no confirmed same-name churches surfaced beyond the MI one and the name-adjacent "The Pointe Church" (Fort Wayne, IN) and "LakePoint Community Church."

**Known overlap hazards to watch (why some obvious terms were excluded from POSITIVE):**
- **Garland, TX** is our Firewheel campus city *and* home to a Lake Pointe Marina (Rowlett Rd).
- **Fort Worth** and **Austin** are TX cities with Lake Pointe Elementary schools — not our campuses.
- **Rowlett, TX** is our church's historical birthplace *and* the marina's area — ambiguous, kept out of both lists.
- **"Dallas"** alone is too broad (North/East Dallas campuses use it, but so would unrelated DFW noise).
```

---

## 7. YouTube channel-reputation snapshot (pre-migration record)

Snapshot of every row in the live `channel_reputation` table, taken 2026-07-21 ahead of Slice 7's migration to the source-scoped `entity_reputation` table (which rewrites `other-church` → `wrong-entity`). Recorded here so this triage knowledge survives independent of the DB table's lifecycle. Classifications reflect human triage via the feed card control unless noted.

**`owned`**
- Lakepointe Church

**`commentary`** (third-party discussion/response — the actual listening signal)
- Andrew Clemons
- Josh Murray Reactions
- Paulogia
- The Rabyd Atheist

**`other-church`** (will become `wrong-entity` in Slice 7 — confirmed NOT us; see §2f/§2g/§4 above for detail on each)
- Josh Howerton *(the options-trader channel, §4)*
- Lake Point Online
- LakePointe City Church
- Lakepoint Church

**`reupload`** (stolen clips/full sermons rehosted, excluded from default feed)
- Biblical Truth Daily
- Christian Living Insights
- Discipled Daily
- Faith with Josh Howerton
- For His glory
- Found Not Lost
- Glimpses of God's Glory
- Howerton Teachings
- Howerton sermons
- Jeff Square
- Jesus Pop Culture Ministries
- Jesus: Light of The World
- Josh Howerton Gospel
- Josh Howerton Message
- Josh Howerton Sermons
- Josh Howerton Teachings
- Josh Howerton Truth Voice
- Josh Howerton teachings
- Kingdom Living Daily
- Lakepointe Church The Voice
- Lakepointe Gospel
- Lyon County Republicans
- OBBM Network TV
- P. Josh Howerton Podcast
- PJH Daily Discipleship
- PJH Faith & Power
- PJH Living by Faith
- PJHT Biblical Wisdom
- PRAYER OASIS
- Pastor Josh Messages
- TheChristianClipsHub
- Views for Jesus

**`unclassified`** (default; shown in feed, needs human triage)
- Between Light and Silence
- Ryan Cunningham
