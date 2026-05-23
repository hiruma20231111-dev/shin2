// ============================================================
// Hub Workspace — Express Application Entry Point
// ============================================================
import 'dotenv/config';
import app from './app';
import { startHealthPoller } from './services/healthPoller';

const PORT = parseInt(process.env['PORT'] ?? '3001', 10);

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  startHealthPoller();
});
