const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
    session({
        secret: "tanulobarat-secret-2030",
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 1000 * 60 * 60 * 24 * 30,
            httpOnly: true
        }
    })
);

const DATA_FILE = path.join(__dirname, "tanulobarat-data.json");

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

function loadDB() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            fs.writeFileSync(
                DATA_FILE,
                JSON.stringify(emptyDB, null, 2),
                "utf8"
            );

            return structuredClone(emptyDB);
        }

        const data = JSON.parse(
            fs.readFileSync(DATA_FILE, "utf8")
        );

        return {
            ...emptyDB,
            ...data,
            nextIds: {
                ...emptyDB.nextIds,
                ...(data.nextIds || {})
            }
        };
    } catch (error) {
        console.error("Adatbázis betöltési hiba:", error);
        return structuredClone(emptyDB);
    }
}

let db = loadDB();

function saveDB() {
    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(db, null, 2),
        "utf8"
    );
}

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
        avatar: user.avatar || null
    };
}

function requireLogin(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({
            error: "Nincs bejelentkezve."
        });
    }

    next();
}

function getUser(req) {
    return db.users.find(
        user => user.id === Number(req.session.userId)
    );
}

function areFriends(userA, userB) {
    return db.friendships.some(friendship =>
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
            String(username).trim().toLowerCase();

        const normalizedEmail =
            String(email).trim().toLowerCase();

        if (password.length < 6) {
            return res.status(400).json({
                error: "A jelszó legalább 6 karakter legyen."
            });
        }

        const gradeNumber = Number(grade);

        if (
            !Number.isInteger(gradeNumber) ||
            gradeNumber < 5 ||
            gradeNumber > 12
        ) {
            return res.status(400).json({
                error: "Az évfolyam 5 és 12 között lehet."
            });
        }

        if (
            db.users.some(
                user =>
                    user.username.toLowerCase() ===
                    normalizedUsername
            )
        ) {
            return res.status(400).json({
                error: "Ez a felhasználónév már foglalt."
            });
        }

        if (
            db.users.some(
                user =>
                    user.email.toLowerCase() ===
                    normalizedEmail
            )
        ) {
            return res.status(400).json({
                error: "Ez az e-mail cím már használatban van."
            });
        }

        const hashedPassword =
            await bcrypt.hash(password, 10);

        const user = {
            id: nextId("user"),
            name: String(name).trim(),
            username: normalizedUsername,
            email: normalizedEmail,
            password: hashedPassword,
            grade: gradeNumber,
            avatar: null,
            createdAt: new Date().toISOString()
        };

        db.users.push(user);
        saveDB();

        req.session.userId = user.id;

        res.json({
            success: true,
            user: publicUser(user)
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
            String(username).trim().toLowerCase();

        const user = db.users.find(
            item =>
                item.username.toLowerCase() ===
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
                password,
                user.password
            );

        if (!valid) {
            return res.status(401).json({
                error:
                    "Hibás felhasználónév vagy jelszó."
            });
        }

        req.session.userId = user.id;

        res.json({
            success: true,
            user: publicUser(user)
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

app.post("/api/logout", (req, res) => {
    req.session.destroy(() => {
        res.json({
            success: true
        });
    });
});


// ============================================================
// AKTUÁLIS FELHASZNÁLÓ
// ============================================================

app.get("/api/me", (req, res) => {
    if (!req.session.userId) {
        return res.json({
            user: null
        });
    }

    const user = getUser(req);

    if (!user) {
        req.session.destroy(() => {});

        return res.json({
            user: null
        });
    }

    res.json({
        user: publicUser(user)
    });
});


// ============================================================
// PROFIL SZERKESZTÉSE
// ============================================================

app.put("/api/profile", requireLogin, async (req, res) => {
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
                    "Minden kötelező mezőt ki kell tölteni."
            });
        }

        const newUsername =
            String(username).trim().toLowerCase();

        const newEmail =
            String(email).trim().toLowerCase();

        const newGrade =
            Number(grade);

        if (
            !Number.isInteger(newGrade) ||
            newGrade < 5 ||
            newGrade > 12
        ) {
            return res.status(400).json({
                error:
                    "Az évfolyam 5 és 12 között lehet."
            });
        }

        const usernameTaken =
            db.users.some(item =>
                item.id !== user.id &&
                item.username.toLowerCase() ===
                    newUsername
            );

        if (usernameTaken) {
            return res.status(400).json({
                error:
                    "Ez a felhasználónév már foglalt."
            });
        }

        const emailTaken =
            db.users.some(item =>
                item.id !== user.id &&
                item.email.toLowerCase() ===
                    newEmail
            );

        if (emailTaken) {
            return res.status(400).json({
                error:
                    "Ez az e-mail cím már használatban van."
            });
        }

        if (
            password !== undefined &&
            password !== ""
        ) {
            if (String(password).length < 6) {
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

        if (avatar !== undefined) {
            const avatarString =
                String(avatar);

            if (
                avatarString &&
                !avatarString.startsWith("data:image/")
            ) {
                return res.status(400).json({
                    error:
                        "Érvénytelen profilkép."
                });
            }

            if (
                avatarString.length > 1000000
            ) {
                return res.status(400).json({
                    error:
                        "A profilkép túl nagy."
                });
            }

            user.avatar =
                avatarString || null;
        }

        user.name =
            String(name).trim();

        user.username =
            newUsername;

        user.email =
            newEmail;

        user.grade =
            newGrade;

        saveDB();

        res.json({
            success: true,
            user: publicUser(user)
        });

    } catch (error) {
        console.error(
            "Profil frissítési hiba:",
            error
        );

        res.status(500).json({
            error:
                "Profil frissítési hiba."
        });
    }
});
// ============================================================
// FELHASZNÁLÓK KERESÉSE
// ============================================================

app.get("/api/users", requireLogin, (req, res) => {
    const q = String(req.query.q || "")
        .trim()
        .toLowerCase();

    const currentUser = getUser(req);

    let users = db.users.filter(
        user => user.id !== currentUser.id
    );

    if (q) {
        users = users.filter(user =>
            user.name.toLowerCase().includes(q) ||
            user.username.toLowerCase().includes(q)
        );
    }

    res.json({
        users: users.map(publicUser)
    });
});


// ============================================================
// BARÁTI KÉRÉS KÜLDÉSE
// ============================================================

app.post(
    "/api/friends/request",
    requireLogin,
    (req, res) => {
        const currentUser = getUser(req);
        const userId = Number(req.body.userId);

        if (!userId) {
            return res.status(400).json({
                error: "Hiányzó felhasználó."
            });
        }

        if (userId === currentUser.id) {
            return res.status(400).json({
                error:
                    "Saját magadnak nem küldhetsz baráti kérést."
            });
        }

        const targetUser = db.users.find(
            user => user.id === userId
        );

        if (!targetUser) {
            return res.status(404).json({
                error:
                    "A felhasználó nem található."
            });
        }

        const existing = db.friendships.find(
            friendship =>
                (
                    friendship.sender === currentUser.id &&
                    friendship.receiver === userId
                ) ||
                (
                    friendship.sender === userId &&
                    friendship.receiver === currentUser.id
                )
        );

        if (existing) {
            if (existing.status === "accepted") {
                return res.status(400).json({
                    error:
                        "Már barátok vagytok."
                });
            }

            if (existing.status === "pending") {
                return res.status(400).json({
                    error:
                        "Már van függőben lévő baráti kérés."
                });
            }
        }

        const friendship = {
            id: nextId("friendship"),
            sender: currentUser.id,
            receiver: userId,
            status: "pending",
            date: new Date().toISOString()
        };

        db.friendships.push(friendship);
        saveDB();

        res.json({
            success: true
        });
    }
);


// ============================================================
// BARÁTI KÉRÉSEK
// ============================================================

app.get(
    "/api/friends/requests",
    requireLogin,
    (req, res) => {
        const currentUser = getUser(req);

        const requests = db.friendships
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

                if (!sender) return null;

                return {
                    id: sender.id,
                    name: sender.name,
                    username: sender.username,
                    avatar: sender.avatar || null,
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
// BARÁTI KÉRÉS ELFOGADÁSA
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
                    item.sender === senderId &&
                    item.receiver ===
                        currentUser.id &&
                    item.status === "pending"
            );

        if (!friendship) {
            return res.status(404).json({
                error:
                    "A baráti kérés nem található."
            });
        }

        friendship.status = "accepted";
        friendship.date =
            new Date().toISOString();

        saveDB();

        res.json({
            success: true
        });
    }
);


// ============================================================
// BARÁTI KÉRÉS ELUTASÍTÁSA
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
                    item.sender === senderId &&
                    item.receiver ===
                        currentUser.id &&
                    item.status === "pending"
            );

        if (index === -1) {
            return res.status(404).json({
                error:
                    "A baráti kérés nem található."
            });
        }

        db.friendships.splice(index, 1);

        saveDB();

        res.json({
            success: true
        });
    }
);


// ============================================================
// BARÁTOK LISTÁJA
// ============================================================

app.get(
    "/api/friends",
    requireLogin,
    (req, res) => {
        const currentUser = getUser(req);

        const friendships =
            db.friendships.filter(
                friendship =>
                    friendship.status ===
                        "accepted" &&
                    (
                        friendship.sender ===
                            currentUser.id ||
                        friendship.receiver ===
                            currentUser.id
                    )
            );

        const friends = friendships
            .map(friendship => {
                const friendId =
                    friendship.sender ===
                        currentUser.id
                        ? friendship.receiver
                        : friendship.sender;

                return db.users.find(
                    user =>
                        user.id === friendId
                );
            })
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
            db.messages.filter(
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
            );

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

        const {
            message,
            type,
            materialId
        } = req.body;

        if (
            !areFriends(
                currentUser.id,
                friendId
            )
        ) {
            return res.status(403).json({
                error:
                    "Csak barátoknak küldhetsz üzenetet."
            });
        }

        if (
            !message ||
            !String(message).trim()
        ) {
            return res.status(400).json({
                error:
                    "Az üzenet nem lehet üres."
            });
        }

        const target =
            db.users.find(
                user =>
                    user.id === friendId
            );

        if (!target) {
            return res.status(404).json({
                error:
                    "A felhasználó nem található."
            });
        }

        const newMessage = {
            id: nextId("message"),
            sender: currentUser.id,
            receiver: friendId,
            message:
                String(message).trim(),
            date:
                new Date().toISOString(),
            type: type || "text",
            materialId:
                materialId
                    ? Number(materialId)
                    : null
        };

        db.messages.push(newMessage);

        saveDB();

        res.json({
            success: true,
            message: newMessage
        });
    }
);


// ============================================================
// TANANYAG LÉTREHOZÁSA
// ============================================================

app.post(
    "/api/materials",
    requireLogin,
    (req, res) => {
        const currentUser = getUser(req);

        const {
            subject,
            title,
            content,
            type,
            friendId
        } = req.body;

        if (
            !subject ||
            !title ||
            !content
        ) {
            return res.status(400).json({
                error:
                    "A tantárgy, cím és tartalom kötelező."
            });
        }

        const material = {
            id: nextId("material"),
            creator: currentUser.id,
            subject:
                String(subject).trim(),
            title:
                String(title).trim(),
            content:
                String(content),
            type:
                type || "material",
            date:
                new Date().toISOString()
        };

        db.materials.push(material);

        if (friendId) {
            const targetId =
                Number(friendId);

            if (
                areFriends(
                    currentUser.id,
                    targetId
                )
            ) {
                db.messages.push({
                    id: nextId("message"),
                    sender:
                        currentUser.id,
                    receiver:
                        targetId,
                    message:
                        `📚 Új tananyag: ${material.title}`,
                    date:
                        new Date().toISOString(),
                    type: "material",
                    materialId:
                        material.id
                });
            }
        }

        saveDB();

        res.json({
            success: true,
            material
        });
    }
);


// ============================================================
// SAJÁT TANANYAGOK
// ============================================================

app.get(
    "/api/materials",
    requireLogin,
    (req, res) => {
        const currentUser = getUser(req);

        const materials =
            db.materials.filter(
                material =>
                    material.creator ===
                    currentUser.id
            );

        res.json({
            materials
        });
    }
);


// ============================================================
// EGY TANANYAG LEKÉRÉSE
// ============================================================

app.get(
    "/api/materials/:id",
    requireLogin,
    (req, res) => {
        const currentUser = getUser(req);
        const materialId =
            Number(req.params.id);

        const material =
            db.materials.find(
                item =>
                    item.id === materialId
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
                    "Nincs hozzáférésed ehhez a tananyaghoz."
            });
        }

        res.json({
            material
        });
    }
);
// ============================================================
// AI TANANYAG GENERÁLÁS
// ============================================================

app.post(
    "/api/ai/generate",
    requireLogin,
    (req, res) => {
        const {
            subject,
            topic,
            type
        } = req.body;

        if (!subject || !topic) {
            return res.status(400).json({
                error:
                    "A tantárgy és a téma megadása kötelező."
            });
        }

        const subjectText =
            String(subject).trim();

        const topicText =
            String(topic).trim();

        let title = "";

        if (type === "test") {
            title =
                `${subjectText} – ${topicText} dolgozat`;
        } else if (type === "homework") {
            title =
                `${subjectText} – ${topicText} házi feladat`;
        } else {
            title =
                `${subjectText} – ${topicText}`;
        }

        const explanation =
            `A(z) ${topicText} a(z) ${subjectText} ` +
            `tantárgy egyik fontos témaköre. ` +
            `Tanuláskor érdemes megérteni az alapfogalmakat, ` +
            `az összefüggéseket és a gyakorlati példákat.`;

        const important = [
            `A ${topicText} alapfogalmai`,
            "A legfontosabb összefüggések",
            "A témához tartozó kulcsfogalmak",
            "Gyakorlati alkalmazás",
            "Érdemes példákon keresztül gyakorolni"
        ];

        const examples = [
            `1. példa: Gondold át, hogyan kapcsolódik ` +
            `a ${topicText} a korábban tanultakhoz.`,
            `2. példa: Foglald össze saját szavaiddal ` +
            `a ${topicText} lényegét.`,
            `3. példa: Készíts egy rövid gyakorlófeladatot ` +
            `a témához.`
        ];

        const summary =
            `Összefoglalva: a(z) ${topicText} ` +
            `megértéséhez először az alapfogalmakat ` +
            `érdemes megtanulni, majd példákon keresztül ` +
            `gyakorolni az alkalmazásukat.`;

        let content = "";

        if (type === "test") {
            content =
                `📝 DOLGOZAT\n\n` +
                `Tantárgy: ${subjectText}\n` +
                `Téma: ${topicText}\n\n` +
                `1. Írd le a téma legfontosabb fogalmait!\n\n` +
                `2. Magyarázd el a témához kapcsolódó ` +
                `legfontosabb összefüggéseket!\n\n` +
                `3. Oldj meg egy, a témához kapcsolódó ` +
                `gyakorlati feladatot!\n\n` +
                `4. Foglald össze röviden, mit tanultál!`;
        } else if (type === "homework") {
            content =
                `📚 HÁZI FELADAT\n\n` +
                `Tantárgy: ${subjectText}\n` +
                `Téma: ${topicText}\n\n` +
                `Feladat 1:\n` +
                `Fogalmazd meg saját szavaiddal a témát.\n\n` +
                `Feladat 2:\n` +
                `Írd ki a legfontosabb fogalmakat.\n\n` +
                `Feladat 3:\n` +
                `Oldj meg egy gyakorlati példát.\n\n` +
                `Feladat 4:\n` +
                `Készíts rövid összefoglalót.`;
        } else {
            content =
                `📖 TANANYAG\n\n` +
                `Cím: ${title}\n\n` +
                `MAGYARÁZAT\n` +
                `${explanation}\n\n` +
                `FONTOS FOGALMAK\n` +
                `${important
                    .map(item => `• ${item}`)
                    .join("\n")}\n\n` +
                `PÉLDÁK\n` +
                `${examples.join("\n\n")}\n\n` +
                `ÖSSZEFOGLALÓ\n` +
                `${summary}`;
        }

        res.json({
            success: true,
            type:
                type || "material",
            subject: subjectText,
            topic: topicText,
            title,
            explanation,
            important,
            examples,
            summary,
            content
        });
    }
);


// ============================================================
// ÉRTÉKELÉS ADÁSA
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
                    "Hiányzó felhasználó."
            });
        }

        if (
            !Number.isInteger(stars) ||
            stars < 1 ||
            stars > 5
        ) {
            return res.status(400).json({
                error:
                    "Az értékelés 1 és 5 csillag között lehet."
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

        const ratedUser =
            db.users.find(
                user =>
                    user.id ===
                    ratedUserId
            );

        if (!ratedUser) {
            return res.status(404).json({
                error:
                    "A felhasználó nem található."
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
            existing.stars = stars;
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
            Number(req.body.receiverId);

        const subject =
            String(
                req.body.subject || ""
            ).trim();

        const grade =
            Number(req.body.grade);

        if (!receiverId) {
            return res.status(400).json({
                error:
                    "Hiányzó felhasználó."
            });
        }

        if (!subject) {
            return res.status(400).json({
                error:
                    "A tantárgy megadása kötelező."
            });
        }

        if (
            !Number.isInteger(grade) ||
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
            userId !== currentUser.id
        ) {
            return res.status(403).json({
                error:
                    "Nincs hozzáférésed ezekhez a jegyekhez."
            });
        }

        const grades =
            db.grades
                .filter(
                    grade =>
                        grade.receiver ===
                        currentUser.id
                )
                .map(grade => {
                    const giver =
                        db.users.find(
                            user =>
                                user.id ===
                                grade.giver
                        );

                    return {
                        ...grade,
                        giverName:
                            giver
                                ? giver.name
                                : "Ismeretlen"
                    };
                });

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

        const friends =
            db.friendships.filter(
                friendship =>
                    friendship.status ===
                        "accepted" &&
                    (
                        friendship.sender ===
                            currentUser.id ||
                        friendship.receiver ===
                            currentUser.id
                    )
            ).length;

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
            friends,
            sentMessages,
            materials,
            grades
        });
    }
);


// ============================================================
// STATIKUS FÁJLOK
// ============================================================

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


// ============================================================
// SPA FALLBACK
// ============================================================

app.get(/.*/, (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );
});


// ============================================================
// SZERVER INDÍTÁSA
// ============================================================

app.listen(
    PORT,
    () => {
        console.log("");
        console.log(
            "======================================"
        );
        console.log(
            "       TANULÓBARÁT SZERVER"
        );
        console.log(
            "======================================"
        );
        console.log(
            `Szerver: http://localhost:${PORT}`
        );
        console.log(
            "======================================"
        );
        console.log("");
    }
);