// BigWealth UI Generator — Figma plugin
// Generates color/text styles + mobile screen frames from the design spec.
// Run via Plugins → Development → BigWealth UI Generator.

// ----------------------------------------------------------------------------
// Tokens (mirror src/index.css and docs/DESIGN_SPEC.md)
// ----------------------------------------------------------------------------
var C = {
  brand50: '#ecfdf5',
  brand100: '#d1fae5',
  brand500: '#10b981',
  brand600: '#059669',
  brand700: '#047857',
  brand800: '#065f46',
  gold400: '#fbbf24',
  gold500: '#f59e0b',
  gain: '#059669',
  loss: '#e11d48',
  warn: '#f59e0b',
  ink: '#0f172a',
  muted: '#64748b',
  line: '#e2e8f0',
  surface: '#ffffff',
  canvas: '#f1f5f9',
  rose50: '#fff1f2',
  amber50: '#fffbeb',
  white: '#ffffff',
  // chart categorical
  cSet: '#059669',
  cUs: '#6366f1',
  cFund: '#0ea5e9',
  cCrypto: '#f59e0b',
  cGold: '#fbbf24',
  cCash: '#94a3b8',
}

var FONTS = [
  { family: 'Inter', style: 'Regular' },
  { family: 'Inter', style: 'Medium' },
  { family: 'Inter', style: 'Semi Bold' },
  { family: 'Inter', style: 'Bold' },
]

var SCREEN_W = 390
var GAP_BETWEEN_SCREENS = 60

// ----------------------------------------------------------------------------
// Color / paint helpers
// ----------------------------------------------------------------------------
function hexToRgb(hex) {
  var h = hex.replace('#', '')
  return {
    r: parseInt(h.substring(0, 2), 16) / 255,
    g: parseInt(h.substring(2, 4), 16) / 255,
    b: parseInt(h.substring(4, 6), 16) / 255,
  }
}
function solid(hex, opacity) {
  return { type: 'SOLID', color: hexToRgb(hex), opacity: opacity == null ? 1 : opacity }
}
function cardShadow() {
  return [
    {
      type: 'DROP_SHADOW',
      color: { r: 0.06, g: 0.09, b: 0.16, a: 0.08 },
      offset: { x: 0, y: 4 },
      radius: 16,
      spread: 0,
      visible: true,
      blendMode: 'NORMAL',
    },
  ]
}

// ----------------------------------------------------------------------------
// Layout helpers
// ----------------------------------------------------------------------------
function col(opts) {
  opts = opts || {}
  var f = figma.createFrame()
  f.layoutMode = 'VERTICAL'
  f.primaryAxisSizingMode = opts.height ? 'FIXED' : 'AUTO'
  f.counterAxisSizingMode = opts.width ? 'FIXED' : 'AUTO'
  if (opts.width) f.resize(opts.width, f.height)
  if (opts.height) f.resize(f.width, opts.height)
  f.itemSpacing = opts.gap == null ? 0 : opts.gap
  applyPadding(f, opts.pad)
  f.fills = opts.fill ? [solid(opts.fill)] : []
  if (opts.radius != null) f.cornerRadius = opts.radius
  if (opts.shadow) f.effects = cardShadow()
  if (opts.stroke) {
    f.strokes = [solid(opts.stroke)]
    f.strokeWeight = 1
  }
  if (opts.name) f.name = opts.name
  if (opts.align) f.primaryAxisAlignItems = opts.align
  if (opts.cross) f.counterAxisAlignItems = opts.cross
  if (opts.clip != null) f.clipsContent = opts.clip
  return f
}

function row(opts) {
  opts = opts || {}
  var f = figma.createFrame()
  f.layoutMode = 'HORIZONTAL'
  f.primaryAxisSizingMode = opts.width ? 'FIXED' : 'AUTO'
  f.counterAxisSizingMode = 'AUTO'
  if (opts.width) f.resize(opts.width, f.height)
  f.itemSpacing = opts.gap == null ? 8 : opts.gap
  applyPadding(f, opts.pad)
  f.fills = opts.fill ? [solid(opts.fill)] : []
  if (opts.radius != null) f.cornerRadius = opts.radius
  if (opts.name) f.name = opts.name
  f.primaryAxisAlignItems = opts.justify || 'MIN'
  f.counterAxisAlignItems = opts.cross || 'CENTER'
  if (opts.shadow) f.effects = cardShadow()
  if (opts.stroke) {
    f.strokes = [solid(opts.stroke)]
    f.strokeWeight = 1
  }
  return f
}

function applyPadding(f, pad) {
  if (pad == null) return
  if (typeof pad === 'number') {
    f.paddingTop = f.paddingBottom = f.paddingLeft = f.paddingRight = pad
  } else {
    f.paddingTop = pad.t || 0
    f.paddingBottom = pad.b || 0
    f.paddingLeft = pad.l || 0
    f.paddingRight = pad.r || 0
  }
}

function stretch(node) {
  node.layoutAlign = 'STRETCH'
  return node
}
function grow(node) {
  node.layoutGrow = 1
  return node
}

// ----------------------------------------------------------------------------
// Text helper
// ----------------------------------------------------------------------------
function text(str, opts) {
  opts = opts || {}
  var t = figma.createText()
  t.fontName = { family: 'Inter', style: opts.weight || 'Regular' }
  t.characters = String(str)
  t.fontSize = opts.size || 15
  t.fills = [solid(opts.color || C.ink)]
  if (opts.lh) t.lineHeight = { value: opts.lh, unit: 'PIXELS' }
  if (opts.ls) t.letterSpacing = { value: opts.ls, unit: 'PIXELS' }
  if (opts.align) t.textAlignHorizontal = opts.align
  if (opts.tracking) t.letterSpacing = { value: opts.tracking, unit: 'PERCENT' }
  return t
}

// uppercase muted section label
function eyebrow(str) {
  var t = text(str.toUpperCase(), { size: 11, weight: 'Semi Bold', color: C.muted, tracking: 6 })
  return t
}

// ----------------------------------------------------------------------------
// Component builders
// ----------------------------------------------------------------------------
function card(opts) {
  opts = opts || {}
  var c = col({
    fill: opts.fill || C.surface,
    radius: 16,
    pad: opts.pad == null ? 16 : opts.pad,
    gap: opts.gap == null ? 12 : opts.gap,
    shadow: opts.fill ? false : true,
    stroke: opts.fill ? null : C.line,
    name: opts.name || 'Card',
  })
  return c
}

function badge(label, bgHex, fgHex) {
  var b = row({ fill: bgHex, radius: 999, pad: { t: 3, b: 3, l: 8, r: 8 }, gap: 4, name: 'Badge' })
  b.appendChild(text(label, { size: 12, weight: 'Medium', color: fgHex }))
  return b
}

// circular icon chip with a single-letter glyph (lucide icons unavailable in plugin)
function iconChip(letter, bgHex, fgHex, size) {
  size = size || 36
  var chip = col({ width: size, height: size, fill: bgHex, radius: 999, align: 'CENTER', cross: 'CENTER', name: 'Icon' })
  chip.appendChild(text(letter, { size: 14, weight: 'Bold', color: fgHex }))
  return chip
}

function progressBar(pct, toneHex) {
  var track = col({ width: 0, height: 8, fill: C.canvas, radius: 999, name: 'Progress' })
  stretch(track)
  track.layoutMode = 'HORIZONTAL'
  track.primaryAxisSizingMode = 'FIXED'
  track.counterAxisSizingMode = 'FIXED'
  var fillW = Math.max(4, Math.min(100, pct))
  var bar = figma.createFrame()
  bar.resize(10, 8)
  bar.cornerRadius = 999
  bar.fills = [solid(toneHex)]
  bar.layoutGrow = 0
  // width set after append via flex: use fixed proportion of 358 (card inner width)
  bar.resize((fillW / 100) * 326, 8)
  track.appendChild(bar)
  return track
}

// list row: icon + title/subtitle + right amount/sub
function listRow(letter, iconBg, iconFg, title, subtitle, amount, amountColor, amountSub) {
  var r = row({ gap: 12, name: 'Row', justify: 'SPACE_BETWEEN' })
  r.counterAxisAlignItems = 'CENTER'
  var left = row({ gap: 12 })
  left.counterAxisAlignItems = 'CENTER'
  left.appendChild(iconChip(letter, iconBg, iconFg))
  var titleCol = col({ gap: 2 })
  titleCol.appendChild(text(title, { size: 14, weight: 'Semi Bold', color: C.ink }))
  if (subtitle) titleCol.appendChild(text(subtitle, { size: 12, color: C.muted }))
  left.appendChild(titleCol)
  r.appendChild(left)
  var right = col({ gap: 2 })
  right.counterAxisAlignItems = 'MAX'
  var amt = text(amount, { size: 15, weight: 'Semi Bold', color: amountColor || C.ink })
  right.appendChild(amt)
  if (amountSub) right.appendChild(text(amountSub, { size: 12, color: C.muted }))
  r.appendChild(right)
  stretch(r)
  return r
}

function divider() {
  var d = figma.createFrame()
  d.resize(326, 1)
  d.fills = [solid(C.line)]
  d.name = 'Divider'
  stretch(d)
  return d
}

// ----------------------------------------------------------------------------
// Donut chart from segments [{value,color}]
// ----------------------------------------------------------------------------
function donut(segments, size) {
  size = size || 160
  var total = 0
  for (var i = 0; i < segments.length; i++) total += segments[i].value
  var wrap = figma.createFrame()
  wrap.name = 'Donut'
  wrap.resize(size, size)
  wrap.fills = []
  var angle = -Math.PI / 2 // start at top
  for (var j = 0; j < segments.length; j++) {
    var frac = segments[j].value / total
    var sweep = frac * Math.PI * 2
    var e = figma.createEllipse()
    e.resize(size, size)
    e.x = 0
    e.y = 0
    e.fills = [solid(segments[j].color)]
    e.arcData = {
      startingAngle: angle,
      endingAngle: angle + sweep,
      innerRadius: 0.62,
    }
    wrap.appendChild(e)
    angle += sweep
  }
  return wrap
}

// vertical bar chart from [{label,value,color}]
function barChart(bars, maxVal, height) {
  height = height || 120
  var wrap = row({ gap: 14, name: 'Bars', justify: 'SPACE_BETWEEN' })
  wrap.counterAxisAlignItems = 'MAX'
  for (var i = 0; i < bars.length; i++) {
    var colWrap = col({ gap: 6, cross: 'CENTER' })
    colWrap.counterAxisAlignItems = 'CENTER'
    var barH = Math.max(6, (bars[i].value / maxVal) * height)
    var b = figma.createFrame()
    b.resize(26, barH)
    b.cornerRadius = 6
    b.fills = [solid(bars[i].color)]
    colWrap.appendChild(b)
    colWrap.appendChild(text(bars[i].label, { size: 10, color: C.muted }))
    wrap.appendChild(colWrap)
  }
  stretch(wrap)
  return wrap
}

// horizontal bar (for spending by category)
function hBar(label, valueLabel, pct, colorHex) {
  var wrap = col({ gap: 4 })
  var top = row({ justify: 'SPACE_BETWEEN' })
  top.appendChild(text(label, { size: 13, weight: 'Medium', color: C.ink }))
  top.appendChild(text(valueLabel, { size: 13, weight: 'Semi Bold', color: C.ink }))
  stretch(top)
  wrap.appendChild(top)
  wrap.appendChild(progressBar(pct, colorHex))
  stretch(wrap)
  return wrap
}

// ----------------------------------------------------------------------------
// Chrome: status bar + tab bar
// ----------------------------------------------------------------------------
function statusBar() {
  var s = row({ width: SCREEN_W, fill: C.canvas, pad: { t: 14, b: 6, l: 24, r: 24 }, justify: 'SPACE_BETWEEN', name: 'StatusBar' })
  s.counterAxisAlignItems = 'CENTER'
  s.appendChild(text('9:41', { size: 14, weight: 'Semi Bold', color: C.ink }))
  s.appendChild(text('●●●  ▼  100%', { size: 12, weight: 'Medium', color: C.ink }))
  return s
}

function tabBar(activeIndex) {
  var tabs = [
    { label: 'Home', g: '⌂' },
    { label: 'Txns', g: '≣' },
    { label: 'Portfolio', g: '◔' },
    { label: 'Budgets', g: '◫' },
    { label: 'More', g: '⋯' },
  ]
  var bar = row({ width: SCREEN_W, fill: C.surface, pad: { t: 10, b: 24, l: 8, r: 8 }, justify: 'SPACE_BETWEEN', name: 'TabBar' })
  bar.strokes = [solid(C.line)]
  try {
    bar.strokeTopWeight = 1
    bar.strokeBottomWeight = 0
    bar.strokeLeftWeight = 0
    bar.strokeRightWeight = 0
  } catch (sw) {
    bar.strokeWeight = 1 // fallback: uniform border if per-side unsupported
  }
  for (var i = 0; i < tabs.length; i++) {
    var active = i === activeIndex
    var tcol = col({ gap: 3, cross: 'CENTER' })
    tcol.counterAxisAlignItems = 'CENTER'
    grow(tcol)
    tcol.appendChild(text(tabs[i].g, { size: 18, weight: active ? 'Bold' : 'Regular', color: active ? C.brand600 : C.muted }))
    tcol.appendChild(text(tabs[i].label, { size: 10, weight: active ? 'Semi Bold' : 'Medium', color: active ? C.brand600 : C.muted }))
    bar.appendChild(tcol)
  }
  return bar
}

// assemble a screen: status bar + scrollable content + tab bar
function screen(name, activeTab, contentChildren) {
  var s = col({ width: SCREEN_W, fill: C.canvas, name: name, clip: true })
  s.appendChild(statusBar())
  var content = col({ gap: 16, pad: { t: 8, b: 20, l: 16, r: 16 } })
  stretch(content)
  for (var i = 0; i < contentChildren.length; i++) {
    var ch = contentChildren[i]
    content.appendChild(ch)
    stretch(ch)
  }
  s.appendChild(stretch(content))
  s.appendChild(tabBar(activeTab))
  return s
}

function topHeader(title, sub) {
  var h = col({ gap: 2, pad: { t: 8, b: 0 } })
  h.appendChild(text(title, { size: 24, weight: 'Bold', color: C.ink, ls: -0.5 }))
  if (sub) h.appendChild(text(sub, { size: 14, color: C.muted }))
  stretch(h)
  return h
}

// ----------------------------------------------------------------------------
// SCREENS
// ----------------------------------------------------------------------------
function buildDashboard() {
  // Net-worth hero (brand fill)
  var hero = col({ fill: C.brand600, radius: 16, pad: 20, gap: 8, name: 'NetWorthHero' })
  hero.appendChild(text('NET WORTH', { size: 11, weight: 'Semi Bold', color: C.brand100, tracking: 6 }))
  hero.appendChild(text('฿2,543,000', { size: 34, weight: 'Bold', color: C.white }))
  var deltaRow = row({ gap: 8 })
  deltaRow.appendChild(badge('▲ +฿63,000 (2.6%)', C.brand700, C.white))
  // recolor to a translucent white pill over the brand hero
  deltaRow.children[0].fills = [solid('#ffffff', 0.18)]
  deltaRow.appendChild(text('this month', { size: 12, color: C.brand100 }))
  hero.appendChild(deltaRow)

  // 2-up stat cards
  var stats = row({ gap: 12 })
  var assets = card({ gap: 4 })
  assets.appendChild(text('ASSETS', { size: 11, weight: 'Semi Bold', color: C.muted, tracking: 6 }))
  assets.appendChild(text('฿2.94M', { size: 22, weight: 'Bold', color: C.ink }))
  grow(assets)
  var debtsC = card({ gap: 4 })
  debtsC.appendChild(text('DEBTS', { size: 11, weight: 'Semi Bold', color: C.muted, tracking: 6 }))
  debtsC.appendChild(text('฿401K', { size: 22, weight: 'Bold', color: C.loss }))
  grow(debtsC)
  stats.appendChild(assets)
  stats.appendChild(debtsC)
  stretch(stats)

  // Cash flow card
  var cf = card({ name: 'CashFlow' })
  var cfHead = row({ justify: 'SPACE_BETWEEN' })
  cfHead.appendChild(text('Cash flow — June', { size: 14, weight: 'Semi Bold', color: C.ink }))
  cfHead.appendChild(text('+฿29,800', { size: 14, weight: 'Bold', color: C.gain }))
  stretch(cfHead)
  cf.appendChild(cfHead)
  cf.appendChild(
    barChart(
      [
        { label: 'Income', value: 67400, color: C.brand500 },
        { label: 'Expense', value: 37600, color: C.loss },
      ],
      70000,
      90,
    ),
  )

  // Allocation card with donut + legend
  var alloc = card({ name: 'Allocation' })
  alloc.appendChild(text('Asset allocation', { size: 14, weight: 'Semi Bold', color: C.ink }))
  var donutRow = row({ gap: 16 })
  donutRow.counterAxisAlignItems = 'CENTER'
  donutRow.appendChild(
    donut(
      [
        { value: 612, color: C.cSet },
        { value: 538, color: C.cUs },
        { value: 222, color: C.cCrypto },
        { value: 143, color: C.cFund },
        { value: 128, color: C.cGold },
        { value: 355, color: C.cCash },
      ],
      130,
    ),
  )
  var legend = col({ gap: 6 })
  grow(legend)
  var legItems = [
    ['Thai Stocks', '28%', C.cSet],
    ['US Stocks', '24%', C.cUs],
    ['Crypto', '11%', C.cCrypto],
    ['Funds', '7%', C.cFund],
    ['Gold', '6%', C.cGold],
    ['Cash', '24%', C.cCash],
  ]
  for (var i = 0; i < legItems.length; i++) {
    var li = row({ gap: 8, justify: 'SPACE_BETWEEN' })
    var dotName = row({ gap: 6 })
    dotName.counterAxisAlignItems = 'CENTER'
    var dot = figma.createEllipse()
    dot.resize(8, 8)
    dot.fills = [solid(legItems[i][2])]
    dotName.appendChild(dot)
    dotName.appendChild(text(legItems[i][0], { size: 12, color: C.muted }))
    li.appendChild(dotName)
    li.appendChild(text(legItems[i][1], { size: 12, weight: 'Semi Bold', color: C.ink }))
    stretch(li)
    legend.appendChild(li)
  }
  donutRow.appendChild(legend)
  stretch(donutRow)
  alloc.appendChild(donutRow)

  // Recent transactions
  var recent = card({ name: 'Recent' })
  var rHead = row({ justify: 'SPACE_BETWEEN' })
  rHead.appendChild(text('Recent', { size: 14, weight: 'Semi Bold', color: C.ink }))
  rHead.appendChild(text('See all →', { size: 12, weight: 'Medium', color: C.brand600 }))
  stretch(rHead)
  recent.appendChild(rHead)
  recent.appendChild(listRow('F', C.amber50, C.gold500, 'Lunch — som tam', 'Food · Cash', '−฿185', C.ink))
  recent.appendChild(divider())
  recent.appendChild(listRow('S', '#fce7f3', '#ec4899', 'Uniqlo', 'Shopping · Card', '−฿1,290', C.ink))
  recent.appendChild(divider())
  recent.appendChild(listRow('D', C.brand50, C.brand600, 'PTT dividend', 'Dividend · SET', '+฿2,400', C.gain))

  return screen('📱 Dashboard', 0, [topHeader('Good evening, Pong'), hero, stats, cf, alloc, recent])
}

function buildTransactions() {
  // filter segmented control
  var seg = row({ fill: C.surface, radius: 12, pad: 4, gap: 4, stroke: C.line })
  stretch(seg)
  var segLabels = ['All', 'Income', 'Expense']
  for (var i = 0; i < segLabels.length; i++) {
    var active = i === 0
    var pill = col({ fill: active ? C.brand600 : null, radius: 8, pad: { t: 6, b: 6 }, cross: 'CENTER' })
    pill.counterAxisAlignItems = 'CENTER'
    grow(pill)
    pill.appendChild(text(segLabels[i], { size: 13, weight: 'Semi Bold', color: active ? C.white : C.muted }))
    seg.appendChild(pill)
  }

  var todayCard = card()
  todayCard.appendChild(eyebrow('Today'))
  todayCard.appendChild(listRow('F', C.amber50, C.gold500, 'Lunch — som tam', 'Cash · 12:30', '−฿185', C.ink))
  todayCard.appendChild(divider())
  todayCard.appendChild(listRow('S', '#fce7f3', '#ec4899', 'Uniqlo', 'Card · 11:05', '−฿1,290', C.ink))

  var yCard = card()
  yCard.appendChild(eyebrow('Yesterday'))
  yCard.appendChild(listRow('T', '#e0e7ff', C.cUs, 'BTS', 'Cash', '−฿60', C.ink))
  yCard.appendChild(divider())
  yCard.appendChild(listRow('D', C.brand50, C.brand600, 'PTT dividend ⟳', 'SET · recurring', '+฿2,400', C.gain))
  yCard.appendChild(divider())
  yCard.appendChild(listRow('B', C.rose50, C.loss, 'Electricity ⟳', 'KBank · recurring', '−฿3,200', C.ink))

  var earlier = card()
  earlier.appendChild(eyebrow('Mar 1'))
  earlier.appendChild(listRow('I', C.brand50, C.brand600, 'Monthly salary ⟳', 'KBank', '+฿65,000', C.gain))
  earlier.appendChild(divider())
  earlier.appendChild(listRow('H', '#ede9fe', '#8b5cf6', 'Condo rent ⟳', 'KBank', '−฿15,000', C.ink))

  return screen('📱 Transactions', 1, [topHeader('Transactions', 'Search · filter'), seg, todayCard, yCard, earlier])
}

function buildPortfolio() {
  var hero = col({ fill: C.surface, radius: 16, pad: 20, gap: 8, shadow: true, stroke: C.line, name: 'TotalValue' })
  hero.appendChild(text('TOTAL VALUE', { size: 11, weight: 'Semi Bold', color: C.muted, tracking: 6 }))
  hero.appendChild(text('฿1,547,000', { size: 32, weight: 'Bold', color: C.ink }))
  var pl = row({ gap: 8 })
  pl.appendChild(badge('▲ +฿186,000', C.brand50, C.brand700))
  pl.appendChild(badge('+13.7%', C.brand50, C.brand700))
  hero.appendChild(pl)

  // tabs
  var tabs = row({ gap: 20, pad: { b: 2 } })
  var t1 = text('Holdings', { size: 14, weight: 'Bold', color: C.ink })
  var t2 = text('Dividends', { size: 14, weight: 'Medium', color: C.muted })
  tabs.appendChild(t1)
  tabs.appendChild(t2)

  var thai = card()
  thai.appendChild(eyebrow('Thai Stocks · SET'))
  thai.appendChild(listRow('P', C.brand50, C.brand600, 'PTT', '5,000 · ฿38.25', '฿191,250', C.ink, '▲ +10.9%'))
  thai.children[thai.children.length - 1].children[1].children[1].fills = [solid(C.gain)]
  thai.appendChild(divider())
  thai.appendChild(listRow('C', C.brand50, C.brand600, 'CPALL', '4,000 · ฿58.50', '฿234,000', C.ink, '▼ −5.6%'))
  thai.children[thai.children.length - 1].children[1].children[1].fills = [solid(C.loss)]

  var us = card()
  us.appendChild(eyebrow('US Stocks'))
  us.appendChild(listRow('V', '#e0e7ff', C.cUs, 'VOO', '12 · $498', '฿216,331', C.ink, '▲ +21%'))
  us.children[us.children.length - 1].children[1].children[1].fills = [solid(C.gain)]
  us.appendChild(divider())
  us.appendChild(listRow('A', '#e0e7ff', C.cUs, 'AAPL', '20 · $228', '฿165,072', C.ink, '▲ +38%'))
  us.children[us.children.length - 1].children[1].children[1].fills = [solid(C.gain)]

  var other = card()
  other.appendChild(eyebrow('Crypto · Gold'))
  other.appendChild(listRow('₿', C.amber50, C.cCrypto, 'Bitcoin', '0.065 BTC', '฿156,650', C.ink, '▲ +33.9%'))
  other.children[other.children.length - 1].children[1].children[1].fills = [solid(C.gain)]
  other.appendChild(divider())
  other.appendChild(listRow('G', '#fef9c3', C.gold600, 'Gold (3 baht)', '42,500/baht', '฿127,500', C.ink, '▲ +11.8%'))
  other.children[other.children.length - 1].children[1].children[1].fills = [solid(C.gain)]

  return screen('📱 Portfolio', 2, [topHeader('Portfolio'), hero, tabs, thai, us, other])
}

function buildBudgets() {
  var overall = col({ fill: C.brand600, radius: 16, pad: 20, gap: 10, name: 'BudgetSummary' })
  overall.appendChild(text('SPENT THIS MONTH', { size: 11, weight: 'Semi Bold', color: C.brand100, tracking: 6 }))
  var amtRow = row({ justify: 'SPACE_BETWEEN' })
  amtRow.counterAxisAlignItems = 'MAX'
  amtRow.appendChild(text('฿22,430', { size: 30, weight: 'Bold', color: C.white }))
  amtRow.appendChild(text('of ฿28,500', { size: 14, weight: 'Medium', color: C.brand100 }))
  stretch(amtRow)
  overall.appendChild(amtRow)
  var ptrack = progressBar(79, C.white)
  overall.appendChild(ptrack)

  function budgetRow(letter, bg, fg, name, spent, limit, pct, tone) {
    var cwrap = card({ gap: 8 })
    var top = row({ justify: 'SPACE_BETWEEN' })
    var l = row({ gap: 10 })
    l.counterAxisAlignItems = 'CENTER'
    l.appendChild(iconChip(letter, bg, fg, 30))
    l.appendChild(text(name, { size: 14, weight: 'Semi Bold', color: C.ink }))
    top.appendChild(l)
    top.appendChild(text(spent + ' / ' + limit, { size: 13, weight: 'Medium', color: C.muted }))
    stretch(top)
    cwrap.appendChild(top)
    cwrap.appendChild(progressBar(pct, tone))
    return cwrap
  }

  var b1 = budgetRow('F', C.amber50, C.gold500, 'Food', '฿9,480', '฿12,000', 79, C.brand500)
  var b2 = budgetRow('S', '#fce7f3', '#ec4899', 'Shopping', '฿5,390', '฿5,000', 108, C.loss)
  b2.appendChild(text('⚠ Over budget by ฿390', { size: 12, weight: 'Medium', color: C.loss }))
  var b3 = budgetRow('T', '#e0e7ff', C.cUs, 'Transport', '฿2,640', '฿3,000', 88, C.warn)
  var b4 = budgetRow('B', C.rose50, C.loss, 'Bills', '฿3,200', '฿4,000', 80, C.warn)
  var b5 = budgetRow('H', '#ccfbf1', '#14b8a6', 'Health', '฿540', '฿2,500', 22, C.brand500)

  return screen('📱 Budgets', 3, [topHeader('Budgets', 'June 2026'), overall, b1, b2, b3, b4, b5])
}

function buildGoals() {
  function goalCard(name, saved, target, pct, meta, done) {
    var c = card({ gap: 10 })
    var top = row({ justify: 'SPACE_BETWEEN' })
    top.appendChild(text(name, { size: 15, weight: 'Semi Bold', color: C.ink }))
    top.appendChild(badge(pct + '%', done ? C.brand50 : C.canvas, done ? C.brand700 : C.muted))
    stretch(top)
    c.appendChild(top)
    c.appendChild(text(saved + ' / ' + target, { size: 13, weight: 'Medium', color: C.muted }))
    c.appendChild(progressBar(pct, done ? C.brand600 : C.brand500))
    c.appendChild(text(meta, { size: 12, color: C.muted }))
    return c
  }
  var g1 = goalCard('New MacBook', '฿71,000', '฿75,000', 95, '2 months left · ฿2,000/mo', false)
  var g2 = goalCard('Emergency Fund', '฿210,000', '฿300,000', 70, '8 months left · ฿11,250/mo', false)
  var g3 = goalCard('Japan Trip 2026', '฿48,000', '฿120,000', 40, '5 months left · ฿14,400/mo', false)
  var g4 = goalCard('House Down Payment', '฿340,000', '฿1,500,000', 23, '36 months left · ฿32,222/mo', false)
  return screen('📱 Goals', 4, [topHeader('Savings Goals', '4 active goals'), g1, g2, g3, g4])
}

function buildDebts() {
  var summary = col({ fill: C.ink, radius: 16, pad: 20, gap: 6, name: 'DebtSummary' })
  summary.appendChild(text('TOTAL OWED', { size: 11, weight: 'Semi Bold', color: C.muted, tracking: 6 }))
  summary.appendChild(text('฿401,500', { size: 30, weight: 'Bold', color: C.white }))

  function debtCard(name, lender, body, rate, pay, pct, high) {
    var c = card({ gap: 8 })
    var top = row({ justify: 'SPACE_BETWEEN' })
    var l = col({ gap: 2 })
    l.appendChild(text(name, { size: 14, weight: 'Semi Bold', color: C.ink }))
    l.appendChild(text(lender, { size: 12, color: C.muted }))
    top.appendChild(l)
    if (high) top.appendChild(badge('⚠ ' + rate, C.rose50, C.loss))
    else top.appendChild(badge(rate, C.canvas, C.muted))
    stretch(top)
    c.appendChild(top)
    c.appendChild(text(body, { size: 13, weight: 'Medium', color: C.ink }))
    c.appendChild(progressBar(pct, C.brand500))
    c.appendChild(text(pay + ' / mo · ' + pct + '% paid off', { size: 12, color: C.muted }))
    return c
  }
  var d1 = debtCard('Car Loan', 'TTB Drive', '฿285,000 left of ฿480,000', '3.2%', '฿8,900', 41, false)
  var d2 = debtCard('Credit Card', 'Kasikornbank', '฿32,500 balance', '16%', '฿3,250', 0, true)
  var d3 = debtCard('Student Loan (กยศ.)', 'Student Loan Fund', '฿84,000 left of ฿180,000', '1%', '฿1,500', 53, false)

  // strategy toggle
  var toggle = row({ fill: C.surface, radius: 12, pad: 4, gap: 4, stroke: C.line })
  stretch(toggle)
  var opts = ['Snowball', 'Avalanche']
  for (var i = 0; i < opts.length; i++) {
    var active = i === 0
    var pill = col({ fill: active ? C.brand600 : null, radius: 8, pad: { t: 6, b: 6 }, cross: 'CENTER' })
    pill.counterAxisAlignItems = 'CENTER'
    grow(pill)
    pill.appendChild(text(opts[i], { size: 13, weight: 'Semi Bold', color: active ? C.white : C.muted }))
    toggle.appendChild(pill)
  }

  return screen('📱 Debts', 4, [topHeader('Debts', 'Payoff strategy'), summary, toggle, d1, d2, d3])
}

// ----------------------------------------------------------------------------
// Foundations swatch board
// ----------------------------------------------------------------------------
function buildFoundations() {
  var board = col({ fill: C.white, radius: 16, pad: 24, gap: 20, name: '🎨 Foundations' })
  board.resize(520, board.height)
  board.counterAxisSizingMode = 'FIXED'
  board.appendChild(text('BigWealth — Foundations', { size: 24, weight: 'Bold', color: C.ink }))

  board.appendChild(text('Brand & semantic', { size: 14, weight: 'Semi Bold', color: C.muted }))
  var swatches = [
    ['brand/600', C.brand600],
    ['brand/500', C.brand500],
    ['gold/500', C.gold500],
    ['gain', C.gain],
    ['loss', C.loss],
    ['warn', C.warn],
    ['ink', C.ink],
    ['muted', C.muted],
    ['canvas', C.canvas],
  ]
  // plain rows of 3 (avoids layoutWrap, which is version-sensitive)
  var gridCol = col({ gap: 10 })
  var rowRef = null
  for (var i = 0; i < swatches.length; i++) {
    if (i % 3 === 0) {
      rowRef = row({ gap: 10 })
      gridCol.appendChild(rowRef)
    }
    var sw = col({ gap: 6 })
    var chip = figma.createFrame()
    chip.resize(140, 56)
    chip.cornerRadius = 12
    chip.fills = [solid(swatches[i][1])]
    if (swatches[i][1] === C.canvas) {
      chip.strokes = [solid(C.line)]
      chip.strokeWeight = 1
    }
    sw.appendChild(chip)
    sw.appendChild(text(swatches[i][0] + '  ' + swatches[i][1], { size: 11, weight: 'Medium', color: C.muted }))
    rowRef.appendChild(sw)
  }
  board.appendChild(gridCol)

  board.appendChild(text('Type scale', { size: 14, weight: 'Semi Bold', color: C.muted }))
  board.appendChild(text('Display — ฿2,543,000', { size: 32, weight: 'Bold', color: C.ink }))
  board.appendChild(text('H1 — Page title', { size: 24, weight: 'Bold', color: C.ink }))
  board.appendChild(text('H2 — Card title', { size: 18, weight: 'Semi Bold', color: C.ink }))
  board.appendChild(text('Body — default text 15px', { size: 15, color: C.ink }))
  board.appendChild(text('Label — FIELD LABEL', { size: 13, weight: 'Medium', color: C.muted }))
  board.appendChild(text('Caption — timestamps 12px', { size: 12, color: C.muted }))
  return board
}

// ----------------------------------------------------------------------------
// Style library (color + text styles)
// ----------------------------------------------------------------------------
function createStyles() {
  var paints = [
    ['brand/600', C.brand600], ['brand/500', C.brand500], ['brand/100', C.brand100], ['brand/50', C.brand50],
    ['gold/500', C.gold500], ['gold/400', C.gold400],
    ['semantic/gain', C.gain], ['semantic/loss', C.loss], ['semantic/warn', C.warn],
    ['surface/ink', C.ink], ['surface/muted', C.muted], ['surface/line', C.line],
    ['surface/surface', C.surface], ['surface/canvas', C.canvas],
  ]
  var existing = {}
  var local = figma.getLocalPaintStyles()
  for (var i = 0; i < local.length; i++) existing[local[i].name] = true
  for (var j = 0; j < paints.length; j++) {
    if (existing[paints[j][0]]) continue
    var st = figma.createPaintStyle()
    st.name = paints[j][0]
    st.paints = [solid(paints[j][1])]
  }

  var texts = [
    ['display', 'Bold', 32, 38], ['h1', 'Bold', 24, 30], ['h2', 'Semi Bold', 18, 24],
    ['body', 'Regular', 15, 22], ['body-strong', 'Semi Bold', 15, 22],
    ['label', 'Medium', 13, 18], ['caption', 'Regular', 12, 16],
    ['num-lg', 'Bold', 28, 34], ['num-md', 'Semi Bold', 16, 22],
  ]
  var existingT = {}
  var localT = figma.getLocalTextStyles()
  for (var k = 0; k < localT.length; k++) existingT[localT[k].name] = true
  for (var m = 0; m < texts.length; m++) {
    if (existingT[texts[m][0]]) continue
    var ts = figma.createTextStyle()
    ts.name = texts[m][0]
    ts.fontName = { family: 'Inter', style: texts[m][1] }
    ts.fontSize = texts[m][2]
    ts.lineHeight = { value: texts[m][3], unit: 'PIXELS' }
  }
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------
async function main() {
  try {
    for (var i = 0; i < FONTS.length; i++) {
      await figma.loadFontAsync(FONTS[i])
    }

    // styles are non-critical — don't let an API change abort the screens
    try {
      createStyles()
    } catch (styleErr) {
      console.error('createStyles failed (continuing):', styleErr)
    }

    var foundations = buildFoundations()
    var screens = [
      buildDashboard(),
      buildTransactions(),
      buildPortfolio(),
      buildBudgets(),
      buildGoals(),
      buildDebts(),
    ]

    // lay out: foundations on top, screens in a row below
    foundations.x = 0
    foundations.y = 0
    var startY = foundations.height + 80
    var x = 0
    var all = [foundations]
    for (var s = 0; s < screens.length; s++) {
      screens[s].x = x
      screens[s].y = startY
      x += SCREEN_W + GAP_BETWEEN_SCREENS
      all.push(screens[s])
    }

    for (var a = 0; a < all.length; a++) figma.currentPage.appendChild(all[a])

    figma.currentPage.selection = all
    figma.viewport.scrollAndZoomIntoView(all)
    figma.notify('BigWealth UI generated ✓  (6 screens + foundations + styles)')
    return 'BigWealth UI generated: foundations + 6 screens + styles'
  } catch (e) {
    var msg = e && e.message ? e.message : String(e)
    console.error('BigWealth plugin error:', e)
    figma.notify('BigWealth error: ' + msg, { error: true, timeout: 120000 })
    throw e
  }
}

await main()
