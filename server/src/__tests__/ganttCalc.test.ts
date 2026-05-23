import { describe, it, expect } from 'vitest';
import { addDays, differenceInDays, parseISO, format } from 'date-fns';

// ── Pure functions extracted from GanttChart logic ─────────────
// (mirror the exact logic from client/src/components/gantt/GanttChart.tsx)

const DAY_WIDTH_PX = 28;

function fmt(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function computeMoveDates(
  originalStart: Date,
  originalDue: Date,
  deltaPx: number,
  zoom: number,
): { newStart: string; newDue: string } {
  const dayWidth = DAY_WIDTH_PX * zoom;
  const deltaDays = Math.round(deltaPx / dayWidth);
  return {
    newStart: fmt(addDays(originalStart, deltaDays)),
    newDue: fmt(addDays(originalDue, deltaDays)),
  };
}

function computeResizeEndDue(
  originalStart: Date,
  originalDue: Date,
  deltaPx: number,
  zoom: number,
): string {
  const dayWidth = DAY_WIDTH_PX * zoom;
  const deltaDays = Math.round(deltaPx / dayWidth);
  const minDue = addDays(originalStart, 1);
  let nd = addDays(originalDue, deltaDays);
  if (nd < minDue) nd = minDue;
  return fmt(nd);
}

function computeBarPosition(
  taskStart: Date,
  taskDue: Date,
  timelineStart: Date,
  zoom: number,
): { xStart: number; width: number } {
  const dayWidth = DAY_WIDTH_PX * zoom;
  const xStart = differenceInDays(taskStart, timelineStart) * dayWidth;
  const xEnd = differenceInDays(taskDue, timelineStart) * dayWidth;
  return {
    xStart,
    width: Math.max(dayWidth, xEnd - xStart),
  };
}

function detectDragMode(localX: number, barWidth: number): 'move' | 'resize-end' {
  const EDGE_ZONE_RATIO = 0.2;
  return localX / barWidth > 1 - EDGE_ZONE_RATIO ? 'resize-end' : 'move';
}

// ── Tests ──────────────────────────────────────────────────────

describe('Gantt date calculations', () => {
  const start = parseISO('2026-05-01');
  const due = parseISO('2026-05-10'); // 9-day task

  describe('computeMoveDates', () => {
    it('shifts both dates forward by the correct number of days', () => {
      // at zoom=1, dayWidth=28px; 56px = exactly 2 days
      const result = computeMoveDates(start, due, 56, 1);
      expect(result.newStart).toBe('2026-05-03');
      expect(result.newDue).toBe('2026-05-12');
    });

    it('shifts both dates backward for negative deltaPx', () => {
      const result = computeMoveDates(start, due, -28, 1);
      expect(result.newStart).toBe('2026-04-30');
      expect(result.newDue).toBe('2026-05-09');
    });

    it('rounds partial pixels to nearest day', () => {
      // 13px < 14px (half a day), rounds down to 0 days
      const result = computeMoveDates(start, due, 13, 1);
      expect(result.newStart).toBe('2026-05-01');
      expect(result.newDue).toBe('2026-05-10');
    });

    it('rounds up when pixel exceeds half-day threshold', () => {
      // 15px > 14px (half a day), rounds up to 1 day
      const result = computeMoveDates(start, due, 15, 1);
      expect(result.newStart).toBe('2026-05-02');
      expect(result.newDue).toBe('2026-05-11');
    });

    it('scales correctly with zoom factor', () => {
      // at zoom=2, dayWidth=56px; 112px = 2 days
      const result = computeMoveDates(start, due, 112, 2);
      expect(result.newStart).toBe('2026-05-03');
      expect(result.newDue).toBe('2026-05-12');
    });

    it('produces zero delta when pixel delta is 0', () => {
      const result = computeMoveDates(start, due, 0, 1);
      expect(result.newStart).toBe('2026-05-01');
      expect(result.newDue).toBe('2026-05-10');
    });
  });

  describe('computeResizeEndDue', () => {
    it('extends due date by the correct number of days', () => {
      const result = computeResizeEndDue(start, due, 28, 1);
      expect(result).toBe('2026-05-11');
    });

    it('shrinks due date when moving left', () => {
      const result = computeResizeEndDue(start, due, -56, 1);
      expect(result).toBe('2026-05-08');
    });

    it('enforces minimum 1-day duration', () => {
      // Move due so far left it would go before start
      const singleDay = parseISO('2026-05-02');
      const result = computeResizeEndDue(start, singleDay, -10 * 28, 1);
      expect(result).toBe('2026-05-02'); // minimum: start + 1 day
    });

    it('exactly at minimum boundary returns start+1', () => {
      // Move due to start position — should clamp to start+1
      const closeDue = parseISO('2026-05-03');
      const result = computeResizeEndDue(start, closeDue, -5 * 28, 1);
      expect(result).toBe('2026-05-02');
    });
  });

  describe('computeBarPosition', () => {
    const timeline = parseISO('2026-04-01');

    it('calculates correct pixel offset from timeline start', () => {
      // May 1 is 30 days from Apr 1 → 30 * 28 = 840px
      const pos = computeBarPosition(start, due, timeline, 1);
      expect(pos.xStart).toBe(30 * 28);
    });

    it('calculates correct bar width for multi-day task', () => {
      // 9-day task → 9 * 28 = 252px
      const pos = computeBarPosition(start, due, timeline, 1);
      expect(pos.width).toBe(9 * 28);
    });

    it('enforces minimum bar width of one dayWidth', () => {
      // zero-width task (start == due) → width clamped to dayWidth
      const pos = computeBarPosition(start, start, timeline, 1);
      expect(pos.width).toBe(28);
    });

    it('scales correctly with zoom factor 2x', () => {
      const pos = computeBarPosition(start, due, timeline, 2);
      expect(pos.xStart).toBe(30 * 56);
      expect(pos.width).toBe(9 * 56);
    });

    it('handles negative offset for tasks before timeline start', () => {
      const beforeTimeline = parseISO('2026-03-25'); // 7 days before Apr 1
      const pos = computeBarPosition(beforeTimeline, start, timeline, 1);
      expect(pos.xStart).toBe(-7 * 28);
    });
  });

  describe('detectDragMode', () => {
    it('returns "move" when click is in the center area', () => {
      // 100px wide bar, click at 50px → 50/100 = 0.5 < 0.8 → move
      expect(detectDragMode(50, 100)).toBe('move');
    });

    it('returns "resize-end" when click is in right 20% zone', () => {
      // 100px wide bar, click at 85px → 85/100 = 0.85 > 0.8 → resize-end
      expect(detectDragMode(85, 100)).toBe('resize-end');
    });

    it('returns "move" at exactly the boundary (not strictly greater)', () => {
      // 80/100 = 0.8 — not > 0.8, so "move"
      expect(detectDragMode(80, 100)).toBe('move');
    });

    it('returns "resize-end" just past the boundary', () => {
      // 81/100 = 0.81 > 0.8
      expect(detectDragMode(81, 100)).toBe('resize-end');
    });

    it('handles small bar widths correctly', () => {
      // 30px bar, click at 28px → 28/30 ≈ 0.933 > 0.8 → resize-end
      expect(detectDragMode(28, 30)).toBe('resize-end');
    });
  });
});

describe('date-fns utilities used in Gantt', () => {
  it('differenceInDays returns positive when end is after start', () => {
    const d1 = parseISO('2026-05-01');
    const d2 = parseISO('2026-05-10');
    expect(differenceInDays(d2, d1)).toBe(9);
  });

  it('addDays wraps month boundaries correctly', () => {
    const d = parseISO('2026-01-29');
    expect(fmt(addDays(d, 3))).toBe('2026-02-01');
  });

  it('parseISO handles ISO date string correctly', () => {
    const d = parseISO('2026-05-23T00:00:00.000Z');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(4); // 0-indexed
    expect(d.getDate()).toBe(23);
  });
});
