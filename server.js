"use strict";

const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();

const PORT = Number(process.env.PORT || 3000);

/* =====================================================
   ADATBÁZIS
===================================================== */

const DB_DIR = process.env.DB_DIR || __dirname;
const SOURCE_DB = path.join(__dirname, "tanulobarat.db");
const DB_FILE = path.join(DB_DIR, "tanulobarat.db");

fs.mkdirSync(DB_DIR, { recursive: true });

/*
   Ha Renderen /var/data van megadva DB_DIR-ként,
   akkor a meglévő adatbázist első induláskor átmásolja oda.
*/
if (
    DB_FILE !== SOURCE_DB &&
    !fs.existsSync(DB_FILE) &&
    fs.existsSync(SOURCE_DB)
) {
    try {
        fs.copyFileSync(SOURCE_DB, DB_FILE);
        console.log("✅ Meglévő adatbázis átmásolva tartós tárhelyre.");
    } catch (err) {
        console.error("❌ Adatbázis másolási hiba:", err.message);
    }
}

const db = new sqlite3.Database(DB_FILE, (err) => {
    if (err) {
        console.error("❌ SQLite hiba:", err.message);
    } else {
        console.log(`✅ SQLite adatbázis: ${DB_FILE}`);
    }
});

/* =====================================================
   ADATBÁZIS TÁBLÁK
===================================================== */

db.serialize(() => {
    db.run("PRAGMA journal_mode = WAL");
    db.run("PRAGMA foreign_keys = ON");

    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            username TEXT DEFAULT '',
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            grade INTEGER NOT NULL,
            avatar TEXT DEFAULT '',
            email_verified INTEGER NOT NULL DEFAULT 0,
            verification_token TEXT DEFAULT '',
            verification_expires INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS friendships (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            friend_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER NOT NULL,
            receiver_id INTEGER NOT NULL,
            text TEXT DEFAULT '',
            message_type TEXT DEFAULT 'text',
            material_id INTEGER,
            assignment_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS grades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            giver_id INTEGER NOT NULL,
            receiver_id INTEGER NOT NULL,
            subject TEXT NOT NULL,
            grade INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS ratings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            giver_id INTEGER NOT NULL,
            receiver_id INTEGER NOT NULL,
            rating INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS materials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_id INTEGER NOT NULL,
            receiver_id INTEGER,
            subject TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            summary TEXT DEFAULT '',
            end_type TEXT DEFAULT 'none',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            material_id INTEGER,
            creator_id INTEGER NOT NULL,
            receiver_id INTEGER,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            text TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            answer TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Régi adatbázisok frissítése
    db.run(
        `ALTER TABLE users ADD COLUMN username TEXT DEFAULT ''`,
        () => {}
    );

    db.run(
        `ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT ''`,
        () => {}
    );

    db.run(
        `ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1`,
        () => {}
    );

    db.run(
        `ALTER TABLE users ADD COLUMN verification_token TEXT DEFAULT ''`,
        () => {}
    );

    db.run(
        `ALTER TABLE users ADD COLUMN verification_expires INTEGER DEFAULT 0`,
        () => {}
    );

    // Régi felhasználók továbbra is beléphessenek
    db.run(`
        UPDATE users
        SET email_verified = 1
        WHERE email_verified IS NULL
    `);

    console.log("✅ Adatbázis ellenőrizve.");
});

/* =====================================================
   EXPRESS
===================================================== */

app.use(
    cors({
        origin: true
    })
);

app.use(
    express.json({
        limit: "10mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "10mb"
    })
);

app.use(express.static(__dirname));

/* =====================================================
   SEGÉDFÜGGVÉNYEK
===================================================== */

function sendError(res, message, status = 400) {
    return res.status(status).json({
        success: false,
        error: message
    });
}

function normalizeEmail(value) {
    return String(value || "")
        .trim()
        .toLowerCase();
}

function publicUser(user) {
    if (!user) {
        return null;
    }

    return {
        id: Number(user.id),
        name: user.name || "",
        username: user.username || "",
        email: user.email || "",
        grade: Number(user.grade || 0),
        avatar: user.avatar || "",
        emailVerified: Boolean(
            Number(
                user.email_verified ??
                user.emailVerified ??
                0
            )
        ),
        createdAt:
            user.created_at ||
            user.createdAt ||
            null
    };
}

/* =====================================================
   JELSZÓ KEZELÉS
===================================================== */

function hashPassword(password) {
    const salt = crypto
        .randomBytes(16)
        .toString("hex");

    const hash = crypto
        .scryptSync(
            String(password),
            salt,
            64
        )
        .toString("hex");

    return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, storedPassword) {

    const stored = String(
        storedPassword || ""
    );

    /*
       Régi fiókok:
       ha sima szövegként volt mentve,
       továbbra is működjön.
    */
    if (!stored.startsWith("scrypt$")) {

        const a = Buffer.from(
            String(password)
        );

        const b = Buffer.from(
            stored
        );

        if (a.length !== b.length) {
            return false;
        }

        try {
            return crypto.timingSafeEqual(a, b);
        } catch {
            return false;
        }
    }

    const parts = stored.split("$");

    if (parts.length !== 3) {
        return false;
    }

    const salt = parts[1];
    const expectedHash = parts[2];

    const actualHash = crypto
        .scryptSync(
            String(password),
            salt,
            64
        )
        .toString("hex");

    try {
        return crypto.timingSafeEqual(
            Buffer.from(actualHash, "hex"),
            Buffer.from(expectedHash, "hex")
        );
    } catch {
        return false;
    }
}

/* =====================================================
   E-MAIL MEGERŐSÍTÉS
===================================================== */

function generateVerificationToken() {
    return crypto
        .randomBytes(32)
        .toString("hex");
}

function getAppUrl() {

    return String(
        process.env.APP_URL ||
        `http://localhost:${PORT}`
    ).replace(/\/$/, "");
}

function getVerificationUrl(token) {

    return (
        `${getAppUrl()}` +
        `/api/verify-email?token=` +
        encodeURIComponent(token)
    );
}

async function sendVerificationEmail(
    email,
    name,
    token
) {

    const apiKey =
        process.env.RESEND_API_KEY;

    const from =
        process.env.RESEND_FROM ||
        "TanulóBarát <onboarding@resend.dev>";

    if (!apiKey) {

        console.warn(
            "⚠️ RESEND_API_KEY nincs beállítva."
        );

        return false;
    }

    const verificationUrl =
        getVerificationUrl(token);

    const safeName =
        String(name || "")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

    const html = `
        <div style="
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: auto;
            padding: 30px;
        ">

            <h1>
                TanulóBarát 👋
            </h1>

            <p>
                Szia ${safeName}!
            </p>

            <p>
                Köszönjük a regisztrációt.
                Az e-mail címed megerősítéséhez
                kattints az alábbi gombra:
            </p>

            <p>
                <a
                    href="${verificationUrl}"
                    style="
                        display:inline-block;
                        padding:12px 20px;
                        background:#111;
                        color:#fff;
                        text-decoration:none;
                        border-radius:8px;
                    "
                >
                    E-mail megerősítése
                </a>
            </p>

            <p>
                A link 24 órán keresztül érvényes.
            </p>

        </div>
    `;

    const response = await fetch(
        "https://api.resend.com/emails",
        {
            method: "POST",

            headers: {
                Authorization:
                    `Bearer ${apiKey}`,

                "Content-Type":
                    "application/json"
            },

            body: JSON.stringify({
                from,
                to: [email],
                subject:
                    "TanulóBarát – E-mail megerősítése",
                html
            })
        }
    );

    if (!response.ok) {

        const text =
            await response.text();

        console.error(
            "❌ Resend hiba:",
            text
        );

        return false;
    }

    return true;
}

/* =====================================================
   BARÁTSÁG ELLENŐRZÉS
===================================================== */

function checkFriends(
    userId,
    friendId,
    callback
) {

    db.get(
        `
        SELECT id
        FROM friendships
        WHERE
            status = 'accepted'
            AND (
                (user_id = ? AND friend_id = ?)
                OR
                (user_id = ? AND friend_id = ?)
            )
        LIMIT 1
        `,
        [
            userId,
            friendId,
            friendId,
            userId
        ],
        (err, row) => {

            callback(
                err,
                Boolean(row)
            );
        }
    );
}

/* =====================================================
   API TESZT
===================================================== */

app.get("/api", (req, res) => {

    res.json({
        success: true,
        message:
            "TanulóBarát szerver működik! 🚀"
    });
});

/* =====================================================
   REGISZTRÁCIÓ
===================================================== */

app.post("/api/register", (req, res) => {

    const name =
        String(req.body.name || "")
            .trim();

    const username =
        String(req.body.username || "")
            .trim();

    const email =
        normalizeEmail(req.body.email);

    const password =
        String(req.body.password || "");

    const grade =
        Number(req.body.grade);

    if (
        !name ||
        !email ||
        !password ||
        !grade
    ) {
        return sendError(
            res,
            "Minden kötelező mezőt ki kell tölteni."
        );
    }

    if (password.length < 6) {

        return sendError(
            res,
            "A jelszónak legalább 6 karakteresnek kell lennie."
        );
    }

    if (
        !Number.isInteger(grade) ||
        grade < 5 ||
        grade > 12
    ) {
        return sendError(
            res,
            "Az évfolyam 5 és 12 között lehet."
        );
    }

    const token =
        generateVerificationToken();

    const expires =
        Date.now() +
        24 * 60 * 60 * 1000;

    const hashedPassword =
        hashPassword(password);

    db.run(
        `
        INSERT INTO users
        (
            name,
            username,
            email,
            password,
            grade,
            avatar,
            email_verified,
            verification_token,
            verification_expires
        )
        VALUES
        (?, ?, ?, ?, ?, '', 0, ?, ?)
        `,
        [
            name,
            username,
            email,
            hashedPassword,
            grade,
            token,
            expires
        ],
        async function (err) {

            if (err) {

                if (
                    String(err.message)
                        .includes("UNIQUE")
                ) {
                    return sendError(
                        res,
                        "Ez az e-mail cím már használatban van."
                    );
                }

                console.error(err);

                return sendError(
                    res,
                    "Nem sikerült létrehozni a fiókot.",
                    500
                );
            }

            let emailSent = false;

            try {

                emailSent =
                    await sendVerificationEmail(
                        email,
                        name,
                        token
                    );

            } catch (mailError) {

                console.error(
                    "❌ E-mail küldési hiba:",
                    mailError
                );
            }

            db.get(
                `
                SELECT *
                FROM users
                WHERE id = ?
                `,
                [this.lastID],
                (getErr, user) => {

                    if (getErr || !user) {

                        return sendError(
                            res,
                            "A fiók létrejött, de a felhasználó betöltése sikertelen.",
                            500
                        );
                    }

                    res.json({
                        success: true,
                        verificationRequired:
                            true,
                        emailSent,
                        message:
                            emailSent
                                ? "Sikeres regisztráció! Ellenőrizd az e-mail címedet."
                                : "A fiók létrejött, de a megerősítő e-mailt jelenleg nem sikerült elküldeni.",
                        user:
                            publicUser(user)
                    });
                }
            );
        }
    );
});

/* =====================================================
   E-MAIL MEGERŐSÍTÉS
===================================================== */

app.get(
    "/api/verify-email",
    (req, res) => {

        const token =
            String(
                req.query.token || ""
            ).trim();

        if (!token) {

            return res
                .status(400)
                .send(
                    "Érvénytelen megerősítő link."
                );
        }

        db.get(
            `
            SELECT
                id,
                verification_expires
            FROM users
            WHERE verification_token = ?
            `,
            [token],
            (err, user) => {

                if (err) {

                    return res
                        .status(500)
                        .send(
                            "Szerverhiba."
                        );
                }

                if (!user) {

                    return res
                        .status(400)
                        .send(
                            "A megerősítő link érvénytelen vagy már fel lett használva."
                        );
                }

                if (
                    Number(
                        user.verification_expires || 0
                    ) < Date.now()
                ) {

                    return res
                        .status(400)
                        .send(
                            "A megerősítő link lejárt."
                        );
                }

                db.run(
                    `
                    UPDATE users
                    SET
                        email_verified = 1,
                        verification_token = '',
                        verification_expires = 0
                    WHERE id = ?
                    `,
                    [user.id],
                    (updateErr) => {

                        if (updateErr) {

                            return res
                                .status(500)
                                .send(
                                    "Nem sikerült aktiválni a fiókot."
                                );
                        }

                        res.send(`
                            <!DOCTYPE html>

                            <html lang="hu">

                            <head>

                                <meta charset="UTF-8">

                                <meta
                                    name="viewport"
                                    content="width=device-width, initial-scale=1"
                                >

                                <title>
                                    TanulóBarát
                                </title>

                            </head>

                            <body
                                style="
                                    margin:0;
                                    min-height:100vh;
                                    display:grid;
                                    place-items:center;
                                    background:#f5f5f5;
                                    font-family:Arial,sans-serif;
                                "
                            >

                                <div
                                    style="
                                        max-width:460px;
                                        padding:32px;
                                        text-align:center;
                                        background:white;
                                        border-radius:18px;
                                        box-shadow:
                                            0 10px 30px
                                            rgba(0,0,0,.08);
                                    "
                                >

                                    <h1>
                                        ✅ E-mail megerősítve!
                                    </h1>

                                    <p>
                                        A TanulóBarát fiókod aktiválva lett.
                                    </p>

                                    <p>
                                        Most már bejelentkezhetsz.
                                    </p>

                                </div>

                            </body>

                            </html>
                        `);
                    }
                );
            }
        );
    }
);

/* =====================================================
   ÚJ MEGERŐSÍTŐ E-MAIL
===================================================== */

app.post(
    "/api/resend-verification",
    (req, res) => {

        const email =
            normalizeEmail(req.body.email);

        if (!email) {

            return sendError(
                res,
                "E-mail cím szükséges."
            );
        }

        db.get(
            `
            SELECT *
            FROM users
            WHERE email = ?
            `,
            [email],
            async (err, user) => {

                if (err) {

                    return sendError(
                        res,
                        "Szerverhiba.",
                        500
                    );
                }

                if (!user) {

                    return sendError(
                        res,
                        "Nem található ilyen fiók.",
                        404
                    );
                }

                if (
                    Number(
                        user.email_verified
                    ) === 1
                ) {

                    return sendError(
                        res,
                        "Ez az e-mail cím már meg van erősítve."
                    );
                }

                const token =
                    generateVerificationToken();

                const expires =
                    Date.now() +
                    24 * 60 * 60 * 1000;

                db.run(
                    `
                    UPDATE users
                    SET
                        verification_token = ?,
                        verification_expires = ?
                    WHERE id = ?
                    `,
                    [
                        token,
                        expires,
                        user.id
                    ],
                    async updateErr => {

                        if (updateErr) {

                            return sendError(
                                res,
                                "Nem sikerült új megerősítő linket létrehozni.",
                                500
                            );
                        }

                        try {

                            const sent =
                                await sendVerificationEmail(
                                    user.email,
                                    user.name,
                                    token
                                );

                            res.json({
                                success: true,
                                emailSent: sent,
                                message:
                                    sent
                                        ? "Az új megerősítő e-mail elküldve."
                                        : "Az e-mail szolgáltatás nincs beállítva."
                            });

                        } catch (mailError) {

                            console.error(
                                mailError
                            );

                            return sendError(
                                res,
                                "Nem sikerült elküldeni a megerősítő e-mailt.",
                                500
                            );
                        }
                    }
                );
            }
        );
    }
);

/* =====================================================
   BEJELENTKEZÉS
===================================================== */

app.post("/api/login", (req, res) => {

    const email =
        normalizeEmail(req.body.email);

    const password =
        String(req.body.password || "");

    if (!email || !password) {

        return sendError(
            res,
            "E-mail és jelszó szükséges."
        );
    }

    db.get(
        `
        SELECT *
        FROM users
        WHERE email = ?
        `,
        [email],
        (err, user) => {

            if (err) {

                console.error(err);

                return sendError(
                    res,
                    "Szerverhiba.",
                    500
                );
            }

            if (
                !user ||
                !verifyPassword(
                    password,
                    user.password
                )
            ) {

                return sendError(
                    res,
                    "Hibás e-mail vagy jelszó.",
                    401
                );
            }

            /*
               Régi fiók esetén a sikeres belépés
               automatikusan új, biztonságos hash-re vált.
            */

            if (
                !String(user.password)
                    .startsWith("scrypt$")
            ) {

                db.run(
                    `
                    UPDATE users
                    SET password = ?
                    WHERE id = ?
                    `,
                    [
                        hashPassword(
                            password
                        ),
                        user.id
                    ]
                );
            }

            if (
                Number(
                    user.email_verified
                ) !== 1
            ) {

                return res
                    .status(403)
                    .json({
                        success: false,
                        emailVerificationRequired:
                            true,
                        error:
                            "Előbb erősítsd meg a regisztrációkor megadott e-mail címedet."
                    });
            }

            res.json({
                success: true,
                user:
                    publicUser(user)
            });
        }
    );
});

/* =====================================================
   SAJÁT PROFIL
===================================================== */

app.get(
    "/api/me/:id",
    (req, res) => {

        db.get(
            `
            SELECT *
            FROM users
            WHERE id = ?
            `,
            [req.params.id],
            (err, user) => {

                if (err) {

                    return sendError(
                        res,
                        "Szerverhiba.",
                        500
                    );
                }

                if (!user) {

                    return sendError(
                        res,
                        "Felhasználó nem található.",
                        404
                    );
                }

                res.json({
                    success: true,
                    user:
                        publicUser(user)
                });
            }
        );
    }
);

/* =====================================================
   FELHASZNÁLÓ PROFIL
===================================================== */

app.get(
    "/api/users/:id",
    (req, res) => {

        db.get(
            `
            SELECT *
            FROM users
            WHERE id = ?
            `,
            [req.params.id],
            (err, user) => {

                if (err) {

                    return sendError(
                        res,
                        "Szerverhiba.",
                        500
                    );
                }

                if (!user) {

                    return sendError(
                        res,
                        "Felhasználó nem található.",
                        404
                    );
                }

                res.json({
                    success: true,
                    user:
                        publicUser(user)
                });
            }
        );
    }
);

/* =====================================================
   PROFIL SZERKESZTÉSE
===================================================== */

app.put(
    "/api/users/:id",
    (req, res) => {

        const id =
            Number(req.params.id);

        const name =
            req.body.name !== undefined
                ? String(
                    req.body.name
                ).trim()
                : null;

        const username =
            req.body.username !== undefined
                ? String(
                    req.body.username
                ).trim()
                : null;

        const avatar =
            req.body.avatar !== undefined
                ? String(
                    req.body.avatar
                )
                : null;

        const password =
            req.body.password !== undefined
                ? String(
                    req.body.password
                )
                : null;

        if (!id) {

            return sendError(
                res,
                "Érvénytelen felhasználó."
            );
        }

        if (
            password !== null &&
            password !== "" &&
            password.length < 6
        ) {

            return sendError(
                res,
                "A jelszónak legalább 6 karakteresnek kell lennie."
            );
        }

        const hashedPassword =
            password
                ? hashPassword(password)
                : null;

        db.run(
            `
            UPDATE users
            SET
                name = COALESCE(?, name),
                username = COALESCE(?, username),
                avatar = COALESCE(?, avatar),
                password = COALESCE(?, password)
            WHERE id = ?
            `,
            [
                name === ""
                    ? null
                    : name,

                username === ""
                    ? null
                    : username,

                avatar,

                hashedPassword,

                id
            ],
            function (err) {

                if (err) {

                    console.error(err);

                    return sendError(
                        res,
                        "Nem sikerült frissíteni a profilt.",
                        500
                    );
                }

                if (
                    this.changes === 0
                ) {

                    return sendError(
                        res,
                        "Felhasználó nem található.",
                        404
                    );
                }

                db.get(
                    `
                    SELECT *
                    FROM users
                    WHERE id = ?
                    `,
                    [id],
                    (getErr, user) => {

                        if (
                            getErr ||
                            !user
                        ) {

                            return sendError(
                                res,
                                "Profil frissítve, de az adatok betöltése sikertelen.",
                                500
                            );
                        }

                        res.json({
                            success: true,
                            message:
                                "Profil frissítve.",
                            user:
                                publicUser(user)
                        });
                    }
                );
            }
        );
    }
);

/* =====================================================
   FELHASZNÁLÓK KERESÉSE
===================================================== */

app.get(
    "/api/users",
    (req, res) => {

        const search =
            String(
                req.query.search ||
                req.query.q ||
                ""
            ).trim();

        db.all(
            `
            SELECT
                id,
                name,
                username,
                email,
                grade,
                avatar,
                email_verified,
                created_at
            FROM users
            WHERE
                name LIKE ?
                OR username LIKE ?
                OR email LIKE ?
            ORDER BY name
            LIMIT 50
            `,
            [
                `%${search}%`,
                `%${search}%`,
                `%${search}%`
            ],
            (err, users) => {

                if (err) {

                    return sendError(
                        res,
                        "Szerverhiba.",
                        500
                    );
                }

                res.json({
                    success: true,
                    users:
                        (users || [])
                            .map(
                                publicUser
                            )
                });
            }
        );
    }
);

/* =====================================================
   BARÁTKÉRÉS
===================================================== */

app.post(
    "/api/friends/request",
    (req, res) => {

        const userId =
            Number(
                req.body.userId
            );

        const friendId =
            Number(
                req.body.friendId
            );

        if (!userId || !friendId) {

            return sendError(
                res,
                "Hiányzó adatok."
            );
        }

        if (
            userId === friendId
        ) {

            return sendError(
                res,
                "Saját magadat nem jelölheted barátnak."
            );
        }

        db.get(
            `
            SELECT id
            FROM users
            WHERE id = ?
            `,
            [friendId],
            (userErr, target) => {

                if (userErr) {

                    return sendError(
                        res,
                        "Szerverhiba.",
                        500
                    );
                }

                if (!target) {

                    return sendError(
                        res,
                        "A felhasználó nem található.",
                        404
                    );
                }

                db.get(
                    `
                    SELECT
                        id,
                        status
                    FROM friendships
                    WHERE
                        (
                            user_id = ?
                            AND friend_id = ?
                        )
                        OR
                        (
                            user_id = ?
                            AND friend_id = ?
                        )
                    LIMIT 1
                    `,
                    [
                        userId,
                        friendId,
                        friendId,
                        userId
                    ],
                    (err, existing) => {

                        if (err) {

                            return sendError(
                                res,
                                "Szerverhiba.",
                                500
                            );
                        }

                        if (existing) {

                            if (
                                existing.status ===
                                "rejected"
                            ) {

                                db.run(
                                    `
                                    UPDATE friendships
                                    SET
                                        user_id = ?,
                                        friend_id = ?,
                                        status = 'pending',
                                        created_at =
                                            CURRENT_TIMESTAMP
                                    WHERE id = ?
                                    `,
                                    [
                                        userId,
                                        friendId,
                                        existing.id
                                    ],
                                    updateErr => {

                                        if (
                                            updateErr
                                        ) {

                                            return sendError(
                                                res,
                                                "Nem sikerült újra elküldeni a barátkérést.",
                                                500
                                            );
                                        }

                                        res.json({
                                            success:
                                                true,
                                            id:
                                                existing.id
                                        });
                                    }
                                );

                                return;
                            }

                            return sendError(
                                res,
                                "Már van kapcsolat a két felhasználó között."
                            );
                        }

                        db.run(
                            `
                            INSERT INTO friendships
                            (
                                user_id,
                                friend_id,
                                status
                            )
                            VALUES
                            (?, ?, 'pending')
                            `,
                            [
                                userId,
                                friendId
                            ],
                            function (insertErr) {

                                if (insertErr) {

                                    return sendError(
                                        res,
                                        "Nem sikerült elküldeni a barátkérést.",
                                        500
                                    );
                                }

                                res.json({
                                    success:
                                        true,
                                    id:
                                        this.lastID
                                });
                            }
                        );
                    }
                );
            }
        );
    }
);

/* =====================================================
   BARÁTKÉRÉSEK
===================================================== */

app.get(
    "/api/friends/requests/:userId",
    (req, res) => {

        db.all(
            `
            SELECT
                f.id AS friendshipId,
                u.id,
                u.name,
                u.username,
                u.grade,
                u.avatar
            FROM friendships f
            JOIN users u
                ON u.id = f.user_id
            WHERE
                f.friend_id = ?
                AND f.status = 'pending'
            ORDER BY f.created_at DESC
            `,
            [req.params.userId],
            (err, requests) => {

                if (err) {

                    return sendError(
                        res,
                        "Szerverhiba.",
                        500
                    );
                }

                res.json({
                    success: true,
                    requests:
                        requests || []
                });
            }
        );
    }
);

/* =====================================================
   BARÁTKÉRÉS ELFOGADÁSA
===================================================== */

app.post(
    "/api/friends/accept",
    (req, res) => {

        const friendshipId =
            Number(
                req.body.friendshipId
            );

        if (!friendshipId) {

            return sendError(
                res,
                "Hiányzó barátkérés."
            );
        }

        db.run(
            `
            UPDATE friendships
            SET status = 'accepted'
            WHERE
                id = ?
                AND status = 'pending'
            `,
            [friendshipId],
            function (err) {

                if (err) {

                    return sendError(
                        res,
                        "Szerverhiba.",
                        500
                    );
                }

                if (
                    this.changes === 0
                ) {

                    return sendError(
                        res,
                        "A barátkérés nem található.",
                        404
                    );
                }

                res.json({
                    success: true
                });
            }
        );
    }
);

/* =====================================================
   BARÁTKÉRÉS ELUTASÍTÁSA
===================================================== */

app.post(
    "/api/friends/reject",
    (req, res) => {

        const friendshipId =
            Number(
                req.body.friendshipId
            );

        if (!friendshipId) {

            return sendError(
                res,
                "Hiányzó barátkérés."
            );
        }

        db.run(
            `
            DELETE FROM friendships
            WHERE
                id = ?
                AND status = 'pending'
            `,
            [friendshipId],
            function (err) {

                if (err) {

                    return sendError(
                        res,
                        "Szerverhiba.",
                        500
                    );
                }

                if (
                    this.changes === 0
                ) {

                    return sendError(
                        res,
                        "A barátkérés nem található.",
                        404
                    );
                }

                res.json({
                    success: true
                });
            }
        );
    }
);

/* =====================================================
   BARÁTOK LISTÁJA
===================================================== */

app.get(
    "/api/friends/:userId",
    (req, res) => {

        const userId =
            Number(
                req.params.userId
            );

        db.all(
            `
            SELECT
                u.id,
                u.name,
                u.username,
                u.email,
                u.grade,
                u.avatar
            FROM users u
            JOIN friendships f
            ON
                (
                    f.user_id = ?
                    AND
                    f.friend_id = u.id
                )
                OR
                (
                    f.friend_id = ?
                    AND
                    f.user_id = u.id
                )
            WHERE
                f.status = 'accepted'
            ORDER BY u.name
            `,
            [
                userId,
                userId
            ],
            (err, friends) => {

                if (err) {

                    return sendError(
                        res,
                        "Szerverhiba.",
                        500
                    );
                }

                res.json({
                    success: true,
                    friends:
                        friends || []
                });
            }
        );
    }
);

/* =====================================================
   ÜZENET KÜLDÉS
===================================================== */

app.post(
    "/api/messages",
    (req, res) => {

        const senderId =
            Number(
                req.body.senderId
            );

        const receiverId =
            Number(
                req.body.receiverId
            );

        const text =
            String(
                req.body.text || ""
            );

        const messageType =
            String(
                req.body.messageType ||
                "text"
            );

        const materialId =
            req.body.materialId == null
                ? null
                : Number(
                    req.body.materialId
                );

        const assignmentId =
            req.body.assignmentId == null
                ? null
                : Number(
                    req.body.assignmentId
                );

        if (
            !senderId ||
            !receiverId
        ) {

            return sendError(
                res,
                "Hiányzó felhasználó."
            );
        }

        db.run(
            `
            INSERT INTO messages
            (
                sender_id,
                receiver_id,
                text,
                message_type,
                material_id,
                assignment_id
            )
            VALUES
            (?, ?, ?, ?, ?, ?)
            `,
            [
                senderId,
                receiverId,
                text,
                messageType,
                materialId,
                assignmentId
            ],
            function (err) {

                if (err) {

                    console.error(err);

                    return sendError(
                        res,
                        "Nem sikerült elküldeni az üzenetet.",
                        500
                    );
                }

                res.json({
                    success: true,
                    id:
                        this.lastID
                });
            }
        );
    }
);

/* =====================================================
   ÜZENETEK LEKÉRÉSE
===================================================== */

app.get(
    "/api/messages/:userId/:friendId",
    (req, res) => {

        db.all(
            `
            SELECT *
            FROM messages
            WHERE
                (
                    sender_id = ?
                    AND receiver_id = ?
                )
                OR
                (
                    sender_id = ?
                    AND receiver_id = ?
                )
            ORDER BY
                created_at ASC,
                id ASC
            `,
            [
                req.params.userId,
                req.params.friendId,
                req.params.friendId,
                req.params.userId
            ],
            (err, messages) => {

                if (err) {

                    return sendError(
                        res,
                        "Szerverhiba.",
                        500
                    );
                }

                res.json({
                    success: true,
                    messages:
                        messages || []
                });
            }
        );
    }
);

/* =====================================================
   JEGY ADÁSA
===================================================== */

app.post(
    "/api/grades",
    (req, res) => {

        const giverId =
            Number(
                req.body.giverId
            );

        const receiverId =
            Number(
                req.body.receiverId
            );

        const subject =
            String(
                req.body.subject || ""
            ).trim();

        const grade =
            Number(
                req.body.grade
            );

        if (
            !giverId ||
            !receiverId ||
            !subject
        ) {

            return sendError(
                res,
                "Hiányzó adatok."
            );
        }

        if (
            giverId === receiverId
        ) {

            return sendError(
                res,
                "Saját magadnak nem adhatsz jegyet."
            );
        }

        if (
            !Number.isInteger(grade) ||
            grade < 1 ||
            grade > 5
        ) {

            return sendError(
                res,
                "A jegy 1 és 5 között lehet."
            );
        }

        checkFriends(
            giverId,
            receiverId,
            (friendErr, isFriend) => {

                if (friendErr) {

                    return sendError(
                        res,
                        "Szerverhiba.",
                        500
                    );
                }

                if (!isFriend) {

                    return sendError(
                        res,
                        "Csak elfogadott barátnak adhatsz jegyet.",
                        403
                    );
                }

                db.run(
                    `
                    INSERT INTO grades
                    (
                        giver_id,
                        receiver_id,
                        subject,
                        grade
                    )
                    VALUES
                    (?, ?, ?, ?)
                    `,
                    [
                        giverId,
                        receiverId,
                        subject,
                        grade
                    ],
                    function (err) {

                        if (err) {

                            return sendError(
                                res,
                                "Nem sikerült hozzáadni a jegyet.",
                                500
                            );
                        }

                        res.json({
                            success: true,
                            id:
                                this.lastID
                        });
                    }
                );
            }
        );
    }
);

/* =====================================================
   JEGYEK
===================================================== */

app.get(
    "/api/grades/:userId",
    (req, res) => {

        db.all(
            `
            SELECT
                g.*,
                u.name AS giver_name
            FROM grades g
            LEFT JOIN users u
                ON u.id = g.giver_id
            WHERE
                g.receiver_id = ?
            ORDER BY
                g.created_at DESC
            `,
            [req.params.userId],
            (err, grades) => {

                if (err) {

                    return sendError(
                        res,
                        "Szerverhiba.",
                        500
                    );
                }

                res.json({
                    success: true,
                    grades:
                        grades || []
                });
            }
        );
    }
);

/* =====================================================
   ÉRTÉKELÉS
===================================================== */

app.post(
    "/api/ratings",
    (req, res) => {

        const giverId =
            Number(
                req.body.giverId
            );

        const receiverId =
            Number(
                req.body.receiverId
            );

        const rating =
            Number(
                req.body.rating
            );

        if (
            !giverId ||
            !receiverId
        ) {

            return sendError(
                res,
                "Hiányzó adatok."
            );
        }

        if (
            giverId === receiverId
        ) {

            return sendError(
                res,
                "Saját magadat nem értékelheted."
            );
        }

        if (
            !Number.isInteger(rating) ||
            rating < 1 ||
            rating > 5
        ) {

            return sendError(
                res,
                "Az értékelés 1 és 5 csillag között lehet."
            );
        }

        checkFriends(
            giverId,
            receiverId,
            (friendErr, isFriend) => {

                if (friendErr) {

                    return sendError(
                        res,
                        "Szerverhiba.",
                        500
                    );
                }

                if (!isFriend) {

                    return sendError(
                        res,
                        "Csak barátot értékelhetsz.",
                        403
                    );
                }

                db.get(
                    `
                    SELECT id
                    FROM ratings
                    WHERE
                        giver_id = ?
                        AND receiver_id = ?
                    `,
                    [
                        giverId,
                        receiverId
                    ],
                    (err, existing) => {

                        if (err) {

                            return sendError(
                                res,
                                "Szerverhiba.",
                                500
                            );
                        }

                        if (existing) {

                            db.run(
                                `
                                UPDATE ratings
                                SET rating = ?
                                WHERE id = ?
                                `,
                                [
                                    rating,
                                    existing.id
                                ],
                                updateErr => {

                                    if (
                                        updateErr
                                    ) {

                                        return sendError(
                                            res,
                                            "Nem sikerült frissíteni az értékelést.",
                                            500
                                        );
                                    }

                                    res.json({
                                        success:
                                            true
                                    });
                                }
                            );

                        } else {

                            db.run(
                                `
                                INSERT INTO ratings
                                (
                                    giver_id,
                                    receiver_id,
                                    rating
                                )
                                VALUES
                                (?, ?, ?)
                                `,
                                [
                                    giverId,
                                    receiverId,
                                    rating
                                ],
                                function (insertErr) {

                                    if (
                                        insertErr
                                    ) {

                                        return sendError(
                                            res,
                                            "Nem sikerült értékelni.",
                                            500
                                        );
                                    }

                                    res.json({
                                        success:
                                            true,
                                        id:
                                            this.lastID
                                    });
                                }
                            );
                        }
                    }
                );
            }
        );
    }
);

/* =====================================================
   ÉRTÉKELÉSEK LEKÉRÉSE
===================================================== */

app.get(
    "/api/ratings/:userId",
    (req, res) => {

        db.get(
            `
            SELECT
                AVG(rating) AS average,
                COUNT(*) AS count
            FROM ratings
            WHERE receiver_id = ?
            `,
            [req.params.userId],
            (err, result) => {

                if (err) {

                    return sendError(
                        res,
                        "Szerverhiba.",
                        500
                    );
                }

                res.json({
                    success: true,
                    average:
                        Number(
                            result?.average ||
                            0
                        ),
                    count:
                        Number(
                            result?.count ||
                            0
                        )
                });
            }
        );
    }
);

/* =====================================================
   TANANYAG
===================================================== */

app.post(
    "/api/materials",
    (req, res) => {

        const ownerId =
            Number(
                req.body.ownerId
            );

        const receiverId =
            req.body.receiverId == null
                ? null
                : Number(
                    req.body.receiverId
                );

        const subject =
            String(
                req.body.subject || ""
            ).trim();

        const title =
            String(
                req.body.title || ""
            ).trim();

        const content =
            String(
                req.body.content || ""
            );

        const summary =
            String(
                req.body.summary || ""
            );

        const endType =
            String(
                req.body.endType ||
                "none"
            );

        if (
            !ownerId ||
            !subject ||
            !title ||
            !content
        ) {

            return sendError(
                res,
                "Hiányzó tananyagadat."
            );
        }

        const saveMaterial =
            () => {

                db.run(
                    `
                    INSERT INTO materials
                    (
                        owner_id,
                        receiver_id,
                        subject,
                        title,
                        content,
                        summary,
                        end_type
                    )
                    VALUES
                    (?, ?, ?, ?, ?, ?, ?)
                    `,
                    [
                        ownerId,
                        receiverId,
                        subject,
                        title,
                        content,
                        summary,
                        endType
                    ],
                    function (err) {

                        if (err) {

                            return sendError(
                                res,
                                "Nem sikerült létrehozni a tananyagot.",
                                500
                            );
                        }

                        res.json({
                            success: true,
                            materialId:
                                this.lastID
                        });
                    }
                );
            };

        if (!receiverId) {

            return saveMaterial();
        }

        checkFriends(
            ownerId,
            receiverId,
            (friendErr, isFriend) => {

                if (friendErr) {

                    return sendError(
                        res,
                        "Szerverhiba.",
                        500
                    );
                }

                if (!isFriend) {

                    return sendError(
                        res,
                        "Tananyagot csak elfogadott barátnak küldhetsz.",
                        403
                    );
                }

                saveMaterial();
            }
        );
    }
);

app.get(
    "/api/materials/:userId",
    (req, res) => {

        db.all(
            `
            SELECT *
            FROM materials
            WHERE
                owner_id = ?
                OR receiver_id = ?
            ORDER BY
                created_at DESC
            `,
            [
                req.params.userId,
                req.params.userId
            ],
            (err, materials) => {

                if (err) {

                    return sendError(
                        res,
                        "Szerverhiba.",
                        500
                    );
                }

                res.json({
                    success: true,
                    materials:
                        materials || []
                });
            }
        );
    }
);

/* =====================================================
   FELADATOK
===================================================== */

app.post(
    "/api/assignments",
    (req, res) => {

        const materialId =
            req.body.materialId == null
                ? null
                : Number(
                    req.body.materialId
                );

        const creatorId =
            Number(
                req.body.creatorId
            );

        const receiverId =
            req.body.receiverId == null
                ? null
                : Number(
                    req.body.receiverId
                );

        const type =
            String(
                req.body.type || ""
            );

        const title =
            String(
                req.body.title || ""
            ).trim();

        const text =
            String(
                req.body.text || ""
            ).trim();

        if (
            !creatorId ||
            !type ||
            !title ||
            !text
        ) {

            return sendError(
                res,
                "Hiányzó feladatadat."
            );
        }

        if (
            ![
                "test",
                "homework"
            ].includes(type)
        ) {

            return sendError(
                res,
                "Ismeretlen feladattípus."
            );
        }

        const save =
            () => {

                db.run(
                    `
                    INSERT INTO assignments
                    (
                        material_id,
                        creator_id,
                        receiver_id,
                        type,
                        title,
                        text
                    )
                    VALUES
                    (?, ?, ?, ?, ?, ?)
                    `,
                    [
                        materialId,
                        creatorId,
                        receiverId,
                        type,
                        title,
                        text
                    ],
                    function (err) {

                        if (err) {

                            return sendError(
                                res,
                                "Nem sikerült létrehozni a feladatot.",
                                500
                            );
                        }

                        res.json({
                            success: true,
                            assignmentId:
                                this.lastID
                        });
                    }
                );
            };

        if (!receiverId) {

            return save();
        }

        checkFriends(
            creatorId,
            receiverId,
            (friendErr, isFriend) => {

                if (friendErr) {

                    return sendError(
                        res,
                        "Szerverhiba.",
                        500
                    );
                }

                if (!isFriend) {

                    return sendError(
                        res,
                        "Feladatot csak elfogadott barátnak küldhetsz.",
                        403
                    );
                }

                save();
            }
        );
    }
);

app.get(
    "/api/assignments/:userId",
    (req, res) => {

        db.all(
            `
            SELECT *
            FROM assignments
            WHERE
                creator_id = ?
                OR receiver_id = ?
            ORDER BY
                created_at DESC
            `,
            [
                req.params.userId,
                req.params.userId
            ],
            (err, assignments) => {

                if (err) {

                    return sendError(
                        res,
                        "Szerverhiba.",
                        500
                    );
                }

                res.json({
                    success: true,
                    assignments:
                        assignments || []
                });
            }
        );
    }
);

app.put(
    "/api/assignments/:id",
    (req, res) => {

        const status =
            req.body.status !== undefined
                ? String(
                    req.body.status
                )
                : null;

        const answer =
            req.body.answer !== undefined
                ? String(
                    req.body.answer
                )
                : null;

        db.run(
            `
            UPDATE assignments
            SET
                status =
                    COALESCE(
                        ?,
                        status
                    ),
                answer =
                    COALESCE(
                        ?,
                        answer
                    )
            WHERE id = ?
            `,
            [
                status,
                answer,
                req.params.id
            ],
            function (err) {

                if (err) {

                    return sendError(
                        res,
                        "Nem sikerült frissíteni a feladatot.",
                        500
                    );
                }

                if (
                    this.changes === 0
                ) {

                    return sendError(
                        res,
                        "A feladat nem található.",
                        404
                    );
                }

                res.json({
                    success: true
                });
            }
        );
    }
);

/* =====================================================
   SPA
===================================================== */

app.get(
    /^\/(?!api(?:\/|$)).*/,
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "index.html"
            )
        );
    }
);

/* =====================================================
   SZERVER INDÍTÁS
===================================================== */

const server =
    app.listen(
        PORT,
        "0.0.0.0",
        () => {

            console.log("");
            console.log(
                "===================================="
            );
            console.log(
                "       TANULÓBARÁT SZERVER"
            );
            console.log(
                "===================================="
            );
            console.log(
                `✅ Port: ${PORT}`
            );
            console.log(
                `🗄️ Adatbázis: ${DB_FILE}`
            );
            console.log(
                `📧 E-mail: ${
                    process.env.RESEND_API_KEY
                        ? "BEKAPCSOLVA"
                        : "NINCS BEÁLLÍTVA"
                }`
            );
            console.log(
                "===================================="
            );
            console.log("");
        }
    );

/* =====================================================
   BIZTONSÁGOS LEÁLLÍTÁS
===================================================== */

function shutdown(signal) {

    console.log(
        `${signal} – szerver leállítása...`
    );

    server.close(() => {

        db.close(() => {

            process.exit(0);
        });
    });
}

process.on(
    "SIGINT",
    () => shutdown("SIGINT")
);

process.on(
    "SIGTERM",
    () => shutdown("SIGTERM")
);