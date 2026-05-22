// ============================================================
// Hub Workspace — Database Seed
// ============================================================
import bcrypt from 'bcryptjs';
import pool, { query } from './pool';
import { BCRYPT_ROUNDS } from '../constants';

async function seed(): Promise<void> {
  // ── 1. Admin user ──────────────────────────────────────────
  const passwordHash = await bcrypt.hash('HubAdmin2024!', BCRYPT_ROUNDS);
  await query(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO NOTHING`,
    ['admin@hub.local', passwordHash, '管理者', 'admin']
  );
  console.log('[seed] Admin user upserted.');

  // ── 2. Project templates ───────────────────────────────────

  // Template 1: LP制作 スタンダード
  await query(
    `INSERT INTO project_templates (id, name, industry, description, is_system)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name,
           industry = EXCLUDED.industry,
           description = EXCLUDED.description,
           is_system = EXCLUDED.is_system,
           updated_at = now()`,
    [
      'tpl_lp_standard',
      'LP制作 スタンダード',
      'Webマーケティング',
      'ランディングページ制作の標準テンプレート。ヒアリングから公開まで6ステップで完結。',
      true,
    ]
  );
  // Delete existing template tasks for idempotency
  await query(`DELETE FROM template_tasks WHERE template_id = $1`, ['tpl_lp_standard']);
  await query(
    `INSERT INTO template_tasks (template_id, title, tool_identifier, priority, duration_days, order_index)
     VALUES
       ($1, 'クライアントヒアリング',       NULL,              'high',   1, 0),
       ($1, 'コンセプト・構成設計',         'prompt_builder',  'high',   2, 1),
       ($1, 'コピーライティング',           'prompt_builder',  'medium', 3, 2),
       ($1, 'デザイン制作',                 'lp_builder',      'high',   5, 3),
       ($1, 'コーディング・実装',           'lp_builder',      'medium', 4, 4),
       ($1, 'テスト・公開',                 NULL,              'high',   1, 5)`,
    ['tpl_lp_standard']
  );
  console.log('[seed] tpl_lp_standard upserted.');

  // Template 2: SNS運用 月額パック
  await query(
    `INSERT INTO project_templates (id, name, industry, description, is_system)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name,
           industry = EXCLUDED.industry,
           description = EXCLUDED.description,
           is_system = EXCLUDED.is_system,
           updated_at = now()`,
    [
      'tpl_sns_monthly',
      'SNS運用 月額パック',
      'SNSマーケティング',
      'Instagram/X/TikTok等SNSの月次運用テンプレート。投稿計画から分析レポートまで。',
      true,
    ]
  );
  await query(`DELETE FROM template_tasks WHERE template_id = $1`, ['tpl_sns_monthly']);
  await query(
    `INSERT INTO template_tasks (template_id, title, tool_identifier, priority, duration_days, order_index)
     VALUES
       ($1, '月次コンテンツ計画策定',     'prompt_builder',  'high',   2, 0),
       ($1, '投稿素材・キャプション制作', 'prompt_builder',  'medium', 5, 1),
       ($1, '予約投稿設定',               NULL,              'medium', 1, 2),
       ($1, 'エンゲージメント対応',       NULL,              'low',    7, 3),
       ($1, '月次分析レポート作成',       NULL,              'high',   2, 4)`,
    ['tpl_sns_monthly']
  );
  console.log('[seed] tpl_sns_monthly upserted.');

  // Template 3: LP制作 美容サロン特化
  await query(
    `INSERT INTO project_templates (id, name, industry, description, is_system)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name,
           industry = EXCLUDED.industry,
           description = EXCLUDED.description,
           is_system = EXCLUDED.is_system,
           updated_at = now()`,
    [
      'tpl_lp_beauty',
      'LP制作 美容サロン特化',
      '美容・エステ',
      '美容サロン・エステ・ネイル等に特化したLP制作テンプレート。予約導線設計を含む7ステップ。',
      true,
    ]
  );
  await query(`DELETE FROM template_tasks WHERE template_id = $1`, ['tpl_lp_beauty']);
  await query(
    `INSERT INTO template_tasks (template_id, title, tool_identifier, priority, duration_days, order_index)
     VALUES
       ($1, 'サロンコンセプトヒアリング',   NULL,              'high',   1, 0),
       ($1, 'ターゲット・ペルソナ設計',     'prompt_builder',  'high',   1, 1),
       ($1, '訴求コピー・キャッチコピー制作', 'prompt_builder', 'high',  3, 2),
       ($1, 'ビジュアルデザイン',           'lp_builder',      'high',   4, 3),
       ($1, '予約フォーム・CTA設計',        'lp_builder',      'high',   2, 4),
       ($1, 'SP/PC レスポンシブ実装',       'lp_builder',      'medium', 3, 5),
       ($1, 'SEO・公開・計測設定',          NULL,              'medium', 1, 6)`,
    ['tpl_lp_beauty']
  );
  console.log('[seed] tpl_lp_beauty upserted.');

  // ── 3. Sample tools ────────────────────────────────────────
  await query(
    `INSERT INTO tools (identifier, name, description, endpoint_url, health_endpoint, capabilities, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (identifier) DO UPDATE
       SET name = EXCLUDED.name,
           description = EXCLUDED.description,
           endpoint_url = EXCLUDED.endpoint_url,
           health_endpoint = EXCLUDED.health_endpoint,
           capabilities = EXCLUDED.capabilities,
           updated_at = now()`,
    [
      'prompt_builder',
      'プロンプトビルダー',
      'AI活用のコピーライティング・プロンプト生成ツール',
      'http://localhost:3002',
      'http://localhost:3002/health',
      JSON.stringify({
        copywriting: true,
        prompt_generation: true,
        persona_creation: true,
      }),
      'offline',
    ]
  );

  await query(
    `INSERT INTO tools (identifier, name, description, endpoint_url, health_endpoint, capabilities, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (identifier) DO UPDATE
       SET name = EXCLUDED.name,
           description = EXCLUDED.description,
           endpoint_url = EXCLUDED.endpoint_url,
           health_endpoint = EXCLUDED.health_endpoint,
           capabilities = EXCLUDED.capabilities,
           updated_at = now()`,
    [
      'lp_builder',
      'LP制作ツール',
      'ランディングページの設計・デザイン・コーディング支援ツール',
      'http://localhost:3003',
      'http://localhost:3003/health',
      JSON.stringify({
        lp_design: true,
        responsive: true,
        coding: true,
        cta_optimization: true,
      }),
      'offline',
    ]
  );
  console.log('[seed] Sample tools upserted.');

  await pool.end();
  console.log('[seed] Seed complete.');
}

seed().catch((e) => {
  console.error('[seed] Error:', e);
  process.exit(1);
});
