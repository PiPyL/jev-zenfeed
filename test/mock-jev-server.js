/**
 * Local TypeSafe AI (Jev) Mock Server
 * Simulates TypeSafe AI System One decision API for local development and offline testing.
 * Runs on http://localhost:3000
 */
import http from 'http';

const PORT = Number(process.env.PORT) || 3000;

// Test introspection: how many decision requests / posts were received
const requestStats = { systemoneRequests: 0, postsReceived: 0, lastBody: null };

const VIOLATION_KEYWORDS = [
  'cờ bạc', 'cá độ', 'tài xỉu', 'bóng đá', 'game bài', 'nổ hũ',
  'vay tiền', 'vay nặng lãi', 'tín chấp', 'lãi suất',
  'spoiler', 'cốt truyện', 'kết phim', 'lộ nội dung',
  'tiền ảo', 'crypto', 'coin', 'làm giàu nhanh', 'đa cấp',
  'bóc phốt', 'drama', 'giật gân', 'showbiz',
  'cho thuê', 'thuê nhà', 'căn hộ', 'văn phòng', 'bán nhà', 'bất động sản', 'đất nền'
];

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Endpoint 1: GET /v1/models (Key validation probe)
  if (req.method === 'GET' && (url.pathname === '/v1/models' || url.pathname === '/models')) {
    const authHeader = req.headers['authorization'] || '';
    if (!authHeader.startsWith('Bearer ') || authHeader.length < 15) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'API key không hợp lệ hoặc bị từ chối' } }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      object: 'list',
      data: [
        { id: 'jev-latest', object: 'model', created: 1726700000, owned_by: 'typesafe-ai' },
        { id: 'jev-1.13.0', object: 'model', created: 1726700000, owned_by: 'typesafe-ai' }
      ]
    }));
    return;
  }

  // Test-only endpoint: GET /__stats
  if (req.method === 'GET' && url.pathname === '/__stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(requestStats));
    return;
  }

  // Endpoint 2: POST /v1/systemone (Jev System One decision API)
  if (req.method === 'POST' && (url.pathname === '/v1/systemone' || url.pathname === '/systemone')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const questions = payload.questions || {};
        const answers = {};
        requestStats.systemoneRequests++;
        requestStats.postsReceived += Object.keys(questions).length;
        requestStats.lastBody = body;

        const TECH_KEYWORDS = ['it', 'ai', 'lập trình', 'developer', 'react', 'python', 'javascript', 'công nghệ', 'software', 'kỹ sư'];
        const RECRUIT_KEYWORDS = ['tuyển dụng', 'tuyển nhân viên', 'tìm việc', 'hiring', 'tuyển'];

        for (const [id, q] of Object.entries(questions)) {
          // Resolve postId if question uses atomic key (e.g. post_1__violate)
          const postId = id.includes('__') ? id.split('__')[0] : id;
          const stateContent = payload.state?.posts?.[postId]?.content || payload.state?.posts?.[id]?.content || '';
          const raw = (q.instructions || '');
          const contentMatch = raw.match(/Content:\s*["']?(.*?)["']?$/i) || raw.match(/Nội dung:\s*["']?(.*?)["']?$/i);
          const postText = (stateContent || (contentMatch ? contentMatch[1] : raw)).toLowerCase();
          // Test hook: simulate the API silently omitting an answer
          if (postText.includes('__no_answer__')) continue;

          let prob = 0.05;
          if (id.endsWith('__whitelist')) {
            const isMatch = TECH_KEYWORDS.some(kw => postText.includes(kw));
            prob = isMatch ? 0.96 : 0.04;
          } else {
            const allViolations = VIOLATION_KEYWORDS.concat(RECRUIT_KEYWORDS);
            const isViolation = allViolations.some(kw => postText.includes(kw));
            prob = isViolation ? 0.94 : 0.05;
          }

          answers[id] = {
            type: 'noul',
            noul: prob
          };
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          model: payload.model || 'jev-latest',
          answers: answers,
          usage: {
            inputTokens: 120,
            outputTokens: Object.keys(questions).length
          }
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Invalid JSON payload' } }));
      }
    });
    return;
  }

  // Not Found
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: { message: `Endpoint ${url.pathname} not found on Mock Server` } }));
});

server.listen(PORT, () => {
  console.log(`\n🚀 [Jev Mock Server] Đang chạy tại: http://localhost:${PORT}`);
  console.log(`👉 Endpoint Models:    GET  http://localhost:${PORT}/v1/models`);
  console.log(`👉 Endpoint SystemOne: POST http://localhost:${PORT}/v1/systemone`);
  console.log(`💡 Mẹo: Trong popup extension, mở "Tùy chỉnh Endpoint" và điền: http://localhost:${PORT}\n`);
});
