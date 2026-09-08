"use strict";

// =====================================================
// TANULÓBARÁT
// A RÉGI INDEX.HTML-HEZ IGAZÍTVA
// =====================================================

const API = "/api";

let currentUser = null;
let currentPage = "home";
let friends = [];
let materials = [];
let grades = [];
let assignments = [];
let currentChatFriend = null;

// =====================================================
// SEGÉD
// =====================================================

const $ = (selector) => document.querySelector(selector);

function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function showMessage(message, success = false) {

    const box = $("#authMessage");

    if (!box) return;

    box.textContent = message;
    box.className =
        "auth-message " +
        (success ? "success" : "error");
}

function toast(message) {

    let element = document.querySelector(".tb-toast");

    if (!element) {

        element = document.createElement("div");

        element.className = "tb-toast";

        document.body.appendChild(element);
    }

    element.textContent = message;
    element.classList.add("show");

    setTimeout(() => {
        element.classList.remove("show");
    }, 2500);
}

async function apiFetch(url, options = {}) {

    const response = await fetch(API + url, {
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        },
        ...options
    });

    let data;

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok || data.success === false) {

        throw new Error(
            data.error ||
            "Hiba történt."
        );
    }

    return data;
}

// =====================================================
// TANTÁRGYAK
// =====================================================

const SUBJECTS = {
    5: [
        "Magyar nyelv",
        "Irodalom",
        "Matematika",
        "Történelem",
        "Biológia",
        "Földrajz",
        "Angol nyelv",
        "Német nyelv",
        "Digitális kultúra",
        "Technika és tervezés",
        "Testnevelés"
    ],

    6: [
        "Magyar nyelv",
        "Irodalom",
        "Matematika",
        "Történelem",
        "Biológia",
        "Földrajz",
        "Angol nyelv",
        "Német nyelv",
        "Digitális kultúra",
        "Technika és tervezés",
        "Testnevelés"
    ],

    7: [
        "Magyar nyelv",
        "Irodalom",
        "Matematika",
        "Történelem",
        "Biológia",
        "Kémia",
        "Fizika",
        "Földrajz",
        "Angol nyelv",
        "Német nyelv",
        "Digitális kultúra",
        "Testnevelés"
    ],

    8: [
        "Magyar nyelv",
        "Irodalom",
        "Matematika",
        "Történelem",
        "Biológia",
        "Kémia",
        "Fizika",
        "Földrajz",
        "Angol nyelv",
        "Német nyelv",
        "Digitális kultúra",
        "Testnevelés"
    ],

    9: [
        "Magyar nyelv",
        "Irodalom",
        "Matematika",
        "Történelem",
        "Biológia",
        "Kémia",
        "Fizika",
        "Földrajz",
        "Angol nyelv",
        "Német nyelv",
        "Digitális kultúra",
        "Testnevelés"
    ],

    10: [
        "Magyar nyelv",
        "Irodalom",
        "Matematika",
        "Történelem",
        "Biológia",
        "Kémia",
        "Fizika",
        "Földrajz",
        "Angol nyelv",
        "Német nyelv",
        "Digitális kultúra",
        "Testnevelés"
    ],

    11: [
        "Magyar nyelv",
        "Irodalom",
        "Matematika",
        "Történelem",
        "Biológia",
        "Kémia",
        "Fizika",
        "Földrajz",
        "Angol nyelv",
        "Német nyelv",
        "Digitális kultúra",
        "Testnevelés"
    ],

    12: [
        "Magyar nyelv",
        "Irodalom",
        "Matematika",
        "Történelem",
        "Biológia",
        "Kémia",
        "Fizika",
        "Földrajz",
        "Angol nyelv",
        "Német nyelv",
        "Digitális kultúra",
        "Testnevelés"
    ]
};

function getSubjects() {
    return SUBJECTS[Number(currentUser?.grade)] ||
        SUBJECTS[5];
}

// =====================================================
// AUTH
// =====================================================

function showLogin() {

    const loginForm = $("#loginForm");
    const registerForm = $("#registerForm");
    const loginTab = $("#loginTab");
    const registerTab = $("#registerTab");

    if (loginForm) {
        loginForm.style.display = "";
    }

    if (registerForm) {
        registerForm.style.display = "none";
    }

    if (loginTab) {
        loginTab.classList.add("active");
    }

    if (registerTab) {
        registerTab.classList.remove("active");
    }

    showMessage("");
}

function showRegister() {

    $("#loginForm").style.display = "none";
    $("#registerForm").style.display = "";

    $("#loginTab").classList.remove("active");
    $("#registerTab").classList.add("active");

    showMessage("");
}

async function login(event) {

    event.preventDefault();

    const email =
        $("#loginEmail").value.trim();

    const password =
        $("#loginPassword").value;

    try {

        showMessage("Bejelentkezés...");

        const result = await apiFetch(
            "/login",
            {
                method: "POST",
                body: JSON.stringify({
                    email,
                    password
                })
            }
        );

        currentUser = result.user;

        localStorage.setItem(
            "tb_current_user",
            JSON.stringify(currentUser)
        );

        await openApp();

    } catch (err) {

        showMessage(
            err.message,
            false
        );
    }
}

async function register(event) {

    event.preventDefault();

    const name =
        $("#registerName").value.trim();

    const username =
        $("#registerUsername").value.trim();

    const email =
        $("#registerEmail").value.trim();

    const password =
        $("#registerPassword").value;

    const grade =
        Number($("#registerGrade").value);

    try {

        showMessage("Fiók létrehozása...");

        const result = await apiFetch(
            "/register",
            {
                method: "POST",
                body: JSON.stringify({
                    name,
                    username,
                    email,
                    password,
                    grade
                })
            }
        );

        if (result.emailVerificationRequired) {
            showMessage(
                result.message || "Regisztráció sikeres. Ellenőrizd az e-mail címedet a fiók aktiválásához.",
                true
            );
            toast("📧 Megerősítő e-mail elküldve.");
            return;
        }

        currentUser = result.user;

        localStorage.setItem(
            "tb_current_user",
            JSON.stringify(currentUser)
        );

        await openApp();

        toast("Sikeres regisztráció! 🎉");

    } catch (err) {

        showMessage(
            err.message,
            false
        );
    }
}

function logout() {

    currentUser = null;

    localStorage.removeItem(
        "tb_current_user"
    );

    $("#app").style.display = "none";
    $("#auth").style.display = "";

    showLogin();

    $("#loginForm").reset();
    $("#registerForm").reset();
}

// =====================================================
// APP INDÍTÁSA
// =====================================================

async function openApp() {

    $("#auth").style.display = "none";
    $("#app").style.display = "";

    updateHeader();

    await loadData();

    renderPage(currentPage);
}

function updateHeader() {

    const avatar =
        $("#headerAvatar");

    if (!avatar || !currentUser)
        return;

    if (currentUser.avatar) {

        avatar.innerHTML = `
            <img
                src="${currentUser.avatar}"
                alt="Profilkép"
            >
        `;

    } else {

        avatar.innerHTML = `
            <div class="avatar-letter">
                ${escapeHTML(
                    currentUser.name
                        .charAt(0)
                        .toUpperCase()
                )}
            </div>
        `;
    }
}

// =====================================================
// ADATOK
// =====================================================

async function loadData() {

    if (!currentUser) return;

    try {

        const friendResult =
            await apiFetch(
                `/friends/${currentUser.id}`
            );

        friends =
            friendResult.friends || [];

    } catch {

        friends = [];
    }

    try {

        const materialResult =
            await apiFetch(
                `/materials/${currentUser.id}`
            );

        materials =
            materialResult.materials || [];

    } catch {

        materials = [];
    }

    try {

        const gradeResult =
            await apiFetch(
                `/grades/${currentUser.id}`
            );

        grades =
            gradeResult.grades || [];

    } catch {

        grades = [];
    }

    try {

        const assignmentResult =
            await apiFetch(
                `/assignments/${currentUser.id}`
            );

        assignments =
            assignmentResult.assignments || [];

    } catch {

        assignments = [];
    }
}

// =====================================================
// OLDALVÁLTÁS
// =====================================================

function renderPage(page) {

    currentPage = page;

    document
        .querySelectorAll("nav button[data-page]")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.page === page
            );
        });

    switch (page) {

        case "learning":
            renderLearning();
            break;

        case "grades":
            renderGrades();
            break;

        case "friends":
            renderFriends();
            break;

        case "profile":
            renderProfile();
            break;

        default:
            renderHome();
            break;
    }
}

// =====================================================
// FŐOLDAL
// =====================================================

function renderHome() {

    const content = $("#content");

    const firstName =
        currentUser.name.split(" ")[0];

    content.innerHTML = `

        <div class="page home-page">

            <div class="hero">

                <div>
                    <span class="eyebrow">
                        TANULÓBARÁT
                    </span>

                    <h1>
                        Szia, ${escapeHTML(firstName)}! 👋
                    </h1>

                    <p>
                        Tanulj okosabban,
                        tartsd a kapcsolatot
                        a barátaiddal.
                    </p>
                </div>

            </div>


            <div class="stats-grid">

                <div class="stat-card">
                    <strong>
                        ${friends.length}
                    </strong>
                    <span>Barát</span>
                </div>

                <div class="stat-card">
                    <strong>
                        ${grades.length}
                    </strong>
                    <span>Jegy</span>
                </div>

                <div class="stat-card">
                    <strong>
                        ${materials.length}
                    </strong>
                    <span>Tananyag</span>
                </div>

            </div>


            <h2>
                Gyors műveletek
            </h2>

            <div class="quick-grid">

                <button
                    class="quick-card"
                    onclick="openAI()"
                >
                    <span>✨</span>
                    <strong>AI Tananyag</strong>
                    <small>
                        Készíts tananyagot
                    </small>
                </button>


                <button
                    class="quick-card"
                    onclick="renderPage('learning')"
                >
                    <span>📚</span>
                    <strong>Tanulás</strong>
                    <small>
                        Tantárgyak és anyagok
                    </small>
                </button>


                <button
                    class="quick-card"
                    onclick="renderPage('friends')"
                >
                    <span>👥</span>
                    <strong>Barátok</strong>
                    <small>
                        Barátok és chat
                    </small>
                </button>


                <button
                    class="quick-card"
                    onclick="renderPage('grades')"
                >
                    <span>📝</span>
                    <strong>Jegyek</strong>
                    <small>
                        Jegyek megtekintése
                    </small>
                </button>

            </div>


            <h2>
                Saját tananyagaid
            </h2>

            ${
                materials.length
                    ? materials.slice(0, 5)
                        .map(materialCard)
                        .join("")
                    : `
                        <div class="empty-card">
                            <div>📚</div>
                            <strong>
                                Még nincs tananyagod
                            </strong>
                            <p>
                                Készíts egyet az
                                AI Tananyag menüponttal.
                            </p>
                        </div>
                    `
            }

        </div>
    `;
}

// =====================================================
// TANULÁS
// =====================================================

function renderLearning() {

    const content = $("#content");

    content.innerHTML = `

        <div class="page">

            <div class="page-heading">

                <div>
                    <span class="eyebrow">
                        TANULÁS
                    </span>

                    <h1>
                        Tantárgyak 📚
                    </h1>

                    <p>
                        Válassz egy tantárgyat.
                    </p>
                </div>

                <button
                    class="primary"
                    onclick="openAI()"
                >
                    ✨ AI Tananyag
                </button>

            </div>


            <div class="subject-grid">

                ${getSubjects().map(subject => `

                    <button
                        class="subject-card"
                        onclick="openSubject(
                            '${escapeHTML(subject)}'
                        )"
                    >

                        <span class="subject-icon">
                            📖
                        </span>

                        <strong>
                            ${escapeHTML(subject)}
                        </strong>

                    </button>

                `).join("")}

            </div>

        </div>
    `;
}

function openSubject(subject) {

    const content = $("#content");

    const list =
        materials.filter(
            material =>
                material.subject === subject
        );

    content.innerHTML = `

        <div class="page">

            <button
                class="back-button"
                onclick="renderLearning()"
            >
                ← Vissza
            </button>

            <div class="page-heading">

                <div>
                    <span class="eyebrow">
                        TANTÁRGY
                    </span>

                    <h1>
                        ${escapeHTML(subject)}
                    </h1>
                </div>

            </div>


            ${
                list.length
                    ? list.map(materialCard).join("")
                    : `
                        <div class="empty-card">
                            <div>📖</div>
                            <strong>
                                Még nincs tananyag
                            </strong>
                            <p>
                                Ehhez a tantárgyhoz
                                még nincs mentett anyag.
                            </p>
                        </div>
                    `
            }

        </div>
    `;
}

// =====================================================
// AI TANANYAG
// =====================================================

function openAI() {

    const content = $("#content");

    content.innerHTML = `

        <div class="page">

            <button
                class="back-button"
                onclick="renderPage('home')"
            >
                ← Vissza
            </button>

            <div class="ai-hero">

                <div class="ai-icon">
                    ✨
                </div>

                <div>
                    <span class="eyebrow">
                        AI TANANYAG
                    </span>

                    <h1>
                        Készíts tananyagot
                    </h1>

                    <p>
                        Írd le, mit tanultál órán,
                        az alkalmazás pedig
                        tanulható anyagot készít belőle.
                    </p>
                </div>

            </div>


            <div class="form-card">

                <label>
                    Tantárgy
                </label>

                <select id="aiSubject">

                    ${getSubjects()
                        .map(subject => `
                            <option value="${escapeHTML(subject)}">
                                ${escapeHTML(subject)}
                            </option>
                        `)
                        .join("")}

                </select>


                <label>
                    Mit tanultatok órán?
                </label>

                <textarea
                    id="aiInput"
                    rows="9"
                    placeholder="Például: A mondatrészekről tanultunk. Megismertük az alanyt, az állítmányt és a tárgyat..."
                ></textarea>


                <button
                    class="primary big-button"
                    onclick="createAIMaterial()"
                >
                    ✨ Tananyag készítése
                </button>

            </div>

        </div>
    `;
}

async function createAIMaterial() {

    const subject =
        $("#aiSubject").value;

    const input =
        $("#aiInput").value.trim();

    if (!input) {

        toast(
            "Írd le először, mit tanultatok!"
        );

        return;
    }

    // =================================================
    // PROTOTÍPUS AI
    // =================================================

    const title =
        `${subject} – órai tananyag`;

    const content = `
${input}

Tanulási vázlat

1. A legfontosabb fogalmak
- Nézd át az órán tanult fogalmakat.
- Tanuld meg a kulcsszavakat.
- Próbáld saját szavaiddal elmondani a lényeget.

2. Összefoglalás
Az órán tanult témát érdemes kisebb részekre bontani,
majd minden részt külön megtanulni.

3. Ellenőrző kérdések
- Mi volt az óra legfontosabb témája?
- Melyek a legfontosabb fogalmak?
- El tudod magyarázni saját szavaiddal?

4. Tanulási tipp
Olvasd át az anyagot, majd próbáld meg
jegyzet nélkül elmondani.
`;

    const summary =
        input.length > 180
            ? input.substring(0, 180) + "..."
            : input;

    openMaterialOptionsSheet({
        subject,
        title,
        content,
        summary
    });
}

// =====================================================
// TANANYAG KÁRTYA
// =====================================================

function materialCard(material) {

    return `

        <div
            class="material-card"
            onclick="openMaterial(
                ${Number(material.id)}
            )"
        >

            <div class="material-icon">
                📘
            </div>

            <div class="material-main">

                <strong>
                    ${escapeHTML(material.title)}
                </strong>

                <span>
                    ${escapeHTML(material.subject)}
                </span>

                <p>
                    ${escapeHTML(material.summary || "")}
                </p>

            </div>

        </div>
    `;
}

function openMaterial(id) {

    const material =
        materials.find(
            item => Number(item.id) === Number(id)
        );

    if (!material) {

        toast("A tananyag nem található.");

        return;
    }

    const content = $("#content");

    content.innerHTML = `

        <div class="page">

            <button
                class="back-button"
                onclick="renderPage('learning')"
            >
                ← Vissza
            </button>

            <div class="material-view">

                <span class="eyebrow">
                    ${escapeHTML(material.subject)}
                </span>

                <h1>
                    ${escapeHTML(material.title)}
                </h1>

                <div class="material-text">
                    ${escapeHTML(material.content)
                        .replaceAll("\n", "<br>")}
                </div>

            </div>

        </div>
    `;
}

// =====================================================
// TANANYAG OPCIÓK
// =====================================================

function openMaterialOptionsSheet(data) {

    closeSheet();

    const sheet =
        document.createElement("div");

    sheet.className = "sheet-overlay";

    sheet.innerHTML = `

        <div class="bottom-sheet">

            <div class="sheet-handle"></div>

            <h2>
                Tananyag beállításai
            </h2>

            <p>
                ${escapeHTML(data.subject)}
            </p>


            <label>
                Cím
            </label>

            <input
                id="materialTitle"
                value="${escapeHTML(data.title)}"
            />


            <label>
                Küldés
            </label>

            <select id="materialReceiver">

                <option value="">
                    Csak nekem
                </option>

                ${friends.map(friend => `
                    <option value="${friend.id}">
                        ${escapeHTML(friend.name)}
                    </option>
                `).join("")}

            </select>


            <label>
                A végén legyen
            </label>

            <select id="materialEndType">

                <option value="none">
                    Semmi
                </option>

                <option value="test">
                    📝 Teszt
                </option>

                <option value="homework">
                    📚 Házi feladat
                </option>

            </select>


            <button
                class="primary big-button"
                id="saveMaterialButton"
            >
                Mentés és elkészítés
            </button>


            <button
                class="secondary big-button"
                onclick="closeSheet()"
            >
                Mégsem
            </button>

        </div>
    `;

    document.body.appendChild(sheet);

    $("#saveMaterialButton")
        .onclick = () =>
            finishAIMaterial(data);
}

async function finishAIMaterial(data) {

    const title =
        $("#materialTitle").value.trim();

    const receiverValue =
        $("#materialReceiver").value;

    const endType =
        $("#materialEndType").value;

    if (!title) {

        toast("Adj címet a tananyagnak.");

        return;
    }

    const receiverId =
        receiverValue
            ? Number(receiverValue)
            : null;

    try {

        const result =
            await apiFetch(
                "/materials",
                {
                    method: "POST",
                    body: JSON.stringify({
                        ownerId: currentUser.id,
                        receiverId,
                        subject: data.subject,
                        title,
                        content: data.content,
                        summary: data.summary,
                        endType
                    })
                }
            );

        const materialId =
            result.materialId;

        // Teszt vagy házi
        if (
            endType === "test" ||
            endType === "homework"
        ) {

            const assignment =
                await apiFetch(
                    "/assignments",
                    {
                        method: "POST",
                        body: JSON.stringify({
                            materialId,
                            creatorId: currentUser.id,
                            receiverId,
                            type: endType,
                            title:
                                endType === "test"
                                    ? `Teszt – ${title}`
                                    : `Házi – ${title}`,
                            text:
                                `A tananyag alapján oldd meg a feladatot: ${title}`
                        })
                    }
                );

            if (receiverId) {

                await sendMessage(
                    receiverId,
                    `📚 ${title}`,
                    "material",
                    materialId,
                    assignment.assignmentId
                );
            }

        } else if (receiverId) {

            await sendMessage(
                receiverId,
                `📚 ${title}`,
                "material",
                materialId
            );
        }

        closeSheet();

        await loadData();

        renderPage("learning");

        toast(
            receiverId
                ? "A tananyag elkészült és elküldtük! 📚"
                : "A tananyag elkészült! 📚"
        );

    } catch (err) {

        toast(err.message);
    }
}

// =====================================================
// JEGYEK
// =====================================================

function renderGrades() {

    const content = $("#content");

    content.innerHTML = `

        <div class="page">

            <div class="page-heading">

                <div>
                    <span class="eyebrow">
                        JEGYEK
                    </span>

                    <h1>
                        Jegyeim 📝
                    </h1>

                    <p>
                        A barátaid által adott jegyek.
                    </p>
                </div>

            </div>


            ${
                grades.length
                    ? grades.map(grade => `

                        <div class="grade-card">

                            <div>
                                <strong>
                                    ${escapeHTML(
                                        grade.subject
                                    )}
                                </strong>

                                <span>
                                    ${
                                        escapeHTML(
                                            grade.giver_name ||
                                            "Felhasználó"
                                        )
                                    }
                                </span>
                            </div>

                            <strong class="grade-number">
                                ${Number(grade.grade)}
                            </strong>

                        </div>

                    `).join("")
                    : `
                        <div class="empty-card">
                            <div>📝</div>

                            <strong>
                                Még nincs jegyed
                            </strong>

                            <p>
                                A barátaid adhatnak neked
                                tantárgyi jegyet.
                            </p>
                        </div>
                    `
            }


            <button
                class="primary big-button"
                onclick="openGiveGrade()"
            >
                ⭐ Jegy adása barátnak
            </button>

        </div>
    `;
}

function openGiveGrade() {

    if (!friends.length) {

        toast(
            "Előbb legyen legalább egy elfogadott barátod."
        );

        return;
    }

    const sheet =
        document.createElement("div");

    sheet.className = "sheet-overlay";

    sheet.innerHTML = `

        <div class="bottom-sheet">

            <div class="sheet-handle"></div>

            <h2>
                ⭐ Jegy adása
            </h2>

            <label>
                Barát
            </label>

            <select id="gradeFriend">

                ${friends.map(friend => `
                    <option value="${friend.id}">
                        ${escapeHTML(friend.name)}
                    </option>
                `).join("")}

            </select>


            <label>
                Tantárgy
            </label>

            <select id="gradeSubject">

                ${getSubjects().map(subject => `
                    <option value="${escapeHTML(subject)}">
                        ${escapeHTML(subject)}
                    </option>
                `).join("")}

            </select>


            <label>
                Jegy
            </label>

            <select id="gradeValue">

                <option value="5">5 – jeles</option>
                <option value="4">4 – jó</option>
                <option value="3">3 – közepes</option>
                <option value="2">2 – elégséges</option>
                <option value="1">1 – elégtelen</option>

            </select>


            <button
                class="primary big-button"
                onclick="giveGrade()"
            >
                Jegy elküldése
            </button>

        </div>
    `;

    document.body.appendChild(sheet);
}

async function giveGrade() {

    const receiverId =
        Number($("#gradeFriend").value);

    const subject =
        $("#gradeSubject").value;

    const grade =
        Number($("#gradeValue").value);

    try {

        await apiFetch(
            "/grades",
            {
                method: "POST",
                body: JSON.stringify({
                    giverId: currentUser.id,
                    receiverId,
                    subject,
                    grade
                })
            }
        );

        closeSheet();

        toast("A jegyet elküldtük! ⭐");

    } catch (err) {

        toast(err.message);
    }
}

// =====================================================
// BARÁTOK
// =====================================================

function renderFriends() {

    const content = $("#content");

    content.innerHTML = `

        <div class="page">

            <div class="page-heading">

                <div>
                    <span class="eyebrow">
                        KÖZÖSSÉG
                    </span>

                    <h1>
                        Barátok 👥
                    </h1>

                    <p>
                        Beszélgess és tanulj együtt.
                    </p>
                </div>

            </div>


            <div class="friend-search">

                <input
                    id="friendSearch"
                    placeholder="Keresés név alapján..."
                >

                <button
                    class="primary"
                    onclick="searchUsers()"
                >
                    Keresés
                </button>

            </div>


            <div id="friendResults"></div>


            <h2>
                Barátaid
            </h2>


            ${
                friends.length
                    ? friends.map(friend => `

                        <div class="friend-card">

                            <div class="friend-avatar">
                                ${
                                    friend.avatar
                                        ? `<img src="${friend.avatar}">`
                                        : escapeHTML(
                                            friend.name
                                                .charAt(0)
                                                .toUpperCase()
                                        )
                                }
                            </div>

                            <div class="friend-info">

                                <strong>
                                    ${escapeHTML(friend.name)}
                                </strong>

                                <span>
                                    ${friend.grade}. osztály
                                </span>

                            </div>


                            <button
                                class="secondary"
                                onclick="openChat(
                                    ${friend.id}
                                )"
                            >
                                💬
                            </button>


                            <button
                                class="secondary"
                                onclick="rateFriend(
                                    ${friend.id},
                                    '${escapeHTML(friend.name)}'
                                )"
                            >
                                ⭐
                            </button>

                        </div>

                    `).join("")
                    : `
                        <div class="empty-card">

                            <div>👥</div>

                            <strong>
                                Még nincsenek barátaid
                            </strong>

                            <p>
                                Keress rá valakire
                                és küldj barátkérést.
                            </p>

                        </div>
                    `
            }

        </div>
    `;
}

async function searchUsers() {

    const search =
        $("#friendSearch")
            .value
            .trim();

    if (!search) {

        toast("Írj be egy nevet.");

        return;
    }

    try {

        const result =
            await apiFetch(
                `/users?search=${encodeURIComponent(search)}`
            );

        const users =
            result.users || [];

        $("#friendResults").innerHTML = `

            <div class="search-results">

                ${
                    users.length
                        ? users.map(user => {

                            if (
                                Number(user.id) ===
                                Number(currentUser.id)
                            ) {
                                return "";
                            }

                            const alreadyFriend =
                                friends.some(
                                    f =>
                                        Number(f.id) ===
                                        Number(user.id)
                                );

                            return `

                                <div class="user-result">

                                    <div>
                                        <strong>
                                            ${escapeHTML(user.name)}
                                        </strong>

                                        <span>
                                            ${user.grade}. osztály
                                        </span>
                                    </div>

                                    ${
                                        alreadyFriend
                                            ? `<span>✓ Barát</span>`
                                            : `
                                                <button
                                                    class="primary"
                                                    onclick="sendFriendRequest(
                                                        ${user.id}
                                                    )"
                                                >
                                                    + Barát
                                                </button>
                                            `
                                    }

                                </div>
                            `;

                        }).join("")
                        : `
                            <div class="empty-card">
                                Nincs találat.
                            </div>
                        `
                }

            </div>
        `;

    } catch (err) {

        toast(err.message);
    }
}

async function sendFriendRequest(friendId) {

    try {

        await apiFetch(
            "/friends/request",
            {
                method: "POST",
                body: JSON.stringify({
                    userId: currentUser.id,
                    friendId
                })
            }
        );

        toast("Barátkérés elküldve! 👥");

    } catch (err) {

        toast(err.message);
    }
}

// =====================================================
// CHAT
// =====================================================

async function openChat(friendId) {

    currentChatFriend =
        friends.find(
            friend =>
                Number(friend.id) ===
                Number(friendId)
        );

    if (!currentChatFriend)
        return;

    const content = $("#content");

    content.innerHTML = `

        <div class="chat-page">

            <div class="chat-header">

                <button
                    class="back-button"
                    onclick="renderPage('friends')"
                >
                    ←
                </button>

                <div>
                    <strong>
                        ${escapeHTML(
                            currentChatFriend.name
                        )}
                    </strong>

                    <span>
                        ${currentChatFriend.grade}. osztály
                    </span>
                </div>

            </div>


            <div
                id="chatMessages"
                class="chat-messages"
            >
                Betöltés...
            </div>


            <div class="chat-input-row">

                <button
                    class="wizard-button"
                    onclick="openWizard()"
                >
                    🧙
                </button>

                <input
                    id="chatInput"
                    placeholder="Írj üzenetet..."
                    onkeydown="
                        if(event.key === 'Enter')
                            sendChatMessage()
                    "
                >

                <button
                    class="primary"
                    onclick="sendChatMessage()"
                >
                    ➤
                </button>

            </div>

        </div>
    `;

    await loadChat();
}

async function loadChat() {

    if (!currentChatFriend)
        return;

    try {

        const result =
            await apiFetch(
                `/messages/${currentUser.id}/${currentChatFriend.id}`
            );

        const messages =
            result.messages || [];

        const box =
            $("#chatMessages");

        box.innerHTML =
            messages.length
                ? messages.map(message => {

                    const mine =
                        Number(message.sender_id) ===
                        Number(currentUser.id);

                    return `

                        <div
                            class="
                                chat-message
                                ${mine ? "mine" : "theirs"}
                            "
                        >

                            ${
                                message.message_type ===
                                "material"

                                    ? `
                                        <div class="chat-material">
                                            📚
                                            ${escapeHTML(
                                                message.text
                                            )}
                                        </div>
                                    `

                                    : `
                                        ${escapeHTML(
                                            message.text
                                        )}
                                    `
                            }

                        </div>
                    `;

                }).join("")
                : `
                    <div class="chat-empty">
                        Még nincs üzenet.
                    </div>
                `;

        box.scrollTop =
            box.scrollHeight;

    } catch (err) {

        $("#chatMessages").innerHTML = `
            <div class="chat-empty">
                Nem sikerült betölteni az üzeneteket.
            </div>
        `;
    }
}

async function sendChatMessage() {

    const input =
        $("#chatInput");

    const text =
        input.value.trim();

    if (!text || !currentChatFriend)
        return;

    try {

        await sendMessage(
            currentChatFriend.id,
            text,
            "text"
        );

        input.value = "";

        await loadChat();

    } catch (err) {

        toast(err.message);
    }
}

async function sendMessage(
    receiverId,
    text,
    messageType = "text",
    materialId = null,
    assignmentId = null
) {

    return apiFetch(
        "/messages",
        {
            method: "POST",
            body: JSON.stringify({
                senderId: currentUser.id,
                receiverId,
                text,
                messageType,
                materialId,
                assignmentId
            })
        }
    );
}

// =====================================================
// WIZARD 🧙
// =====================================================

function openWizard() {

    if (!currentChatFriend)
        return;

    const sheet =
        document.createElement("div");

    sheet.className =
        "sheet-overlay";

    sheet.innerHTML = `

        <div class="bottom-sheet wizard-sheet">

            <div class="sheet-handle"></div>

            <div class="wizard-title">
                🧙
            </div>

            <h2>
                Tananyag varázsló
            </h2>

            <p>
                Szia! Küldd el, hogy
                milyen tananyagot készítsek
                ${escapeHTML(
                    currentChatFriend.name
                )}nak/nek.
            </p>

            <input
                id="wizardSubject"
                placeholder="Pl. nyelvtan"
            >

            <button
                class="primary big-button"
                onclick="wizardCreate()"
            >
                ✨ Tananyag készítése
            </button>

            <button
                class="secondary big-button"
                onclick="closeSheet()"
            >
                Mégsem
            </button>

        </div>
    `;

    document.body.appendChild(sheet);
}

async function wizardCreate() {

    const subject =
        $("#wizardSubject")
            .value
            .trim();

    if (!subject) {

        toast(
            "Írd be, milyen tananyagot szeretnél."
        );

        return;
    }

    const title =
        `${subject} – tananyag`;

    const content = `
Tananyag: ${subject}

Fontos fogalmak:
- Ismerd meg a témához tartozó alapfogalmakat.
- Tanuld meg a legfontosabb szabályokat.
- Próbáld példákon keresztül megérteni.

Összefoglalás:
A témát érdemes kisebb részekre bontva megtanulni.

Ellenőrző kérdések:
1. Mi a téma lényege?
2. Melyek a legfontosabb szabályok?
3. Tudsz rá saját példát mondani?
`;

    try {

        const result =
            await apiFetch(
                "/materials",
                {
                    method: "POST",
                    body: JSON.stringify({
                        ownerId: currentUser.id,
                        receiverId: currentChatFriend.id,
                        subject,
                        title,
                        content,
                        summary:
                            `Tananyag: ${subject}`,
                        endType: "none"
                    })
                }
            );

        await sendMessage(
            currentChatFriend.id,
            `📚 ${title}`,
            "material",
            result.materialId
        );

        closeSheet();

        await loadData();
        await loadChat();

        toast(
            "A tananyag elkészült és elküldtük! 🧙📚"
        );

    } catch (err) {

        toast(err.message);
    }
}

// =====================================================
// BARÁT ÉRTÉKELÉSE
// =====================================================

function rateFriend(friendId, friendName) {

    const sheet =
        document.createElement("div");

    sheet.className =
        "sheet-overlay";

    sheet.innerHTML = `

        <div class="bottom-sheet">

            <div class="sheet-handle"></div>

            <h2>
                ⭐ ${escapeHTML(friendName)}
            </h2>

            <p>
                Hány csillagra értékeled?
            </p>

            <div class="rating-buttons">

                ${[1,2,3,4,5].map(number => `

                    <button
                        onclick="
                            submitRating(
                                ${friendId},
                                ${number}
                            )
                        "
                    >
                        ${"⭐".repeat(number)}
                    </button>

                `).join("")}

            </div>

        </div>
    `;

    document.body.appendChild(sheet);
}

async function submitRating(
    receiverId,
    rating
) {

    try {

        await apiFetch(
            "/ratings",
            {
                method: "POST",
                body: JSON.stringify({
                    giverId: currentUser.id,
                    receiverId,
                    rating
                })
            }
        );

        closeSheet();

        toast("Értékelés elküldve! ⭐");

    } catch (err) {

        toast(err.message);
    }
}

// =====================================================
// PROFIL
// =====================================================

function renderProfile() {

    const content = $("#content");

    content.innerHTML = `

        <div class="page profile-page">

            <div class="profile-card">

                <div class="profile-header">

                    <div class="profile-avatar-wrap">

                        ${
                            currentUser.avatar
                                ? `
                                    <img
                                        class="profile-avatar"
                                        src="${currentUser.avatar}"
                                        alt="Profilkép"
                                    >
                                `
                                : `
                                    <div class="profile-avatar">
                                        ${escapeHTML(
                                            currentUser.name
                                                .charAt(0)
                                                .toUpperCase()
                                        )}
                                    </div>
                                `
                        }

                    </div>


                    <div class="profile-main-info">

                        <h1>
                            ${escapeHTML(currentUser.name)}
                        </h1>

                        <p>
                            ${
                                currentUser.username
                                    ? "@" + escapeHTML(currentUser.username)
                                    : "@felhasznalo"
                            }
                        </p>

                    </div>

                </div>


                <div class="profile-info-card">

                    <div>
                        <span>Név</span>
                        <strong>${escapeHTML(currentUser.name)}</strong>
                    </div>

                    <div>
                        <span>Felhasználónév</span>
                        <strong>
                            ${currentUser.username ? "@" + escapeHTML(currentUser.username) : "Nincs megadva"}
                        </strong>
                    </div>

                    <div>
                        <span>E-mail</span>
                        <strong>${escapeHTML(currentUser.email)}</strong>
                    </div>

                    <div>
                        <span>Évfolyam</span>
                        <strong>${currentUser.grade}. osztály</strong>
                    </div>

                </div>


                <button
                    class="primary big-button"
                    type="button"
                    onclick="openProfileEditor()"
                >
                    ⚙️ Profil szerkesztése
                </button>


                <div class="profile-stats">

                    <div>
                        <strong>${friends.length}</strong>
                        <span>Barát</span>
                    </div>

                    <div>
                        <strong>${grades.length}</strong>
                        <span>Jegy</span>
                    </div>

                    <div>
                        <strong>${materials.length}</strong>
                        <span>Tananyag</span>
                    </div>

                </div>

            </div>

        </div>
    `;
}

function openProfileEditor() {

    const old = document.querySelector("#profileEditorSheet");
    if (old) old.remove();

    const sheet = document.createElement("div");
    sheet.id = "profileEditorSheet";
    sheet.className = "sheet-overlay";

    sheet.innerHTML = `
        <div class="bottom-sheet">

            <div class="sheet-handle"></div>

            <h2>⚙️ Profil szerkesztése</h2>

            <label>Felhasználónév</label>
            <input
                id="editUsername"
                type="text"
                value="${escapeHTML(currentUser.username || "") }"
                maxlength="30"
                placeholder="pl. peter123"
            >

            <label>Profilkép</label>
            <input
                id="editAvatar"
                type="file"
                accept="image/*"
            >

            <hr>

            <h3>🔒 Jelszó megváltoztatása</h3>

            <label>Jelenlegi jelszó</label>
            <input
                id="editCurrentPassword"
                type="password"
                autocomplete="current-password"
                placeholder="Jelenlegi jelszó"
            >

            <label>Új jelszó</label>
            <input
                id="editNewPassword"
                type="password"
                autocomplete="new-password"
                minlength="6"
                placeholder="Legalább 6 karakter"
            >

            <button
                class="primary big-button"
                type="button"
                onclick="saveProfileEditor()"
            >
                Mentés
            </button>

            <button
                type="button"
                class="big-button"
                onclick="closeSheet()"
            >
                Mégse
            </button>

        </div>
    `;

    document.body.appendChild(sheet);
}

async function saveProfileEditor() {

    const username = $("#editUsername")?.value.trim() || "";
    const avatarFile = $("#editAvatar")?.files?.[0] || null;
    const currentPassword = $("#editCurrentPassword")?.value || "";
    const newPassword = $("#editNewPassword")?.value || "";

    if (newPassword && !currentPassword) {
        toast("Add meg a jelenlegi jelszavadat is.");
        return;
    }

    if (newPassword && newPassword.length < 6) {
        toast("Az új jelszónak legalább 6 karakteresnek kell lennie.");
        return;
    }

    try {

        let avatar = currentUser.avatar || "";

        if (avatarFile) {
            if (!avatarFile.type.startsWith("image/")) {
                toast("Csak képfájl tölthető fel.");
                return;
            }

            if (avatarFile.size > 5 * 1024 * 1024) {
                toast("A kép maximum 5 MB lehet.");
                return;
            }

            avatar = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(avatarFile);
            });
        }

        await apiFetch(`/users/${currentUser.id}`, {
            method: "PUT",
            body: JSON.stringify({
                username,
                avatar
            })
        });

        if (newPassword) {
            await apiFetch(`/users/${currentUser.id}/password`, {
                method: "PUT",
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            });
        }

        currentUser.username = username;
        currentUser.avatar = avatar;

        localStorage.setItem(
            "tb_current_user",
            JSON.stringify(currentUser)
        );

        closeSheet();
        updateHeader();
        renderProfile();

        toast(newPassword
            ? "Profil és jelszó frissítve! ✅"
            : "Profil frissítve! ✅"
        );

    } catch (err) {
        toast(err.message);
    }
}

async function changeAvatar(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async () => {
        try {
            await apiFetch(`/users/${currentUser.id}`, {
                method: "PUT",
                body: JSON.stringify({
                    username: currentUser.username || "",
                    avatar: reader.result
                })
            });

            currentUser.avatar = reader.result;
            localStorage.setItem("tb_current_user", JSON.stringify(currentUser));
            updateHeader();
            renderProfile();
            toast("Profilkép frissítve! 📷");
        } catch (err) {
            toast(err.message);
        }
    };

    reader.readAsDataURL(file);
}

// =====================================================
// ALSÓ SHEET
// =====================================================

function closeSheet() {

    document
        .querySelectorAll(".sheet-overlay")
        .forEach(sheet => sheet.remove());
}

// =====================================================
// NAVIGÁCIÓ
// =====================================================

function setupNavigation() {

    document
        .querySelectorAll(
            "nav button[data-page]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    renderPage(
                        button.dataset.page
                    );
                }
            );
        });
}

// =====================================================
// INIT
// =====================================================

async function init() {

    setupNavigation();

    $("#loginTab")?.addEventListener(
        "click",
        showLogin
    );

    $("#registerTab")?.addEventListener(
        "click",
        showRegister
    );

    $("#loginForm")?.addEventListener(
        "submit",
        login
    );

    $("#registerForm")?.addEventListener(
        "submit",
        register
    );

    $("#logout")?.addEventListener(
        "click",
        logout
    );

    $("#headerAvatar")?.addEventListener(
        "click",
        () => renderPage("profile")
    );

    const saved =
        localStorage.getItem(
            "tb_current_user"
        );

    if (saved) {

        try {

            currentUser =
                JSON.parse(saved);

            await openApp();

        } catch (error) {

            console.error(
                "Mentett felhasználó betöltési hiba:",
                error
            );

            localStorage.removeItem(
                "tb_current_user"
            );

            currentUser = null;

            const app = $("#app");
            const auth = $("#auth");

            if (app) {
                app.style.display = "none";
            }

            if (auth) {
                auth.style.display = "";
            }

            showLogin();
        }

    } else {

        const app = $("#app");
        const auth = $("#auth");

        if (app) {
            app.style.display = "none";
        }

        if (auth) {
            auth.style.display = "";
        }

        showLogin();
    }
}


// =====================================================
// GLOBÁLIS FÜGGVÉNYEK
// =====================================================

window.renderPage =
    renderPage;

window.openAI =
    openAI;

window.openSubject =
    openSubject;

window.openMaterial =
    openMaterial;

window.openGiveGrade =
    openGiveGrade;

window.giveGrade =
    giveGrade;

window.searchUsers =
    searchUsers;

window.sendFriendRequest =
    sendFriendRequest;

window.openChat =
    openChat;

window.sendChatMessage =
    sendChatMessage;

window.openWizard =
    openWizard;

window.wizardCreate =
    wizardCreate;

window.rateFriend =
    rateFriend;

window.submitRating =
    submitRating;

window.changeAvatar =
    changeAvatar;

window.openProfileEditor =
    openProfileEditor;

window.saveProfileEditor =
    saveProfileEditor;

window.closeSheet =
    closeSheet;

window.createAIMaterial =
    createAIMaterial;

window.finishAIMaterial =
    finishAIMaterial;


// =====================================================
// INDÍTÁS
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    init
);

/* -----------------------------------------------------
   GLOBÁLIS REFERENCIÁK – FRISSÍTETT FÜGGVÉNYEK
----------------------------------------------------- */

window.login = login;
window.register = register;
window.logout = logout;
window.openApp = openApp;
window.renderProfile = renderProfile;
window.openProfileEditor = openProfileEditor;
window.changeAvatar = changeAvatar;
window.renderGrades = renderGrades;
window.openGiveGrade = openGiveGrade;
window.giveGrade = giveGrade;
window.searchUsers = searchUsers;
window.sendFriendRequest = sendFriendRequest;
window.openChat = openChat;
window.sendChatMessage = sendChatMessage;
window.renderPage = renderPage;