const { spawn } = require('child_process');
const fs = require('fs');

async function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function run() {
    const server = spawn('node', ['server.js']);
    let output = '';
    
    server.stdout.on('data', d => { console.log(d.toString()); });
    server.stderr.on('data', d => { console.error(d.toString()); });

    await sleep(2000); 

    const token = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJrbDg4NjhAc3Jtc3RpLmVkdS5pbiIsImV4cCI6MTc3NzY5OTE5OSwiaWF0IjoxNzc3Njk4Mjk5LCJpc3MiOiJBZmZvcmQgTWVkaWNhbCBUZWNobm9sb2dpZXMgUHJpdmF0ZSBMaW1pdGVkIiwianRpIjoiODJiNTJjMzctYjUzYy00ZDQ5LTkzYjUtMWY4MDFmZWJmNWZiIiwibG9jYWxlIjoiZW4tSU4iLCJuYW1lIjoia3Jpc2huYSBsb2RoYSIsInN1YiI6IjhkZTIxMjZjLTM2Y2UtNDBlZC04ODEzLWQ0ZDRlMDc3ZThiYiJ9LCJlbWFpbCI6ImtsODg2OEBzcm1zdGkuZWR1LmluIiwibmFtZSI6ImtyaXNobmEgbG9kaGEiLCJyb2xsTm8iOiJyYTIzMTEwNTYwMTAwOTUiLCJhY2Nlc3NDb2RlIjoiUWticHhIIiwiY2xpZW50SUQiOiI4ZGUyMTI2Yy0zNmNlLTQwZWQtODgxMy1kNGQ0ZTA3N2U4YmIiLCJjbGllbnRTZWNyZXQiOiJ0cWFzVXFoZWthcnBTTVJNIn0.-GB_iMQ6kbyzWDtGBZ34uo8hMaatjq8IcFMKvxMLH6s";
    
    async function curl(method, path, body) {
        const start = Date.now();
        const headers = { 'Authorization': token, 'Content-Type': 'application/json' };
        const opts = { method, headers };
        if (body) opts.body = JSON.stringify(body);
        
        try {
            const res = await fetch(`http://127.0.0.1:31337${path}`, opts);
            const time = Date.now() - start;
            const data = await res.json();
            
            const reqBodyStr = body ? JSON.stringify(body) : '';
            output += `=== ${method} ${path} ===\n`;
            output += `Request Body: ${reqBodyStr}\n`;
            output += `Response Status: ${res.status}\n`;
            output += `Response Time: ${time}ms\n`;
            output += `Response Body: ${JSON.stringify(data, null, 2)}\n\n`;
        } catch (e) {
            output += `=== ${method} ${path} ERROR ===\n${e.message}\n\n`;
        }
    }

    await curl('POST', '/api/notifications', { type: 'Placement', message: 'Test Placement Notif' });
    await curl('POST', '/api/notifications', { type: 'Result', message: 'Test Result Notif' });
    await curl('GET', '/api/notifications');
    await curl('GET', '/api/notifications/unread');
    await curl('PUT', '/api/notifications/1/read');
    await curl('GET', '/api/notifications/unread'); 
    await curl('PUT', '/api/notifications/read-all');
    await curl('GET', '/api/notifications/unread'); 
    await curl('GET', '/api/notifications/type/Placement');
    await curl('DELETE', '/api/notifications/1');

    fs.writeFileSync('screenshots_phase3.txt', output);
    server.kill();
}

run();
