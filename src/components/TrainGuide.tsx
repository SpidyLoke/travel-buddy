import { Bike, ExternalLink, TriangleAlert } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { destCountry, inJapan, luupHere } from '../lib/destination'
import { COUNTRY_NAME } from '../lib/locale'
import { LUUP_URL } from '../lib/maps'
import { Card, LinkButton, Notice, SectionTitle } from './ui'

interface Topic {
  title: string
  icon: string
  body: ReactNode
}

const TRAIN_TOPICS: Topic[] = [
  {
    icon: '📱',
    title: 'Add Suica to Apple Wallet',
    body: (
      <ol className="list-decimal pl-5 space-y-1">
        <li>Open <b>Wallet</b> → tap <b>+</b> → <b>Transit Card</b> → <b>Suica</b> (or PASMO).</li>
        <li>Choose an amount (¥1,000 minimum) and pay with Apple Pay.</li>
        <li>It becomes your <b>Express Transit</b> card: no Face ID needed at the gate, just hold the top of the iPhone to the reader.</li>
        <li>If an overseas card is declined, try a different card.</li>
      </ol>
    ),
  },
  {
    icon: '💴',
    title: 'Add money to Suica',
    body: (
      <ul className="list-disc pl-5 space-y-1">
        <li><b>Wallet</b> → your Suica → <b>Add Money</b>. Takes seconds.</li>
        <li>Cash: at 7-Eleven, Lawson or FamilyMart, say <b>"Suica charge"</b> (スイカ チャージ), hand over cash and hold the phone on the reader.</li>
        <li>Keep at least ¥1,000 on it for the day. Most short city rides cost a few hundred yen.</li>
      </ul>
    ),
  },
  {
    icon: '🚪',
    title: 'Enter the ticket gate',
    body: (
      <ul className="list-disc pl-5 space-y-1">
        <li>Use a gate showing the IC card symbol. Green arrow = open, red X = no entry from your side.</li>
        <li>Hold your phone flat on the <b>blue reader on the right</b>. Wait for the beep and walk through.</li>
        <li>Gate slams shut or beeps loudly? Step back. Try again, or go to the staffed window (有人改札).</li>
      </ul>
    ),
  },
  {
    icon: '🧭',
    title: 'Find the right direction',
    body: (
      <ul className="list-disc pl-5 space-y-1">
        <li>Signs list the line, then where trains go: <b>渋谷方面</b> = "toward Shibuya".</li>
        <li>Check three things: <b>line colour</b>, <b>line letter</b> (G, H, JY…) and the <b>direction</b>.</li>
        <li>Not sure? Use station codes (below): numbers go up or down along the line.</li>
      </ul>
    ),
  },
  {
    icon: '🚉',
    title: 'Find the platform',
    body: (
      <ul className="list-disc pl-5 space-y-1">
        <li>Inside the gates, follow your line colour, then the platform number (<b>番線</b>) whose sign shows your direction.</li>
        <li>The screens above the platform show the next trains, type (local, rapid, express) and terminal.</li>
        <li>Queue at the floor markings. Let people off first.</li>
      </ul>
    ),
  },
  {
    icon: '🔁',
    title: 'Transfer between lines',
    body: (
      <ul className="list-disc pl-5 space-y-1">
        <li>Follow <b>乗換 / Transfer</b> signs in the new line's colour.</li>
        <li>Same company (e.g. Tokyo Metro → Tokyo Metro): stay inside the gates.</li>
        <li>Different company (e.g. JR → Metro): you pass an orange transfer gate (乗換改札) or exit and re-enter. Tap each time. Suica works the fare out.</li>
      </ul>
    ),
  },
  {
    icon: '⬆️',
    title: 'Exit the station',
    body: (
      <ul className="list-disc pl-5 space-y-1">
        <li><b>Yellow signs = exits</b> (出口). Big stations have dozens, named like A3 or 東口 (East Exit).</li>
        <li>Pick the exit first: Google Maps and the station maps by the platform show which one is nearest.</li>
        <li>Tap your phone on the gate reader again to leave.</li>
      </ul>
    ),
  },
  {
    icon: '🔢',
    title: 'Understand station codes',
    body: (
      <ul className="list-disc pl-5 space-y-1">
        <li>Each station has a code: <b>G19</b> = Ginza Line, station 19 (Asakusa). <b>JY20</b> = JR Yamanote, Shibuya.</li>
        <li>Going from G19 to G14? You need trains heading to lower numbers.</li>
        <li>Codes appear on every station sign and inside trains.</li>
      </ul>
    ),
  },
  {
    icon: '↩️',
    title: 'Boarded the wrong train?',
    body: (
      <ul className="list-disc pl-5 space-y-1">
        <li>Don't panic. Get off at the next station.</li>
        <li>Cross to the platform for the opposite direction (often just across the same platform) and ride back.</li>
        <li>Express train skipped your stop? Get off at its next stop and take a local (各停) back.</li>
        <li>You pay by where you tap in and out, so the detour costs little or nothing.</li>
      </ul>
    ),
  },
  {
    icon: '⚠️',
    title: 'Not enough Suica balance',
    body: (
      <ul className="list-disc pl-5 space-y-1">
        <li>The exit gate closes with a chime. Step back, no drama.</li>
        <li>Top up in <b>Wallet → Add Money</b> right there, then tap again.</li>
        <li>Or use the yellow <b>Fare Adjustment</b> machine (精算機 / のりこし精算) just before the gates.</li>
      </ul>
    ),
  },
]

const SIGNS: [string, string, string][] = [
  ['出口', 'deguchi', 'Exit'],
  ['入口', 'iriguchi', 'Entrance'],
  ['改札', 'kaisatsu', 'Ticket gate'],
  ['乗換', 'norikae', 'Transfer'],
  ['〜方面', 'hōmen', 'Toward / bound for'],
  ['〜番線', 'bansen', 'Platform no.'],
  ['のりば', 'noriba', 'Boarding point'],
  ['各停 / 普通', 'kakutei / futsū', 'Local (all stops)'],
  ['快速', 'kaisoku', 'Rapid (skips some)'],
  ['急行', 'kyūkō', 'Express (skips many)'],
  ['精算', 'seisan', 'Fare adjustment'],
  ['東口 / 西口', 'higashi / nishi-guchi', 'East / West Exit'],
  ['南口 / 北口', 'minami / kita-guchi', 'South / North Exit'],
  ['駅', 'eki', 'Station'],
  ['線', 'sen', 'Line'],
  ['チャージ', 'chāji', 'Top up'],
  ['女性専用車', 'josei senyōsha', 'Women-only car'],
  ['優先席', 'yūsenseki', 'Priority seat'],
]

export function TrainGuide() {
  if (!inJapan()) return <GettingAround />
  return <JapanTrains />
}

function JapanTrains() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div className="pt-safe bottom-nav-space px-4">
      <h1 className="pt-2 text-3xl font-bold tracking-tight">How to use Tokyo trains</h1>
      <p className="mt-1 text-[15px] text-muted">Ten things, short and practical. The same basics work across Japan.</p>
      {!luupHere() && (
        <Notice tone="info">
          Outside the big cities (Fuji Five Lakes, Hakone, Nikkō…) trains and buses run less often, sometimes only once or twice an hour. Check the last departure
          back before you set off, and carry some cash: Suica works on most routes but not every local bus. Taxis wait at main stations.
        </Notice>
      )}
      <Notice tone="info">
        Kyoto, Osaka and Nara: your Suica or PASMO works on trains, subways and most buses there too (the local card is ICOCA; they are interchangeable). Kyoto
        sights are often easier by bus: board through the rear door and tap your card at the front, by the driver, when you get off.
      </Notice>

      <div className="mt-4 space-y-2">
        {TRAIN_TOPICS.map((t, i) => (
          <Card key={t.title} className="overflow-hidden">
            <button className="w-full flex items-center gap-3 p-4 text-left" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
              <span className="text-2xl" aria-hidden>
                {t.icon}
              </span>
              <span className="flex-1 text-[17px] font-semibold">
                {i + 1}. {t.title}
              </span>
            </button>
            {open === i && <div className="px-4 pb-4 -mt-1 text-[15px] leading-relaxed">{t.body}</div>}
          </Card>
        ))}
      </div>

      <SectionTitle>Station signs</SectionTitle>
      <Card className="divide-line">
        {SIGNS.map(([ja, romaji, en]) => (
          <div key={ja} className="flex items-center gap-3 px-4 py-2.5">
            <span className="w-28 shrink-0 text-[19px] font-bold">{ja}</span>
            <span className="flex-1">
              <span className="block text-[15px] font-medium">{en}</span>
              <span className="block text-[12px] text-muted">{romaji}</span>
            </span>
          </div>
        ))}
      </Card>

      <SectionTitle>Etiquette</SectionTitle>
      <Card className="p-4 text-[15px]">
        <ul className="list-disc pl-5 space-y-1">
          <li>Phone on silent, no calls on the train.</li>
          <li>Backpack on your front or on the rack when it's busy.</li>
          <li>Stand on the left on escalators in Tokyo; walk on the right (or just stand).</li>
          <li>Leave priority seats for those who need them.</li>
        </ul>
      </Card>

      {luupHere() && <LuupGuide />}
    </div>
  )
}

interface CountryGuide {
  title: string
  cards: { title: string; body: ReactNode }[]
}

const COUNTRY_GUIDES: Record<string, CountryGuide> = {
  MY: {
    title: 'Getting around Malaysia',
    cards: [
      {
        title: 'Trains in Kuala Lumpur',
        body: (
          <ul className="list-disc pl-5 space-y-1">
            <li><b>LRT, MRT and Monorail</b> (Rapid KL) cover the city; <b>KTM Komuter</b> runs to the suburbs; <b>KLIA Ekspres / Transit</b> to the airport.</li>
            <li>Lines meet at <b>KL Sentral</b>, the main hub. Some "interchanges" are a walk between separate stations: follow the signs and allow 5–10 minutes.</li>
            <li>Peak hours (about 7:30–9:00 and 17:30–19:30) get packed.</li>
          </ul>
        ),
      },
      {
        title: 'Paying',
        body: (
          <ul className="list-disc pl-5 space-y-1">
            <li><b>Touch 'n Go card</b> works on all city trains, most buses and toll roads. Top up at stations or convenience stores.</li>
            <li>Many Rapid KL gates also take contactless bank cards. Otherwise buy a token at the machine.</li>
            <li>Tap in and tap out with the same card.</li>
          </ul>
        ),
      },
      {
        title: 'Grab and taxis',
        body: (
          <ul className="list-disc pl-5 space-y-1">
            <li><b>Grab</b> is the easy default: the price is fixed before you ride. Meet the driver at the pickup point shown in the app.</li>
            <li>Street taxis should use the meter; agree the fare first if they won't.</li>
            <li>In heavy rain or rush hour, Grab prices rise and traffic crawls: the train is often quicker.</li>
          </ul>
        ),
      },
      {
        title: 'Free buses and walking',
        body: (
          <ul className="list-disc pl-5 space-y-1">
            <li><b>GoKL City Bus</b> in central KL and <b>CAT</b> in George Town, Penang are free.</li>
            <li>The covered, air-conditioned walkway links Bukit Bintang and KLCC: about 15–20 minutes on foot, out of the sun and rain.</li>
            <li>Afternoon heat and storms are routine: plan walks for the morning or evening.</li>
          </ul>
        ),
      },
      {
        title: 'On board',
        body: (
          <ul className="list-disc pl-5 space-y-1">
            <li>No eating or drinking on trains and in paid areas; fines apply.</li>
            <li>KTM Komuter has women-only coaches, marked with pink signs.</li>
            <li>Mosques: dress modestly; robes are often provided at visitor entrances.</li>
          </ul>
        ),
      },
    ],
  },
}

const GENERIC: CountryGuide = {
  title: 'Getting around',
  cards: [
    {
      title: 'Public transport',
      body: (
        <ul className="list-disc pl-5 space-y-1">
          <li>Use <b>Navigate</b> on each stop: Google Maps has live routes, times and fares for most cities.</li>
          <li>Ask at your hotel which transport card locals use; many cities also take contactless bank cards at the gate.</li>
        </ul>
      ),
    },
    {
      title: 'Taxis and ride-hailing',
      body: (
        <ul className="list-disc pl-5 space-y-1">
          <li>Grab covers most of Southeast Asia; Uber, Bolt or local apps elsewhere. The price is fixed before you ride.</li>
          <li>Street taxis: insist on the meter, or agree the fare before you get in.</li>
        </ul>
      ),
    },
  ],
}

function GettingAround() {
  const g = COUNTRY_GUIDES[destCountry()] ?? { ...GENERIC, title: `Getting around${COUNTRY_NAME[destCountry()] ? ` ${COUNTRY_NAME[destCountry()]}` : ''}` }
  return (
    <div className="pt-safe bottom-nav-space px-4">
      <h1 className="pt-2 text-3xl font-bold tracking-tight">{g.title}</h1>
      <p className="mt-1 text-[15px] text-muted">The basics for first-timers. Live routes and times are always in Google Maps.</p>
      <div className="mt-4 space-y-2">
        {g.cards.map((c) => (
          <Card key={c.title} className="p-4 text-[15px] space-y-2">
            <div className="text-[17px] font-semibold">{c.title}</div>
            {c.body}
          </Card>
        ))}
      </div>
    </div>
  )
}

function LuupGuide() {
  return (
    <>
      <SectionTitle>LUUP scooters</SectionTitle>
      <div className="space-y-2">
        <Card className="p-4 text-[15px] space-y-2">
          <div className="text-[17px] font-semibold">Train, LUUP or walk?</div>
          <ul className="list-disc pl-5 space-y-1">
            <li><b>Walk</b>: under ~1 km, or anywhere pedestrian-only (Nakamise, Takeshita Street, Cat Street when busy).</li>
            <li><b>LUUP</b>: roughly 1–4 km between areas that need a train transfer, in dry weather, with ports at both ends.</li>
            <li><b>Train</b>: over ~4 km, in rain, when tired, or late at night in crowded areas.</li>
          </ul>
        </Card>
        <Card className="p-4 text-[15px] space-y-2">
          <div className="text-[17px] font-semibold">Start and end a ride</div>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Open LUUP. The map shows ports and how many vehicles each has.</li>
            <li>Pick your <b>return port</b> near your destination before you ride.</li>
            <li>Scan the QR code on the scooter's handlebar to unlock.</li>
            <li>Ride on the road. Park inside the return port's marked area.</li>
            <li>End the ride in the app and take the parking photo it asks for.</li>
          </ol>
          <p className="text-muted text-[13px]">Pricing is an unlock fee plus a per-minute rate, shown in the app before you start. This app can't see live scooter or port availability.</p>
        </Card>
        <Card className="p-4 text-[15px] space-y-2">
          <div className="text-[17px] font-semibold flex items-center gap-2">
            <TriangleAlert size={18} className="text-warn" /> Riding rules in Japan
          </div>
          <ul className="list-disc pl-5 space-y-1">
            <li>Ride on the <b>left</b> side of the road, with traffic. Obey signals.</li>
            <li>Top speed 20 km/h on roads. Pavements only where signed, in 6 km/h pavement mode.</li>
            <li>No pedestrian streets or car-free zones (Ginza and Akihabara on weekend afternoons).</li>
            <li>No alcohol at all. Drink-riding is a criminal offence.</li>
            <li>One person per scooter. No phone or umbrella in hand while riding.</li>
            <li>Helmets are recommended. Lights on after dark.</li>
            <li>Parking outside a LUUP port is not allowed and the rental won't end.</li>
          </ul>
        </Card>
        <LinkButton variant="luup" className="w-full min-h-14 text-[17px]" href={LUUP_URL}>
          <Bike size={20} /> Open LUUP <ExternalLink size={16} />
        </LinkButton>
        <Notice tone="info">Opens LUUP's official site. If the LUUP app is installed, open it from your home screen for the live map.</Notice>
      </div>
    </>
  )
}
