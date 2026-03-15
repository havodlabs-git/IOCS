import { useMemo, useCallback, useState } from 'react';
import {
  Shield,
  AlertTriangle,
  Globe,
  User,
  TrendingUp,
  Activity,
  Hash,
  Link,
  Mail,
  Server,
  RefreshCw,
  Clock,
  FileDown,
} from 'lucide-react';
import type { IocRecord } from '@/app/services/api';
import { LOGO_WHITE_B64 } from '@/app/services/logoB64';

interface DashboardPageProps {
  iocs: IocRecord[];
  loading: boolean;
  onRefresh: () => void;
  customerName: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function severityNum(s: unknown): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function severityLabel(n: number): string {
  if (n >= 9) return 'Critical';
  if (n >= 7) return 'High';
  if (n >= 4) return 'Medium';
  if (n >= 1) return 'Low';
  return 'Info';
}

function severityBarColor(n: number): string {
  if (n >= 9) return 'bg-red-500';
  if (n >= 7) return 'bg-orange-500';
  if (n >= 4) return 'bg-yellow-400';
  if (n >= 1) return 'bg-blue-400';
  return 'bg-slate-300';
}

function severityHex(n: number): string {
  if (n >= 9) return '#ef4444';
  if (n >= 7) return '#f97316';
  if (n >= 4) return '#eab308';
  if (n >= 1) return '#60a5fa';
  return '#94a3b8';
}

function typeIcon(type: string) {
  switch (type?.toLowerCase()) {
    case 'ip':
    case 'ipv6':   return <Server className="w-4 h-4" />;
    case 'domain': return <Globe className="w-4 h-4" />;
    case 'url':    return <Link className="w-4 h-4" />;
    case 'email':  return <Mail className="w-4 h-4" />;
    case 'md5':
    case 'sha1':
    case 'sha256': return <Hash className="w-4 h-4" />;
    default:       return <Shield className="w-4 h-4" />;
  }
}

// ---------------------------------------------------------------------------
// PDF Export — gerado puramente com jsPDF (sem html2canvas)
// ---------------------------------------------------------------------------

type RGB = [number, number, number];

async function exportDashboardPDF(
  customerName: string,
  metrics: {
    total: number; customer: number; global: number;
    active: number; inactive: number;
    critical: number; high: number; medium: number; low: number; info: number;
    avgSev: string;
    topTypes: [string, number][];
    topTags: [string, number][];
    recent: IocRecord[];
    days: Record<string, number>;
  }
) {
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const H = 297;
  const M = 14; // margin
  const CW = W - M * 2; // content width

  // ── Paleta ──────────────────────────────────────────────────────────────────
  const DARK:   RGB = [15,  23,  42];
  const DARK2:  RGB = [30,  41,  59];
  const BLUE:   RGB = [37,  99,  235];
  const BLUE2:  RGB = [219, 234, 254];
  const RED:    RGB = [239, 68,  68];
  const RED2:   RGB = [254, 226, 226];
  const ORANGE: RGB = [249, 115, 22];
  const YELLOW: RGB = [234, 179, 8];
  const LBLUE:  RGB = [96,  165, 250];
  const SLATE:  RGB = [100, 116, 139];
  const SLATE2: RGB = [241, 245, 249];
  const WHITE:  RGB = [255, 255, 255];
  const GREEN:  RGB = [22,  163, 74];
  const GREEN2: RGB = [220, 252, 231];
  const PURPLE: RGB = [124, 58,  237];
  const PURPLE2:RGB = [237, 233, 254];
  const TEAL:   RGB = [20,  184, 166];
  const TEAL2:  RGB = [204, 251, 241];

  const sf = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const sd = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const sc = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);

  let y = 0;

  // ── Funções utilitárias ──────────────────────────────────────────────────────

  const newPageIfNeeded = (needed = 20) => {
    if (y + needed > H - 14) {
      doc.addPage();
      drawPageHeader();
      y = 30;
    }
  };

  const drawPageHeader = () => {
    sf(DARK); doc.rect(0, 0, W, 26, 'F');
    sf(BLUE);  doc.rect(0, 26, W, 1.5, 'F');
    // Logo branco (PNG com fundo transparente sobre fundo escuro)
    try {
      doc.addImage(LOGO_WHITE_B64, 'PNG', M, 4, 22, 0); // altura auto
    } catch (_) { /* fallback silencioso */ }
    // Texto à direita do logo
    sc(WHITE);
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text('CWO - IOC Manager', M + 26, 11);
    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text('Dashboard Report', M + 26, 18);
    const dt = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    sc([148, 163, 184] as RGB);
    doc.text(`${customerName}`, W - M, 11, { align: 'right' });
    doc.text(dt, W - M, 18, { align: 'right' });
  };

  const drawFooter = (page: number, total: number) => {
    sf(DARK); doc.rect(0, H - 10, W, 10, 'F');
    sc(SLATE);
    doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
    doc.text('CWO - IOC Manager  |  Documento Confidencial', M, H - 3.5);
    doc.text(`Página ${page} de ${total}`, W - M, H - 3.5, { align: 'right' });
  };

  // Desenha um card de métrica
  const metricCard = (
    x: number, cy: number, w: number, h: number,
    label: string, value: string | number, sub: string,
    accent: RGB, bg: RGB
  ) => {
    sf(bg); sd(bg);
    doc.roundedRect(x, cy, w, h, 2, 2, 'FD');
    sf(accent);
    doc.roundedRect(x, cy, 3.5, h, 1, 1, 'F');
    sc(accent);
    doc.setFontSize(20); doc.setFont('helvetica', 'bold');
    doc.text(String(value), x + 7, cy + 13);
    sc(DARK);
    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
    doc.text(label.toUpperCase(), x + 7, cy + 20);
    sc(SLATE);
    doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
    doc.text(sub, x + 7, cy + 26);
  };

  // Desenha uma barra horizontal com label e valor
  const horizBar = (
    x: number, cy: number, w: number, h: number,
    label: string, value: number, maxVal: number, color: RGB
  ) => {
    const pct = maxVal > 0 ? value / maxVal : 0;
    const barW = pct * (w - 48);
    sf(SLATE2); sd(SLATE2);
    doc.roundedRect(x + 28, cy, w - 48, h, h / 2, h / 2, 'FD');
    if (barW > 0) {
      sf(color);
      doc.roundedRect(x + 28, cy, barW, h, h / 2, h / 2, 'F');
    }
    sc(DARK);
    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text(label, x, cy + h - 1.5);
    doc.setFont('helvetica', 'bold');
    doc.text(String(value), x + w, cy + h - 1.5, { align: 'right' });
  };

  // Desenha um mini donut (SVG-like com arcos)
  const donutSegment = (
    cx: number, cy: number, r: number,
    startAngle: number, endAngle: number,
    color: RGB, strokeW: number
  ) => {
    // Aproxima o arco com uma polyline
    const steps = Math.max(2, Math.round(Math.abs(endAngle - startAngle) / 5));
    const pts: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const a = (startAngle + (endAngle - startAngle) * (i / steps)) * (Math.PI / 180);
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    sd(color);
    doc.setLineWidth(strokeW);
    doc.lines(
      pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]] as [number, number]),
      pts[0][0], pts[0][1]
    );
  };

  // ── Página 1 ─────────────────────────────────────────────────────────────────
  drawPageHeader();
  y = 32;

  // ── Seção: Métricas Gerais ───────────────────────────────────────────────────
  sc(DARK); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
  doc.text('Métricas Gerais', M, y); y += 4;

  const cw4 = (CW - 9) / 4;
  metricCard(M,              y, cw4, 30, 'Total de IOCs',   metrics.total,                    `${metrics.active} ativos`,                    BLUE,   BLUE2);
  metricCard(M + cw4 + 3,    y, cw4, 30, 'Críticos / High', metrics.critical + metrics.high,  `${metrics.critical} críticos, ${metrics.high} altos`, RED,    RED2);
  metricCard(M + (cw4+3)*2,  y, cw4, 30, 'Meus IOCs',       metrics.customer,                 'escopo privado',                              PURPLE, PURPLE2);
  metricCard(M + (cw4+3)*3,  y, cw4, 30, 'IOCs Globais',    metrics.global,                   'compartilhados',                              TEAL,   TEAL2);
  y += 36;

  // ── Seção: Distribuição por Severidade ──────────────────────────────────────
  // Calcula altura dinâmica do card baseada no número de itens da legenda
  const sevData = [
    { label: 'Critical (9-10)', value: metrics.critical, color: RED },
    { label: 'High (7-8)',      value: metrics.high,     color: ORANGE },
    { label: 'Medium (4-6)',    value: metrics.medium,   color: YELLOW },
    { label: 'Low (1-3)',       value: metrics.low,      color: LBLUE },
    { label: 'Info (0)',        value: metrics.info,     color: SLATE },
  ].filter(s => s.value > 0);
  const sevTotal = sevData.reduce((s, d) => s + d.value, 0) || 1;

  // donutR=18, donutSW=8 → raio externo efetivo = 18 + 4 = 22mm
  // O donut precisa de: topo do card (10) + raio_externo (22) acima do centro
  //                     + raio_externo (22) abaixo do centro + margem (8) + rodapé (10)
  const donutR  = 18;
  const donutSW = 8;
  const donutHalfExt = donutR + donutSW / 2 + 1; // margem de segurança
  const legendItemH = 10;
  const legendTotalH = sevData.length * legendItemH;
  // Altura mínima para o donut caber: título(10) + donutHalfExt*2 + margem(8) + rodapé(10)
  const minCardH = 10 + donutHalfExt * 2 + 8 + 10;
  // Altura mínima para a legenda caber: título(10) + legenda + margem(4) + rodapé(10)
  const legendCardH = 10 + 4 + legendTotalH + 4 + 10;
  const sevCardH = Math.max(minCardH, legendCardH);

  newPageIfNeeded(sevCardH + 8);
  sf(SLATE2); sd(SLATE2);
  doc.roundedRect(M, y, CW, sevCardH, 2, 2, 'FD');
  sc(DARK); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
  doc.text('Distribuição por Severidade', M + 4, y + 7);

  // Centro do donut: verticalmente centralizado na área disponível (abaixo do título, acima do rodapé)
  const donutAreaTop = y + 12;
  const donutAreaBot = y + sevCardH - 10;
  const donutCX = M + 4 + donutHalfExt;
  const donutCY = (donutAreaTop + donutAreaBot) / 2;

  sd([226, 232, 240] as RGB); doc.setLineWidth(donutSW);
  donutSegment(donutCX, donutCY, donutR, -90, 270, [226, 232, 240] as RGB, donutSW);
  let angle = -90;
  sevData.forEach(seg => {
    const sweep = (seg.value / sevTotal) * 360;
    donutSegment(donutCX, donutCY, donutR, angle, angle + sweep, seg.color, donutSW);
    angle += sweep;
  });
  doc.setLineWidth(0.1);
  sc(DARK); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text(String(sevTotal), donutCX, donutCY + 4, { align: 'center' });
  sc(SLATE); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
  doc.text('total', donutCX, donutCY + 9, { align: 'center' });

  // Legenda alinhada na metade direita
  const lx = M + 4 + donutHalfExt * 2 + 8;
  const legendW = CW - (lx - M) - 4;
  let ly = y + 14;
  sevData.forEach(seg => {
    const pct = ((seg.value / sevTotal) * 100).toFixed(1);
    sf(seg.color); sd(seg.color);
    doc.circle(lx + 2.5, ly + 1.5, 2.5, 'F');
    sc(DARK); doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
    doc.text(seg.label, lx + 8, ly + 3);
    sc(SLATE); doc.setFont('helvetica', 'bold');
    doc.text(`${seg.value}  (${pct}%)`, lx + legendW, ly + 3, { align: 'right' });
    const pbY = ly + 5;
    sf([226, 232, 240] as RGB); sd([226, 232, 240] as RGB);
    doc.roundedRect(lx + 8, pbY, legendW - 8, 2, 1, 1, 'FD');
    if (seg.value > 0) {
      sf(seg.color);
      doc.roundedRect(lx + 8, pbY, (seg.value / sevTotal) * (legendW - 8), 2, 1, 1, 'F');
    }
    ly += legendItemH;
  });

  // Severidade média — rodapé do card
  const sevBoxY = y + sevCardH - 8;
  sf([215, 225, 235] as RGB); sd([215, 225, 235] as RGB);
  doc.roundedRect(M + 2, sevBoxY, CW - 4, 6, 1, 1, 'FD');
  sc(SLATE); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
  doc.text('Severidade média', M + 5, sevBoxY + 4.5);
  sc(DARK); doc.setFont('helvetica', 'bold');
  doc.text(`${metrics.avgSev} / 10`, M + CW - 5, sevBoxY + 4.5, { align: 'right' });
  y += sevCardH + 6;

  // ── Seção: IOCs por Tipo ─────────────────────────────────────────────────────
  const typeColorMap: Record<string, RGB> = {
    ip:     [59,  130, 246],
    ipv6:   [99,  102, 241],
    domain: [139, 92,  246],
    url:    [236, 72,  153],
    email:  [245, 158, 11],
    md5:    [16,  185, 129],
    sha1:   [20,  184, 166],
    sha256: [6,   182, 212],
  };
  const fallback: RGB[] = [[59,130,246],[99,102,241],[139,92,246],[236,72,153],[245,158,11],[16,185,129]];

  if (metrics.topTypes.length > 0) {
    const cardH = 12 + metrics.topTypes.slice(0, 6).length * 10 + 4;
    newPageIfNeeded(cardH + 8);
    sf(SLATE2); sd(SLATE2);
    doc.roundedRect(M, y, CW, cardH, 2, 2, 'FD');
    sc(DARK); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('IOCs por Tipo', M + 4, y + 7);
    const maxType = Math.max(...metrics.topTypes.map(([,v]) => v), 1);
    let ty = y + 12;
    metrics.topTypes.slice(0, 6).forEach(([type, count], i) => {
      const color = typeColorMap[type] ?? fallback[i % fallback.length];
      const labelW = 28;
      const valW = 10;
      const barAreaW = CW - 8 - labelW - valW - 4;
      const barFill = (count / maxType) * barAreaW;
      // Label tipo
      sc(DARK); doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
      doc.text(type, M + 4, ty + 4);
      // Trilho da barra
      sf([226, 232, 240] as RGB); sd([226, 232, 240] as RGB);
      doc.roundedRect(M + 4 + labelW, ty, barAreaW, 5, 2, 2, 'FD');
      // Barra preenchida
      if (barFill > 0) {
        sf(color);
        doc.roundedRect(M + 4 + labelW, ty, barFill, 5, 2, 2, 'F');
      }
      // Valor
      sc(DARK); doc.setFont('helvetica', 'bold');
      doc.text(String(count), M + CW - 4, ty + 4, { align: 'right' });
      ty += 10;
    });
    y += cardH + 6;
  };

  // ── Seção: Status ──────────────────────────────────────────────────────────
  newPageIfNeeded(36);
  const halfW = (CW - 6) / 2;

  // Card Ativos
  sf(GREEN2); sd(GREEN2);
  doc.roundedRect(M, y, halfW, 22, 2, 2, 'FD');
  sf(GREEN); doc.roundedRect(M, y, 3.5, 22, 1, 1, 'F');
  sc(GREEN); doc.setFontSize(20); doc.setFont('helvetica', 'bold');
  doc.text(String(metrics.active), M + halfW / 2, y + 13, { align: 'center' });
  sc([21, 128, 61] as RGB); doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
  doc.text('Ativos', M + halfW / 2, y + 19, { align: 'center' });

  // Card Inativos
  sf(SLATE2); sd(SLATE2);
  doc.roundedRect(M + halfW + 6, y, halfW, 22, 2, 2, 'FD');
  sf(SLATE); doc.roundedRect(M + halfW + 6, y, 3.5, 22, 1, 1, 'F');
  sc(SLATE); doc.setFontSize(20); doc.setFont('helvetica', 'bold');
  doc.text(String(metrics.inactive), M + halfW + 6 + halfW / 2, y + 13, { align: 'center' });
  sc(SLATE); doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
  doc.text('Inativos', M + halfW + 6 + halfW / 2, y + 19, { align: 'center' });
  y += 28;

  // ── Seção: Top Tags ──────────────────────────────────────────────────────────
  if (metrics.topTags.length > 0) {
    newPageIfNeeded(24);
    sc(DARK); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('Top Tags', M, y); y += 5;

    let tx = M;
    metrics.topTags.forEach(([tag, count]) => {
      const label = `${tag} (${count})`;
      doc.setFontSize(7); doc.setFont('helvetica', 'normal');
      const tw = doc.getTextWidth(label) + 6;
      if (tx + tw > W - M) { tx = M; y += 8; }
      sf(BLUE2); sd(BLUE2);
      doc.roundedRect(tx, y - 4, tw, 7, 2, 2, 'FD');
      sc(BLUE); doc.text(label, tx + 3, y + 1);
      tx += tw + 3;
    });
    y += 12;
  }

  // ── Seção: Atividade — Últimos 7 dias ───────────────────────────────────────
  newPageIfNeeded(52);
  const actCardH = 48;
  sf(SLATE2); sd(SLATE2);
  doc.roundedRect(M, y, CW, actCardH, 2, 2, 'FD');
  sc(DARK); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
  doc.text('Atividade — Últimos 7 dias', M + 4, y + 7);

  const dayEntries = Object.entries(metrics.days);
  const maxDay = Math.max(...dayEntries.map(([, v]) => v), 1);
  const chartPad = 6;
  const chartAreaW = CW - chartPad * 2;
  const barGap = 3;
  const barW2 = (chartAreaW - barGap * (dayEntries.length - 1)) / dayEntries.length;
  const chartH = 26;
  const chartTopY = y + 13;
  const chartBaseY = chartTopY + chartH;

  dayEntries.forEach(([day, count], i) => {
    const bh = maxDay > 0 ? (count / maxDay) * chartH : 0;
    const bx = M + chartPad + i * (barW2 + barGap);
    // Trilho de fundo
    sf([215, 225, 235] as RGB); sd([215, 225, 235] as RGB);
    doc.roundedRect(bx, chartTopY, barW2, chartH, 1, 1, 'FD');
    // Barra preenchida
    if (bh > 0) {
      sf(BLUE);
      doc.roundedRect(bx, chartBaseY - bh, barW2, bh, 1, 1, 'F');
    }
    // Valor acima da barra
    if (count > 0) {
      sc(DARK); doc.setFontSize(5.5); doc.setFont('helvetica', 'bold');
      doc.text(String(count), bx + barW2 / 2, chartBaseY - bh - 1.5, { align: 'center' });
    }
    // Label dia abaixo
    sc(SLATE); doc.setFontSize(5.5); doc.setFont('helvetica', 'normal');
    doc.text(day, bx + barW2 / 2, chartBaseY + 5, { align: 'center' });
  });
  y += actCardH + 6;

  // ── Seção: IOCs Recentes ─────────────────────────────────────────────────────
  if (metrics.recent.length > 0) {
    newPageIfNeeded(10 + metrics.recent.length * 8 + 10);
    sc(DARK); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('IOCs Recentes', M, y); y += 4;

    // Cabeçalho da tabela
    sf(DARK2); doc.rect(M, y, CW, 7, 'F');
    sc(WHITE); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
    doc.text('Valor',       M + 2,        y + 5);
    doc.text('Tipo',        M + 82,       y + 5);
    doc.text('Severidade',  M + 108,      y + 5);
    doc.text('Status',      M + 138,      y + 5);
    doc.text('Data',        M + CW - 2,   y + 5, { align: 'right' });
    y += 7;

    metrics.recent.forEach((ioc, i) => {
      const sev = severityNum(ioc.severity);
      const sevRGB: RGB = sev >= 9 ? RED : sev >= 7 ? ORANGE : sev >= 4 ? YELLOW : sev >= 1 ? LBLUE : SLATE;
      sf(i % 2 === 0 ? WHITE : SLATE2); sd(i % 2 === 0 ? WHITE : SLATE2);
      doc.rect(M, y, CW, 7, 'FD');

      sc(DARK); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
      const val = ioc.value.length > 40 ? ioc.value.slice(0, 37) + '…' : ioc.value;
      doc.text(val, M + 2, y + 4.8);
      doc.text(ioc.type ?? '—', M + 82, y + 4.8);

      // Badge de severidade
      sf(sevRGB);
      doc.roundedRect(M + 106, y + 1, 28, 5, 1, 1, 'F');
      sc(WHITE); doc.setFont('helvetica', 'bold');
      doc.text(`${severityLabel(sev)} (${sev})`, M + 120, y + 4.8, { align: 'center' });

      sc(ioc.status === 'active' ? GREEN : SLATE);
      doc.setFont('helvetica', 'normal');
      doc.text(ioc.status ?? '—', M + 138, y + 4.8);

      sc(SLATE);
      doc.text(
        new Date(ioc.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }),
        M + CW - 2, y + 4.8, { align: 'right' }
      );
      y += 7;
    });
  }

  // ── Footers em todas as páginas ──────────────────────────────────────────────
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawFooter(p, total);
  }

  doc.save(`cwo-dashboard-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color: string;
  trend?: string;
}

function StatCard({ label, value, sub, icon, color, trend }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex items-start gap-4">
      <div className={`p-3 rounded-xl ${color} flex-shrink-0`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-slate-800 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5 truncate">{sub}</p>}
        {trend && (
          <p className="text-xs text-green-600 font-medium mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />{trend}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mini bar chart
// ---------------------------------------------------------------------------

function BarChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="text-xs text-slate-500 w-16 flex-shrink-0 truncate">{d.label}</span>
          <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(d.value / max) * 100}%`, backgroundColor: d.color }} />
          </div>
          <span className="text-xs font-semibold text-slate-700 w-6 text-right">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Donut ring
// ---------------------------------------------------------------------------

function RingChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, d) => s + d.value, 0) || 1;
  let offset = 0;
  const r = 40;
  const circ = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-6">
      <svg width="100" height="100" viewBox="0 0 100 100" className="flex-shrink-0">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#f1f5f9" strokeWidth="14" />
        {segments.map((seg, i) => {
          const pct = seg.value / total;
          const dash = pct * circ;
          const gap = circ - dash;
          const rotate = offset * 360 - 90;
          offset += pct;
          return (
            <circle key={i} cx="50" cy="50" r={r} fill="none" stroke={seg.color}
              strokeWidth="14" strokeDasharray={`${dash} ${gap}`} strokeDashoffset={0}
              transform={`rotate(${rotate} 50 50)`} />
          );
        })}
        <text x="50" y="54" textAnchor="middle" fontSize="14" fontWeight="700" fill="#1e293b">{total}</text>
      </svg>
      <div className="space-y-1.5 flex-1">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-xs text-slate-600 flex-1">{seg.label}</span>
            <span className="text-xs font-semibold text-slate-700">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export function DashboardPage({ iocs, loading, onRefresh, customerName }: DashboardPageProps) {
  const metrics = useMemo(() => {
    const total    = iocs.length;
    const customer = iocs.filter((i) => i.scope === 'CUSTOMER').length;
    const global   = iocs.filter((i) => i.scope === 'GLOBAL').length;
    const active   = iocs.filter((i) => i.status === 'active').length;
    const inactive = iocs.filter((i) => i.status === 'inactive').length;
    const critical = iocs.filter((i) => severityNum(i.severity) >= 9).length;
    const high     = iocs.filter((i) => severityNum(i.severity) >= 7 && severityNum(i.severity) < 9).length;
    const medium   = iocs.filter((i) => severityNum(i.severity) >= 4 && severityNum(i.severity) < 7).length;
    const low      = iocs.filter((i) => severityNum(i.severity) >= 1 && severityNum(i.severity) < 4).length;
    const info     = iocs.filter((i) => severityNum(i.severity) < 1).length;
    const avgSev   = total > 0 ? (iocs.reduce((s, i) => s + severityNum(i.severity), 0) / total).toFixed(1) : '—';
    const typeCounts: Record<string, number> = {};
    iocs.forEach((i) => { typeCounts[i.type] = (typeCounts[i.type] ?? 0) + 1; });
    const topTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const tagCounts: Record<string, number> = {};
    iocs.forEach((i) => (i.tags ?? []).forEach((t) => { tagCounts[t] = (tagCounts[t] ?? 0) + 1; }));
    const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const recent = [...iocs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
    const now = Date.now();
    const days: Record<string, number> = {};
    for (let d = 6; d >= 0; d--) {
      const date = new Date(now - d * 86400000);
      days[date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })] = 0;
    }
    iocs.forEach((i) => {
      const d = new Date(i.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (d in days) days[d]++;
    });
    return { total, customer, global, active, inactive, critical, high, medium, low, info, avgSev, topTypes, topTags, recent, days };
  }, [iocs]);

  const typeColorMap: Record<string, string> = {
    ip: '#3b82f6', ipv6: '#6366f1', domain: '#8b5cf6', url: '#ec4899',
    email: '#f59e0b', md5: '#10b981', sha1: '#14b8a6', sha256: '#06b6d4',
  };
  const fallbackColors = ['#3b82f6','#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981'];

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  })();

  const [exporting, setExporting] = useState(false);

  const handleExportPDF = useCallback(async () => {
    setExporting(true);
    try {
      await exportDashboardPDF(customerName, metrics);
    } finally {
      setExporting(false);
    }
  }, [customerName, metrics]);

  return (
    <div className="space-y-6">
      {/* Welcome + actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{greeting}, {customerName}!</h1>
          <p className="text-sm text-slate-500 mt-0.5">Aqui está o resumo da sua base de IOCs.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            disabled={loading || exporting || iocs.length === 0}
            title="Exportar Dashboard em PDF"
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors border border-slate-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileDown className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
            {exporting ? 'Gerando PDF...' : 'Exportar PDF'}
          </button>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-slate-200 bg-white"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total de IOCs" value={metrics.total} sub={`${metrics.active} ativos`}
          icon={<Shield className="w-5 h-5 text-blue-600" />} color="bg-blue-50" />
        <StatCard label="Críticos / High" value={metrics.critical + metrics.high}
          sub={`${metrics.critical} críticos, ${metrics.high} altos`}
          icon={<AlertTriangle className="w-5 h-5 text-red-600" />} color="bg-red-50" />
        <StatCard label="Meus IOCs" value={metrics.customer} sub="escopo privado"
          icon={<User className="w-5 h-5 text-purple-600" />} color="bg-purple-50" />
        <StatCard label="IOCs Globais" value={metrics.global} sub="compartilhados"
          icon={<Globe className="w-5 h-5 text-teal-600" />} color="bg-teal-50" />
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Severity */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-400" />Distribuição por Severidade
          </h3>
          <RingChart segments={[
            { label: 'Critical (9-10)', value: metrics.critical, color: '#ef4444' },
            { label: 'High (7-8)',      value: metrics.high,     color: '#f97316' },
            { label: 'Medium (4-6)',    value: metrics.medium,   color: '#eab308' },
            { label: 'Low (1-3)',       value: metrics.low,      color: '#60a5fa' },
            { label: 'Info (0)',        value: metrics.info,     color: '#94a3b8' },
          ].filter((s) => s.value > 0)} />
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between text-xs text-slate-500">
            <span>Severidade média</span>
            <span className="font-bold text-slate-700">{metrics.avgSev} / 10</span>
          </div>
        </div>

        {/* Types */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Hash className="w-4 h-4 text-slate-400" />IOCs por Tipo
          </h3>
          {metrics.topTypes.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Sem dados</p>
          ) : (
            <BarChart data={metrics.topTypes.map(([label, value], i) => ({
              label, value,
              color: typeColorMap[label] ?? fallbackColors[i % fallbackColors.length],
            }))} />
          )}
          {metrics.topTypes.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {metrics.topTypes.map(([type, count]) => (
                <span key={type} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
                  {typeIcon(type)}{type}: {count}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Status + Tags */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-400" />Status
            </h3>
            <div className="flex gap-3">
              <div className="flex-1 bg-green-50 border border-green-100 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{metrics.active}</p>
                <p className="text-xs text-green-600 mt-0.5">Ativos</p>
              </div>
              <div className="flex-1 bg-slate-50 border border-slate-100 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-slate-500">{metrics.inactive}</p>
                <p className="text-xs text-slate-400 mt-0.5">Inativos</p>
              </div>
            </div>
          </div>
          {metrics.topTags.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Top Tags</h3>
              <div className="flex flex-wrap gap-1.5">
                {metrics.topTags.map(([tag, count]) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-100">
                    {tag}<span className="bg-blue-200 text-blue-800 rounded-full px-1 font-bold">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-slate-400" />Atividade — Últimos 7 dias
          </h3>
          {Object.values(metrics.days).every((v) => v === 0) ? (
            <p className="text-sm text-slate-400 text-center py-6">Nenhum IOC adicionado nos últimos 7 dias</p>
          ) : (
            <div className="flex items-end gap-2 h-24">
              {Object.entries(metrics.days).map(([day, count]) => {
                const maxVal = Math.max(...Object.values(metrics.days), 1);
                const pct = (count / maxVal) * 100;
                return (
                  <div key={day} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-semibold text-slate-600">{count > 0 ? count : ''}</span>
                    <div className="w-full bg-slate-100 rounded-t-sm overflow-hidden" style={{ height: '64px' }}>
                      <div className="w-full bg-blue-500 rounded-t-sm transition-all duration-500"
                        style={{ height: `${pct}%`, marginTop: `${100 - pct}%` }} />
                    </div>
                    <span className="text-xs text-slate-400">{day}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent IOCs */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />IOCs Recentes
          </h3>
          {metrics.recent.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Nenhum IOC cadastrado</p>
          ) : (
            <div className="space-y-2">
              {metrics.recent.map((ioc) => {
                const sev = severityNum(ioc.severity);
                return (
                  <div key={ioc.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: severityHex(sev) }} />
                    <div className="flex-1 min-w-0">
                      <code className="text-xs text-slate-800 font-mono truncate block">{ioc.value}</code>
                      <p className="text-xs text-slate-400 mt-0.5">{ioc.type} · {severityLabel(sev)}</p>
                    </div>
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      {new Date(ioc.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
