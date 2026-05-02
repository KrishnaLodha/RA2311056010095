const fs = require('fs');
const { Log } = require('../logging_middleware');

const ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJrbDg4NjhAc3Jtc3RpLmVkdS5pbiIsImV4cCI6MTc3NzY5OTE5OSwiaWF0IjoxNzc3Njk4Mjk5LCJpc3MiOiJBZmZvcmQgTWVkaWNhbCBUZWNobm9sb2dpZXMgUHJpdmF0ZSBMaW1pdGVkIiwianRpIjoiODJiNTJjMzctYjUzYy00ZDQ5LTkzYjUtMWY4MDFmZWJmNWZiIiwibG9jYWxlIjoiZW4tSU4iLCJuYW1lIjoia3Jpc2huYSBsb2RoYSIsInN1YiI6IjhkZTIxMjZjLTM2Y2UtNDBlZC04ODEzLWQ0ZDRlMDc3ZThiYiJ9LCJlbWFpbCI6ImtsODg2OEBzcm1zdGkuZWR1LmluIiwibmFtZSI6ImtyaXNobmEgbG9kaGEiLCJyb2xsTm8iOiJyYTIzMTEwNTYwMTAwOTUiLCJhY2Nlc3NDb2RlIjoiUWticHhIIiwiY2xpZW50SUQiOiI4ZGUyMTI2Yy0zNmNlLTQwZWQtODgxMy1kNGQ0ZTA3N2U4YmIiLCJjbGllbnRTZWNyZXQiOiJ0cWFzVXFoZWthcnBTTVJNIn0.-GB_iMQ6kbyzWDtGBZ34uo8hMaatjq8IcFMKvxMLH6s";

async function fetchDepots() {
    try {
        await Log("backend", "info", "service", "Fetching depots from API");
        const res = await fetch("http://20.207.122.201/evaluation-service/depots", {
            headers: { "Authorization": `Bearer ${ACCESS_TOKEN}` }
        });
        if (!res.ok) throw new Error("Failed to fetch depots");
        const data = await res.json();
        return data.depots;
    } catch (e) {
        await Log("backend", "error", "service", `Fetch depots failed: ${e.message}`);
        return [];
    }
}

async function fetchVehicles() {
    try {
        await Log("backend", "info", "service", "Fetching vehicles from API");
        const res = await fetch("http://20.207.122.201/evaluation-service/vehicles", {
            headers: { "Authorization": `Bearer ${ACCESS_TOKEN}` }
        });
        if (!res.ok) throw new Error("Failed to fetch vehicles");
        const data = await res.json();
        return data.vehicles;
    } catch (e) {
        await Log("backend", "error", "service", `Fetch vehicles failed: ${e.message}`);
        return [];
    }
}

function solveKnapsack(budget, vehicles) {
    const n = vehicles.length;
    // DP array optimization (using 1D arrays to save memory if needed, but 2D is fine for standard budgets)
    const dp = Array(n + 1).fill().map(() => Array(budget + 1).fill(0));
    const keep = Array(n + 1).fill().map(() => Array(budget + 1).fill(false));

    for (let i = 1; i <= n; i++) {
        const v = vehicles[i - 1];
        // Ensure duration is int
        const weight = Math.floor(v.Duration);
        const value = v.Impact;

        for (let w = 0; w <= budget; w++) {
            if (weight <= w && (dp[i - 1][w - weight] + value) > dp[i - 1][w]) {
                dp[i][w] = dp[i - 1][w - weight] + value;
                keep[i][w] = true;
            } else {
                dp[i][w] = dp[i - 1][w];
                keep[i][w] = false;
            }
        }
    }

    const selectedTasks = [];
    let w = budget;
    for (let i = n; i > 0; i--) {
        if (keep[i][w]) {
            selectedTasks.push(vehicles[i - 1].TaskID);
            w -= Math.floor(vehicles[i - 1].Duration);
        }
    }

    return { maxImpact: dp[n][budget], selectedTasks: selectedTasks.reverse() };
}

async function main() {
    const depots = await fetchDepots();
    const vehicles = await fetchVehicles();

    if (!depots.length || !vehicles.length) {
        console.error("Failed to retrieve necessary data.");
        return;
    }

    await Log("backend", "info", "service", "Starting knapsack algorithm computation");
    
    let output = "";

    for (const depot of depots) {
        const budget = depot.MechanicHours;
        const result = solveKnapsack(budget, vehicles);
        
        const logMsg = `=== Depot ${depot.ID} ===\nBudget (Hours): ${budget}\nMax Impact: ${result.maxImpact}\nSelected Tasks: ${result.selectedTasks.length}\n`;
        output += logMsg + "\n";
        console.log(logMsg);
    }
    
    fs.writeFileSync('screenshot_phase4.txt', output);
    await Log("backend", "info", "service", "Knapsack algorithm completed and output generated");
}

main();
