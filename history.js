
const SUPABASE_URL = "https://mvdcmqhrbtzpcwfwxrqc.supabase.co";

// Use the same publishable key as in your script.js file.
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Bp0R3n5HfEksi498_nNPpA_-JTvXSFn";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

const historySelect = document.getElementById("history-select");
const viewHistoryButton = document.getElementById("view-history");
const backDashboardButton = document.getElementById("back-dashboard");
const historyMessage = document.getElementById("history-message");
const historyDetails = document.getElementById("history-details");
const historyBody = document.getElementById("history-body");

const money = amount =>
    Number(amount).toLocaleString("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    });

async function loadHistoryOptions() {
    const { data: { session } } =
        await supabaseClient.auth.getSession();

    if (!session) {
        window.location.href = "index.html";
        return;
    }

    const { data: cycles, error } = await supabaseClient
        .from("expense_cycles")
        .select("id, start_date, end_date, budget")
        .order("start_date", { ascending: false });

    if (error) {
        console.error(error);
        historyMessage.textContent =
            "Could not load your expense history.";
        return;
    }

    cycles.forEach(cycle => {
        const option = document.createElement("option");
        option.value = cycle.id;
        option.textContent =
            `${cycle.start_date} to ${cycle.end_date} — ${money(cycle.budget)}`;
        historySelect.appendChild(option);
    });

    if (cycles.length === 0) {
        historyMessage.textContent =
            "You have no saved expense cycles yet.";
    }
}

viewHistoryButton.addEventListener("click", async () => {
    const cycleId = historySelect.value;

    if (!cycleId) {
        historyMessage.textContent =
            "Please select an expense cycle.";
        return;
    }

    const { data: cycle, error: cycleError } =
        await supabaseClient
            .from("expense_cycles")
            .select("*")
            .eq("id", cycleId)
            .single();

    if (cycleError) {
        console.error(cycleError);
        historyMessage.textContent =
            "Could not load this expense cycle.";
        return;
    }

    const { data: dailyRows, error: expensesError } =
        await supabaseClient
            .from("daily_expenses")
            .select("*")
            .eq("cycle_id", cycle.id)
            .order("expense_date", { ascending: true });

    if (expensesError) {
        console.error(expensesError);
        historyMessage.textContent =
            "Could not load daily expenses.";
        return;
    }

    historyBody.innerHTML = "";
    let totalSpent = 0;

    dailyRows.forEach(expense => {
        const breakfast = Number(expense.breakfast);
        const lunch = Number(expense.lunch);
        const dinner = Number(expense.dinner);
        const extra = Number(expense.extra);
        const dailyTotal = breakfast + lunch + dinner + extra;

        totalSpent += dailyTotal;

        const row = document.createElement("tr");
        
const date = new Date(expense.expense_date + "T12:00:00");

const formattedDate = date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    weekday: "long"
});

const values = [
    formattedDate,
    money(breakfast),
    money(lunch),
    money(dinner),
    money(extra),
    money(dailyTotal)
];


        values.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        historyBody.appendChild(row);
    });

    document.getElementById("history-start").textContent =
        cycle.start_date;
    document.getElementById("history-end").textContent =
        cycle.end_date;
    document.getElementById("history-budget").textContent =
        money(cycle.budget);
    document.getElementById("history-spent").textContent =
        money(totalSpent);

    historyDetails.hidden = false;
    historyMessage.textContent = "Expense history loaded successfully.";
});

backDashboardButton.addEventListener("click", () => {
    window.location.href = "index.html";
});

supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || !session) {
        window.location.href = "index.html";
    }
});

loadHistoryOptions();
