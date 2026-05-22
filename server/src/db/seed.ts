// ============================================================
// Hub Workspace — Database Seed
// ============================================================
import 'dotenv/config';
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

  // ── Template 1: LP制作 スタンダード（仕様書通り） ───────
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
      '汎用',
      'LP制作の標準テンプレート（6ステップ）',
      true,
    ]
  );
  await query(`DELETE FROM template_tasks WHERE template_id = $1`, ['tpl_lp_standard']);
  await query(
    `INSERT INTO template_tasks (template_id, title, tool_identifier, priority, duration_days, order_index)
     VALUES
       ($1, 'ヒアリング・要件定義',     NULL,             'high',   2, 0),
       ($1, 'プロンプト生成',           'prompt_builder', 'high',   1, 1),
       ($1, 'LP制作（コーディング）',   'lp_builder',     'high',   5, 2),
       ($1, 'クライアントレビュー',     NULL,             'medium', 3, 3),
       ($1, '修正対応',                 'lp_builder',     'medium', 2, 4),
       ($1, '納品・公開',               NULL,             'high',   1, 5)`,
    ['tpl_lp_standard']
  );
  console.log('[seed] tpl_lp_standard upserted.');

  // ── Template 2: SNS運用 月額パック（仕様書通り） ────────
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
      '汎用',
      'SNSの月次運用テンプレート（5ステップ）',
      true,
    ]
  );
  await query(`DELETE FROM template_tasks WHERE template_id = $1`, ['tpl_sns_monthly']);
  await query(
    `INSERT INTO template_tasks (template_id, title, tool_identifier, priority, duration_days, order_index)
     VALUES
       ($1, '月次方針MTG',           NULL,            'high',   1, 0),
       ($1, '投稿コンテンツ生成',     'sns_scheduler', 'high',   3, 1),
       ($1, '広告クリエイティブ制作', 'banner_gen',    'medium', 2, 2),
       ($1, 'スケジュール入稿',       'sns_scheduler', 'high',   1, 3),
       ($1, '月次レポート作成',       'report_gen',    'medium', 2, 4)`,
    ['tpl_sns_monthly']
  );
  console.log('[seed] tpl_sns_monthly upserted.');

  // ── Template 3: LP制作 美容サロン特化（仕様書通り） ─────
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
      '美容',
      '美容サロン特化のLP制作テンプレート（7ステップ）',
      true,
    ]
  );
  await query(`DELETE FROM template_tasks WHERE template_id = $1`, ['tpl_lp_beauty']);
  await query(
    `INSERT INTO template_tasks (template_id, title, tool_identifier, priority, duration_days, order_index)
     VALUES
       ($1, 'ヒアリング・要件定義',          NULL,             'high',   2, 0),
       ($1, 'プロンプト生成（美容）',        'prompt_builder', 'high',   1, 1),
       ($1, 'LP制作',                        'lp_builder',     'high',   4, 2),
       ($1, 'バナー制作（SNS広告用）',       'banner_gen',     'medium', 2, 3),
       ($1, 'クライアントレビュー',          NULL,             'medium', 3, 4),
       ($1, '修正対応',                      'lp_builder',     'medium', 2, 5),
       ($1, '納品・公開',                    NULL,             'high',   1, 6)`,
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

  // Additional tools referenced by templates (registered to allow assignment)
  for (const tool of [
    {
      identifier: 'banner_gen',
      name: 'バナー生成ツール',
      description: 'SNS広告・Webバナーのクリエイティブ生成',
      endpoint: 'http://localhost:3004',
      caps: { banner_design: true, ad_creative: true },
    },
    {
      identifier: 'sns_scheduler',
      name: 'SNSスケジューラー',
      description: 'SNS投稿の予約・配信管理',
      endpoint: 'http://localhost:3005',
      caps: { posting: true, scheduling: true, content_generation: true },
    },
    {
      identifier: 'report_gen',
      name: 'レポート生成ツール',
      description: '月次・週次の分析レポート自動生成',
      endpoint: 'http://localhost:3006',
      caps: { analytics: true, reporting: true },
    },
  ]) {
    await query(
      `INSERT INTO tools (identifier, name, description, endpoint_url, health_endpoint, capabilities, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'offline')
       ON CONFLICT (identifier) DO UPDATE
         SET name = EXCLUDED.name,
             description = EXCLUDED.description,
             endpoint_url = EXCLUDED.endpoint_url,
             health_endpoint = EXCLUDED.health_endpoint,
             capabilities = EXCLUDED.capabilities,
             updated_at = now()`,
      [
        tool.identifier,
        tool.name,
        tool.description,
        tool.endpoint,
        `${tool.endpoint}/health`,
        JSON.stringify(tool.caps),
      ],
    );
  }
  console.log('[seed] Sample tools upserted.');

  await pool.end();
  console.log('[seed] Seed complete.');
}

seed().catch((e) => {
  console.error('[seed] Error:', e);
  process.exit(1);
});
