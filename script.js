const SUPABASE_URL = "https://mvdcmqhrbtzpcwfwxrqc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Bp0R3n5HfEksi498_nNPpA_-JTvXSFn";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

const startInput = document.getElementById("start-date");
const endInput = document.getElementById("end-date");
const budgetInput = document.getElementById("monthly-budget");
const saveButton = document.getElementById("save-cycle");
const message = document.getElementById("cycle-message");

const budgetDisplay = document.getElementById("budget");
const spentDisplay = document.getElementById("spent");
const remainingDisplay = document.getElementById("remaining");
const expenseBody = document.getElementById("expense-body");

const historySelect = document.getElementById("history-select");
const viewHistoryButton = document.getElementById("view-history");
const historyMessage = document.getElementById("history-message");

const categories = ["breakfast", "lunch", "dinner", "extra"];
let currentCycleKey = null;
let currentCycle = null;
let expenses = {};

const money = amount => amount.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
});

function dateKey(date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");
}

function parseDate(value) {
    return new Date(value + "T12:00:00");
}

function storageKey(start, end) {
    return `expenseCycle_${start}_${end}`;
}

function saveCurrentData() {
    if (!currentCycleKey || !currentCycle) return;

    currentCycle.expenses = expenses;

    localStorage.setItem(
        currentCycleKey,
        JSON.stringify(currentCycle)
    );
}

function updateTotals() {
    const totals = [0, 0, 0, 0];

    Object.values(expenses).forEach(values => {
        values.forEach((amount, index) => {
            totals[index] += Number(amount) || 0;
        });
    });

    const spent = totals.reduce((sum, amount) => sum + amount, 0);
    const budget = currentCycle ? currentCycle.budget : 0;

    document.getElementById("breakfast-total").textContent = money(totals[0]);
    document.getElementById("lunch-total").textContent = money(totals[1]);
    document.getElementById("dinner-total").textContent = money(totals[2]);
    document.getElementById("extra-total").textContent = money(totals[3]);
    document.getElementById("grand-total").textContent = money(spent);

    budgetDisplay.textContent = money(budget);
    spentDisplay.textContent = money(spent);
    remainingDisplay.textContent = money(budget - spent);
}

function renderRows() {
    expenseBody.innerHTML = "";

    if (!currentCycle) {
        expenseBody.innerHTML =
            '<tr><td colspan="6">Create an expense cycle to begin.</td></tr>';
        updateTotals();
        return;
    }

    const start = parseDate(currentCycle.startDate);
    const end = parseDate(currentCycle.endDate);

    // Show dates only up to today, or the cycle's end date.
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayKey = dateKey(new Date());
const lastVisible = parseDate(
    end < todayKey ? end : todayKey
);

    if (start > lastVisible) {
        expenseBody.innerHTML =
            '<tr><td colspan="6">Your expense cycle has not started yet.</td></tr>';
        updateTotals();
        return;
    }

    const current = new Date(start);

    while (current <= lastVisible) {
        const key = dateKey(current);

        if (!expenses[key]) {
            expenses[key] = [0, 0, 0, 0];
        }

        const row = document.createElement("tr");
        const day = current.toLocaleDateString("en-IN", {
            weekday: "long"
        });
        const dateText = current.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short"
        });

        if (current.getDay() === 0 || current.getDay() === 6) {
            row.classList.add("weekend");
        }

        const dateCell = document.createElement("td");
        dateCell.className = "date-cell";

        const dateSpan = document.createElement("span");
        dateSpan.className = "date-number";
        dateSpan.textContent = dateText;

        const daySpan = document.createElement("span");
        daySpan.className = "day-name";
        daySpan.textContent = day;

        dateCell.append(dateSpan, daySpan);
        row.appendChild(dateCell);

        categories.forEach((category, index) => {
            const cell = document.createElement("td");
            const input = document.createElement("input");

            input.type = "number";
            input.min = "0";
            input.step = "0.01";
            input.placeholder = "0.00";
            input.setAttribute("aria-label", `${day} ${category} expense`);
            input.value = expenses[key][index] || "";

            
input.addEventListener("input", async () => {
    expenses[key][index] = Math.max(
        0,
        Number(input.value) || 0
    );

    saveCurrentData();

    row.querySelector(".row-total").textContent = money(
        expenses[key].reduce((sum, amount) => sum + amount, 0)
    );

    updateTotals();

    await saveCycleToSupabase();
});


            

            cell.appendChild(input);
            row.appendChild(cell);
        });

        const totalCell = document.createElement("td");
        totalCell.className = "row-total";
        totalCell.textContent = money(
            expenses[key].reduce((sum, amount) => sum + amount, 0)
        );

        row.appendChild(totalCell);
        expenseBody.appendChild(row);

        current.setDate(current.getDate() + 1);
    }

    saveCurrentData();
    updateTotals();
}


async function refreshHistory() {
    if (!historySelect) return;

    const { data: { session } } =
        await supabaseClient.auth.getSession();

    historySelect.innerHTML =
        '<option value="">Select an expense cycle</option>';

    if (!session) return;

    const { data: cycles, error } = await supabaseClient
        .from("expense_cycles")
        .select("id, start_date, end_date, budget")
        .order("start_date", { ascending: false });

    if (error) {
        console.error("Could not load expense history:", error);
        if (historyMessage) {
            historyMessage.textContent =
                "Could not load expense history.";
        }
        return;
    }

    cycles.forEach(cycle => {
        const option = document.createElement("option");
        option.value = String(cycle.id);
        option.textContent =
            `${cycle.start_date} to ${cycle.end_date} — ${money(Number(cycle.budget))}`;

        historySelect.appendChild(option);
    });
}


function loadCycle(key) {
    const saved = localStorage.getItem(key);

    if (!saved) return;

    const cycle = JSON.parse(saved);

    currentCycleKey = key;
    currentCycle = cycle;
    expenses = cycle.expenses || {};

    startInput.value = cycle.startDate;
    endInput.value = cycle.endDate;
    budgetInput.value = cycle.budget;

    message.textContent =
        `Viewing cycle: ${cycle.startDate} to ${cycle.endDate}`;

    renderRows();
}

saveButton.addEventListener("click", async () => {
    const start = startInput.value;
    const end = endInput.value;
    const budget = Number(budgetInput.value);

    if (!start || !end || !Number.isFinite(budget) || budget <= 0) {
        message.textContent =
            "Enter valid start and end dates and a budget greater than ₹0.";
        return;
    }

    if (end < start) {
        message.textContent = "End date must not be before the start date.";
        return;
    }

    const key = storageKey(start, end);

    // Reopen the same cycle without losing its saved expenses.
    if (key === currentCycleKey && currentCycle) {
        currentCycle.budget = budget;
    } else {
        const existing = localStorage.getItem(key);

        currentCycle = existing
            ? JSON.parse(existing)
            : { startDate: start, endDate: end, budget, expenses: {} };

        currentCycle.budget = budget;
        currentCycleKey = key;
        expenses = currentCycle.expenses || {};
    }

    await saveCycleToSupabase();
renderRows();
refreshHistory();

historySelect.value = key;
});


viewHistoryButton.addEventListener("click", async () => {
    const cycleId = historySelect.value;

    if (!cycleId) {
        historyMessage.textContent = "Please select an expense cycle.";
        return;
    }

    await loadCycleFromSupabase(cycleId);
});


const oldCycle = localStorage.getItem("expenseCycle");
const oldExpenses = localStorage.getItem("expenseAmounts");

if (oldCycle) {
    try {
        const previous = JSON.parse(oldCycle);
        const key = storageKey(previous.startDate, previous.endDate);

        if (!localStorage.getItem(key)) {
            localStorage.setItem(key, JSON.stringify({
                ...previous,
                expenses: oldExpenses ? JSON.parse(oldExpenses) : {}
            }));
        }
    } catch (error) {
        console.error("Could not migrate the previous expense cycle.", error);
    }
}

refreshHistory();



// Refresh the visible dates if the page stays open overnight.
function refreshIfDateChanges() {
    if (currentCycle) renderRows();
}

setInterval(refreshIfDateChanges, 60 * 1000);
console.log("Supabase client:", supabaseClient);

const authSection = document.getElementById("auth-section");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authMessage = document.getElementById("auth-message");
const signupButton = document.getElementById("signup-button");
const loginButton = document.getElementById("login-button");
const logoutButton = document.getElementById("logout-button");

signupButton.addEventListener("click", async () => {
    const email = authEmail.value.trim();
    const password = authPassword.value;

    if (!email || password.length < 6) {
        authMessage.textContent =
            "Enter a valid email and a password with at least 6 characters.";
        return;
    }

   
const { error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
        emailRedirectTo: "https://magenta-peony-7c658f.netlify.app/index.html"
    }
});

    
if (error) {
    authMessage.textContent = error.message;
} else {
    authMessage.textContent =
        "If registration succeeds, check your inbox and spam folder for a confirmation email. If you already have an account, try logging in instead.";
}

});

loginButton.addEventListener("click", async () => {
    const email = authEmail.value.trim();
    const password = authPassword.value;

    const { error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    authMessage.textContent = error
        ? error.message
        : "Login successful!";
    
    if (!error) {
        updateAuthUI();
    }
});

logoutButton.addEventListener("click", async () => {
    const { error } = await supabaseClient.auth.signOut();

    authMessage.textContent = error
        ? error.message
        : "You have logged out.";

    updateAuthUI();
});
  

async function updateAuthUI() {
    const { data: { session } } =
        await supabaseClient.auth.getSession();

    const loggedIn = Boolean(session);

    const authSection = document.getElementById("auth-section");
    const dashboardSection = document.getElementById("dashboard-section");

    authSection.style.display = loggedIn ? "none" : "block";
    dashboardSection.style.display = loggedIn ? "block" : "none";

    authEmail.disabled = loggedIn;
    authPassword.disabled = loggedIn;
    signupButton.hidden = loggedIn;
    loginButton.hidden = loggedIn;
    logoutButton.hidden = !loggedIn;

    
if (loggedIn) {
    await refreshHistory();
    await loadLatestCloudCycle();
} else {
    historySelect.innerHTML =
        '<option value="">Select an expense cycle</option>';
}

}

async function loadLatestCloudCycle() {
    const { data: cycles, error } = await supabaseClient
        .from("expense_cycles")
        .select("id, start_date, end_date, budget")
        .order("start_date", { ascending: false })
        .limit(1);

    if (error) {
        console.error("Could not load the latest cycle:", error);
        return;
    }

    if (cycles && cycles.length > 0) {
        await loadCycleFromSupabase(cycles[0].id);
        await refreshHistory();
      
    }
}





supabaseClient.auth.onAuthStateChange(() => {
    updateAuthUI();
});

updateAuthUI();

async function saveCycleToSupabase() {
    const { data: { session }, error: sessionError } =
        await supabaseClient.auth.getSession();

    if (sessionError || !session) {
        message.textContent = "Please log in before saving expenses.";
        return;
    }

    if (!currentCycle) {
        message.textContent = "Create an expense cycle first.";
        return;
    }

    const cycleData = {
        user_id: session.user.id,
        start_date: currentCycle.startDate,
        end_date: currentCycle.endDate,
        budget: currentCycle.budget
    };

    const { data: savedCycle, error: cycleError } =
        await supabaseClient
            .from("expense_cycles")
            .upsert(cycleData, {
                onConflict: "user_id,start_date,end_date"
            })
            .select()
            .single();

    if (cycleError) {
        console.error("Cycle save error:", cycleError);
        message.textContent = "Could not save the cycle to the cloud.";
        return;
    }

    const dailyRows = Object.entries(expenses).map(([date, amounts]) => ({
        cycle_id: savedCycle.id,
        expense_date: date,
        breakfast: Number(amounts[0]) || 0,
        lunch: Number(amounts[1]) || 0,
        dinner: Number(amounts[2]) || 0,
        extra: Number(amounts[3]) || 0
    }));

    if (dailyRows.length > 0) {
        const { error: expensesError } = await supabaseClient
            .from("daily_expenses")
            .upsert(dailyRows, {
                onConflict: "cycle_id,expense_date"
            });

        if (expensesError) {
            console.error("Daily expenses save error:", expensesError);
            message.textContent = "Cycle saved, but some expenses could not be saved.";
            return;
        }
    }

    message.textContent = "Expense cycle saved to your cloud account.";
}

async function loadCycleFromSupabase(cycleId) {
    const { data: cycle, error: cycleError } = await supabaseClient
        .from("expense_cycles")
        .select("*")
        .eq("id", cycleId)
        .single();

    if (cycleError) {
        console.error("Could not load cycle:", cycleError);
        historyMessage.textContent = "Could not load this expense cycle.";
        return;
    }

    const { data: dailyRows, error: expensesError } = await supabaseClient
        .from("daily_expenses")
        .select("*")
        .eq("cycle_id", cycle.id);

    if (expensesError) {
        console.error("Could not load expenses:", expensesError);
        historyMessage.textContent = "Could not load daily expenses.";
        return;
    }

    currentCycleKey = storageKey(cycle.start_date, cycle.end_date);

    currentCycle = {
        startDate: cycle.start_date,
        endDate: cycle.end_date,
        budget: Number(cycle.budget),
        expenses: {}
    };

    expenses = {};

    dailyRows.forEach(row => {
        expenses[row.expense_date] = [
            Number(row.breakfast),
            Number(row.lunch),
            Number(row.dinner),
            Number(row.extra)
        ];
    });

    currentCycle.expenses = expenses;

    startInput.value = cycle.start_date;
    endInput.value = cycle.end_date;
    budgetInput.value = cycle.budget;

    renderRows();

    historyMessage.textContent = "Cloud expense cycle loaded successfully.";
}

const historyPageButton = document.getElementById("history-page-button");

if (historyPageButton) {
    historyPageButton.addEventListener("click", () => {
        window.location.assign("./history.html");
    });
}
