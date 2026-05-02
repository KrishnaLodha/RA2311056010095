const { Log } = require('../../logging_middleware');

const ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJrbDg4NjhAc3Jtc3RpLmVkdS5pbiIsImV4cCI6MTc3NzY5OTE5OSwiaWF0IjoxNzc3Njk4Mjk5LCJpc3MiOiJBZmZvcmQgTWVkaWNhbCBUZWNobm9sb2dpZXMgUHJpdmF0ZSBMaW1pdGVkIiwianRpIjoiODJiNTJjMzctYjUzYy00ZDQ5LTkzYjUtMWY4MDFmZWJmNWZiIiwibG9jYWxlIjoiZW4tSU4iLCJuYW1lIjoia3Jpc2huYSBsb2RoYSIsInN1YiI6IjhkZTIxMjZjLTM2Y2UtNDBlZC04ODEzLWQ0ZDRlMDc3ZThiYiJ9LCJlbWFpbCI6ImtsODg2OEBzcm1zdGkuZWR1LmluIiwibmFtZSI6ImtyaXNobmEgbG9kaGEiLCJyb2xsTm8iOiJyYTIzMTEwNTYwMTAwOTUiLCJhY2Nlc3NDb2RlIjoiUWticHhIIiwiY2xpZW50SUQiOiI4ZGUyMTI2Yy0zNmNlLTQwZWQtODgxMy1kNGQ0ZTA3N2U4YmIiLCJjbGllbnRTZWNyZXQiOiJ0cWFzVXFoZWthcnBTTVJNIn0.-GB_iMQ6kbyzWDtGBZ34uo8hMaatjq8IcFMKvxMLH6s";

async function fetchNotifications() {
    try {
        const response = await fetch("http://20.207.122.201/evaluation-service/notifications", {
            headers: {
                "Authorization": `Bearer ${ACCESS_TOKEN}`
            }
        });
        if (!response.ok) {
            console.error("Failed to fetch notifications:", response.status);
            return [];
        }
        const data = await response.json();
        return data.notifications || [];
    } catch (e) {
        console.error(e);
        return [];
    }
}

function calculatePriority(notification) {
    let weight = 0;
    if (notification.Type === "Placement") weight = 30000;
    else if (notification.Type === "Result") weight = 20000;
    else if (notification.Type === "Event") weight = 10000;

    const notifTime = new Date(notification.Timestamp).getTime();
    const now = Date.now();
    const elapsedHours = (now - notifTime) / (1000 * 60 * 60);

    return weight - elapsedHours;
}

async function main() {
    const notifications = await fetchNotifications();
    
    if (notifications.length === 0) {
        console.log("No notifications found.");
        return;
    }

    const scored = notifications.map(n => ({
        ...n,
        PriorityScore: calculatePriority(n)
    }));

    scored.sort((a, b) => b.PriorityScore - a.PriorityScore);

    const top10 = scored.slice(0, 10);
    
    console.table(top10.map(n => ({
        ID: n.ID.split('-')[0] + '...',
        Type: n.Type,
        Message: n.Message.substring(0, 20) + '...',
        Timestamp: n.Timestamp,
        Score: n.PriorityScore.toFixed(2)
    })));

    try {
        await Log("backend", "info", "service", "Priority inbox calculated top 10 notifications");
    } catch (e) {}
}

main();
