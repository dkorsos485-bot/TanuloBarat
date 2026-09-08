# TanulóBarát – teljes webes projekt

## Indítás Windows alatt

1. Nyisd meg a `D:\TanuloBarat` mappát.
2. Másold ide a projekt fájljait.
3. A mappában nyiss PowerShellt vagy CMD-t.
4. Futtasd:

```text
npm install
npm start
```

5. Böngészőben:
`http://localhost:3000`

Az adatbázis automatikusan létrejön: `tanulobarat.db`.

## Cloudflare Quick Tunnel

A Node szerver fusson először:

```text
npm start
```

Másik ablakban:

```text
cloudflared tunnel --url http://localhost:3000
```

A kapott `https://...trycloudflare.com` címet telefonról is meg lehet nyitni.

## AI

A projekt beépített helyi AI-mintagenerátort tartalmaz, így API-kulcs nélkül is működik a Tananyag/Teszt/Házi feladat funkció.

Ha valódi OpenAI API-t szeretnél használni, állítsd be:

```text
set OPENAI_API_KEY=SAJAT_KULCS
npm start
```

vagy PowerShellben:

```text
$env:OPENAI_API_KEY="SAJAT_KULCS"
npm start
```

A modell alapértelmezésben `gpt-4o-mini`, de az `OPENAI_MODEL` környezeti változóval módosítható.

## Elkészült fő funkciók

- Regisztráció / bejelentkezés
- 5–12. évfolyam
- Profil
- Felhasználókeresés
- Barátkérés
- Beérkező kérések
- Elfogadás / elutasítás
- Barátlista
- Chat
- Üzenetek SQLite mentése
- Automatikus chat-frissítés
- 🧙 AI tananyag
- Tananyag / Teszt / Házi feladat
- Előnézet
- Jóváhagyás és elküldés barátnak
- Tananyag megnyitása
- ⭐ Barátértékelés
- 📊 Tantárgyi jegy
- SQLite adatbázis
- Cloudflare Tunnel kompatibilitás
- Mobilbarát felület
