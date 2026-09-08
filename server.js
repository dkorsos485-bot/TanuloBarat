const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "tanulobarat-data.json");

app.set("trust proxy", 1);

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

const isProduction =
    process.env.NODE_ENV === "production" ||
    !!process.env.RENDER;

app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            "tanulobarat-secret-2030",

        resave: false,
        saveUninitialized: false,
        proxy: true,

        cookie: {
            maxAge: 1000 * 60 * 60 * 24 * 30,
            httpOnly: true,
            secure: isProduction,
            sameSite: "lax"
        }
    })
);

// ============================================================
// ADATBÁZIS
// ============================================================

const emptyDB = {
    users: [],
    friendships: [],
    messages: [],
    materials: [],
    ratings: [],
    grades: [],

    nextIds: {
        user: 1,
        friendship: 1,
        message: 1,
        material: 1,
        rating: 1,
        grade: 1
    }
};

let db;

function loadDB() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            db = JSON.parse(JSON.stringify(emptyDB));
            saveDB();
            return;
        }

        const raw = fs.readFileSync(DATA_FILE, "utf8");
        db = JSON.parse(raw);

        db.users ||= [];
        db.friendships ||= [];
        db.messages ||= [];
        db.materials ||= [];
        db.ratings ||= [];
        db.grades ||= [];

        db.nextIds ||= {};

        db.nextIds.user ||= 1;
        db.nextIds.friendship ||= 1;
        db.nextIds.message ||= 1;
        db.nextIds.material ||= 1;
        db.nextIds.rating ||= 1;
        db.nextIds.grade ||= 1;

        // Régi tananyagok kompatibilitása
        db.materials.forEach(material => {
            if (!Array.isArray(material.sharedWith)) {
                material.sharedWith = [];
            }
        });
    } catch (error) {
        console.error("Adatbázis betöltési hiba:", error);

        db = JSON.parse(JSON.stringify(emptyDB));
    }
}

function saveDB() {
    try {
        fs.writeFileSync(
            DATA_FILE,
            JSON.stringify(db, null, 2),
            "utf8"
        );
    } catch (error) {
        console.error("Adatbázis mentési hiba:", error);
    }
}

loadDB();

// ============================================================
// SEGÉDFÜGGVÉNYEK
// ============================================================

function nextId(type) {
    const id = db.nextIds[type] || 1;
    db.nextIds[type] = id + 1;
    return id;
}

function publicUser(user) {
    if (!user) return null;

    return {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        grade: user.grade,
        avatar: user.avatar || null,
        createdAt: user.createdAt || null
    };
}

function getUser(req) {
    if (!req.session.userId) {
        return null;
    }

    return db.users.find(
        user => user.id === Number(req.session.userId)
    );
}

function requireLogin(req, res, next) {
    const user = getUser(req);

    if (!user) {
        return res.status(401).json({
            error: "Nincs bejelentkezve."
        });
    }

    next();
}

function areFriends(userA, userB) {
    return db.friendships.some(
        friendship =>
            friendship.status === "accepted" &&
            (
                (
                    friendship.sender === userA &&
                    friendship.receiver === userB
                ) ||
                (
                    friendship.sender === userB &&
                    friendship.receiver === userA
                )
            )
    );
}

function getFriendIds(userId) {
    return db.friendships
        .filter(
            friendship =>
                friendship.status === "accepted" &&
                (
                    friendship.sender === userId ||
                    friendship.receiver === userId
                )
        )
        .map(friendship =>
            friendship.sender === userId
                ? friendship.receiver
                : friendship.sender
        );
}

function safeUserById(id) {
    return publicUser(
        db.users.find(
            user => user.id === Number(id)
        )
    );
}

// ============================================================
// REGISZTRÁCIÓ
// ============================================================

app.post("/api/register", async (req, res) => {
    try {
        const {
            name,
            username,
            email,
            password,
            grade
        } = req.body;

        if (
            !name ||
            !username ||
            !email ||
            !password ||
            !grade
        ) {
            return res.status(400).json({
                error: "Minden mezőt ki kell tölteni."
            });
        }

        const normalizedUsername =
            String(username)
                .trim()
                .toLowerCase();

        const normalizedEmail =
            String(email)
                .trim()
                .toLowerCase();

        if (String(password).length < 6) {
            return res.status(400).json({
                error:
                    "A jelszó legalább 6 karakter legyen."
            });
        }

        const gradeNumber = Number(grade);

        if (
            !Number.isInteger(gradeNumber) ||
            gradeNumber < 5 ||
            gradeNumber > 12
        ) {
            return res.status(400).json({
                error:
                    "Az évfolyam 5 és 12 között lehet."
            });
        }

        if (
            db.users.some(
                user =>
                    String(user.username)
                        .toLowerCase() ===
                    normalizedUsername
            )
        ) {
            return res.status(400).json({
                error:
                    "Ez a felhasználónév már foglalt."
            });
        }

        if (
            db.users.some(
                user =>
                    String(user.email)
                        .toLowerCase() ===
                    normalizedEmail
            )
        ) {
            return res.status(400).json({
                error:
                    "Ez az e-mail cím már használatban van."
            });
        }

        const hashedPassword =
            await bcrypt.hash(
                String(password),
                10
            );

        const user = {
            id: nextId("user"),

            name: String(name).trim(),

            username: normalizedUsername,

            email: normalizedEmail,

            password: hashedPassword,

            grade: gradeNumber,

            avatar: null,

            createdAt:
                new Date().toISOString()
        };

        db.users.push(user);

        saveDB();

        req.session.userId = user.id;

        req.session.save(error => {
            if (error) {
                console.error(
                    "Session mentési hiba:",
                    error
                );

                return res.status(500).json({
                    error:
                        "A munkamenet mentése sikertelen."
                });
            }

            res.json({
                success: true,
                user: publicUser(user)
            });
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Regisztrációs hiba."
        });
    }
});

// ============================================================
// BEJELENTKEZÉS
// ============================================================

app.post("/api/login", async (req, res) => {
    try {
        const {
            username,
            password
        } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                error:
                    "Add meg a felhasználónevet és a jelszót."
            });
        }

        const normalizedUsername =
            String(username)
                .trim()
                .toLowerCase();

        const user = db.users.find(
            item =>
                String(item.username)
                    .toLowerCase() ===
                normalizedUsername
        );

        if (!user) {
            return res.status(401).json({
                error:
                    "Hibás felhasználónév vagy jelszó."
            });
        }

        const valid =
            await bcrypt.compare(
                String(password),
                user.password
            );

        if (!valid) {
            return res.status(401).json({
                error:
                    "Hibás felhasználónév vagy jelszó."
            });
        }

        req.session.userId = user.id;

        req.session.save(error => {
            if (error) {
                console.error(
                    "Session mentési hiba:",
                    error
                );

                return res.status(500).json({
                    error:
                        "A bejelentkezési munkamenet mentése sikertelen."
                });
            }

            res.json({
                success: true,
                user: publicUser(user)
            });
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Bejelentkezési hiba."
        });
    }
});

// ============================================================
// KIJELENTKEZÉS
// ============================================================

app.post(
    "/api/logout",
    (req, res) => {
        req.session.destroy(error => {
            if (error) {
                return res.status(500).json({
                    error:
                        "A kijelentkezés sikertelen."
                });
            }

            res.clearCookie("connect.sid");

            res.json({
                success: true
            });
        });
    }
);

// ============================================================
// AKTUÁLIS FELHASZNÁLÓ
// ============================================================

app.get(
    "/api/me",
    (req, res) => {
        const user = getUser(req);

        res.json({
            user: publicUser(user)
        });
    }
);

// ============================================================
// PROFIL MÓDOSÍTÁSA
// ============================================================

app.put(
    "/api/profile",
    requireLogin,
    async (req, res) => {
        try {
            const user = getUser(req);

            const {
                name,
                username,
                email,
                grade,
                password,
                avatar
            } = req.body;

            if (
                !name ||
                !username ||
                !email ||
                !grade
            ) {
                return res.status(400).json({
                    error:
                        "Minden mezőt ki kell tölteni."
                });
            }

            const normalizedUsername =
                String(username)
                    .trim()
                    .toLowerCase();

            const normalizedEmail =
                String(email)
                    .trim()
                    .toLowerCase();

            const gradeNumber = Number(grade);

            if (
                !Number.isInteger(gradeNumber) ||
                gradeNumber < 5 ||
                gradeNumber > 12
            ) {
                return res.status(400).json({
                    error:
                        "Az évfolyam 5 és 12 között lehet."
                });
            }

            const usernameUsed =
                db.users.some(
                    other =>
                        other.id !== user.id &&
                        String(other.username)
                            .toLowerCase() ===
                        normalizedUsername
                );

            if (usernameUsed) {
                return res.status(400).json({
                    error:
                        "Ez a felhasználónév már foglalt."
                });
            }

            const emailUsed =
                db.users.some(
                    other =>
                        other.id !== user.id &&
                        String(other.email)
                            .toLowerCase() ===
                        normalizedEmail
                );

            if (emailUsed) {
                return res.status(400).json({
                    error:
                        "Ez az e-mail cím már használatban van."
                });
            }

            user.name = String(name).trim();

            user.username =
                normalizedUsername;

            user.email =
                normalizedEmail;

            user.grade =
                gradeNumber;

            if (typeof avatar === "string") {
                if (
                    avatar &&
                    !avatar.startsWith("data:image/")
                ) {
                    return res.status(400).json({
                        error:
                            "Érvénytelen profilkép."
                    });
                }

                if (
                    avatar.length >
                    1000000
                ) {
                    return res.status(400).json({
                        error:
                            "A profilkép túl nagy."
                    });
                }

                user.avatar =
                    avatar || null;
            }

            if (password) {
                if (
                    String(password).length < 6
                ) {
                    return res.status(400).json({
                        error:
                            "Az új jelszó legalább 6 karakter legyen."
                    });
                }

                user.password =
                    await bcrypt.hash(
                        String(password),
                        10
                    );
            }

            saveDB();

            res.json({
                success: true,
                user: publicUser(user)
            });
        } catch (error) {
            console.error(error);

            res.status(500).json({
                error:
                    "A profil mentése sikertelen."
            });
        }
    }
);

// ============================================================
// FELHASZNÁLÓK KERESÉSE
// ============================================================

app.get(
    "/api/users",
    requireLogin,
    (req, res) => {
        const currentUser = getUser(req);

        const q =
            String(req.query.q || "")
                .trim()
                .toLowerCase();

        let users = db.users.filter(
            user => user.id !== currentUser.id
        );

        if (q) {
            users = users.filter(
                user =>
                    String(user.name)
                        .toLowerCase()
                        .includes(q) ||
                    String(user.username)
                        .toLowerCase()
                        .includes(q)
            );
        }

        res.json({
            users: users
                .slice(0, 50)
                .map(publicUser)
        });
    }
);

// ============================================================
// BARÁTKÉRÉS
// ============================================================

app.post(
    "/api/friends/request",
    requireLogin,
    (req, res) => {
        const currentUser = getUser(req);

        const targetId =
            Number(req.body.userId);

        if (!targetId) {
            return res.status(400).json({
                error:
                    "Nincs megadva felhasználó."
            });
        }

        if (
            targetId === currentUser.id
        ) {
            return res.status(400).json({
                error:
                    "Saját magadat nem jelölheted."
            });
        }

        const target =
            db.users.find(
                user =>
                    user.id === targetId
            );

        if (!target) {
            return res.status(404).json({
                error:
                    "A felhasználó nem található."
            });
        }

        if (
            areFriends(
                currentUser.id,
                targetId
            )
        ) {
            return res.status(400).json({
                error:
                    "Már barátok vagytok."
            });
        }

        const existing =
            db.friendships.find(
                friendship =>
                    (
                        friendship.sender ===
                            currentUser.id &&
                        friendship.receiver ===
                            targetId
                    ) ||
                    (
                        friendship.sender ===
                            targetId &&
                        friendship.receiver ===
                            currentUser.id
                    )
            );

        if (existing) {
            if (
                existing.status ===
                "pending"
            ) {
                return res.status(400).json({
                    error:
                        "Már van függőben lévő barátkérelem."
                });
            }

            return res.status(400).json({
                error:
                    "Már létezik kapcsolat."
            });
        }

        db.friendships.push({
            id: nextId("friendship"),
            sender: currentUser.id,
            receiver: targetId,
            status: "pending",
            date: new Date().toISOString()
        });

        saveDB();

        res.json({
            success: true
        });
    }
);

// ============================================================
// BARÁTKÉRELMEK
// ============================================================

app.get(
    "/api/friends/requests",
    requireLogin,
    (req, res) => {
        const currentUser = getUser(req);

        const requests =
            db.friendships
                .filter(
                    friendship =>
                        friendship.receiver ===
                            currentUser.id &&
                        friendship.status ===
                            "pending"
                )
                .map(friendship => {
                    const sender =
                        db.users.find(
                            user =>
                                user.id ===
                                friendship.sender
                        );

                    if (!sender) {
                        return null;
                    }

                    return {
                        id: sender.id,
                        name: sender.name,
                        username:
                            sender.username,
                        friendshipId:
                            friendship.id
                    };
                })
                .filter(Boolean);

        res.json({
            requests
        });
    }
);

// ============================================================
// BARÁTKÉRÉS ELFOGADÁSA
// ============================================================

app.post(
    "/api/friends/:id/accept",
    requireLogin,
    (req, res) => {
        const currentUser = getUser(req);

        const senderId =
            Number(req.params.id);

        const friendship =
            db.friendships.find(
                item =>
                    item.receiver ===
                        currentUser.id &&
                    item.sender ===
                        senderId &&
                    item.status ===
                        "pending"
            );

        if (!friendship) {
            return res.status(404).json({
                error:
                    "A barátkérelem nem található."
            });
        }

        friendship.status =
            "accepted";

        friendship.date =
            new Date().toISOString();

        saveDB();

        res.json({
            success: true
        });
    }
);

// ============================================================
// BARÁTKÉRÉS ELUTASÍTÁSA
// ============================================================

app.post(
    "/api/friends/:id/reject",
    requireLogin,
    (req, res) => {
        const currentUser = getUser(req);

        const senderId =
            Number(req.params.id);

        const index =
            db.friendships.findIndex(
                item =>
                    item.receiver ===
                        currentUser.id &&
                    item.sender ===
                        senderId &&
                    item.status ===
                        "pending"
            );

        if (index === -1) {
            return res.status(404).json({
                error:
                    "A barátkérelem nem található."
            });
        }

        db.friendships.splice(
            index,
            1
        );

        saveDB();

        res.json({
            success: true
        });
    }
);

// ============================================================
// BARÁTOK
// ============================================================

app.get(
    "/api/friends",
    requireLogin,
    (req, res) => {
        const currentUser = getUser(req);

        const friends =
            getFriendIds(
                currentUser.id
            )
                .map(id =>
                    db.users.find(
                        user =>
                            user.id === id
                    )
                )
                .filter(Boolean)
                .map(publicUser);

        res.json({
            friends
        });
    }
);

// ============================================================
// ÜZENETEK LEKÉRÉSE
// ============================================================

app.get(
    "/api/messages/:friendId",
    requireLogin,
    (req, res) => {
        const currentUser = getUser(req);

        const friendId =
            Number(req.params.friendId);

        if (
            !areFriends(
                currentUser.id,
                friendId
            )
        ) {
            return res.status(403).json({
                error:
                    "Csak barátokkal lehet beszélgetni."
            });
        }

        const messages =
            db.messages
                .filter(
                    message =>
                        (
                            message.sender ===
                                currentUser.id &&
                            message.receiver ===
                                friendId
                        ) ||
                        (
                            message.sender ===
                                friendId &&
                            message.receiver ===
                                currentUser.id
                        )
                )
                .sort(
                    (a, b) =>
                        new Date(a.date) -
                        new Date(b.date)
                )
                .map(message => ({
                    id: message.id,
                    sender:
                        message.sender,
                    receiver:
                        message.receiver,
                    message:
                        message.message,
                    date:
                        message.date,
                    type:
                        message.type ||
                        "text",
                    materialId:
                        message.materialId ||
                        null
                }));

        res.json({
            messages
        });
    }
);

// ============================================================
// ÜZENET KÜLDÉSE
// ============================================================

app.post(
    "/api/messages/:friendId",
    requireLogin,
    (req, res) => {
        const currentUser = getUser(req);

        const friendId =
            Number(req.params.friendId);

        const message =
            String(
                req.body.message || ""
            ).trim();

        const type =
            req.body.type ||
            "text";

        const materialId =
            req.body.materialId
                ? Number(
                    req.body.materialId
                )
                : null;

        if (!message) {
            return res.status(400).json({
                error:
                    "Üres üzenet nem küldhető."
            });
        }

        if (
            !areFriends(
                currentUser.id,
                friendId
            )
        ) {
            return res.status(403).json({
                error:
                    "Csak barátnak küldhetsz üzenetet."
            });
        }

        const friend =
            db.users.find(
                user =>
                    user.id === friendId
            );

        if (!friend) {
            return res.status(404).json({
                error:
                    "A barát nem található."
            });
        }

        // Ha tananyag üzenetet küldünk,
        // ellenőrizzük, hogy létezik-e
        // és a küldő tulajdona-e.
        if (materialId) {
            const material =
                db.materials.find(
                    item =>
                        item.id ===
                        materialId
                );

            if (!material) {
                return res.status(404).json({
                    error:
                        "A tananyag nem található."
                });
            }

            if (
                material.creator !==
                currentUser.id
            ) {
                return res.status(403).json({
                    error:
                        "Ezt a tananyagot nem küldheted el."
                });
            }

            if (
                !Array.isArray(
                    material.sharedWith
                )
            ) {
                material.sharedWith = [];
            }

            if (
                !material.sharedWith.includes(
                    friendId
                )
            ) {
                material.sharedWith.push(
                    friendId
                );
            }
        }

        const newMessage = {
            id: nextId("message"),

            sender:
                currentUser.id,

            receiver:
                friendId,

            message,

            date:
                new Date().toISOString(),

            type,

            materialId
        };

        db.messages.push(
            newMessage
        );

        saveDB();

        res.json({
            success: true,
            message:
                newMessage
        });
    }
);

// ============================================================
// TANULÓBARÁT AI – VALÓDI AI TANANYAG / HÁZI / TESZT
// ============================================================

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});


// ============================================================
// AI JSON TISZTÍTÁSA
// ============================================================

function cleanAIJson(text) {
    let result = String(text || "").trim();

    // Markdown code block eltávolítása
    result = result.replace(/^```json\s*/i, "");
    result = result.replace(/^```\s*/i, "");
    result = result.replace(/\s*```$/i, "");
    result = result.trim();

    // Ha az AI véletlenül szöveget írt a JSON elé,
    // csak a JSON objektumot vesszük ki.
    const first = result.indexOf("{");
    const last = result.lastIndexOf("}");

    if (first !== -1 && last !== -1) {
        result = result.substring(first, last + 1);
    }

    return JSON.parse(result);
}


// ============================================================
// AI TANANYAG GENERÁLÁS
// ============================================================

app.post(
    "/api/ai/generate",
    requireLogin,
    async (req, res) => {

        try {

            const subject =
                String(req.body.subject || "").trim();

            const topic =
                String(req.body.topic || "").trim();

            const type =
                String(req.body.type || "material").trim();

            const currentUser =
                getUser(req);

            const grade =
                Number(currentUser?.grade || 8);


            // ----------------------------------------------------
            // Ellenőrzés
            // ----------------------------------------------------

            if (!subject || !topic) {

                return res.status(400).json({
                    error:
                        "A tantárgy és a téma megadása kötelező."
                });

            }


            if (
                !["material", "homework", "test"].includes(type)
            ) {

                return res.status(400).json({
                    error:
                        "Érvénytelen AI-típus."
                });

            }


            if (!process.env.OPENAI_API_KEY) {

                console.error(
                    "Hiányzik az OPENAI_API_KEY!"
                );

                return res.status(500).json({
                    error:
                        "Az AI nincs beállítva a szerveren. " +
                        "Hiányzik az OPENAI_API_KEY."
                });

            }


            // ----------------------------------------------------
            // Típushoz tartozó utasítás
            // ----------------------------------------------------

            let typeInstruction = "";


            // TANANYAG
            if (type === "material") {

                typeInstruction = `
KÉSZÍTS RÉSZLETES ISKOLAI TANANYAGOT.

A tananyag legyen ténylegesen a megadott
tantárgyról és témáról.

Kötelező részek:

- cím
- bevezetés
- részletes magyarázat
- fontos fogalmak
- fontos szabályok és összefüggések
- konkrét példák
- gyakori hibák
- "Mire figyelj?" rész
- rövid összefoglaló
- 5 ellenőrző kérdés

A magyarázatot a ${grade}. évfolyam tanulójának
szintjén írd.

NE írj általános szöveget.

Például ilyeneket NE használj:

"Ez egy fontos témakör."
"Érdemes megtanulni."
"Gondold végig, hogyan működik."

Ehelyett valódi információkat és konkrét példákat adj.
`;
            }


            // HÁZI FELADAT
            if (type === "homework") {

                typeInstruction = `
KÉSZÍTS VALÓDI ISKOLAI HÁZI FELADATOT.

A házi feladat legyen ténylegesen megoldható
a ${grade}. évfolyam számára.

Legyen benne legalább 8 különböző feladat.

A feladatok között legyen:

- könnyű feladat
- közepes feladat
- nehezebb feladat
- gondolkodtató feladat
- alkalmazási feladat

A feladatok ténylegesen a következő témáról szóljanak:

${topic}

Ha matematika vagy más számolós tantárgy,
akkor adj konkrét számokat és konkrét példákat.

Ha történelem, magyar, biológia, földrajz stb.,
akkor valódi, témához kapcsolódó kérdéseket adj.

A végén legyen teljes megoldókulcs.

NE írj olyan üres feladatokat, mint:

"Írd le a témát."
"Fogalmazd meg saját szavaiddal."
"Keress egy példát."

Csak akkor használj ilyen feladatot,
ha az adott tantárgy és téma miatt valóban indokolt.
`;
            }


            // TESZT
            if (type === "test") {

                typeInstruction = `
KÉSZÍTS VALÓDI ISKOLAI TESZTET.

A teszt a ${grade}. évfolyam szintjének megfelelő legyen.

Legyen legalább 10 kérdés.

Használj többféle kérdéstípust:

1. Feleletválasztós
2. Igaz / hamis
3. Rövid válaszos
4. Alkalmazási feladat
5. Ha a tantárgy indokolja, számolós feladat

A kérdések ténylegesen a megadott témáról szóljanak.

Ne legyen minden kérdés ugyanolyan.

A végén legyen teljes megoldókulcs.

A teszt ne legyen túl könnyű.

A kérdések fokozatosan legyenek nehezebbek.
`;
            }


            // ----------------------------------------------------
            // Rendszerutasítás
            // ----------------------------------------------------

            const systemPrompt = `
Te vagy a TanulóBarát intelligens magyar iskolai AI-tanára.

Feladatod, hogy ${grade}. évfolyamos magyar tanulóknak
készíts pontos, hasznos és érthető oktatási anyagokat.

TANTÁRGY:
${subject}

TÉMA:
${topic}

ÉVFOLYAM:
${grade}.

${typeInstruction}

FONTOS SZABÁLYOK:

- Mindig magyarul válaszolj.
- Csak a megadott tantárggyal és témával foglalkozz.
- Ne térj el a témától.
- Ne használj sablonos töltelékszöveget.
- Adj konkrét információkat.
- Adj konkrét példákat.
- A szöveg legyen könnyen tanulható.
- Használj címsorokat.
- Használj felsorolásokat, ahol hasznos.
- A ${grade}. évfolyam szintjén magyarázz.
- Ne találj ki adatokat.
- Matematikai feladatoknál ellenőrizd a számításokat.
- A válaszok legyenek egyértelműek.
- Ne írj JSON-on kívüli szöveget.

A VÁLASZT KIZÁRÓLAG ÉRVÉNYES JSON FORMÁBAN ADD VISSZA.

A JSON formátuma:

{
    "title": "A létrehozott anyag címe",

    "explanation": "Részletes magyarázat",

    "important": [
        "Fontos fogalom 1",
        "Fontos fogalom 2",
        "Fontos szabály 3"
    ],

    "examples": [
        "Konkrét példa 1",
        "Konkrét példa 2",
        "Konkrét példa 3"
    ],

    "tasks": [
        {
            "question": "A feladat kérdése",
            "options": [],
            "answer": "Helyes válasz",
            "solution": "Részletes megoldás vagy magyarázat"
        }
    ],

    "summary": "A teljes téma rövid összefoglalása"
}

Ha feleletválasztós kérdést készítesz,
az options tömbben legyen 3-4 lehetőség.

Ha nem feleletválasztós a feladat,
az options legyen üres tömb.

A tasks tömbben minden feladatnak legyen
question, options, answer és solution mezője.
`;


            // ----------------------------------------------------
            // AI HÍVÁS
            // ----------------------------------------------------

            const completion =
                await openai.chat.completions.create({

                    model:
                        process.env.OPENAI_MODEL ||
                        "gpt-4o-mini",

                    temperature: 0.7,

                    messages: [

                        {
                            role: "system",
                            content: systemPrompt
                        },

                        {
                            role: "user",
                            content: `
Készítsd el a következő ${type === "material"
                                ? "tananyagot"
                                : type === "homework"
                                    ? "házi feladatot"
                                    : "tesztet"
                            }.

Tantárgy: ${subject}

Téma: ${topic}

Évfolyam: ${grade}.
`
                        }

                    ]

                });


            // ----------------------------------------------------
            // AI VÁLASZ
            // ----------------------------------------------------

            const rawContent =
                completion?.choices?.[0]?.message?.content || "";


            if (!rawContent) {

                throw new Error(
                    "Az AI nem adott vissza választ."
                );

            }


            // ----------------------------------------------------
            // JSON FELDOLGOZÁSA
            // ----------------------------------------------------

            let ai;

            try {

                ai =
                    cleanAIJson(rawContent);

            } catch (jsonError) {

                console.error(
                    "AI hibás JSON:",
                    rawContent
                );

                throw new Error(
                    "Az AI hibás választ adott vissza."
                );

            }


            // ----------------------------------------------------
            // ADATOK BIZTONSÁGOS NORMALIZÁLÁSA
            // ----------------------------------------------------

            const title =
                String(
                    ai.title ||
                    `${subject} – ${topic}`
                ).trim();


            const explanation =
                String(
                    ai.explanation || ""
                ).trim();


            const important =
                Array.isArray(ai.important)
                    ? ai.important
                        .map(item => String(item).trim())
                        .filter(Boolean)
                    : [];


            const examples =
                Array.isArray(ai.examples)
                    ? ai.examples
                        .map(item => String(item).trim())
                        .filter(Boolean)
                    : [];


            const tasks =
                Array.isArray(ai.tasks)
                    ? ai.tasks
                        .map(task => ({

                            question:
                                String(
                                    task?.question || ""
                                ).trim(),

                            options:
                                Array.isArray(task?.options)
                                    ? task.options
                                        .map(option =>
                                            String(option).trim()
                                        )
                                        .filter(Boolean)
                                    : [],

                            answer:
                                String(
                                    task?.answer || ""
                                ).trim(),

                            solution:
                                String(
                                    task?.solution || ""
                                ).trim()

                        }))
                        .filter(task => task.question)
                    : [];


            const summary =
                String(
                    ai.summary || ""
                ).trim();


            // ----------------------------------------------------
            // TELJES SZÖVEG LÉTREHOZÁSA
            // ----------------------------------------------------

            let content = "";

            content +=
                `# ${title}\n\n`;


            if (explanation) {

                content +=
                    `## 📖 Magyarázat\n\n` +
                    `${explanation}\n\n`;

            }


            if (important.length) {

                content +=
                    `## 💡 Fontos tudnivalók\n\n`;

                important.forEach(
                    (item, index) => {

                        content +=
                            `${index + 1}. ${item}\n`;

                    }
                );

                content += "\n";

            }


            if (examples.length) {

                content +=
                    `## 📚 Példák\n\n`;

                examples.forEach(
                    (example, index) => {

                        content +=
                            `### Példa ${index + 1}\n` +
                            `${example}\n\n`;

                    }
                );

            }


            if (tasks.length) {

                content +=
                    `## 📝 Feladatok\n\n`;

                tasks.forEach(
                    (task, index) => {

                        content +=
                            `### ${index + 1}. feladat\n` +
                            `${task.question}\n\n`;

                        if (task.options.length) {

                            task.options.forEach(
                                (option, optionIndex) => {

                                    content +=
                                        `${String.fromCharCode(
                                            65 + optionIndex
                                        )}) ${option}\n`;

                                }
                            );

                            content += "\n";

                        }

                    }
                );


                // Megoldókulcs
                content +=
                    `## ✅ Megoldókulcs\n\n`;

                tasks.forEach(
                    (task, index) => {

                        content +=
                            `**${index + 1}. feladat:** ` +
                            `${task.answer}\n`;

                        if (task.solution) {

                            content +=
                                `${task.solution}\n`;

                        }

                        content += "\n";

                    }
                );

            }


            if (summary) {

                content +=
                    `## 📌 Összefoglaló\n\n` +
                    `${summary}\n`;

            }


            // ----------------------------------------------------
            // VÁLASZ A FRONTENDNEK
            // ----------------------------------------------------

            return res.json({

                success: true,

                type,

                subject,

                topic,

                grade,

                title,

                explanation,

                important,

                examples,

                tasks,

                summary,

                content

            });


        } catch (error) {

            console.error(
                "================================================"
            );

            console.error(
                "AI GENERÁLÁSI HIBA"
            );

            console.error(
                error
            );

            console.error(
                "================================================"
            );


            return res.status(500).json({

                error:
                    error?.message ||
                    "Az AI anyag elkészítése közben hiba történt."

            });

        }

    }
);
// ============================================================
// TANANYAG LÉTREHOZÁSA / KÜLDÉSE
// ============================================================

app.post(
    "/api/materials",
    requireLogin,
    (req, res) => {

        try {

            const currentUser =
                getUser(req);

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
                ).trim();

            const type =
                String(
                    req.body.type || "material"
                ).trim();

            const friendId =
                req.body.friendId
                    ? Number(req.body.friendId)
                    : null;


            // ----------------------------------------------------
            // Alapellenőrzés
            // ----------------------------------------------------

            if (!title || !content) {

                return res.status(400).json({
                    error:
                        "Hiányzik a tananyag címe vagy tartalma."
                });

            }


            // ----------------------------------------------------
            // Típus ellenőrzése
            // ----------------------------------------------------

            if (
                ![
                    "material",
                    "homework",
                    "test"
                ].includes(type)
            ) {

                return res.status(400).json({
                    error:
                        "Érvénytelen tananyag típus."
                });

            }


            // ----------------------------------------------------
            // Barát ellenőrzése
            // ----------------------------------------------------

            if (friendId !== null) {

                if (!Number.isInteger(friendId)) {

                    return res.status(400).json({
                        error:
                            "Érvénytelen barátazonosító."
                    });

                }


                if (
                    friendId === currentUser.id
                ) {

                    return res.status(400).json({
                        error:
                            "Saját magadnak nem küldhetsz tananyagot."
                    });

                }


                if (
                    !areFriends(
                        currentUser.id,
                        friendId
                    )
                ) {

                    return res.status(403).json({
                        error:
                            "A tananyagot csak barátnak küldheted."
                    });

                }

            }


            // ----------------------------------------------------
            // Tananyag létrehozása
            // ----------------------------------------------------

            const material = {

                id:
                    nextId("material"),

                creator:
                    currentUser.id,

                subject,

                title,

                content,

                type,

                date:
                    new Date().toISOString(),

                sharedWith:
                    friendId !== null
                        ? [friendId]
                        : []

            };


            db.materials.push(
                material
            );


            saveDB();


            // ----------------------------------------------------
            // Ha barátnak küldjük
            // automatikus chat-üzenet
            // ----------------------------------------------------

            if (friendId !== null) {

                const materialMessage = {

                    id:
                        nextId("message"),

                    sender:
                        currentUser.id,

                    receiver:
                        friendId,

                    message:
                        type === "homework"
                            ? `📝 Házi feladatot küldött: ${title}`
                            : type === "test"
                                ? `🧪 Tesztet küldött: ${title}`
                                : `📚 Tananyagot küldött: ${title}`,

                    date:
                        new Date().toISOString(),

                    type:
                        "material",

                    materialId:
                        material.id

                };


                db.messages.push(
                    materialMessage
                );


                saveDB();

            }


            // ----------------------------------------------------
            // Válasz
            // ----------------------------------------------------

            return res.json({

                success: true,

                material

            });


        } catch (error) {

            console.error(
                "Tananyag mentési hiba:",
                error
            );

            return res.status(500).json({

                error:
                    "A tananyag mentése közben hiba történt."

            });

        }

    }
);


// ============================================================
// TANANYAGOK LEKÉRÉSE
// ============================================================

app.get(
    "/api/materials",
    requireLogin,
    (req, res) => {

        try {

            const currentUser =
                getUser(req);


            const materials =
                db.materials
                    .filter(
                        material => {

                            const isCreator =
                                material.creator ===
                                currentUser.id;


                            const isShared =
                                Array.isArray(
                                    material.sharedWith
                                ) &&
                                material.sharedWith.includes(
                                    currentUser.id
                                );


                            return (
                                isCreator ||
                                isShared
                            );

                        }
                    )
                    .sort(
                        (a, b) =>
                            new Date(b.date) -
                            new Date(a.date)
                    );


            return res.json({

                materials

            });


        } catch (error) {

            console.error(
                "Tananyagok lekérési hiba:",
                error
            );

            return res.status(500).json({

                error:
                    "A tananyagok betöltése sikertelen."

            });

        }

    }
);
// ============================================================
// EGY TANANYAG MEGNYITÁSA
// ============================================================

app.get(
    "/api/materials/:id",
    requireLogin,
    (req, res) => {
        const currentUser = getUser(req);

        const id =
            Number(req.params.id);

        const material =
            db.materials.find(
                item =>
                    item.id === id
            );

        if (!material) {
            return res.status(404).json({
                error:
                    "A tananyag nem található."
            });
        }

        if (
            !Array.isArray(
                material.sharedWith
            )
        ) {
            material.sharedWith = [];
        }

        const allowed =
            material.creator ===
                currentUser.id ||
            material.sharedWith.includes(
                currentUser.id
            );

        if (!allowed) {
            return res.status(403).json({
                error:
                    "Nincs hozzáférésed ehhez a tananyaghoz."
            });
        }

        res.json({
            material
        });
    }
);

// ============================================================
// ÉRTÉKELÉS
// ============================================================

app.post(
    "/api/ratings",
    requireLogin,
    (req, res) => {
        const currentUser = getUser(req);

        const ratedUserId =
            Number(req.body.ratedUserId);

        const stars =
            Number(req.body.stars);

        if (!ratedUserId) {
            return res.status(400).json({
                error:
                    "Nincs megadva értékelt felhasználó."
            });
        }

        if (
            ratedUserId ===
            currentUser.id
        ) {
            return res.status(400).json({
                error:
                    "Saját magadat nem értékelheted."
            });
        }

        if (
            stars < 1 ||
            stars > 5
        ) {
            return res.status(400).json({
                error:
                    "Az értékelés 1 és 5 csillag között lehet."
            });
        }

        const target =
            db.users.find(
                user =>
                    user.id ===
                    ratedUserId
            );

        if (!target) {
            return res.status(404).json({
                error:
                    "A felhasználó nem található."
            });
        }

        if (
            !areFriends(
                currentUser.id,
                ratedUserId
            )
        ) {
            return res.status(403).json({
                error:
                    "Csak barátot értékelhetsz."
            });
        }

        const existing =
            db.ratings.find(
                rating =>
                    rating.rater ===
                        currentUser.id &&
                    rating.rated ===
                        ratedUserId
            );

        if (existing) {
            existing.stars =
                stars;

            existing.date =
                new Date().toISOString();
        } else {
            db.ratings.push({
                id: nextId("rating"),
                rater:
                    currentUser.id,
                rated:
                    ratedUserId,
                stars,
                date:
                    new Date().toISOString()
            });
        }

        saveDB();

        res.json({
            success: true
        });
    }
);

// ============================================================
// JEGY ADÁSA
// ============================================================

app.post(
    "/api/grades",
    requireLogin,
    (req, res) => {
        const currentUser = getUser(req);

        const receiverId =
            Number(
                req.body.receiverId
            );

        const subject =
            String(
                req.body.subject || ""
            ).trim();

        const grade =
            Number(req.body.grade);

        if (!receiverId) {
            return res.status(400).json({
                error:
                    "Nincs megadva tanuló."
            });
        }

        if (!subject) {
            return res.status(400).json({
                error:
                    "Add meg a tantárgyat."
            });
        }

        if (
            grade < 1 ||
            grade > 5
        ) {
            return res.status(400).json({
                error:
                    "A jegy 1 és 5 között lehet."
            });
        }

        if (
            receiverId ===
            currentUser.id
        ) {
            return res.status(400).json({
                error:
                    "Saját magadnak nem adhatsz jegyet."
            });
        }

        if (
            !areFriends(
                currentUser.id,
                receiverId
            )
        ) {
            return res.status(403).json({
                error:
                    "Csak barátnak adhatsz jegyet."
            });
        }

        const receiver =
            db.users.find(
                user =>
                    user.id ===
                    receiverId
            );

        if (!receiver) {
            return res.status(404).json({
                error:
                    "A felhasználó nem található."
            });
        }

        db.grades.push({
            id: nextId("grade"),

            giver:
                currentUser.id,

            receiver:
                receiverId,

            subject,

            grade,

            date:
                new Date().toISOString()
        });

        saveDB();

        res.json({
            success: true
        });
    }
);

// ============================================================
// JEGYEK LEKÉRÉSE
// ============================================================

app.get(
    "/api/grades/:userId",
    requireLogin,
    (req, res) => {
        const currentUser = getUser(req);

        const userId =
            Number(req.params.userId);

        if (
            userId !==
            currentUser.id
        ) {
            return res.status(403).json({
                error:
                    "Nincs hozzáférésed."
            });
        }

        const grades =
            db.grades
                .filter(
                    item =>
                        item.receiver ===
                        userId
                )
                .sort(
                    (a, b) =>
                        new Date(b.date) -
                        new Date(a.date)
                )
                .map(item => ({
                    id: item.id,
                    giver:
                        item.giver,
                    giverName:
                        (
                            db.users.find(
                                user =>
                                    user.id ===
                                    item.giver
                            ) || {}
                        ).name ||
                        "Ismeretlen",
                    receiver:
                        item.receiver,
                    subject:
                        item.subject,
                    grade:
                        item.grade,
                    date:
                        item.date
                }));

        res.json({
            grades
        });
    }
);

// ============================================================
// STATISZTIKÁK
// ============================================================

app.get(
    "/api/stats",
    requireLogin,
    (req, res) => {
        const currentUser = getUser(req);

        const friendIds =
            getFriendIds(
                currentUser.id
            );

        const sentMessages =
            db.messages.filter(
                message =>
                    message.sender ===
                    currentUser.id
            ).length;

        const materials =
            db.materials.filter(
                material =>
                    material.creator ===
                    currentUser.id
            ).length;

        const grades =
            db.grades.filter(
                grade =>
                    grade.receiver ===
                    currentUser.id
            ).length;

        res.json({
            friends:
                friendIds.length,

            sentMessages,

            materials,

            grades
        });
    }
);

// ============================================================
// STATIKUS WEBOLDAL
// ============================================================

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);

// ============================================================
// SPA FALLBACK
// ============================================================

app.get(
    /.*/,
    (req, res) => {
        res.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );
    }
);

// ============================================================
// SZERVER INDÍTÁSA
// ============================================================

app.listen(
    PORT,
    () => {
        console.log(
            "================================"
        );

        console.log(
            "       TANULÓBARÁT SZERVER"
        );

        console.log(
            "================================"
        );

        console.log(
            `Szerver port: ${PORT}`
        );

        console.log(
            `Környezet: ${
                isProduction
                    ? "production"
                    : "local"
            }`
        );
    }
);