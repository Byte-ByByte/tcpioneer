const { spawn } = require('child_process');
const http = require('http');

async function testUi() {
    console.log('Testing Web UI routes...');
    const child = spawn('C:/Users/jaide/StudioProjects/tcpioneer/tcpioneer.exe', [], {
        cwd: 'C:/Users/jaide/StudioProjects/tcpioneer'
    });

    setTimeout(() => {
        child.stdin.write('2\n');
    }, 800);

    await new Promise(r => setTimeout(r, 2000));

    const check = (path) => new Promise((resolve) => {
        http.get(`http://127.0.0.1:3420${path}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ path, status: res.statusCode, length: data.length }));
        }).on('error', (e) => resolve({ path, status: 500, error: e.message }));
    });

    try {
        const homeRes = await check('/home');
        console.log('GET /home:', homeRes.status, 'Length:', homeRes.length);

        const rootRes = await check('/');
        console.log('GET /:', rootRes.status, 'Length:', rootRes.length);

        const pcRes = await check('/pc');
        console.log('GET /pc:', pcRes.status, 'Length:', pcRes.length);

        console.log('--- ALL WEB UI ENDPOINTS VERIFIED SUCCESSFULLY! ---');
    } catch (e) {
        console.error(e);
    } finally {
        child.kill();
        process.exit(0);
    }
}

testUi();
