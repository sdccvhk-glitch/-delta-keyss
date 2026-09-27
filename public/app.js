let token = localStorage.getItem("wfn_token");
let me = null;

const $ = id => document.getElementById(id);

async function api(url, opt = {}) {

  opt.headers = {
    ...(opt.headers || {}),
    "Content-Type": "application/json"
  };

  if (token) {
    opt.headers.Authorization = "Bearer " + token;
  }

  const r = await fetch(url, opt);

  const d = await r.json().catch(() => ({}));

  if (!r.ok) {
    throw new Error(d.error || "Request failed");
  }

  return d;
}

function toast(msg) {

  $("toast").textContent = msg;
  $("toast").className = "show";

  setTimeout(() => {
    $("toast").className = "";
  }, 2500);
}


/* =========================
   SHOW PANEL
========================= */

function showPanel() {

  $("auth").classList.add("hidden");
  $("panel").classList.remove("hidden");
  $("logout").classList.remove("hidden");

  $("who").textContent =
    me.username + " • " + me.role.toUpperCase();

  const isAdmin =
    ["owner", "admin"].includes(me.role);

  const isOwner =
    me.role === "owner";

  $("usersNav").classList.toggle(
    "hidden",
    !isAdmin
  );

  $("settingsNav").classList.toggle(
    "hidden",
    !isOwner
  );

  $("createReferralCard").classList.toggle(
    "hidden",
    !isAdmin
  );

  loadAll();
}


/* =========================
   LOAD EVERYTHING
========================= */

async function loadAll() {

  try {

    const d = await api("/api/me");

    me = d.user;

    $("who").textContent =
      me.username + " • " + me.role.toUpperCase();

    $("stBalance").textContent =
      "₹" + Number(me.balance).toFixed(2);

    $("accountInfo").innerHTML = `
      <p><b>${me.username}</b></p>
      <p class="muted">Role: ${me.role}</p>
      <p class="muted">
        Referral: ${me.referral_code || "—"}
      </p>
      <p>
        Balance:
        <b>₹${Number(me.balance).toFixed(2)}</b>
      </p>
    `;

    loadLicenses();
    loadRefs();

    if (["owner", "admin"].includes(me.role)) {
      loadUsers();
      loadReferralCodes();
    }

    if (me.role === "owner") {
      loadSettings();
    }

  } catch (e) {

    toast(e.message);

  }
}


/* =========================
   NAVIGATION
========================= */

function go(page) {

  document
    .querySelectorAll(".page")
    .forEach(x => x.classList.add("hidden"));

  $(page).classList.remove("hidden");

  document
    .querySelectorAll(".nav")
    .forEach(x =>
      x.classList.toggle(
        "active",
        x.dataset.page === page
      )
    );

  $("pageTitle").textContent =
    page[0].toUpperCase() + page.slice(1);

  if (page === "users") {
    loadUsers();
  }

  if (page === "licenses") {
    loadLicenses();
  }

  if (page === "referrals") {
    loadRefs();

    if (["owner", "admin"].includes(me.role)) {
      loadReferralCodes();
    }
  }
}


document.addEventListener("click", e => {

  const b = e.target.closest("[data-page]");

  if (b) {
    go(b.dataset.page);
  }

});


/* =========================
   LOGIN / REGISTER TABS
========================= */

document.querySelectorAll(".tab")
.forEach(b => {

  b.onclick = () => {

    document
      .querySelectorAll(".tab")
      .forEach(x =>
        x.classList.remove("active")
      );

    b.classList.add("active");

    $("loginBox").classList.toggle(
      "hidden",
      b.dataset.tab !== "login"
    );

    $("registerBox").classList.toggle(
      "hidden",
      b.dataset.tab !== "register"
    );

  };

});


/* =========================
   LOGIN
========================= */

$("loginBtn").onclick = async () => {

  try {

    const d = await api("/api/login", {
      method: "POST",

      body: JSON.stringify({
        username: $("loginUser").value,
        password: $("loginPass").value
      })

    });

    token = d.token;

    localStorage.setItem(
      "wfn_token",
      token
    );

    me = d.user;

    showPanel();

    toast("Login successful");

  } catch (e) {

    toast(e.message);

  }

};


/* =========================
   REGISTER
========================= */

$("regBtn").onclick = async () => {

  try {

    await api("/api/register", {

      method: "POST",

      body: JSON.stringify({

        username: $("regUser").value,

        password: $("regPass").value,

        referral_code:
          $("regRef").value.trim()

      })

    });

    toast("Account created");

    document
      .querySelector('[data-tab="login"]')
      .click();

    $("loginUser").value =
      $("regUser").value;

  } catch (e) {

    toast(e.message);

  }

};


/* =========================
   LOGOUT
========================= */

$("logout").onclick = () => {

  localStorage.removeItem("wfn_token");

  location.reload();

};


/* =========================
   REFERRAL CODE CREATION
========================= */

$("createReferralBtn").onclick =
async () => {

  try {

    const balance =
      Number($("referralBalance").value);

    const code =
      $("referralCodeInput").value.trim();

    const d = await api(
      "/api/admin/referral-codes",
      {
        method: "POST",

        body: JSON.stringify({
          balance,
          code
        })
      }
    );

    $("newReferralResult").innerHTML = `
      <div class="card" style="margin-top:15px">
        <b>Referral Created</b>
        <p>
          Code:
          <strong>${d.referral.code}</strong>
        </p>
        <p>
          Balance:
          <strong>
            ₹${Number(d.referral.balance).toFixed(2)}
          </strong>
        </p>
      </div>
    `;

    $("referralCodeInput").value = "";

    await loadReferralCodes();

    toast("Referral code created");

  } catch (e) {

    toast(e.message);

  }

};


/* =========================
   REFERRAL CODE LIST
========================= */

async function loadReferralCodes() {

  if (!["owner", "admin"].includes(me.role)) {
    return;
  }

  try {

    const d =
      await api("/api/admin/referral-codes");

    $("referralCodeRows").innerHTML =
      (d.referrals || []).map(r => {

        const used =
          r.used_by
            ? "USED"
            : "AVAILABLE";

        return `
          <tr>

            <td>
              <b>${r.code}</b>
            </td>

            <td>
              ₹${Number(r.balance).toFixed(2)}
            </td>

            <td>
              ${used}
            </td>

            <td>
              ${new Date(
                r.created_at
              ).toLocaleString()}
            </td>

          </tr>
        `;

      }).join("");

  } catch (e) {

    toast(e.message);

  }

}


$("refreshReferralCodes").onclick =
loadReferralCodes;


/* =========================
   LICENSES
========================= */

async function loadLicenses() {

  if (!token) return;

  try {

    const d =
      await api("/api/licenses");

    const list =
      Array.isArray(d)
        ? d
        : d.licenses || [];

    $("licenseRows").innerHTML =
      list.map(l => `

        <tr>

          <td>
            <b>${l.license_key}</b>
          </td>

          <td>
            ${l.license_type}
          </td>

          <td>
            ₹${Number(l.price).toFixed(2)}
          </td>

          <td>
            ${l.status}
          </td>

          <td>
            ${l.device_id || "Unbound"}
          </td>

          <td>
            ${new Date(
              l.expires_at
            ).toLocaleString()}
          </td>

        </tr>

      `).join("");

    $("stLicenses").textContent =
      list.length;

    $("stActive").textContent =
      list.filter(x => x.status === "active").length;

  } catch (e) {

    toast(e.message);

  }

}

$("refreshLicenses").onclick =
loadLicenses;


/* =========================
   GENERATE LICENSE
========================= */

$("generateBtn").onclick =
async () => {

  try {

    const d =
      await api("/api/licenses/generate", {

        method: "POST",

        body: JSON.stringify({

          price:
            Number($("keyPrice").value),

          license_type:
            $("keyType").value || "Standard",

          duration_days:
            Number($("keyDays").value)

        })

      });

    $("generated").textContent =
      d.license_key || "";

    await loadLicenses();

    await loadAll();

    toast("License generated");

  } catch (e) {

    toast(e.message);

  }

};


/* =========================
   USERS
========================= */

async function loadUsers() {

  if (!["owner", "admin"].includes(me.role)) {
    return;
  }

  try {

    const d =
      await api("/api/admin/users");

    const users =
      d.users || [];

    $("userRows").innerHTML =
      users.map(u => `

        <tr>

          <td>
            ${u.username}
            <small>#${u.id}</small>
          </td>

          <td>
            ${u.role}
          </td>

          <td>
            ₹${Number(u.balance).toFixed(2)}
          </td>

          <td>
            ${u.referral_code || "—"}
          </td>

        </tr>

      `).join("");

    $("stUsers").textContent =
      users.length;

  } catch (e) {

    toast(e.message);

  }

}

$("refreshUsers").onclick =
loadUsers;


/* =========================
   BALANCE
========================= */

$("balBtn").onclick =
async () => {

  try {

    const id =
      $("balUser").value.trim();

    const amount =
      Number($("balAmount").value);

    await api(
      "/api/admin/users/" +
      id +
      "/balance",
      {
        method: "POST",

        body: JSON.stringify({
          amount,
          note:
            $("balNote").value
        })
      }
    );

    toast("Balance updated");

    loadUsers();

  } catch (e) {

    toast(e.message);

  }

};


/* =========================
   REFERRAL HISTORY
========================= */

async function loadRefs() {

  try {

    const d =
      await api("/api/referrals");

    if (d.code) {
      $("refCode").textContent =
        d.code;
    }

    if (d.reward !== undefined) {
      $("refReward").textContent =
        "₹" + d.reward;
    }

    const items =
      d.items || [];

    $("refRows").innerHTML =
      items.map(x => `

        <tr>

          <td>
            ${x.referred_username}
          </td>

          <td>
            ₹${x.reward}
          </td>

          <td>
            ${new Date(
              x.created_at
            ).toLocaleString()}
          </td>

        </tr>

      `).join("");

  } catch (e) {

    // Don't block login if this optional endpoint
    // does not exist yet.
    console.log("Referral history:", e.message);

  }

}


/* =========================
   PROFILE
========================= */

$("usernameBtn").onclick =
async () => {

  try {

    await api(
      "/api/profile/username",
      {
        method: "POST",

        body: JSON.stringify({
          username:
            $("newUsername").value
        })
      }
    );

    toast("Username changed");

    loadAll();

  } catch (e) {

    toast(e.message);

  }

};


$("passwordBtn").onclick =
async () => {

  try {

    await api(
      "/api/profile/password",
      {
        method: "POST",

        body: JSON.stringify({
          password:
            $("newPassword").value
        })
      }
    );

    toast("Password changed");

  } catch (e) {

    toast(e.message);

  }

};


/* =========================
   SETTINGS
========================= */

async function loadSettings() {

  try {

    const s =
      await api("/api/settings");

    $("setPanel").value =
      s.panel_name || "";

    $("setLicense").value =
      s.license_name || "";

    $("setPrice").value =
      s.license_price || "";

    $("setReward").value =
      s.referral_reward || "";

  } catch (e) {

    console.log(
      "Settings:",
      e.message
    );

  }

}


$("saveSettings").onclick =
async () => {

  try {

    await api("/api/settings", {

      method: "POST",

      body: JSON.stringify({

        panel_name:
          $("setPanel").value,

        license_name:
          $("setLicense").value,

        license_price:
          $("setPrice").value,

        referral_reward:
          $("setReward").value

      })

    });

    toast("Settings saved");

  } catch (e) {

    toast(e.message);

  }

};


/* =========================
   AUTO LOGIN
========================= */

if (token) {

  api("/api/me")
    .then(d => {

      me = d.user;

      showPanel();

    })
    .catch(() => {

      localStorage.removeItem(
        "wfn_token"
      );

      token = null;

    });

}
