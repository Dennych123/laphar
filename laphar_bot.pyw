"""Laphar bot - nagih laporan harian tiap laptop nyala, diisi lewat form klik.

Data = file backup TXT laphar (laphar_data.txt di folder ini). Edit/export lewat
web app lokal di folder laphar/ (--edit), atau import ke
https://dennych123.github.io/laphar/ lewat Data > Import > Cancel (= merge bulan).

  pythonw laphar_bot.pyw              jalan biasa (diam kalau tidak ada tunggakan)
  pythonw laphar_bot.pyw --buka       dibuka manual (Laphar Bot.bat): hari ini ikut bisa diisi
  python  laphar_bot.pyw --edit       web app laphar lokal, langsung ke laphar_data.txt (Laphar Edit.bat)
  python  laphar_bot.pyw 2026-10-05   pura-pura hari ini tanggal itu (buat coba)
  python  laphar_bot.pyw --install    auto-start saat login (--uninstall untuk cabut)
  python  laphar_bot.pyw --test       self-check
"""
import datetime as dt
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "laphar_data.txt")
URL = "http://127.0.0.1:8765"  # web app lokal (--edit)
NAG_MENIT = 30  # jendela ditutup tanpa diisi -> muncul lagi tiap segini
PROJEK_TERAKHIR = 6  # jumlah tombol projek yang terakhir dipakai
MASUK, PULANG, PULANG_WEEKEND = 7 * 60 + 30, 16 * 60 + 30, 15 * 60 + 30
STD_NONOP = {"Meeting Pagi": 15, "Toilet": 20, "5MK": 10}
HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]


def load():
    with open(DATA, encoding="utf-8") as f:
        return json.load(f)


def save(db):
    tmp = DATA + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2, ensure_ascii=False)
    os.replace(tmp, DATA)


def history(db):
    """Semua hari yang ada di data, terbaru dulu."""
    for ym in sorted(db["months"], reverse=True):
        y, m = map(int, ym.split("-"))
        days = db["months"][ym]["days"]
        for k in sorted(days, key=int, reverse=True):
            yield dt.date(y, m, int(k)), days[k]


def day_of(db, date):
    return db["months"].get(f"{date:%Y-%m}", {}).get("days", {}).get(str(date.day))


def op_min(day):
    return sum(sum(o["items"].values()) for o in day["operations"]) if day else 0


def known_projects(db):
    """(nomor, nama), yang terakhir dipakai dulu, lalu sisa master project."""
    used = [(o["projectNumber"], o["projectName"]) for _, day in history(db) for o in day["operations"]]
    return list(dict.fromkeys(used + [(p["number"], p["name"]) for p in db["masterProjects"]]))


def last_item(db, name):
    for _, day in history(db):
        for o in day["operations"]:
            if o["projectName"] == name and o["items"]:
                return next(iter(o["items"]))
    return db["opItems"][0]


def menit(teks):
    m = re.fullmatch(r"\s*(\d{1,2})[.:](\d{2})\s*", teks)
    if not m:
        raise ValueError(f"Jam '{teks}' tidak valid, pakai format 16.30")
    return int(m[1]) * 60 + int(m[2])


def jam(mnt):
    return f"{mnt // 60:02d}.{mnt % 60:02d}"


def kerangka(date, masuk, pulang):
    """(non-op, jatah menit operasi, target, catatan lembur) untuk jam kerja tersebut."""
    weekend = date.weekday() >= 5
    lama = pulang - masuk
    non = {} if weekend else dict(STD_NONOP)
    jatah = (lama - 60 if lama > 300 else lama) - sum(non.values())  # potong istirahat 1 jam
    if jatah <= 0:
        raise ValueError("Jam pulang harus cukup jauh setelah jam masuk.")
    note = (f"lembur {HARI[date.weekday()].lower()} {jam(masuk)}-{jam(pulang)}" if weekend
            else f"lembur s.d {jam(pulang)}" if pulang > PULANG else "")
    return non, jatah, 420 if weekend else 480, note


def build_day(date, masuk, pulang, lines):
    """lines = [(nomor, nama, item, menit)] -> isi satu hari format laphar."""
    non, _, target, note = kerangka(date, masuk, pulang)
    ops = {}
    for nomor, nama, item, mnt in lines:
        items = ops.setdefault((nomor, nama), {})
        items[item] = items.get(item, 0) + mnt
    return {"operations": [{"projectNumber": k[0], "projectName": k[1], "items": v} for k, v in ops.items()],
            "nonOperations": non, "target": target, "note": note}


def pending(db, today):
    """Tanggal setelah yang terakhir beres s.d. kemarin, yang belum ada menit operasinya."""
    done = db.get("botDone")
    done = dt.date.fromisoformat(done) if done else next(
        (d for d, day in history(db) if op_min(day)), today - dt.timedelta(2))
    days = (done + dt.timedelta(n) for n in range(1, (today - done).days))
    return [d for d in days if not op_min(day_of(db, d))]


def gui(today, manual=False):
    import tkinter as tk
    from tkinter import messagebox, ttk
    if not os.path.exists(DATA):
        tk.Tk().withdraw()
        messagebox.showerror("Laphar Bot", f"File data tidak ada:\n{DATA}")
        return
    db = load()
    if not pending(db, today):
        if manual:  # saat startup diam saja; kalau dibuka sendiri, kasih tahu
            tk.Tk().withdraw()
            messagebox.showinfo("Laphar Bot", "Laporan sudah lengkap, tidak ada yang perlu diisi.")
        return
    root = tk.Tk()
    root.title("Laphar Bot")
    root.attributes("-topmost", True)
    root.resizable(False, False)
    pad = {"padx": 8, "pady": 4}
    proj, nomor, item, mnt = tk.StringVar(), tk.StringVar(), tk.StringVar(), tk.StringVar()
    masuk, pulang, status = tk.StringVar(), tk.StringVar(), tk.StringVar()
    day, kenal, lines = None, {}, []  # lines = [(nomor, nama, item, menit)]

    judul = ttk.Label(root, font=("Segoe UI", 12, "bold"))
    judul.pack(anchor="w", **pad)

    f_proj = ttk.LabelFrame(root, text="Projek (terakhir dipakai, atau pilih dari daftar / ketik nama baru)")
    f_proj.pack(fill="x", **pad)
    f_recent = ttk.Frame(f_proj)
    f_recent.pack(fill="x", padx=4, pady=2)
    f_recent.columnconfigure((0, 1), weight=1, uniform="p")
    f_lain = ttk.Frame(f_proj)
    f_lain.pack(fill="x", padx=4, pady=4)
    combo = ttk.Combobox(f_lain, textvariable=proj, width=44)
    combo.pack(side="left")
    ttk.Label(f_lain, text=" No.").pack(side="left")
    ttk.Entry(f_lain, textvariable=nomor, width=12).pack(side="left")

    f_item = ttk.LabelFrame(root, text="Kerjaan")
    f_item.pack(fill="x", **pad)
    for i, nama in enumerate(db["opItems"]):
        ttk.Radiobutton(f_item, text=nama, value=nama, variable=item).grid(row=i // 2, column=i % 2, sticky="w", padx=6)

    f_jam = ttk.Frame(root)
    f_jam.pack(fill="x", **pad)
    for teks, var in (("Masuk", masuk), ("Pulang", pulang), ("Menit", mnt)):
        ttk.Label(f_jam, text=teks).pack(side="left")
        ttk.Entry(f_jam, textvariable=var, width=6).pack(side="left", padx=(2, 10))

    daftar = tk.Listbox(root, height=3)
    daftar.pack(fill="x", **pad)
    ttk.Label(root, textvariable=status).pack(anchor="w", **pad)
    f_btn = ttk.Frame(root)
    f_btn.pack(fill="x", **pad)

    def coba(fn):
        def run():
            try:
                fn()
            except ValueError as e:
                messagebox.showwarning("Laphar Bot", str(e), parent=root)
        return run

    def on_proj(*_):
        nama = proj.get().strip()
        nomor.set(kenal.get(nama, "tidak tau" if nama else ""))
        if nama in kenal:
            item.set(last_item(db, nama))

    def on_jam(*_):
        try:
            non, jatah, target, _ = kerangka(day, menit(masuk.get()), menit(pulang.get()))
        except ValueError as e:
            status.set(str(e))
            return
        pakai = sum(l[3] for l in lines)
        mnt.set(max(jatah - pakai, 0))
        status.set(f"Terisi {pakai} dari {jatah} menit operasi (+ non-op {sum(non.values())}, target {target})")

    def segar():
        daftar.delete(0, "end")
        for _, nama, kerja, m in lines:
            daftar.insert("end", f"{nama} - {kerja} {m}")
        on_jam()

    def baris():
        """Baris dari pilihan di form sekarang."""
        nama = proj.get().strip()
        if not nama or not item.get():
            raise ValueError("Pilih projek dan kerjaannya dulu.")
        if not mnt.get().strip().isdigit() or int(mnt.get()) <= 0:
            raise ValueError("Menit harus angka lebih dari 0.")
        return nomor.get().strip() or "tidak tau", nama, item.get(), int(mnt.get())

    def tambah():
        lines.append(baris())
        proj.set("")
        segar()

    def hapus():
        pilih = daftar.curselection() or range(len(lines))[-1:]  # tidak ada yang dipilih -> baris terakhir
        for i in reversed(pilih):
            del lines[i]
        segar()

    def sama():
        weekend = day.weekday() >= 5
        isi = next((i for d, i in history(db) if d < day and (d.weekday() >= 5) == weekend and op_min(i)), None)
        if not isi:
            raise ValueError("Belum ada hari sebelumnya yang bisa disalin.")
        lines[:] = [(o["projectNumber"], o["projectName"], k, v) for o in isi["operations"] for k, v in o["items"].items()]
        proj.set("")
        segar()

    def simpan():
        semua = lines + ([baris()] if proj.get().strip() or not lines else [])
        selesai(build_day(day, menit(masuk.get()), menit(pulang.get()), semua))

    def izin():
        target = 420 if day.weekday() >= 5 else 480
        selesai({"operations": [], "nonOperations": {"Izin": target}, "target": target, "note": "izin"})

    def selesai(isi=None):
        """Simpan isi hari ini (None = libur, dilewati) lalu lanjut ke hari berikutnya."""
        if isi:
            month = db["months"].setdefault(f"{day:%Y-%m}", {"days": {}, "parafLeader": "", "parafForeman": ""})
            month["days"][str(day.day)] = isi
        db["botDone"] = day.isoformat()
        save(db)
        buka()

    def buka():
        """Tampilkan hari tertua yang belum diisi, atau tutup kalau sudah lunas."""
        nonlocal day
        todo = pending(db, today)
        if not todo:
            messagebox.showinfo("Laphar Bot", "Lunas!\nMau ubah atau export PDF/Excel: buka Laphar Edit.bat.", parent=root)
            root.destroy()
            return
        day = todo[0]
        weekend = day.weekday() >= 5
        judul.config(text=f"{HARI[day.weekday()]} {day.day} {BULAN[day.month - 1]}: "
                          f"{'lembur? (Libur kalau tidak)' if weekend else 'ngerjain apa?'}   [{len(todo)} hari belum diisi]")
        projek = known_projects(db)
        kenal.clear()
        kenal.update({nama: no for no, nama in reversed(projek)})
        combo.config(values=[nama for _, nama in projek])
        for w in f_recent.winfo_children():
            w.destroy()
        for i, (_, nama) in enumerate(projek[:PROJEK_TERAKHIR]):
            ttk.Button(f_recent, text=nama, command=lambda n=nama: proj.set(n)).grid(
                row=i // 2, column=i % 2, sticky="ew", padx=2, pady=2)
        lines.clear()
        proj.set("")
        item.set("")
        masuk.set(jam(MASUK))
        pulang.set(jam(PULANG_WEEKEND if weekend else PULANG))
        segar()

    # ponytail: nagih cuma selama proses hidup (tiap NAG_MENIT sampai lunas, atau tombol Keluar).
    # Laptop yang cuma di-sleep tidak memicu startup lagi; kalau perlu, tambah Task Scheduler harian.
    def tunda():
        root.withdraw()
        root.after(NAG_MENIT * 60_000, root.deiconify)

    ttk.Button(f_jam, text="+ Projek lain di hari ini", command=coba(tambah)).pack(side="left")
    ttk.Button(f_jam, text="Hapus baris", command=hapus).pack(side="left", padx=4)
    for teks, fn in (("Simpan", simpan), ("Sama seperti hari terakhir", sama), ("Izin", izin), ("Libur", selesai)):
        ttk.Button(f_btn, text=teks, command=coba(fn)).pack(side="left", padx=2)
    ttk.Button(f_btn, text="Keluar", command=root.destroy).pack(side="right", padx=2)

    proj.trace_add("write", on_proj)
    masuk.trace_add("write", on_jam)
    pulang.trace_add("write", on_jam)
    root.protocol("WM_DELETE_WINDOW", tunda)
    buka()
    root.mainloop()


def edit():
    """Sajikan web app laphar (folder laphar/) yang baca-tulis langsung ke laphar_data.txt."""
    import functools
    import http.server
    import webbrowser

    class Handler(http.server.SimpleHTTPRequestHandler):
        def do_GET(self):
            if self.path == "/sw.js":  # service worker men-cache /data dan file web: jangan dipakai di lokal
                return self.send_error(404)
            if self.path != "/data":
                return super().do_GET()
            with open(DATA, "rb") as f:
                body = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self):
            # situs lain di browser juga bisa POST ke localhost: terima hanya dari halaman ini sendiri
            db = None
            if self.path == "/data" and self.headers.get("Origin") == URL:
                try:
                    db = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                except (ValueError, TypeError):
                    pass
            ok = isinstance(db, dict) and isinstance(db.get("months"), dict)
            if ok:
                save(db)
            self.send_response(204 if ok else 403)
            self.end_headers()

        def log_message(self, *args):
            pass

    host, port = URL.split("//")[1].split(":")
    web = os.path.join(HERE, "laphar")  # web app di subfolder, atau sefolder dengan bot (isi repo)
    try:
        server = http.server.ThreadingHTTPServer(
            (host, int(port)), functools.partial(Handler, directory=web if os.path.isdir(web) else HERE))
    except OSError:  # sudah jalan dari klik sebelumnya
        webbrowser.open(URL)
        return
    webbrowser.open(URL)
    print(f"Laphar lokal jalan di {URL}\nData: {DATA}\nTutup jendela ini kalau sudah selesai edit.")
    server.serve_forever()


def install(on):
    import winreg
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run",
                        0, winreg.KEY_SET_VALUE) as key:
        if on:
            pythonw = os.path.join(os.path.dirname(sys.executable), "pythonw.exe")
            winreg.SetValueEx(key, "LapharBot", 0, winreg.REG_SZ, f'"{pythonw}" "{os.path.abspath(__file__)}"')
        else:
            winreg.DeleteValue(key, "LapharBot")


def demo():
    rabu, sabtu = dt.date(2026, 10, 7), dt.date(2026, 10, 3)
    a, b = ("1111-M001", "Mesin A"), ("2222-M002", "Mesin B")
    assert menit("16.30") == 990 and jam(990) == "16.30"
    assert kerangka(rabu, MASUK, PULANG) == (STD_NONOP, 435, 480, "")
    assert kerangka(rabu, MASUK, menit("20.00"))[1:] == (645, 480, "lembur s.d 20.00")
    assert kerangka(sabtu, MASUK, menit("16.30")) == ({}, 480, 420, "lembur sabtu 07.30-16.30")
    assert kerangka(sabtu, menit("13.00"), menit("16.30"))[1] == 210  # setengah hari, tanpa potong istirahat
    hari = build_day(rabu, MASUK, PULANG, [(*a, "Debugging", 195), (*b, "Trial", 140), (*a, "Trial", 100)])
    assert hari == {"operations": [{"projectNumber": a[0], "projectName": a[1], "items": {"Debugging": 195, "Trial": 100}},
                                   {"projectNumber": b[0], "projectName": b[1], "items": {"Trial": 140}}],
                    "nonOperations": STD_NONOP, "target": 480, "note": ""}
    db = {"masterProjects": [{"number": "0", "name": "Mesin C"}, {"number": b[0], "name": b[1]}],
          "opItems": ["Preparation"],
          "months": {"2026-09": {"days": {"29": build_day(rabu, MASUK, PULANG, [(*b, "Trial", 435)]), "30": hari}}}}
    assert known_projects(db) == [a, b, ("0", "Mesin C")]
    assert last_item(db, b[1]) == "Trial" and last_item(db, "Mesin C") == "Preparation"
    assert pending(db, dt.date(2026, 10, 5)) == [dt.date(2026, 10, n) for n in (1, 2, 3, 4)]
    assert pending(db, dt.date(2026, 10, 1)) == []


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    if arg == "--test":
        demo()
        print("ok")
    elif arg in ("--install", "--uninstall"):
        install(arg == "--install")
        print("auto-start", "aktif" if arg == "--install" else "dicabut")
    elif arg == "--edit":
        edit()
    elif arg == "--buka":  # "hari ini" digeser sehari supaya hari ini ikut masuk daftar
        gui(dt.date.today() + dt.timedelta(1), manual=True)
    else:
        gui(dt.date.fromisoformat(arg) if arg else dt.date.today())
