import { Component, computed, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TimeSeriesPoint {
  ts: string;
  events: number;
  failed: number;
  delivered: number;
  dlq: number;
  attempts: number;
}

interface Point {
  x: number;
  y: number;
  raw: TimeSeriesPoint;
}

const VIEW_W = 800;
const VIEW_H = 240;
const PAD_LEFT = 40;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 32;

@Component({
  selector: 'app-time-series-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <div class="flex items-start justify-between mb-4">
        <div>
          <h2 class="text-lg font-semibold text-white">{{ title() }}</h2>
          <p class="text-xs text-muted mt-1">{{ subtitle() }}</p>
        </div>
        <div class="flex gap-3 text-xs">
          @for (series of legend(); track series.key) {
            <div class="flex items-center gap-1.5">
              <span class="inline-block w-2.5 h-2.5 rounded-full" [style.background]="series.color"></span>
              <span class="text-muted">{{ series.label }}</span>
            </div>
          }
        </div>
      </div>

      @if (points().length === 0) {
        <div class="text-sm text-muted py-12 text-center">No data in this range.</div>
      } @else {
        <div class="relative">
          <svg
            [attr.viewBox]="'0 0 ' + viewW + ' ' + viewH"
            class="w-full h-auto"
            preserveAspectRatio="none"
            (mouseleave)="hovered.set(null)"
          >
            <!-- Y-axis grid lines -->
            @for (tick of yTicks(); track tick.value) {
              <line
                [attr.x1]="padLeft"
                [attr.x2]="viewW - padRight"
                [attr.y1]="tick.y"
                [attr.y2]="tick.y"
                stroke="rgba(255,255,255,0.06)"
                stroke-width="1"
              />
              <text
                [attr.x]="padLeft - 6"
                [attr.y]="tick.y + 3"
                text-anchor="end"
                fill="#6B7280"
                font-size="10"
                font-family="ui-monospace, monospace"
              >{{ tick.value }}</text>
            }

            <!-- X-axis labels -->
            @for (tick of xTicks(); track tick.i) {
              <text
                [attr.x]="tick.x"
                [attr.y]="viewH - 8"
                text-anchor="middle"
                fill="#6B7280"
                font-size="10"
                font-family="ui-monospace, monospace"
              >{{ tick.label }}</text>
            }

            <!-- Series polylines -->
            @for (series of seriesList(); track series.key) {
              <polyline
                [attr.points]="series.points"
                fill="none"
                [attr.stroke]="series.color"
                stroke-width="2"
                stroke-linejoin="round"
                stroke-linecap="round"
              />
            }

            <!-- Hover dots -->
            @for (series of seriesList(); track series.key) {
              @for (pt of series.rawPoints; track pt.x) {
                <circle
                  [attr.cx]="pt.x"
                  [attr.cy]="pt.y"
                  [attr.r]="hovered()?.x === pt.x ? 4 : 2"
                  [attr.fill]="series.color"
                  (mouseenter)="hovered.set(pt)"
                />
              }
            }
          </svg>

          @if (hovered(); as h) {
            <div
              class="absolute pointer-events-none bg-surface-2 border border-hairline rounded px-2 py-1 text-xs text-white"
              [style.left.px]="hoverLeft()"
              [style.top.px]="hoverTop()"
            >
              <p class="font-mono text-[10px] text-muted">{{ h.raw.ts | date: 'short' }}</p>
              <p>Events: {{ h.raw.events }}</p>
              <p class="text-signal-green">Delivered: {{ h.raw.delivered }}</p>
              <p class="text-signal-rose">DLQ: {{ h.raw.dlq }}</p>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class TimeSeriesChartComponent {
  title = input<string>('Events over time');
  subtitle = input<string>('');
  data = input.required<TimeSeriesPoint[]>();

  readonly viewW = VIEW_W;
  readonly viewH = VIEW_H;
  readonly padLeft = PAD_LEFT;
  readonly padRight = PAD_RIGHT;

  hovered = signal<Point | null>(null);

  readonly legend = computed(() => [
    { key: 'events', label: 'Events', color: '#7C3AED' },
    { key: 'delivered', label: 'Delivered', color: '#10B981' },
    { key: 'dlq', label: 'DLQ', color: '#F43F5E' },
  ]);

  readonly points = computed(() => this.data());

  readonly maxValue = computed(() => {
    const d = this.points();
    if (d.length === 0) return 1;
    let m = 0;
    for (const p of d) {
      m = Math.max(m, p.events, p.delivered, p.dlq);
    }
    return m === 0 ? 1 : m;
  });

  private readonly innerW = VIEW_W - PAD_LEFT - PAD_RIGHT;
  private readonly innerH = VIEW_H - PAD_TOP - PAD_BOTTOM;

  readonly seriesList = computed(() => {
    const data = this.points();
    const max = this.maxValue();
    const n = Math.max(data.length - 1, 1);

    const make = (key: 'events' | 'delivered' | 'dlq', color: string) => {
      const rawPoints: Point[] = data.map((p, i) => ({
        x: PAD_LEFT + (i / n) * this.innerW,
        y: PAD_TOP + this.innerH - ((p[key] as number) / max) * this.innerH,
        raw: p,
      }));
      return {
        key,
        color,
        rawPoints,
        points: rawPoints.map((p) => `${p.x},${p.y}`).join(' '),
      };
    };

    return [
      make('events', '#7C3AED'),
      make('delivered', '#10B981'),
      make('dlq', '#F43F5E'),
    ];
  });

  readonly yTicks = computed(() => {
    const max = this.maxValue();
    const steps = 4;
    const out: Array<{ y: number; value: number }> = [];
    for (let i = 0; i <= steps; i++) {
      const value = Math.round((max / steps) * i);
      const y = PAD_TOP + this.innerH - (i / steps) * this.innerH;
      out.push({ y, value });
    }
    return out;
  });

  readonly xTicks = computed(() => {
    const data = this.points();
    if (data.length === 0) return [];
    const n = Math.max(data.length - 1, 1);
    const step = Math.max(1, Math.floor(data.length / 6));
    const out: Array<{ i: number; x: number; label: string }> = [];
    for (let i = 0; i < data.length; i += step) {
      const d = new Date(data[i]!.ts);
      const label = `${d.getHours().toString().padStart(2, '0')}:${d
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;
      out.push({
        i,
        x: PAD_LEFT + (i / n) * this.innerW,
        label,
      });
    }
    return out;
  });

  hoverLeft = computed(() => {
    const h = this.hovered();
    if (!h) return 0;
    return Math.min(h.x + 8, VIEW_W - 140);
  });

  hoverTop = computed(() => {
    const h = this.hovered();
    if (!h) return 0;
    return Math.max(h.y - 60, 0);
  });
}