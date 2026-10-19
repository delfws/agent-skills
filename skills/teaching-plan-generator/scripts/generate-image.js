#!/usr/bin/env node
/**
 * 教案图片生成器 - SVG + Sharp → PNG
 * 
 * 用法:
 *   node generate-image.js <json_data_file>
 *   node generate-image.js --demo
 * 
 * JSON 数据格式见 generate-image.js 中的 exampleData
 * 依赖: sharp (npm install sharp)
 */

const sharp = require(require('path').join(__dirname, '..', 'node_modules', 'sharp'));
const fs = require('fs');
const path = require('path');

// ========== 间距配置 ==========
const SPACING = {
  pagePaddingX: 55,        // 页面左右内边距
  pagePaddingTop: 50,      // 页面顶部内边距
  sectionGap: 48,          // 板块间距 (h2 之间)
  subsectionGap: 30,       // 子板块间距 (h3 之间)
  listItemGap: 18,         // 列表项间距
  tableCellPadX: 14,       // 表格单元格水平内边距
  tableCellPadY: 12,       // 表格单元格垂直内边距
  tableRowMinHeight: 40,   // 表格行最小高度
  lineGap: 6,              // 同一段落内行间距
  paragraphGap: 16,        // 段落间距
};

// ========== 字体配置 ==========
const FONTS = {
  main: '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", "WenQuanYi Micro Hei", sans-serif',
  mono: '"Courier New", "Noto Sans Mono CJK SC", monospace',
};

// ========== 颜色配置 ==========
const COLORS = {
  title: '#1a1a1a',
  heading: '#1a1a1a',
  body: '#333333',
  bold: '#1a1a1a',
  border: '#cccccc',
  headerBg: '#f0f0f0',
  labelBg: '#f5f5f5',
  cellBg: '#fafafa',
  boardBg: '#f9f9f9',
  boardBorder: '#dddddd',
  divider: '#e0e0e0',
};

/**
 * 生成教案 SVG
 * @param {Object} data - 教案数据
 * @returns {string} SVG 字符串
 */
function generateSVG(data) {
  const W = 800;
  let y = SPACING.pagePaddingTop;
  const elements = [];

  // 辅助函数：添加文字
  function addText(x, yPos, text, className, anchor = 'start') {
    elements.push(`<text x="${x}" y="${yPos}" text-anchor="${anchor}" class="${className}">${escapeXml(text)}</text>`);
  }

  // 辅助函数：添加分割线
  function addDivider(yPos) {
    elements.push(`<line x1="${SPACING.pagePaddingX}" y1="${yPos}" x2="${W - SPACING.pagePaddingX}" y2="${yPos}" stroke="${COLORS.divider}" stroke-width="2"/>`);
  }

  // 辅助函数：计算多行文字高度
  function textLines(text, maxWidth, fontSize) {
    const avgCharWidth = fontSize * 0.55;
    const charsPerLine = Math.floor(maxWidth / avgCharWidth);
    return Math.ceil(text.length / charsPerLine);
  }

  // ========== 标题 ==========
  addText(W / 2, y + 28, data.title, 'title', 'middle');
  y += 55;

  // ========== 信息表格 ==========
  if (data.infoTable && data.infoTable.length > 0) {
    const col1W = 150;
    const col2W = W - SPACING.pagePaddingX * 2 - col1W;
    const rowH = 34;
    
    data.infoTable.forEach((row, i) => {
      const ry = y + i * rowH;
      elements.push(`<rect x="${SPACING.pagePaddingX}" y="${ry}" width="${col1W}" height="${rowH}" fill="${COLORS.labelBg}" stroke="${COLORS.border}" stroke-width="1.5"/>`);
      elements.push(`<rect x="${SPACING.pagePaddingX + col1W}" y="${ry}" width="${col2W}" height="${rowH}" fill="white" stroke="${COLORS.border}" stroke-width="1.5"/>`);
      addText(SPACING.pagePaddingX + col1W / 2, ry + 22, row[0], 'body-bold', 'middle');
      addText(SPACING.pagePaddingX + col1W + 15, ry + 22, row[1], 'body');
    });
    y += data.infoTable.length * rowH + SPACING.sectionGap;
  }

  // ========== 各板块 ==========
  data.sections.forEach((section, sIdx) => {
    // 板块标题 (h2)
    addText(SPACING.pagePaddingX, y + 20, section.title, 'h2');
    y += 28;
    addDivider(y);
    y += SPACING.sectionGap - 20;

    if (section.type === 'list') {
      // 列表型内容（教学目标、教学反思等）
      section.items.forEach((item, i) => {
        if (item.label) {
          addText(SPACING.pagePaddingX + 20, y + 14, `${i + 1}. ${item.label}`, 'body-bold');
          y += SPACING.lineGap + 14;
          // 支持多行内容
          const lines = wrapText(item.text, W - SPACING.pagePaddingX * 2 - 40, 14);
          lines.forEach(line => {
            addText(SPACING.pagePaddingX + 40, y + 14, line, 'body');
            y += SPACING.lineGap + 14;
          });
        } else {
          const lines = wrapText(`${i + 1}. ${item.text}`, W - SPACING.pagePaddingX * 2 - 20, 14);
          lines.forEach((line, li) => {
            addText(SPACING.pagePaddingX + 20, y + 14, line, 'body');
            y += SPACING.lineGap + 14;
          });
        }
        y += SPACING.listItemGap;
      });
      y += SPACING.paragraphGap;

    } else if (section.type === 'subsections') {
      // 带子标题的内容（教学分析等）
      const subTitleX = SPACING.pagePaddingX + 20;
      const subItemX = SPACING.pagePaddingX + 40;
      const subItemW = W - subItemX - SPACING.pagePaddingX;

      section.subsections.forEach(sub => {
        // 子标题：加粗显示
        addText(subTitleX, y + 16, sub.title, 'h3');
        y += 30;

        sub.items.forEach((item, i) => {
          if (item.label) {
            // 有标签：标签（加粗）+ 内容（正常）
            addText(subItemX, y + 14, item.label, 'body-bold');
            y += SPACING.lineGap + 14;
            const lines = wrapText(item.text, subItemW - 10, 14);
            lines.forEach(line => {
              addText(subItemX + 10, y + 14, line, 'body');
              y += SPACING.lineGap + 14;
            });
          } else {
            // 无标签：编号 + 内容
            const fullText = `${i + 1}. ${item.text}`;
            const lines = wrapText(fullText, subItemW, 14);
            lines.forEach((line, li) => {
              const xOff = li === 0 ? subItemX : subItemX + 10;
              addText(xOff, y + 14, line, 'body');
              y += SPACING.lineGap + 14;
            });
          }
          y += 8;
        });
        y += SPACING.paragraphGap - 8;
      });

    } else if (section.type === 'table') {
      // 四栏表格（教学过程）
      const colWidths = section.colWidths || [120, 260, 170, 150];
      const totalW = colWidths.reduce((a, b) => a + b, 0);
      const startX = SPACING.pagePaddingX;

      // 表头
      elements.push(`<rect x="${startX}" y="${y}" width="${totalW}" height="35" fill="${COLORS.headerBg}" stroke="${COLORS.border}" stroke-width="1.5"/>`);
      let colX = startX;
      section.headers.forEach((h, ci) => {
        if (ci > 0) {
          elements.push(`<line x1="${colX}" y1="${y}" x2="${colX}" y2="${y + 35}" stroke="${COLORS.border}" stroke-width="1.5"/>`);
        }
        addText(colX + colWidths[ci] / 2, y + 22, h, 'table-header', 'middle');
        colX += colWidths[ci];
      });
      y += 35;

      // 表格行
      section.rows.forEach(row => {
        // 计算行高：取所有单元格中最大行数
        const cellFontSize = 13;
        const cellLineH = cellFontSize + SPACING.lineGap; // 每行高度
        const cellLines = row.cells.map((cell, ci) => {
          const maxW = colWidths[ci] - SPACING.tableCellPadX * 2;
          return wrapText(cell.text || '', maxW, cellFontSize).length;
        });
        const maxLines = Math.max(...cellLines);
        const rowH = Math.max(SPACING.tableRowMinHeight, maxLines * cellLineH + SPACING.tableCellPadY * 2);

        // 绘制单元格背景和边框
        colX = startX;
        row.cells.forEach((cell, ci) => {
          const bg = ci === 0 ? COLORS.cellBg : 'white';
          elements.push(`<rect x="${colX}" y="${y}" width="${colWidths[ci]}" height="${rowH}" fill="${bg}" stroke="${COLORS.border}" stroke-width="1.5"/>`);
          
          // 单元格内容
          const lines = wrapText(cell.text || '', colWidths[ci] - SPACING.tableCellPadX * 2, cellFontSize);
          // 垂直居中：计算起始Y坐标
          const contentH = lines.length * cellLineH;
          const cellStartY = y + (rowH - contentH) / 2 + cellFontSize; // 底线位置
          lines.forEach((line, li) => {
            const cls = cell.bold ? 'body-bold' : 'small';
            addText(colX + SPACING.tableCellPadX, cellStartY + li * cellLineH, line, cls);
          });

          colX += colWidths[ci];
        });
        y += rowH;
      });
      y += SPACING.paragraphGap;

    } else if (section.type === 'board') {
      // 板书设计（特殊样式，高度自适应）
      const boardLines = section.content.split('\n');
      const boardLineH = 24;
      const boardPadTop = 30;
      const boardPadBottom = 20;
      const boardH = boardPadTop + boardLines.length * boardLineH + boardPadBottom;
      elements.push(`<rect x="${SPACING.pagePaddingX}" y="${y}" width="${W - SPACING.pagePaddingX * 2}" height="${boardH}" fill="${COLORS.boardBg}" stroke="${COLORS.boardBorder}" stroke-width="1.5" rx="6"/>`);
      
      const boardStartY = y + boardPadTop;
      boardLines.forEach((line, i) => {
        addText(W / 2, boardStartY + i * boardLineH + 14, line.trim(), 'board', 'middle');
      });
      y += boardH + SPACING.paragraphGap;

    } else if (section.type === 'text') {
      // 普通段落文本
      const lines = wrapText(section.content, W - SPACING.pagePaddingX * 2 - 20, 14);
      lines.forEach(line => {
        addText(SPACING.pagePaddingX + 20, y + 14, line, 'body');
        y += SPACING.lineGap + 14;
      });
      y += SPACING.paragraphGap;
    }
  });

  // 计算总高度
  const totalH = y + 50;

  // ========== 组装 SVG ==========
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${totalH}" viewBox="0 0 ${W} ${totalH}">
  <defs>
    <style>
      text { font-family: ${FONTS.main}; }
      .title { font-size: 28px; font-weight: bold; fill: ${COLORS.title}; }
      .h2 { font-size: 20px; font-weight: bold; fill: ${COLORS.heading}; }
      .h3 { font-size: 16px; font-weight: bold; fill: ${COLORS.body}; }
      .body { font-size: 14px; fill: ${COLORS.body}; }
      .body-bold { font-size: 14px; font-weight: bold; fill: ${COLORS.bold}; }
      .small { font-size: 13px; fill: ${COLORS.body}; }
      .table-header { font-size: 14px; font-weight: bold; fill: ${COLORS.bold}; }
      .board { font-family: ${FONTS.mono}; font-size: 14px; fill: ${COLORS.body}; }
    </style>
  </defs>
  <rect width="${W}" height="${totalH}" fill="white"/>
  ${elements.join('\n  ')}
</svg>`;

  return svg;
}

/**
 * 计算单个字符的显示宽度
 * 中文字符约占字体大小的 1.0 倍，英文/数字约占 0.55 倍
 */
function charWidth(ch, fontSize) {
  const code = ch.charCodeAt(0);
  // 中文字符范围：CJK统一汉字、CJK标点、全角字符
  if (
    (code >= 0x4E00 && code <= 0x9FFF) ||   // CJK统一汉字
    (code >= 0x3000 && code <= 0x303F) ||   // CJK标点符号
    (code >= 0xFF00 && code <= 0xFFEF) ||   // 全角字符
    (code >= 0x2E80 && code <= 0x2EFF) ||   // CJK部首补充
    (code >= 0xF900 && code <= 0xFAFF) ||   // CJK兼容象形文字
    (code >= 0xFE30 && code <= 0xFE4F) ||   // CJK兼容形式
    (code >= 0x2000 && code <= 0x206F)      // 通用标点（部分全角）
  ) {
    return fontSize * 1.0;
  }
  // ASCII 字符
  if (code >= 0x20 && code <= 0x7E) {
    return fontSize * 0.6;
  }
  // 其他字符按全角处理
  return fontSize * 1.0;
}

/**
 * 计算文本字符串的总显示宽度
 */
function textWidth(text, fontSize) {
  let width = 0;
  for (const ch of text) {
    width += charWidth(ch, fontSize);
  }
  return width;
}

/**
 * 文本自动换行（支持中英文混排）
 */
function wrapText(text, maxWidth, fontSize) {
  if (!text) return [''];
  
  // 如果文本宽度没超，直接返回
  if (textWidth(text, fontSize) <= maxWidth) {
    return [text];
  }
  
  const result = [];
  let remaining = text;
  
  while (remaining.length > 0) {
    if (textWidth(remaining, fontSize) <= maxWidth) {
      result.push(remaining);
      break;
    }
    
    // 逐字符查找断点
    let breakAt = 0;
    let currentWidth = 0;
    const punctuation = '，。、；：！？）》」』】,.;:!?)';
    let lastPunctPos = -1;
    
    for (let i = 0; i < remaining.length; i++) {
      const w = charWidth(remaining[i], fontSize);
      currentWidth += w;
      
      // 记录最后一个标点位置
      if (punctuation.includes(remaining[i])) {
        lastPunctPos = i + 1;
      }
      
      if (currentWidth > maxWidth) {
        // 超出宽度了，在此处断行
        if (lastPunctPos > 0 && lastPunctPos > i - 8) {
          // 优先在最近的标点后断行
          breakAt = lastPunctPos;
        } else if (i > 0) {
          // 在当前字符前断行
          breakAt = i;
        } else {
          breakAt = 1;
        }
        break;
      }
    }
    
    if (breakAt === 0) {
      // 没找到断点，全部放入
      breakAt = remaining.length;
    }
    
    result.push(remaining.substring(0, breakAt));
    remaining = remaining.substring(breakAt);
  }
  
  return result.length > 0 ? result : [''];
}

/**
 * XML 特殊字符转义
 */
function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 机读配置：从 SKILL.md 的「字数红线」一节读取（红线的唯一事实源）
 */
function loadSkillConfig() {
  const skillPath = path.join(__dirname, '..', 'SKILL.md');
  if (!fs.existsSync(skillPath)) {
    throw new Error(`未找到 SKILL.md: ${skillPath}`);
  }
  const md = fs.readFileSync(skillPath, 'utf-8');
  const blocks = Array.from(md.matchAll(/```json\s*([\s\S]*?)```/g), m => m[1]);
  const block = blocks.find(b => b.includes('"limits"'));
  if (!block) {
    throw new Error('SKILL.md 中未找到含 "limits" 的机读配置块（见「字数红线」一节）');
  }
  let cfg;
  try {
    cfg = JSON.parse(block);
  } catch (e) {
    throw new Error('SKILL.md 机读配置块 JSON 解析失败: ' + e.message);
  }
  if (!cfg.limits || !Array.isArray(cfg.steps) || cfg.steps.length === 0) {
    throw new Error('SKILL.md 机读配置块缺少 limits 或 steps');
  }
  return cfg;
}

/** 汉字计数（与 SKILL.md 字数口径一致） */
function zhCount(s) {
  return ((s || '').match(/[\u4e00-\u9fff]/g) || []).length;
}

/** 按 SKILL.md 配置校验教案数据，返回错误列表（空数组 = 通过） */
function validateData(data, cfg) {
  const L = cfg.limits;
  const errs = [];
  const secs = data.sections || [];
  const zh = zhCount;

  // 1. 表头
  if (!Array.isArray(data.infoTable) || data.infoTable.length !== L.info_rows) {
    errs.push(`表头信息应为 ${L.info_rows} 行，实际 ${data.infoTable ? data.infoTable.length : 0} 行`);
  }

  // 2. 教学目标
  const goals = secs.find(s => s.type === 'list' && (s.title || '').includes('教学目标'));
  if (!goals) {
    errs.push('缺少「教学目标」板块');
  } else {
    if (goals.items.length !== L.goal_items) {
      errs.push(`教学目标应为 ${L.goal_items} 条，实际 ${goals.items.length} 条`);
    }
    goals.items.forEach((it, i) => {
      const n = zh(it.label) + zh(it.text);
      if (n > L.goal_per_item) errs.push(`教学目标第 ${i + 1} 条 ${n} 字，超出上限 ${L.goal_per_item}（差 ${n - L.goal_per_item} 字）`);
    });
  }

  // 3. 教学分析
  const ana = secs.find(s => s.type === 'subsections');
  if (!ana) {
    errs.push('缺少「教学分析」板块');
  } else {
    L.analysis_sections.forEach(t => {
      if (!ana.subsections.some(sub => (sub.title || '').includes(t))) errs.push(`教学分析缺少「${t}」`);
    });
    ana.subsections.forEach(sub => {
      const n = sub.items.reduce((a, it) => a + zh(it.label) + zh(it.text), 0);
      if (n > L.analysis_per_item) errs.push(`教学分析「${sub.title}」${n} 字，超出上限 ${L.analysis_per_item}（差 ${n - L.analysis_per_item} 字）`);
    });
  }

  // 4. 教学过程
  const tbl = secs.find(s => s.type === 'table');
  if (!tbl) {
    errs.push('缺少「教学过程」表格');
  } else {
    if (tbl.rows.length !== cfg.steps.length) {
      errs.push(`教学过程应为 ${cfg.steps.length} 行（${cfg.steps.join('、')}），实际 ${tbl.rows.length} 行`);
    }
    tbl.rows.forEach((row, i) => {
      const want = cfg.steps[i];
      if (!want) return;
      const raw = row.cells[0].text || '';
      const got = raw.replace(/^\s*[一二三四五六七八九十]+、/, '').replace(/（[^）]*）|\([^)]*\)/g, '').trim();
      if (got !== want) errs.push(`第 ${i + 1} 行「教学步骤」应为「${want}」，实际「${raw}」`);
    });

    // 新课导入行：每格字数
    if (tbl.rows[0]) {
      tbl.rows[0].cells.forEach((c, ci) => {
        if (ci > 0 && zh(c.text) > L.import_cell) {
          errs.push(`新课导入行第 ${ci + 1} 格 ${zh(c.text)} 字，超出上限 ${L.import_cell}（差 ${zh(c.text) - L.import_cell} 字）`);
        }
      });
    }

    // 新课教学行：三栏字数 + 分点逐条对应
    const t2 = tbl.rows[1] && tbl.rows[1].cells;
    if (t2) {
      [[L.teacher_new, '教师活动', 1], [L.student_new, '学生活动', 2], [L.intent_new, '设计意图', 3]].forEach(v => {
        const n = zh(t2[v[2]].text);
        if (n > v[0]) errs.push(`新课教学行${v[1]} ${n} 字，超出上限 ${v[0]}（差 ${n - v[0]} 字）`);
      });
      const cnt = s => ((s || '').match(/[①②③④⑤⑥⑦⑧⑨]/g) || []).length;
      const cn = cnt(t2[1].text), sn = cnt(t2[2].text);
      if (cn > 0 && sn !== cn) errs.push(`教师活动分 ${cn} 点、学生活动分 ${sn} 点，必须逐条对应`);
    }

    const total = tbl.rows.reduce((a, row) => a + row.cells.reduce((b, c) => b + zh(c.text), 0), 0);
    if (total > L.table_total) errs.push(`教学过程表格合计 ${total} 字，超出上限 ${L.table_total}（差 ${total - L.table_total} 字）`);
  }

  // 5. 板书设计
  const board = secs.find(s => s.type === 'board');
  if (!board) {
    errs.push('缺少「板书设计」板块');
  } else {
    const lines = board.content.split('\n');
    if (lines.length > L.board_lines) errs.push(`板书设计 ${lines.length} 行，超出上限 ${L.board_lines} 行`);
    const n = zh(board.content);
    if (n > L.board_chars) errs.push(`板书设计 ${n} 字，超出上限 ${L.board_chars} 字（差 ${n - L.board_chars} 字）`);
  }

  // 6. 课堂小结
  const sum = secs.find(s => s.type === 'text');
  if (!sum) {
    errs.push('缺少「课堂小结」板块');
  } else if (zh(sum.content) > L.summary) {
    errs.push(`课堂小结 ${zh(sum.content)} 字，超出上限 ${L.summary} 字（差 ${zh(sum.content) - L.summary} 字）`);
  }

  // 7. 教学反思
  const r = secs.find(s => s.type === 'list' && (s.title || '').includes('反思'));
  if (!r) {
    errs.push('缺少「教学反思」板块');
  } else {
    if (r.items.length !== L.reflection_items) errs.push(`教学反思应为 ${L.reflection_items} 条，实际 ${r.items.length} 条`);
    r.items.forEach(it => {
      if (zh(it.text) > L.reflection) errs.push(`教学反思 ${zh(it.text)} 字，超出上限 ${L.reflection} 字`);
    });
  }

  // 8. 全文（合课以 multi: true 切换上限）
  const cap = data.multi ? L.total_multi : L.total;
  const full = zh(JSON.stringify(data));
  if (full > cap) errs.push(`全文 ${full} 字，超出上限 ${cap} 字（差 ${full - cap} 字）`);

  return errs;
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');

  let data;
  if (args.includes('--demo')) {
    const demoPath = path.join(__dirname, '..', 'templates', 'example-lesson.json');
    if (!fs.existsSync(demoPath)) throw new Error('未找到示例数据: ' + demoPath);
    data = JSON.parse(fs.readFileSync(demoPath, 'utf-8'));
  } else {
    const file = args.find(a => !a.startsWith('--'));
    if (!file || !fs.existsSync(file)) {
      console.error('用法: node generate-image.js <json_data_file>');
      console.error('      node generate-image.js --demo');
      console.error('      node generate-image.js <json_data_file> --check   （只校验，不出图）');
      process.exit(1);
    }
    data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  }

  // 出图前按 SKILL.md 机读配置校验（守门：只报错，不代改内容）
  const errs = validateData(data, loadSkillConfig());
  if (errs.length > 0) {
    console.error('❌ 未通过 SKILL.md 规范校验（共 ' + errs.length + ' 项）:');
    errs.forEach(e => console.error('   - ' + e));
    process.exit(1);
  }
  console.log('✅ 校验通过（依据 SKILL.md 机读配置）');
  if (checkOnly) return;

  const svg = generateSVG(data);
  const svgBuffer = Buffer.from(svg);
  
  const outputPath = data.outputPath || path.join(
    process.env.TMPDIR || '/tmp',
    `${data.title || '教案'}-图片.png`
  );

  // 确保输出目录存在
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  await sharp(svgBuffer)
    .png({ quality: 100 })
    .toFile(outputPath);

  console.log(`✅ 图片已生成: ${outputPath}`);
  console.log(`   大小: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`);
}

main().catch(err => {
  console.error('❌ 生成失败:', err.message);
  process.exit(1);
});
