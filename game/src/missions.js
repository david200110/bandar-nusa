// The story of Bandar Nusa: Raka, a young courier, owes a debt to Bos Jalak,
// a harbour boss who collects through fear. Five jobs pay the debt off, one by
// one. Every name, place and line here is invented for this game.
// Stage types: goto (reach a marker), steal (take the marked car), survive
// (stay free while the clock runs), defeat (beat the gang members), deliver
// (reach a marker carrying the package).
import { CITY, MONEY } from './config.js';

export const STORY_INTRO =
  'Raka, kurir muda Bandar Nusa, berutang Rp 1.400.000 pada Bos Jalak. ' +
  'Lima pekerjaan — antar paket, kejar setoran, curi mobil, lolos dari razia — ' +
  'dan utang itu lunas. Kerjakan misinya satu per satu. Hati-hati dengan polisi.';

export const MISSIONS = [
  {
    id: 'paket-pertama',
    title: 'Misi 1 — Paket Pertama',
    contact: 'Dodi (Bengkel)',
    briefing:
      'Raka, Bos Jalak mau lihat kau bisa kerja. Ambil paket di Warung Bu Sari, ' +
      'antar ke Dermaga Nusa. Jangan macam-macam di jalan.',
    reward: MONEY.missionReward[0],
    stages: [
      { type: 'goto', target: CITY.places.warung, text: 'Ambil paket di Warung Bu Sari' },
      { type: 'deliver', target: CITY.places.dermaga, text: 'Antar paket ke Dermaga Nusa' },
    ],
  },
  {
    id: 'setoran-kilat',
    title: 'Misi 2 — Setoran Kilat',
    contact: 'Bu Sari (Warung)',
    briefing:
      'Setoran pasar harus sampai ke Hotel Nusa Raya sebelum tamu penting datang. ' +
      'Kau punya 120 detik. Mobil lebih cepat daripada kaki, Raka.',
    reward: MONEY.missionReward[1],
    timeLimit: 120,
    stages: [
      { type: 'goto', target: CITY.places.pasar, text: 'Ambil setoran di Pasar Ikan' },
      { type: 'deliver', target: CITY.places.hotel, text: 'Antar setoran ke Hotel Nusa Raya' },
    ],
  },
  {
    id: 'mobil-titipan',
    title: 'Misi 3 — Mobil Titipan',
    contact: 'Dodi (Bengkel)',
    briefing:
      'Ada sedan merah parkir di dekat Pasar Ikan. Bos Jalak "meminjamnya". ' +
      'Bawa ke bengkelku. Mencuri mobil itu menaikkan bintang buronanmu — ' +
      'jadi jangan sampai ketangkap.',
    reward: MONEY.missionReward[2],
    stages: [
      { type: 'steal', target: { x: 67, z: 30, label: 'Sedan merah' }, text: 'Curi sedan merah di dekat Pasar Ikan (tekan E)' },
      { type: 'deliver', target: CITY.places.bengkel, text: 'Bawa mobilnya ke Bengkel Dodi' },
    ],
  },
  {
    id: 'lolos-razia',
    title: 'Misi 4 — Lolos dari Razia',
    contact: 'Dodi (Bengkel)',
    briefing:
      'Polisi menggelar razia besar malam ini dan namamu ada di daftar. ' +
      'Bertahan 60 detik tanpa tertangkap. Sembunyi, ngebut, apa saja — asal bebas.',
    reward: MONEY.missionReward[3],
    stages: [
      { type: 'survive', seconds: 60, text: 'Bertahan dari kejaran polisi selama 60 detik' },
    ],
  },
  {
    id: 'utang-lunas',
    title: 'Misi 5 — Utang Lunas',
    contact: 'Bos Jalak',
    briefing:
      'Anak buahku menunggu di Gudang Pelabuhan. Bereskan mereka, lalu antar ' +
      'paket terakhir ke Dermaga. Setelah ini, utangmu lunas, Raka.',
    reward: MONEY.missionReward[4],
    stages: [
      { type: 'defeat', target: CITY.places.gudang, text: 'Kalahkan 3 anak buah Bos Jalak di Gudang Pelabuhan' },
      { type: 'deliver', target: CITY.places.dermaga, text: 'Antar paket terakhir ke Dermaga Nusa' },
    ],
  },
];

export const STORY_COMPLETE =
  'Utang lunas. Matahari terbit di atas Dermaga Nusa, dan Raka akhirnya bebas — ' +
  'kota ini miliknya lagi. Terima kasih sudah bermain. Mode bebas masih terbuka: ' +
  'jelajahi Bandar Nusa, kumpulkan uang, dan jaga jarak dari polisi.';

// The current objective line for the HUD: what to do, where, and how far.
export function objectiveText(mission, stage, playerX, playerZ) {
  if (!mission || !stage) return { text: 'Bebas — jelajahi Bandar Nusa. Tekan E di dekat mobil untuk mengemudi.', target: null, distance: 0 };
  const target = stage.target ?? null;
  const distance = target ? Math.round(Math.hypot(target.x - playerX, target.z - playerZ)) : 0;
  return { text: stage.text, target, distance };
}
