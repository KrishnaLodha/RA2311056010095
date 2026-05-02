const ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJrbDg4NjhAc3Jtc3RpLmVkdS5pbiIsImV4cCI6MTc3NzY5OTE5OSwiaWF0IjoxNzc3Njk4Mjk5LCJpc3MiOiJBZmZvcmQgTWVkaWNhbCBUZWNobm9sb2dpZXMgUHJpdmF0ZSBMaW1pdGVkIiwianRpIjoiODJiNTJjMzctYjUzYy00ZDQ5LTkzYjUtMWY4MDFmZWJmNWZiIiwibG9jYWxlIjoiZW4tSU4iLCJuYW1lIjoia3Jpc2huYSBsb2RoYSIsInN1YiI6IjhkZTIxMjZjLTM2Y2UtNDBlZC04ODEzLWQ0ZDRlMDc3ZThiYiJ9LCJlbWFpbCI6ImtsODg2OEBzcm1zdGkuZWR1LmluIiwibmFtZSI6ImtyaXNobmEgbG9kaGEiLCJyb2xsTm8iOiJyYTIzMTEwNTYwMTAwOTUiLCJhY2Nlc3NDb2RlIjoiUWticHhIIiwiY2xpZW50SUQiOiI4ZGUyMTI2Yy0zNmNlLTQwZWQtODgxMy1kNGQ0ZTA3N2U4YmIiLCJjbGllbnRTZWNyZXQiOiJ0cWFzVXFoZWthcnBTTVJNIn0.-GB_iMQ6kbyzWDtGBZ34uo8hMaatjq8IcFMKvxMLH6s";

async function Log(stack, level, pkg, message) {
    try {
        const response = await fetch("http://20.207.122.201/evaluation-service/logs", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${ACCESS_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                stack: stack,
                level: level,
                package: pkg,
                message: message
            })
        });
        
        if (!response.ok) {
        }
    } catch (error) {
    }
}

module.exports = { Log };
