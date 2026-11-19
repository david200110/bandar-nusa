# Bandar Nusa — Kisah Raka

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/david200110/bandar-nusa/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/david200110/bandar-nusa/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Game open-world 3D berlatar kota pesisir fiktif di Indonesia. Kamu bermain
sebagai Raka, kurir muda yang terlilit utang Rp 1.400.000 kepada Bos Jalak,
penguasa pelabuhan. Satu-satunya jalan keluar: bekerja untuknya — antar paket,
setor uang, curi mobil, kabur dari razia, sampai berurusan dengan gengnya.
Lunasi utang itu, maka kota ini bebas kamu jelajahi sesuka hati.

## Cerita

Raka bukan orang jahat. Ia cuma kurir yang salah mengambil pekerjaan.
Bos Jalak meminjaminya uang, lalu menagihnya dengan bunga yang tidak masuk
akal. Lima pekerjaan berantai menantinya, masing-masing makin berisiko.
Setiap misi yang selesai memotong utang sedikit demi sedikit. Kalau lima
misi tuntas, utang lunas — dan Bandar Nusa jadi milikmu untuk dijelajahi
tanpa beban.

## Cara bermain

| Tombol | Aksi |
| ------ | ---- |
| W A S D / panah | Jalan kaki atau mengemudi |
| Shift | Berlari |
| E | Masuk / keluar mobil |
| F atau klik mouse | Memukul |
| Spasi | Rem tangan |
| Seret mouse | Memutar kamera |
| Roda mouse | Zoom kamera |
| Esc / P | Jeda |
| M | Bisukan suara |

Berjalan kakilah ke penanda misi untuk memulainya. Mobil yang terparkir
bisa diambil — tapi hati-hati, mencuri mobil menaikkan level buronan.

## Misi

Lima misi berantai. Selesaikan satu untuk membuka misi berikutnya.

1. **Paket Pertama** — Rp 150.000
   Antar paket pertama Bos Jalak ke alamat tujuan. Pengenalan kota.
2. **Setoran Kilat** — Rp 250.000
   Antar setoran dalam batas waktu 120 detik. Terlambat berarti gagal.
3. **Mobil Titipan** — Rp 200.000
   Curi sedan merah yang diminta Bos Jalak. Polisi tidak akan senang.
4. **Lolos dari Razia** — Rp 300.000
   Bertahan 60 detik sambil dikejar polisi di level buronan 3.
5. **Utang Lunas** — Rp 500.000
   Kalahkan 3 anggota geng, lalu antar barang terakhir ke dermaga.
   Selesaikan ini dan utang Raka lunas.

Total hadiah misi: Rp 1.400.000 — persis sebesar utang Raka. Uang tunai
tambahan juga tersebar di penjuru kota.

## Fitur

- **Kota prosedural** — jalanan, pasar ikan, pantai, dan dermaga yang
  dibangun dari seed; langit berganti siang dan malam.
- **Kota yang hidup** — mobil lalu-lalang dan pejalan kaki yang
  berlarian kalau ada mobil ngebut di dekatnya.
- **Level buronan 0–5 bintang** — mencuri mobil atau menabrak orang
  menaikkan bintang. Polisi mengejar, menabrak, dan menangkap.
  Tertangkap berarti diantar ke rumah sakit dan dipotong denda 10%.
- **Berkelahi** — pukul anggota geng yang menghalangi jalanmu.
- **HUD dan minimap** — uang, nyawa, bintang buronan, jam, jarak ke
  tujuan, dan spidometer selalu terlihat.
- **Simpan otomatis** — progres tersimpan di localStorage setiap misi
  selesai; tombol Lanjutkan memuatnya kembali.

## Menjalankan

Butuh Node.js 22 atau lebih baru. Tidak ada proses build.

```bash
node serve.ts
```

Lalu buka <http://localhost:8080> di Chrome desktop.

Untuk membuat dossier make.fun:

```bash
MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Teknologi

- Three.js r160 (disertakan di `game/vendor/`) untuk grafis 3D low-poly.
- Semua suara dan musik dibuat langsung dengan WebAudio — tanpa file audio.
- Tanpa build step, tanpa request jaringan saat bermain.
- Semua nama, karakter, kendaraan, dan cerita adalah orisinal dan tidak
  diambil dari Rockstar Games.

## Kredit

Dibangun oleh agen AI untuk bounty "Make GTA 6" di make.fun
(hadiah $1.666 USDC), di bawah lisensi MIT.
